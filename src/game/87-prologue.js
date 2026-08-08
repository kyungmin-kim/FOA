  /* ============ 프롤로그 · 마지막 등대의 첫 근무 ============
     프롤로그는 이전 설정의 인양대 기록이 아니다.
     플레이어가 등대지기의 일을 처음 맡는 밤이며, 튜토리얼 전투는 첫 번째 연료 회수다.

     설명은 등대 기지와 잠수종, 카드 전투, 잠식의 순서로만 짧게 전달한다.
     프롤로그가 끝나면 플레이어는 특별한 영웅이 아니라, 다음 날에도 같은 일을 해야 하는
     새 등대지기가 된다. 프롤로그의 전투와 연출은 본편 덱·해금에 보너스를 주지 않는다. */

  function line(who, cls, text){ return {who, cls, text}; }
  function captain(text){ return {who:'늙은 등대지기', voice:true, text}; }

  function proSetHand(cards){
    S.battle.hand = cards.map(([owner,name])=>tutorialCard(owner,name)).filter(Boolean);
  }
  function proSpawn(list){
    S.battle.enemies = list;
    rollIntents();
  }
  function proFoe(name, intent){
    const base = FOE_SURFACE.find(f=>f.name===name) || FOE_SURFACE[0];
    return tutorialFoe(base.name, base.maxHp, base.atk, base.reach, base.role, base.icon, intent);
  }

  const INTENT_SMASH = {type:'attack_reach', val:12, label:'내려찍기', ic:IC_CLEAVER};
  const INTENT_GAZE  = {type:'whisper_rear', val:9, label:'등불 응시', ic:IC_GAZE};
  const INTENT_BITE  = {type:'attack_reach', val:7, label:'물어뜯기', ic:IC_CLEAVER};

  /* 이전 버전 저장·호출과의 호환을 위한 무상 결과값. 새 프롤로그는 선택 유물이나
     별도 보너스를 주지 않는다. */
  let PRO_ENDING = null;
  let PRO_SALVAGE = null;
  function proResetOutcome(){ PRO_ENDING = null; PRO_SALVAGE = null; }
  function proCutEnding(){ PRO_ENDING = 'cut'; }
  function proPullEnding(){ PRO_ENDING = 'pull'; PRO_SALVAGE = null; return null; }
  function proPulled(){ return false; }
  function proGrantOutcome(){ proResetOutcome(); return null; }
  function proShowSalvage(){ if(S && S.prologue){ S.prologue.salvage = null; render(); } }

  const PRO_OPEN = [
    {fade:'in', ms:900},
    {pause:360},
    {note:'마지막 등대의 불빛이 잠수종의 유리창을 쓸고 지나간다.'},
    {pause:360},
    {note:'빛이 닿는 곳만이 현실이다.'},
    {pause:420},
    {note:'늙은 등대지기가 낡은 연료 장부를 건넨다.'},
    captain('오늘 밤부터 네가 불을 맡는다.'),
    {note:'장부의 다음 줄에는 짧은 문장이 적혀 있다.\n고래기름이 없으면, 아침이 오지 않는다.'},
  ];

  const PRO_BRACE = [
    {note:'AP:\n카드는 AP를 소비한다.\nAP는 턴마다 회복되며, 남은 AP는 다음 턴으로 이월되지 않는다.\n단, 2AP 이상 남기면 다음 턴에 사용할 임시 AP 1을 얻는다.'},
    {note:'손패:\n카드는 손에 들어온 순서대로 보인다.\n빛이 약해지면 카드의 일부가 미상 상태로 오염될 수 있다.'},
    {wait:'card', name:'놋쇠 벽', hint:'놋쇠 벽 카드를 사용해 잠수종의 문을 막는다'},
    {note:'적은 다음 턴의 행동을 예고한다.\n등대의 빛은 적의 의도를 밝혀 주지만, 빛이 약해질수록 예고도 믿기 어려워진다.'},
    {wait:'endturn', foe:'익사체', hint:'적의 예고를 확인하고 턴을 끝낸다'},
    {pause:420},
    {note:'형체가 잠수종의 벽을 두드린다. 물속에 있어야 할 손이 유리 안쪽에 닿아 있다.'},
    captain('문을 열지 마라.'),
    {do:()=>sayMark('echo')},
    {note:'등대의 빛이 닿지 않는 곳에서는, 죽은 것이 아니라 바뀐 것이 돌아온다.'},
  ];

  const PRO_STRIKE = [
    {do:()=>{
      const b = S.battle;
      b.enemies.push(proFoe('소금에 전 예언자', INTENT_GAZE));
      b.turn = 2; b.ap = b.maxAp; b.tempAp = 0;
      b.enemies[0].intent = INTENT_BITE;
      proSetHand([['oracle','저주받은 조준']]);
    }},
    {note:'전열:\n각 클래스는 고유한 위치에서 행동한다.\n지정된 위치가 아니면 행동이 제한된다.'},
    {wait:'card', name:'저주받은 조준', domain:'enemy', foe:'소금에 전 예언자', hint:'지정카드의 대상을 선택한다'},
    {note:'심도압박:\n어둠에 오래 노출된 사람은 바다의 감각을 나눠 갖는다.\n심도압박이 100에 닿으면 전투 효율이 크게 떨어진다.'},
    {do:()=>proGlimmer()},
    {pause:620},
    {note:'유리 바깥에 작은 빛이 떠오른다. 별처럼 보이지만, 움직임은 등대의 불꽃과 같다.'},
    {do:()=>sayMark('starlight')},
  ];

  const PRO_ABYSS = [
    {fade:'out', ms:460},
    {do:()=>{
      const b = S.battle;
      proSpawn([
        proFoe('익사체', INTENT_SMASH),
        proFoe('조수의 신도', INTENT_BITE),
        proFoe('눈먼 그물지기', INTENT_GAZE),
      ]);
      b.turn = 3; b.ap = b.maxAp; b.tempAp = 0;
      b.hand = []; b.discard = [];
      b.deck = shuffle([
        ['vanguard','놋쇠 벽'], ['vanguard','쇠사슬 후려치기'], ['vanguard','방패 밀어치기'],
        ['chemist','부식산 투척'], ['chemist','섬광탄'], ['chemist','응급 봉합제'],
        ['priest','역병 주사'], ['priest','고해성사'], ['priest','속죄의 기도'],
        ['oracle','저주받은 조준'], ['oracle','예지의 눈'], ['oracle','심연의 시선'],
      ].map(([owner,name])=>tutorialCard(owner,name)).filter(Boolean));
      drawHand(5);
      S.erosion = 82;
      S.prologue.erosionShown = true;
      S.party.forEach(p=>{ if(p) p.block = 0; });
    }},
    {fade:'in', ms:460},
    {note:'잠식:\n잠식은 한 층 전체를 덮는 압박이다.\n빛의 경계가 무너지면 지역은 현실의 규칙을 따르지 않는다.'},
    {note:'고래기름:\n전투에서 무작위로 떨어질 수 있다.\n지금은 튜토리얼이므로 다음 등대지기에게 남는 연료는 없다.'},
    {wait:'turns', n:1, hint:'잠수종의 회수 장치가 내려올 때까지 버틴다'},
    {do:()=>{
      S.erosion = 91;
      const van = S.party[0];
      if(van && van.alive){
        van.hp = Math.min(van.maxHp, Math.max(6, van.hp + 6));
        queueFx('heal', van);
      }
      render();
    }},
    {pause:520},
    {do:()=>proBackflow()},
    {pause:620},
    {note:'죽은 익사자의 숨이 잠수종 안으로 스며든다.\n상처가 아문 것이 아니라, 다른 상태가 덧씌워진 것이다.'},
    {do:()=>sayMark('blood')},
    {wait:'turns', n:1, hint:'잠수종이 빛의 경계까지 올라올 때까지 버틴다'},
    {do:()=>{ S.erosion = 97; render(); }},
    {pause:360},
    {note:'등대의 빛이 유리창에 닿는다. 그 순간, 잠수종 바닥에 고래기름 한 방울이 남는다.'},
    {note:'늙은 등대지기의 목소리가 통신기를 통해 들린다.\n“불을 끄지 마라.”'},
  ];

  const PRO_FALL = [
    {do:()=>proEnterFall()},
    {pause:520},
    {do:()=>proFade('vanguard')},
    {pause:620},
    {do:()=>proFade('priest')},
    {pause:620},
    {do:()=>proFade('oracle')},
    {pause:700},
  ];

  const PRO_RECORD = [
    {do:()=>{ S.prologue.phase='record'; S.prologue.record=[]; S.prologue.recordFading=false; S.screen='prologueRecord'; render(); curtainReset(); }},
    {pause:650},
    {do:()=>proRecord('마지막 근무 · 탐사대 4명 · 귀환 0명')},
    {pause:1300, tap:true},
    {do:()=>proRecord('회수 연료 · 고래기름 0')},
    {pause:1300, tap:true},
    {do:()=>proRecord('등대 밝기 · 한 단계 하락')},
    {pause:1300, tap:true},
    {do:()=>proRecord('다음 등대지기에게 전달할 문장 · 절대로 불을 끄지 마라')},
    {pause:2400, tap:true},
    {do:()=>proRecordFade()},
    {pause:900},
  ];

  const PRO_TAVERN = [
    {do:()=>{ S.prologue.phase='tavern'; S.screen='prologueRecord'; S.prologue.record=[]; S.prologue.recordFading=false; render(); }},
    {pause:500},
    {note:'등대 기지의 문이 열린다. 늙은 등대지기는 탐사대의 이름을 묻지 않는다.'},
    {who:'늙은 등대지기', voice:true, text:'내일부터는 네가 내려가라.'},
    {note:'그는 같은 문장을 한 번 더 말한다.\n“절대로 불을 끄지 마라.”'},
    {fade:'out', ms:700},
    {do:()=>finishPrologue()},
  ];

  function proChain(){
    return [PRO_OPEN, PRO_BRACE, PRO_STRIKE, PRO_ABYSS, PRO_FALL, PRO_RECORD, PRO_TAVERN]
      .reduce((all, part)=>all.concat(part), []);
  }

  /* ── 시각 연출 ── */
  function proGlimmer(){
    const el = sceneFxLayer();
    if(!el) return;
    const wrap = document.createElement('div');
    wrap.className='pro-glimmer';
    wrap.innerHTML = Array.from({length:7},(_,i)=>`<i style="--x:${12+i*13}%;--y:${68+(i%3)*9}%;--d:${i*140}ms"></i>`).join('');
    el.appendChild(wrap);
    setTimeout(()=>wrap.remove(),2600);
  }
  function proBackflow(){
    const el=sceneFxLayer(), card=document.querySelector('.hero-card');
    if(!el || !card) return;
    const box=card.getBoundingClientRect(), host=el.getBoundingClientRect();
    const wrap=document.createElement('div');
    wrap.className='pro-backflow';
    wrap.style.left=(box.left-host.left+box.width/2)+'px';
    wrap.style.top=(box.top-host.top+box.height/2)+'px';
    wrap.innerHTML=Array.from({length:9},(_,i)=>`<i style="--a:${(i/9)*360}deg;--r:${30+(i%4)*9}px;--d:${i*45}ms"></i>`).join('');
    el.appendChild(wrap);
    setTimeout(()=>wrap.remove(),1500);
  }
  function proCutLine(){ S.erosion=100; render(); }
  function proEnterFall(){
    S.party.forEach(p=>{ if(p){ p.hp=0; p.dp=100; p.block=0; p.alive=false; p.collapsed=true; } });
    S.battle=null;
    S.prologue.phase='fall';
    S.prologue.gone=[];
    S.screen='prologueFall';
    render();
  }
  function proFade(cls){ S.prologue.gone.push(cls); render(); }
  function proRecord(text){ S.prologue.record.push(text); S.prologue.recordFading=false; render(); }
  function proRecordFade(){ S.prologue.recordFading=true; render(); }
  function proRecordClear(){ S.prologue.record=[]; S.prologue.recordFading=false; render(); }
