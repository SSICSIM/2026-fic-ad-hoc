from fastapi import HTTPException
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.mechanics_schemas import (
    AgentResponse,
    KeeperResponse,
    MechanicsAction,
    MechanicsSnapshot,
    MovementResponse,
    Remove,
    Reorder,
    SaveAgent,
    SaveKeeper,
    SetRepresentation,
    SetRoster,
)
from app.models.crisis_note import Character, CrisisNote
from app.models.mechanics import Groundskeeper, MechanicsState, Movement


def lock_state(db: Session, *, read: bool = False) -> MechanicsState:
    # Every roster writer (including legacy character endpoints) takes this lock.
    # Shared read locks keep the multi-query snapshot internally consistent.
    state = db.scalar(
        select(MechanicsState).where(MechanicsState.id == 1).with_for_update(read=read)
    )
    if state is None:
        raise HTTPException(
            503, "Roster setup is incomplete. Run the database migrations."
        )
    return state


def snapshot(db: Session, state: MechanicsState) -> MechanicsSnapshot:
    return MechanicsSnapshot(
        revision=state.revision,
        agents=[
            AgentResponse.model_validate(a)
            for a in db.scalars(
                select(Character).order_by(Character.rank, Character.id)
            )
        ],
        keepers=[
            KeeperResponse.model_validate(k)
            for k in db.scalars(
                select(Groundskeeper).order_by(Groundskeeper.rank, Groundskeeper.id)
            )
        ],
        movements=[
            MovementResponse.model_validate(m)
            for m in db.scalars(select(Movement).order_by(Movement.id.desc()))
        ],
    )


def get_record(db: Session, model, record_id: int):
    record = db.get(model, record_id)
    if record is None:
        raise HTTPException(404, "That agent or Groundskeeper no longer exists.")
    return record


def next_rank(db: Session, model) -> int:
    return (db.scalar(select(func.max(model.rank))) or 0) + 1


def represent(db: Session, keeper: Groundskeeper, agent_id: int | None) -> None:
    agent = get_record(db, Character, agent_id) if agent_id is not None else None
    if keeper.agent_id == agent_id:
        return
    previous = (
        get_record(db, Character, keeper.agent_id)
        if keeper.agent_id is not None
        else None
    )
    db.add(
        Movement(
            keeper_id=keeper.id,
            keeper_name=keeper.name,
            from_agent_id=keeper.agent_id,
            from_agent_name=previous.name if previous else None,
            to_agent_id=agent_id,
            to_agent_name=agent.name if agent else None,
        )
    )
    keeper.agent_id = agent_id


def remove_agent(db: Session, agent: Character) -> None:
    referenced = (
        db.scalar(
            select(Groundskeeper.id).where(Groundskeeper.agent_id == agent.id).limit(1)
        )
        or db.scalar(
            select(Movement.id)
            .where(
                or_(
                    Movement.from_agent_id == agent.id, Movement.to_agent_id == agent.id
                )
            )
            .limit(1)
        )
        or db.scalar(
            select(CrisisNote.id).where(CrisisNote.character_id == agent.id).limit(1)
        )
    )
    if referenced:
        raise HTTPException(
            409,
            "This agent has a roster, movement history, or crisis notes and cannot be removed.",
        )
    db.delete(agent)
    db.flush()
    normalize_ranks(db, Character)


def normalize_ranks(db: Session, model) -> None:
    for rank, record in enumerate(
        db.scalars(select(model).order_by(model.rank, model.id)), 1
    ):
        record.rank = rank


def apply_action(db: Session, action: MechanicsAction) -> MechanicsSnapshot:
    state = lock_state(db)
    if action.revision != state.revision:
        raise HTTPException(
            409,
            "The roster changed while you were editing. Review the refreshed data and try again.",
        )

    if isinstance(action, SaveAgent):
        agent = (
            get_record(db, Character, action.id)
            if action.id is not None
            else Character(rank=next_rank(db, Character))
        )
        agent.name = action.name
        agent.delegate_name = action.delegate_name.strip()
        db.add(agent)
    elif isinstance(action, SaveKeeper):
        keeper = (
            get_record(db, Groundskeeper, action.id)
            if action.id is not None
            else Groundskeeper(rank=next_rank(db, Groundskeeper))
        )
        keeper.name = action.name
        keeper.description = action.description.strip()
        db.add(keeper)
        db.flush()
        represent(db, keeper, action.agent_id)
    elif isinstance(action, SetRepresentation):
        represent(db, get_record(db, Groundskeeper, action.keeper_id), action.agent_id)
    elif isinstance(action, SetRoster):
        get_record(db, Character, action.agent_id)
        keepers = list(db.scalars(select(Groundskeeper).order_by(Groundskeeper.rank)))
        selected = set(action.keeper_ids)
        if len(selected) != len(action.keeper_ids) or not selected.issubset(
            {k.id for k in keepers}
        ):
            raise HTTPException(422, "Choose each existing Groundskeeper at most once.")
        for keeper in keepers:
            if keeper.id in selected:
                represent(db, keeper, action.agent_id)
            elif keeper.agent_id == action.agent_id:
                represent(db, keeper, None)
    elif isinstance(action, Reorder):
        model = Character if action.type == "reorder_agents" else Groundskeeper
        records = {r.id: r for r in db.scalars(select(model))}
        if len(action.ids) != len(records) or set(action.ids) != set(records):
            raise HTTPException(
                422, "An ordering must include every entry exactly once."
            )
        for rank, record_id in enumerate(action.ids, 1):
            records[record_id].rank = rank
    elif isinstance(action, Remove):
        if action.type == "remove_agent":
            remove_agent(db, get_record(db, Character, action.id))
        else:
            keeper = get_record(db, Groundskeeper, action.id)
            if keeper.agent_id is not None or db.scalar(
                select(Movement.id).where(Movement.keeper_id == keeper.id).limit(1)
            ):
                raise HTTPException(
                    409,
                    "A Groundskeeper with representation or movement history cannot be removed.",
                )
            db.delete(keeper)
            db.flush()
            normalize_ranks(db, Groundskeeper)

    state.revision += 1
    db.flush()
    result = snapshot(db, state)
    db.commit()
    return result
