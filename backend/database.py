from contextlib import contextmanager
import time

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from neo4j import GraphDatabase

from config import settings

# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=300,
    pool_size=10,
    max_overflow=20,
    connect_args={
        "connect_timeout": 10,
    },
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Neo4j (Optimized for Aura cloud connection lifecycle)
# ---------------------------------------------------------------------------
neo4j_driver = GraphDatabase.driver(
    settings.NEO4J_URI,
    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
    max_connection_lifetime=60,
    max_connection_pool_size=10,
    connection_acquisition_timeout=1.0,
    connection_timeout=1.0,
    max_transaction_retry_time=1.0,
    keep_alive=False,
)


import socket
from urllib.parse import urlparse

_NEO4J_ONLINE: bool | None = False
_NEO4J_LAST_CHECK: float = 0.0


import concurrent.futures

def _probe_neo4j() -> bool:
    with neo4j_driver.session() as s:
        s.run("RETURN 1").single()
    return True


def is_neo4j_online() -> bool:
    global _NEO4J_ONLINE, _NEO4J_LAST_CHECK
    now = time.time()
    if _NEO4J_ONLINE is not None and (now - _NEO4J_LAST_CHECK) < 300.0:
        return _NEO4J_ONLINE
    try:
        uri = settings.NEO4J_URI or ""
        parsed = urlparse(uri)
        host = parsed.hostname or "localhost"
        port = parsed.port or (7687 if "bolt" in (parsed.scheme or "") or "neo4j" in (parsed.scheme or "") else 7474)
        with socket.create_connection((host, port), timeout=1.0):
            pass
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            future = executor.submit(_probe_neo4j)
            _NEO4J_ONLINE = bool(future.result(timeout=1.5))
    except Exception:
        _NEO4J_ONLINE = False
    _NEO4J_LAST_CHECK = now
    return _NEO4J_ONLINE


@contextmanager
def get_neo4j_session():
    if not is_neo4j_online():
        raise RuntimeError("Neo4j is currently offline or unreachable")
    session = neo4j_driver.session()
    try:
        yield session
    finally:
        try:
            session.close()
        except Exception:
            pass

