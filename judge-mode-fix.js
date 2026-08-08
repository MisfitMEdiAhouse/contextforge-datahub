// Judge Mode viewport + navigation hardening.
(function(){
  'use strict';
  const MIN_TOP=104,MIN_DOCK=220,GAP=18;
  let focusTimer1=null,focusTimer2=null;

  function dockH(){const d=document.getElementById('guideDock');return(!d||d.hidden)?0:Math.ceil(d.getBoundingClientRect().height)}
  function headerH(){const els=[document.querySelector('header'),document.querySelector('.topbar')].filter(Boolean);return els.length?Math.max(MIN_TOP,...els.map(e=>Math.ceil(e.getBoundingClientRect().height||0))):MIN_TOP}
  function scrollTarget(el){if(!el)return;const r=el.getBoundingClientRect();const top=headerH()+GAP;const bottom=window.innerHeight-Math.max(MIN_DOCK,dockH())-GAP;const usable=Math.max(180,bottom-top);let y;if(r.height>usable*.72){y=window.scrollY+r.top-top}else{y=window.scrollY+r.top-(top+Math.max(0,(usable-r.height)/2))}window.scrollTo({top:Math.max(0,y),behavior:'smooth'})}
  function focus(){const el=document.querySelector('.spotlight');if(!el)return;requestAnimationFrame(()=>requestAnimationFrame(()=>scrollTarget(el)))}

  function simplifyGuideCTA(){
    const next=document.getElementById('guideNext');
    const label=document.getElementById('guideStepLabel');
    if(!next||!label)return;
    const finalStep=/Step\s+14\s+of\s+14/i.test(label.textContent||'');
    const text=finalStep?'Restart demo':'Next';
    const aria=finalStep?'Restart guided demo':'Continue to next guided demo step';
    const title=finalStep?'Restart the guided demo':'Continue — ContextForge handles the next demo action automatically';
    if(next.textContent!==text)next.textContent=text;
    if(next.getAttribute('aria-label')!==aria)next.setAttribute('aria-label',aria);
    if(next.title!==title)next.title=title;
  }

  function afterGuideAction(){
    // app.js changes the CTA to its internal action label while rendering each step.
    // Normalize it immediately in the SAME click event before the browser paints,
    // so judges never see labels such as "Deprecation", "Approve", etc. flash.
    simplifyGuideCTA();
    clearTimeout(focusTimer1);clearTimeout(focusTimer2);
    focusTimer1=setTimeout(()=>{simplifyGuideCTA();focus()},140);
    focusTimer2=setTimeout(()=>{simplifyGuideCTA();focus()},460);
  }

  // Bubble phase is intentional. The app's button onclick runs first and renders
  // the new step; this handler then restores the public CTA to Next before paint.
  // Capture phase caused the internal action title to flash after every click.
  document.addEventListener('click',e=>{
    if(e.target.closest('#guideDock,#guideNext,#guideBack,#guideStart'))afterGuideAction();
  },false);

  window.addEventListener('resize',()=>{
    if(document.body.classList.contains('guide-active'))setTimeout(focus,100);
  });

  simplifyGuideCTA();
})();