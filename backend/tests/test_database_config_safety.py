import os
from pathlib import Path
import subprocess
import sys

import pytest


BACKEND = Path(__file__).resolve().parents[1]
TEST_SETTINGS = {
    "APP_ENV": "test",
    "POSTGRES_HOST": "127.0.0.1",
    "POSTGRES_PORT": "55432",
    "POSTGRES_DB": "casezero_test",
    "POSTGRES_USER": "casezero_test_runner",
    "POSTGRES_PASSWORD": "synthetic-config-test-password",
}

CHECK_CONFIG = """
import os
import runpy
import sys
from pathlib import Path
from types import ModuleType


def block_network(event, args):
    if event in {"socket.connect", "socket.getaddrinfo"}:
        raise AssertionError(f"Unexpected network operation: {event}")


sys.addaudithook(block_network)
sys.modules["app.database"] = None
sys.modules["psycopg"] = None

import dotenv
from sqlalchemy.engine import make_url

sys.path.insert(0, sys.argv[1])

def fake_load_dotenv(*args, **kwargs):
    if sys.argv[2] == "dotenv-only":
        os.environ["APP_ENV"] = "test"
        return True
    raise AssertionError("Test configuration attempted to load dotenv")

dotenv.load_dotenv = fake_load_dotenv
if sys.argv[2] == "preloaded":
    sys.modules["app.config"] = ModuleType("app.config")
if sys.argv[2] in {"pytest", "preloaded"}:
    runpy.run_path(str(Path(sys.argv[1]) / "tests" / "conftest.py"))

from app import config

url = make_url(config.DATABASE_URL)
assert config.APP_ENV == "test"
assert url.drivername == "postgresql+psycopg"
assert url.host == config.POSTGRES_HOST == os.environ["POSTGRES_HOST"]
assert url.port == config.POSTGRES_PORT == int(os.environ["POSTGRES_PORT"])
assert url.database == config.POSTGRES_DB == os.environ["POSTGRES_DB"]
assert url.username == config.POSTGRES_USER == os.environ["POSTGRES_USER"]
assert url.password == config.POSTGRES_PASSWORD == os.environ["POSTGRES_PASSWORD"]
if sys.argv[2] == "pytest":
    assert config.JWT_SECRET_KEY.startswith("case-zero-pytest-secret-key-")
"""


def run_config(overrides=None, *, missing=(), entry="config"):
    # Windows subprocesses may need SystemRoot. Only synthetic settings are
    # passed to the child, along with these OS paths when present.
    env = {
        name: os.environ[name] for name in ("SYSTEMROOT", "WINDIR") if name in os.environ
    }
    env.update(TEST_SETTINGS)
    env.update(overrides or {})
    for name in missing:
        del env[name]
    return subprocess.run(
        [sys.executable, "-I", "-B", "-c", CHECK_CONFIG, str(BACKEND), entry],
        cwd=BACKEND,
        env=env,
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )


def assert_rejected(result, message):
    assert result.returncode != 0
    assert f"RuntimeError: {message}" in result.stderr
    assert TEST_SETTINGS["POSTGRES_PASSWORD"] not in result.stderr
    assert "postgresql+psycopg://" not in result.stderr


@pytest.mark.parametrize("host", ["127.0.0.1", "::1"])
def test_explicit_loopback_settings_are_accepted(host):
    result = run_config({"POSTGRES_HOST": host})
    assert result.returncode == 0, result.stderr


@pytest.mark.parametrize(
    ("setting", "value", "message"),
    [
        ("POSTGRES_HOST", "database.example.invalid", "Test POSTGRES_HOST"),
        ("POSTGRES_HOST", "192.0.2.1", "Test POSTGRES_HOST"),
        ("POSTGRES_HOST", "localhost", "Test POSTGRES_HOST"),
        ("POSTGRES_HOST", "127.0.0.1,192.0.2.1", "Test POSTGRES_HOST"),
        ("POSTGRES_DB", "synthetic-wrong-database", "Test POSTGRES_DB"),
        ("POSTGRES_PORT", "synthetic-invalid-port", "POSTGRES_PORT must be an integer."),
        ("POSTGRES_PORT", "65536", "POSTGRES_PORT must be between 1 and 65535."),
        ("POSTGRES_PASSWORD", " ", "Missing explicit test database settings: POSTGRES_PASSWORD"),
    ],
)
def test_unsafe_values_are_rejected(setting, value, message):
    result = run_config({setting: value})
    assert_rejected(result, message)
    if value.strip():
        assert value not in result.stderr


@pytest.mark.parametrize("missing", sorted(TEST_SETTINGS.keys() - {"APP_ENV"}))
def test_all_test_database_settings_are_required(missing):
    result = run_config(missing=(missing,))
    assert_rejected(result, f"Missing explicit test database settings: {missing}")


@pytest.mark.parametrize(
    "name",
    [
        "PGHOST", "PGHOSTADDR", "PGPORT", "PGDATABASE", "PGUSER", "PGPASSWORD",
        "PGPASSFILE", "PGSERVICE", "PGSERVICEFILE", "PGSYSCONFDIR", "PGOPTIONS",
    ],
)
def test_driver_overrides_are_rejected(name):
    result = run_config({name: "synthetic-driver-override"})
    assert_rejected(result, f"Unset libpq environment overrides for test runs: {name}")
    assert "synthetic-driver-override" not in result.stderr


def test_dotenv_alone_cannot_select_test_mode():
    result = run_config(missing=("APP_ENV",), entry="dotenv-only")
    assert_rejected(result, "Set APP_ENV=test in the process environment")


def test_pytest_bootstrap_selects_test_mode():
    result = run_config({"APP_ENV": "production"}, entry="pytest")
    assert result.returncode == 0, result.stderr


def test_pytest_bootstrap_preserves_and_rejects_wrong_database_name():
    result = run_config({"POSTGRES_DB": "casezero"}, entry="pytest")
    assert_rejected(result, "Test POSTGRES_DB must be casezero_test.")


def test_pytest_bootstrap_rejects_preloaded_config():
    result = run_config(entry="preloaded")
    assert_rejected(result, "Load pytest test configuration before importing app.config.")
