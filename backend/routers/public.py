from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from slowapi import Limiter
from slowapi.util import get_remote_address

from database import get_db
from models.car import Car

router = APIRouter(prefix="/public", tags=["public"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/charge-level")
@limiter.limit("10/minute")
async def charge_level(request: Request, db: AsyncSession = Depends(get_db)):
    """
    Returns current battery level for all registered vehicles.
    No authentication required. Phase 1 stub — battery_level populated in Phase 2.
    """
    result = await db.execute(select(Car))
    cars = result.scalars().all()
    return {
        "vehicles": [
            {
                "id": car.id,
                "name": car.name or car.vin or f"Car {car.id}",
                "battery_level": None,
                "charging_state": "unknown",
                "charge_rate_km": None,
                "est_battery_range_km": None,
            }
            for car in cars
        ]
    }
