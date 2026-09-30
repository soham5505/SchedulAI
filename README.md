# SchedulAI — Enterprise AI Timetable Generator & Optimization Platform

SchedulAI is a modern full-stack academic timetable scheduling system powered by **Google OR-Tools CP-SAT (Constraint Programming)**, **Node.js Express**, **FastAPI**, and **React 18 + Tailwind CSS**.

---

## 🌟 Key Features

- **Mathematical Constraint Optimization**: Powered by Google OR-Tools CP-SAT solver running as a high-performance Python microservice. Resolves complex university scheduling challenges with strict hard constraints (faculty clashes, room double-booking, cohort conflicts, room capacities, lab gear) and multi-factor weighted soft constraints.
- **Interactive Drag-and-Drop Editor**: Real-time interactive schedule adjustments with instant backend constraint evaluation and weighted slot suggestion fallback.
- **AI Copilot & Natural Language Assistant**:
  - Convert unstructured faculty requests into structured scheduling constraints.
  - Diagnostic conflict explainer with root-cause identification and remediation suggestions.
  - Automated timetable executive summary generation.
- **Complete Academic CRUD Suite**: Management of Departments, Faculty, Subjects, Classrooms & Labs, Semesters, Time Slots (with 1-click 5-day template generator), and Teaching Assignments.
- **Enterprise Bulk Data Ingestion**: Drag-and-drop Excel (`.xlsx`, `.xls`) and `.csv` parser with fuzzy column auto-matching, schema validation preview, and background batch processing.
- **Multi-Format Export & Print Engine**: Download schedules as multi-sheet formatted Excel workbooks, raw CSVs, or high-resolution printable PDF/HTML views for students and faculty.
- **Immutable Audit Trail & Compliance**: Comprehensive audit log recording actor identity, timestamps, IP addresses, entity types, and diff state.
- **Role-Based Access Control (RBAC)**: Fine-grained permissions across `ADMIN`, `TEACHER`, `STAFF`, and `VIEWER`.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, TypeScript, Vite, Tailwind CSS, TanStack Query, React Router v6, Lucide React, Axios |
| **Backend API** | Node.js, Express.js, TypeScript, Mongoose, Zod, JWT, Bcrypt, Winston Logger |
| **Optimization Engine** | Python 3.11, FastAPI, Google OR-Tools (CP-SAT), Pydantic v2, Uvicorn |
| **Database & Cache** | MongoDB 7.0 (with compound unique indexes), Redis 7.2 |
| **Testing** | Vitest (API & Web), React Testing Library, Pytest (Scheduler) |
| **DevOps & CI/CD** | Docker multi-stage builds, Docker Compose, Nginx, GitHub Actions |

---

## 🚀 Quick Start (Development)

### 1. Prerequisites
- Node.js 20+ & npm 10+
- Python 3.11+ with pip
- MongoDB 7.0+ (running locally or via Docker)

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/soham5505/SchedulAI.git
cd SchedulAI

# Install monorepo dependencies
npm install

# Install Python scheduler dependencies
cd services/scheduler
pip install -r requirements.txt
cd ../..
```

### 3. Build Packages & Start Services
```bash
# Build shared TypeScript packages
npm run build:packages

# Start Python FastAPI Scheduler (Port 8000)
npm run dev:scheduler

# Start Backend API (Port 5000)
npm run dev:api

# Start Web Client (Port 5173)
npm run dev:web
```

---

## 🧪 Running the Test Suites

SchedulAI features comprehensive automated test suites across all layers:

```bash
# Run all tests (API + Web + Scheduler)
npm test

# Run individual suites:
npm run test:api        # 15 Vitest backend tests
npm run test:web        # 8 Vitest frontend tests
npm run test:scheduler  # 5 Pytest CP-SAT solver tests
```

---

## 📦 Docker Deployment

To spin up the entire production-grade stack including MongoDB, Redis, Python Scheduler, Node.js API, and Nginx Web:

```bash
docker-compose up -d --build
```

Access services:
- **Web UI**: `http://localhost`
- **API Gateway**: `http://localhost:5000/api/v1`
- **Scheduler Docs**: `http://localhost:8000/docs`

---

## 📚 Documentation

- 📖 **[Master Project Documentation (Single Source of Truth)](MASTER_PROJECT_DOCUMENTATION.md)** — Exhaustive specification covering full system architecture, OR-Tools CP-SAT mathematical model, complete data schemas, REST API catalog, workflows, and templates for generating project reports, SRS, SDD, and user manuals.
- [System Architecture & Solver Formulation](docs/ARCHITECTURE.md)
- [REST API Reference](docs/API.md)
- [Production Deployment Guide](docs/DEPLOYMENT.md)
- [Phase Status Reports](docs/progress/)

---

## 📄 License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
