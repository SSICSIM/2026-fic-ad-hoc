from __future__ import annotations

from datetime import datetime

from sqlalchemy import CheckConstraint, DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class MechanicsState(Base):
    __tablename__ = "mechanics_state"
    __table_args__ = (CheckConstraint("id = 1", name="mechanics_singleton"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    revision: Mapped[int] = mapped_column(default=0, nullable=False)


class Groundskeeper(Base):
    __tablename__ = "groundskeepers"
    __table_args__ = (CheckConstraint("rank > 0", name="keeper_positive_rank"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255), unique=True)
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    rank: Mapped[int] = mapped_column(nullable=False)
    agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="RESTRICT"), index=True
    )


class Movement(Base):
    __tablename__ = "keeper_movements"

    id: Mapped[int] = mapped_column(primary_key=True)
    keeper_id: Mapped[int] = mapped_column(
        ForeignKey("groundskeepers.id", ondelete="RESTRICT"), index=True
    )
    from_agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="RESTRICT")
    )
    to_agent_id: Mapped[int | None] = mapped_column(
        ForeignKey("characters.id", ondelete="RESTRICT")
    )
    # Preserve the names that staff saw when recording the move, even after renames.
    keeper_name: Mapped[str] = mapped_column(String(255))
    from_agent_name: Mapped[str | None] = mapped_column(String(255))
    to_agent_name: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
