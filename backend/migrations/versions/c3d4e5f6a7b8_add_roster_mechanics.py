"""Add roster mechanics without replacing existing crisis data."""

from alembic import op
import sqlalchemy as sa

revision = "c3d4e5f6a7b8"
down_revision = "b2c3d4e5f6a7"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Character deletion must not erase a note inserted concurrently with removal.
    op.drop_constraint(
        "crisis_notes_character_id_fkey", "crisis_notes", type_="foreignkey"
    )
    op.create_foreign_key(
        "crisis_notes_character_id_fkey",
        "crisis_notes",
        "characters",
        ["character_id"],
        ["id"],
        ondelete="RESTRICT",
    )
    op.add_column(
        "characters",
        sa.Column("delegate_name", sa.String(255), nullable=False, server_default=""),
    )
    op.add_column(
        "characters",
        sa.Column("rank", sa.Integer(), nullable=False, server_default="1"),
    )
    op.execute("""
        UPDATE characters SET rank = ordered.position
        FROM (SELECT id, ROW_NUMBER() OVER (ORDER BY name, id) AS position FROM characters) ordered
        WHERE characters.id = ordered.id
    """)
    op.create_table(
        "mechanics_state",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.CheckConstraint("id = 1", name="mechanics_singleton"),
    )
    op.execute("INSERT INTO mechanics_state (id, revision) VALUES (1, 0)")
    op.create_table(
        "groundskeepers",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=False, server_default=""),
        sa.Column("rank", sa.Integer(), nullable=False),
        sa.Column(
            "agent_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="RESTRICT"),
        ),
        sa.CheckConstraint("rank > 0", name="keeper_positive_rank"),
    )
    op.create_index("ix_groundskeepers_agent_id", "groundskeepers", ["agent_id"])
    op.create_table(
        "keeper_movements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column(
            "keeper_id",
            sa.Integer(),
            sa.ForeignKey("groundskeepers.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "from_agent_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="RESTRICT"),
        ),
        sa.Column(
            "to_agent_id",
            sa.Integer(),
            sa.ForeignKey("characters.id", ondelete="RESTRICT"),
        ),
        sa.Column("keeper_name", sa.String(255), nullable=False),
        sa.Column("from_agent_name", sa.String(255)),
        sa.Column("to_agent_name", sa.String(255)),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
    )
    op.create_index("ix_keeper_movements_keeper_id", "keeper_movements", ["keeper_id"])


def downgrade() -> None:
    op.drop_table("keeper_movements")
    op.drop_table("groundskeepers")
    op.drop_table("mechanics_state")
    op.drop_column("characters", "rank")
    op.drop_column("characters", "delegate_name")
    op.drop_constraint(
        "crisis_notes_character_id_fkey", "crisis_notes", type_="foreignkey"
    )
    op.create_foreign_key(
        "crisis_notes_character_id_fkey",
        "crisis_notes",
        "characters",
        ["character_id"],
        ["id"],
        ondelete="CASCADE",
    )
