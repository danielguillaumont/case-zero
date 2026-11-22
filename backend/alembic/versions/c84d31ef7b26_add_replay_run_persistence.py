"""Add ADR 006 replay-run persistence."""

from alembic import op
from sqlalchemy import DDL

revision = "c84d31ef7b26"
down_revision = "e6ab1b3d315d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        DDL(
            """
CREATE TABLE replay_runs (
    id UUID NOT NULL,
    owner_id UUID NOT NULL,
    schema_version INTEGER NOT NULL,
    idempotency_key VARCHAR(64) NOT NULL,
    fingerprint VARCHAR(64) NOT NULL,
    fixture_id VARCHAR(80) NOT NULL,
    fixture_schema_version INTEGER NOT NULL,
    fixture_sha256 VARCHAR(64) NOT NULL,
    expectations_sha256 VARCHAR(64) NOT NULL,
    rule_id VARCHAR(80) NOT NULL,
    authoring_sha256 VARCHAR(64) NOT NULL,
    requested_sha256 VARCHAR(64) NOT NULL,
    evaluator_contract VARCHAR(80) NOT NULL,
    profile VARCHAR(20) NOT NULL,
    status VARCHAR(10) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL,
    queue_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    cancel_requested_at TIMESTAMP WITH TIME ZONE,
    finished_at TIMESTAMP WITH TIME ZONE,
    retention_deadline TIMESTAMP WITH TIME ZONE,
    expired_at TIMESTAMP WITH TIME ZONE,
    purge_at TIMESTAMP WITH TIME ZONE,
    failure VARCHAR(30),
    PRIMARY KEY (id),
    CONSTRAINT uq_replay_admission UNIQUE (owner_id, schema_version, idempotency_key),
    CONSTRAINT ck_replay_fingerprint CHECK (fingerprint ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_fixture_sha256 CHECK (fixture_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_expectations_sha256 CHECK (expectations_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_authoring_sha256 CHECK (authoring_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_requested_sha256 CHECK (requested_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_run_version CHECK (schema_version = 1 AND fixture_schema_version =
        1 AND profile = 'local/v1'),
    CONSTRAINT ck_replay_run_key CHECK (idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'),
    CONSTRAINT ck_replay_run_status CHECK (status IN
        ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED','EXPIRED')),
    CONSTRAINT ck_replay_run_time CHECK (queue_deadline > created_at AND (finished_at IS
        NULL OR finished_at >= created_at) AND (cancel_requested_at IS NULL OR
        cancel_requested_at >= created_at)),
    CONSTRAINT ck_replay_run_deadlines CHECK ((status = 'EXPIRED') = (expired_at IS NOT
        NULL) AND (expired_at IS NULL) = (purge_at IS NULL) AND (finished_at IS NULL) =
        (retention_deadline IS NULL) AND (status NOT IN ('QUEUED','RUNNING') OR finished_at
        IS NULL) AND (status NOT IN ('COMPLETED','FAILED','CANCELLED') OR finished_at IS NOT
        NULL) AND (retention_deadline IS NULL OR retention_deadline > finished_at) AND
        (purge_at IS NULL OR purge_at > expired_at)),
    CONSTRAINT ck_replay_run_failure CHECK ((status IN ('FAILED','CANCELLED')) = (failure IS
        NOT NULL) AND failure IN
        ('TRANSIENT_INFRASTRUCTURE', 'LEASE_LOST', 'RETRY_EXHAUSTED', 'QUEUE_DEADLINE',
        'EXECUTION_TIMEOUT', 'INVALID_INPUT', 'UNSUPPORTED_EXECUTION', 'EVALUATION_ERROR',
        'CANCEL_REQUESTED', 'OWNER_INACTIVE')),
    CONSTRAINT ck_replay_run_cancel CHECK (cancel_requested_at IS NULL OR status IN
        ('RUNNING','CANCELLED')),
    FOREIGN KEY(owner_id) REFERENCES users (id) ON DELETE RESTRICT
)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_owner_created ON replay_runs (owner_id, created_at, id)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_purge_at ON replay_runs (purge_at)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_queue ON replay_runs (created_at, id) WHERE status = 'QUEUED'
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_queue_deadline ON replay_runs (queue_deadline)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_retention_deadline ON replay_runs (retention_deadline)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE UNIQUE INDEX uq_replay_one_running ON replay_runs (status) WHERE status = 'RUNNING'
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE TABLE replay_attempts (
    run_id UUID NOT NULL,
    number INTEGER NOT NULL,
    lease_token UUID NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    lease_deadline TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    failure VARCHAR(30),
    PRIMARY KEY (run_id, number),
    CONSTRAINT ck_replay_attempt_number CHECK (number BETWEEN 1 AND 2),
    CONSTRAINT ck_replay_attempt_time CHECK (lease_deadline > started_at AND (ended_at IS
        NULL OR ended_at >= started_at)),
    CONSTRAINT ck_replay_attempt_failure CHECK (failure IS NULL OR (ended_at IS NOT NULL AND
        failure IN
        ('TRANSIENT_INFRASTRUCTURE', 'LEASE_LOST', 'RETRY_EXHAUSTED', 'QUEUE_DEADLINE',
        'EXECUTION_TIMEOUT', 'INVALID_INPUT', 'UNSUPPORTED_EXECUTION', 'EVALUATION_ERROR',
        'CANCEL_REQUESTED', 'OWNER_INACTIVE'))),
    FOREIGN KEY(run_id) REFERENCES replay_runs (id) ON DELETE CASCADE,
    UNIQUE (lease_token)
)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE INDEX ix_replay_active_lease ON replay_attempts (lease_deadline) WHERE ended_at IS NULL
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE TABLE replay_results (
    run_id UUID NOT NULL,
    attempt_number INTEGER NOT NULL,
    grade_schema_version INTEGER NOT NULL,
    executed_rule_id VARCHAR(80) NOT NULL,
    executed_sha256 VARCHAR(64) NOT NULL,
    grade_sha256 VARCHAR(64) NOT NULL,
    evidence_sha256 VARCHAR(64) NOT NULL,
    passed BOOLEAN NOT NULL,
    grade_bytes BYTEA NOT NULL,
    evidence_bytes BYTEA NOT NULL,
    PRIMARY KEY (run_id),
    CONSTRAINT fk_replay_result_attempt FOREIGN KEY(run_id, attempt_number) REFERENCES
        replay_attempts (run_id, number) ON DELETE CASCADE,
    CONSTRAINT ck_replay_grade_sha256 CHECK (grade_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_evidence_sha256 CHECK (evidence_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_executed_sha256 CHECK (executed_sha256 ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_replay_result_version CHECK (grade_schema_version = 1),
    CONSTRAINT ck_replay_result_size CHECK (octet_length(grade_bytes) > 0 AND
        octet_length(evidence_bytes) > 0 AND octet_length(grade_bytes) +
        octet_length(evidence_bytes) <= 32768)
)
"""
        )
    )
    op.execute(
        DDL(
            """
CREATE TABLE replay_execution_control (
    id INTEGER NOT NULL,
    PRIMARY KEY (id),
    CONSTRAINT ck_replay_control_singleton CHECK (id = 1)
)
"""
        )
    )
    op.execute("INSERT INTO replay_execution_control (id) VALUES (1)")


def downgrade() -> None:
    op.drop_table("replay_execution_control")
    op.drop_table("replay_results")
    op.drop_table("replay_attempts")
    op.drop_table("replay_runs")
