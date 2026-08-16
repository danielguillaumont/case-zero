import re

from app.models.alert import Alert
from app.models.security_event import SecurityEvent


ENCODED_POWERSHELL_PATTERN = re.compile(
    r"(?:^|\s)-(?:enc|encodedcommand)(?:\s|$)",
    re.IGNORECASE,
)


def evaluate_security_event(
    security_event: SecurityEvent,
) -> list[Alert]:
    generated_alerts: list[Alert] = []

    if matches_encoded_powershell(
        security_event
    ):
        generated_alerts.append(
            create_encoded_powershell_alert(
                security_event
            )
        )

    return generated_alerts


def matches_encoded_powershell(
    security_event: SecurityEvent,
) -> bool:
    if (
        security_event.event_type.lower()
        != "process_creation"
    ):
        return False

    process_name = (
        security_event.process_name or ""
    )

    normalized_process_name = (
        process_name
        .replace("\\", "/")
        .rsplit("/", 1)[-1]
        .lower()
    )

    if normalized_process_name not in {
        "powershell.exe",
        "powershell",
        "pwsh.exe",
        "pwsh",
    }:
        return False

    command_line = (
        security_event.command_line or ""
    )

    return bool(
        ENCODED_POWERSHELL_PATTERN.search(
            command_line
        )
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
    )