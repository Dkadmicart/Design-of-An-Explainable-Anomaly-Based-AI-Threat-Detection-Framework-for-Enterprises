# SentinelAI

**Enterprise Cybersecurity Threat Detection & Investigation Platform**

An AI/ML-powered security operations platform that ingests network flow data, detects anomalous and malicious traffic patterns, classifies attack types, and provides explainable threat intelligence for security analysts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TypeScript)             │
│  Dashboard │ Live Monitor │ Alerts │ Investigation │ ...    │
├─────────────────────────────────────────────────────────────┤
│                    REST API + WebSocket                      │
├─────────────────────────────────────────────────────────────┤
│                    Backend (FastAPI + Python)                │
│  API Routes │ Services │ ML Service │ Replay Engine         │
├─────────────────────────────────────────────────────────────┤
│                    ML Pipeline                               │
│  Random Forest │ XGBoost │ Isolation Forest │ Autoencoder   │
│  Risk Scorer │ SHAP Explainer │ MITRE Mapper                │
├─────────────────────────────────────────────────────────────┤
│                    Data Layer                                │
│  PostgreSQL/SQLite │ CIC-IDS2017 Dataset                    │
└─────────────────────────────────────────────────────────────┘
```

## Features

- **SOC Dashboard** — KPIs, threat timeline, attack distribution, risk overview
- **Live Threat Monitor** — Real-time event stream with streaming controls
- **Alert Management** — Full triage workflow with severity filtering
- **Alert Investigation** — Threat summary, explainability, MITRE ATT&CK mapping, analyst notes
- **Network Events** — Paginated, filterable event table with detail expansion
- **Investigation Workspace** — IP/entity search with attack progression timeline
- **MITRE ATT&CK** — Tactic/technique hierarchy with detection mapping
- **ML Model Management** — Model comparison, metrics tracking (training/validation/test)
- **Research Analytics** — Attack distribution, class imbalance, performance charts
- **Dataset Management** — CIC-IDS2017 file tracking, import/validation
- **System Health** — Service status monitoring
- **Dataset Replay Engine** — Simulate real-time detection from historical data

## Design

- **White + Yellow/Amber** enterprise design language
- **Inter** font family
- Clean, minimal, professional — no dark cyberpunk themes
- Desktop-first responsive layout
- Collapsible sidebar navigation

---

## Quick Start

### Prerequisites

- **Node.js** 18+ and npm
- **Python** 3.10+
- Git

### 1. Clone the Repository

```bash
git clone <repo-url>
cd Design-of-An-Explainable-Anomaly-Based-AI-Threat-Detection-Framework-for-Enterprises
```

### 2. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend will be available at **http://localhost:5173**.

### 3. Backend Setup

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS/Linux
source venv/bin/activate

pip install -r requirements.txt

# Copy environment file
cp ../.env.example .env

# Start the server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at **http://localhost:8000**.  
API docs: **http://localhost:8000/api/docs**

### 4. Database Setup

The application uses **SQLite** by default for zero-config development. Tables are created automatically on startup.

For PostgreSQL:
```bash
# Update .env
DATABASE_URL=postgresql+asyncpg://user:password@localhost:5432/sentinelai

# Install asyncpg
pip install asyncpg
```

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | `sqlite+aiosqlite:///./sentinelai.db` | Database connection string |
| `CORS_ORIGINS` | `["http://localhost:5173"]` | Allowed CORS origins |
| `SECRET_KEY` | (change in production) | Application secret key |
| `DEMO_MODE` | `true` | Enable demo data mode |
| `ML_MODEL_PATH` | `./ml/artifacts` | Path to trained model files |
| `DATASET_PATH` | `./data/raw` | Path to raw dataset files |
| `LOG_LEVEL` | `INFO` | Logging level |
| `ALERT_RISK_THRESHOLD` | `50.0` | Risk score threshold for alerts |

See [.env.example](.env.example) for all options.

---

## Project Structure

```
├── frontend/                   # React + TypeScript + Tailwind CSS
│   ├── src/
│   │   ├── components/layout/  # Sidebar, Header, Layout
│   │   ├── pages/              # 12 application pages
│   │   ├── data/               # Demo data generators (clearly labeled)
│   │   └── types/              # TypeScript type definitions
│   ├── vite.config.ts
│   └── package.json
│
├── backend/                    # Python FastAPI
│   ├── app/
│   │   ├── api/                # REST API route handlers
│   │   ├── models/             # SQLAlchemy ORM models
│   │   ├── ml/                 # ML model interfaces & risk scorer
│   │   ├── database/           # DB session management
│   │   ├── core/               # Configuration
│   │   └── main.py             # FastAPI entry point
│   └── requirements.txt
│
├── ml/                         # ML training & evaluation (Phase 2)
│   ├── training/
│   ├── preprocessing/
│   ├── evaluation/
│   └── artifacts/              # Trained model files
│
├── data/
│   ├── raw/                    # Raw CIC-IDS2017 CSV files
│   └── processed/              # Cleaned/preprocessed data
│
├── docs/                       # Documentation
├── tests/                      # Test suites
├── docker-compose.yml          # Docker deployment
├── .env.example                # Environment template
└── README.md
```

---

## API Documentation

All endpoints follow RESTful conventions.

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/health` | Health check |
| GET | `/api/dashboard/summary` | Dashboard KPIs |
| GET | `/api/events` | List events (paginated, filterable) |
| GET | `/api/events/{id}` | Event detail |
| GET | `/api/alerts` | List alerts |
| GET | `/api/alerts/{id}` | Alert detail |
| POST | `/api/alerts/{id}/resolve` | Resolve alert |
| POST | `/api/alerts/{id}/escalate` | Escalate alert |
| GET | `/api/models` | List ML models |
| GET | `/api/models/{id}/metrics` | Model metrics |
| GET | `/api/mitre/techniques` | MITRE techniques |
| GET | `/api/datasets` | List datasets |
| POST | `/api/replay/start` | Start replay |
| POST | `/api/replay/pause` | Pause replay |
| POST | `/api/replay/stop` | Stop replay |
| GET | `/api/system/health` | System health |
| WS | `/ws/events` | Real-time event stream |

Full interactive docs: `http://localhost:8000/api/docs`

---

## CIC-IDS2017 Dataset

This project is designed to work with the [CIC-IDS2017 dataset](https://www.unb.ca/cic/datasets/ids-2017.html).

### Download

1. Visit the CIC-IDS2017 page
2. Download the CSV files
3. Place them in `data/raw/`

### Expected Files

| File | Content |
|------|---------|
| Monday-WorkingHours.pcap_ISCX.csv | Benign traffic |
| Tuesday-WorkingHours.pcap_ISCX.csv | Brute Force attacks |
| Wednesday-workingHours.pcap_ISCX.csv | DoS attacks |
| Thursday-WorkingHours-Morning-WebAttacks.pcap_ISCX.csv | Web attacks |
| Thursday-WorkingHours-Afternoon-Infilteration.pcap_ISCX.csv | Infiltration |
| Friday-WorkingHours-Morning.pcap_ISCX.csv | Botnet |
| Friday-WorkingHours-Afternoon-PortScan.pcap_ISCX.csv | Port scanning |
| Friday-WorkingHours-Afternoon-DDos.pcap_ISCX.csv | DDoS attacks |

### Dataset Replay

The Dataset Replay Engine reads processed CIC-IDS2017 records and streams them sequentially through the detection pipeline, simulating real-time event arrival. This is **not** presented as live traffic — the UI clearly labels the mode as "Dataset Replay."

---

## ML Pipeline

### Detection Models

| Model | Type | Status |
|-------|------|--------|
| Random Forest | Supervised (baseline) | Phase 2 |
| Logistic Regression | Supervised | Phase 2 |
| XGBoost | Supervised | Phase 2 |
| Isolation Forest | Anomaly detection | Phase 3 |
| Autoencoder | Anomaly detection | Phase 3 |
| LSTM | Sequence-based | Phase 3 |

### Model Interface

All models implement the `DetectionModel` abstract class:

```python
class DetectionModel(ABC):
    def predict(self, features) -> PredictionResult: ...
    def predict_proba(self, features) -> Dict[str, float]: ...
    def explain(self, features) -> ExplanationResult: ...
```

### Risk Scoring

The risk scorer combines:
- Model confidence (35%)
- Anomaly score (25%)
- Attack severity (30%)
- Historical behavior (10%)

Output: 0–100 score → LOW / MEDIUM / HIGH / CRITICAL

This is a configurable formula, not a standardized cybersecurity standard.

---

## Modes

| Mode | Description |
|------|-------------|
| **Dataset Replay** | Stream historical CIC-IDS2017 data through the pipeline |
| **Live** | Connect to real-time network telemetry (Zeek, etc.) |
| **Demo** | UI development with synthetic data (clearly labeled) |

---

## Docker Deployment

```bash
docker-compose up --build
```

Services:
- Frontend: `http://localhost:5173`
- Backend: `http://localhost:8000`
- PostgreSQL: `localhost:5432`

---

## Testing

```bash
# Frontend
cd frontend
npm run build    # Type check + build

# Backend
cd backend
pytest tests/
```

---

## Research Integrity

- No fabricated metrics, accuracy scores, or SHAP values
- Demo data is clearly labeled with a `DEMO DATA` badge
- Model metrics include dataset, split, model version, and timestamp
- Mock and real data are never mixed
- Training, validation, and test results are always separated

---

## License

This project is part of academic research on explainable AI-based threat detection.

---

## Roadmap

- [x] Phase 1: Frontend shell + backend skeleton + database schema
- [ ] Phase 2: CIC-IDS2017 ingestion + Random Forest + Dataset Replay
- [ ] Phase 3: Anomaly detection + SHAP + MITRE mapping + Dockerization
