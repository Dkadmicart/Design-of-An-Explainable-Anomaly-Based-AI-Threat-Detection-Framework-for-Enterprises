"""MITRE ATT&CK API routes."""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from app.database.session import get_db
from app.models.database import Alert

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
async def list_techniques(db: AsyncSession = Depends(get_db)):
    """
    List all MITRE ATT&CK techniques with actual database detection counts and evidence mapping.
    Ensures technique counts are computed from verified database records rather than mock data.
    """
    # 1. Query database for actual persisted alerts with MITRE techniques
    technique_counts_query = (
        select(Alert.mitre_technique_id, func.count(Alert.id))
        .where(Alert.mitre_technique_id.isnot(None))
        .group_by(Alert.mitre_technique_id)
    )
    counts_res = await db.execute(technique_counts_query)
    technique_counts = dict(counts_res.all())

    # 2. Query total alerts and unmapped alerts count
    total_alerts_res = await db.execute(select(func.count(Alert.id)))
    total_alerts = total_alerts_res.scalar() or 0

    unmapped_res = await db.execute(
        select(func.count(Alert.id)).where(Alert.mitre_technique_id.is_(None))
    )
    unmapped_alerts = unmapped_res.scalar() or 0
    mapped_alerts = total_alerts - unmapped_alerts

    # 3. Build response with real counts from database
    techniques = []
    for t in STANDARD_MITRE_TECHNIQUES:
        t_copy = dict(t)
        t_copy["detection_count"] = technique_counts.get(t["id"], 0)
        techniques.append(t_copy)

    return {
        "techniques": techniques,
        "summary": {
            "total_alerts": total_alerts,
            "mapped_alerts": mapped_alerts,
            "unmapped_alerts": unmapped_alerts,
            "classification_scope": "Binary Anomaly Detection (BENIGN vs ATTACK)",
            "evidence_note": (
                "The XGBoost model performs binary classification (BENIGN vs ATTACK). "
                "Technique attribution is assigned only when supported by verified multi-class "
                "dataset ground-truth or packet payload evidence. Flow anomaly alerts without "
                "such evidence remain Unmapped."
            ),
        },
    }


@router.get("/techniques/{technique_id}")
async def get_technique(technique_id: str, db: AsyncSession = Depends(get_db)):
    """Get technique details and real database detection count."""
    tech = next((t for t in STANDARD_MITRE_TECHNIQUES if t["id"].lower() == technique_id.lower()), None)
    if not tech:
        return {"technique": None}

    res = await db.execute(
        select(func.count(Alert.id)).where(Alert.mitre_technique_id == tech["id"])
    )
    count = res.scalar() or 0
    t_copy = dict(tech)
    t_copy["detection_count"] = count
    return {"technique": t_copy}
