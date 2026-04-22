# Intelli-Factory: Multi-Objective Optimization Platform for Supply Chain Matching

**Project Status:** Phase 1 Complete – Deployment Live (Target Completion: 22 May 2026)  
**Student:** Igor Vuta (P2773339)  
**Supervisor:** Shengxiang Yang  
**University:** De Montfort University  
**Course:** BSc (Hons) Computer Science

### Live Deployments

- **Frontend:** https://intelli-factory-frontend.vercel.app/ (Vercel)
- **Backend:** https://intelli-factory-api.onrender.com (Render, free tier – 50s spin-up)
- **Database:** PostgreSQL 15 (Aiven)

---

## Project Overview

Intelli-Factory is a B2B2C platform that automates supply chain coordination between manufacturers, customers, and logistics providers. By utilizing evolutionary computation algorithms, the system solves the "Supply Chain Trilemma" by finding optimal solutions that allocate preference to one aspect from: cost, delivery speed, and reliability in real-time.

### The Problem

Supply chain coordinators in Almaty, Kazakhstan rely on manual phone calls and messaging to provide customer orders withfinal solutions to their specific request, that usually are not accessible on regular market. This process:

- Takes significant amount of time to order, ususally hours
- Produces suboptimal decisions
- Doesn't scale with more providers
- Lacks consistency and transparency

### The Solution

Intelli-Factory automates this process with:

- **Multi-objective optimization** - balances cost, speed, and reliability
- **Genetic algorithms** - finds Pareto-optimal solutions using DEAP
- **Real-time API** - delivers results in < 1 second
- **Clean web UI** - simple form for coordinators to request optimization

---

## Technical Stack

### Backend

- **Framework:** FastAPI (Python)
- **Optimization:** DEAP (genetic algorithms)
- **Database:** PostgreSQL 15 + Prisma ORM
- **Server:** Uvicorn
- **Language:** Python 3.12

### Frontend

- **Framework:** Next.js 14
- **Language:** TypeScript / React
- **Styling:** Tailwind
- **Build Tool:** npm

### Infrastructure

- **Containerization:** Docker & Docker Compose (local dev)
- **Frontend Deployment:** Vercel (auto-deploy from GitHub main)
- **Backend Deployment:** Render (auto-deploy from GitHub main, free tier)
- **Database:** Aiven Managed PostgreSQL 15
- **Version Control:** Git + GitHub
- **Email Service:** Brevo SMTP for verification emails

### Development Tools

- **Linting:** ESLint (frontend), Ruff (backend)
- **Formatting:** Prettier (frontend), Ruff (backend)
- **Git Hooks:** Husky (pre-commit linting, commit-msg validation)
- **Commit Linting:** Commitlint (conventional commits)
- **Testing:** pytest (backend), Vitest (frontend)

---

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Docker & Docker Compose
- Git

### Installation

1. **Clone repository**

   ```bash
   git clone [repository-url]
   cd intelli-factory
   ```

2. **Install Node.js dependencies**

   ```bash
   npm install
   ```

3. **Set up backend**

   ```bash
   cd backend/app/api
   poetry install
   ```

4. **Set up database**

   ```bash
   # Start PostgreSQL container
   docker-compose up -d

   # Run migrations and seed data
   poetry run prisma migrate dev
   poetry run python seed.py
   ```

5. **Start backend only** (from `backend/app/api/`)

   ```bash
   poetry run uvicorn main:app --reload --port 8000
   ```

   Backend runs on `http://localhost:8000`

6. **Start frontend only** (from project root)

   ```bash
   npm run dev:frontend
   ```

   Frontend runs on `http://localhost:3000`

### Run Frontend and Backend

From project root:

```bash
# Starts both services via concurrently
npm run dev
```

### Run Frontend and Backend Separately

From project root:

```bash
# Terminal 1 - backend
npm run dev:backend

# Terminal 2 - frontend
npm run dev:frontend
```

```bash
# frontend/.env.local
BACKEND_API_URL=http://localhost:8000
```

### Usage

1. **Open browser** to `http://localhost:3000`
2. **Fill in order form:**
   - SKU: `textile-001` (or any SKU from database)
   - Destination: `almaty`
   - Quantity: `100`
   - Priority: `balanced`
3. **Click "Get Recommendations"**
4. **View results** - sorted by overall fitness score

### API Examples

**Request:**

```bash
curl -X POST http://localhost:8000/api/automations/optimize \
  -H "Content-Type: application/json" \
  -d '{
    "sku": "textile-001",
    "destination": "almaty",
    "quantity": 100,
    "priority": "balanced"
  }'
```

**Response:**

```json
{
  "status": "success",
  "solutions": [
    {
      "rank": 1,
      "manufacturer": "textile-factory-a",
      "logistics_provider": "regional-courier",
      "total_cost": 3200,
      "delivery_days": 5,
      "reliability_score": 0.92,
      "fitness_score": 0.87
    }
  ]
}
```

---

## Key Features

### ✅ Phase 1 Complete (Authentication & Session Management)

- FastAPI backend with Prisma ORM
- Next.js 14 frontend with TypeScript
- PostgreSQL database with Prisma schema
- **User Registration** - signup with email verification
- **Email Verification** - Brevo SMTP integration
- **Session Authentication** - HttpOnly cookies, 24h TTL
- **Account Lockout** - 5 failed attempts → 15-minute lockout
- **Role-based Access Control** - customer, factory_operator, logistics_partner, admin roles
- **Landing Page** - public marketing page with theme selector
- **Docker containerization** for local development
- Development tooling (linting with Ruff, formatting, conventional commits)

### 🟡 Phase 2–3 In Progress (Access Control & UI)

- Enhanced role dashboards (customer, factory operator, logistics partner, admin)
- Form submission and validation
- Backend API expansion for order/request lifecycle
- Frontend page scaffolding for all user roles
- Countries list fix for registration page (this week)

### ⏳ Phase 4–7 Planned (Algorithm, Testing, Deployment)

- Matching algorithm implementation (DEAP genetic algorithms)
- Synthetic data generation (100+ products, 10+ suppliers, 8+ logistics providers)
- Comprehensive testing (unit, integration, UAT)
- Production hardening and security audit
- Final report writing and viva preparation

---

## Documentation

### Quick Reference

- **Problem Overview:** [documentation/01_Problem_Specification.md](documentation/01_Problem_Specification.md)
- **Project Requirements:** [documentation/03_Requirements_Specification.md](documentation/03_Requirements_Specification.md)
- **API Documentation:** Run `uvicorn main:app --reload` → visit http://localhost:8000/docs

### Full Documentation

- See [documentation/README.md](documentation/README.md) for complete index
- GitHub CI/CD setup guide: [docs/guides/GITHUB_SETUP.md](docs/guides/GITHUB_SETUP.md)

---

## Development Workflow

### Commit Conventions

This project uses [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:** `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

### Code Quality

**Before Commit:** Pre-commit hooks run:

- ESLint (frontend) - must pass
- Ruff format/lint (backend) - must pass
- Commit message validation - must follow conventions

### Testing

```bash
# Backend tests
cd backend/app/api
pytest tests/

# Frontend tests
cd frontend
npm run test
```

---

## Deployment

### Local Development

```bash
docker-compose up       # Starts PostgreSQL
# In separate terminals:
cd backend/app/api && poetry install && poetry run uvicorn main:app --reload
cd frontend && npm install && npm run dev
```

### Production (Live)

**Frontend:** Deployed to Vercel at https://intelli-factory-frontend.vercel.app/

- Auto-deploys on push to `main` branch
- Environment: Next.js 14 on Vercel serverless

**Backend:** Deployed to Render at https://intelli-factory-api.onrender.com

- Auto-deploys on push to `main` branch
- Environment: FastAPI on Render free tier (~50s spin-up on first request)
- Binary caching: Prisma query engine auto-fetched on startup

**Database:** Hosted on Aiven

- PostgreSQL 15 managed service
- Connection via `DATABASE_URL` environment variable
- Automatic backups and high availability

---

## Project Timeline

**Start Date:** 11 February 2026  
**Report Deadline:** 22 May 2026  
**Current Week:** 5 of 14

| Phase | Focus                                            | Week(s) | Status         |
| ----- | ------------------------------------------------ | ------- | -------------- |
| 1     | Authentication, session, email verification      | W1–W5   | ✅ Complete    |
| 2     | Backend API expansion, access control            | W5–W10  | 🟡 In Progress |
| 3     | Frontend UI for all roles, form integration      | W6–W11  | 🟡 In Progress |
| 4     | Matching algorithm (DEAP), fitness functions     | W9–W12  | ⏳ Planned     |
| 5     | Synthetic data generation, comprehensive testing | W8–W14  | ⏳ Planned     |
| 6     | User acceptance testing, security hardening      | W10–W13 | ⏳ Planned     |
| 7     | Production deployment, release                   | W11–W13 | ⏳ Planned     |

**Key Milestones:**

- 13 Mar 2026 (W5): Contract & ethics submission ✅ (tomorrow)
- 24 Mar 2026 (W6): Literature review finalized
- 31 Mar 2026 (W7): System design approved
- 7 Apr 2026 (W10): Phases 1–3 complete
- 22 May 2026 (W14): Report & code submission (deadline)
- 15 Jun 2026 (W18): Viva examination

---

## Contact & Feedback

**Student:** Igor Vuta (P2773339)  
**Supervisor:** Shengxiang Yang  
**Questions?** Raise an issue on GitHub or contact supervisor.

---

## License

---

## Acknowledgments

- DEAP developers for excellent genetic algorithm library
- FastAPI for modern Python web framework
- Industry contact in Almaty for validating problem statement
- Supervisor Shengxiang Yang for guidance

---

**Last Updated:** 12 March 2026  
**Project Status:** Phase 1 Complete – Deployment Live  
**Next Milestone:** Forms Submission (13 Mar), Phases 2–3 (W6–W11)
