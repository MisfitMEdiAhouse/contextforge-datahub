"""ContextForge: metadata-aware code generation via the official DataHub MCP server.

The browser demo is deterministic and credential-free. This CLI can also run against a
configured DataHub instance and, only after explicit human approval, persist the approved
engineering decision back to DataHub as a Decision document via the MCP save_document tool.
"""
from __future__ import annotations

import argparse
import asyncio
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]


@dataclass
class Context:
    urn: str
    name: str
    owner: str
    tags: list[str]
    fields: list[dict[str, Any]]
    downstream: list[str]
    queries: list[str]


class FixtureAdapter:
    def __init__(self, path: Path = ROOT / "fixtures" / "datahub-context.json"):
        self.data = json.loads(path.read_text())

    async def resolve(self, request: str) -> Context:
        q = request.lower()
        entities = self.data["entities"]
        entity = entities[1] if any(k in q for k in ("order", "amount", "revenue")) else entities[0]
        return Context(
            entity["urn"],
            entity["name"],
            entity["owner"],
            entity.get("tags", []),
            entity["fields"],
            entity.get("downstream", []),
            entity.get("queries", []),
        )


class DataHubMCPAdapter:
    """Read and write through @acryldata/mcp-server-datahub over MCP stdio."""

    @staticmethod
    def _imports():
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
        except ImportError as exc:
            raise RuntimeError("Install dependencies with: pip install -r requirements.txt") from exc
        return ClientSession, StdioServerParameters, stdio_client

    async def resolve(self, request: str) -> Context:
        ClientSession, StdioServerParameters, stdio_client = self._imports()
        params = StdioServerParameters(
            command="npx",
            args=["-y", "@acryldata/mcp-server-datahub"],
            env=os.environ.copy(),
        )
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                search = _tool_json(await session.call_tool("search", {"query": request}))
                urn = _first_urn(search)
                if not urn:
                    raise RuntimeError("DataHub search returned no dataset URN")
                entity = _tool_json(await session.call_tool("get_entities", {"urns": [urn]}))
                schema = _tool_json(await session.call_tool("list_schema_fields", {"urn": urn}))
                lineage = _tool_json(
                    await session.call_tool("get_lineage", {"urn": urn, "direction": "downstream"})
                )
                queries = _tool_json(await session.call_tool("get_dataset_queries", {"urn": urn}))
                return normalize_mcp(urn, entity, schema, lineage, queries)

    async def save_decision(self, ctx: Context, request: str, artifacts: dict[str, str]) -> Any:
        """Persist an explicitly approved ContextForge decision into DataHub knowledge context."""
        ClientSession, StdioServerParameters, stdio_client = self._imports()
        env = os.environ.copy()
        # DataHub intentionally disables mutation tools by default. ContextForge only enables
        # them for this explicit --approve --write-back execution path.
        env["TOOLS_IS_MUTATION_ENABLED"] = "true"
        params = StdioServerParameters(
            command="npx",
            args=["-y", "@acryldata/mcp-server-datahub"],
            env=env,
        )
        payload = build_writeback_payload(ctx, request, artifacts)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                result = await session.call_tool("save_document", payload)
                return _tool_json(result)


def _tool_json(result: Any) -> Any:
    structured = getattr(result, "structured_content", None)
    if structured:
        return structured
    texts = []
    for item in getattr(result, "content", []) or []:
        text = getattr(item, "text", None)
        if text:
            texts.append(text)
    joined = "\n".join(texts)
    try:
        return json.loads(joined)
    except Exception:
        return {"text": joined}


def _first_urn(obj: Any) -> str | None:
    text = json.dumps(obj)
    marker = "urn:li:dataset:("
    start = text.find(marker)
    if start < 0:
        return None
    end = text.find('"', start)
    return text[start:end] if end > start else None


def normalize_mcp(urn: str, entity: Any, schema: Any, lineage: Any, queries: Any) -> Context:
    entity_text = json.dumps(entity)
    name = urn.split(",")[1].split(".")[-1] if "," in urn else urn
    tags = [tag for tag in ("PII", "Tier1") if tag in entity_text]
    owner = "unknown-owner"
    downstream: list[str] = []
    fields: list[dict[str, Any]] = []

    def harvest_names(value: Any):
        if isinstance(value, dict):
            for key, child in value.items():
                if key in ("name", "entityName") and isinstance(child, str):
                    downstream.append(child)
                harvest_names(child)
        elif isinstance(value, list):
            for child in value:
                harvest_names(child)

    def harvest_fields(value: Any):
        if isinstance(value, dict):
            if isinstance(value.get("fieldPath"), str):
                fields.append({"name": value["fieldPath"], "type": value.get("type", "UNKNOWN")})
            for child in value.values():
                harvest_fields(child)
        elif isinstance(value, list):
            for child in value:
                harvest_fields(child)

    harvest_names(lineage)
    harvest_fields(schema)
    query_text = [queries["text"]] if isinstance(queries, dict) and "text" in queries else []
    return Context(urn, name, owner, tags, fields, list(dict.fromkeys(downstream))[:20], query_text)


def generate(ctx: Context, request: str) -> dict[str, str]:
    q = request.lower()
    is_amount = any(k in q for k in ("amount", "decimal", "dollar", "revenue"))
    is_deprecation = "legacy_segment" in q or "deprecat" in q
    if is_amount:
        sql = """with source as (\n  select order_id, customer_id,\n    cast(total_amount as decimal(18,2)) / 100.0 as total_amount_dollars\n  from {{ source('commerce','orders') }}\n)\nselect * from source;"""
        yaml = """version: 2\nmodels:\n  - name: stg_orders\n    columns:\n      - name: total_amount_dollars\n        description: Normalized from integer cents using DataHub usage evidence.\n        tests: [not_null]"""
    elif is_deprecation:
        sql = """select customer_id, email, customer_tier,\n  customer_tier as legacy_segment -- temporary compatibility alias\nfrom {{ source('commerce','customers') }};"""
        yaml = """version: 2\nmodels:\n  - name: stg_customers\n    columns:\n      - name: legacy_segment\n        description: DEPRECATED compatibility alias pending downstream migration."""
    else:
        sql = """with source as (\n  select customer_id,\n    email as primary_email,\n    email as email, -- compatibility alias\n    customer_tier\n  from {{ source('commerce','customers') }}\n)\nselect * from source;"""
        yaml = """version: 2\nmodels:\n  - name: stg_customers\n    columns:\n      - name: primary_email\n        meta: {datahub_tags: [PII]}\n        tests: [not_null]\n      - name: email\n        description: DEPRECATED compatibility alias"""
    pr = f"""# ContextForge impact report\n\nTarget: {ctx.urn}\nOwner: {ctx.owner}\nTags: {', '.join(ctx.tags) or 'none'}\nDownstream: {', '.join(ctx.downstream) or 'none discovered'}\n\nHuman approval required before merge.\n"""
    return {"model.sql": sql, "schema.yml": yaml, "PR.md": pr}


def decision_markdown(ctx: Context, request: str, artifacts: dict[str, str]) -> str:
    return f"""# ContextForge approved change decision

## Request
{request}

## Target
`{ctx.urn}`

## DataHub evidence used
- Owner: {ctx.owner}
- Governance: {', '.join(ctx.tags) or 'none discovered'}
- Downstream assets: {', '.join(ctx.downstream) or 'none discovered'}
- Observed query patterns: {len(ctx.queries)}
- Schema fields discovered: {len(ctx.fields)}

## Decision
The generated migration was reviewed and explicitly approved for pull-request readiness. ContextForge did **not** auto-merge or execute the data change.

## Generated artifacts
- `model.sql`
- `schema.yml`
- `PR.md`

## Context memory
This Decision document is written back so future DataHub-connected agents can discover the approved rationale instead of reconstructing it from scratch.
"""


def build_writeback_payload(ctx: Context, request: str, artifacts: dict[str, str]) -> dict[str, Any]:
    return {
        "document_type": "Decision",
        "title": f"ContextForge decision — {ctx.name}",
        "content": decision_markdown(ctx, request, artifacts),
        "topics": ["ContextForge", "Data migration", "AI code generation"],
        "related_assets": [ctx.urn],
    }


async def main_async(args):
    if args.write_back and args.fixture:
        raise SystemExit("--write-back requires live DataHub MCP mode; fixture mode never mutates DataHub")
    if args.write_back and not args.approve:
        raise SystemExit("--write-back requires explicit --approve human authorization")

    adapter: FixtureAdapter | DataHubMCPAdapter = FixtureAdapter() if args.fixture else DataHubMCPAdapter()
    ctx = await adapter.resolve(args.request)
    artifacts = generate(ctx, args.request)
    writeback_payload = build_writeback_payload(ctx, args.request, artifacts)
    result: dict[str, Any] = {
        "context": ctx.__dict__,
        "artifacts": artifacts,
        "approval": "APPROVED" if args.approve else "REVIEW_REQUIRED",
        "write_back_preview": {"tool": "save_document", "arguments": writeback_payload},
    }

    if args.write_back:
        assert isinstance(adapter, DataHubMCPAdapter)
        result["write_back_result"] = await adapter.save_decision(ctx, args.request, artifacts)

    if args.out:
        out = Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        for name, content in artifacts.items():
            (out / name).write_text(content)
        (out / "evidence.json").write_text(json.dumps(ctx.__dict__, indent=2))
        (out / "writeback-preview.json").write_text(json.dumps(result["write_back_preview"], indent=2))
        (out / "approved-decision.md").write_text(decision_markdown(ctx, args.request, artifacts))

    print(json.dumps(result, indent=2))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("request")
    parser.add_argument("--fixture", action="store_true", help="Use deterministic bundled DataHub context snapshot")
    parser.add_argument("--out")
    parser.add_argument("--approve", action="store_true", help="Record explicit human approval of the generated decision")
    parser.add_argument(
        "--write-back",
        action="store_true",
        help="After --approve, persist the Decision to DataHub with MCP save_document",
    )
    args = parser.parse_args()
    asyncio.run(main_async(args))


if __name__ == "__main__":
    main()
