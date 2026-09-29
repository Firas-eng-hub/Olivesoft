# RAG retrieval check — 2026-09-29

The connected Azure n8n draft `04_rag_search` (workflow `xQWRueCw6zpLkfCT`) ran ten labelled project queries in manual execution **249**. Each query used a 768-dimensional Gemini query embedding, filtered Qdrant to `asset_type=project` and `source=supabase_storage`, deduplicated by document, and returned five results. The node throttled provider requests to one per batch after execution 248 hit an embedding-provider 503 on a concurrent batch.

| Query | Language | Expected document | Rank |
| --- | --- | --- | ---: |
| Q-01 GCP/Snowflake/Terraform/Airflow warehouse | EN | `projet_13.txt` | 1 |
| Q-02 Entrepôt analytique GCP/Snowflake/Terraform/Airflow | FR | `projet_13.txt` | 1 |
| Q-03 Salesforce Lightning customer portal | EN | `projet_12.txt` | 1 |
| Q-04 Portail client Salesforce Lightning | FR | `projet_12.txt` | 1 |
| Q-05 Azure HR centralization across subsidiaries | EN | `projet_15.txt` | 1 |
| Q-06 Centralisation des données RH sur Azure | FR | `projet_15.txt` | 1 |
| Q-07 Azure/Kubernetes/Snowflake predictive maintenance | EN | `projet_14.txt` | 1 |
| Q-08 Maintenance prédictive Azure/Kubernetes/Snowflake | FR | `projet_14.txt` | 1 |
| Q-09 Talend/Kafka/Airflow retail integration | EN | `projet_01.txt` | 1 |
| Q-10 Intégration retail Talend/Kafka/Airflow | FR | `projet_01.txt` | 1 |

**Observed hit@5: 10/10.** All expected documents ranked first. Execution 247 established one successful query with source path and excerpt. The reusable `04_rag_search` workflow was published after the draft run. `11_rag_evaluation` then ran in n8n execution **254**, persisted the same 10/10 result in Supabase as evaluation run `ee2f3f5d-96f1-4854-88db-9befda2dfc4b`, and returned `gate_passed: true`. This verifies the labelled retrieval metric only; no-match judgments, lead matching, and the full release gate remain unverified.
