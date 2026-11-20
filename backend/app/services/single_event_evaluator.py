import re


POWERSHELL_PROCESS_NAMES = frozenset({
    "powershell.exe",
    "powershell",
    "pwsh.exe",
    "pwsh",
})

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


def _is_powershell_creation(event_type: str, process_name: str | None) -> bool:
    if event_type.lower() != "process_creation":
        return False

    basename = (process_name or "").replace("\\", "/").rsplit("/", 1)[-1].lower()
    return basename in POWERSHELL_PROCESS_NAMES


def matches_encoded_powershell(
    event_type: str, process_name: str | None, command_line: str | None
) -> bool:
    return _is_powershell_creation(event_type, process_name) and bool(
        ENCODED_POWERSHELL_PATTERN.search(command_line or "")
    )


def matches_powershell_download_cradle(
    event_type: str, process_name: str | None, command_line: str | None
) -> bool:
    if not _is_powershell_creation(event_type, process_name):
        return False

    normalized_command = (command_line or "").lower()
    return any(indicator in normalized_command for indicator in POWERSHELL_DOWNLOAD_INDICATORS)
