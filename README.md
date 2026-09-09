# NETRIX — AI-Powered Digital Forensics, Graph Intelligence & Blockchain Integrity System

NETRIX is an end-to-end criminal intelligence and digital forensics analysis system integrating machine learning, temporal graph analytics, natural language entity extraction, and immutable blockchain chain-of-custody.

---

## Key Capabilities

- **Digital Forensics & Ingestion**: Secure evidence upload, multi-modal parser (FIRs, server logs, CDRs, transaction ledgers, disk images, network PCAPs), physical SHA-256 integrity verification.
- **Blockchain Chain-of-Custody**: Smart contract-backed action provenance (`REGISTERED`, `VERIFIED`, `ANALYZED`, `REVIEWED`, `TRANSFERRED`) on Ethereum/Hardhat, tamper detection, and audit trail verification.
- **NLP & Entity Extraction**: Transformer-based Named Entity Recognition (spacy `en_core_web_trf`), rule-based regex extractors, relationship & event extraction.
- **Temporal Graph Intelligence**: Neo4j-backed criminal entity graph with time-bounded query filters and path discovery.
- **Machine Learning Analytics**:
  - **Suspect Link Prediction**: Random Forest link predictor computing connectivity probability between suspicious entities.
  - **Anomaly Detection**: Isolation Forest identifying anomalous entities, financial transactions, and unusual communication patterns.
  - **Investigative Priority Score (IPS)**: Composite risk metric prioritizing critical leads for forensic investigators.
- **Explainability & AI Assistant**: Contextual natural language explanations with citation of provenance and evidence IDs (optional Gemini integration with rule-based fallback).
- **Security & RBAC**: Role-Based Access Control (`admin`, `supervisor`, `investigator`, `analyst`) with JWT bearer tokens and immutable audit logging.

---

## Quick Start Guide

### 1. Environment Setup
```bash
# Activate virtual environment
venv\Scripts\activate

# Install dependencies
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_trf
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env` inside `backend/`:
```bash
cp .env.example .env
```
Fill in your credentials for PostgreSQL, Neo4j, Redis, and Blockchain RPC.

### 3. Start Hardhat Blockchain Node (Optional for local chain)
```bash
cd backend/blockchain
npx hardhat node
```

### 4. Run the Backend API Server
```bash
cd backend
uvicorn main:app --reload
```
Interactive API documentation will be available at `http://127.0.0.1:8000/docs`.

---

## Testing & Verification

Run the comprehensive test suites from the `backend/` directory:
```bash
# Blockchain & Chain-of-Custody Integration Tests
python test_blockchain_integration.py

# Full 12-Suite Backend Verification
python test_backend_full_verification.py

# Machine Learning & AI Adapter Tests
python test_adapter_pipeline.py
python test_intelligence_layers.py
```
