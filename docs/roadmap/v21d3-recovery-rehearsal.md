# v2.1-D3 disposable recovery rehearsal

Startup, migration, backup, restore, and teardown require separate approval
before executing the corresponding phase.
The earlier recovery decisions and production gates still apply.
[Recovery and replay safety decisions](v21d-recovery-and-replay-safety.md)

## Targets and preflight

Run from the CASE//ZERO root on branch test/v21d3-recovery-rehearsal using
Windows PowerShell 5.1, local Docker Desktop in Linux mode, and an existing
backend Python 3.12 virtual environment with the repository dependencies.
Use a fresh shell without Docker, Compose, libpq, or application database
overrides. Review the working tree and reserve both ports and the project for
this rehearsal. Keep other clients away from the two endpoints during the run.

| Service | Windows binding | Database | Fixture role |
|---|---|---|---|
| postgres-source | 127.0.0.1:55433 | casezero_test | recovery_source |
| postgres-restore | 127.0.0.1:55434 | casezero_test | recovery_restore |

Both PostgreSQL 18 services belong to case-zero-v21d3-recovery. Each has a
separate 512 MiB tmpfs, health check, restart disabled, and fixture-only
credentials. The script uses the comment-only Compose env file explicitly.
It validates the rendered project, ports and reserved ranges, labels, cluster
image and health, network membership, and mount isolation. It verifies that
Windows and the selected container reach the same authenticated PostgreSQL
cluster and that the two clusters differ. The Windows check uses explicit
application test mode. Execution and cleanup compare development container IDs,
mount metadata, and matching volume names before and after a successful phase.
This comparison establishes metadata continuity only.
[Compose configuration](../../compose.recovery.yaml) · [Rehearsal script](../../scripts/recovery/Invoke-RecoveryRehearsal.ps1)

## Read-only preflight

After separate approval, run `.\scripts\recovery\Invoke-RecoveryRehearsal.ps1 -Phase Preflight -Approved`.
This phase returns before startup or any database or artifact operation. It
checks the local Linux engine, installed Compose version, empty project
inventory, and the Windows listener and excluded-port lists. It also checks
the rendered project and services, literal fixture environment, loopback
port tuples, health commands, restart policy, bounded tmpfs entries, and
exclusive default-network declaration. Compare the recorded Compose version
with the reviewed runtime version. If rendering differs and the guard stops,
review that version's representation before changing validation.

## Approved execution

After approval for each step, run the corresponding command in order.
Fresh and UpgradeAndRestore each start a new project and require both
databases to be empty. After the guarded startup, save the reported path to
`resources.json`. Cleanup requires that manifest from the same local engine.
It rechecks exact container and network IDs, labels, health, ports, network
membership and mounts, then stops and removes only the two recorded container
IDs and removes the recorded network ID. This discards both tmpfs databases.
The script never invokes cleanup after a failure.

| Step | PowerShell command | Expected evidence |
|---|---|---|
| 1. Fresh | `.\scripts\recovery\Invoke-RecoveryRehearsal.ps1 -Phase Fresh -Approved` | Source reaches e6ab1b3d315d, a second upgrade succeeds at the same revision, and the four operational foreign keys are present. |
| 2. Clean up | `.\scripts\recovery\Invoke-RecoveryRehearsal.ps1 -Phase Cleanup -Approved -Manifest $freshManifest` | Set `$freshManifest` to the path printed by Fresh. Disposable containers and network are gone. Review that both ports are released. |
| 3. Upgrade and restore | `.\scripts\recovery\Invoke-RecoveryRehearsal.ps1 -Phase UpgradeAndRestore -Approved` | Source starts at 67c33445e501 with one linked synthetic event, alert, case, note, and activity. Upgrade preserves them at e6ab1b3d315d. The restored target matches the revision, row counts, fixed UUIDs, selected values, links, and validated FK delete actions. |
| 4. Clean up | `.\scripts\recovery\Invoke-RecoveryRehearsal.ps1 -Phase Cleanup -Approved -Manifest $upgradeManifest` | Set `$upgradeManifest` to the path printed by UpgradeAndRestore. Verify the same cleanup evidence as step 2. Dispose of the exact rehearsal artifacts under separate approval after review. |

The prior revision introduces users after all five fixture tables and links
exist and leaves the login-throttle and security-audit revisions to apply.
The script upgrades a fresh target directly to that prior revision and pins
the reviewed head explicitly. It runs no downgrades.
[Migration sources](../../backend/alembic/versions)

Before backup the script checks the head's table, index and constraint
inventories, the five fixture links and values, one Alembic revision row,
and zero rows in users, threat indicators, login throttles and audit events.
It rejects unrelated namespaces, routines, triggers and extensions and scopes
the dump to the ten expected tables. Keep both endpoints exclusive throughout
the drill. The checks and dump run in separate connections.

Python connects Docker's binary streams directly to a new custom-format
`.partial` file in a verified local temp directory outside the worktree.
The script checks byte length and reads the archive's table of contents before
publishing the final filename. It records SHA-256 and rechecks size and digest
before restore. Treat any remaining `.partial` file as incomplete.
Restore uses a single transaction, exits on error, and omits source ownership
and grants. The restore and its assertions provide the content verification.
Record the archive path, size and digest, branch and HEAD, tool and image
versions, elapsed times, revision and assertion output, and exit status.

## Local verification — November 20, 2026

Reported on Windows PowerShell 5.1, Docker Desktop Linux, Docker Compose
5.5.1, and two disposable PostgreSQL 18 instances:

| Check | Observed result |
|---|---|
| Read-only Preflight | Passed. |
| Fresh and repeat upgrade | The empty source reached `e6ab1b3d315d`; repeating the upgrade passed at the same revision. |
| Upgrade and restore | The upgrade from `67c33445e501` to `e6ab1b3d315d` preserved the synthetic event, alert, case, note, and activity. The custom-format archive restored into the independent empty target. Restored revision, row counts, IDs, relationships, foreign keys, and the head relation inventory for all ten tables passed verification. |
| Both cleanup phases | Each used its own run's manifest. Both passed, and the final recovery container and network inventory was empty. Development container and volume metadata matched preflight. |

The reported archive was `synthetic.dump`, **23,327 bytes**, with SHA-256
`4E45DAFAF57ABBCE97AC661353EA24FA4965402E2001EAE9DEFD0782B14DBDDD`.
The archive and both resource manifests remain in Windows temporary storage
outside the repository. Keep those artifacts out of Git.

Docker emitted lifecycle diagnostics and Alembic emitted diagnostics. The
displayed evidence did not capture their underlying text, so their causes
remain unknown. Subsequent identity, revision, content, and cleanup checks
passed. This rehearsal establishes synthetic local recovery evidence.
Production backup availability, restoration authority, retention, and
rollback readiness remain outstanding.

## Failure handling and limits

Stop on any failed check or nonzero operation. Preserve the stage error and
inspect only the recovery project's metadata under separate approval. Use
`docker --context <verified-context> ps -a --no-trunc --filter label=com.docker.compose.project=case-zero-v21d3-recovery`
and the equivalent project-label filter on `docker network ls`. Inspect
only the resulting IDs using formatted queries for labels, mounts, published
ports and network membership. Avoid full container inspection output, which
includes environment values. If startup failed before manifest creation,
or the inventory differs, leave the resources for review. Any later targeted
removal requires separate approval and independently established IDs.
Capture development metadata separately after a failed phase if safe.
The script reports failure stages and exit codes while withholding raw
diagnostic text that could contain connection or SQL details.

This tooling reports migration, backup, and restore failures and leaves the
targets available for inspection. Deliberate migration-failure injection and
previous-application compatibility remain separate rehearsal cases. They
require an approved fault method and a selected previous app revision.
Application rollback leaves the database revision in place. The local archive
omits role grants and does not establish production backup retention,
restore authority, or recovery objectives.
