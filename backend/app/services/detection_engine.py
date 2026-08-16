import re
from datetime import timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.alert import Alert
from app.models.security_event import SecurityEvent


POWERSHELL_PROCESS_NAMES = {
    "powershell.exe",
    "powershell",
    "pwsh.exe",
    "pwsh",
}


ENCODED_POWERSHELL_PATTERN = re.compile(
    r"(?:^|\s)-(?:enc|encodedcommand)(?:\s|$)",
    re.IGNORECASE,
)


POWERSHELL_DOWNLOAD_INDICATORS = (
    "downloadstring(",
    "downloadfile(",
    "invoke-webrequest",
    "invoke-restmethod",
    "new-object net.webclient",
    "system.net.webclient",
    "start-bitstransfer",
)


BRUTE_FORCE_WINDOW_MINUTES = 5
BRUTE_FORCE_FAILURE_THRESHOLD = 5


DETECTION_RULES = {
    "encoded-powershell": {
        "id": "encoded-powershell",
        "name": "Encoded PowerShell Command",
        "description": (
            "Detects PowerShell process creation "
            "events that use encoded command "
            "execution."
        ),
        "severity": "high",
        "rule_type": "single_event",
        "enabled": True,
        "event_type": "process_creation",
        "logic": (
            "PowerShell or pwsh process with "
            "-enc or -encodedcommand in the "
            "command line"
        ),
    },
    "powershell-download-cradle": {
        "id": "powershell-download-cradle",
        "name": "PowerShell Download Cradle",
        "description": (
            "Detects PowerShell activity capable "
            "of retrieving remote content."
        ),
        "severity": "high",
        "rule_type": "single_event",
        "enabled": True,
        "event_type": "process_creation",
        "logic": (
            "PowerShell command line contains "
            "download or web retrieval indicators "
            "such as DownloadString, "
            "Invoke-WebRequest, or Net.WebClient"
        ),
    },
    "auth-brute-force": {
        "id": "auth-brute-force",
        "name": "Possible Brute Force Attack",
        "description": (
            "Detects repeated authentication "
            "failures involving the same username "
            "and source IP address."
        ),
        "severity": "high",
        "rule_type": "correlation",
        "enabled": True,
        "event_type": "authentication",
        "logic": (
            f"{BRUTE_FORCE_FAILURE_THRESHOLD} "
            "failed authentications from the same "
            "username and source IP within "
            f"{BRUTE_FORCE_WINDOW_MINUTES} minutes"
        ),
    },
}


def get_detection_rules() -> list[dict]:
    return list(
        DETECTION_RULES.values()
    )


def is_rule_enabled(
    rule_id: str,
) -> bool:
    rule = DETECTION_RULES.get(
        rule_id
    )

    if rule is None:
        return False

    return bool(
        rule["enabled"]
    )


async def evaluate_security_event(
    security_event: SecurityEvent,
    session: AsyncSession,
) -> list[Alert]:
    generated_alerts: list[Alert] = []

    if (
        is_rule_enabled(
            "encoded-powershell"
        )
        and matches_encoded_powershell(
            security_event
        )
    ):
        generated_alerts.append(
            create_encoded_powershell_alert(
                security_event
            )
        )

    if (
        is_rule_enabled(
            "powershell-download-cradle"
        )
        and matches_powershell_download_cradle(
            security_event
        )
    ):
        generated_alerts.append(
            create_powershell_download_cradle_alert(
                security_event
            )
        )

    if is_rule_enabled(
        "auth-brute-force"
    ):
        (
            brute_force_matched,
            failure_count,
        ) = (
            await matches_brute_force_authentication(
                security_event,
                session,
            )
        )

        if brute_force_matched:
            generated_alerts.append(
                create_brute_force_alert(
                    security_event,
                    failure_count,
                )
            )

    return generated_alerts


def is_powershell_process(
    security_event: SecurityEvent,
) -> bool:
    process_name = (
        security_event.process_name or ""
    )

    normalized_process_name = (
        process_name
        .replace("\\", "/")
        .rsplit("/", 1)[-1]
        .lower()
    )

    return (
        normalized_process_name
        in POWERSHELL_PROCESS_NAMES
    )


def is_process_creation_event(
    security_event: SecurityEvent,
) -> bool:
    return (
        security_event.event_type.lower()
        == "process_creation"
    )


def is_authentication_failure(
    security_event: SecurityEvent,
) -> bool:
    if (
        security_event.event_type.lower()
        != "authentication"
    ):
        return False

    raw_data = (
        security_event.raw_data or {}
    )

    outcome = str(
        raw_data.get(
            "outcome",
            "",
        )
    ).lower()

    return outcome in {
        "failure",
        "failed",
        "denied",
        "invalid",
    }


def matches_encoded_powershell(
    security_event: SecurityEvent,
) -> bool:
    if not is_process_creation_event(
        security_event
    ):
        return False

    if not is_powershell_process(
        security_event
    ):
        return False

    command_line = (
        security_event.command_line or ""
    )

    return bool(
        ENCODED_POWERSHELL_PATTERN.search(
            command_line
        )
    )


def matches_powershell_download_cradle(
    security_event: SecurityEvent,
) -> bool:
    if not is_process_creation_event(
        security_event
    ):
        return False

    if not is_powershell_process(
        security_event
    ):
        return False

    command_line = (
        security_event.command_line or ""
    ).lower()

    return any(
        indicator in command_line
        for indicator
        in POWERSHELL_DOWNLOAD_INDICATORS
    )


async def matches_brute_force_authentication(
    security_event: SecurityEvent,
    session: AsyncSession,
) -> tuple[bool, int]:
    if not is_authentication_failure(
        security_event
    ):
        return False, 0

    if not security_event.username:
        return False, 0

    if not security_event.source_ip:
        return False, 0

    window_start = (
        security_event.event_time
        - timedelta(
            minutes=BRUTE_FORCE_WINDOW_MINUTES
        )
    )

    result = await session.execute(
        select(SecurityEvent)
        .where(
            func.lower(
                SecurityEvent.event_type
            )
            == "authentication",
            SecurityEvent.username
            == security_event.username,
            SecurityEvent.source_ip
            == security_event.source_ip,
            SecurityEvent.event_time
            >= window_start,
            SecurityEvent.event_time
            <= security_event.event_time,
        )
        .order_by(
            SecurityEvent.event_time.asc()
        )
    )

    recent_events = (
        result.scalars().all()
    )

    failure_events = [
        event
        for event in recent_events
        if is_authentication_failure(
            event
        )
    ]

    failure_count = len(
        failure_events
    )

    return (
        failure_count
        == BRUTE_FORCE_FAILURE_THRESHOLD,
        failure_count,
    )


def create_encoded_powershell_alert(
    security_event: SecurityEvent,
) -> Alert:
    hostname = (
        security_event.hostname
        or "unknown host"
    )

    username = (
        security_event.username
        or "unknown user"
    )

    command_line = (
        security_event.command_line
        or "Command line unavailable."
    )

    return Alert(
        title=(
            "Encoded PowerShell Command Detected"
        ),
        description=(
            "CASE//ZERO detected an encoded "
            "PowerShell command. "
            f"Host: {hostname}. "
            f"User: {username}. "
            "Security Event ID: "
            f"{security_event.id}. "
            f"Command Line: {command_line}"
        ),
        severity="high",
        status="new",
        source="detection-engine",
        detection_rule_id="encoded-powershell",
        source_event_id=security_event.id,
    )


def create_powershell_download_cradle_alert(
    security_event: SecurityEvent,
) -> Alert:
    hostname = (
        security_event.hostname
        or "unknown host"
    )

    username = (
        security_event.username
        or "unknown user"
    )

    command_line = (
        security_event.command_line
        or "Command line unavailable."
    )

    return Alert(
        title=(
            "PowerShell Download Cradle Detected"
        ),
        description=(
            "CASE//ZERO detected PowerShell "
            "activity capable of retrieving "
            "remote content. "
            f"Host: {hostname}. "
            f"User: {username}. "
            "Security Event ID: "
            f"{security_event.id}. "
            f"Command Line: {command_line}"
        ),
        severity="high",
        status="new",
        source="detection-engine",
        detection_rule_id=(
            "powershell-download-cradle"
        ),
        source_event_id=security_event.id,
    )


def create_brute_force_alert(
    security_event: SecurityEvent,
    failure_count: int,
) -> Alert:
    hostname = (
        security_event.hostname
        or "unknown host"
    )

    username = (
        security_event.username
        or "unknown user"
    )

    source_ip = (
        security_event.source_ip
        or "unknown source IP"
    )

    return Alert(
        title="Possible Brute Force Attack",
        description=(
            "CASE//ZERO correlated repeated "
            "authentication failures. "
            f"{failure_count} failed authentication "
            "attempts were observed within "
            f"{BRUTE_FORCE_WINDOW_MINUTES} minutes "
            f"for user {username} "
            f"from source IP {source_ip}. "
            f"Host: {hostname}. "
            "Triggering Security Event ID: "
            f"{security_event.id}."
        ),
        severity="high",
        status="new",
        source="detection-engine",
        detection_rule_id="auth-brute-force",
        source_event_id=security_event.id,
    )