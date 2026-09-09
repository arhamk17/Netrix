from contextlib import contextmanager

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from neo4j import GraphDatabase

from config import settings

# ---------------------------------------------------------------------------
# PostgreSQL
# ---------------------------------------------------------------------------
engine = create_engine(settings.DATABASE_URL, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ---------------------------------------------------------------------------
# Neo4j
# ---------------------------------------------------------------------------
neo4j_driver = GraphDatabase.driver(
    settings.NEO4J_URI,
    auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
)


@contextmanager
def get_neo4j_session():
    session = neo4j_driver.session()
    try:
        yield session
    finally:
        session.close()
