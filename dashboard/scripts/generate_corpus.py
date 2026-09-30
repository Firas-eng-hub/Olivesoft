"""Generate the synthetic knowledge corpus fixtures for RAG ingestion.

Reads data/fake_cv_dataset.json (untouched source of truth) and emits
versioned, extraction-friendly documents plus benchmark labels into
fixtures/corpus/.

- Format: PDF only (one page A4 per document), mirroring the PDF parser of
  the n8n knowledge_ingestion workflow. TXT/DOCX parser paths are exercised
  live with separate samples, not with this corpus.
- Languages: CVs follow their output_language field (10 FR / 10 EN). The FR
  ones are rendered in French via a hand-written overlay (tech terms, person
  names, client names and school names unchanged). Projects and capability
  stacks stay English.
- Documents: 20 CVs + 15 project summaries + 6 capability stacks = 41 v1
  files, plus three v2 variants (C02, P04, STK-01) in versions/ for the
  re-indexation test (same document ID, new version: obsolete chunks must be
  replaced).
- Labels: labelled FR/EN queries (10 positive + 3 no-match) and a per-tender
  expected match matrix for validating the matching workflow.

Deterministic: same input produces identical output bytes.
Uses only the Python standard library, like generate_demo_artifacts.py.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import textwrap
import unicodedata
from pathlib import Path
from xml.sax.saxutils import escape
from zipfile import ZipFile, ZIP_DEFLATED

REPO = Path(__file__).resolve().parents[2]
SOURCE = REPO / "data" / "fake_cv_dataset.json"
OUT = REPO / "fixtures" / "corpus"

# ---------------------------------------------------------------------------
# French rendering overlay for the 10 FR CVs (content is English in the JSON;
# tech terms, person names, client names and school names stay unchanged)
# ---------------------------------------------------------------------------

FR_CVS = {"C01", "C02", "C03", "C05", "C08", "C11", "C13", "C15", "C17", "C20"}

CATEGORY_FR = {
    "Integration & Orchestration": "Intégration & Orchestration",
    "Data & Cloud": "Données & Cloud",
    "BI & Analytics": "BI & Analytics",
    "AI / ML & LLM": "IA / ML & LLM",
    "CRM & Salesforce": "CRM & Salesforce",
    "Management & Architecture": "Management & Architecture",
}

FR_TRANSLATIONS = {
    "C01": {
        "tagline": "Ingénieur intégration senior – Architecture API & ETL",
        "summary": "Ingénieur intégration senior avec 11 ans d'expérience dans la conception de paysages ETL et API d'entreprise pour des clients retail, luxe et industrie. Pilote des squads d'intégration et porte la livraison du design jusqu'au run.",
        "education": {"Engineering Degree in Computer Science": "Diplôme d'ingénieur en informatique"},
        "languages": ["Français – langue maternelle", "Anglais – courant", "Arabe – langue maternelle"],
        "leadership": {
            "role": "Responsable de guilde interne",
            "bullets": ["Anime des revues trimestrielles des patterns d'intégration et mentorise 6 ingénieurs."],
        },
        "projects": {
            "P01": {
                "context": "Mission de conseil – Ingénieur intégration lead",
                "bullets": [
                    "A piloté une squad de 5 personnes construisant des flux bidirectionnels RH-paie pour 8 pays avec MuleSoft et Talend.",
                    "A introduit le design d'API contract-first et le rejeu automatique des erreurs, réduisant de 60 % les erreurs de synchronisation.",
                ],
            },
            "P06": {
                "context": "Mission de conseil – Architecte intégration",
                "bullets": [
                    "A conçu la couche MuleSoft reliant boutique en ligne, ERP et logistique pour les commandes et retours omnicanal.",
                    "A défini les patterns de retry, d'idempotence et de supervision réutilisés sur le programme d'intégration du client.",
                ],
            },
        },
    },
    "C02": {
        "tagline": "Ingénieure intégration de données – Talend & pipelines cloud",
        "summary": "Ingénieure intégration avec 6 ans d'expérience dans la construction de pipelines Talend et de flux API pour des programmes CRM et e-commerce. À l'aise pour migrer un ETL legacy vers de l'ELT cloud.",
        "education": {"Engineering Degree in Software Engineering": "Diplôme d'ingénieur en génie logiciel"},
        "languages": ["Français – courant", "Anglais – courant", "Arabe – langue maternelle"],
        "leadership": {
            "role": "Intervenante bénévole",
            "bullets": ["Présente des talks sur les patterns de migration ELT devant plus de 60 participants."],
        },
        "projects": {
            "P02": {
                "context": "Mission de conseil – Développeuse ETL",
                "bullets": [
                    "A construit des jobs Talend chargeant les sources ERP, e-commerce et marketing dans BigQuery.",
                    "A ajouté des contrôles de réconciliation signalant les clients dupliqués avant chargement CRM.",
                ],
            },
            "P13": {
                "context": "Mission de conseil – Développeuse pipelines",
                "bullets": [
                    "A migré 40 jobs Talend legacy vers Snowflake avec des modèles dbt orchestrés dans Airflow.",
                    "A mis en place des tests de qualité de données automatisés, réduisant de 30 % les coûts d'exploitation data.",
                ],
            },
        },
    },
    "C03": {
        "tagline": "Consultant intégration – Boomi, Workato & automatisation de processus",
        "summary": "Consultant intégration avec 7 ans d'expérience à traduire des processus métier en automatisations Boomi et Workato. Solide relationnel et animation d'ateliers de cadrage.",
        "education": {"Master in Information Systems": "Master systèmes d'information"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Facilitateur d'ateliers",
            "bullets": ["Organise des ateliers mensuels d'automatisation no-code pour les consultants juniors."],
        },
        "projects": {
            "P11": {
                "context": "Mission de conseil – Consultant intégration",
                "bullets": [
                    "A construit des processus Boomi synchronisant stock magasins et commandes ERP avec Service Cloud.",
                    "A documenté les contrats d'interface, réduisant les escalades de tickets entre équipes.",
                ],
            },
            "P14": {
                "context": "Mission de conseil – Consultant automatisation",
                "bullets": [
                    "A automatisé onboarding, relances et réconciliations avec Workato et n8n.",
                    "A identifié 12 workflows manuels et livré 1 200 heures gagnées par an.",
                ],
            },
        },
    },
    "C05": {
        "tagline": "Responsable BI senior – Gouvernance KPI & modèles sémantiques",
        "summary": "Responsable BI avec 12 ans d'expérience en modélisation dimensionnelle, gouvernance des KPI et analytics en self-service pour la banque et le retail. Construit des couches sémantiques de confiance pour les métiers.",
        "education": {"Master in Business Intelligence": "Master business intelligence"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Responsable de practice",
            "bullets": ["Encadre 8 développeurs BI et maintient les standards de modélisation internes."],
        },
        "projects": {
            "P08": {
                "context": "Mission de conseil – Responsable BI",
                "bullets": [
                    "A conçu le modèle dimensionnel et la couche sémantique Power BI pour le reporting réglementaire et financier.",
                    "A standardisé 120 KPI dans un catalogue de gouvernance, réduisant de 50 % le délai de clôture reporting.",
                ],
            },
            "P03": {
                "context": "Mission de conseil – Propriétaire des dashboards",
                "bullets": [
                    "A livré des dashboards prévision et stock dans Power BI alimentés par les sorties Databricks.",
                    "A défini les seuils d'alerte avec les planificateurs, contribuant à une baisse de 30 % des ruptures de stock.",
                ],
            },
        },
    },
    "C08": {
        "tagline": "Ingénieur data platform senior – Lakehouse & streaming",
        "summary": "Ingénieur data platform avec 10 ans d'expérience à concevoir des entrepôts cloud, des pipelines streaming et de l'infrastructure as code pour des clients retail et luxe.",
        "education": {"Engineering Degree in Computer Science": "Diplôme d'ingénieur en informatique"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Responsable de guilde",
            "bullets": ["Maintient les architectures de référence de la plateforme et révise les designs de 5 équipes projet."],
        },
        "projects": {
            "P02": {
                "context": "Mission de conseil – Architecte data platform",
                "bullets": [
                    "A architecturé l'entrepôt BigQuery et les couches d'ingestion consolidant quatre domaines sources.",
                    "A provisionné les environnements avec Terraform pour des déploiements reproductibles.",
                ],
            },
            "P05": {
                "context": "Mission de conseil – Lead data engineer",
                "bullets": [
                    "A conçu les flux d'événements Kafka et les modèles Snowflake pour les stocks production, entrepôts et boutiques.",
                    "A mis en place data contracts et lignage pour que les chiffres de stock arrivent dans les dashboards en quelques minutes.",
                ],
            },
        },
    },
    "C11": {
        "tagline": "Ingénieur IA senior – Systèmes NLP, LLM & RAG",
        "summary": "Ingénieur IA titulaire d'un doctorat en NLP avec 9 ans d'expérience à faire passer des modèles de langage du prototype à la production. Pilote des architectures RAG et GenAI centrées fiabilité et traçabilité des sources.",
        "education": {"PhD in Natural Language Processing": "Doctorat en traitement automatique du langage"},
        "languages": ["Français – langue maternelle", "Anglais – courant", "Arabe – langue maternelle"],
        "leadership": {
            "role": "Responsable recherche et innovation",
            "bullets": ["Anime des groupes de lecture mensuels et évalue les nouveaux outils LLM pour les équipes de livraison."],
        },
        "projects": {
            "P04": {
                "context": "Mission de conseil – Lead IA",
                "bullets": [
                    "A piloté le chatbot de dépôt guidé et un crawler de similarité combinant Elasticsearch et recherche par embeddings.",
                    "A réduit de 40 % le temps de traitement grâce à un assistant RAG ancré sur les règles du registre.",
                ],
            },
            "P15": {
                "context": "Mission de conseil – Architecte GenAI",
                "bullets": [
                    "A conçu le pipeline RAG et l'index vectoriel sur la base de connaissances du support.",
                    "A imposé réponses sourcées et règles de repli, réduisant de 35 % le temps de réponse des agents.",
                ],
            },
        },
    },
    "C13": {
        "tagline": "Ingénieur vision par ordinateur – Détection d'anomalies",
        "summary": "Ingénieur vision par ordinateur avec 6 ans d'expérience en classification d'images et détection d'anomalies, optimisant les modèles pour la latence de production.",
        "education": {"Master in Artificial Intelligence": "Master en intelligence artificielle"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Conférencier",
            "bullets": ["A donné deux talks sur le déploiement de modèles de vision à la périphérie (edge)."],
        },
        "projects": {
            "P10": {
                "context": "Mission de conseil – Ingénieur vision par ordinateur",
                "bullets": [
                    "A entraîné des classifieurs PyTorch sur des images de voies et les a intégrés au pipeline d'événements Kafka.",
                    "A quantifié les modèles pour tenir les cibles de latence, contribuant à une détection d'anomalies 3x plus rapide.",
                ],
            },
        },
    },
    "C15": {
        "tagline": "Architecte Salesforce senior – Multi-cloud & intégration",
        "summary": "Architecte Salesforce avec 11 ans d'expérience à piloter des programmes multi-cloud, la gouvernance de plateforme et des intégrations orientées API pour des marques retail et luxe.",
        "education": {"Master in Information Systems": "Master systèmes d'information"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Architecte de practice",
            "bullets": ["Anime les revues d'architecture (design authority) et certifie les consultants internes."],
        },
        "projects": {
            "P06": {
                "context": "Mission de conseil – Architecte Salesforce",
                "bullets": [
                    "A défini l'architecture cible reliant Commerce Cloud, ERP et logistique.",
                    "A posé les règles de déploiement et de gouvernance adoptées par trois équipes de livraison.",
                ],
            },
            "P02": {
                "context": "Mission de conseil – Architecte CRM",
                "bullets": [
                    "A conçu le modèle de données Sales Cloud et la synchronisation avec l'entrepôt clients BigQuery.",
                    "A établi des règles de data ownership éliminant les fiches clients dupliquées.",
                ],
            },
        },
    },
    "C17": {
        "tagline": "Consultante Marketing Cloud Salesforce – Journeys & segmentation",
        "summary": "Consultante Marketing Cloud avec 6 ans d'expérience à concevoir segmentation, journeys automatisés et analytics de performance pour des marques de mode.",
        "education": {"Master in Digital Marketing and Data": "Master marketing digital et data"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Mentore",
            "bullets": ["Encadre les consultants juniors sur la mesure des campagnes."],
        },
        "projects": {
            "P07": {
                "context": "Mission de conseil – Consultante Marketing Cloud",
                "bullets": [
                    "A conçu la segmentation et les flows Journey Builder sur cinq marques.",
                    "A alimenté les audiences depuis Snowflake via n8n, augmentant les taux d'ouverture de 18 %.",
                ],
            },
        },
    },
    "C20": {
        "tagline": "Cheffe de projet Data & IA – Livraison agile",
        "summary": "Cheffe de projet avec 10 ans d'expérience à piloter des programmes intégration, BI et IA, combinant livraison agile, maîtrise du budget et relation client.",
        "education": {"Master in Business with Information Systems specialisation": "Master management avec spécialisation systèmes d'information"},
        "languages": ["Français – langue maternelle", "Anglais – courant"],
        "leadership": {
            "role": "Coach bénévole",
            "bullets": ["Accompagne les nouveaux chefs de projet sur la livraison agile et la gestion des parties prenantes."],
        },
        "projects": {
            "P02": {
                "context": "Mission de conseil – Cheffe de projet",
                "bullets": [
                    "A piloté une équipe de 9 personnes livrant le programme CRM et entrepôt dans le budget.",
                    "A animé des comités de pilotage hebdomadaires avec marketing, IT et support.",
                ],
            },
            "P03": {
                "context": "Mission de conseil – Cheffe de projet",
                "bullets": [
                    "A coordonné les chantiers data engineering, ML et BI sur deux fuseaux horaires.",
                    "A introduit un registre des risques révélant tôt les problèmes de qualité ERP.",
                ],
            },
            "P14": {
                "context": "Mission de conseil – Cheffe de projet",
                "bullets": [
                    "A priorisé 12 candidats à l'automatisation par valeur et effort avec les opérationnels.",
                    "A livré la première vague en 10 semaines, soit 1 200 heures gagnées par an.",
                ],
            },
        },
    },
}

# ---------------------------------------------------------------------------
# v2 variants for the re-indexation test (same doc ID, version bump)
# ---------------------------------------------------------------------------

V2_CV_SKILLS = {
    "C02": {"BI & Analytics": ["Tableau"], "Integration & Orchestration": ["Apache Kafka"]},
}
V2_PROJECT_STACK = {"P04": ["Docker", "MLflow"]}
V2_STACK_DELTA = {"STK-01": {"add": ["Kafka Connect", "Debezium (CDC)"], "remove": ["Workato"]}}

# ---------------------------------------------------------------------------
# Benchmark queries (10 positive: 5 FR + 5 EN incl. cross-lingual; 3 no-match)
# ---------------------------------------------------------------------------

QUERIES = {
    "queries": [
        {"id": "Q01", "language": "fr", "type": "exact", "query": "consultant MuleSoft intégration API", "must_appear": ["C01"], "also_relevant": ["C19", "P01", "C15"]},
        {"id": "Q02", "language": "fr", "type": "exact", "query": "ingénieur Snowflake data plateforme cloud", "must_appear": ["C08"], "also_relevant": ["C10", "P05", "P13"]},
        {"id": "Q03", "language": "fr", "type": "paraphrase", "query": "tableaux de bord décisionnels pilotage Power BI", "must_appear": ["C05"], "also_relevant": ["C07", "C06", "P03"]},
        {"id": "Q04", "language": "fr", "type": "exact", "query": "architecte Salesforce Commerce Cloud", "must_appear": ["C15"], "also_relevant": ["P06", "P02", "C18"]},
        {"id": "Q05", "language": "fr", "type": "paraphrase", "query": "assistant IA conversationnel sur base documentaire interne", "must_appear": ["C11"], "also_relevant": ["P15", "P04"]},
        {"id": "Q06", "language": "en", "type": "exact", "query": "Databricks machine learning pipeline MLOps", "must_appear": ["C12"], "also_relevant": ["C09", "P09"]},
        {"id": "Q07", "language": "en", "type": "cross_lingual", "query": "Salesforce Marketing Cloud campaign automation", "must_appear": ["C17"], "also_relevant": ["P07"]},
        {"id": "Q08", "language": "en", "type": "paraphrase", "query": "legacy ETL migration to cloud data warehouse", "must_appear": ["P13"], "also_relevant": ["C02", "C10"]},
        {"id": "Q09", "language": "en", "type": "exact", "query": "Boomi Workato integration consultant", "must_appear": ["C03"], "also_relevant": ["P11", "P14"]},
        {"id": "Q10", "language": "en", "type": "cross_lingual", "query": "computer vision anomaly detection", "must_appear": ["C13"], "also_relevant": ["P10"]},
    ],
    "no_match": [
        {"id": "NM01", "language": "fr", "query": "développeur senior React interface web single page", "expected_doc_ids": [], "note": "No web development capability in the corpus."},
        {"id": "NM02", "language": "en", "query": "Kubernetes service mesh platform engineer Istio", "expected_doc_ids": [], "note": "Docker and Terraform exist; Kubernetes, service mesh and Istio do not."},
        {"id": "NM03", "language": "fr", "query": "consultant migration SAP S/4HANA modules FI/CO", "expected_doc_ids": [], "note": "No SAP anywhere in the corpus."},
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
            {"id": "R1", "text": "Conception et déploiement d'API avec MuleSoft", "expected_class": "supported", "supporting_docs": ["C01", "C15", "C19", "P01", "P06"]},
            {"id": "R2", "text": "Industrialisation d'ETL Talend avec contrôles de qualité de données", "expected_class": "supported", "supporting_docs": ["C02", "P01", "P13"]},
            {"id": "R3", "text": "Streaming événementiel Apache Kafka", "expected_class": "supported", "supporting_docs": ["C08", "C09", "C13", "P05", "P10"]},
            {"id": "R4", "text": "Automatisation de workflows avec n8n / Workato", "expected_class": "supported", "supporting_docs": ["C03", "C17", "P07", "P14"]},
            {"id": "R5", "text": "Gouvernance et sécurité des API", "expected_class": "supported", "supporting_docs": ["C01", "C19"], "note": "Contract-first patterns and enterprise governance evidenced on integration programmes."},
            {"id": "R6", "text": "Supervision 24/7 des flux en mode run", "expected_class": "partial", "supporting_docs": ["C01", "P01"], "note": "Monitoring patterns evidenced (runbook, dashboards) but no dedicated run/ops profile."},
            {"id": "R7", "text": "Déploiement Kubernetes avec service mesh", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R8", "text": "Interface web React de supervision", "expected_class": "unsupported", "supporting_docs": []},
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
            {"id": "R1", "text": "Data warehouse Snowflake avec transformations dbt", "expected_class": "supported", "supporting_docs": ["C08", "C10", "P05", "P13"]},
            {"id": "R2", "text": "Dashboards Power BI avec sécurité par ligne (RLS)", "expected_class": "partial", "supporting_docs": ["C05", "C07", "P08"], "note": "Power BI delivery evidenced; row-level security not explicitly evidenced."},
            {"id": "R3", "text": "Migration des flux SSIS legacy vers ELT cloud", "expected_class": "supported", "supporting_docs": ["C02", "C04", "C10", "P08", "P13"]},
            {"id": "R4", "text": "Harmonisation Tableau et Qlik Sense", "expected_class": "supported", "supporting_docs": ["C05", "C06", "P05", "P12"]},
            {"id": "R5", "text": "Gouvernance des données et catalogue de KPI", "expected_class": "supported", "supporting_docs": ["C05", "C08", "C19", "C20"]},
            {"id": "R6", "text": "Narration automatique de rapports par LLM", "expected_class": "partial", "supporting_docs": ["C11", "P15"], "note": "RAG/GenAI capability exists; automated report narration is adjacent."},
            {"id": "R7", "text": "Fine-tuning de LLM on-premise", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R8", "text": "Portail web React", "expected_class": "unsupported", "supporting_docs": []},
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
            {"id": "R1", "text": "RAG assistant over a document corpus", "expected_class": "supported", "supporting_docs": ["C11", "P04", "P15"]},
            {"id": "R2", "text": "Vector database and embedding pipeline", "expected_class": "supported", "supporting_docs": ["C11", "P15"]},
            {"id": "R3", "text": "NLP models with PyTorch", "expected_class": "supported", "supporting_docs": ["C11", "C14", "P04"]},
            {"id": "R4", "text": "Search infrastructure with Elasticsearch", "expected_class": "supported", "supporting_docs": ["C11", "P04"]},
            {"id": "R5", "text": "Workflow automation with n8n", "expected_class": "supported", "supporting_docs": ["C03", "C17", "P07", "P14"]},
            {"id": "R6", "text": "OCR and vision on scanned documents", "expected_class": "partial", "supporting_docs": ["C13", "P10"], "note": "OpenCV image classification evidenced; OCR not evidenced."},
            {"id": "R7", "text": "On-premise GPU cluster for open-source LLMs", "expected_class": "unsupported", "supporting_docs": []},
            {"id": "R8", "text": "Mobile Flutter client application", "expected_class": "unsupported", "supporting_docs": []},
        ],
    },
]

CLASS_WEIGHTS = {"supported": 1.0, "partial": 0.5, "unsupported": 0.0, "unknown": 0.0}

# ---------------------------------------------------------------------------
# PDF writer (A4, Helvetica, WinAnsi) with a strict one-page guard
# ---------------------------------------------------------------------------

def slugify(text: str, limit: int = 48) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode("ascii")
    folded = re.sub(r"[^a-zA-Z0-9]+", "-", folded).strip("-").lower()
    return folded[:limit].strip("-") or "doc"


def _pdf_string(text: str) -> bytes:
    safe = text.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
    return safe.encode("cp1252", errors="replace")


def write_pdf(path: Path, lines: list[tuple[str, str]]) -> int:
    page_w, page_h, margin = 595, 842, 56
    styles = {
        "title": ("F1", 14, 19),
        "meta": ("F2", 8.5, 12),
        "head": ("F1", 10.5, 16),
        "body": ("F2", 9.5, 13.5),
        "gap": ("F2", 9.5, 10),
    }
    max_width = page_w - 2 * margin
    wrapped: list[tuple[str, str, float, float, str]] = []
    for kind, text in lines:
        font, size, lead = styles[kind]
        if kind == "gap":
            wrapped.append((kind, font, size, lead, ""))
            continue
        limit = max(20, int(max_width / (size * 0.52)))
        chunks = textwrap.wrap(text, width=limit) or [""]
        for chunk in chunks:
            wrapped.append((kind, font, size, lead, chunk))

    pages: list[list[tuple[str, str, float, int, str]]] = []
    current: list[tuple[str, str, float, int, str]] = []
    y = page_h - margin
    for kind, font, size, lead, chunk in wrapped:
        if y - lead < margin:
            pages.append(current)
            current = []
            y = page_h - margin
        current.append((kind, font, size, y, chunk))
        y -= lead
    if current:
        pages.append(current)

    if len(pages) > 1:
        raise SystemExit(f"One-page guard tripped for {path.name}: {len(pages)} pages. Trim the renderer content.")

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
        stream: list[str] = []
        for kind, font, size, line_y, chunk in page_lines:
            if not chunk:
                continue
            stream.append("BT")
            stream.append(f"/{font} {size:g} Tf")
            stream.append(f"1 0 0 1 {margin} {line_y:g} Tm")
            if kind == "meta":
                stream.append("0.4 g")
            if kind == "head":
                rule_y = line_y - 3.5
                stream.append("0.55 G 0.7 w")
                stream.append(f"{margin} {rule_y:g} m {page_w - margin} {rule_y:g} l S")
                stream.append("0 G 1 w")
            stream.append("(" + _pdf_string(chunk).decode("cp1252", errors="replace") + ") Tj")
            if kind == "meta":
                stream.append("0 g")
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
    return len(pages)


# ---------------------------------------------------------------------------
# Renderers (shared line model: kind in title/meta/head/body/gap)
# ---------------------------------------------------------------------------

def _contact_line(header: dict) -> str:
    parts = [header.get(k, "") for k in ("email", "phone", "location", "github", "linkedin")]
    return " | ".join(p for p in parts if p)


def _role_from_context(context: str) -> str:
    for sep in ("\u00b7", "\u2013"):
        if sep in context:
            return context.split(sep)[-1].strip()
    if " - " in context:
        return context.rsplit(" - ", 1)[-1].strip()
    return context.strip()


def render_cv(record: dict, version: int, extra_skills: dict[str, list[str]] | None = None) -> list[tuple[str, str]]:
    fr = record["output_language"] == "fr"
    tr = FR_TRANSLATIONS.get(record["id"], {}) if fr else {}
    heads = {
        "summary": "Profil" if fr else "Summary",
        "skills": "Compétences" if fr else "Skills",
        "languages": "Langues" if fr else "Languages",
        "projects": "Expérience projet" if fr else "Project experience",
        "leadership": "Leadership & engagement" if fr else "Leadership & volunteering",
        "education": "Formation" if fr else "Education",
        "certifications": "Certifications" if fr else "Certifications",
        "contact": "Contact" if fr else "Contact",
        "context": "Contexte" if fr else "Context",
        "results": "Résultats" if fr else "Results",
        "client": "Client" if fr else "Client",
        "desc": "Description" if fr else "Description",
        "tech": "Technologies" if fr else "Technologies",
        "usecases": "Cas d'usage" if fr else "Use cases",
        "relproj": "Projets liés" if fr else "Related projects",
        "relprof": "Profils liés" if fr else "Related profiles",
        "team": "Équipe" if fr else "Team",
    }

    skills = {cat: list(items) for cat, items in record["skills"].items()}
    for cat, additions in (extra_skills or {}).items():
        skills.setdefault(cat, [])
        for item in additions:
            if item not in skills[cat]:
                skills[cat].append(item)

    header = record["header"]
    tagline = tr.get("tagline", header["tagline"])
    summary = tr.get("summary", record["summary"])
    languages = tr.get("languages", list(record["languages"]))

    lines: list[tuple[str, str]] = [
        ("title", f'CV {record["id"]} - {record["document_title"]}'),
        ("meta", f'ID: {record["id"]} | version: v{version} | asset_type: cv | language: {record["output_language"]}'),
        ("meta", f'seniority: {record["seniority"]} | site: {record["site"]} | experience: {record["years_experience"]} years'),
        ("head", header["name"]),
        ("body", tagline),
        ("meta", _contact_line(header)),
        ("gap", ""),
        ("head", heads["summary"]),
        ("body", summary),
        ("gap", ""),
        ("head", heads["skills"]),
    ]
    for cat, items in skills.items():
        label = CATEGORY_FR.get(cat, cat) if fr else cat
        lines.append(("body", f"{label}: " + ", ".join(items)))
    lines += [
        ("gap", ""),
        ("head", heads["languages"]),
        ("body", "; ".join(languages)),
        ("gap", ""),
        ("head", heads["projects"]),
    ]
    project_tr = tr.get("projects", {})
    for exp in record["projects_experience"]:
        ptr = project_tr.get(exp["project_id"], {}) if fr else {}
        context = ptr.get("context", exp["context"])
        bullets = ptr.get("bullets", exp["bullets"])
        lines.append(("body", f'{exp["project_id"]} - {exp["title"]} ({exp["period"]})'))
        lines.append(("body", f'{heads["context"]}: {context}'))
        lines.extend(("body", f'- {bullet}') for bullet in bullets)
    lines += [("gap", ""), ("head", heads["leadership"])]
    for entry in record["leadership_volunteering"]:
        lead_tr = tr.get("leadership", {})
        role = lead_tr.get("role", entry["role"])
        lead_bullets = lead_tr.get("bullets", entry["bullets"])
        lines.append(("body", f'{entry["organisation"]} - {role} ({entry["period"]})'))
        lines.extend(("body", f'- {bullet}') for bullet in lead_bullets)
    lines += [("gap", ""), ("head", heads["education"])]
    edu_tr = tr.get("education", {})
    for entry in record["education"]:
        degree = edu_tr.get(entry["degree"], entry["degree"])
        lines.append(("body", f'{entry["school"]} - {degree} ({entry["period"]})'))
    lines += [("gap", ""), ("head", heads["certifications"])]
    if record["certifications"]:
        for entry in record["certifications"]:
            lines.append(("body", f'{entry["name"]} - {entry["issuer"]} ({entry["date"]})'))
    else:
        lines.append(("body", "(Aucune)" if fr else "(None)"))
    return lines


def render_project(record: dict, version: int, team: list[tuple[str, str]], extra_stack: list[str] | None = None) -> list[tuple[str, str]]:
    stack = list(record["stack"])
    for item in extra_stack or []:
        if item not in stack:
            stack.append(item)
    lines: list[tuple[str, str]] = [
        ("title", f'Project {record["id"]} - {record["title"]}'),
        ("meta", f'ID: {record["id"]} | version: v{version} | asset_type: project | language: en'),
        ("meta", f'sector: {record["sector"]} | duration: {record["duration_months"]} months'),
        ("meta", "stack: " + ", ".join(stack)),
        ("gap", ""),
        ("head", "Client"),
        ("body", record["client"]),
        ("gap", ""),
        ("head", "Description"),
        ("body", record["description"]),
        ("gap", ""),
        ("head", "Measurable result"),
        ("body", record["result"]),
        ("gap", ""),
        ("head", "Context"),
        ("body", record["context"]),
        ("gap", ""),
        ("head", "Challenges"),
        ("body", record["challenges"]),
        ("gap", ""),
        ("head", "Solution"),
        ("body", record["solution"]),
        ("gap", ""),
        ("head", "Deliverables"),
    ]
    lines.extend(("body", f"- {item}") for item in record["deliverables"])
    lines += [("gap", ""), ("head", "Team")]
    for cv_id, role in team:
        lines.append(("body", f"- {cv_id} - {role}"))
    return lines


def render_stack(record: dict, version: int, related_projects: str, related_profiles: str, extra: list[str] | None = None, removed: list[str] | None = None) -> list[tuple[str, str]]:
    technologies = list(record["technologies"])
    for item in extra or []:
        if item not in technologies:
            technologies.append(item)
    for item in removed or []:
        technologies = [t for t in technologies if t != item]
    lines: list[tuple[str, str]] = [
        ("title", f'Capability stack {record["id"]} - {record["title"]}'),
        ("meta", f'ID: {record["id"]} | version: v{version} | asset_type: stack | language: en'),
        ("meta", f'category: {record["category"]}'),
        ("gap", ""),
        ("head", "Description"),
        ("body", record["description"]),
        ("gap", ""),
        ("head", "Technologies"),
    ]
    lines.extend(("body", f"- {tech}") for tech in technologies)
    lines += [("gap", ""), ("head", "Use cases")]
    lines.extend(("body", f"- {use}") for use in record["use_cases"])
    lines += [("gap", ""), ("head", "Related projects"), ("body", related_projects)]
    lines += [("gap", ""), ("head", "Related profiles"), ("body", related_profiles)]
    return lines


# ---------------------------------------------------------------------------
# Main generation
# ---------------------------------------------------------------------------

def _parse_only(argv: list[str]) -> set[str] | None:
    if "--only" not in argv:
        return None
    idx = argv.index("--only")
    if idx + 1 >= len(argv):
        raise SystemExit("--only requires a comma-separated id list")
    return {item.strip().upper() for item in argv[idx + 1].split(",") if item.strip()}


def main() -> None:
    only = _parse_only(sys.argv[1:])
    source = json.loads(SOURCE.read_text(encoding="utf-8"))
    cvs = source["cvs"]
    projects = source["projects"]
    stacks = source["stack_capabilities"]
    cvs_by_id = {c["id"]: c for c in cvs}
    cv_names = {c["id"]: c["header"]["name"] for c in cvs}

    # Team map: project id -> [(cv_id, role)] derived from CV project experience.
    team_map: dict[str, list[tuple[str, str]]] = {p["id"]: [] for p in projects}
    for c in cvs:
        for exp in c["projects_experience"]:
            if exp["project_id"] in team_map:
                team_map[exp["project_id"]].append((c["id"], _role_from_context(exp["context"])))

    # Stack maps: related projects and related profiles by technology overlap.
    related_projects_map: dict[str, list[str]] = {}
    related_profiles_map: dict[str, list[str]] = {}
    for s in stacks:
        techs = set(s["technologies"])
        related_projects_map[s["id"]] = [p["id"] for p in projects if techs & set(p["stack"])]
        related_profiles_map[s["id"]] = [
            c["id"] for c in cvs
            if any(set(items) & techs for items in c["skills"].values())
        ]

    for folder in ("cvs", "projects", "stacks", "versions", "tenders", "labels"):
        path = OUT / folder
        if path.exists():
            for child in path.iterdir():
                child.unlink()
        path.mkdir(parents=True, exist_ok=True)
    readme = OUT / "README.md"
    if readme.exists():
        readme.unlink()

    manifest_files: list[dict] = []
    corpus_text_for_check: list[str] = []

    def emit(lines, folder, doc_id, slug_base, language, version, asset_type) -> str:
        name = f"{doc_id}_{slugify(slug_base)}_{language}_v{version}.pdf"
        target = OUT / folder / name
        write_pdf(target, lines)
        manifest_files.append({
            "id": doc_id,
            "version": f"v{version}",
            "asset_type": asset_type,
            "language": language,
            "format": "pdf",
            "file": str(target.relative_to(OUT)).replace("\\", "/"),
            "sha256": hashlib.sha256(target.read_bytes()).hexdigest(),
            "bytes": target.stat().st_size,
        })
        corpus_text_for_check.append("\n".join(text for _, text in lines))
        return name

    wanted = (lambda _id: True) if only is None else (lambda doc_id: doc_id in only)

    for record in cvs:
        if not wanted(record["id"]):
            continue
        emit(render_cv(record, 1), "cvs", record["id"], record["document_title"], record["output_language"], 1, "cv")
    for record in projects:
        if not wanted(record["id"]):
            continue
        team = [(cid, f'{cv_names[cid]} - {role}') for cid, role in team_map[record["id"]]]
        emit(render_project(record, 1, team), "projects", record["id"], record["title"], "en", 1, "project")
    for record in stacks:
        if not wanted(record["id"]):
            continue
        rel_proj = " | ".join(f'{pid} - {next(p["title"] for p in projects if p["id"] == pid)}' for pid in related_projects_map[record["id"]])
        rel_prof = " | ".join(f'{cid} {cv_names[cid]} ({cvs_by_id[cid]["seniority"]})' for cid in related_profiles_map[record["id"]])
        emit(render_stack(record, 1, rel_proj, rel_prof), "stacks", record["id"], record["title"], "en", 1, "stack")

    # v2 variants (re-indexation test)
    for doc_id, additions in V2_CV_SKILLS.items():
        if only is not None and doc_id not in only:
            continue
        record = cvs_by_id[doc_id]
        emit(render_cv(record, 2, extra_skills=additions), "versions", doc_id, record["document_title"], record["output_language"], 2, "cv")
    for doc_id, additions in V2_PROJECT_STACK.items():
        if only is not None and doc_id not in only:
            continue
        record = next(p for p in projects if p["id"] == doc_id)
        team = [(cid, f'{cv_names[cid]} - {role}') for cid, role in team_map[doc_id]]
        emit(render_project(record, 2, team, extra_stack=additions), "versions", doc_id, record["title"], "en", 2, "project")
    for doc_id, delta in V2_STACK_DELTA.items():
        if only is not None and doc_id not in only:
            continue
        record = next(s for s in stacks if s["id"] == doc_id)
        rel_proj = " | ".join(f'{pid} - {next(p["title"] for p in projects if p["id"] == pid)}' for pid in related_projects_map[doc_id])
        rel_prof = " | ".join(f'{cid} {cv_names[cid]} ({cvs_by_id[cid]["seniority"]})' for cid in related_profiles_map[doc_id])
        emit(render_stack(record, 2, rel_proj, rel_prof, extra=delta["add"], removed=delta.get("remove")), "versions", doc_id, record["title"], "en", 2, "stack")

    if only is not None:
        for item in manifest_files:
            print(f'{item["file"]} ({item["bytes"]} bytes)')
        print(f"Pilot generation done: {len(manifest_files)} file(s); one-page guard: OK")
        return

    # Tenders + labels
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
        "cvs": len(cvs),
        "projects": len(projects),
        "stacks": len(stacks),
        "total": len(cvs) + len(projects) + len(stacks),
        "v2_variants": len(V2_CV_SKILLS) + len(V2_PROJECT_STACK) + len(V2_STACK_DELTA),
        "languages": {
            "fr": sum(1 for f in manifest_files if f["version"] == "v1" and f["language"] == "fr"),
            "en": sum(1 for f in manifest_files if f["version"] == "v1" and f["language"] == "en"),
        },
        "formats": {"pdf": sum(1 for f in manifest_files if f["format"] == "pdf")},
    }
    manifest = {
        "source": "data/fake_cv_dataset.json",
        "source_sha256": hashlib.sha256(SOURCE.read_bytes()).hexdigest(),
        "generator": "dashboard/scripts/generate_corpus.py",
        "notes": "Synthetic corpus; no real clients or people. Labels and tenders are evaluation assets and are NOT meant for ingestion.",
        "upload_mapping": {"cvs/": "CV", "projects/": "Project", "stacks/": "Expertise (mapped to asset_type stack by ingestion)"},
        "counts": counts,
        "files": sorted(manifest_files, key=lambda f: (f["asset_type"], f["id"], f["version"])),
    }
    (OUT / "labels" / "corpus_manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    readme_text = """# Synthetic knowledge corpus

Deterministic fixtures generated by `dashboard/scripts/generate_corpus.py` from
`data/fake_cv_dataset.json` (never edit generated files by hand; edit the source
or the script overlays and regenerate).

## Layout

| Folder | Content | Upload category |
|---|---|---|
| `cvs/` | 20 CVs (C01-C20), 10 FR / 10 EN | CV |
| `projects/` | 15 project summaries (P01-P15), English | Project |
| `stacks/` | 6 capability stacks (STK-01..06), English | Expertise (mapped to `stack` by ingestion) |
| `versions/` | v2 variants of C02, P04, STK-01 for the re-indexation test | same as their v1 category |
| `tenders/` | Test tenders T-001..T-003 with expected match matrix | NOT for ingestion |
| `labels/` | `queries.json`, `match_matrix.json`, `corpus_manifest.json` | NOT for ingestion |

All 41 v1 documents are single-page A4 PDFs. Never upload `versions/`,
`tenders/` or `labels/` during the initial ingestion; v2 files are for the
re-indexation step only.

## Verification procedure

1. Upload the 41 v1 documents through the dashboard Knowledge base; confirm
   ingestion reaches `indexed` for every document and Qdrant point counts match
   the manifest.
2. Re-indexation: upload the three v2 variants from `versions/`. Counts must
   stay stable (no duplicate chunks) and obsolete v1 chunks must disappear.
3. Retrieval benchmark: run `labels/queries.json` through the evaluation
   workflow. Gate: hit@5 >= 8/10 positives, no endorsement on no-match queries.
4. Matching: submit `tenders/` through intake and compare requirement judgments
   against `labels/match_matrix.json` (supported/partial/unsupported classes
   and coverage percentages).

No-match zones are deliberate: no web development (React, Angular, Vue), no
Kubernetes or service mesh, no SAP. None of these terms appear anywhere in the
corpus.
"""
    (OUT / "README.md").write_text(readme_text, encoding="utf-8")

    # Self-checks: no-match zones must stay absent from ingested document text.
    joined = "\n".join(corpus_text_for_check).lower()
    word_terms = ["kubernetes", "react", "flutter", "istio", "angular", "vue", "django", "spring", "sap", "odoo", "wordpress", "mongodb", "redis", "graphql", "kotlin", "swift", "php"]
    phrase_terms = ["s/4hana", "service mesh", "next.js", "node.js", ".net"]
    leaked = [term for term in word_terms if re.search(r"\b" + re.escape(term) + r"\b", joined)]
    leaked += [term for term in phrase_terms if term in joined]
    if leaked:
        raise SystemExit(f"No-match zone terms leaked into corpus: {leaked}")

    print(f"Corpus generated in {OUT}")
    print(f"  files: {len(manifest_files)} ({counts['total']} v1 + {counts['v2_variants']} v2)")
    print(f"  languages: {counts['languages']}")
    print(f"  formats: {counts['formats']}")
    print("  one-page guard: OK (all documents)")
    print("  no-match zone check: OK")


if __name__ == "__main__":
    main()
