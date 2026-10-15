from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

from .probe import validate_url

IncidentStatus = Literal["investigating", "identified", "monitoring", "resolved"]
Severity = Literal["critical", "major", "minor"]
TaskStatus = Literal["todo", "in_progress", "done"]
Priority = Literal["low", "medium", "high", "urgent"]


class Input(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class Register(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=12, max_length=128)
    name: str = Field(min_length=1, max_length=80)

    @field_validator("name", mode="before")
    @classmethod
    def trim_name(cls, value):
        return value.strip() if isinstance(value, str) else value


class Login(Input):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=False)
    email: EmailStr = Field(max_length=320)
    password: str = Field(min_length=1, max_length=128)


class ServiceCreate(Input):
    name: str = Field(min_length=1, max_length=80)
    url: str = Field(max_length=2048)
    description: str = Field(default="", max_length=4000)
    is_public: bool = False

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        validate_url(value)
        return value


class PartialInput(Input):
    @model_validator(mode="before")
    @classmethod
    def no_null_required_fields(cls, values):
        if isinstance(values, dict):
            for key, value in values.items():
                if value is None and key not in ("service_id", "incident_id"):
                    raise ValueError(f"{key} cannot be null")
        return values


class ServicePatch(PartialInput):
    name: str | None = Field(default=None, min_length=1, max_length=80)
    url: str | None = Field(default=None, max_length=2048)
    description: str | None = Field(default=None, max_length=4000)
    is_public: bool | None = None

    @field_validator("url")
    @classmethod
    def safe_url(cls, value):
        if value is not None:
            validate_url(value)
        return value


class IncidentCreate(Input):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=8000)
    severity: Severity = "minor"
    service_id: str | None = Field(default=None, min_length=36, max_length=36)


class IncidentPatch(PartialInput):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=8000)
    severity: Severity | None = None
    status: IncidentStatus | None = None
    service_id: str | None = Field(default=None, min_length=36, max_length=36)


class UpdateCreate(Input):
    message: str = Field(min_length=1, max_length=4000)
    status: IncidentStatus | None = None


class TaskCreate(Input):
    title: str = Field(min_length=1, max_length=160)
    description: str = Field(default="", max_length=4000)
    status: TaskStatus = "todo"
    priority: Priority = "medium"
    incident_id: str | None = Field(default=None, min_length=36, max_length=36)


class TaskPatch(PartialInput):
    title: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    status: TaskStatus | None = None
    priority: Priority | None = None
    incident_id: str | None = Field(default=None, min_length=36, max_length=36)
