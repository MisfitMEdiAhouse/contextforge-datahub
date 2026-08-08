# ContextForge — Devpost Submission Packet

Use this file as the canonical claim-safe submission copy for **Build with DataHub: The Agent Hackathon**.

## Project name

ContextForge

## Tagline

**DataHub-aware code generation that checks the blast radius before an AI coding agent writes or ships a data change.**

## Challenge category

**Metadata-Aware Code Generation & Development**

## DataHub technologies used

- DataHub OSS / Core Platform
- DataHub MCP Server

Do not select Agent Context Kit, DataHub Skills, or Analytics Agent for this build.

## Live project

https://contextforge-datahub-app.vercel.app/

## Public repository

https://github.com/MisfitMEdiAhouse/contextforge-datahub

## Demo video

**PUBLIC VIDEO URL — add after final <3-minute recording is uploaded to YouTube or Vimeo.**

## Short description

ContextForge turns DataHub metadata into a control layer for AI-assisted data code generation. Before generating a schema migration, it checks schema, lineage, ownership, governance, and observed usage to understand what the change could break. It then generates code, tests, and an evidence-linked PR summary, requires human approval for risky changes, and provides an explicitly authorized DataHub MCP `save_document` path for preserving the approved decision as reusable context for future agents.

## What it does

Prompt-only coding agents can generate syntactically valid changes that are operationally dangerous because they do not know the organization around the code: which dashboards depend on a field, who owns the dataset, whether the field is PII, or how production queries actually use it.

ContextForge inserts a metadata-aware decision layer before code generation:

**DataHub context → impact policy → code + tests → human approval → DataHub decision memory**

The demo covers three common data-change classes:

1. **PII column rename** — preserves governance classification and compatibility while downstream consumers migrate.
2. **Type migration** — uses lineage and observed usage to preserve business semantics when converting integer cents to decimal dollars.
3. **Deprecation** — retains a compatibility alias and blocks destructive removal until downstream migration is verified.

For each run, ContextForge turns five DataHub context signals into three reviewable artifacts:

- dbt-compatible migration/model SQL
- schema documentation/tests
- evidence-linked PR summary

High-impact changes stop at a human approval boundary. The AI can prepare the change, but it cannot approve a risky production change by itself.

After approval, the public CLI can persist the decision back to DataHub through the official MCP `save_document` tool when the operator explicitly supplies `--approve --write-back`. That creates a reusable Decision document linked to the affected asset so the next DataHub-connected agent can inherit the prior rationale instead of reconstructing it from scratch.

## How we built it

ContextForge has two intentionally separated execution surfaces:

### Judge-ready browser demo

The hosted browser experience is deterministic and credential-free so judges can test the complete workflow immediately. It uses a bundled DataHub-shaped context fixture and local browser memory to demonstrate the interaction model. Judge Mode drives a synchronized 14-step walkthrough and automatically performs the underlying scenario changes, analysis, artifact selection, approval, write-back preview, and memory follow-up.

The browser never pretends that a live DataHub mutation occurred.

### Public CLI / real DataHub MCP integration

The Python CLI connects to the official `@acryldata/mcp-server-datahub` MCP server. In live mode it uses:

1. `search`
2. `get_entities`
3. `list_schema_fields`
4. `get_lineage`
5. `get_dataset_queries`

Those signals are normalized into generation constraints and the Safety Gate decision.

The write-back path is deliberately harder to trigger than the read path. `--write-back` is rejected in fixture mode and rejected unless explicit `--approve` authorization is also present. Only that approved live path enables MCP mutation tools and calls `save_document` with a DataHub Decision linked to the target asset.

The public repository includes the browser source, CLI, fixture, examples, write-back contract, reproducible build configuration, and Apache 2.0 license. No DataHub credentials are stored in browser code or in the repository.

## Why DataHub matters

Without DataHub, a coding agent mostly sees the requested code change. With DataHub, it can reason over the surrounding data system before generating anything:

- **Schema** tells it what actually exists.
- **Lineage** reveals the downstream blast radius.
- **Ownership** identifies responsible humans and teams.
- **Governance** carries PII / trust constraints into generated artifacts.
- **Observed usage** exposes business semantics that schema alone cannot show.
- **Decision write-back** turns an approved outcome into shared context for the next agent.

That changes the workflow from:

**Prompt → code → deploy → discover damage**

into:

**Understand → assess impact → generate → govern → approve → remember**

## Challenges we ran into

The hardest part was not generating SQL. It was preserving technical truth while making the value obvious in a short judge experience.

We deliberately separated the deterministic browser demo from live DataHub mutation so a polished demo could never be mistaken for a real write. We also made the decision trace an auditable evidence/impact/policy/action summary rather than presenting hidden model reasoning. Finally, we treated human approval as a hard authorization boundary instead of another UI decoration.

A second challenge was making the demonstration self-explanatory. Judge Mode now keeps the public action as `NEXT`, performs the necessary underlying UI actions automatically, follows the narrated section, and finishes with a concise before/after business takeaway.

## Accomplishments we are proud of

- Uses five meaningful DataHub context surfaces before code generation.
- Generates three concrete, reviewable engineering artifacts.
- Demonstrates schema rename, type migration, and deprecation failure modes instead of one canned scenario.
- Makes the human approval boundary explicit for Tier1/governed changes.
- Implements an actual approved MCP `save_document` write-back path in the public CLI.
- Preserves approved decision rationale as reusable organizational context.
- Keeps the browser demo honest about fixture/local-state behavior.
- Includes sample generated outputs so judges can inspect artifact quality without running the project.
- Ships a public Apache-2.0 repository and a no-login hosted demo.

## What we learned

The most important insight is that better prompting is not enough for production AI coding agents. The missing ingredient is organizational context plus authorization boundaries.

Schema gives an agent syntax-level truth, but lineage, ownership, governance, and usage turn that into operational truth. DataHub is especially powerful because the same context layer can both inform a decision before generation and preserve the approved outcome afterward.

## What's next

The next product step is to expose the ContextForge decision/control contract directly to coding-agent workflows so they can request metadata-aware authorization before generating or executing risky data changes.

Additional governed-change domains such as cybersecurity infrastructure and live game backends are architecture expansion paths, not current integrations in this hackathon build.

## Testing instructions

1. Open the live project URL. No login is required.
2. Turn device/browser volume on.
3. Press **Start judge-ready guided demo** at the top or bottom of the application.
4. Use **NEXT** to run the complete 14-step Judge Mode walkthrough.
5. For source-level verification, inspect `src/contextforge.py`, `docs/DATAHUB_WRITEBACK.md`, and `examples/` in the public repository.
6. Fixture mode is reproducible with:

```bash
python src/contextforge.py \
  "Rename customers.email to primary_email while preserving downstream models and PII governance." \
  --fixture --out generated
```

7. Live DataHub write-back requires a configured DataHub instance plus explicit operator authorization:

```bash
python src/contextforge.py \
  "Deprecate customers.legacy_segment and migrate downstream analytics to customer_tier." \
  --approve \
  --write-back \
  --out generated
```

## Claim boundaries

- The browser demo uses fixture/local state; it does not claim a live DataHub mutation.
- The public CLI contains the real MCP read and explicitly approved `save_document` write-back path.
- ContextForge does not auto-merge generated production changes.
- Cybersecurity and gaming are architecture expansion paths only.
- ContextForge exposes a metadata-aware decision and control pattern that coding agents can use before generating or executing changes; it does not claim to tune every external AI agent.
- No proprietary GHOSBC source is included in the hackathon project.
- The project is a clean-room hackathon implementation built for this submission.
