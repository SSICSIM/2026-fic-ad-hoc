"""Roster behavior checks. TEST_DATABASE_URL enables real Postgres concurrency checks.

Every Postgres test creates its own temporary schema; existing tables are untouched.
"""

import os
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, delete, event, text
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.main import app
from app.models.crisis_note import Character
from app.models.mechanics import MechanicsState


@pytest.fixture()
def client(monkeypatch):
    monkeypatch.setattr(settings, "admin_api_token", "roster-test-token")
    url = os.environ.get("TEST_DATABASE_URL")
    schema = "roster_test_" + uuid4().hex
    admin = None
    if url:
        admin = create_engine(url)
        with admin.begin() as connection:
            connection.execute(text(f'CREATE SCHEMA "{schema}"'))
        engine = create_engine(url, connect_args={"options": f"-csearch_path={schema}"})
    else:
        engine = create_engine(
            "sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool
        )

        @event.listens_for(engine, "connect")
        def foreign_keys(connection, _):
            connection.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False)
    with sessions.begin() as db:
        db.add(MechanicsState(id=1, revision=0))

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    with TestClient(app, headers={"X-Admin-Token": "roster-test-token"}) as test_client:
        yield test_client
    app.dependency_overrides.clear()
    engine.dispose()
    if admin:
        with admin.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        admin.dispose()


def read(client):
    response = client.get("/api/mechanics")
    assert response.status_code == 200, response.text
    return response.json()


def act(client, kind, *, revision=None, status=200, **values):
    if revision is None:
        revision = read(client)["revision"]
    response = client.post(
        "/api/mechanics", json={"type": kind, "revision": revision, **values}
    )
    assert response.status_code == status, response.text
    return response.json()


def seed(client):
    act(client, "save_agent", name="Agent A", delegate_name="Delegate A")
    a = act(client, "save_agent", name="Agent B")["agents"]
    act(client, "save_keeper", name="Sasquatch")
    k = act(client, "save_keeper", name="Nessie")["keepers"]
    return a, k


def test_empty_and_authentication(client):
    assert read(client) == {"revision": 0, "agents": [], "keepers": [], "movements": []}
    assert (
        client.get("/api/mechanics", headers={"X-Admin-Token": "wrong"}).status_code
        == 401
    )
    assert (
        client.post(
            "/api/mechanics",
            headers={"X-Admin-Token": "wrong"},
            json={"type": "save_agent", "revision": 0, "name": "No"},
        ).status_code
        == 401
    )


def test_assign_transfer_drop_and_no_duplicate_moves(client):
    agents, keepers = seed(client)
    key = keepers[0]["id"]
    first = act(client, "set_representation", keeper_id=key, agent_id=agents[0]["id"])
    assert first["keepers"][0]["agent_id"] == agents[0]["id"]
    assert first["movements"][0]["from_agent_id"] is None
    same = act(client, "set_representation", keeper_id=key, agent_id=agents[0]["id"])
    assert len(same["movements"]) == 1
    transfer = act(
        client, "set_representation", keeper_id=key, agent_id=agents[1]["id"]
    )
    assert transfer["movements"][0]["from_agent_name"] == "Agent A"
    assert transfer["movements"][0]["to_agent_name"] == "Agent B"
    drop = act(client, "set_representation", keeper_id=key, agent_id=None)
    assert drop["keepers"][0]["agent_id"] is None
    assert len(drop["movements"]) == 3
    assert drop["movements"][0]["to_agent_id"] is None


def test_batch_roster_transfers_and_releases_atomically(client):
    agents, keepers = seed(client)
    ids = [k["id"] for k in keepers]
    act(client, "set_roster", agent_id=agents[0]["id"], keeper_ids=ids)
    result = act(client, "set_roster", agent_id=agents[1]["id"], keeper_ids=[ids[1]])
    assert [k["agent_id"] for k in result["keepers"]] == [
        agents[0]["id"],
        agents[1]["id"],
    ]
    before = read(client)
    act(
        client,
        "set_roster",
        status=422,
        agent_id=agents[0]["id"],
        keeper_ids=[ids[0], 9999],
    )
    assert read(client) == before
    released = act(client, "set_roster", agent_id=agents[0]["id"], keeper_ids=[])
    assert released["keepers"][0]["agent_id"] is None
    assert len(released["movements"]) == 4


def test_stale_edits_and_retried_commands_do_not_overwrite(client):
    agents, keepers = seed(client)
    revision = read(client)["revision"]
    act(
        client,
        "set_representation",
        revision=revision,
        keeper_id=keepers[0]["id"],
        agent_id=agents[0]["id"],
    )
    act(
        client,
        "set_representation",
        revision=revision,
        status=409,
        keeper_id=keepers[0]["id"],
        agent_id=agents[1]["id"],
    )
    act(
        client,
        "set_representation",
        revision=revision,
        status=409,
        keeper_id=keepers[0]["id"],
        agent_id=agents[0]["id"],
    )
    result = read(client)
    assert result["keepers"][0]["agent_id"] == agents[0]["id"]
    assert len(result["movements"]) == 1


@pytest.mark.parametrize(
    "kind,collection", [("reorder_agents", "agents"), ("reorder_keepers", "keepers")]
)
def test_rankings_require_complete_permutation(client, kind, collection):
    seed(client)
    original = read(client)
    ids = [v["id"] for v in original[collection]]
    for invalid in [[], ids[:1], [ids[0], ids[0]], [ids[0], 9999]]:
        act(client, kind, status=422, ids=invalid)
        assert read(client) == original
    ordered = act(client, kind, ids=list(reversed(ids)))
    assert [v["id"] for v in ordered[collection]] == list(reversed(ids))
    assert [v["rank"] for v in ordered[collection]] == [1, 2]
    assert ordered["movements"] == []


def test_creation_validation_and_rollback(client):
    agents, keepers = seed(client)
    before = read(client)
    act(client, "save_agent", name="  ", status=422)
    act(client, "save_agent", name="Agent A", status=409)
    act(client, "save_keeper", name="Sasquatch", status=409)
    act(client, "save_keeper", name="Uncommitted keeper", agent_id=9999, status=404)
    act(
        client,
        "set_representation",
        keeper_id=keepers[0]["id"],
        agent_id=9999,
        status=404,
    )
    assert read(client) == before


def test_history_retains_names_and_prevents_removal(client):
    agents, keepers = seed(client)
    aid, kid = agents[0]["id"], keepers[0]["id"]
    act(client, "set_representation", keeper_id=kid, agent_id=aid)
    act(
        client, "save_agent", id=aid, name="Renamed agent", delegate_name="New delegate"
    )
    result = act(
        client,
        "save_keeper",
        id=kid,
        name="Renamed keeper",
        description="Description",
        agent_id=aid,
    )
    assert result["movements"][0]["keeper_name"] == "Sasquatch"
    assert result["movements"][0]["to_agent_name"] == "Agent A"
    assert len(result["movements"]) == 1
    act(client, "set_representation", keeper_id=kid, agent_id=None)
    act(client, "remove_agent", id=aid, status=409)
    act(client, "remove_keeper", id=kid, status=409)
    assert client.delete(f"/api/characters/{aid}").status_code == 409


def test_unused_entries_can_be_removed_and_ranks_close_gaps(client):
    agents, keepers = seed(client)
    result = act(client, "remove_keeper", id=keepers[0]["id"])
    assert result["keepers"][0]["rank"] == 1
    result = act(client, "remove_agent", id=agents[0]["id"])
    assert result["agents"][0]["rank"] == 1


def test_existing_character_routes_share_identity_and_revision(client):
    agents, _ = seed(client)
    revision = read(client)["revision"]
    response = client.post("/api/characters", json={"name": "Legacy entry"})
    assert response.status_code == 201
    result = read(client)
    assert result["revision"] == revision + 1
    assert result["agents"][-1]["name"] == "Legacy entry"
    assert result["agents"][-1]["rank"] == 3
    response = client.post(
        "/api/characters/bulk",
        files={"file": ("agents.json", '["Fourth", "Fifth"]', "application/json")},
    )
    assert response.status_code == 200
    assert [a["rank"] for a in read(client)["agents"]] == [1, 2, 3, 4, 5]
    assert client.delete(f'/api/characters/{agents[0]["id"]}').status_code == 204
    assert [a["rank"] for a in read(client)["agents"]] == [1, 2, 3, 4]


def test_crisis_notes_protect_agent_identity(client):
    agents, _ = seed(client)
    period = client.post("/api/periods", json={"name": "Session 1"})
    assert period.status_code == 201, period.text
    note = client.post(
        "/api/notes",
        json={
            "character_id": agents[0]["id"],
            "title": "A directive",
            "description": "Keep this history",
            "priority": "LOW",
            "note_type": "PRIVATE_DIRECTIVE",
        },
    )
    assert note.status_code == 201, note.text
    act(client, "remove_agent", id=agents[0]["id"], status=409)
    assert client.delete(f'/api/characters/{agents[0]["id"]}').status_code == 409
    assert len(client.get("/api/notes").json()) == 1
    # The storage constraint also protects a note inserted after the API's check.
    for db in app.dependency_overrides[get_db]():
        with pytest.raises(IntegrityError):
            db.execute(delete(Character).where(Character.id == agents[0]["id"]))
        db.rollback()
    assert len(client.get("/api/notes").json()) == 1


@pytest.mark.skipif(
    not os.environ.get("TEST_DATABASE_URL"), reason="Requires Postgres row locks"
)
def test_simultaneous_staff_edits_only_one_wins(client):
    agents, keepers = seed(client)
    revision = read(client)["revision"]

    def submit(agent):
        return client.post(
            "/api/mechanics",
            json={
                "type": "set_representation",
                "revision": revision,
                "keeper_id": keepers[0]["id"],
                "agent_id": agent["id"],
            },
        ).status_code

    with ThreadPoolExecutor(max_workers=2) as executor:
        statuses = list(executor.map(submit, agents))
    assert sorted(statuses) == [200, 409]
    result = read(client)
    assert len(result["movements"]) == 1
    assert result["revision"] == revision + 1
