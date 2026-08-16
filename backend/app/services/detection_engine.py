import re

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

    if matches_powershell_download_cradle(
        security_event
    ):
        generated_alerts.append(
            create_powershell_download_cradle_alert(
                security_event
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
        source_event_id=security_event.id,
    )