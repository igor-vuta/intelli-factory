"""
Database seeding script for Intelli-Factory.

This script populates the PostgreSQL database with realistic test data for
manufacturers, products, and logistics providers. Data is deterministic (uses
seed) to ensure reproducibility across test runs.

Run: python seed.py (from backend/app/api directory)

Author: Igor Vuta (P2773339)
Date: February 2026
"""

import random
from datetime import datetime

# TODO: Import Prisma client when database is set up
# from prisma import Prisma


def seed_manufacturers():
    """
    Seed manufacturer data.

    Returns:
        list: List of manufacturer dictionaries
    """
    manufacturers = [
        {
            "id": "mfg-textile-kz-001",
            "name": "Almaty Textile Factory",
            "location": "almaty",
            "capacity": 10000,
            "quality_rating": 0.90,
            "lead_time_days": 2,
            "founded_year": 2010,
        },
        {
            "id": "mfg-textile-kz-002",
            "name": "Shymbulak Manufacturing",
            "location": "almaty",
            "capacity": 5000,
            "quality_rating": 0.85,
            "lead_time_days": 3,
            "founded_year": 2015,
        },
        {
            "id": "mfg-electronics-kz-001",
            "name": "Kazakhstan Electronics Assembly",
            "location": "almaty",
            "capacity": 2000,
            "quality_rating": 0.95,
            "lead_time_days": 4,
            "founded_year": 2018,
        },
        {
            "id": "mfg-food-kz-001",
            "name": "Almaty Food Processing",
            "location": "almaty",
            "capacity": 50000,
            "quality_rating": 0.88,
            "lead_time_days": 1,
            "founded_year": 2008,
        },
    ]
    return manufacturers


def seed_products():
    """
    Seed product data.

    Returns:
        list: List of product dictionaries
    """
    products = [
        # Textile products
        {
            "sku": "textile-001",
            "name": "Cotton T-Shirt",
            "manufacturer_id": "mfg-textile-kz-001",
            "price": 50,
            "weight_kg": 0.5,
            "production_days": 2,
        },
        {
            "sku": "textile-002",
            "name": "Silk Scarf",
            "manufacturer_id": "mfg-textile-kz-002",
            "price": 45,
            "weight_kg": 0.3,
            "production_days": 3,
        },
        {
            "sku": "textile-003",
            "name": "Wool Sweater",
            "manufacturer_id": "mfg-textile-kz-001",
            "price": 120,
            "weight_kg": 1.2,
            "production_days": 2,
        },
        # Electronics products
        {
            "sku": "electronics-001",
            "name": "Circuit Board",
            "manufacturer_id": "mfg-electronics-kz-001",
            "price": 200,
            "weight_kg": 0.2,
            "production_days": 5,
        },
        {
            "sku": "electronics-002",
            "name": "Power Supply",
            "manufacturer_id": "mfg-electronics-kz-001",
            "price": 150,
            "weight_kg": 0.8,
            "production_days": 4,
        },
        # Food products
        {
            "sku": "food-001",
            "name": "Pasta (1kg)",
            "manufacturer_id": "mfg-food-kz-001",
            "price": 5,
            "weight_kg": 1.0,
            "production_days": 1,
        },
        {
            "sku": "food-002",
            "name": "Canned Vegetables",
            "manufacturer_id": "mfg-food-kz-001",
            "price": 8,
            "weight_kg": 2.0,
            "production_days": 1,
        },
    ]
    return products


def seed_logistics_providers():
    """
    Seed logistics provider data.

    Returns:
        list: List of logistics provider dictionaries
    """
    providers = [
        {
            "id": "logistics-local-001",
            "name": "Almaty Local Courier",
            "cost_per_kg": 10,
            "cost_per_km": 0.5,
            "speed_rating": 0.8,  # Relative speed (0-1)
            "reliability_score": 0.85,
            "coverage_area": "almaty",
        },
        {
            "id": "logistics-regional-001",
            "name": "Central Asia Regional Logistics",
            "cost_per_kg": 15,
            "cost_per_km": 1.0,
            "speed_rating": 0.95,
            "reliability_score": 0.92,
            "coverage_area": "central_asia",
        },
        {
            "id": "logistics-national-001",
            "name": "Kazakhstan National Carrier",
            "cost_per_kg": 20,
            "cost_per_km": 1.5,
            "speed_rating": 1.0,
            "reliability_score": 0.98,
            "coverage_area": "kazakhstan",
        },
        {
            "id": "logistics-international-001",
            "name": "International Express",
            "cost_per_kg": 50,
            "cost_per_km": 5.0,
            "speed_rating": 1.0,
            "reliability_score": 0.99,
            "coverage_area": "global",
        },
    ]
    return providers


def seed_test_orders():
    """
    Generate test orders for validation.

    Returns:
        list: List of test order dictionaries
    """
    skus = ["textile-001", "textile-002", "electronics-001", "food-001"]
    destinations = ["almaty", "astana", "karaganda", "aktobe"]
    priorities = ["cost", "speed", "balanced"]

    orders = []
    for i in range(20):
        orders.append(
            {
                "id": f"test-order-{i + 1:04d}",
                "sku": random.choice(skus),
                "destination": random.choice(destinations),
                "quantity": random.randint(10, 500),
                "priority": random.choice(priorities),
                "created_at": datetime.now().isoformat(),
            }
        )
    return orders


def main():
    """
    Main seeding function.

    TODO: Integrate with Prisma client to actually write to database
    """
    random.seed(42)  # Deterministic random data

    print("Seeding database...")

    manufacturers = seed_manufacturers()
    print(f"  ✓ Generated {len(manufacturers)} manufacturers")

    products = seed_products()
    print(f"  ✓ Generated {len(products)} products")

    logistics_providers = seed_logistics_providers()
    print(f"  ✓ Generated {len(logistics_providers)} logistics providers")

    test_orders = seed_test_orders()
    print(f"  ✓ Generated {len(test_orders)} test orders")

    print("\nFile structure ready. Next steps:")
    print("1. Run: prisma migrate dev")
    print("2. Connect Prisma client to this script")
    print("3. Import data into PostgreSQL")


if __name__ == "__main__":
    main()
