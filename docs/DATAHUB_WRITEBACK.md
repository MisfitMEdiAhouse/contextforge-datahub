# ContextForge DataHub Write-Back Contract

ContextForge's browser demo is credential-free and never pretends to mutate a real catalog. The production CLI contains a separate governed write-back path using the official DataHub MCP server.

## Read path

ContextForge uses DataHub MCP to gather context before generation:

- `search`
- `get_entities`
- `list_schema_fields`
- `get_lineage`
- `get_dataset_queries`

## Decision boundary

Generation and authorization are separate actions.

A generated migration is **not** permission to write metadata or merge code.

ContextForge requires explicit operator authorization:

```bash
--approve --write-back
```

Without `--approve`, the CLI refuses `--write-back`.

Fixture mode also refuses `--write-back`.

## Write-back path

After approval, ContextForge calls the official DataHub MCP tool:

```text
save_document
```

The payload is a standalone `Decision` document linked to the affected dataset through `related_assets`.

Example:

```json
{
  "document_type": "Decision",
  "title": "ContextForge decision — customers",
  "content": "# ContextForge approved change decision\n...",
  "topics": ["ContextForge", "Data migration", "AI code generation"],
  "related_assets": [
    "urn:li:dataset:(urn:li:dataPlatform:snowflake,commerce.public.customers,PROD)"
  ]
}
```

## Why a Decision document

The approved engineering rationale is useful context in its own right. Persisting it as a DataHub Decision means a later DataHub-connected agent can discover the prior migration decision instead of reconstructing it from source code, chat history, or tribal knowledge.

The document records:

- requested change
- affected DataHub asset
- owner/governance context
- downstream dependencies
- observed query evidence count
- generated artifact set
- explicit statement that the code was approved for PR readiness but not auto-merged

## Mutation safety

The official DataHub MCP server disables mutation tools by default. ContextForge sets `TOOLS_IS_MUTATION_ENABLED=true` only inside the explicit write-back execution path.

A successful write still requires the configured DataHub identity to have permission to create the document.

ContextForge does not store DataHub credentials.

## Browser demo vs live integration

Browser Judge Mode:

```text
fixture graph → decision trace → artifacts → approval → local Context Memory
```

Live CLI:

```text
DataHub MCP reads → decision trace → artifacts → approval → DataHub save_document
```

The browser's local-storage memory is intentionally labeled as a simulation of the user experience. The CLI is the implementation of the real DataHub persistence path.
