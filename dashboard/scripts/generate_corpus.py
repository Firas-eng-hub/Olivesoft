"""Generate the synthetic knowledge corpus fixtures for RAG ingestion.

Reads data/synthetic_data.json (untouched source of truth) and emits
versioned, extraction-friendly documents plus benchmark labels into
fixtures/corpus/.

- Formats: PDF (dominant) with TXT and DOCX samples, mirroring the three
  parsers of the n8n knowledge_ingestion workflow.
- Languages: French dominant with an English subset (10 documents) to prove
  cross-lingual retrieval.
- Versions: three v2 variants (C02, P04, STK-01) for the re-indexation test
  (same document ID, new version: obsolete chunks must be replaced).
- Labels: labelled FR/EN queries (10 positive + 3 no-match) and a per-tender
  expected match matrix for validating the matching workflow.

Deterministic: same input produces identical output bytes.
Uses only the Python standard library, like generate_demo_artifacts.py.
"""

from __future__ import annotations

import hashlib
import json
import re
import textwrap
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "data" / "synthetic_data.json"
OUT = REPO / "fixtures" / "corpus"

# ---------------------------------------------------------------------------
# Language and format maps (deterministic)
# ---------------------------------------------------------------------------

EN_CVS = {"C04", "C07", "C08", "C11", "C14", "C17"}
EN_PROJECTS = {"P04", "P10", "P13", "P14"}
TXT_CVS = {"C05", "C12", "C14", "C16"}
DOCX_CVS = {"C09", "C13", "C17"}
TXT_PROJECTS = {"P06", "P13"}
DOCX_PROJECTS = {"P03", "P14"}

SENIORITY_EN = {"senior": "senior", "confirmé": "confirmed", "junior": "junior"}

# ---------------------------------------------------------------------------
# English translations (hand-written overlay; product names stay unchanged)
# ---------------------------------------------------------------------------

EN_TRANSLATIONS = {
    "C04": {
        "titre": "Generative AI data scientist",
        "resume": "Data scientist specializing in NLP and generative AI; ships production RAG assistants with systematic evaluation and guardrails, from prototype to deployment.",
        "competences": ["Python", "NLP", "Generative AI", "LangChain", "RAG", "Vector DB", "FastAPI", "Docker", "Prompt engineering", "LLM evaluation"],
        "formation": "MSc in data science - public university (France)",
        "langues": "French (native), English (fluent)",
        "projets": {"P04": "NLP data scientist", "P15": "Generative AI lead"},
    },
    "C07": {
        "titre": "Senior BI / analytics consultant",
        "resume": "Senior BI consultant leading analytical governance programs: KPI definition, Tableau and Qlik Sense self-service rollout for multi-site networks.",
        "competences": ["Tableau", "Qlik Sense", "Looker Studio", "SQL", "Data modeling", "KPI definition", "Data governance", "User rollout"],
        "formation": "MSc in applied statistics - public university (France)",
        "langues": "French (native), English (fluent)",
        "projets": {"P13": "BI lead", "P06": "KPI & governance expert"},
    },
    "C08": {
        "titre": "GCP data engineer",
        "resume": "Data engineer focused on the Google Cloud ecosystem: BigQuery pipelines, Airflow orchestration and dbt transformations serving CRM and marketing use cases.",
        "competences": ["Google Cloud Platform", "BigQuery", "dbt", "Airflow", "Dataflow", "Python", "SQL", "Kafka", "Git"],
        "formation": "Computer engineering degree - public university (France)",
        "langues": "French (native), English (fluent)",
        "projets": {"P01": "Data engineer", "P10": "Streaming data engineer"},
    },
    "C11": {
        "titre": "Junior integration developer",
        "resume": "Junior developer working on n8n automations, API connectors and Python data migration scripts, with a strong focus on flow reliability.",
        "competences": ["n8n", "Python", "REST APIs", "JSON", "PostgreSQL", "Git", "Flow testing"],
        "formation": "BSc in computer science - public university (Tunisia)",
        "langues": "Arabic (native), French (fluent), English (intermediate)",
        "projets": {"P07": "n8n automation developer", "P15": "Document ingestion developer"},
    },
    "C14": {
        "titre": "Junior machine learning engineer",
        "resume": "Junior ML engineer industrializing NLP models (scoring APIs, inference batches) and setting up experiment and performance tracking.",
        "competences": ["Python", "Scikit-learn", "Transformers", "NLP", "MLflow", "Azure", "Docker", "API REST"],
        "formation": "MSc in artificial intelligence - public university (France)",
        "langues": "French (native), English (fluent)",
        "projets": {"P12": "ML engineer", "P04": "AI pipeline developer"},
    },
    "C17": {
        "titre": "Data & enterprise systems architect",
        "resume": "Data and information systems architect; defines cloud target architectures, governance and integration standards for demanding multi-business groups.",
        "competences": ["Data architecture", "TOGAF", "Snowflake", "Google Cloud Platform", "Azure", "MuleSoft", "Kafka", "Data governance", "Data security", "Enterprise architecture planning"],
        "formation": "General engineering degree - public university (France)",
        "langues": "French (native), English (fluent)",
        "projets": {"P10": "Solution architect", "P14": "SI architect", "P05": "Data warehouse architect"},
    },
    "P04": {
        "titre": "AI-assisted intellectual property registration platform",
        "description": "End-to-end trademark and patent filing platform: a conversational chatbot guiding applicants, and a smart crawler detecting similar entries to prevent duplicates and strengthen filing originality.",
        "resultat_chiffre": "-45% processing time per filing, 87% of applicant questions resolved without an agent, zero duplicates detected after go-live",
    },
    "P10": {
        "titre": "Real-time cloud data platform for a telecom operator",
        "description": "Scalable data platform architecture: Kafka/Dataflow streaming ingestion of network and CRM events, Databricks lakehouse for ML, Airflow orchestration, data catalog and access governance.",
        "resultat_chiffre": "2 TB/day ingested in streaming, analytics latency cut from 24 h to 5 min, foundation for 3 production ML use cases",
    },
    "P13": {
        "titre": "Self-service reporting for a franchise network",
        "description": "Semantic layer and Looker Studio dashboards for franchisees: sales, traffic and average-basket KPIs with cross-store comparison, security and per-franchise isolation.",
        "resultat_chiffre": "150 franchisees connected in 3 months, 100% reporting autonomy, monthly closing accelerated by 4 days",
    },
    "P14": {
        "titre": "API layer and SI integration for an infrastructure operator",
        "description": "MuleSoft API layer exposing operational systems (maintenance, sensors, GIS) to decision applications, with supervision, OAuth2 security and API contract management.",
        "resultat_chiffre": "40 APIs published, 70% connector reuse, predictive maintenance deployed across 3,000 km of infrastructure",
    },
}

# ---------------------------------------------------------------------------
# Capability stacks (generated; not present in synthetic_data.json)
# ---------------------------------------------------------------------------

STACKS = [
    {
        "id": "STK-01",
        "language": "fr",
        "name": "Intégration de données & API",
        "domain": "integration",
        "purpose": "Stack de référence OliveSoft pour l'intégration applicative et la donnée : ETL/ELT industriel, exposition d'API contract-first et automatisation interne.",
        "components": ["Talend Data Integration", "MuleSoft Anypoint Platform (design, gateway, API manager)", "Boomi", "Workato", "n8n", "Apache Kafka", "PostgreSQL", "Oracle", "SQL Server", "Git / CI-CD", "OAuth2", "Azure Monitor"],
        "patterns": ["ETL batch et ELT cloud", "Streaming et change data capture", "API contract-first (RAML / OpenAPI)", "Gestion d'erreurs et rejouabilité des flux", "Contrôles de qualité de données"],
        "constraints": "Connecteurs certifiés uniquement ; secrets dans le coffre de credentials ; supervision centralisée des flux.",
    },
    {
        "id": "STK-02",
        "language": "fr",
        "name": "BI & Analytics",
        "domain": "bi",
        "purpose": "Stack décisionnelle OliveSoft : modélisation sémantique, dashboards sécurisés et déploiement self-service pour réseaux multi-sites.",
        "components": ["Power BI (+ DAX, row-level security)", "Tableau", "Qlik Sense", "Looker Studio", "dbt", "SSIS (legacy)", "SQL Server", "BigQuery", "Snowflake"],
        "patterns": ["Semantic layer et catalogue de KPI", "Sécurité par ligne et cloisonnement par entité", "Migration SSIS vers ELT moderne", "Recette utilisateur et conduite d'adoption"],
        "constraints": "Modèles versionnés dans Git ; aucune exportation de données hors du tenant client.",
    },
    {
        "id": "STK-03",
        "language": "en",
        "name": "Data & AI platform",
        "domain": "data-ai",
        "purpose": "OliveSoft reference stack for data platforms and applied AI: lakehouse analytics, MLOps and production RAG services.",
        "components": ["Databricks", "Google Cloud Platform (BigQuery, Dataflow)", "Azure Data Factory", "Apache Airflow", "Apache Kafka", "Python", "FastAPI", "LangChain", "Vector DB", "MLflow", "Docker"],
        "patterns": ["Medallion lakehouse architecture", "Feature and model lifecycle with MLflow", "RAG services with evaluation guardrails", "Batch and streaming ingestion"],
        "constraints": "Managed services first; model registry mandatory for production; LLM outputs evaluated before release.",
    },
]

# ---------------------------------------------------------------------------
# v2 variants for the re-indexation test (same doc ID, version bump)
# ---------------------------------------------------------------------------

V2_SKILL_DELTA = {
    "C02": {"add": ["Tableau", "dbt", "Looker Studio"]},
    "P04": {"add": ["Azure", "MLflow"]},
    "STK-01": {"add": ["Kafka Connect", "Debezium (CDC)", "AsyncAPI"], "remove": ["Workato"]},
}

# ---------------------------------------------------------------------------
# Benchmark queries (10 positive: 5 FR + 5 EN incl. cross-lingual; 3 no-match)
# ---------------------------------------------------------------------------

QUERIES = {
    "queries": [
        {"id": "Q01", "language": "fr", "type": "exact", "query": "consultant MuleSoft intégration API REST", "must_appear": ["C01"], "also_relevant": ["P14", "C05", "C17"]},
        {"id": "Q02", "language": "fr", "type": "exact", "query": "data warehouse Snowflake dbt modélisation", "must_appear": ["C03"], "also_relevant": ["P05", "C13"]},
        {"id": "Q03", "language": "fr", "type": "paraphrase", "query": "tableaux de bord décisionnels ventes multicanal Power BI", "must_appear": ["C02"], "also_relevant": ["P06", "C12"]},
        {"id": "Q04", "language": "fr", "type": "paraphrase", "query": "assistant IA conversationnel sur base documentaire interne", "must_appear": ["C04"], "also_relevant": ["P15", "P04"]},
        {"id": "Q05", "language": "fr", "type": "exact", "query": "automatisation de flux n8n connecteurs API", "must_appear": ["C11"], "also_relevant": ["P07"]},
        {"id": "Q06", "language": "en", "type": "cross_lingual", "query": "Salesforce Marketing Cloud campaign personalization journey builder", "must_appear": ["C10"], "also_relevant": ["P09"]},
        {"id": "Q07", "language": "en", "type": "exact", "query": "GCP BigQuery data pipeline Airflow dbt", "must_appear": ["C08"], "also_relevant": ["P10", "P01"]},
        {"id": "Q08", "language": "en", "type": "paraphrase", "query": "demand forecasting machine learning production monitoring", "must_appear": ["C09"], "also_relevant": ["P03"]},
        {"id": "Q09", "language": "en", "type": "cross_lingual", "query": "enterprise data governance and platform architecture", "must_appear": ["C17"], "also_relevant": ["C03", "P10"]},
        {"id": "Q10", "language": "en", "type": "paraphrase", "query": "legacy ETL migration and data quality banking", "must_appear": ["C16"], "also_relevant": ["P11", "C06"]},
    ],
    "no_match": [
        {"id": "NM01", "language": "fr", "query": "développeur senior React interface web single page", "expected_doc_ids": []},
        {"id": "NM02", "language": "fr", "query": "consultant migration SAP S/4HANA modules FI/CO", "expected_doc_ids": [], "note": "Deliberate near-miss: SAP SuccessFactors appears in P02; S/4HANA FI/CO must not be endorsed."},
        {"id": "NM03", "language": "en", "query": "Kubernetes service mesh Istio platform engineer", "expected_doc_ids": [], "note": "Docker exists on C04/C14; Kubernetes and service mesh do not."},
    ],
    "gate": "hit@5 >= 8/10 positives (a query hits when a must_appear doc is in the top 5); no-match queries must return no endorsed document.",
}

# ---------------------------------------------------------------------------
# Test tenders with the expected match matrix
# ---------------------------------------------------------------------------

TENDERS = [
    {
        "id": "T-001",
        "language": "fr",
        "title": "Refonte du SI d'intégration et mise en place d'un API management",
        "buyer": "Agence publique K",
        "sector": "Secteur public",
        "country": "France",
        "deadline": "2026-11-15",
        "budget": None,
        "description": "L'acheteur souhaite industrialiser ses échanges applicatifs : couche d'API managée, flux d'intégration batch et temps réel, supervision centralisée.",
        "requirements": [
            {"id": "R1", "text": "Conception et déploiement d'API avec MuleSoft", "expected_class": "supported", "supporting_docs": ["C01", "C05", "C17", "P14"]},
            {"id": "R2", "text": "ETL industriel Talend avec contrôles de qualité de données", "expected_class": "supported", "supporting_docs": ["C06", "P11"]},
            {"id": "R3", "text": "Streaming événementiel Kafka entre systèmes", "expected_class": "supported", "supporting_docs": ["C01", "C03", "C08", "P10", "P14"]},
            {"id": "R4", "text": "Connecteur Salesforce Service Cloud", "expected_class": "partial", "supporting_docs": ["C05", "C10", "P08"], "note": "Salesforce skills exist but combined SF+integration profiles are indirect."},
            {"id": "R5", "text": "Orchestration de workflows d'automatisation (type n8n)", "expected_class": "partial", "supporting_docs": ["C11", "P07"], "note": "Junior profile only."},
            {"id": "R6", "text": "Supervision et observabilité des flux", "expected_class": "partial", "supporting_docs": ["C01", "C06", "C16"], "note": "Monitoring skills present but not as a dedicated profile."},
            {"id": "R7", "text": "Déploiement Kubernetes avec service mesh", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R8", "text": "Interface de supervision web React", "expected_class": "unsupported", "supporting_docs": []},
        ],
    },
    {
        "id": "T-002",
        "language": "fr",
        "title": "Modernisation de la plateforme décisionnelle et du data warehouse",
        "buyer": "Banque L",
        "sector": "Banque / Assurance",
        "country": "France",
        "deadline": "2026-12-01",
        "budget": None,
        "description": "Migration du décisionnel existant vers un data warehouse cloud, dashboards sécurisés et gouvernance des KPI pour les métiers risque et commercial.",
        "requirements": [
            {"id": "R1", "text": "Data warehouse Snowflake avec transformations dbt", "expected_class": "supported", "supporting_docs": ["C03", "C13", "C17", "P05"]},
            {"id": "R2", "text": "Dashboards Power BI avec sécurité par ligne (RLS)", "expected_class": "supported", "supporting_docs": ["C02", "P06"]},
            {"id": "R3", "text": "Migration des flux SSIS legacy vers ELT moderne", "expected_class": "supported", "supporting_docs": ["C06", "C16", "C18", "P11"]},
            {"id": "R4", "text": "Gouvernance des données et catalogue de KPI", "expected_class": "supported", "supporting_docs": ["C03", "C07", "C17", "C19"]},
            {"id": "R5", "text": "Machine learning prédictif intégré à la BI", "expected_class": "partial", "supporting_docs": ["C09", "P03"], "note": "Forecasting exists; BI-integrated ML is indirect."},
            {"id": "R6", "text": "Dataviz Looker Studio pour réseau multi-boutiques", "expected_class": "partial", "supporting_docs": ["C07", "C12", "P13"], "note": "Junior/adjacent profiles."},
            {"id": "R7", "text": "Fine-tuning de LLM on-premise pour narration automatique", "expected_class": "unsupported", "supporting_docs": [], "note": "RAG capability exists (C04) but fine-tuning is not evidenced."},
            {"id": "R8", "text": "Développement d'un portail web React", "expected_class": "unsupported", "supporting_docs": []},
        ],
    },
    {
        "id": "T-003",
        "language": "en",
        "title": "Document intelligence and RAG platform",
        "buyer": "Public agency E",
        "sector": "Public sector",
        "country": "France",
        "deadline": "2026-11-30",
        "budget": None,
        "description": "The buyer wants an assistant grounded on an internal document corpus: ingestion, vector search, cited answers and workflow automation around the results.",
        "requirements": [
            {"id": "R1", "text": "Retrieval-augmented generation assistant over a document corpus", "expected_class": "supported", "supporting_docs": ["C04", "P15"]},
            {"id": "R2", "text": "Vector database and embedding pipeline", "expected_class": "supported", "supporting_docs": ["C04", "P15"]},
            {"id": "R3", "text": "NLP classification with Transformers", "expected_class": "supported", "supporting_docs": ["C14", "P12"]},
            {"id": "R4", "text": "Workflow automation with n8n", "expected_class": "supported", "supporting_docs": ["C11", "P07"]},
            {"id": "R5", "text": "Service exposure with FastAPI", "expected_class": "supported", "supporting_docs": ["C04", "C14"]},
            {"id": "R6", "text": "On-premise GPU cluster for open-source LLMs", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R7", "text": "Mobile Flutter client application", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R8", "text": "Data governance for AI outputs", "expected_class": "partial", "supporting_docs": ["C03", "C17", "C19"], "note": "General data governance exists; AI-output governance is indirect."},
        ],
    },
]

CLASS_WEIGHTS = {"supported": 1.0, "partial": 0.5, "unsupported": 0.0, "unknown": 0.0}

# ---------------------------------------------------------------------------
# Writers
# ---------------------------------------------------------------------------

def slugify(text: str, limit: int = 48) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    folded = re.sub(r"[^a-zA-Z0-9]+", "-", folded).strip("-").lower()
    return folded[:limit].strip("-") or "doc"


def write_txt(path: Path, lines: list[tuple[str, str]]) -> None:
    body = "\n".join(text for _, text in lines) + "\n"
    path.write_text(body, encoding="utf-8")


def write_docx(path: Path, lines: list[tuple[str, str]]) -> None:
    paragraphs = []
    for kind, text in lines:
        if kind == "gap":
            paragraphs.append("<w:p/>")
            continue
        rpr = "<w:rPr><w:b/></w:rPr>" if kind in ("title", "head") else ""
        paragraphs.append(
            f'<w:p><w:r>{rpr}<w:t xml:space="preserve">{escape(text)}</w:t></w:r></w:p>'
        )
    document = (
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
        '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'
        f'<w:body>{"".join(paragraphs)}</w:body></w:document>'
    )
    files = {
        "[Content_Types].xml": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
            '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
            '<Default Extension="xml" ContentType="application/xml"/>'
            '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>'
            "</Types>"
        ),
        "_rels/.rels": (
            '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>'
            "</Relationships>"
        ),
        "word/document.xml": document,
    }
    with ZipFile(path, "w", ZIP_DEFLATED) as archive:
        for name, content in files.items():
            archive.writestr(name, content)


def _pdf_string(text: str) -> bytes:
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return safe.encode("cp1252", errors="replace")


def write_pdf(path: Path, lines: list[tuple[str, str]]) -> None:
    page_w, page_h, margin = 595, 842, 56
    styles = {
        "title": ("F1", 15, 21),
        "meta": ("F2", 8.5, 12),
        "head": ("F1", 10.5, 16),
        "body": ("F2", 9.5, 13.5),
        "gap": ("F2", 9.5, 10),
    }
    max_width = page_w - 2 * margin
    wrapped: list[tuple[str, float, float, str]] = []
    for kind, text in lines:
        font, size, lead = styles[kind]
        if kind == "gap":
            wrapped.append((font, size, lead, ""))
            continue
        limit = max(20, int(max_width / (size * 0.52)))
        chunks = textwrap.wrap(text, width=limit) or [""]
        for chunk in chunks:
            wrapped.append((font, size, lead, chunk))

    pages: list[list[tuple[str, float, int, str]]] = []
    current: list[tuple[str, float, int, str]] = []
    y = page_h - margin
    for font, size, lead, chunk in wrapped:
        if y - lead < margin:
            pages.append(current)
            current = []
            y = page_h - margin
        current.append((font, size, y, chunk))
        y -= lead
    if current:
        pages.append(current)

    objects: list[bytes] = []
    page_ids = []
    contents_ids = []
    # Reserve: 1 catalog, 2 pages, 3 F1, 4 F2, then page/content pairs from 5.
    next_id = 5
    for page_lines in pages:
        page_id = next_id
        contents_id = next_id + 1
        next_id += 2
        page_ids.append(page_id)
        contents_ids.append(contents_id)
        stream = ["BT"]
        for font, size, line_y, chunk in page_lines:
            if chunk:
                stream.append(f"/{font} {size:g} Tf")
                stream.append(f"{margin} {line_y:g} Td")
                stream.append("(" + _pdf_string(chunk).decode("cp1252", errors="replace") + ") Tj")
        stream.append("ET")
        content = "\n".join(stream).encode("cp1252", errors="replace")
        objects.append((page_id, b"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R /F2 4 0 R >> >> /Contents " + str(contents_id).encode() + b" 0 R >>"))
        objects.append((contents_id, b"<< /Length " + str(len(content)).encode() + b" >>\nstream\n" + content + b"\nendstream"))

    kids = " ".join(f"{pid} 0 R" for pid in page_ids)
    catalog = b"<< /Type /Catalog /Pages 2 0 R >>"
    pages_obj = f"<< /Type /Pages /Kids [{kids}] /Count {len(page_ids)} >>".encode()
    font1 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"
    font2 = b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"

    data = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    fixed = {1: catalog, 2: pages_obj, 3: font1, 4: font2}
    by_id = dict(fixed)
    for obj_id, payload in objects:
        by_id[obj_id] = payload
    for obj_id in range(1, next_id):
        offsets.append(len(data))
        data.extend(f"{obj_id} 0 obj\n".encode() + by_id[obj_id] + b"\nendobj\n")
    xref = len(data)
    data.extend(f"xref\n0 {next_id}\n0000000000 65535 f \n".encode())
    for offset in offsets[1:]:
        data.extend(f"{offset:010d} 00000 n \n".encode())
    data.extend(f"trailer\n<< /Size {next_id} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n".encode())
    path.write_bytes(data)


# ---------------------------------------------------------------------------
# Renderers (shared line model: kind in title/meta/head/body/gap)
# ---------------------------------------------------------------------------

def render_cv(record: dict, language: str, version: int, extra_skills: list[str] | None = None) -> list[tuple[str, str]]:
    en = language == "en"
    tr = EN_TRANSLATIONS.get(record["id"], {})
    skills = list(tr.get("competences", record["competences"])) + (extra_skills or [])
    meta = " | ".join([
        f'ID: {record["id"]}',
        f"version: v{version}",
        "asset_type: cv",
        f"language: {language}",
        f'seniority: {SENIORITY_EN.get(record["seniorite"], record["seniorite"]) if en else record["seniorite"]}',
        f'location: {record["site"]}',
        f'experience: {record["annees_experience"]} years' if en else f"experience: {record['annees_experience']} ans",
    ])
    lines: list[tuple[str, str]] = [
        ("title", f'CV {record["id"]} - {tr.get("titre", record["titre"])}'),
        ("meta", meta),
        ("meta", "skills: " + ", ".join(skills)),
        ("gap", ""),
        ("head", "Profile" if en else "Profil"),
        ("body", tr.get("resume", record["resume"])),
        ("gap", ""),
        ("head", "Certifications"),
        ("body", "; ".join(record["certifications"])),
        ("gap", ""),
        ("head", "Education" if en else "Formation"),
        ("body", tr.get("formation", record["formation"])),
        ("gap", ""),
        ("head", "Languages" if en else "Langues"),
        ("body", tr.get("langues", ", ".join(record["langues"]))),
        ("gap", ""),
        ("head", "Project references" if en else "Références projet"),
    ]
    for ref in record["projets"]:
        role = tr.get("projets", {}).get(ref["id"], ref["role"])
        lines.append(("body", f'- {ref["id"]} - {role}'))
    return lines


def render_project(record: dict, language: str, version: int, extra_stack: list[str] | None = None) -> list[tuple[str, str]]:
    en = language == "en"
    tr = EN_TRANSLATIONS.get(record["id"], {})
    stack = list(record["stack"]) + (extra_stack or [])
    meta = " | ".join([
        f'ID: {record["id"]}',
        f"version: v{version}",
        "asset_type: project",
        f"language: {language}",
        f'sector: {record["secteur"]}',
        f'duration: {record["duree_mois"]} months' if en else f'duree: {record["duree_mois"]} mois',
    ])
    return [
        ("title", f'Project {record["id"]} - {tr.get("titre", record["titre"])}' if en else f'Projet {record["id"]} - {record["titre"]}'),
        ("meta", meta),
        ("meta", "stack: " + ", ".join(stack)),
        ("gap", ""),
        ("head", "Client"),
        ("body", record["client"]),
        ("gap", ""),
        ("head", "Description"),
        ("body", tr.get("description", record["description"])),
        ("gap", ""),
        ("head", "Measurable results" if en else "Résultats mesurables"),
        ("body", tr.get("resultat_chiffre", record["resultat_chiffre"])),
    ]


def render_stack(record: dict, version: int, extra: list[str] | None = None, removed: list[str] | None = None) -> list[tuple[str, str]]:
    en = record["language"] == "en"
    components = list(record["components"]) + (extra or [])
    for item in removed or []:
        components = [c for c in components if item not in c]
    meta = " | ".join([
        f'ID: {record["id"]}',
        f"version: v{version}",
        "asset_type: stack",
        f'language: {record["language"]}',
        f'domain: {record["domain"]}',
    ])
    lines = [
        ("title", f'{"Capability stack" if en else "Stack de capacités"} {record["id"]} - {record["name"]}'),
        ("meta", meta),
        ("gap", ""),
        ("head", "Purpose" if en else "Objet"),
        ("body", record["purpose"]),
        ("gap", ""),
        ("head", "Components" if en else "Composants"),
    ]
    lines.extend(("body", f"- {component}") for component in components)
    lines += [
        ("gap", ""),
        ("head", "Delivery patterns" if en else "Patterns de livraison"),
    ]
    lines.extend(("body", f"- {pattern}") for pattern in record["patterns"])
    lines += [
        ("gap", ""),
        ("head", "Constraints & operations" if en else "Contraintes & exploitation"),
        ("body", record["constraints"]),
    ]
    return lines


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------

def main() -> None:
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    projects_by_id = {p["id"]: p for p in source["projets"]}
    cvs_by_id = {c["id"]: c for c in source["cvs"]}
    stacks_by_id = {s["id"]: s for s in STACKS}

    for folder in ("cvs", "projects", "stacks", "versions", "tenders", "labels"):
        (OUT / folder).mkdir(parents=True, exist_ok=True)

    manifest_files: list[dict] = []
    corpus_text_for_check: list[str] = []

    def emit(lines, folder, doc_id, slug_base, language, version, asset_type, extra=None, removed=None):
        if folder == "cvs" and doc_id in TXT_CVS or folder == "projects" and doc_id in TXT_PROJECTS:
            ext = "txt"
        elif folder == "cvs" and doc_id in DOCX_CVS or folder == "projects" and doc_id in DOCX_PROJECTS:
            ext = "docx"
        else:
            ext = "pdf"
        name = f'{doc_id}_{slugify(slug_base)}_{language}_v{version}.{ext}'
        target = OUT / folder / name
        if ext == "txt":
            write_txt(target, lines)
        elif ext == "docx":
            write_docx(target, lines)
        else:
            write_pdf(target, lines)
        manifest_files.append({
            "id": doc_id,
            "version": f"v{version}",
            "asset_type": asset_type,
            "language": language,
            "format": ext,
            "file": str(target.relative_to(OUT)).replace("\\", "/"),
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "bytes": target.stat().st_size,
        })
        corpus_text_for_check.append("\n".join(text for _, text in lines))
        return name

    # v1 corpus
    for record in source["cvs"]:
        language = "en" if record["id"] in EN_CVS else "fr"
        emit(render_cv(record, language, 1), "cvs", record["id"], record["titre"], language, 1, "cv")
    for record in source["projets"]:
        language = "en" if record["id"] in EN_PROJECTS else "fr"
        emit(render_project(record, language, 1), "projects", record["id"], record["titre"], language, 1, "project")
    for record in STACKS:
        emit(render_stack(record, 1), "stacks", record["id"], record["name"], record["language"], 1, "stack")

    # v2 variants (re-indexation test)
    for doc_id, delta in V2_SKILL_DELTA.items():
        version = 2
        if doc_id in cvs_by_id:
            record = cvs_by_id[doc_id]
            language = "en" if doc_id in EN_CVS else "fr"
            lines = render_cv(record, language, version, extra_skills=delta["add"])
            emit(lines, "versions", doc_id, record["titre"], language, version, "cv")
        elif doc_id in projects_by_id:
            record = projects_by_id[doc_id]
            language = "en" if doc_id in EN_PROJECTS else "fr"
            lines = render_project(record, language, version, extra_stack=delta["add"])
            emit(lines, "versions", doc_id, record["titre"], language, version, "project")
        else:
            record = stacks_by_id[doc_id]
            lines = render_stack(record, version, extra=delta["add"], removed=delta.get("remove"))
            emit(lines, "versions", doc_id, record["name"], record["language"], version, "stack")

    # Tenders
    matrix = []
    for tender in TENDERS:
        slug = slugify(tender["title"])
        (OUT / "tenders" / f'{tender["id"]}_{slug}_{tender["language"]}.json').write_text(
            json.dumps(tender, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        weight_sum = sum(CLASS_WEIGHTS[r["expected_class"]] for r in tender["requirements"])
        matrix.append({
            "tender_id": tender["id"],
            "language": tender["language"],
            "requirement_count": len(tender["requirements"]),
            "expected_coverage_pct": round(100 * weight_sum / len(tender["requirements"])),
            "requirements": [
                {"id": r["id"], "text": r["text"], "expected_class": r["expected_class"], "supporting_docs": r["supporting_docs"], **({"note": r["note"]} if "note" in r else {})}
                for r in tender["requirements"]
            ],
        })

    (OUT / "labels" / "queries.json").write_text(json.dumps(QUERIES, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    (OUT / "labels" / "match_matrix.json").write_text(json.dumps({"tenders": matrix}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    counts = {
        "cvs": len(source["cvs"]),
        "projects": len(source["projets"]),
        "stacks": len(STACKS),
        "total": len(source["cvs"]) + len(source["projets"]) + len(STACKS),
        "v2_variants": len(V2_SKILL_DELTA),
        "languages": {
            "fr": sum(1 for f in manifest_files if f["version"] == "v1" and f["language"] == "fr"),
            "en": sum(1 for f in manifest_files if f["version"] == "v1" and f["language"] == "en"),
        },
        "formats": {
            fmt: sum(1 for f in manifest_files if f["format"] == fmt)
            for fmt in ("pdf", "txt", "docx")
        },
    }
    manifest = {
        "source": "data/synthetic_data.json",
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "generator": "dashboard/scripts/generate_corpus.py",
        "notes": "Synthetic corpus; no real clients or people. Labels and tenders are evaluation assets and are NOT meant for ingestion.",
        "upload_mapping": {"cvs/": "cv", "projects/": "project", "stacks/": "expertise (mapped to asset_type stack by ingestion)"},
        "counts": counts,
        "files": sorted(manifest_files, key=lambda f: (f["asset_type"], f["id"], f["version"])),
    }
    (OUT / "labels" / "corpus_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    readme = """# Synthetic knowledge corpus

Deterministic fixtures generated by `dashboard/scripts/generate_corpus.py` from
`data/synthetic_data.json` (never edit generated files by hand; edit the source
or the script overlays and regenerate).

## Layout

| Folder | Content | Upload category |
|---|---|---|
| `cvs/` | 20 CVs (C01-C20), 14 FR / 6 EN | CV |
| `projects/` | 15 project summaries (P01-P15), 11 FR / 4 EN | Project |
| `stacks/` | 3 capability stacks (STK-01..03), 2 FR / 1 EN | Expertise (mapped to `stack` by ingestion) |
| `versions/` | v2 variants of C02, P04, STK-01 for the re-indexation test | same as their v1 category |
| `tenders/` | Test tenders T-001..T-003 with expected match matrix | NOT for ingestion |
| `labels/` | `queries.json`, `match_matrix.json`, `corpus_manifest.json` | NOT for ingestion |

Formats mirror the ingestion parsers: PDF (dominant), TXT, DOCX.

## Verification procedure

1. Upload the 38 v1 documents through the dashboard Knowledge base; confirm
   ingestion reaches `indexed` for every document and Qdrant point counts match
   the manifest.
2. Re-indexation: upload the three v2 variants from `versions/`. Counts must
   stay stable (no duplicate chunks) and obsolete v1 chunks must disappear.
3. Retrieval benchmark: run `labels/queries.json` through the evaluation
   workflow. Gate: hit@5 >= 8/10 positives, no endorsement on no-match queries.
4. Matching: submit `tenders/` through intake and compare requirement judgments
   against `labels/match_matrix.json` (supported/partial/unsupported classes
   and coverage percentages).

No-match zones are deliberate: no React/Angular web development, no Kubernetes
or service mesh, no SAP S/4HANA. `SAP SuccessFactors` in P02 is an intentional
near-miss for NM02.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")

    # Self-checks: no-match zones must stay absent from ingested document text.
    joined = "\n".join(corpus_text_for_check).lower()
    forbidden = ["kubernetes", "react", "s/4hana", "flutter", "istio", "service mesh"]
    leaked = [term for term in forbidden if term in joined]
    if leaked:
        raise SystemExit(f"No-match zone terms leaked into corpus: {leaked}")

    print(f"Corpus generated in {OUT}")
    print(f"  files: {len(manifest_files)} (38 v1 + {counts['v2_variants']} v2)")
    print(f"  languages: {counts['languages']}")
    print(f"  formats: {counts['formats']}")
    print("  no-match zone check: OK")


if __name__ == "__main__":
    main()
