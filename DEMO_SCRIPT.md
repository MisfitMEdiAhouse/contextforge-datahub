# 3-minute demo script

**0:00–0:20 — Problem**  
Prompt-only code generation knows syntax, not blast radius. A harmless-looking rename can break dashboards, pipelines and PII controls.

**0:20–0:50 — DataHub grounding**  
Enter: “Rename customers.email to primary_email while preserving downstream models and PII governance.” Show ContextForge retrieving five evidence surfaces: schema, lineage, ownership, governance and observed query usage.

**0:50–1:35 — Generated artifacts**  
Show the dbt compatibility migration, schema tests, and PR summary. Call out that DataHub context turns a blind breaking rename into a staged compatibility migration and preserves PII metadata.

**1:35–2:00 — Human gate**  
Show HIGH IMPACT / REVIEW REQUIRED and the approval gate. Explain ContextForge does not auto-merge high-impact code.

**2:00–2:30 — Live integration architecture**  
Show README architecture and DataHub MCP tool sequence: search → get_entities → list_schema_fields → get_lineage → get_dataset_queries.

**2:30–2:50 — Second scenario**  
Switch to the amount migration preset. Generate DECIMAL dollars from integer cents and show downstream revenue impact.

**2:50–3:00 — Close**  
“ContextForge turns DataHub context into code-generation constraints, so agents generate artifacts a data team can actually review and merge.”
