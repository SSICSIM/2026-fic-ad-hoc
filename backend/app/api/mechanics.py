from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.database import get_db
from app.mechanics_schemas import MechanicsAction, MechanicsSnapshot
from app.services.mechanics import apply_action, lock_state, snapshot

router = APIRouter(prefix="/mechanics", tags=["mechanics"])


@router.get("", response_model=MechanicsSnapshot)
def read_mechanics(db: Session = Depends(get_db)) -> MechanicsSnapshot:
    result = snapshot(db, lock_state(db, read=True))
    db.commit()
    return result


@router.post("", response_model=MechanicsSnapshot)
def update_mechanics(
    action: MechanicsAction, db: Session = Depends(get_db)
) -> MechanicsSnapshot:
    try:
        return apply_action(db, action)
    except IntegrityError:
        db.rollback()
        raise HTTPException(
            409,
            "That name already exists, or the entry is still in use. Review your changes.",
        )
    except HTTPException:
        db.rollback()
        raise
