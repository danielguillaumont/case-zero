import pytest

from app.services.single_event_evaluator import (
    matches_encoded_powershell,
    matches_powershell_download_cradle,
)


@pytest.mark.parametrize(
    ("event_type", "process_name", "command_line", "expected"),
    [
        ("process_creation", "powershell.exe", "powershell.exe -enc TEST", (True, False)),
        ("process_creation", "pwsh", "-EncodedCommand", (True, False)),
        ("process_creation", "powershell.exe", "Get-Service", (False, False)),
        ("process_creation", "powershell.exe", "DownloadString(", (False, True)),
        ("PROCESS_CREATION", r"C:\Tools\PwSh.ExE", "pwsh\t-ENC\tTEST", (True, False)),
        ("process_creation", "/tools/PWSH", "-enc TEST Invoke-WebRequest", (True, True)),
        ("process_creation", "pwsh", "prefix-enc TEST -encodedcommand:TEST", (False, False)),
        ("process_creation", "pwsh", "-encTEST DownloadString (", (False, False)),
        ("process_creation", "pwsh", "prefixInvoke-WebRequestSuffix", (False, True)),
        ("process_creation", "cmd.exe", "-enc TEST Invoke-WebRequest", (False, False)),
        ("process_creation", "pwsh ", "-enc TEST Invoke-WebRequest", (False, False)),
        ("process_creation ", "pwsh", "-enc TEST Invoke-WebRequest", (False, False)),
        ("authentication", "pwsh", "-enc TEST Invoke-WebRequest", (False, False)),
        ("", "pwsh", "-enc TEST Invoke-WebRequest", (False, False)),
        ("process_creation", None, "-enc TEST Invoke-WebRequest", (False, False)),
        ("process_creation", "", "-enc TEST Invoke-WebRequest", (False, False)),
        ("process_creation", "pwsh", None, (False, False)),
        ("process_creation", "pwsh", "", (False, False)),
    ],
)
def test_single_event_predicates_use_only_event_fields(
    event_type, process_name, command_line, expected,
):
    fields = (event_type, process_name, command_line)
    for _ in range(2):
        assert (
            matches_encoded_powershell(*fields),
            matches_powershell_download_cradle(*fields),
        ) == expected
