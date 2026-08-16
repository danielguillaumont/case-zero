from fastapi.testclient import TestClient

from app.main import app


client = TestClient(app)


def test_root_endpoint():
    response = client.get("/")

    assert response.status_code == 200

    data = response.json()

    assert data["name"] == "CASE//ZERO"
    assert (
        data["message"]
        == "Security Operations Platform API"
    )


def test_detection_rules_endpoint():
    response = client.get(
        "/api/rules"
    )

    assert response.status_code == 200

    rules = response.json()

    assert len(rules) == 3

    rule_ids = {
        rule["id"]
        for rule in rules
    }

    assert "encoded-powershell" in rule_ids

    assert (
        "powershell-download-cradle"
        in rule_ids
    )

    assert "auth-brute-force" in rule_ids


def test_encoded_powershell_rule_endpoint():
    response = client.get(
        "/api/rules/encoded-powershell"
    )

    assert response.status_code == 200

    rule = response.json()

    assert (
        rule["id"]
        == "encoded-powershell"
    )

    assert (
        rule["severity"]
        == "high"
    )

    assert (
        rule["rule_type"]
        == "single_event"
    )

    assert (
        rule["event_type"]
        == "process_creation"
    )

    assert (
        rule["mitre_attack"][0][
            "technique_id"
        ]
        == "T1059.001"
    )


def test_unknown_rule_returns_404():
    response = client.get(
        "/api/rules/not-a-real-rule"
    )

    assert response.status_code == 404


def test_playbooks_endpoint():
    response = client.get(
        "/api/playbooks"
    )

    assert response.status_code == 200

    playbooks = response.json()

    assert len(playbooks) == 3

    playbook_ids = {
        playbook["id"]
        for playbook in playbooks
    }

    assert (
        "encoded-powershell-investigation"
        in playbook_ids
    )

    assert (
        "powershell-download-cradle-response"
        in playbook_ids
    )

    assert (
        "account-compromise-investigation"
        in playbook_ids
    )


def test_rule_to_playbook_mapping():
    response = client.get(
        "/api/playbooks/rule/"
        "auth-brute-force"
    )

    assert response.status_code == 200

    playbooks = response.json()

    assert len(playbooks) == 1

    playbook = playbooks[0]

    assert (
        playbook["id"]
        == "account-compromise-investigation"
    )

    assert (
        "auth-brute-force"
        in playbook["trigger_rule_ids"]
    )


def test_playbook_detail_endpoint():
    response = client.get(
        "/api/playbooks/"
        "encoded-powershell-investigation"
    )

    assert response.status_code == 200

    playbook = response.json()

    assert (
        playbook["id"]
        == "encoded-powershell-investigation"
    )

    assert playbook["enabled"] is True

    assert len(
        playbook["steps"]
    ) == 6


def test_unknown_playbook_returns_404():
    response = client.get(
        "/api/playbooks/"
        "not-a-real-playbook"
    )

    assert response.status_code == 404