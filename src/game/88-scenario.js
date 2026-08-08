  /* ============ 본편 시나리오 · 마지막 등대 ============
     장면은 네 개의 시스템 챕터를 새 지역으로 번역한다.

       메아리의 여울 → 침몰한 항구
       역류의 이랑   → 뒤틀린 성당
       잔별의 구렁   → 거대한 난파선·산호 숲
       끝없는 심연   → 심해 연구소·고래의 무덤

     수문장은 종족명이나 전체 형태가 아니라, 빛 안으로 드러난 한 조각의 이름이다.
     컷신으로 정답을 설명하지 않고, NPC 대사·아이템·환경·기록의 충돌로 진실을 남긴다. */

  function crew(text){ return {crew:true, text}; }
  function leader(text){ return crew(text); }
  function reveal(text){ return {note:text}; }

  const WARDEN_ECHOES = {
    '메아리의 여울':['불을 지켜.','연료부터 확인해.'],
    '역류의 이랑':['기도를 멈춰.','빛이 아니라 문을 닫아.'],
    '잔별의 구렁':['고래를 깨우지 마.','별빛을 병에 담아.'],
    '끝없는 심연':['등대 아래를 보지 마.','불을 끄지 마.','족쇄를 건드리지 마.'],
  };
  function wardenEchoesFor(tier){ return WARDEN_ECHOES[tier] || []; }

  const MEET_SURFACE = [
    {pause:460},
    {note:'잠수종이 침몰한 항구의 부두에 닿는다. 등대의 빛은 여기까지 겨우 닿는다.'},
    {pause:360},
    {note:'선박의 등불은 모두 꺼져 있다. 그런데 부두 끝의 종 하나만 젖은 불꽃을 품고 있다.'},
    {do:()=>proGlimmerDark()},
    {pause:480},
    {note:'물속의 형체가 고래기름 통을 끌어안은 채 일어난다.'},
    {who:'익사자', voice:true, text:'불을… 돌려줘.'},
    {pause:300},
    reveal('항구의 등불 없는 수문장'),
  ];

  function surfaceAftermath(){
    return [
      {fade:'out', ms:500}, {pause:260}, {fade:'in', ms:620},
      {note:'수문장의 몸이 물과 기름으로 갈라진다.'},
      {note:'그 안에서 작은 유리병 하나가 굴러 나온다. 병 안의 기름은 파도 없이 흔들린다.'},
      {do:()=>{ acquireMarker('black_tide_spine'); S.surfaceReturnPending=true; learnRecord('surface'); }},
      {note:'첫 기록\n고래기름은 등대를 밝힌다.\n하지만 기름을 넣을 때마다 등대 아래의 무언가가 더 또렷해진다.'},
      {note:'잠수종의 벽에 오래된 손톱 자국이 보인다. 안쪽에서 밖으로 긁은 흔적이다.'},
    ];
  }

  function surfaceReturnScene(){
    if(!S || !S.surfaceReturnPending) return null;
    S.surfaceReturnPending=false;
    return [
      {fade:'out', ms:380}, {pause:220}, {fade:'in', ms:500},
      {note:'잠수종이 등대 기지의 수면에 닿는다. 고래기름 통이 무게를 더한다.'},
      {note:'늙은 등대지기가 통을 받아 든다. 그는 양을 세지 않고 불꽃을 세어 본다.'},
      {who:'늙은 등대지기', voice:true, text:'오늘은 아직 현실이다.'},
      {note:'등대의 빛이 잠시 넓어진다. 빛의 가장자리에서 검은 바다가 한 번 수축한다.'},
    ];
  }

  const MEET_MID = [
    {pause:460},
    {note:'잠수종이 뒤틀린 성당의 종탑 안으로 내려간다. 종은 모두 바닥을 향해 매달려 있다.'},
    {note:'제단 앞에서 사람이 무릎을 꿇고 있다. 기도문은 위가 아니라 아래로 흐른다.'},
    {do:()=>proGlimmerDark()},
    {pause:420},
    {who:'심연 사제', voice:true, text:'빛은 구원이 아니다. 빛은 길을 고정하는 못이다.'},
    crew('무엇을 고정하지?'),
    {who:'심연 사제', voice:true, text:'아직 이름을 붙이지 마라.'},
    {pause:600},
    reveal('거꾸로 매달린 성가대'),
  ];

  function midAftermath(){
    const beats=[
      {fade:'out',ms:480},{pause:260},{fade:'in',ms:620},
      {note:'제단 아래에서 금속판이 나온다. 한쪽에는 기도문, 다른 쪽에는 연료 사용량이 적혀 있다.'},
      {note:'성당은 심연을 숭배한 곳이 아니었다. 누군가 등대의 불을 유지하기 위해 사람을 바꾸고 있었다.'},
      {do:()=>learnRecord('mid')},
      {note:'미치광이 외과의사가 잠수종 창 너머를 바라본다.\n“장기가 아니라, 등대에 넣을 부품을 찾는 거야.”'},
    ];
    return beats;
  }

  const MEET_DEEP = [
    {pause:500},
    {note:'거대한 난파선이 산호 숲에 박혀 있다. 선체의 갈비뼈 사이로 푸른 빛이 흐른다.'},
    {note:'산호는 바위가 아니다. 오래된 항해일지의 문장을 따라 자란다.'},
    {do:()=>proGlimmerDark()},
    {pause:420},
    {note:'하늘에서 떨어진 별고래가 난파선 위에 누워 있다. 죽은 몸 안에서 별빛이 새어 나온다.'},
    {who:'난파선 도굴꾼', voice:true, text:'저건 보물이 아니야. 등대가 먹는 흔적이지.'},
    {pause:620},
    reveal('산호를 두른 별고래'),
  ];

  function deepAftermath(){
    return [
      {fade:'out',ms:520},{pause:300},{fade:'in',ms:640},
      {note:'별고래의 갈비뼈에서 납작한 관측판이 떨어진다.'},
      {note:'관측판에는 등대가 아니라, 등대 아래에 박힌 거대한 말뚝이 그려져 있다.'},
      crew('관측판에는 마지막 문장만 남아 있다.'),
      {note:'“빛이 닿는 곳만이 현실이다.”\n그 아래에 다른 손으로 한 줄이 덧붙었다.\n“그래서 빛을 계속 켜 두었다.”'},
      {do:()=>learnRecord('deep')},
    ];
  }

  function abyssTestimony(){
    return [
      {note:'세 번째 수문장을 지나도 잠수종은 위로 오르지 않는다.'},
      {note:'심해 연구소의 방향표가 잠수종 안쪽에서 켜진다. 표면으로 가는 길에는 표시가 없다.'},
      {note:'지금까지의 기록이 저절로 펼쳐진다.\n기름의 양.\n빛의 범위.\n등대 아래의 말뚝.'},
      {note:'가장 오래된 항해일지에는 이전 기록과 반대되는 문장이 있다.\n“등대는 세상을 지키는 것이 아니다.”'},
      {pause:520},
      {fade:'out',ms:700},
    ];
  }

  const MEET_ABYSS = [
    {pause:560},
    {note:'심해 연구소의 관측실은 고래의 무덤 위에 매달려 있다.'},
    {note:'유리관마다 등대의 불꽃이 들어 있다. 어떤 불꽃은 아직 살아 있고, 어떤 불꽃은 안쪽에서 두드린다.'},
    {do:()=>proSilhouette()},
    {note:'연구소 기록 속의 과학자들은 심연의 신을 깨운 사람이 아니라, 심연을 묶어 둔 사람들이다.'},
    {note:'기록이 끊긴다. 관측실 바닥 아래에서 거대한 맥박이 올라온다.'},
    {do:()=>learnRecord('abyss')},
    {pause:420},
    reveal('심연의 태동'),
  ];

  const ABYSS_PHASE2 = [
    {pause:420},
    reveal('심연의 태동'),
    {note:'빛이 존재를 고정하고 있다. 고정된 것은 잠들어 있는 것이 아니라, 깨어나는 중이다.'},
    {who:'심연의 태동', voice:true, text:'더 많은 기름을 가져와라.'},
    crew('등대가 너를 붙잡고 있어.'),
    {who:'심연의 태동', voice:true, text:'등대가 나를 붙잡는 것이 아니다.'},
    {pause:420},
    {note:'말뚝의 금이 빛을 따라 벌어진다. 등대와 심연은 같은 불꽃을 나누고 있다.'},
  ];

  function abyssAftermath(){
    return [
      {pause:500},
      {note:'심연의 태동이 쓰러진 것이 아니다. 한순간, 빛과 함께 멈췄을 뿐이다.'},
      {note:'등대 아래에서 말뚝의 머리가 드러난다. 인간이 만든 감옥의 손잡이다.'},
      {note:'낡은 항해일지의 마지막 장이 열린다.\n“불을 끄면 세상은 끝난다.”\n“불을 켜 두면 심연은 완전히 깨어난다.”'},
      {do:()=>learnRecord('nemorum')},
      {fade:'out',ms:760},
      {note:'귀환 장치가 작동한다. 잠수종 안에는 생존자와 등대 연료가 남아 있다.'},
      {fade:'in',ms:700},
    ];
  }

  const ABYSS_RETURN = [
    {do:()=>curtainReset()},
    {pause:460},
    {note:'등대 기지의 빛이 잠수종을 맞는다. 빛의 범위가 이전보다 넓어졌는지 좁아졌는지 알 수 없다.'},
    {note:'늙은 등대지기가 고래기름을 받아 든다. 그의 손에는 검은 기름이 묻지 않는다.'},
    {who:'늙은 등대지기', voice:true, text:'다음 밤에도 내려가야 한다.'},
    {note:'인양은 성공했다. 그러나 등대 아래의 문은 더 선명해졌다.'},
  ];
  function abyssReturn(){ return ABYSS_RETURN.slice(); }

  /* ============ 심연의 열쇠로 여는 다른 결말 ============
     본편을 한 번 완주한 뒤, 히든 갈림길 네 개의 열쇠를 전부 들고, 서약을 걸고
     자유 탐사의 끝없는 심연에 도달했을 때만 갈라진다. 이번 범위는 서사와 기록
     플래그까지만 다룬다 — 새 유물 등급이나 새 스탯 보상은 만들지 않는다. */
  function trueAbyssAftermath(){
    markTrueEnding();
    return [
      {pause:500},
      {note:'심연의 태동이 쓰러지지 않는다. 대신, 등대 아래의 말뚝 전체가 한 번에 드러난다.'},
      {note:'네 개의 열쇠가 손안에서 하나로 들러붙는다 — 항구, 성당, 난파선, 연구소. 전부 같은 자물쇠의 부품이었다.'},
      {note:'낡은 항해일지에 없던 마지막 장이 열린다.\n“말뚝을 뽑는 것도, 더 깊이 박는 것도 등대지기의 일이 아니다.”\n“그저 여기까지 다시 내려온 사람만이 고를 수 있다.”'},
      {do:()=>learnRecord('true_nemorum')},
      {fade:'out',ms:900},
      {note:'잠수종의 창 밖으로 빛도 어둠도 아닌 것이 지나간다.'},
      {fade:'in',ms:760},
    ];
  }
  const TRUE_ABYSS_RETURN = [
    {do:()=>curtainReset()},
    {pause:460},
    {note:'등대 기지로 돌아왔지만, 등불의 색이 조금 다르다. 아무도 그 차이를 말로 옮기지 못한다.'},
    {note:'늙은 등대지기가 처음으로 다른 말을 한다.'},
    {who:'늙은 등대지기', voice:true, text:'...그래서, 무엇을 보았나.'},
    {note:'질문에는 답하지 않는다. 다음 밤은 여전히 온다.'},
  ];
  function trueAbyssReturn(){ return TRUE_ABYSS_RETURN.slice(); }

  /* 자유 탐사의 최심층에서, 서약을 걸고 열쇠를 전부 모았을 때만 실질적인 두 번째 분기다.
     그 외에는 지금까지와 같은 abyssAftermath 하나뿐이다. */
  function trueEndingReady(){
    return !!(S && S.free && (S.pactDepth||0)>0 && typeof hasAllAbyssKeys==='function' && hasAllAbyssKeys());
  }

  const MEETINGS = {'메아리의 여울':MEET_SURFACE,'역류의 이랑':MEET_MID,'잔별의 구렁':MEET_DEEP,'끝없는 심연':MEET_ABYSS};
  const AFTERMATHS = {'메아리의 여울':surfaceAftermath,'역류의 이랑':midAftermath,'잔별의 구렁':deepAftermath,'끝없는 심연':abyssAftermath};
  function bossPhaseTwoScript(en){ return en && en.hiddenName ? ABYSS_PHASE2.slice() : null; }
  function wardenMeeting(tier){ return MEETINGS[tier] ? MEETINGS[tier].slice() : null; }
  function wardenAftermath(tier){
    if(tier==='끝없는 심연' && trueEndingReady()) return trueAbyssAftermath();
    return AFTERMATHS[tier] ? AFTERMATHS[tier]() : null;
  }

  /* ── 영구 기록 ── */
  const RECORD_KEY = 'fathom.records.v2';
  const RECORD_DEFS = {
    surface:{title:'침몰한 항구 · 고래기름 장부',lines:[
      '고래기름은 별고래의 사체에서만 나오는 것이 아니다.',
      '등대의 빛이 닿지 않는 곳에서 인간의 몸도 연료로 변한다.',
      '첫 장부에는 등대 밝기와 함께 바다의 맥박이 커진다는 기록이 있다.',
    ]},
    mid:{title:'뒤틀린 성당 · 봉인 의식',lines:[
      '성당의 의식은 심연을 숭배하기 위한 것이 아니었다.',
      '사람의 장기를 바꾸어 고래기름을 정제하고 있었다.',
      '사제들은 자신들이 구원받는다고 믿었지만, 실제로는 등대의 부품이 되었다.',
    ]},
    deep:{title:'난파선·산호 숲 · 관측판',lines:[
      '별고래의 별빛은 하늘에서 떨어진 것이 아니라 심연에서 새어 나온 것이다.',
      '산호는 항해일지의 문장을 먹고 자란다.',
      '등대 아래에는 인간이 박아 넣은 거대한 말뚝이 있다.',
    ]},
    abyss:{title:'심해 연구소 · 봉인의 원리',lines:[
      '연구소의 사람들은 심연을 죽일 수 없다는 사실을 알고 있었다.',
      '그들은 등대를 말뚝으로 사용해 심연을 현실에 고정했다.',
      '빛이 꺼지면 인간의 세계가 먼저 무너진다.',
    ]},
    nemorum:{title:'고래의 무덤 · 마지막 항해일지',lines:[
      '등대는 세상을 지키는 동시에 심연을 붙잡는 감옥이다.',
      '고래기름을 태울수록 말뚝은 더 깊이 박히고, 태동은 더 완전해진다.',
      '불을 계속 밝히는 일과 불을 끄는 일 모두 세계를 끝낼 수 있다.',
    ]},
    true_nemorum:{title:'네 개의 열쇠 · 마지막 장',lines:[
      '항구, 성당, 난파선, 연구소 — 넷은 각자 다른 이야기를 하는 줄 알았다.',
      '하나로 맞춰지자 그것은 지도가 아니라 자물쇠였다.',
      '등대지기는 문을 지키는 사람도, 여는 사람도 아니다. 다시 내려온 사람일 뿐이다.',
    ]},
  };
  function loadRecords(){
    try{ const ids=JSON.parse(Store.get(RECORD_KEY)||'[]'); return Array.isArray(ids)?ids.filter(id=>RECORD_DEFS[id]):[]; }
    catch(e){ return []; }
  }
  let LEARNED_RECORDS=loadRecords();
  function learnRecord(id){ if(!RECORD_DEFS[id] || LEARNED_RECORDS.indexOf(id)>=0) return; LEARNED_RECORDS.push(id); Store.set(RECORD_KEY,JSON.stringify(LEARNED_RECORDS)); }
  function learnedRecords(){ return LEARNED_RECORDS.map(id=>RECORD_DEFS[id]).filter(Boolean); }
  function resetRecords(){ Store.remove(RECORD_KEY); LEARNED_RECORDS=[]; }

  /* ── 등대 기지의 NPC·동료 신호 ── */
  const RESCUE = {
    hellion:{
      signal:'산호에 걸린 작살의 진동',
      scene:[crew('작살이 산호 안쪽에서 떨립니다.'),{pause:360},{who:'브란',cls:'hellion',text:'내가 잡은 건 고래가 아니야. 빛에서 도망친 놈이지.'},crew('왜 돌아오지 않았습니까?'),{who:'브란',cls:'hellion',text:'웃음소리가 멈추지 않아서.'}],
      tavern:[{who:'브란',cls:'hellion',text:'등대가 밝을수록 사냥감이 선명해진다.'},{who:'늙은 등대지기',voice:true,text:'그래서 너무 오래 보지 마라.'}],
    },
    robber:{
      signal:'난파선 화물칸의 불규칙한 불빛',
      scene:[crew('화물칸 안의 빛이 신호처럼 깜빡입니다.'),{pause:360},{who:'카쿠스',cls:'robber',text:'이건 훔친 게 아니에요. 아직 주인이 안 나타났을 뿐이지.'},crew('고래기름을 숨겼습니까?'),{who:'카쿠스',cls:'robber',text:'숨긴 건 기름이 아니라, 기름이 어디서 왔는지예요.'}],
      tavern:[{who:'카쿠스',cls:'robber',text:'등대지기 양반, 이 병은 항구에서 나온 게 아닙니다.'},{who:'늙은 등대지기',voice:true,text:'그런 병은 열지 마라.'}],
    },
    jester:{
      signal:'잠수종 안쪽에서 반복되는 세 번의 박자',
      scene:[crew('잠수종이 안쪽에서 두드려집니다.'),{pause:360},{who:'다윗',cls:'jester',text:'이 박자는 구조 신호가 아니에요.'},crew('무슨 신호입니까?'),{who:'다윗',cls:'jester',text:'아직 내가 나라는 신호.'}],
      tavern:[{who:'다윗',cls:'jester',text:'등대의 종은 죽은 사람의 이름을 너무 잘 기억합니다.'},{who:'늙은 등대지기',voice:true,text:'이름을 부르지 마라.'}],
    },
  };
  const ASIDES = {
    '메아리의 여울':{hellion:'익사자는 죽은 게 아니야. 빛이 닿지 않는 쪽으로 바뀐 거지.',robber:'이 연료병은 새것인데, 라벨은 백 년 전 거야.',jester:'종소리의 간격이 등대의 깜빡임과 같습니다.'},
    '역류의 이랑':{hellion:'성당은 기도하는 곳이 아니라 부품을 만드는 곳이었어.',robber:'제단 아래에 같은 사람의 장기가 여러 개 있어요.',jester:'사제의 노래가 등대의 점멸과 같은 박자입니다.'},
    '잔별의 구렁':{hellion:'별고래가 죽을 때 웃음소리가 납니다.',robber:'난파선 안의 물건은 모두 등대로 보내지고 있었어요.',jester:'산호가 항해일지의 문장을 따라 자랍니다.'},
  };
  function rescueAside(tier,id){ const text=(ASIDES[tier]||{})[id]; return text?[{who:CLASS_DEFS[id].name,cls:id,text}]:[]; }
  function rescueScript(){
    const esc=S.escape;
    if(!esc || esc.rescued || !esc.plates || !esc.plates.length) return null;
    const ids=esc.plates.filter(id=>RESCUE[id]);
    if(!ids.length) return null;
    const tier=chapter().tier;
    if(ids.length===1){ const id=ids[0]; return [{note:'마지막 구조 신호가 잠수종에 닿는다.'},{do:()=>takeRescue(id)}].concat(RESCUE[id].scene,rescueAside(tier,id)); }
    return [crew(`빛의 바깥에서 ${ids.length}개의 신호가 들어옵니다.`),leader('이번 밤에는 하나만 데려갈 수 있다.'),{
      prompt:'어느 신호를 따라갈 것인가',
      choice:ids.map(id=>({text:RESCUE[id].signal,do:()=>takeRescue(id),then:RESCUE[id].scene.concat(rescueAside(tier,id))})),
    },crew('남은 신호는 다음 밤의 어둠으로 내려간다.')];
  }
  /* 구버전 저장에 구조 신호가 남아 있어도 이제 클래스 해금으로 이어지지 않는다. */
  function takeRescue(){ if(S.escape) S.escape.plates=[]; }
  function tavernScene(){ const id=S.tavern&&S.tavern.unlocked; const def=id&&RESCUE[id]; return def?[{note:`${CLASS_DEFS[id].name}의 젖은 명패가 등대 기지의 불빛을 받는다.`}].concat(def.tavern):null; }

  function proSilhouette(){
    const el=sceneFxLayer(); if(!el) return;
    const wrap=document.createElement('div'); wrap.className='pro-silhouette';
    wrap.innerHTML=BASE_CLASSES.map((cid,i)=>`<i style="--i:${i}"><span class="portrait portrait-${cid}">${CLASS_ICON[cid]}</span></i>`).join('');
    el.appendChild(wrap); setTimeout(()=>wrap.remove(),26000);
  }
  function proGlimmerDark(){
    const el=sceneFxLayer(); if(!el) return;
    const wrap=document.createElement('div'); wrap.className='pro-tendril';
    wrap.innerHTML=Array.from({length:5},(_,i)=>`<i style="--x:${14+i*18}%;--w:${18+(i%3)*13}px;--d:${i*130}ms"></i>`).join('');
    el.appendChild(wrap); setTimeout(()=>wrap.remove(),2400);
  }
