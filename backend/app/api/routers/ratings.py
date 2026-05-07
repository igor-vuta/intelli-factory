"""
Rating system — customers (and factories) rate completed deliveries.
Each rating feeds into the logist's (or factory's) reliability_score.
"""

from typing import Any, Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field

from db import prisma
from routers.auth import SESSION_COOKIE_NAME, _ensure_db_connection, _get_user_by_session_token, _now

router = APIRouter(dependencies=[Depends(_ensure_db_connection)])

DEFAULT_RELIABILITY: float = 0.75


async def get_avg_rating(target_profile_id: str, target_type: str) -> float | None:
    """Return avg star rating (1–5) for a profile, or None if no ratings."""
    rows = await prisma.rating.find_many(
        where={"target_profile_id": target_profile_id, "target_type": target_type}  # type: ignore[arg-type]
    )
    if not rows:
        return None
    return round(sum(r.score for r in rows) / len(rows), 2)


# ── Auth helper ───────────────────────────────────────────────────────────────

async def _require_authenticated_user(request: Request):
    raw = request.cookies.get(SESSION_COOKIE_NAME)
    if not raw:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    result = await _get_user_by_session_token(raw, request.headers.get("user-agent"))
    if not result:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid session")
    user, session = result
    await prisma.session.update(where={"id": session.id}, data={"last_seen_at": _now()})
    return user


# ── Reliability recalculation ─────────────────────────────────────────────────

async def _recalculate_logist_reliability(logist_profile_id: str) -> float:
    ratings = await prisma.rating.find_many(
        where={"target_type": "LOGIST", "target_profile_id": logist_profile_id}
    )
    if not ratings:
        score = DEFAULT_RELIABILITY
    else:
        avg_stars = sum(r.score for r in ratings) / len(ratings)
        score = round(avg_stars / 5.0, 4)

    await prisma.logisticoffer.update_many(
        where={"logist_profile_id": logist_profile_id, "deleted_at": None},
        data={"reliability_score": score},
    )
    return score


async def _recalculate_factory_reliability(factory_profile_id: str) -> float:
    ratings = await prisma.rating.find_many(
        where={"target_type": "FACTORY", "target_profile_id": factory_profile_id}
    )
    if not ratings:
        return DEFAULT_RELIABILITY
    avg_stars = sum(r.score for r in ratings) / len(ratings)
    return round(avg_stars / 5.0, 4)


async def get_computed_reliability(logist_profile_id: str) -> float:
    """Return the computed reliability score for a logist, defaulting to 0.75."""
    ratings = await prisma.rating.find_many(
        where={"target_type": "LOGIST", "target_profile_id": logist_profile_id}
    )
    if not ratings:
        return DEFAULT_RELIABILITY
    avg_stars = sum(r.score for r in ratings) / len(ratings)
    return round(avg_stars / 5.0, 4)


# ── Payload ───────────────────────────────────────────────────────────────────

class CreateRatingPayload(BaseModel):
    transaction_id: str
    target_type: Literal["LOGIST", "FACTORY"]
    score: int = Field(..., ge=1, le=5)
    comment: str | None = Field(default=None, max_length=1000)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("", status_code=201)
async def submit_rating(
    payload: CreateRatingPayload,
    user=Depends(_require_authenticated_user),
):
    """Submit a 1–5 star rating for a logist or factory after a COMPLETED transaction."""
    # Validate transaction
    tx = await prisma.transaction.find_first(
        where={"id": payload.transaction_id, "deleted_at": None},
        include={
            "selected_candidate": {
                "include": {
                    "logistic_offer": True,
                    "inventory_entry": True,
                }
            }
        },
    )
    if not tx:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Transaction not found")
    if tx.status != "COMPLETED":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Ratings can only be submitted for COMPLETED transactions",
        )

    # Resolve the target profile id
    candidate = tx.selected_candidate
    if not candidate:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No candidate on transaction")

    if payload.target_type == "LOGIST":
        logist_offer = candidate.logistic_offer
        if not logist_offer:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No logistic offer on this transaction")
        target_profile_id = logist_offer.logist_profile_id
    else:
        inv = candidate.inventory_entry
        if not inv:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No inventory entry on this transaction")
        target_profile_id = inv.factory_profile_id

    # Enforce one rating per (transaction, user, target_type)
    existing = await prisma.rating.find_first(
        where={
            "transaction_id": payload.transaction_id,
            "rated_by_user_id": user.id,
            "target_type": payload.target_type,
        }
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="You have already rated this delivery for this target.",
        )

    await prisma.rating.create(
        data={
            "transaction": {"connect": {"id": payload.transaction_id}},
            "rated_by_user": {"connect": {"id": user.id}},
            "target_type": payload.target_type,
            "target_profile_id": target_profile_id,
            "score": payload.score,
            "comment": payload.comment,
        }
    )

    # Recalculate and propagate
    if payload.target_type == "LOGIST":
        new_score = await _recalculate_logist_reliability(target_profile_id)
    else:
        new_score = await _recalculate_factory_reliability(target_profile_id)

    return {"status": "ok", "new_reliability_score": new_score}


@router.get("/my")
async def get_my_ratings(user=Depends(_require_authenticated_user)) -> dict[str, Any]:
    """Returns ratings that the caller received (as logist or factory profile)."""
    # Determine which profile ids this user owns
    profile_ids: list[str] = []

    logist = await prisma.logistprofile.find_unique(where={"user_id": user.id})
    if logist:
        profile_ids.append(logist.id)

    factory = await prisma.factoryprofile.find_unique(where={"user_id": user.id})
    if factory:
        profile_ids.append(factory.id)

    if not profile_ids:
        return {"average": None, "count": 0, "ratings": []}

    ratings = await prisma.rating.find_many(
        where={"target_profile_id": {"in": profile_ids}},
        order={"created_at": "desc"},
        take=200,
    )

    avg = round(sum(r.score for r in ratings) / len(ratings), 2) if ratings else None

    return {
        "average": avg,
        "count": len(ratings),
        "ratings": [
            {
                "id": r.id,
                "transaction_id": r.transaction_id,
                "target_type": r.target_type,
                "score": r.score,
                "comment": r.comment,
                "created_at": r.created_at.isoformat(),
            }
            for r in ratings
        ],
    }


@router.get("/transaction/{transaction_id}/mine")
async def get_my_ratings_for_transaction(
    transaction_id: str,
    user=Depends(_require_authenticated_user),
) -> list[dict[str, Any]]:
    """Returns which ratings the caller already submitted for a given transaction."""
    ratings = await prisma.rating.find_many(
        where={"transaction_id": transaction_id, "rated_by_user_id": user.id},
    )
    return [
        {"target_type": r.target_type, "score": r.score, "created_at": r.created_at.isoformat()}
        for r in ratings
    ]
