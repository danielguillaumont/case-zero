import os
import sys
from importlib import import_module

TEST_JWT_SECRET_KEY = (
    "case-zero-pytest-secret-key-"
    "only-for-automated-testing-2026"
)


if "app.config" in sys.modules:
    raise RuntimeError("Load pytest test configuration before importing app.config.")

os.environ["APP_ENV"] = "test"

# Automated tests use an isolated signing key.
# This is deliberately not a production secret.
os.environ["JWT_SECRET_KEY"] = (
    TEST_JWT_SECRET_KEY
)

# Validate before collection imports modules that use the database.
import_module("app.config")
