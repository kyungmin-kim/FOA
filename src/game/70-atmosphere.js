  /* ============ ATMOSPHERE ============ */
  function tierSlug(tier){
    if(tier==='표층') return 'surface';
    if(tier==='중층') return 'mid';
    return 'abyss';
  }
  function currentTier(){
    if(S.screen==='prologue' || S.screen==='prologueFall') return '심해';
    if(S.screen==='gameover') return '심해';
    if(S.screen==='emergencyExit' && S.emergencyExit) return S.emergencyExit.tier;
    if(S.screen==='battle' && S.battle) return S.battle.tier;
    if((S.screen==='rest' || S.screen==='aftermath') && S.pendingNode) return S.pendingNode.tier;
    /* 인양된 뒤에는 수면 위다 — 배경도 같이 밝아져야 올라왔다는 게 읽힌다 */
    if(S.screen==='escape' || S.screen==='tavern' || S.screen==='result') return '표층';
    if(S.screen==='map') return chapter().tier;
    return '표층';
  }
  function rand(min,max){ return Math.random()*(max-min)+min; }
  function bubbles(n){
    let html='';
    for(let i=0;i<n;i++){
      const left=rand(3,97).toFixed(1), size=rand(3,8).toFixed(1), dur=rand(14,24).toFixed(1), delay=(-rand(0,20)).toFixed(1);
      html += `<div class="bubble" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
    }
    return html;
  }
  function motes(n,kind){
    let html='';
    for(let i=0;i<n;i++){
      const left=rand(4,96).toFixed(1), top=rand(4,90).toFixed(1), size=rand(2,5).toFixed(1), dur=rand(14,24).toFixed(1), delay=(-rand(0,20)).toFixed(1);
      html += `<div class="mote mote-${kind}" style="left:${left}%;top:${top}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
    }
    return html;
  }
  /* 가라앉는 잿가루 — 어느 층이든 위에서 계속 내려온다 */
  function ashes(n){
    let html='';
    for(let i=0;i<n;i++){
      const left=rand(2,98).toFixed(1), size=rand(1,2.4).toFixed(1), dur=rand(20,38).toFixed(1), delay=(-rand(0,36)).toFixed(1);
      html += `<div class="ash" style="left:${left}%;width:${size}px;height:${size}px;animation-duration:${dur}s;animation-delay:${delay}s;"></div>`;
    }
    return html;
  }
  function atmoMarkup(slug){
    if(slug==='surface') return `<div class="atmo-gradient atmo-surface"></div><div class="beam beam1"></div><div class="beam beam2"></div>${bubbles(7)}${ashes(10)}`;
    if(slug==='mid') return `<div class="atmo-gradient atmo-mid"></div>${motes(8,'mid')}${ashes(14)}`;
    return `<div class="atmo-gradient atmo-abyss"></div>${motes(4,'abyss')}${ashes(8)}`;
  }

