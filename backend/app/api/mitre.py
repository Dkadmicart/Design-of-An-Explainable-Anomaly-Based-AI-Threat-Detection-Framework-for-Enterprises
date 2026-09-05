"""MITRE ATT&CK API routes."""
from fastapi import APIRouter

router = APIRouter()

STANDARD_MITRE_TECHNIQUES = [
    {
        "id": "T1498",
        "tactic": "Impact",
        "name": "Network Denial of Service",
        "description": "Adversaries may perform Network Denial of Service (DoS) attacks to degrade or disrupt the availability of targeted resources.",
        "url": "https://attack.mitre.org/techniques/T1498/",
        "attack_types": ["DDoS", "DoS"],
        "detection_count": 0,
    },
    {
        "id": "T1595",
        "tactic": "Reconnaissance",
        "name": "Active Scanning",
        "description": "Adversaries may execute active reconnaissance scans to gather information that can be used to target victim networks.",
        "url": "https://attack.mitre.org/techniques/T1595/",
        "attack_types": ["PortScan"],
        "detection_count": 0,
    },
    {
        "id": "T1110",
        "tactic": "Credential Access",
        "name": "Brute Force",
        "description": "Adversaries may use brute force techniques to gain access to target accounts or network interfaces.",
        "url": "https://attack.mitre.org/techniques/T1110/",
        "attack_types": ["Brute Force"],
        "detection_count": 0,
    },
    {
        "id": "T1190",
        "tactic": "Initial Access",
        "name": "Exploit Public-Facing Application",
        "description": "Adversaries may attempt to exploit software vulnerabilities in public-facing web servers or APIs.",
        "url": "https://attack.mitre.org/techniques/T1190/",
        "attack_types": ["Web Attack"],
        "detection_count": 0,
    },
    {
        "id": "T1071",
        "tactic": "Command and Control",
        "name": "Application Layer Protocol",
        "description": "Adversaries may communicate using application layer protocols to avoid detection by security controls.",
        "url": "https://attack.mitre.org/techniques/T1071/",
        "attack_types": ["Botnet"],
        "detection_count": 0,
    },
    {
        "id": "T1020",
        "tactic": "Exfiltration",
        "name": "Automated Exfiltration",
        "description": "Adversaries may leverage automated mechanisms to exfiltrate data from compromised internal infrastructure.",
        "url": "https://attack.mitre.org/techniques/T1020/",
        "attack_types": ["Infiltration"],
        "detection_count": 0,
    },
]


@router.get("/techniques")
async def list_techniques():
    """List all MITRE ATT&CK techniques with detection mapping."""
    return {"techniques": STANDARD_MITRE_TECHNIQUES}


@router.get("/techniques/{technique_id}")
async def get_technique(technique_id: str):
    """Get technique details and related detections."""
    tech = next((t for t in STANDARD_MITRE_TECHNIQUES if t["id"].lower() == technique_id.lower()), None)
    return {"technique": tech}
