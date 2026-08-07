let fixture; let artifacts={}; let active='sql';
const requestEl=document.getElementById('request'), output=document.getElementById('output'), ctx=document.getElementById('contextCards'), risk=document.getElementById('riskBadge'), approve=document.getElementById('approve');
fetch('fixtures/datahub-context.json').then(r=>r.json()).then(j=>{fixture=j; renderContext(null)});
document.querySelectorAll('[data-preset]').forEach(b=>b.onclick=()=>requestEl.value=b.dataset.preset);
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.tab').forEach(x=>x.classList.remove('active'));b.classList.add('active');active=b.dataset.tab;renderArtifact()});

document.getElementById('generate').onclick=()=>{
 const q=requestEl.value.toLowerCase();
 const entity=q.includes('order')||q.includes('amount')||q.includes('revenue')?fixture.entities[1]:fixture.entities[0];
 const isRename=q.includes('rename')||q.includes('primary_email');
 const isType=q.includes('amount')||q.includes('decimal')||q.includes('dollar');
 const field=isType?entity.fields.find(f=>f.name==='total_amount'):entity.fields.find(f=>f.name==='email')||entity.fields[0];
 const high=(field.tags||[]).includes('PII')||entity.tags.includes('Tier1');
 renderContext({entity,field});
 artifacts=generate(entity,field,{isRename,isType,q});
 risk.textContent=high?'HIGH IMPACT • REVIEW REQUIRED':'MEDIUM IMPACT';risk.style.color=high?'#ff9c9c':'#ffcc66';
 approve.disabled=false;approve.textContent='Approve artifact';renderArtifact();
}
approve.onclick=()=>{approve.textContent='APPROVED — ready for PR';approve.disabled=true};
function renderContext(sel){ctx.innerHTML='';const cards=sel?[
 ['Schema',`${sel.entity.name}.${sel.field.name} • ${sel.field.type} • ${sel.field.nullable?'nullable':'required'}`],
 ['Lineage',`${sel.entity.downstream.length} downstream assets: ${sel.entity.downstream.join(', ')}`],
 ['Ownership',`${sel.entity.owner} owns this ${sel.entity.platform} dataset`],
 ['Governance',`${[...(sel.entity.tags||[]),...(sel.field.tags||[])].join(', ')||'No tags'}`],
 ['Usage',`${sel.entity.queries.length} observed query pattern(s) inform generated compatibility logic`]
]:[['Schema','Waiting for change request'],['Lineage','Waiting for target asset'],['Ownership','Waiting for DataHub context'],['Governance','Waiting for trust signals'],['Usage','Waiting for query evidence']];
 cards.forEach(([k,v])=>ctx.innerHTML+=`<div class="context-card"><b>${k}</b><span>${v}</span></div>`)}
function generate(e,f,o){
 if(o.isType){return {
 sql:`-- ContextForge generated dbt migration\n-- Grounded in DataHub: ${e.urn}\n\nwith source as (\n  select\n    order_id,\n    customer_id,\n    cast(total_amount as decimal(18,2)) / 100.0 as total_amount_dollars\n  from {{ source('commerce', 'orders') }}\n)\nselect * from source;`,
 yaml:`version: 2\nmodels:\n  - name: stg_orders\n    columns:\n      - name: total_amount_dollars\n        description: "Order amount normalized from integer cents using DataHub usage evidence."\n        tests:\n          - not_null\n          - dbt_utils.expression_is_true:\n              expression: ">= 0"`,
 pr:`## ContextForge impact-aware migration\n\n**DataHub evidence**\n- Owner: ${e.owner}\n- Downstream: ${e.downstream.join(', ')}\n- Observed query: \`${e.queries[0]}\`\n\n**Change**\nIntroduce \`total_amount_dollars DECIMAL(18,2)\` while preserving the source cents field during migration.\n\n**Risk gate**\nTier1 dataset — human review required before merge.\n\n**Validation**\nCompare aggregate revenue before/after normalization and run downstream contract tests.`};}
 return {
 sql:`-- ContextForge generated dbt compatibility migration\n-- DataHub says ${e.name}.${f.name} is PII and feeds ${e.downstream.length} downstream assets.\n\nwith source as (\n  select\n    customer_id,\n    email as primary_email,\n    email as email, -- temporary compatibility alias\n    customer_tier\n  from {{ source('commerce', 'customers') }}\n)\nselect * from source;`,
 yaml:`version: 2\nmodels:\n  - name: stg_customers\n    columns:\n      - name: primary_email\n        description: "Canonical customer email; renamed from email with compatibility window."\n        meta:\n          datahub_tags: [PII]\n        tests:\n          - not_null\n      - name: email\n        description: "DEPRECATED compatibility alias. Remove after downstream migration."`,
 pr:`## ContextForge impact-aware rename\n\n**DataHub evidence**\n- Schema: \`${e.name}.${f.name} ${f.type}\`\n- Governance: PII, Tier1\n- Owner: ${e.owner}\n- Downstream assets: ${e.downstream.join(', ')}\n- Usage pattern: \`${e.queries[0]}\`\n\n**Generated migration**\nAdd \`primary_email\` while retaining \`email\` as a temporary compatibility alias. Preserve PII classification and migrate downstream consumers before alias removal.\n\n**Human gate**\nHigh-impact PII change: approval required before PR merge.\n\n**DataHub write-back plan**\nAfter approval, save the migration decision to DataHub so future agents inherit the rationale.`};
}
function renderArtifact(){output.textContent=artifacts[active]||'Run an analysis to generate artifacts.'}
