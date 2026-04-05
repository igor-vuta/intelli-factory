# Intelli-Factory

<p align="center">
   <img src="frontend/public/presets/logo.svg" alt="Intelli-Factory Logo" width="110" />
</p>

<p align="center">
   Multi-role supply-chain coordination platform for customer demand, factory supply, and logistics execution.
</p>

<p align="center">
   <a href="https://intelli-factory-frontend.vercel.app/"><img alt="Frontend" src="https://img.shields.io/badge/Frontend-Vercel-black?logo=vercel" /></a>
   <a href="https://intelli-factory-api.onrender.com"><img alt="Backend" src="https://img.shields.io/badge/Backend-Render-46E3B7?logo=render&logoColor=black" /></a>
   <img alt="Database" src="https://img.shields.io/badge/Database-PostgreSQL%2015-4169E1?logo=postgresql&logoColor=white" />
</p>

## Executive Summary

Intelli-Factory is a B2B workflow platform that coordinates three roles in one transaction pipeline:

1. Customer creates demand.
2. Factory responds with supply offers.
3. Logistics supplies delivery coverage and quote.

The long-term objective is an event-driven flow from request to payment-gated fulfillment, with optimization and transparent state progression.

## Platform Scope

Intelli-Factory defines an end-to-end supply-chain operating flow:

- Request -> matching -> contract -> signatures -> payment -> fulfillment start.
- Strong, secure, role-aware auth and session management.
- Persistent lifecycle state and recoverable progress.
- Schema-driven frontend and backend behavior.

## Platform Modules

- Identity and access: registration, login, verification, and role-scoped workspace access.
- Role workspaces: `customer`, `factory`, `logist`, and `admin` interfaces.
- Operational flow: request creation, inventory publishing, logistics offers, and pairing lifecycle.
- Transaction framework: contract, signature, payment, and fulfillment-oriented process model.
- Data governance: schema-led rules for role cardinality, free-text catalog fallback, geo structure, and lifecycle policies.

## Architecture At A Glance

```text
Next.js Frontend (Role Workspaces)
               |
               v
FastAPI API (Auth, Requests, Pairing, Comparison)
               |
               v
PostgreSQL (Prisma schema, migrations, seeded reference data)
```

## Tech Stack

### Application Layer

- ![FastAPI](https://img.shields.io/badge/FastAPI-Backend-009688?logo=fastapi&logoColor=white) Python API services and route orchestration.
- ![Next.js](https://img.shields.io/badge/Next.js-Frontend-000000?logo=next.js&logoColor=white) Role-based web application.
- ![TypeScript](https://img.shields.io/badge/TypeScript-Client-3178C6?logo=typescript&logoColor=white) Typed frontend code.
- ![Python](https://img.shields.io/badge/Python-Server-3776AB?logo=python&logoColor=white) Backend implementation language.

### Data + Infrastructure

- ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15-4169E1?logo=postgresql&logoColor=white) Transactional data and lifecycle persistence.
- ![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white) Schema/migrations/client integration.
- ![Docker](https://img.shields.io/badge/Docker-Local%20Dev-2496ED?logo=docker&logoColor=white) Reproducible local services.
- ![Render](https://img.shields.io/badge/Render-API%20Hosting-46E3B7?logo=render&logoColor=black) Backend deployment.
- ![Vercel](https://img.shields.io/badge/Vercel-Frontend%20Hosting-000000?logo=vercel&logoColor=white) Frontend deployment.

### Quality + Workflow

- ![Ruff](https://img.shields.io/badge/Ruff-Lint%2FFormat-5C6BC0) Backend lint/format.
- ![ESLint](https://img.shields.io/badge/ESLint-Frontend%20Lint-4B32C3?logo=eslint&logoColor=white) Frontend linting.
- ![Husky](https://img.shields.io/badge/Husky-Git%20Hooks-3E3E3E) Commit pipeline checks.
- ![Commitlint](https://img.shields.io/badge/Commitlint-Conventional%20Commits-2B2B2B) Commit-message governance.
- ![GitHub Actions](https://img.shields.io/badge/GitHub%20Actions-CI%2FCD-2088FF?logo=githubactions&logoColor=white) Automation workflows.

## Screenshot Gallery

![Landing Page](docs/screenshots/01-landing-page.png)
![Register And Verification](docs/screenshots/02-register-verify.png)
![Customer Workspace](docs/screenshots/03-customer-workspace.png)
![Factory Workspace](docs/screenshots/04-factory-workspace.png)
![Logistics Workspace](docs/screenshots/05-logistics-workspace.png)

## Capability Map

<table>
   <thead>
      <tr>
         <th align="left">Domain</th>
         <th align="left">Scope</th>
         <th align="left">Core Outcome</th>
      </tr>
   </thead>
   <tbody>
      <tr>
         <td><img alt="Auth" src="https://img.shields.io/badge/Auth-Identity%20%26%20Access-0A66C2" /></td>
         <td>Secure onboarding, verification, and role-aware access control</td>
         <td>Trusted entry points and protected workspace access</td>
      </tr>
      <tr>
         <td><img alt="Roles" src="https://img.shields.io/badge/Roles-Workspace%20Model-6F42C1" /></td>
         <td>Customer, factory, logistics, and admin role interfaces</td>
         <td>Clear responsibility boundaries per participant</td>
      </tr>
      <tr>
         <td><img alt="Operations" src="https://img.shields.io/badge/Operations-Requests%20%7C%20Inventory%20%7C%20Logistics-1F883D" /></td>
         <td>Schema-driven forms, operational data capture, and lifecycle actions</td>
         <td>Structured input pipeline across all operational actors</td>
      </tr>
      <tr>
         <td><img alt="Matching" src="https://img.shields.io/badge/Matching-Decision%20Engine-B45309" /></td>
         <td>Event-driven feasibility, scoring, and lifecycle persistence</td>
         <td>Coordinated demand-supply-delivery candidate generation</td>
      </tr>
      <tr>
         <td><img alt="Real-time" src="https://img.shields.io/badge/Realtime-Event%20Delivery-0969DA" /></td>
         <td>Role and transaction scoped status distribution patterns</td>
         <td>Timely visibility of request and transaction state movement</td>
      </tr>
      <tr>
         <td><img alt="Contracts" src="https://img.shields.io/badge/Contracts-Multi--Party%20Workflow-9A6700" /></td>
         <td>Contract packet orchestration and signature workflow</td>
         <td>Legally trackable multi-party agreement flow</td>
      </tr>
      <tr>
         <td><img alt="Payments" src="https://img.shields.io/badge/Payments-Transaction%20Control-BC4C00" /></td>
         <td>Payment-controlled transaction progression model</td>
         <td>Commercial gating before fulfillment operations</td>
      </tr>
   </tbody>
</table>


## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Poetry
- Docker + Docker Compose

### Install + Run

```bash
git clone <repository-url>
cd intelli-factory

# frontend deps
npm install

# backend deps
cd backend/app/api
poetry install

# back to repo root
cd ../../..

# run both services
npm run dev
```

Frontend: `http://localhost:3000`  
Backend docs: `http://localhost:8000/docs`

### Optional: Separate Terminals

```bash
# terminal 1
npm run dev:backend

# terminal 2
npm run dev:frontend
```

## Configuration Notes

- Frontend uses `NEXT_PUBLIC_BACKEND_API_URL` for API base URL.
- Backend depends on `DATABASE_URL` and email SMTP variables for verification flow.
- Deployment targets are configured for Vercel (frontend) and Render (backend).

## Deployment

- Frontend: https://intelli-factory-frontend.vercel.app/
- Backend: https://intelli-factory-api.onrender.com
- Database: PostgreSQL 15 (Aiven)

## Timeline

- Start: 11 Feb 2026
- Target submission: 22 May 2026
- Viva window: June 2026

## Academic Context

- Student: Igor Vuta (P2773339)
- Supervisor: Shengxiang Yang
- University: De Montfort University
- Course: BSc (Hons) Computer Science
