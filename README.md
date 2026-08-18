# CASE//ZERO

> A full-stack cybersecurity operations platform for detection, investigation, threat hunting, and incident response.

![Status](https://img.shields.io/badge/status-active%20development-brightgreen)
![Backend](https://img.shields.io/badge/backend-FastAPI-009688)
![Frontend](https://img.shields.io/badge/frontend-Next.js-black)
![Database](https://img.shields.io/badge/database-PostgreSQL-4169E1)
![Languages](https://img.shields.io/badge/languages-Python%20%7C%20TypeScript-blue)
![Containers](https://img.shields.io/badge/containers-Docker-2496ED)
[![CASE//ZERO CI](https://github.com/danielguillaumont/case-zero/actions/workflows/ci.yml/badge.svg)](https://github.com/danielguillaumont/case-zero/actions/workflows/ci.yml)

---

## Overview

**CASE//ZERO** is a cybersecurity engineering portfolio project that simulates the core workflow of a modern Security Operations Center.

It connects security telemetry, detection engineering, alerts, investigations, threat hunting, threat intelligence, MITRE ATT&CK, response playbooks, authentication, and role-based access control in one application.

```text
Security Events
      ↓
Detection Engine
      ↓
Detection Rules
      ↓
Alerts
   ↙       ↘
Evidence   Investigation
          ↙     ↓      ↘
       Hunt   Case   Playbook
          ↓
   Threat Intelligence
```

---

## Core Capabilities

### Detection & Telemetry

- Normalized security-event ingestion
- Process and authentication telemetry
- Single-event detections
- Multi-event correlation
- Automatic alert generation
- Source-event and detection-rule linkage
- MITRE ATT&CK mappings

Current detections include:

- Encoded PowerShell
- PowerShell Download Cradle
- Authentication Brute Force

### Investigation

- Alert lifecycle and analyst assignment
- Source-event evidence
- Detection-rule context
- MITRE ATT&CK context
- Threat-intelligence matches
- Recommended response playbooks
- Investigation cases
- Analyst notes
- Case activity timelines

### Threat Hunting

- Structured telemetry searches
- Free-text queries
- Host, user, IP, process, source, and event filters
- Direct navigation into event evidence

### Threat Intelligence

- Persistent IOC registry
- IP, domain, URL, and hash indicators
- Reputation and confidence scoring
- Search, filtering, and tags
- IOC-to-event correlation
- Alert-to-IOC matching

### Detection Rules & Playbooks

- Detection-rule catalog
- Detection logic visibility
- ATT&CK mappings
- Rule-to-playbook relationships
- Ordered incident-response procedures
- Bidirectional Rule ↔ Playbook navigation

---

## Authentication & RBAC

CASE//ZERO includes end-to-end authentication and role-based access control.

- PostgreSQL-backed user accounts
- Argon2 password hashing
- JWT authentication
- HttpOnly session cookies
- Login and logout workflow
- Current-user validation
- Active/inactive account enforcement
- Administrator, Analyst, and Viewer roles
- Route-level authorization across SOC APIs
- Protected frontend application routes
- Administrator provisioning utility

```text
Email + Password
       ↓
Argon2 Verification
       ↓
JWT Access Token
       ↓
HttpOnly Session
       ↓
Authenticated User
       ↓
Role Authorization
```

| Role | Access |
|---|---|
| **Administrator** | Full platform access |
| **Analyst** | Security operations, hunting, investigations, ingestion, and updates |
| **Viewer** | Read-only SOC visibility |

Unauthenticated users cannot access protected SOC data.

---

## Security Workspaces

CASE//ZERO currently includes:

```text
Dashboard
Events
Alerts
Cases
Threat Hunt
Threat Intelligence
Detection Rules
Response Playbooks
```

Each workspace is connected to the same investigation workflow rather than operating as an isolated demo.

---

## Testing & CI

CASE//ZERO currently has **75 passing backend tests** covering:

- Detection-engine logic
- Multi-event correlation
- Authentication
- Password security
- JWT creation and validation
- Role-based access control
- API authorization
- Event ingestion
- Event-to-alert pipelines
- Alert workflows
- Case workflows
- Case notes and activity
- Threat hunting
- Threat intelligence
- Viewer, Analyst, and Administrator permissions

Example tested pipeline:

```text
Security Event
      ↓
PostgreSQL
      ↓
Detection Engine
      ↓
Persisted Alert
      ↓
Authenticated API Retrieval
```

GitHub Actions validates the application on pushes and pull requests to `main`:

```text
Backend
├── PostgreSQL 18
├── Alembic migrations
└── Pytest

Frontend
├── npm install
└── Next.js production build
```

---

## Technology Stack

| Area | Technology |
|---|---|
| Frontend | Next.js, React, TypeScript |
| Styling | Tailwind CSS |
| Backend | FastAPI, Python |
| Validation | Pydantic |
| ORM | SQLAlchemy |
| Database | PostgreSQL |
| Migrations | Alembic |
| Authentication | JWT, OAuth2 |
| Password Security | Argon2, pwdlib |
| Authorization | RBAC |
| Testing | Pytest, FastAPI TestClient |
| CI/CD | GitHub Actions |
| Containers | Docker Compose |
| API Docs | Swagger / OpenAPI |

---

## Architecture

```mermaid
flowchart LR
    USER["User"]
    UI["Next.js"]
    AUTH["Authentication / RBAC"]
    API["FastAPI"]
    DET["Detection Engine"]
    DB[("PostgreSQL")]

    USER --> UI
    UI --> AUTH
    AUTH --> API
    API --> DET
    API --> DB
    DET --> DB
```

Core APIs:

```text
/api/auth
/api/events
/api/alerts
/api/cases
/api/hunt
/api/rules
/api/playbooks
/api/intelligence
```

---

## Run Locally

### Requirements

- Python 3.12+
- Node.js
- Docker Desktop
- Git

### Setup

```powershell
git clone https://github.com/danielguillaumont/case-zero.git
cd case-zero

Copy-Item .env.example .env
docker compose up -d postgres
```

Configure PostgreSQL and JWT values in `.env`.

### Backend

```powershell
cd backend

python -m venv .venv
.\.venv\Scripts\Activate.ps1

pip install -r requirements.txt
alembic upgrade head

fastapi dev app\main.py
```

API:

```text
http://127.0.0.1:8000
```

Swagger:

```text
http://127.0.0.1:8000/docs
```

### Create First Administrator

```powershell
python -m scripts.create_admin
```

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend:

```text
http://localhost:3000
```

---

## Development Status

### Implemented

- [x] Full-stack SOC application
- [x] PostgreSQL + Alembic
- [x] Security-event ingestion
- [x] Detection engine
- [x] Multi-event correlation
- [x] Automated alert generation
- [x] Alert investigation
- [x] Case management
- [x] Analyst notes and activity timelines
- [x] Threat hunting
- [x] MITRE ATT&CK mappings
- [x] Incident-response playbooks
- [x] Threat Intelligence registry
- [x] IOC correlation
- [x] JWT authentication
- [x] HttpOnly frontend sessions
- [x] Login and logout workflow
- [x] Argon2 password hashing
- [x] Administrator / Analyst / Viewer roles
- [x] Route-level RBAC enforcement
- [x] Protected frontend application access
- [x] Database-backed integration tests
- [x] GitHub Actions CI

### Next

- [ ] Production security hardening
- [ ] Production deployment
- [ ] Portfolio screenshots
- [ ] Architecture and investigation demo
- [ ] Additional detections and telemetry

---

## Project Goal

CASE//ZERO demonstrates practical experience across:

**Detection Engineering · Security Operations · Incident Response · Threat Hunting · Threat Intelligence · MITRE ATT&CK · Authentication · RBAC · API Development · Database Engineering · Full-Stack Development · Automated Testing · CI/CD**

---

## Disclaimer

CASE//ZERO is an independent educational and portfolio project designed to simulate cybersecurity operations workflows.

It is not intended to replace a production SIEM, SOAR, EDR, identity provider, or enterprise incident-response platform.