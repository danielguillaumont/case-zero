PLAYBOOKS = [
    {
        "id": "encoded-powershell-investigation",
        "name": "Encoded PowerShell Investigation",
        "description": (
            "Investigate PowerShell activity using encoded "
            "command execution and determine whether the "
            "behavior is malicious or authorized."
        ),
        "severity": "high",
        "enabled": True,
        "trigger_rule_ids": [
            "encoded-powershell",
        ],
        "steps": [
            {
                "id": "validate-powershell-event",
                "order": 1,
                "title": "Validate PowerShell Evidence",
                "description": (
                    "Review the triggering security event, "
                    "process name, command line, hostname, "
                    "username, and event timestamp."
                ),
                "category": "triage",
            },
            {
                "id": "decode-command-content",
                "order": 2,
                "title": "Review Encoded Command Content",
                "description": (
                    "Inspect the encoded PowerShell command "
                    "and determine what the decoded script or "
                    "command is intended to execute."
                ),
                "category": "investigation",
            },
            {
                "id": "hunt-related-powershell",
                "order": 3,
                "title": "Hunt for Related PowerShell Activity",
                "description": (
                    "Search CASE//ZERO telemetry for additional "
                    "PowerShell activity involving the same "
                    "host, user, or suspicious command content."
                ),
                "category": "investigation",
            },
            {
                "id": "scope-host-activity",
                "order": 4,
                "title": "Scope Affected Host Activity",
                "description": (
                    "Review related endpoint telemetry to "
                    "determine whether additional suspicious "
                    "processes or activity occurred on the host."
                ),
                "category": "investigation",
            },
            {
                "id": "contain-endpoint-if-needed",
                "order": 5,
                "title": "Contain Endpoint if Malicious",
                "description": (
                    "If malicious execution is confirmed, "
                    "isolate or otherwise contain the affected "
                    "endpoint according to organizational "
                    "response procedures."
                ),
                "category": "containment",
            },
            {
                "id": "document-powershell-findings",
                "order": 6,
                "title": "Document Investigation Findings",
                "description": (
                    "Record the investigation outcome, evidence, "
                    "scope, analyst actions, and remediation "
                    "decisions in the investigation case."
                ),
                "category": "documentation",
            },
        ],
    },
    {
        "id": "powershell-download-cradle-response",
        "name": "PowerShell Download Cradle Response",
        "description": (
            "Investigate PowerShell activity capable of "
            "retrieving remote content and determine whether "
            "payload delivery or malicious script execution "
            "occurred."
        ),
        "severity": "high",
        "enabled": True,
        "trigger_rule_ids": [
            "powershell-download-cradle",
        ],
        "steps": [
            {
                "id": "validate-download-command",
                "order": 1,
                "title": "Validate Download Command",
                "description": (
                    "Review the triggering PowerShell command "
                    "and identify the download mechanism, URL, "
                    "hostname, user, and execution context."
                ),
                "category": "triage",
            },
            {
                "id": "identify-remote-resource",
                "order": 2,
                "title": "Identify Remote Resource",
                "description": (
                    "Determine the remote domain, URL, or other "
                    "resource referenced by the PowerShell "
                    "download activity."
                ),
                "category": "investigation",
            },
            {
                "id": "hunt-download-indicators",
                "order": 3,
                "title": "Hunt for Download Indicators",
                "description": (
                    "Search CASE//ZERO telemetry for the same "
                    "URL, domain, command fragment, user, or "
                    "host to identify related activity."
                ),
                "category": "investigation",
            },
            {
                "id": "scope-payload-execution",
                "order": 4,
                "title": "Scope Payload Execution",
                "description": (
                    "Determine whether downloaded content was "
                    "executed and identify additional processes, "
                    "hosts, or accounts involved."
                ),
                "category": "investigation",
            },
            {
                "id": "contain-download-activity",
                "order": 5,
                "title": "Contain Malicious Activity",
                "description": (
                    "If malicious delivery or execution is "
                    "confirmed, contain affected endpoints and "
                    "block identified malicious infrastructure "
                    "using the appropriate security controls."
                ),
                "category": "containment",
            },
            {
                "id": "document-download-findings",
                "order": 6,
                "title": "Document Investigation Findings",
                "description": (
                    "Record indicators, affected assets, "
                    "analyst findings, containment actions, and "
                    "the final investigation outcome."
                ),
                "category": "documentation",
            },
        ],
    },
    {
        "id": "account-compromise-investigation",
        "name": "Account Compromise Investigation",
        "description": (
            "Investigate repeated authentication failures for "
            "signs of brute-force activity, credential abuse, "
            "or account compromise."
        ),
        "severity": "high",
        "enabled": True,
        "trigger_rule_ids": [
            "auth-brute-force",
        ],
        "steps": [
            {
                "id": "validate-authentication-failures",
                "order": 1,
                "title": "Validate Authentication Failures",
                "description": (
                    "Review the correlated authentication "
                    "events and confirm the username, source IP, "
                    "hostname, timestamps, and failure pattern."
                ),
                "category": "triage",
            },
            {
                "id": "review-source-ip",
                "order": 2,
                "title": "Review Source IP Activity",
                "description": (
                    "Search for additional activity associated "
                    "with the source IP and determine whether "
                    "other accounts or systems were targeted."
                ),
                "category": "investigation",
            },
            {
                "id": "hunt-successful-authentication",
                "order": 3,
                "title": "Hunt for Successful Authentication",
                "description": (
                    "Search telemetry for successful logons or "
                    "other authentication activity involving "
                    "the targeted account after the failures."
                ),
                "category": "investigation",
            },
            {
                "id": "scope-account-activity",
                "order": 4,
                "title": "Scope Account Activity",
                "description": (
                    "Review related user, host, and source IP "
                    "activity to determine whether credentials "
                    "were successfully abused."
                ),
                "category": "investigation",
            },
            {
                "id": "contain-compromised-account",
                "order": 5,
                "title": "Contain Compromised Credentials",
                "description": (
                    "If account compromise is suspected or "
                    "confirmed, disable or restrict the account, "
                    "reset credentials, revoke active sessions, "
                    "and apply additional controls as required."
                ),
                "category": "containment",
            },
            {
                "id": "document-account-findings",
                "order": 6,
                "title": "Document Investigation Findings",
                "description": (
                    "Record the authentication pattern, "
                    "affected account, source infrastructure, "
                    "scope, containment actions, and final "
                    "assessment in the investigation case."
                ),
                "category": "documentation",
            },
        ],
    },
]


def get_playbooks() -> list[dict]:
    return PLAYBOOKS


def get_playbook(
    playbook_id: str,
) -> dict | None:
    return next(
        (
            playbook
            for playbook in PLAYBOOKS
            if playbook["id"]
            == playbook_id
        ),
        None,
    )


def get_playbooks_for_rule(
    rule_id: str,
) -> list[dict]:
    return [
        playbook
        for playbook in PLAYBOOKS
        if (
            playbook["enabled"]
            and rule_id
            in playbook[
                "trigger_rule_ids"
            ]
        )
    ]