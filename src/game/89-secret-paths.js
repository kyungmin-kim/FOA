  /* ============ 히든 갈림길 · 등대의 기록 ============
     갈림길에서 고른 선택지의 순서(0-based 인덱스)가 기록 암호가 된다.
     노드의 종류를 맞히는 퍼즐이 아니라, 그 순간 무엇을 외면하고 무엇을 향했는지의 순서다.
     한 자리라도 어긋나면 해당 챕터의 암호는 그 런에서 더 이상 검사하지 않는다. */
  const SECRET_KEY = 'fathom.secrets.v2';
  const SECRET_PATH_DEFS = {
    '메아리의 여울':{
      id:'harbor_lamp', code:[1,0,2], dpRelief:20,
      relic:{id:'sr_surface_bell',name:'등대의 녹슨 종',tier:'rare',effect:{dpMul:0.92},boon:'심도압박 상승량 -8%',flavor:'아무도 당기지 않았는데 울린다. 울릴 때마다 등대의 불빛이 한 칸 넓어진다.'},
      journal:'lighthouse_log_1',
      key:true,
    },
    '역류의 이랑':{
      id:'cathedral_oil', code:[0,2,1], dpRelief:18,
      relic:{id:'sr_cathedral_wick',name:'거꾸로 탄 심지',tier:'rare',effect:{erosionMul:0.92},boon:'잠식 진행 -8%',flavor:'불꽃은 아래로 흐른다. 심지는 어느 쪽이 위인지 기억하지 못한다.'},
      journal:'lighthouse_log_2',
      key:true,
    },
    '잔별의 구렁':{
      id:'whale_chart', code:[2,1,0], dpRelief:16,
      relic:{id:'sr_whale_chart',name:'별고래의 관측판',tier:'rare',effect:{draw:1},boon:'매 턴 카드 1장 추가',flavor:'고래의 뼈에는 등대와 감옥의 위치가 함께 새겨져 있다.'},
      journal:'lighthouse_log_3',
      key:true,
    },
    '끝없는 심연':{
      id:'nail_record', code:[1,2,0], dpRelief:14,
      relic:{id:'sr_nail_fragment',name:'말뚝의 파편',tier:'very-rare',effect:{dpMul:0.85},boon:'심도압박 상승량 -15%',flavor:'빛이 닿지 않아도 현실에 남는 검은 금속 조각.'},
      journal:'lighthouse_log_4',
      key:true,
    },
  };
  function secretDefFor(tier){ return SECRET_PATH_DEFS[tier] || null; }

  const JOURNAL_KEY = 'fathom.journals.v2';
  const JOURNAL_DEFS = {
    lighthouse_log_1:{title:'등대 작업일지 · 1/4',lines:[
      '첫 번째 등대지기는 항구에서 고래기름을 주웠다.',
      '그날 밤, 밝아진 등대의 바닥에서 두 번째 심장 소리가 들렸다.',
    ]},
    lighthouse_log_2:{title:'등대 작업일지 · 2/4',lines:[
      '성당 사람들은 기름을 정제하는 법을 알고 있었다.',
      '그들은 등대를 신이라 부르지 않았다. 문이라고 불렀다.',
    ]},
    lighthouse_log_3:{title:'등대 작업일지 · 3/4',lines:[
      '별고래의 뼈는 하늘을 가리키지 않는다.',
      '모든 표식은 등대 아래 같은 한 점을 향한다.',
    ]},
    lighthouse_log_4:{title:'등대 작업일지 · 4/4',lines:[
      '불을 끄면 현실이 무너진다.',
      '불을 켜 두면 감옥의 문이 열린다.',
      '다음 등대지기에게 선택을 남긴다.',
    ]},
  };
  function loadJournals(){
    try{ const ids=JSON.parse(Store.get(JOURNAL_KEY)||'[]'); return Array.isArray(ids)?ids.filter(id=>JOURNAL_DEFS[id]):[]; }
    catch(e){ return []; }
  }
  let LEARNED_JOURNALS=loadJournals();
  function learnJournal(id){ if(!id || !JOURNAL_DEFS[id] || LEARNED_JOURNALS.indexOf(id)>=0) return; LEARNED_JOURNALS.push(id); Store.set(JOURNAL_KEY,JSON.stringify(LEARNED_JOURNALS)); }
  function learnedJournalEntries(){ return LEARNED_JOURNALS.map(id=>JOURNAL_DEFS[id]).filter(Boolean); }
  function resetJournals(){ Store.remove(JOURNAL_KEY); LEARNED_JOURNALS=[]; }
  function journalScene(id){
    const j=JOURNAL_DEFS[id];
    if(!j) return null;
    return [{pause:400},reveal(j.title)].concat(j.lines.map(line=>({note:line})));
  }

  function loadSecrets(){
    try{ const ids=JSON.parse(Store.get(SECRET_KEY)||'[]'); return Array.isArray(ids)?ids:[]; }
    catch(e){ return []; }
  }
  let FOUND_SECRETS=loadSecrets();
  function secretFound(id){ return FOUND_SECRETS.indexOf(id)>=0; }
  function markSecretFound(id){ if(secretFound(id)) return; FOUND_SECRETS.push(id); Store.set(SECRET_KEY,JSON.stringify(FOUND_SECRETS)); }
  function resetSecrets(){ Store.remove(SECRET_KEY); FOUND_SECRETS=[]; }

  function recordPathChoice(options,node){
    const def=secretDefFor(chapter().tier);
    if(!def || secretFound(def.id)){ S.pathCode=null; return null; }
    if(!Array.isArray(S.pathCode)) S.pathCode=[];
    const idx=options.indexOf(node);
    const expected=def.code[S.pathCode.length];
    if(expected===undefined){ S.pathCode=null; return null; }
    if(idx!==expected){ S.pathCode=null; return null; }
    S.pathCode.push(idx);
    if(S.pathCode.length<def.code.length) return null;
    markSecretFound(def.id);
    if(def.dpRelief) aliveParty().forEach(p=>setDp(p,p.dp-def.dpRelief));
    if(def.relic) offerRelic(def.relic,'secret');
    if(def.journal) learnJournal(def.journal);
    if(def.key) markAbyssKeyFound(chapter().tier);
    return Object.assign({},def,{scene:def.journal?journalScene(def.journal):null});
  }
