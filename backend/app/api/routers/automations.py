"""
Automation router for supply chain optimization.

This module contains the core optimization endpoint that uses DEAP genetic
algorithms to find optimal manufacturer-logistics provider combinations.

Author: Igor Vuta (P2773339)
Date: February 2026
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, List
import random
from deap import base, creator, tools, algorithms

router = APIRouter()


# ============================================================================
# Pydantic Models for Request/Response
# ============================================================================


class OptimizeRequest(BaseModel):
    """Request model for optimization endpoint."""

    sku: str = Field(..., description="Product SKU to optimize")
    destination: str = Field(..., description="Delivery destination")
    quantity: int = Field(..., gt=0, description="Order quantity")
    priority: str = Field(
        "balanced", description="Optimization priority: cost, speed, or balanced"
    )

    class Config:
        example = {
            "sku": "textile-001",
            "destination": "almaty",
            "quantity": 100,
            "priority": "balanced",
        }


class Solution(BaseModel):
    """Single optimization solution."""

    rank: int = Field(..., description="Solution rank (1=best)")
    manufacturer: str = Field(..., description="Selected manufacturer")
    logistics_provider: str = Field(..., description="Selected logistics provider")
    total_cost: float = Field(..., description="Total cost (currency units)")
    delivery_days: int = Field(..., description="Days to delivery")
    reliability_score: float = Field(..., description="Reliability score (0-1)")
    fitness_score: float = Field(..., description="Overall fitness score (0-1)")


class OptimizeResponse(BaseModel):
    """Response model for optimization endpoint."""

    status: str = Field(..., description="Status: success or error")
    order_id: Optional[str] = Field(None, description="Unique order ID")
    solutions: Optional[List[Solution]] = Field(
        None, description="List of ranked solutions"
    )
    error_code: Optional[str] = Field(None, description="Error code if status=error")
    message: Optional[str] = Field(None, description="Error message if status=error")


# ============================================================================
# Mock Data (Will be replaced with database queries)
# ============================================================================

MANUFACTURERS = {
    "textile-factory-a": {"location": "almaty", "quality": 0.90, "lead_time": 2},
    "textile-factory-b": {"location": "almaty", "quality": 0.85, "lead_time": 3},
    "electronics-asm-a": {"location": "almaty", "quality": 0.95, "lead_time": 4},
}

LOGISTICS_PROVIDERS = {
    "local-courier": {"cost_per_kg": 10, "speed": 0.8, "reliability": 0.85},
    "regional-logistics": {"cost_per_kg": 15, "speed": 0.95, "reliability": 0.92},
    "national-carrier": {"cost_per_kg": 20, "speed": 1.0, "reliability": 0.98},
}

PRODUCTS = {
    "textile-001": {"manufacturer": "textile-factory-a", "price": 50, "weight": 0.5},
    "textile-002": {"manufacturer": "textile-factory-b", "price": 45, "weight": 0.4},
    "electronics-001": {
        "manufacturer": "electronics-asm-a",
        "price": 200,
        "weight": 0.2,
    },
}


# ============================================================================
# DEAP Optimization Configuration
# ============================================================================


def create_toolbox():
    """
    Create DEAP toolbox with genetic algorithm configuration.

    The algorithm optimizes three objectives:
    1. Cost (minimize) - weight 0.5
    2. Speed (minimize days) - weight 0.3
    3. Reliability (maximize) - weight 0.2

    Returns:
        deap.base.Toolbox: Configured genetic algorithm toolbox
    """
    # Clear any existing configuration (for clean runs)
    if hasattr(creator, "FitnessMulti"):
        del creator.FitnessMulti
    if hasattr(creator, "Individual"):
        del creator.Individual

    # Multi-objective fitness: minimize cost, minimize time, maximize reliability
    creator.create("FitnessMulti", base.Fitness, weights=(-1.0, -1.0, 1.0))

    # Individual is a list of [manufacturer_index, provider_index]
    creator.create("Individual", list, fitness=creator.FitnessMulti)

    toolbox = base.Toolbox()

    # Attribute generators (random manufacturer and provider)
    toolbox.register("manufacturer_idx", random.randint, 0, len(MANUFACTURERS) - 1)
    toolbox.register("provider_idx", random.randint, 0, len(LOGISTICS_PROVIDERS) - 1)

    # Individual structure
    toolbox.register(
        "individual",
        tools.initCycle,
        creator.Individual,
        (toolbox.manufacturer_idx, toolbox.provider_idx),
        n=1,
    )

    # Population
    toolbox.register("population", tools.initRepeat, list, toolbox.individual)

    # Evaluation function (fitness)
    toolbox.register("evaluate", evaluate_solution)

    # Genetic operators (uniform crossover for discrete integers)
    toolbox.register("mate", tools.cxUniform, indpb=0.5)
    toolbox.register("mutate", mutate_individual)
    toolbox.register("select", tools.selTournament, tournsize=3)

    # TODO: Add constraint handling in future iterations

    return toolbox


def evaluate_solution(individual):
    """
    Evaluate fitness of a solution.

    Args:
        individual: [manufacturer_idx, provider_idx]

    Returns:
        tuple: (cost, delivery_time, reliability) - to be minimized/maximized per weights
    """
    manufacturer_idx = individual[0]
    provider_idx = individual[1]

    manufacturer_list = list(MANUFACTURERS.keys())
    provider_list = list(LOGISTICS_PROVIDERS.keys())

    manufacturer = manufacturer_list[manufacturer_idx % len(manufacturer_list)]
    provider = provider_list[provider_idx % len(provider_list)]

    # Simulate cost calculation
    base_cost = 1000
    mfg_cost = MANUFACTURERS[manufacturer].get("quality", 0.8) * 100
    logistics_cost = LOGISTICS_PROVIDERS[provider]["cost_per_kg"] * 50
    total_cost = base_cost + mfg_cost + logistics_cost

    # Simulate delivery time
    mfg_time = MANUFACTURERS[manufacturer].get("lead_time", 3)
    provider_speed = LOGISTICS_PROVIDERS[provider]["speed"]
    delivery_time = mfg_time + (10 / provider_speed)  # 10 days base, scaled by speed

    # Reliability (composite)
    mfg_reliability = MANUFACTURERS[manufacturer].get("quality", 0.8)
    provider_reliability = LOGISTICS_PROVIDERS[provider]["reliability"]
    reliability = (mfg_reliability + provider_reliability) / 2

    return (total_cost, delivery_time, reliability)


def mutate_individual(individual, indpb=0.2):
    """
    Mutation operator: randomly change manufacturer or provider.

    Args:
        individual: Solution to mutate
        indpb: Probability of mutation

    Returns:
        tuple: (mutated individual,)
    """
    if random.random() < indpb:
        individual[0] = random.randint(0, len(MANUFACTURERS) - 1)
    if random.random() < indpb:
        individual[1] = random.randint(0, len(LOGISTICS_PROVIDERS) - 1)

    return (individual,)


def feasible(individual):
    """
    Check if individual satisfies hard constraints.

    For now, all combinations are feasible. In production, would check:
    - Manufacturer has the product
    - Provider serves the destination

    Args:
        individual: Solution to check

    Returns:
        bool: True if feasible, False otherwise
    """
    # TODO: Implement actual constraint checking
    return True


# ============================================================================
# API Endpoints
# ============================================================================


@router.post("/optimize", response_model=OptimizeResponse)
async def optimize(request: OptimizeRequest):
    """
    Optimize supply chain matching for a customer order.

    Uses genetic algorithms to find optimal combinations of manufacturer
    and logistics provider that balance cost, delivery speed, and reliability.

    Args:
        request: OptimizeRequest with order details

    Returns:
        OptimizeResponse: List of ranked solutions or error

    Raises:
        HTTPException: If SKU not found or other validation error
    """

    # Validate SKU exists
    if request.sku not in PRODUCTS:
        raise HTTPException(
            status_code=400, detail=f"SKU '{request.sku}' not found in database"
        )

    # Create and run genetic algorithm
    random.seed(42)  # For reproducibility
    toolbox = create_toolbox()

    # Create initial population
    population = toolbox.population(n=50)

    # Run algorithm
    population, logbook = algorithms.eaSimple(
        population,
        toolbox,
        cxpb=0.7,  # Crossover probability
        mutpb=0.2,  # Mutation probability
        ngen=50,  # Number of generations
        verbose=False,
    )

    # Extract and rank solutions
    solutions_list = []
    for rank, individual in enumerate(
        sorted(population, key=lambda x: x.fitness.values)[:5], 1
    ):
        manufacturer_idx = individual[0]
        provider_idx = individual[1]

        manufacturer_list = list(MANUFACTURERS.keys())
        provider_list = list(LOGISTICS_PROVIDERS.keys())

        manufacturer = manufacturer_list[manufacturer_idx % len(manufacturer_list)]
        provider = provider_list[provider_idx % len(provider_list)]

        cost, delivery_time, reliability = individual.fitness.values

        # Normalize fitness to 0-1 scale
        fitness_score = max(0, min(1, 1 - (cost / 5000)))  # Rough normalization

        solutions_list.append(
            Solution(
                rank=rank,
                manufacturer=manufacturer,
                logistics_provider=provider,
                total_cost=round(cost, 2),
                delivery_days=int(round(delivery_time)),
                reliability_score=round(reliability, 3),
                fitness_score=round(fitness_score, 3),
            )
        )

    return OptimizeResponse(
        status="success",
        order_id=f"order-{random.randint(10000, 99999)}",
        solutions=solutions_list,
        error_code=None,
        message=None,
    )
