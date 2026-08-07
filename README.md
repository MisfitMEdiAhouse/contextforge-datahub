# ContextForge

**Metadata-aware code generation grounded in DataHub context.**

ContextForge reads DataHub schema, lineage, ownership, governance signals, and query patterns **before** generating production-useful data artifacts. Instead of treating code generation as autocomplete, it treats every change as an impact decision: discover context → assess blast radius → generate code + tests → require human approval → optionally write the decision back to DataHub.

> Hackathon lane: **Metadata-Aware Code Generation & Development**  
> License: **Apache-2.0**  
> Clean-room note: this public project contains no proprietary GHOSBC/Misfit private source or algorithms.

## What it generates

- dbt-compatible transformation/migration SQL
- schema tests and governance metadata
- PR-ready impact summary linked to DataHub evidence
- machine-readable evidence record

See [`examples/`](examples/) for generated artifacts.

## DataHub integration

Live mode connects to the official **DataHub MCP Server** (`@acryldata/mcp-server-datahub`) and calls:

1. `search` — discover the target dataset from the change request
2. `get_entities` — retrieve ownership/governance context
3. `list_schema_fields` — ground generated code in the real schema
4. `get_lineage` — identify downstream blast radius
5. `get_dataset_queries` — learn production usage patterns

The deterministic generator then produces merge-ready artifacts and stops at a human approval gate.

## Quick demo

Open `index.html` or visit the hosted demo. The browser demo uses a bundled DataHub-shaped context snapshot so judges can explore the workflow instantly without credentials.

## CLI — fixture mode

```bash
python src/contextforge.py \
  "Rename customers.email to primary_email while preserving downstream models and PII governance." \
  --fixture --out generated
```

## CLI — live DataHub MCP mode

Prerequisites: Node 18+, Python 3.10+, a reachable DataHub instance, and the official DataHub MCP server configured per DataHub documentation.

```bash
pip install -r requirements.txt
npx -y @acryldata/mcp-server-datahub init
python src/contextforge.py \
  "Rename customers.email to primary_email while preserving downstream models and PII governance." \
  --out generated
```

The Python MCP client launches `npx -y @acryldata/mcp-server-datahub` over stdio and uses official MCP tools. Authentication/endpoint configuration remains in the DataHub MCP server's standard configuration rather than being hard-coded into ContextForge.

## Why it matters

A schema-valid patch can still be operationally wrong if it ignores downstream lineage, PII classification, owners, or actual query behavior. ContextForge turns those DataHub signals into generation constraints.

For example, renaming `customers.email` is not emitted as a blind breaking rename. DataHub context shows it is PII, Tier1, and feeds downstream assets, so ContextForge emits a compatibility alias, carries governance metadata forward, lists the affected assets, and blocks at a human review gate.

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
Impact/risk plan
    ↓
SQL + tests + PR summary
    ↓
Human approval gate
    ↓
(optional) DataHub decision write-back
```

## Hackathon evaluation mapping

- **Use of DataHub:** five MCP context surfaces are used to ground generation.
- **Technical execution:** deterministic generator, fixture demo, live MCP adapter, reproducible examples.
- **Originality:** code generation is constrained by blast radius and governance, not prompt-only generation.
- **Real-world usefulness:** designed for risky schema/type/deprecation migrations data teams actually review.
- **Submission quality:** hosted demo, examples, clear README and 3-minute demo script.

## Safety / governance

ContextForge does not automatically merge generated code. High-impact changes are explicitly gated for human approval. No credentials are stored in the repository.

## License

Apache License 2.0. See [`LICENSE`](LICENSE).
