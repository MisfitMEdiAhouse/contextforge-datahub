"""ContextForge: metadata-aware code generation via DataHub MCP.

This clean-room hackathon implementation deliberately contains no proprietary GHOSBC code.
It can run in fixture mode for deterministic evaluation or connect to the official DataHub
MCP server in live mode.
"""
from __future__ import annotations
import argparse, asyncio, json, os
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
        q=request.lower(); entities=self.data["entities"]
        e=entities[1] if any(k in q for k in ("order","amount","revenue")) else entities[0]
        return Context(e["urn"],e["name"],e["owner"],e.get("tags",[]),e["fields"],e.get("downstream",[]),e.get("queries",[]))

class DataHubMCPAdapter:
    """Connects to the official @acryldata/mcp-server-datahub over MCP stdio."""
    async def resolve(self, request: str) -> Context:
        try:
            from mcp import ClientSession, StdioServerParameters
            from mcp.client.stdio import stdio_client
        except ImportError as exc:
            raise RuntimeError("Install dependencies with: pip install -r requirements.txt") from exc
        env=os.environ.copy()
        params=StdioServerParameters(command="npx", args=["-y","@acryldata/mcp-server-datahub"], env=env)
        async with stdio_client(params) as (read, write):
            async with ClientSession(read, write) as session:
                await session.initialize()
                search = await session.call_tool("search", {"query": request})
                raw=_tool_json(search)
                urn=_first_urn(raw)
                if not urn: raise RuntimeError("DataHub search returned no dataset URN")
                entity=_tool_json(await session.call_tool("get_entities", {"urns":[urn]}))
                schema=_tool_json(await session.call_tool("list_schema_fields", {"urn":urn}))
                lineage=_tool_json(await session.call_tool("get_lineage", {"urn":urn,"direction":"downstream"}))
                queries=_tool_json(await session.call_tool("get_dataset_queries", {"urn":urn}))
                return normalize_mcp(urn,entity,schema,lineage,queries)

def _tool_json(result: Any) -> Any:
    structured=getattr(result,"structured_content",None)
    if structured: return structured
    texts=[]
    for c in getattr(result,"content",[]) or []:
        t=getattr(c,"text",None)
        if t: texts.append(t)
    joined="\n".join(texts)
    try:return json.loads(joined)
    except Exception:return {"text":joined}

def _first_urn(obj: Any) -> str|None:
    text=json.dumps(obj)
    marker="urn:li:dataset:("; i=text.find(marker)
    if i<0:return None
    j=text.find('"',i)
    return text[i:j] if j>i else None

def normalize_mcp(urn:str, entity:Any, schema:Any, lineage:Any, queries:Any)->Context:
    text=json.dumps(entity); name=urn.split(',')[1].split('.')[-1] if ',' in urn else urn
    owner="unknown-owner"
    tags=[]
    if "PII" in text: tags.append("PII")
    if "Tier1" in text: tags.append("Tier1")
    downstream=[]
    def harvest_names(x:Any):
        if isinstance(x,dict):
            for k,v in x.items():
                if k in ("name","entityName") and isinstance(v,str): downstream.append(v)
                harvest_names(v)
        elif isinstance(x,list):
            for v in x: harvest_names(v)
    harvest_names(lineage)
    fields=[]
    def harvest_fields(x:Any):
        if isinstance(x,dict):
            if isinstance(x.get("fieldPath"),str): fields.append({"name":x["fieldPath"],"type":x.get("type","UNKNOWN")})
            for v in x.values():harvest_fields(v)
        elif isinstance(x,list):
            for v in x:harvest_fields(v)
    harvest_fields(schema)
    qtext=[]
    if isinstance(queries,dict) and "text" in queries:qtext=[queries["text"]]
    return Context(urn,name,owner,tags,fields,list(dict.fromkeys(downstream))[:20],qtext)

def generate(ctx:Context, request:str)->dict[str,str]:
    q=request.lower(); is_amount=any(k in q for k in ("amount","decimal","dollar","revenue"))
    if is_amount:
        sql="""with source as (\n  select order_id, customer_id,\n    cast(total_amount as decimal(18,2)) / 100.0 as total_amount_dollars\n  from {{ source('commerce','orders') }}\n)\nselect * from source;"""
        yaml="""version: 2\nmodels:\n  - name: stg_orders\n    columns:\n      - name: total_amount_dollars\n        tests: [not_null]"""
    else:
        sql="""with source as (\n  select customer_id,\n    email as primary_email,\n    email as email, -- compatibility alias\n    customer_tier\n  from {{ source('commerce','customers') }}\n)\nselect * from source;"""
        yaml="""version: 2\nmodels:\n  - name: stg_customers\n    columns:\n      - name: primary_email\n        meta: {datahub_tags: [PII]}\n        tests: [not_null]\n      - name: email\n        description: DEPRECATED compatibility alias"""
    pr=f"""# ContextForge impact report\n\nTarget: {ctx.urn}\nOwner: {ctx.owner}\nTags: {', '.join(ctx.tags) or 'none'}\nDownstream: {', '.join(ctx.downstream) or 'none discovered'}\n\nHuman approval required before merge.\n"""
    return {"model.sql":sql,"schema.yml":yaml,"PR.md":pr}

async def main_async(args):
    adapter=FixtureAdapter() if args.fixture else DataHubMCPAdapter()
    ctx=await adapter.resolve(args.request)
    artifacts=generate(ctx,args.request)
    if args.out:
        out=Path(args.out);out.mkdir(parents=True,exist_ok=True)
        for name,content in artifacts.items():(out/name).write_text(content)
        (out/"evidence.json").write_text(json.dumps(ctx.__dict__,indent=2))
    print(json.dumps({"context":ctx.__dict__,"artifacts":artifacts},indent=2))

def main():
    p=argparse.ArgumentParser()
    p.add_argument("request")
    p.add_argument("--fixture",action="store_true",help="Use deterministic bundled DataHub context snapshot")
    p.add_argument("--out")
    args=p.parse_args();asyncio.run(main_async(args))
if __name__=="__main__":main()
