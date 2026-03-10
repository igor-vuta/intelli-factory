# Intelli-Factory: Multi-Objective Optimization Platform for Supply Chain Matching

**Project Status:** Development (Target Completion: 22 May 2026)  
**Student:** Igor Vuta (P2773339)  
**Supervisor:** Shengxiang Yang  
**University:** De Montfort University
**Course:** BSc (Hons) Computer Science

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
- **Deployment:** Google Cloud Run (via Pulumi IaC)
- **Version Control:** Git + GitHub

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

### ✅ Implemented (Week 1-2)

- FastAPI backend with genetic algorithm optimization
- Next.js frontend with form submission
- PostgreSQL database with product/manufacturer/provider data
- DEAP integration with multi-objective fitness function
- Cost (50%) + Speed (30%) + Reliability (20%) weighting
- Docker containerization for easy deployment
- Development tooling (linting, formatting, git hooks)

### 🟡 In Progress (Week 2-4)

- Enhanced synthetic dataset (50+ products, 15+ manufacturers)
- Comparative analysis study (vs greedy/heuristic baselines)
- Comprehensive error handling and input validation
- API documentation (Swagger/OpenAPI)

### ⏳ Planned (Week 5-7)

- Main Report & Appendices documentation
- User acceptance testing
- Deployment to Google Cloud Run
- Viva demonstration preparation

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
cd backend/app/api && uvicorn main:app --reload
cd frontend && npm run dev
```

### Production (Google Cloud Run)

```bash
# Using Pulumi IaC
cd backend/app/api
pulumi up                               # Deploy infrastructure
pulumi stack output url                 # Get API URL
```

See `backend/app/api/__main__.py` for infrastructure code.

---

## Project Timeline

| Week | Focus                                 | Status         |
| ---- | ------------------------------------- | -------------- |
| 1    | Documentation structure, code cleanup | ✅ Done        |
| 2    | Code comments, dependency updates     | 🟡 In Progress |
| 3    | Synthetic data expansion              | ⏳ Scheduled   |
| 4    | Comparative study implementation      | ⏳ Scheduled   |
| 5    | Error handling & UX polish            | ⏳ Scheduled   |
| 6-7  | Main Report writing                   | ⏳ Scheduled   |
| 8    | Viva preparation                      | ⏳ Scheduled   |
| 9    | Final submission & buffer             | ⏳ Scheduled   |

**Deadline:** 22 May 2026

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

**Last Updated:** 28 February 2026  
**Project Status:** Development in progress  
**Next Milestone:** Comparative analysis study (Week 4)
