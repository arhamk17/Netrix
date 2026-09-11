<![CDATA[<div align="center">

# NETRIX

### Criminal Network Intelligence & Digital Forensics Platform

[![License](https://img.shields.io/badge/License-Proprietary-6D001A?style=flat-square)](LICENSE)
[![Python](https://img.shields.io/badge/Python-3.11+-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?style=flat-square&logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![Neo4j](https://img.shields.io/badge/Neo4j-5.x-4581C3?style=flat-square&logo=neo4j&logoColor=white)](https://neo4j.com/)
[![Ethereum](https://img.shields.io/badge/Ethereum-Hardhat-3C3C3D?style=flat-square&logo=ethereum&logoColor=white)](https://hardhat.org/)

---

An end-to-end criminal intelligence, digital forensics analysis, and evidence integrity system integrating graph neural networks, temporal analytics, natural language entity extraction, and immutable blockchain chain-of-custody.

</div>

---

## Overview

NETRIX is a full-stack investigative intelligence platform purpose-built for criminal network analysis. It connects entities, evidence, events, and relationships through a 3D knowledge graph backed by Neo4j, ensures evidence immutability via Ethereum smart contracts, and surfaces investigative leads through machine learning models — all behind a role-based access control system designed for law enforcement workflows.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        NETRIX PLATFORM                          │
├──────────────────────┬──────────────────────────────────────────┤
│                      │                                          │
│   ┌──────────────┐   │   ┌──────────────────────────────────┐   │
│   │   Frontend    │   │   │           Backend API             │   │
│   │   React 19    │   │   │         FastAPI + Uvicorn         │   │
│   │   Vite 6      │◄──┼──►│                                  │   │
│   │   Three.js    │   │   │  ┌────────┐  ┌──────────────┐    │   │
│   │   Tailwind 4  │   │   │  │  Auth  │  │  NLP Pipeline │    │   │
│   │   Motion      │   │   │  │  RBAC  │  │  spaCy + NER  │    │   │
│   └──────────────┘   │   │  └────────┘  └──────────────┘    │   │
│                      │   │  ┌────────┐  ┌──────────────┐    │   │
│                      │   │  │  ML    │  │   Analytics   │    │   │
│                      │   │  │ Models │  │   Temporal    │    │   │
│                      │   │  └────────┘  └──────────────┘    │   │
│                      │   └──────────────────────────────────┘   │
│                      │                                          │
│   ┌──────────────┐   │   ┌──────────────┐  ┌───────────────┐   │
│   │  Blockchain   │   │   │   Neo4j      │  │  PostgreSQL   │   │
│   │  Hardhat +    │◄──┼──►│  Graph DB    │  │  + Redis      │   │
│   │  Solidity     │   │   │  Knowledge   │  │  Celery       │   │
│   └──────────────┘   │   └──────────────┘  └───────────────┘   │
└──────────────────────┴──────────────────────────────────────────┘
```

---

## Key Capabilities

### 🔍 Digital Forensics & Evidence Ingestion
- Secure evidence upload with multi-modal parsing (FIRs, server logs, CDRs, transaction ledgers, disk images, network PCAPs)
- Physical SHA-256 integrity verification on all ingested artifacts
- Court-ready export with cryptographic attestation

### 🔗 Blockchain Chain-of-Custody
- Smart contract-backed action provenance (`REGISTERED → VERIFIED → ANALYZED → REVIEWED → TRANSFERRED`)
- Ethereum/Hardhat on-chain tamper detection and Merkle proof verification
- Immutable audit trail with zero-knowledge integrity attestation

### 🧠 NLP & Entity Extraction
- Transformer-based Named Entity Recognition (spaCy `en_core_web_trf`)
- Rule-based regex extractors for phones, emails, crypto wallets, IPs, and financial identifiers
- Automated relationship and event extraction from unstructured evidence

### 🌐 3D Knowledge Graph
- Neo4j-backed criminal entity graph with interactive Three.js 3D visualization
- Time-bounded query filters, shortest path discovery, and multi-hop tracing
- Louvain community detection and betweenness centrality analysis

### 📊 Machine Learning & Graph Neural Networks
- **Graph Neural Networks (GNN)**: HeteroCrimeGNN and GraphSAGE models for entity embedding and link prediction
- **Suspect Link Prediction**: Random Forest computing connectivity probability between suspicious entities
- **Anomaly Detection**: Isolation Forest identifying anomalous entities and unusual patterns
- **Investigative Priority Score (IPS)**: Composite risk metric prioritizing critical leads
- **Multi-Dataset Adapters**: FIR, CDR, Financial, NCRB, and ToN-IoT data adapters with risk fusion

### 💡 Explainability & Intelligence Engine
- Contextual natural language explanations with evidence provenance citation
- Multi-hop decision attribution chains for transparent reasoning
- Optional Gemini integration with rule-based fallback

### 🔒 Security & RBAC
- 5-tier Role-Based Access Control: `Admin` → `Supervisor` → `Investigator` → `Analyst` → `Auditor`
- JWT bearer token authentication with clearance-gated permissions
- Immutable audit logging for all investigative actions

---

## Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 19, TypeScript, Vite 6, Tailwind CSS 4, Three.js, Framer Motion, Lucide Icons |
| **Backend API** | Python 3.11+, FastAPI, Uvicorn, Pydantic, SQLAlchemy |
| **Graph Database** | Neo4j 5.x (Cypher queries, GDS algorithms) |
| **Relational DB** | PostgreSQL 15+ with Alembic migrations |
| **Cache & Queue** | Redis, Celery (async task processing) |
| **Blockchain** | Solidity, Hardhat, Ethers.js (local/testnet Ethereum) |
| **NLP** | spaCy (en_core_web_trf), custom regex extractors |
| **ML / GNN** | scikit-learn, PyTorch, GraphSAGE, HeteroCrimeGNN |
| **Auth** | JWT, bcrypt, role-based clearance tiers |

---

## Project Structure

```
Netrix/
├── frontend/                      # React frontend application
│   ├── src/
│   │   ├── components/
│   │   │   ├── ai/                # Intelligence console & investigator dashboard
│   │   │   ├── analytics/         # Analytics & metrics views
│   │   │   ├── cases/             # Case management interface
│   │   │   ├── command/           # Command center
│   │   │   ├── common/            # Navbar, Sidebar, shared components
│   │   │   ├── evidence/          # Evidence vault & file management
│   │   │   ├── explain/           # Explainability view
│   │   │   ├── graph/             # 3D Knowledge Graph (Three.js)
│   │   │   ├── hero/              # Landing hero section & auth modal
│   │   │   ├── integrity/         # Blockchain integrity verification
│   │   │   ├── intelligence/      # Investigation intelligence engine
│   │   │   ├── leads/             # Investigative leads management
│   │   │   ├── models/            # ML model performance dashboard
│   │   │   ├── profile/           # User profile & forensic avatar
│   │   │   └── temporal/          # Temporal intelligence & timeline
│   │   ├── context/               # Auth context & state management
│   │   ├── data/                  # Role definitions & static data
│   │   ├── services/              # API client service layer
│   │   └── utils/                 # Graph traceability & report export
│   ├── public/                    # Static assets & logos
│   ├── server.ts                  # Express SSR server
│   ├── vite.config.ts             # Vite build configuration
│   └── package.json
│
├── backend/                       # FastAPI backend application
│   ├── main.py                    # FastAPI app entry point & route registration
│   ├── auth.py                    # JWT auth, RBAC, user management
│   ├── database.py                # PostgreSQL + SQLAlchemy setup
│   ├── models.py                  # ORM models (cases, evidence, entities, leads)
│   ├── schemas.py                 # Pydantic request/response schemas
│   ├── config.py                  # Environment configuration
│   ├── ingestion.py               # Multi-modal evidence ingestion & parsing
│   ├── nlp_pipeline.py            # NLP entity/relationship extraction (spaCy)
│   ├── graph_service.py           # Neo4j graph operations & Cypher queries
│   ├── analytics.py               # Analytics, metrics, temporal analysis
│   ├── leads.py                   # Investigative lead generation & scoring
│   ├── explainability.py          # Explainability engine & reasoning chains
│   ├── ai_assistant.py            # Intelligence assistant (Gemini + fallback)
│   ├── blockchain_service.py      # Ethereum smart contract integration
│   ├── model_adapter.py           # ML model adapter layer
│   ├── model_metrics.py           # Model performance & telemetry
│   ├── preprocessing.py           # Data preprocessing pipelines
│   ├── celery_app.py              # Celery async task worker
│   ├── seed.py                    # Database seeding with demo data
│   ├── ml_models/
│   │   ├── feature_engineering.py # Feature extraction for ML models
│   │   └── gnn/                   # Graph Neural Network models
│   │       ├── graphsage.py       # GraphSAGE implementation
│   │       ├── hetero_crime_gnn.py# Heterogeneous Crime GNN
│   │       ├── gnn_service.py     # GNN inference service
│   │       ├── schema.py          # GNN data schemas
│   │       ├── fusion/            # Multi-model risk fusion
│   │       └── adapters/          # Dataset-specific adapters (FIR, CDR, etc.)
│   ├── blockchain/                # Hardhat project
│   │   ├── contracts/             # Solidity smart contracts
│   │   ├── ignition/              # Deployment modules
│   │   ├── scripts/               # Deployment scripts
│   │   ├── test/                  # Contract unit tests
│   │   └── hardhat.config.ts
│   └── requirements.txt
│
└── README.md
```

---

## Quick Start

### Prerequisites

- **Python** 3.11+
- **Node.js** 18+ & npm
- **PostgreSQL** 15+
- **Neo4j** 5.x
- **Redis** 7+

### 1. Clone & Setup Backend

```bash
git clone https://github.com/arhamk17/Netrix.git
cd Netrix

# Create Python virtual environment
python -m venv venv
venv\Scripts\activate          # Windows
# source venv/bin/activate     # Linux/macOS

# Install backend dependencies
cd backend
pip install -r requirements.txt
python -m spacy download en_core_web_trf
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `backend/.env` with your credentials:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/netrix
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=your_password
REDIS_URL=redis://localhost:6379/0
SECRET_KEY=your_jwt_secret
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
```

### 3. Start Infrastructure Services

```bash
# Start PostgreSQL, Neo4j, and Redis (ensure they're running)

# Start Hardhat local blockchain (optional)
cd backend/blockchain
npm install
npx hardhat node
```

### 4. Seed the Database

```bash
cd backend
python seed.py
```

### 5. Start the Backend API

```bash
cd backend
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

API docs available at: **http://localhost:8000/docs**

### 6. Start Celery Worker (for async tasks)

```bash
cd backend
celery -A celery_app.celery_app worker --loglevel=info --pool=solo
```

### 7. Start the Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend available at: **http://localhost:5173**

---

## Testing

Run test suites from the `backend/` directory:

```bash
# Full backend verification (12 test suites)
python test_backend_full_verification.py

# Blockchain & chain-of-custody integration
python test_blockchain_integration.py

# ML model adapter pipeline tests
python test_adapter_pipeline.py

# Intelligence layer tests
python test_intelligence_layers.py

# Live end-to-end integration tests
python test_live_e2e_integration.py

# Security & RBAC tests
python test_security.py
```

---

## User Roles & Clearance

| Role | Clearance | Access |
|---|---|---|
| **Admin** | Level 5 — Root | Full platform control, key genesis, operator provisioning |
| **Supervisor** | Level 4 — Tactical | Case approvals, investigator allocation, inter-agency sharing |
| **Investigator** | Level 3 — Operational | Evidence ingestion, graph tracing, lead triage, report generation |
| **Analyst** | Level 3 — Analytical | Graph clustering, link prediction tuning, explainability paths |
| **Auditor** | Level 3 — Custodial | Merkle proof audits, tamper verification, compliance certification |

---

## Frontend Modules

| Module | Description |
|---|---|
| **Knowledge Graph** | Interactive 3D entity relationship graph with filters, entity inspector, and community detection |
| **Case Management** | Create, assign, and track forensic investigation cases with status workflows |
| **Evidence Vault** | Upload, parse, and verify digital evidence with SHA-256 integrity checks |
| **Intelligence Engine** | Investigation findings with confidence scoring, evidence signals, and reasoning |
| **Investigative Leads** | Prioritized leads with hypothesis triage and graph-backed attribution |
| **Analytics** | Network metrics, temporal burst analysis, and model performance telemetry |
| **Explainability** | Multi-hop decision paths and transparent reasoning for all predictions |
| **Integrity Verification** | On-chain Merkle proof verification and blockchain audit trails |
| **Temporal Intelligence** | Timeline-based activity analysis with chronological clustering |
| **Command Center** | Operational command dashboard for real-time platform monitoring |
| **Profile & RBAC** | Role-specific dashboards with security hardware details and permissions matrix |

---

## License

This project is proprietary. All rights reserved.

---

<div align="center">
  <sub>Built by <a href="https://github.com/arhamk17">Arham Khan</a></sub>
</div>
]]>
