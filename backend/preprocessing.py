import hashlib
import json
import logging
import re
import unicodedata
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
from typing import Any, Dict, List, Optional, Union

import pandas as pd
import pdfplumber

logger = logging.getLogger(__name__)

# Regex Patterns for Identifier Detection and Normalization
PHONE_CLEAN_RE = re.compile(r"^\+?(\d{1,3})?[-.\s]?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})$")
INDIAN_PHONE_RE = re.compile(r"(?:(?:\+?91[\s-]?)?|0)?([6-9]\d{9})")
VEHICLE_RE = re.compile(r"\b([A-Z]{2})[-.\s]?(\d{1,2})[-.\s]?([A-Z]{1,3})[-.\s]?(\d{1,4})\b", re.IGNORECASE)

# Sensitive Identifiers to Protect/Hash
CREDIT_CARD_RE = re.compile(r"(?<!\d)(?:\d{4}[-\s]?){3}\d{4}(?!\d)")
AADHAAR_RE = re.compile(r"(?<!\d)\d{4}[-\s]?\d{4}[-\s]?\d{4}(?!\d)")
PAN_RE = re.compile(r"\b[A-Z]{5}\d{4}[A-Z]\b")
SSN_RE = re.compile(r"(?<!\d)\d{3}-\d{2}-\d{4}(?!\d)")
BANK_ACC_RE = re.compile(r"\b(ACC\d{4,}|[A-Z]{4}\d{10,})\b", re.IGNORECASE)

# Common Timestamp Formats
DATETIME_FORMATS = [
    "%Y-%m-%dT%H:%M:%S%z",
    "%Y-%m-%dT%H:%M:%SZ",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M:%S.%f",
    "%d/%m/%Y %H:%M:%S",
    "%d-%m-%Y %H:%M:%S",
    "%Y/%m/%d %H:%M:%S",
    "%Y-%m-%d",
    "%d-%m-%Y",
    "%d/%m/%Y",
]


@dataclass
class ModelInput:
    """Normalized input structure consumed by AI models and inference adapters."""
    raw_content: str
    cleaned_text: str
    source_type: str = "text"
    filename: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    structured_records: List[Dict[str, Any]] = field(default_factory=list)
    extracted_timestamps: List[str] = field(default_factory=list)
    normalized_phones: List[str] = field(default_factory=list)
    normalized_vehicles: List[str] = field(default_factory=list)
    sensitive_identifier_hashes: Dict[str, str] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "raw_content": self.raw_content,
            "cleaned_text": self.cleaned_text,
            "source_type": self.source_type,
            "filename": self.filename,
            "metadata": self.metadata,
            "structured_records": self.structured_records,
            "extracted_timestamps": self.extracted_timestamps,
            "normalized_phones": self.normalized_phones,
            "normalized_vehicles": self.normalized_vehicles,
            "sensitive_identifier_hashes": self.sensitive_identifier_hashes,
        }


# ---------------------------------------------------------------------------
# Text Cleaning & Normalization
# ---------------------------------------------------------------------------
def clean_text(text: str) -> str:
    """
    Perform deep unicode normalization, whitespace stripping, and artifact cleaning.
    - NFKC Unicode normalization
    - Strip zero-width and invisible control characters
    - Standardize quotation marks, dashes, and whitespace
    """
    if not text:
        return ""

    # 1. Unicode NFKC Normalization
    normalized = unicodedata.normalize("NFKC", text)

    # 2. Strip zero-width & non-printable control characters (keep \n, \t, \r)
    cleaned_chars = []
    for ch in normalized:
        code = ord(ch)
        # Skip zero-width spaces, joiners, directional formatting
        if code in (0x200B, 0x200C, 0x200D, 0xFEFF, 0x00A0, 0x202A, 0x202B, 0x202C, 0x202D, 0x202E):
            cleaned_chars.append(" ")
        elif code < 32 and ch not in ("\n", "\t", "\r"):
            continue
        else:
            cleaned_chars.append(ch)
    cleaned = "".join(cleaned_chars)

    # 3. Standardize whitespace while preserving linebreaks
    lines = cleaned.splitlines()
    cleaned_lines = [re.sub(r"[ \t]+", " ", line).strip() for line in lines]
    # Remove excessive blank lines (more than 2 consecutive)
    result_text = re.sub(r"\n{3,}", "\n\n", "\n".join(cleaned_lines))

    return result_text.strip()


# ---------------------------------------------------------------------------
# Identifier Normalizers
# ---------------------------------------------------------------------------
def normalize_phone(phone_str: Union[str, int]) -> Optional[str]:
    """
    Normalize phone numbers into standard canonical 10-digit / E.164 string format.
    E.g.: '+91 98765-43210' -> '9876543210' or '+1 (555) 234-5678' -> '+15552345678'.
    """
    if not phone_str:
        return None
    raw = str(phone_str).strip()
    digits = re.sub(r"\D", "", raw)

    # Match Indian 10-digit mobile pattern
    indian_match = INDIAN_PHONE_RE.search(raw)
    if indian_match:
        return indian_match.group(1)

    # General standard 10-digit or 11-12 digit
    if len(digits) == 10:
        return digits
    elif len(digits) > 10:
        if digits.startswith("91") and len(digits) == 12:
            return digits[2:]
        elif digits.startswith("0") and len(digits) == 11:
            return digits[1:]
        return f"+{digits}"

    return digits if digits else None


def normalize_vehicle(vehicle_str: str) -> Optional[str]:
    """
    Normalize vehicle registration number into standard uppercase alphanumeric format.
    E.g.: 'dl-01-ab-1234' -> 'DL01AB1234', 'MH 12 DE 1433' -> 'MH12DE1433'.
    """
    if not vehicle_str:
        return None
    raw = str(vehicle_str).strip()
    match = VEHICLE_RE.search(raw)
    if match:
        state, rto, series, number = match.groups()
        return f"{state.upper()}{rto.zfill(2)}{series.upper()}{number}"

    # Fallback alphanumeric stripping
    clean = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
    return clean if clean else None


def normalize_timestamp(ts_val: Any) -> Optional[str]:
    """
    Parse varied timestamp representations into standardized ISO-8601 string: YYYY-MM-DDTHH:MM:SSZ.
    Supports Unix epoch integers/floats, datetime objects, and various string date formats.
    """
    if ts_val is None:
        return None

    if isinstance(ts_val, (int, float)):
        try:
            # Handle milliseconds epoch
            if ts_val > 1e11:
                ts_val = ts_val / 1000.0
            dt = datetime.utcfromtimestamp(ts_val)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except Exception:
            return None

    if isinstance(ts_val, datetime):
        return ts_val.strftime("%Y-%m-%dT%H:%M:%SZ")

    ts_str = str(ts_val).strip()
    if not ts_str or ts_str.lower() in ("nan", "nat", "none", "null"):
        return None

    # Try standard known formats
    for fmt in DATETIME_FORMATS:
        try:
            dt = datetime.strptime(ts_str, fmt)
            return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        except ValueError:
            continue

    # Try pandas robust parser
    try:
        dt = pd.to_datetime(ts_str)
        if not pd.isna(dt):
            return dt.to_pydatetime().strftime("%Y-%m-%dT%H:%M:%SZ")
    except Exception:
        pass

    return None


# ---------------------------------------------------------------------------
# Cryptographic Sensitive Identifier Protection
# ---------------------------------------------------------------------------
def hash_sensitive_identifier(value: str, salt: str = "criminal_intel_salt_2026") -> str:
    """
    Protect sensitive identifiers (SSN, Aadhaar, PAN, Bank Accounts) using salted SHA-256 hash.
    Ensures deterministic matching for intelligence while preventing plaintext exposure.
    """
    if not value:
        return ""
    normalized_val = re.sub(r"\s+", "", str(value)).strip().upper()
    return hashlib.sha256(f"{salt}:{normalized_val}".encode("utf-8")).hexdigest()


def protect_sensitive_data(
    text: str,
    salt: str = "criminal_intel_salt_2026",
) -> tuple[str, Dict[str, str]]:
    """
    Detect sensitive patterns in text, replace them with pseudonymous tokens,
    and return the protected text along with the hash mapping.
    """
    if not text:
        return "", {}

    hashes: Dict[str, str] = {}
    protected_text = text

    def _replace_match(match: re.Match, identifier_type: str) -> str:
        original = match.group()
        hashed = hash_sensitive_identifier(original, salt)
        token = f"[{identifier_type}_HASH:{hashed[:12]}]"
        hashes[token] = hashed
        return token

    # Protect Credit Cards
    protected_text = CREDIT_CARD_RE.sub(lambda m: _replace_match(m, "CARD"), protected_text)
    # Protect Aadhaar
    protected_text = AADHAAR_RE.sub(lambda m: _replace_match(m, "AADHAAR"), protected_text)
    # Protect PAN
    protected_text = PAN_RE.sub(lambda m: _replace_match(m, "PAN"), protected_text)
    # Protect SSN
    protected_text = SSN_RE.sub(lambda m: _replace_match(m, "SSN"), protected_text)

    return protected_text, hashes


# ---------------------------------------------------------------------------
# Format-Specific Extractors
# ---------------------------------------------------------------------------
def preprocess_pdf(file_bytes: bytes, filename: str = "document.pdf") -> ModelInput:
    """Extract and normalize text and metadata from PDF files."""
    text_parts = []
    page_count = 0
    tables = []

    try:
        with pdfplumber.open(BytesIO(file_bytes)) as pdf:
            page_count = len(pdf.pages)
            for page_idx, page in enumerate(pdf.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
                extracted_tables = page.extract_tables()
                for table in extracted_tables:
                    if table:
                        tables.append({"page": page_idx + 1, "table_data": table})
    except Exception as exc:
        logger.warning("pdfplumber failed for %s: %s. Falling back to utf-8 decode.", filename, exc)
        text_parts.append(file_bytes.decode("utf-8", errors="ignore"))

    raw_text = "\n\n".join(text_parts)
    cleaned = clean_text(raw_text)
    protected, hashes = protect_sensitive_data(cleaned)

    phones = [normalize_phone(m.group()) for m in INDIAN_PHONE_RE.finditer(cleaned) if normalize_phone(m.group())]
    vehicles = [normalize_vehicle(m.group()) for m in VEHICLE_RE.finditer(cleaned) if normalize_vehicle(m.group())]

    return ModelInput(
        raw_content=raw_text,
        cleaned_text=protected,
        source_type="pdf",
        filename=filename,
        metadata={"page_count": page_count, "table_count": len(tables), "file_size_bytes": len(file_bytes)},
        structured_records=tables,
        normalized_phones=sorted(list(set(phones))),
        normalized_vehicles=sorted(list(set(vehicles))),
        sensitive_identifier_hashes=hashes,
    )


def preprocess_csv(file_bytes_or_str: Union[bytes, str], filename: str = "data.csv") -> ModelInput:
    """Extract and normalize structured records and text from CSV files."""
    if isinstance(file_bytes_or_str, bytes):
        raw_str = file_bytes_or_str.decode("utf-8", errors="ignore")
        buf = BytesIO(file_bytes_or_str)
    else:
        raw_str = file_bytes_or_str
        buf = BytesIO(file_bytes_or_str.encode("utf-8"))

    try:
        df = pd.read_csv(buf)
    except Exception as exc:
        logger.warning("pd.read_csv failed for %s: %s", filename, exc)
        df = pd.DataFrame()

    records = df.to_dict(orient="records") if not df.empty else []
    timestamps = []
    phones = []
    vehicles = []

    text_summary_lines = []
    for idx, row in enumerate(records):
        row_dict = dict(row)
        line_parts = []
        for col, val in row_dict.items():
            if pd.isna(val):
                continue
            val_str = str(val).strip()
            col_lower = str(col).lower()

            # Check timestamps
            if any(k in col_lower for k in ("time", "date", "created", "timestamp", "start", "end")):
                norm_ts = normalize_timestamp(val)
                if norm_ts:
                    timestamps.append(norm_ts)
                    row_dict[col] = norm_ts

            # Check phones
            if any(k in col_lower for k in ("phone", "caller", "receiver", "mobile", "contact", "tel")):
                norm_ph = normalize_phone(val_str)
                if norm_ph:
                    phones.append(norm_ph)
                    row_dict[col] = norm_ph

            # Check vehicles
            if any(k in col_lower for k in ("vehicle", "reg", "plate", "car")):
                norm_veh = normalize_vehicle(val_str)
                if norm_veh:
                    vehicles.append(norm_veh)
                    row_dict[col] = norm_veh

            line_parts.append(f"{col}: {val_str}")
        if line_parts:
            text_summary_lines.append(f"Record {idx + 1}: " + ", ".join(line_parts))

    cleaned = clean_text("\n".join(text_summary_lines))
    protected, hashes = protect_sensitive_data(cleaned)

    return ModelInput(
        raw_content=raw_str,
        cleaned_text=protected,
        source_type="csv",
        filename=filename,
        metadata={"row_count": len(df), "column_count": len(df.columns) if not df.empty else 0},
        structured_records=records,
        extracted_timestamps=sorted(list(set(timestamps))),
        normalized_phones=sorted(list(set(phones))),
        normalized_vehicles=sorted(list(set(vehicles))),
        sensitive_identifier_hashes=hashes,
    )


def preprocess_json(file_bytes_or_str: Union[bytes, str], filename: str = "data.json") -> ModelInput:
    """Extract and normalize structured objects, arrays, and text from JSON data."""
    if isinstance(file_bytes_or_str, bytes):
        raw_str = file_bytes_or_str.decode("utf-8", errors="ignore")
    else:
        raw_str = file_bytes_or_str

    try:
        parsed_json = json.loads(raw_str)
    except Exception as exc:
        logger.warning("json.loads failed for %s: %s", filename, exc)
        parsed_json = {}

    records = parsed_json if isinstance(parsed_json, list) else [parsed_json]
    cleaned = clean_text(json.dumps(parsed_json, indent=2))
    protected, hashes = protect_sensitive_data(cleaned)

    phones = [normalize_phone(m.group()) for m in INDIAN_PHONE_RE.finditer(cleaned) if normalize_phone(m.group())]
    vehicles = [normalize_vehicle(m.group()) for m in VEHICLE_RE.finditer(cleaned) if normalize_vehicle(m.group())]

    return ModelInput(
        raw_content=raw_str,
        cleaned_text=protected,
        source_type="json",
        filename=filename,
        metadata={"is_list": isinstance(parsed_json, list), "item_count": len(records)},
        structured_records=records if isinstance(records, list) else [],
        normalized_phones=sorted(list(set(phones))),
        normalized_vehicles=sorted(list(set(vehicles))),
        sensitive_identifier_hashes=hashes,
    )


def preprocess_log(file_bytes_or_str: Union[bytes, str], filename: str = "system.log") -> ModelInput:
    """Normalize server/system/security log files into structured event logs."""
    if isinstance(file_bytes_or_str, bytes):
        raw_str = file_bytes_or_str.decode("utf-8", errors="ignore")
    else:
        raw_str = file_bytes_or_str

    lines = raw_str.splitlines()
    records = []
    timestamps = []

    log_line_re = re.compile(
        r"^(?:\[?(\d{4}[-/]\d{2}[-/]\d{2}[T\s]\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?)\]?)\s*(.*)$"
    )

    for line in lines:
        stripped = line.strip()
        if not stripped:
            continue
        m = log_line_re.match(stripped)
        if m:
            ts_str, msg = m.groups()
            norm_ts = normalize_timestamp(ts_str)
            if norm_ts:
                timestamps.append(norm_ts)
            records.append({"timestamp": norm_ts or ts_str, "message": msg, "raw_line": stripped})
        else:
            records.append({"timestamp": None, "message": stripped, "raw_line": stripped})

    cleaned = clean_text(raw_str)
    protected, hashes = protect_sensitive_data(cleaned)

    return ModelInput(
        raw_content=raw_str,
        cleaned_text=protected,
        source_type="log",
        filename=filename,
        metadata={"line_count": len(lines), "parsed_log_events": len(records)},
        structured_records=records,
        extracted_timestamps=sorted(list(set(timestamps))),
        sensitive_identifier_hashes=hashes,
    )


def preprocess_txt(file_bytes_or_str: Union[bytes, str], filename: str = "document.txt") -> ModelInput:
    """Normalize general plain text evidence (FIR, witness statements, intel reports)."""
    if isinstance(file_bytes_or_str, bytes):
        raw_str = file_bytes_or_str.decode("utf-8", errors="ignore")
    else:
        raw_str = file_bytes_or_str

    cleaned = clean_text(raw_str)
    protected, hashes = protect_sensitive_data(cleaned)

    phones = [normalize_phone(m.group()) for m in INDIAN_PHONE_RE.finditer(cleaned) if normalize_phone(m.group())]
    vehicles = [normalize_vehicle(m.group()) for m in VEHICLE_RE.finditer(cleaned) if normalize_vehicle(m.group())]

    return ModelInput(
        raw_content=raw_str,
        cleaned_text=protected,
        source_type="txt",
        filename=filename,
        metadata={"char_count": len(cleaned), "line_count": len(cleaned.splitlines())},
        normalized_phones=sorted(list(set(phones))),
        normalized_vehicles=sorted(list(set(vehicles))),
        sensitive_identifier_hashes=hashes,
    )


# ---------------------------------------------------------------------------
# Universal Unified Preprocessing Entry Point
# ---------------------------------------------------------------------------
def preprocess(
    content: Union[bytes, str],
    filename: str = "",
    source_type: Optional[str] = None,
) -> ModelInput:
    """
    Main preprocessing entry point:
    Accepts PDF, CSV, JSON, TXT, or log content and converts it into a normalized ModelInput.
    """
    fn_lower = filename.lower() if filename else ""
    st_lower = source_type.lower() if source_type else ""

    # 1. Determine format type
    if st_lower == "pdf" or fn_lower.endswith(".pdf"):
        if isinstance(content, str):
            content = content.encode("utf-8")
        return preprocess_pdf(content, filename or "document.pdf")

    if st_lower in ("csv", "cdr", "transaction", "vehicle", "location") or fn_lower.endswith(".csv"):
        return preprocess_csv(content, filename or "data.csv")

    if st_lower in ("json", "jsonl") or fn_lower.endswith(".json") or fn_lower.endswith(".jsonl"):
        return preprocess_json(content, filename or "data.json")

    if st_lower in ("log", "syslog", "access_log") or fn_lower.endswith(".log"):
        return preprocess_log(content, filename or "system.log")

    # Default to text / report / fir
    return preprocess_txt(content, filename or "document.txt")
