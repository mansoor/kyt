from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from database import get_db
from models.car import Car
from services.poller import poller

router = APIRouter(prefix="/public", tags=["public"])
limiter = Limiter(key_func=get_remote_address)


@router.get("/charge-level")
@limiter.limit("10/minute")
async def charge_level(request: Request, db: AsyncSession = Depends(get_db)):
    """Current battery level for all registered vehicles — no auth required."""
    result = await db.execute(select(Car))
    cars = result.scalars().all()

    poller_status = {s["car_id"]: s for s in poller.get_status()}

    return {
        "vehicles": [
            {
                "id": car.id,
                "name": car.name or car.vin or f"Car {car.id}",
                "battery_level": poller_status.get(car.id, {}).get("battery_level"),
                "charging_state": poller_status.get(car.id, {}).get("state", "unknown"),
                "charge_rate_km": None,
                "est_battery_range_km": None,
            }
            for car in cars
        ]
    }
