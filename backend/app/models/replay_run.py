"""PostgreSQL table definitions for ADR 006 replay persistence."""

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    LargeBinary,
    String,
    Table,
    UniqueConstraint,
    Uuid,
)

from app.models.base import Base

metadata = Base.metadata
_TIME = DateTime(timezone=True)
_DIGEST = String(64)
_FAILURES = (
    "'TRANSIENT_INFRASTRUCTURE','LEASE_LOST','RETRY_EXHAUSTED','QUEUE_DEADLINE',"
    "'EXECUTION_TIMEOUT','INVALID_INPUT','UNSUPPORTED_EXECUTION','EVALUATION_ERROR',"
    "'CANCEL_REQUESTED','OWNER_INACTIVE'"
)


def _digest_checks(*columns: str):
    return [
        CheckConstraint(f"{name} ~ '^[0-9a-f]{{64}}$'", name=f"ck_replay_{name}")
        for name in columns
    ]


replay_runs = Table(
    "replay_runs",
    metadata,
    Column("id", Uuid, primary_key=True),
    Column(
        "owner_id", Uuid, ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    ),
    Column("schema_version", Integer, nullable=False),
    Column("idempotency_key", String(64), nullable=False),
    Column("fingerprint", _DIGEST, nullable=False),
    Column("fixture_id", String(80), nullable=False),
    Column("fixture_schema_version", Integer, nullable=False),
    Column("fixture_sha256", _DIGEST, nullable=False),
    Column("expectations_sha256", _DIGEST, nullable=False),
    Column("rule_id", String(80), nullable=False),
    Column("authoring_sha256", _DIGEST, nullable=False),
    Column("requested_sha256", _DIGEST, nullable=False),
    Column("evaluator_contract", String(80), nullable=False),
    Column("profile", String(20), nullable=False),
    Column("status", String(10), nullable=False),
    Column("created_at", _TIME, nullable=False),
    Column("queue_deadline", _TIME, nullable=False),
    Column("cancel_requested_at", _TIME),
    Column("finished_at", _TIME),
    Column("retention_deadline", _TIME),
    Column("expired_at", _TIME),
    Column("purge_at", _TIME),
    Column("failure", String(30)),
    UniqueConstraint(
        "owner_id", "schema_version", "idempotency_key", name="uq_replay_admission"
    ),
    *_digest_checks(
        "fingerprint",
        "fixture_sha256",
        "expectations_sha256",
        "authoring_sha256",
        "requested_sha256",
    ),
    CheckConstraint(
        "schema_version = 1 AND fixture_schema_version = 1 AND profile = 'local/v1'",
        name="ck_replay_run_version",
    ),
    CheckConstraint(
        "idempotency_key ~ '^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$'",
        name="ck_replay_run_key",
    ),
    CheckConstraint(
        "status IN ('QUEUED','RUNNING','COMPLETED','FAILED','CANCELLED','EXPIRED')",
        name="ck_replay_run_status",
    ),
    CheckConstraint(
        "queue_deadline > created_at "
        "AND (finished_at IS NULL OR finished_at >= created_at) AND "
        "(cancel_requested_at IS NULL OR cancel_requested_at >= created_at)",
        name="ck_replay_run_time",
    ),
    CheckConstraint(
        "(status = 'EXPIRED') = (expired_at IS NOT NULL) AND "
        "(expired_at IS NULL) = (purge_at IS NULL) AND "
        "(finished_at IS NULL) = (retention_deadline IS NULL) AND "
        "(status NOT IN ('QUEUED','RUNNING') OR finished_at IS NULL) AND "
        "(status NOT IN ('COMPLETED','FAILED','CANCELLED') OR finished_at IS NOT NULL) AND "
        "(retention_deadline IS NULL OR retention_deadline > finished_at) AND "
        "(purge_at IS NULL OR purge_at > expired_at)",
        name="ck_replay_run_deadlines",
    ),
    CheckConstraint(
        "(status IN ('FAILED','CANCELLED')) = (failure IS NOT NULL) AND "
        f"failure IN ({_FAILURES})",
        name="ck_replay_run_failure",
    ),
    CheckConstraint(
        "cancel_requested_at IS NULL OR status IN ('RUNNING','CANCELLED')",
        name="ck_replay_run_cancel",
    ),
)

Index(
    "ix_replay_owner_created",
    replay_runs.c.owner_id,
    replay_runs.c.created_at,
    replay_runs.c.id,
)
Index(
    "ix_replay_queue",
    replay_runs.c.created_at,
    replay_runs.c.id,
    postgresql_where=replay_runs.c.status == "QUEUED",
)
Index(
    "uq_replay_one_running",
    replay_runs.c.status,
    unique=True,
    postgresql_where=replay_runs.c.status == "RUNNING",
)
for _column in ("queue_deadline", "retention_deadline", "purge_at"):
    Index(f"ix_replay_{_column}", replay_runs.c[_column])

replay_attempts = Table(
    "replay_attempts",
    metadata,
    Column(
        "run_id",
        Uuid,
        ForeignKey("replay_runs.id", ondelete="CASCADE"),
        primary_key=True,
    ),
    Column("number", Integer, primary_key=True, autoincrement=False),
    Column("lease_token", Uuid, nullable=False, unique=True),
    Column("started_at", _TIME, nullable=False),
    Column("lease_deadline", _TIME, nullable=False),
    Column("ended_at", _TIME),
    Column("failure", String(30)),
    CheckConstraint("number BETWEEN 1 AND 2", name="ck_replay_attempt_number"),
    CheckConstraint(
        "lease_deadline > started_at AND (ended_at IS NULL OR ended_at >= started_at)",
        name="ck_replay_attempt_time",
    ),
    CheckConstraint(
        f"failure IS NULL OR (ended_at IS NOT NULL AND failure IN ({_FAILURES}))",
        name="ck_replay_attempt_failure",
    ),
)
Index(
    "ix_replay_active_lease",
    replay_attempts.c.lease_deadline,
    postgresql_where=replay_attempts.c.ended_at.is_(None),
)

replay_results = Table(
    "replay_results",
    metadata,
    Column("run_id", Uuid, primary_key=True),
    Column("attempt_number", Integer, nullable=False),
    Column("grade_schema_version", Integer, nullable=False),
    Column("executed_rule_id", String(80), nullable=False),
    Column("executed_sha256", _DIGEST, nullable=False),
    Column("grade_sha256", _DIGEST, nullable=False),
    Column("evidence_sha256", _DIGEST, nullable=False),
    Column("passed", Boolean, nullable=False),
    Column("grade_bytes", LargeBinary, nullable=False),
    Column("evidence_bytes", LargeBinary, nullable=False),
    ForeignKeyConstraint(
        ["run_id", "attempt_number"],
        ["replay_attempts.run_id", "replay_attempts.number"],
        ondelete="CASCADE",
        name="fk_replay_result_attempt",
    ),
    *_digest_checks("grade_sha256", "evidence_sha256", "executed_sha256"),
    CheckConstraint("grade_schema_version = 1", name="ck_replay_result_version"),
    CheckConstraint(
        "octet_length(grade_bytes) > 0 AND octet_length(evidence_bytes) > 0 AND "
        "octet_length(grade_bytes) + octet_length(evidence_bytes) <= 32768",
        name="ck_replay_result_size",
    ),
)

replay_execution_control = Table(
    "replay_execution_control",
    metadata,
    Column("id", Integer, primary_key=True, autoincrement=False),
    CheckConstraint("id = 1", name="ck_replay_control_singleton"),
)
