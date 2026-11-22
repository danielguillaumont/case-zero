"""Keep the checked-in Render web startup path limited to Uvicorn."""

from pathlib import Path

import pytest
import yaml

_BLUEPRINT = Path(__file__).resolve().parents[2] / "render.yaml"
_START_COMMAND = "uvicorn app.main:app --host 0.0.0.0 --port $PORT"


def _check_web_startup(blueprint):
    services = [item for item in blueprint["services"] if item["type"] == "web"]
    assert any(item["name"] == "case-zero-api" for item in services)
    for service in services:
        assert (
            service.get("startCommand") == _START_COMMAND
        ), "Render web startup must run only the reviewed Uvicorn command."


def test_render_web_startup_is_ddl_free():
    _check_web_startup(yaml.safe_load(_BLUEPRINT.read_text(encoding="utf-8")))


@pytest.mark.parametrize(
    "command",
    [
        f"alembic upgrade head && {_START_COMMAND}",
        f"python -m alembic upgrade c84d31ef7b26; {_START_COMMAND}",
        f"./scripts/migrate.sh && {_START_COMMAND}",
        f"{_START_COMMAND} & psql -f schema.sql",
    ],
)
def test_startup_guard_rejects_migration_commands(command):
    service = {"type": "web", "name": "case-zero-api", "startCommand": command}
    with pytest.raises(AssertionError, match="only the reviewed Uvicorn command"):
        _check_web_startup({"services": [service]})
