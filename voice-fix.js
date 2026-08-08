// Clean cross-device Judge Mode voice + Misfit branding.
// Narration is driven by actual Judge Mode step changes, not button timing.
(function(){
  'use strict';

  const synth=window.speechSynthesis;
  const voiceBtn=document.getElementById('guideVoice');
  const startBtn=document.getElementById('guideStart');
  const guideText=document.getElementById('guideText');
  const guideStepLabel=document.getElementById('guideStepLabel');
  const closeBtn=document.getElementById('guideClose');
  if(!voiceBtn||!startBtn||!guideText||!guideStepLabel)return;

  const mark=document.querySelector('.brand .mark');
  if(mark){
    const img=document.createElement('img');
    img.src='assets/misfit-logo.webp';
    img.alt='Misfit Mediahouse skull and rose';
    img.width=46;
    img.height=46;
    img.decoding='async';
    img.style.cssText='width:46px;height:46px;display:block;object-fit:cover;border-radius:12px;box-shadow:0 0 0 1px rgba(57,217,138,.32),0 0 22px rgba(113,183,255,.16);background:#050908';
    mark.textContent='';
    mark.appendChild(img);
    mark.style.cssText='width:46px;height:46px;border-radius:12px;display:block;overflow:hidden;background:#050908;color:transparent;flex:0 0 46px';
  }

  if(!document.getElementById('judgeVolumeCue')){
    const cue=document.createElement('div');
    cue.id='judgeVolumeCue';
    cue.setAttribute('role','note');
    cue.innerHTML='<span aria-hidden="true" style="font-size:15px;line-height:1">🔊</span><span><strong>TURN VOLUME ON</strong> <span style="opacity:.86">· guided narration</span></span>';
    cue.style.cssText='display:flex;align-items:center;justify-content:center;gap:6px;width:100%;margin:8px 0 9px;padding:0;border:0;background:transparent;color:#ffd84d;font-size:12.5px;font-weight:700;line-height:1.2;letter-spacing:.025em;text-align:center;white-space:nowrap;text-shadow:0 0 10px rgba(255,216,77,.14);box-sizing:border-box;';
    startBtn.parentNode.insertBefore(cue,startBtn);
  }

  let enabled=true;
  let preferredVoice=null;
  let lastSpokenKey='';
  let timer=null;

  function chooseVoice(){
    if(!synth)return null;
    const voices=synth.getVoices()||[];
    preferredVoice=
      voices.find(v=>/^en-US/i.test(v.lang)&&/Google US English|Google.*English|Natural|Enhanced|Premium/i.test(v.name)) ||
      voices.find(v=>/^en-US/i.test(v.lang)&&/Samsung|Android/i.test(v.name)) ||
      voices.find(v=>/^en-US/i.test(v.lang)) ||
      voices.find(v=>/^en/i.test(v.lang)) ||
      voices[0] || null;
    return preferredVoice;
  }

  if(synth){
    chooseVoice();
    synth.addEventListener?.('voiceschanged',chooseVoice);
  }

  function setUi(on){
    enabled=!!on;
    voiceBtn.textContent=enabled?'🔊':'🔇';
    voiceBtn.setAttribute('aria-pressed',String(enabled));
    voiceBtn.title=enabled?'Voice narration on':'Voice narration off';
  }

  function stop(){
    clearTimeout(timer);
    timer=null;
    if(synth){try{synth.cancel();}catch(e){}}
  }

  function currentKey(){
    return `${guideStepLabel.textContent.trim()}|${guideText.textContent.trim()}`;
  }

  function narrateCurrent(force=false){
    if(!enabled||!synth)return;
    const text=guideText.textContent.trim();
    const key=currentKey();
    if(!text||(!force&&key===lastSpokenKey))return;
    lastSpokenKey=key;
    stop();
    timer=setTimeout(()=>{
      if(!enabled||currentKey()!==key)return;
      const utterance=new SpeechSynthesisUtterance(text);
      const voice=chooseVoice();
      if(voice)utterance.voice=voice;
      utterance.lang=(voice&&voice.lang)||'en-US';
      utterance.rate=.94;
      utterance.pitch=1;
      utterance.volume=1;
      // Deliberately no automatic retry: Chrome can report an interrupted
      // utterance as an error during step changes, which previously caused
      // the old slide to repeat over the new slide.
      try{synth.resume();synth.speak(utterance);}catch(e){}
    },140);
  }

  setUi(true);

  // Speak only when the rendered Judge Mode step actually changes.
  const observer=new MutationObserver(()=>narrateCurrent(false));
  observer.observe(guideStepLabel,{subtree:true,childList:true,characterData:true});
  observer.observe(guideText,{subtree:true,childList:true,characterData:true});

  // Start is a user gesture, which unlocks speech on Android Chrome.
  startBtn.addEventListener('click',()=>{
    lastSpokenKey='';
    setTimeout(()=>narrateCurrent(false),180);
  });

  voiceBtn.onclick=function(){
    if(enabled){setUi(false);stop();}
    else{setUi(true);lastSpokenKey='';narrateCurrent(true);}
  };

  closeBtn?.addEventListener('click',()=>{stop();lastSpokenKey='';});
  document.addEventListener('visibilitychange',()=>{
    if(document.visibilityState==='hidden')stop();
  });
})();