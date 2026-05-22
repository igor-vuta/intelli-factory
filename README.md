<a id="readme-top"></a>

<!-- SHIELDS -->
[![Python][python-shield]][python-url]
[![FastAPI][fastapi-shield]][fastapi-url]
[![Next.js][nextjs-shield]][nextjs-url]
[![PostgreSQL][postgres-shield]][postgres-url]
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
    <li><a href="#api">API Reference</a></li>
    <li><a href="#deployment">Deployment</a></li>
    <li><a href="#testing">Testing</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

---

## About

Intelli-Factory is a B2B2C platform that automates supply chain matching between manufacturers, customers, and logistics providers. 
It solves the **Supply Chain Trilemma** - balancing cost, delivery speed, and reliability - using evolutionary computation (NSGA-II genetic algorithm via DEAP).

Three optimisation strategies are available per admin request:

| Mode | Description |
|------|-------------|
| **Greedy** | Sort by lowest raw cost |
| **Fast** | Min-max normalised weighted-sum scoring |
| **Deep (GA)** | NSGA-II Pareto-front search via DEAP |

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
   git clone [https://github.com/aihiweahosd/intelli-factory]
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

## Testing

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

> **Note:** Render free tier cold-starts in ~50 s on the first request.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

---

## Contact

**Igor Vuta** (P2773339) - BSc Computer Science, De Montfort University  
**Supervisor:** Shengxiang Yang

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
[license-shield]: https://img.shields.io/badge/License-Academic-lightgrey?style=for-the-badge
