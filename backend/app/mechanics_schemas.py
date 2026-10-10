from datetime import datetime
from typing import Annotated, Literal, Union

from pydantic import BaseModel, ConfigDict, Field, StringConstraints

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=255)
]


class Action(BaseModel):
    model_config = ConfigDict(extra="forbid")
    revision: int = Field(ge=0)


class SaveAgent(Action):
    type: Literal["save_agent"]
    id: int | None = None
    name: Name
    delegate_name: str = Field(default="", max_length=255)


class SaveKeeper(Action):
    type: Literal["save_keeper"]
    id: int | None = None
    name: Name
    description: str = Field(default="", max_length=10000)
    agent_id: int | None = None


class SetRepresentation(Action):
    type: Literal["set_representation"]
    keeper_id: int
    agent_id: int | None


class SetRoster(Action):
    type: Literal["set_roster"]
    agent_id: int
    keeper_ids: list[int] = Field(max_length=10000)


class Reorder(Action):
    type: Literal["reorder_keepers", "reorder_agents"]
    ids: list[int] = Field(max_length=10000)


class Remove(Action):
    type: Literal["remove_keeper", "remove_agent"]
    id: int


MechanicsAction = Annotated[
    Union[SaveAgent, SaveKeeper, SetRepresentation, SetRoster, Reorder, Remove],
    Field(discriminator="type"),
]


class Record(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class AgentResponse(Record):
    id: int
    name: str
    delegate_name: str
    rank: int


class KeeperResponse(Record):
    id: int
    name: str
    description: str
    rank: int
    agent_id: int | None


class MovementResponse(Record):
    id: int
    keeper_id: int
    keeper_name: str
    from_agent_id: int | None
    from_agent_name: str | None
    to_agent_id: int | None
    to_agent_name: str | None
    created_at: datetime


class MechanicsSnapshot(BaseModel):
    revision: int
    agents: list[AgentResponse]
    keepers: list[KeeperResponse]
    movements: list[MovementResponse]
