<a id="readme-top"></a>

<!-- SHIELDS -->
[![Python][python-shield]][python-url]
[![FastAPI][fastapi-shield]][fastapi-url]
[![Next.js][nextjs-shield]][nextjs-url]
[![PostgreSQL][postgres-shield]][postgres-url]
[![Tests][tests-shield]](#testing)
[![License][license-shield]](#license)

<br />
<div align="center">
<h2 align="center">Intelli-Factory</h2>
<p align="center">
Multi-Objective Supply Chain Optimisation Platform - BSc Computer Science, De Montfort University
<br />
<a href="https://intelli-factory-frontend.vercel.app/"><strong>Live Demo »</strong></a>
&nbsp;&middot;&nbsp;
<a href="https://intelli-factory-api.onrender.com/docs"><strong>API Docs »</strong></a>
</p>
</div>

---

<!-- TABLE OF CONTENTS -->
<details>
<summary>Table of Contents</summary>
<ol>
<li><a href="#about">About</a></li>
<li><a href="#screenshots">Screenshots</a></li>
<li><a href="#benchmark-results">Benchmark Results</a></li>
<li><a href="#architecture">Architecture</a></li>
<li><a href="#tech-stack">Tech Stack</a></li>
<li>
<a href="#getting-started">Getting Started</a>
<ul>
<li><a href="#prerequisites">Prerequisites</a></li>
<li><a href="#installation">Installation</a></li>
<li><a href="#seeding">Database Seeding</a></li>
</ul>
</li>
<li><a href="#usage">Usage</a></li>
<li><a href="#api-reference">API Reference</a></li>
<li><a href="#security">Security</a></li>
<li><a href="#testing">Testing</a></li>
<li><a href="#deployment">Deployment</a></li>
<li><a href="#contact">Contact</a></li>
<li><a href="#acknowledgments">Acknowledgments</a></li>
</ol>
</details>

---

## About

Intelli-Factory is a B2B2C platform that automates supply chain matching between manufacturers, customers, and logistics providers.
It solves the **Supply Chain Trilemma** - balancing cost, delivery speed, and reliability - using evolutionary computation (NSGA-II genetic algorithm via DEAP).

**Research question:** does weighted multi-objective matching outperform a greedy, cheapest-first baseline under defined criteria? *Answer: yes - measurably (see [Benchmark Results](#benchmark-results)).*

The real-world motivation is the manual phone-and-WhatsApp coordination still common in the Almaty trading sector. The **measured** comparison, though, is algorithm against algorithm: the Greedy baseline strategy against the Deep GA, both implemented in this codebase and run over identical scenarios.

The platform covers the full workflow - request → bidding → optimisation → three-party contract signing → payment → fulfilment tracking - across four user roles (Customer, Factory, Logistics Provider, Administrator), with a nine-state request lifecycle enforced by explicit state machines and atomic database transactions.

Three optimisation strategies are available per admin request:

| Mode | Description | Speed |
|------|-------------|-------|
| **Greedy** | Sort by lowest raw cost (baseline) | instant |
| **Fast** | Min-max normalised weighted-sum scoring | < 0.001 s |
| **Deep (GA)** | NSGA-II Pareto-front search via DEAP - population 100, 80 generations, tournament selection (k=3), Hall-of-Fame elitism, knee-point selection by customer weight profile | 0.069 s avg |

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Screenshots

Every screenshot below is the deployed system at https://intelli-factory-frontend.vercel.app/, not a mockup.

<div align="center">
<img src="docs/screenshots/01-landing-page.png" alt="Landing page - the supply-chain orchestration hero over a live flow monitor showing request, match, contract and payment stages, with an EN/RU/KK language switcher and a six-theme selector in the header" width="88%" />
<br /><em>Landing page - trilingual (EN / RU / KK) with six selectable themes.</em>
<br /><br />
<img src="docs/screenshots/02-register-verify.png" alt="Registration and email verification screen" width="88%" />
<br /><em>Registration with Brevo email verification. Argon2id hashing and server-side sessions behind it - see <a href="#security">Security</a>.</em>
<br /><br />
<img src="docs/screenshots/03-customer-workspace.png" alt="Customer workspace showing requests and their live status through the nine-state lifecycle" width="88%" />
<br /><em>Customer workspace - raise a request and track it through the nine-state lifecycle.</em>
<br /><br />
<img src="docs/screenshots/04-factory-workspace.png" alt="Factory workspace showing published inventory and incoming candidate matches" width="88%" />
<br /><em>Factory workspace - publish inventory once, get matched automatically.</em>
<br /><br />
<img src="docs/screenshots/05-logistics-workspace.png" alt="Logistics provider workspace showing route coverage, pricing constraints and execution tracking" width="88%" />
<br /><em>Logistics workspace - coverage, pricing constraints, and execution tracking.</em>
</div>

> **Waking the demo:** the backend runs on a free Render tier and the database on a free Aiven tier, so both spin down when idle. Open the site, then allow roughly 90 seconds on first load - the country list populating on the register page is the signal that the API is up.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Benchmark Results

3,600 evaluations - 120 synthetic scenarios × 30 random seeds - run on the production engine code (`benchmark_evaluation.py`):

| Metric | Greedy baseline | Optimised (Fast / Deep GA) | Change |
|--------|----------------|---------------------------|--------|
| Composite fitness | 0.682 | 0.801 | **+17.5%** |
| Delivery time | 8.02 days | 4.67 days | **41.8% faster** |
| Reliability score | 0.824 | 0.891 | **+8.1%** |
| Raw cost (avg KZT) | 21,296 | 51,648 | +142.5% - deliberate trilemma trade-off |

- Deep GA Pareto-front hypervolume: **0.852 ± 0.12** (normalised), converging by generations 50-60
- Feasibility rate: **100%** across all 120 scenarios
- Deep GA response time: **0.069 s ± 0.015 s**
- Datasets: 55+ products, 12 manufacturers, 9 logistics providers

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Architecture

```mermaid
flowchart LR
    U[Browser / PWA] --> FE["Next.js App Router<br/>TypeScript · Tailwind · Recharts<br/>(Vercel)"]
    FE --> API["FastAPI · Python 3.12 · Uvicorn<br/>(Render)"]
    API --> ENGINE["Optimisation engine<br/>DEAP · NSGA-II"]
    API --> DB[("PostgreSQL 15<br/>~25 Prisma models<br/>(Aiven)")]
    API --> MAIL["Brevo SMTP<br/>email verification"]
```

Three-tier production deployment (Vercel + Render + Aiven); Docker Compose for local development. Role-based guards at the API layer across four task-separated routers (`/auth`, `/requests`, `/pairing`, `/automations`); Pydantic validation on all payloads; auto-generated OpenAPI docs.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Tech Stack

### Built With

* [![FastAPI][fastapi-shield]][fastapi-url] Python 3.12 · DEAP · Prisma ORM · Uvicorn
* [![Next.js][nextjs-shield]][nextjs-url] TypeScript · React · Tailwind CSS
* [![PostgreSQL][postgres-shield]][postgres-url] Aiven managed · Docker (local)
* **Email:** Brevo SMTP · **Auth:** HttpOnly sessions · **Testing:** pytest / Vitest

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Getting Started

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- [Poetry](https://python-poetry.org/)

### Installation

1. **Clone the repo**

```sh
git clone https://github.com/igor-vuta/intelli-factory.git
cd intelli-factory
```

2. **Install root Node.js dependencies** (frontend + scripts)

```sh
npm install
```

3. **Install backend dependencies**

```sh
cd backend/app/api
poetry install
```

4. **Configure environment variables**

Create `backend/app/api/.env`:
```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DB
SECRET_KEY=your-secret-key
BREVO_API_KEY=your-brevo-key
```

Create `frontend/.env.local`:
```env
BACKEND_API_URL=http://localhost:8000
```

5. **Start PostgreSQL** (Docker)

```sh
# from project root
docker-compose up -d
```

6. **Run database migrations**

```sh
cd backend/app/api
poetry run prisma migrate dev
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

### Seeding

The seed scripts populate reference data (countries, regions, cities) and workflow demo scenarios.

```sh
cd backend/app/api

# 1 - Reference geography (countries / regions / cities)
poetry run python seed_reference_geo.py

# 2 - All workflow scenarios + large-scale optimisation demo
poetry run python seed.py
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Usage

### Run both services

```sh
# from project root - starts backend + frontend via concurrently
npm run dev
```

### Run separately

```sh
# Terminal 1 - backend (http://localhost:8000)
npm run dev:backend

# Terminal 2 - frontend (http://localhost:3000)
npm run dev:frontend
```

### Interactive API docs

```
http://localhost:8000/docs
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## API Reference

**POST** `/api/automations/optimize`

```sh
curl -X POST http://localhost:8000/api/automations/optimize \
-H "Content-Type: application/json" \
-d '{
"request_id": "<uuid>",
"mode": "deep"
}'
```

`mode` options: `fast` (default) · `deep` (NSGA-II GA)

**Response:**

```json
{
"status": "success",
"request_id": "...",
"mode": "deep",
"solution_count": 5,
"solutions": [
{
"rank": 1,
"candidate_id": "...",
"total_cost": 124500.0,
"delivery_days": 4.0,
"reliability": 0.934,
"fitness_score": 0.8712,
"score_breakdown": {
"cost_norm": 0.31,
"time_norm": 0.18,
"reliability_norm": 0.91,
"final_score": 0.8712,
"weights": { "cost": 0.34, "time": 0.33, "reliability": 0.33 }
}
}
]
}
```

**GET** `/api/automations/compare/{request_id}` - runs greedy, fast, and deep GA in parallel and returns a side-by-side scoreboard.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Security

Validated against the OWASP Password Storage and Session Management Cheat Sheets; no vulnerabilities found in manual code review or automated penetration testing.

- **Argon2id** password hashing (argon2-cffi) with transparent legacy PBKDF2-SHA256 upgrade-on-login
- CSPRNG session tokens (`secrets.token_urlsafe`, 48 bytes) stored server-side as SHA-256 hashes only, 24 h TTL
- HttpOnly / Secure / SameSite cookies; session ID regeneration on privilege change
- Login rate limiting (lockout after 5 failures / 15 min) with IP + user-agent logging

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Testing

**51 automated pytest unit & integration tests** - optimisation engine (normalisation, weight profiles, feasibility, seeded reproducibility, large-scale pools), comparison router, requests router, and the full transaction → contract → fulfilment flow. TDD applied to the engine.

```sh
cd backend/app/api

# full test suite
poetry run pytest tests/ -v

# optimisation engine only
poetry run pytest tests/test_optimization_engine.py -v

# benchmark evaluation (120 synthetic scenarios)
poetry run python benchmark_evaluation.py
```

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Deployment

| Service | Platform | URL |
|---------|----------|-----|
| Frontend | Vercel (auto-deploy `main`) | https://intelli-factory-frontend.vercel.app/ |
| Backend | Render free tier | https://intelli-factory-api.onrender.com |
| Database | Aiven PostgreSQL 15 | via `DATABASE_URL` env var |

> **Note:** free-tier Render & Aiven spin down idle instances. After opening the register page,
> allow ~90 s for the backend to wake — the country list loads from the backend once it's up.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Contact

**Igor Vuta** - BSc (Hons) Computer Science, First-Class Honours, De Montfort University - [igor_vuta@proton.me](mailto:igor_vuta@proton.me)
**Supervisor:** Dr Shengxiang Yang, School of Computer Science and Informatics

GitHub: https://github.com/igor-vuta · LinkedIn: https://www.linkedin.com/in/igor-vuta-b88017390

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Acknowledgments

* [DEAP](https://github.com/DEAP/deap) - genetic algorithm / NSGA-II framework
* [FastAPI](https://fastapi.tiangolo.com/) - modern Python web framework
* [Prisma](https://www.prisma.io/) - type-safe ORM
* [Best-README-Template](https://github.com/othneildrew/Best-README-Template) - README structure

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

<!-- MARKDOWN LINKS & BADGES -->
[python-shield]: https://img.shields.io/badge/Python-3.12-3776AB?style=for-the-badge&logo=python&logoColor=white
[python-url]: https://python.org
[fastapi-shield]: https://img.shields.io/badge/FastAPI-0.110-009688?style=for-the-badge&logo=fastapi&logoColor=white
[fastapi-url]: https://fastapi.tiangolo.com
[nextjs-shield]: https://img.shields.io/badge/Next.js-16-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[nextjs-url]: https://nextjs.org
[postgres-shield]: https://img.shields.io/badge/PostgreSQL-15-4169E1?style=for-the-badge&logo=postgresql&logoColor=white
[postgres-url]: https://postgresql.org
[tests-shield]: https://img.shields.io/badge/pytest-51%20passing-brightgreen?style=for-the-badge
[license-shield]: https://img.shields.io/badge/License-Academic-lightgrey?style=for-the-badge
