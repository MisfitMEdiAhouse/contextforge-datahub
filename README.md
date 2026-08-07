# ContextForge

**Metadata-aware code generation grounded in DataHub context.**

ContextForge reads DataHub schema, lineage, ownership, governance signals, and query patterns **before** generating production-useful data artifacts. Instead of treating code generation as autocomplete, it treats every change as an impact decision:

**discover context → assess blast radius → generate code + tests → require human approval → preserve the approved decision as shared DataHub context**

> Hackathon lane: **Metadata-Aware Code Generation & Development**  
> License: **Apache-2.0**  
> Clean-room note: this public project contains no proprietary GHOSBC/Misfit private source or algorithms.

## What it generates

- dbt-compatible transformation/migration SQL
- schema tests and governance metadata
- PR-ready impact summary linked to DataHub evidence
- machine-readable evidence record
- approved Decision document for DataHub context memory

See [`examples/`](examples/) for generated artifacts.

## DataHub integration

Live mode connects to the official **DataHub MCP Server** (`@acryldata/mcp-server-datahub`) and calls:

1. `search` — discover the target dataset from the change request
2. `get_entities` — retrieve ownership/governance context
3. `list_schema_fields` — ground generated code in the real schema
4. `get_lineage` — identify downstream blast radius
5. `get_dataset_queries` — learn production usage patterns
6. `save_document` — **after explicit human approval**, persist the engineering decision as a DataHub `Decision` document linked to the affected asset

The official DataHub MCP server keeps mutation tools disabled by default. ContextForge only enables mutation mode inside the explicit `--approve --write-back` path.

## Quick demo

Open `index.html` or visit the hosted demo. The browser demo uses a bundled DataHub-shaped context snapshot so judges can explore the workflow instantly without credentials.

The browser intentionally **does not fake a DataHub mutation**. It uses local browser memory to demonstrate the experience, while the CLI below contains the actual MCP write-back implementation.

## CLI — fixture mode

```bash
python src/contextforge.py \
  "Rename customers.email to primary_email while preserving downstream models and PII governance." \
  --fixture --out generated
```

Fixture mode never writes to DataHub.

## CLI — live DataHub MCP read mode

Prerequisites: Node 18+, Python 3.10+, a reachable DataHub instance, and the official DataHub MCP server configured per DataHub documentation.

```bash
pip install -r requirements.txt
npx -y @acryldata/mcp-server-datahub init

python src/contextforge.py \
  "Deprecate customers.legacy_segment and migrate downstream analytics to customer_tier." \
  --out generated
```

## CLI — governed DataHub write-back

This is the closed loop. The same analysis runs, artifacts are generated, and the write is impossible unless the operator supplies explicit approval:

```bash
python src/contextforge.py \
  "Deprecate customers.legacy_segment and migrate downstream analytics to customer_tier." \
  --approve \
  --write-back \
  --out generated
```

ContextForge then calls the official MCP tool:

```text
save_document
```

with:

```json
{
  "document_type": "Decision",
  "title": "ContextForge decision — customers",
  "content": "<approved request + DataHub evidence + decision rationale>",
  "topics": ["ContextForge", "Data migration", "AI code generation"],
  "related_assets": ["<target DataHub dataset URN>"]
}
```

That decision becomes reusable organizational context for future DataHub-connected agents.

See [`docs/DATAHUB_WRITEBACK.md`](docs/DATAHUB_WRITEBACK.md) for the exact safety contract.

## Why it matters

A schema-valid patch can still be operationally wrong if it ignores downstream lineage, PII classification, owners, or actual query behavior. ContextForge turns those DataHub signals into generation constraints.

For example, renaming `customers.email` is not emitted as a blind breaking rename. DataHub context can reveal that the field is governed and feeds downstream assets, so ContextForge can emit a compatibility-aware migration, carry governance metadata forward, list affected assets, generate tests, and stop at a human review gate.

The key difference is the **closed context loop**: after review, ContextForge can persist the approved decision itself back to DataHub so the next agent inherits the rationale instead of rediscovering it.

## Architecture

```text
Change request
    ↓
DataHub MCP Server
    ↓
search → entity → schema → lineage → query evidence
    ↓
Context normalization
    ↓
Evidence → impact → policy → Safety Gate
    ↓
SQL + tests + PR summary
    ↓
Human approval gate
    ↓
save_document (Decision linked to target asset)
    ↓
Context memory for the next agent
```

## Hackathon evaluation mapping

- **Use of DataHub:** five read-side MCP context surfaces plus an approved DataHub Decision write-back path.
- **Technical execution:** deterministic browser demo, live MCP adapter, governed mutation path, reproducible artifacts.
- **Originality:** code generation is constrained by blast radius and governance, then turns approved outcomes into reusable agent context.
- **Real-world usefulness:** designed for schema, type, and deprecation migrations data teams actually review.
- **Submission quality:** hosted Judge Mode, decision trace, downloadable report, Context Memory demonstration, examples and explicit technical truth labels.

## Safety / governance

ContextForge does not automatically merge generated code and does not silently mutate DataHub.

`--write-back` requires:

1. live DataHub mode
2. explicit `--approve`
3. configured DataHub authentication/permissions
4. DataHub MCP mutation tools enabled for that execution path

No credentials are stored in the repository.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
