import os


TEST_DATABASE_NAME = "casezero_test"


# Force database-backed pytest runs to use
# the isolated CASE//ZERO test database.
os.environ["POSTGRES_DB"] = (
    TEST_DATABASE_NAME
)