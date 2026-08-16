import os


TEST_DATABASE_NAME = "casezero_test"

TEST_JWT_SECRET_KEY = (
    "case-zero-pytest-secret-key-"
    "only-for-automated-testing-2026"
)


# Force database-backed pytest runs to use
# the isolated CASE//ZERO test database.
os.environ["POSTGRES_DB"] = (
    TEST_DATABASE_NAME
)


# Automated tests use an isolated signing key.
# This is deliberately not a production secret.
os.environ["JWT_SECRET_KEY"] = (
    TEST_JWT_SECRET_KEY
)