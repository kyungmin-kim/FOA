  /* ============ MAP DATA (chapters) ============
     세 번의 인양 뒤, 마지막에는 끝없는 심연으로 내려간다 —
     6·10·20 노드를 지나고, 최후의 심연은 보스까지 정확히 7노드다.

     '노드 수 × 턴당 잠식' 이 그 층의 총 압박이다. 이 곱을 상수로 두는 것이 규칙이라,
     노드를 두 배로 늘릴 때 잠식은 절반으로 내렸다 — 안 내리면 메아리의 여울에서만 120%에 닿아
     끝까지 갈 수가 없다. 지금 곱은 메아리의 여울 7.5 · 역류의 이랑 8.5 · 잔별의 구렁 8.0 으로 예전과 같고,
     심연만 3.85 인 것은 위협 IV(압박 ×1.70)가 그 몫을 대신 지기 때문이다.

     수문장의 이름은 층마다 다르다. 스탯은 같은 개체를 쓰지만, 플레이어가 보는 것은
     조명 안으로 드러난 일부뿐이므로 매번 다른 이름으로 부른다 — 하나인지 여럿이
     연결된 것인지는 끝까지 확정하지 않는다. 같은 이름이 세 번 나오면 그 모호함이
     '그냥 같은 적' 으로 읽혀 버린다. */
  const CHAPTERS = [
    {n:1, tier:'메아리의 여울', length:6,  erosion:1.25, wardenName:'항구의 등불 없는 수문장',
     title:'침몰한 항구', displayName:'침몰한 항구', lead:'등대의 빛이 닿는 마지막 부두. 젖은 연료통이 어둠 속에서 흔들린다.'},
    {n:2, tier:'역류의 이랑', length:10, erosion:0.85, wardenName:'거꾸로 매달린 성가대',
     title:'뒤틀린 성당', displayName:'뒤틀린 성당', lead:'기도문과 연료 장부가 같은 종이에 적혀 있다. 종은 아래를 향해 울린다.'},
    {n:3, tier:'잔별의 구렁', length:20, erosion:0.40, wardenName:'산호를 두른 별고래',
     title:'거대한 난파선 · 산호 숲', displayName:'거대한 난파선 · 산호 숲', lead:'선체를 뚫고 자란 산호가 오래된 항해일지를 따라 길을 만든다.'},
    /* 마지막 심연만 길이를 그대로 둔다 — 되돌아갈 길이 없는 구간이라, 길어지면
       버티는 싸움이 아니라 소모전이 된다. 잠식도 그대로다. */
    {n:4, tier:'끝없는 심연', length:7, erosion:0.55, wardenName:'심연의 태동',
     title:'심해 연구소 · 고래의 무덤', displayName:'심해 연구소 · 고래의 무덤', lead:'관측실은 고래의 뼈 위에 매달려 있다. 등대 아래의 말뚝이 보이기 시작한다.'},
  ];
  const CHAPTER_DISPLAY_NAMES = CHAPTERS.reduce((out,ch)=>{ out[ch.tier]=ch.displayName||ch.title||ch.tier; return out; },{});
  function chapterDisplayName(tier){ return CHAPTER_DISPLAY_NAMES[tier] || tier; }
  /* 층 이름으로 찾는다 — 저장된 런의 노드에도 tier 는 남아 있다 */
  function wardenNameFor(tier){
    const ch = CHAPTERS.find(c=>c.tier===tier);
    return (ch && ch.wardenName) || null;
  }
  /* 층위 난이도 — 적 풀 자체의 차이와 별개로, 모든 조우에 걸리는 압력 곡선이다.
     심연은 전용 강적의 기본 스탯에도 이 보정이 겹쳐 하드코어 구간이 된다. */
  const TIER_THREAT = {
    '메아리의 여울':       {hp:1.00, atk:1.00, pressure:1.00, eliteHp:1.00, eliteAtk:1.00, bossHp:1.00, bossAtk:1.00, label:'위협 I · 기준 수치'},
    '역류의 이랑':       {hp:1.18, atk:1.12, pressure:1.18, eliteHp:1.10, eliteAtk:1.08, bossHp:1.10, bossAtk:1.08, label:'위협 II · 적 체력 ×1.18 · 공격 ×1.12'},
    '잔별의 구렁':       {hp:1.42, atk:1.32, pressure:1.40, eliteHp:1.18, eliteAtk:1.18, bossHp:1.22, bossAtk:1.18, label:'위협 III · 적 체력 ×1.42 · 공격 ×1.32'},
    '끝없는 심연': {hp:1.35, atk:1.25, pressure:1.55, eliteHp:1.25, eliteAtk:1.18, bossHp:1.35, bossAtk:1.25, label:'위협 IV · 심연 개체 강화 · 압박 ×1.55'},
  };
  function tierThreat(tier){
    const base=TIER_THREAT[tier] || TIER_THREAT['메아리의 여울'];
    const m=lighthouseThreatMul()*pactThreatMul()*expeditionThreatMul();
    return Object.assign({},base,{hp:base.hp*m,atk:base.atk*m,pressure:base.pressure*m,
      eliteHp:base.eliteHp*m,eliteAtk:base.eliteAtk*m,bossHp:base.bossHp*m,bossAtk:base.bossAtk*m,
      label:`${base.label} · 등대 ${lighthouseStage()}`});
  }
  /* ============ 첫 숨 ============
     자유 탐사를 시작하는 잠수종 안에서 고르는 트레이드오프 하나. 이번 탐사에만 적용되고
     저장되지 않는다 — S 위에만 임시 플래그로 남는다. */
  const FIRST_BREATH_DEFS = [
    {id:'breath_calm', name:'고른 숨', boon:'하강 즉시 전원 심도압박 10 감소', drawback:'이번 탐사 고래기름 드롭량 -20%',
     oilMul:0.8},
    {id:'breath_wick', name:'예비 심지', boon:'이번 탐사 서약 심도 +1 취급(보상 상승)', drawback:'미상 카드 확률 +10%',
     depthBonus:1, unknownMul:1.10},
    {id:'breath_light', name:'가벼운 짐', boon:'이번 탐사 잠식 증가율 -10%', drawback:'파티 최대 체력 -5%',
     erosionMul:0.90, maxHpMul:0.95},
  ];
  function pickFirstBreath(id){
    const def = FIRST_BREATH_DEFS.find(d=>d.id===id);
    if(!def) return null;
    S.firstBreath = def.id;
    if(def.oilMul) S.firstBreathOilMul = def.oilMul;
    if(def.unknownMul) S.firstBreathUnknownMul = def.unknownMul;
    if(def.erosionMul) S.firstBreathErosionMul = def.erosionMul;
    if(def.depthBonus) S.firstBreathDepthBonus = def.depthBonus;
    if(def.boon==='하강 즉시 전원 심도압박 10 감소') aliveParty().forEach(p=>setDp(p, p.dp-10));
    if(def.maxHpMul) aliveParty().forEach(p=>{ p.maxHp=Math.max(1,Math.round(p.maxHp*def.maxHpMul)); p.hp=Math.min(p.hp,p.maxHp); });
    return def;
  }

  /* ============ 서약 조항 ============
     자유 탐사 진입 전에 스스로 거는 위험이다. 켤수록 잠식·위협·미상 카드가 거세지는
     대신, 그 합(서약 심도)만큼 고래기름과 유물 인양 심도 확률이 함께 오른다.
     여기 담긴 배율만 늘어나며, 잠식·심도압박 수치 자체의 계산 방식은 그대로다. */
  const PACT_CLAUSE_DEFS = [
    {id:'clause_erosion', name:'어둠 조항', kind:'erosion', mul:1.20, weight:1, desc:'잠식 증가율 +20%'},
    {id:'clause_threat',  name:'포식 조항', kind:'threat',  mul:1.15, weight:1, desc:'적 위협 배율 +15%'},
    {id:'clause_unknown', name:'미지 조항', kind:'unknown', mul:1.50, weight:1, desc:'미상 카드 확률 +50%'},
  ];
  function pactClauseDef(id){ return PACT_CLAUSE_DEFS.find(c=>c.id===id) || null; }
  /* 선택한 조항(opt-in) + 심연 계위가 강제하는 조항(forced) 을 합쳐 한 번만 센다.
     서약은 자유 탐사에서만 의미가 있다 — 본편 하강에서는 심연 계위가 올라 있어도
     forcedClauses 를 그대로 읽지 않는다. 안 그러면 본편 밸런스가 반복 플레이만으로
     조용히 바뀌어 버린다. */
  function activePactClauseIds(){
    if(!S || !S.free) return [];
    const ids = ((S && S.pactClauses) || []).concat((S && S.forcedClauses) || []);
    return ids.filter((id,i)=>ids.indexOf(id)===i);
  }
  function pactMulFor(kind){
    let v = 1;
    activePactClauseIds().forEach(id=>{ const def=pactClauseDef(id); if(def && def.kind===kind) v *= def.mul; });
    return v;
  }
  function pactThreatMul(){ return pactMulFor('threat'); }
  function pactErosionMul(){ return pactMulFor('erosion') * (S && S.firstBreathErosionMul || 1); }
  function pactUnknownMul(){ return pactMulFor('unknown') * (S && S.firstBreathUnknownMul || 1); }
  function pactDepth(){
    if(!S || !S.free) return 0;
    const base = activePactClauseIds().reduce((sum,id)=>{ const def=pactClauseDef(id); return sum + (def?def.weight:0); },0);
    return base + ((S && S.firstBreathDepthBonus) || 0);
  }
  /* 서약 심도에 비례해 고래기름 드롭량이 늘어난다. 첫 숨의 드롭 페널티는 여기서 함께 곱해진다. */
  function pactOilMul(){ return (1 + pactDepth()*0.15) * (S && S.firstBreathOilMul || 1); }

  /* 고정 조수(파밍 던전)에서만 걸리는 보상 배율. 서약 배율과 같은 곱연산 자리에
     얹히므로 서약을 함께 걸면 그대로 중첩된다. */
  const FARM_DROP_MUL = 1.25;
  function farmDropMul(){ return (S && S.farmRun) ? FARM_DROP_MUL : 1; }

  /* ============ 자유 탐사 누적 배율 ============
     자유 탐사에서 성공적으로 귀환한 총 횟수(expeditionCount)가 오를수록
     에픽·전설 드롭률은 서서히, 위협은 가파르게 오른다. 본편에는 걸리지 않는다 —
     S.free 가 아니면 둘 다 정확히 1을 반환한다.

     희귀 배율: 처음엔 기준의 20% 수준(초반엔 일부러 많이 박하게)에서 시작해
     10회째 150%에 닿고, 그 뒤로도 같은 기울기로 올라 60회 이후 4배에서 멈춘다.
     위협 배율: 완만하게 시작해 뒤로 갈수록 가팔라지는 곡선(지수 1.5)으로,
     20회에 2배, 60회에 6배를 넘어선다 — '급격히' 어려워지는 쪽은 이쪽이다. */
  function expeditionRareMul(){
    if(!S || !S.free) return 1;
    const n = expeditionCount();
    return Math.min(4, 0.2 + n*0.13);
  }
  const EXPEDITION_THREAT_CAP = 15;
  function expeditionThreatMul(){
    if(!S || !S.free) return 1;
    const n = expeditionCount();
    return Math.min(EXPEDITION_THREAT_CAP, 1 + Math.pow(n/20, 1.5));
  }
  function recomputePactDepth(){ if(S) S.pactDepth = pactDepth(); }

  function forcedClauseIdsForRank(rank){
    return PACT_CLAUSE_DEFS.slice(0, Math.max(0,Math.min(PACT_CLAUSE_DEFS.length, rank))).map(c=>c.id);
  }

  function firstRunActive(){ return !!(S && S.firstRun && S.chapter===0); }

  /* ============ 챕터 변형 ============
     매번 같은 길이·같은 노드 비율로 내려가면 몇 판만 지나도 그 층의 모양을 외워
     버린다. 하강할 때마다 길이와 노드 종류 비율을 살짝 흔들어서 매 런이 다른
     구성으로 느껴지게 한다 — 대신 "노드 수 × 턴당 잠식 = 그 층의 총 압박"이라는
     기존 튜닝값은 길이가 흔들려도 그대로 지킨다(erosionRate 에서 보정).
     첫 출정(튜토리얼)은 흔들지 않는다 — 정해진 5노드 그대로 둔다. */
  const CHAPTER_LENGTH_VARIANCE = 0.20;   /* 기준 길이의 ±20% */
  const CHAPTER_WEIGHT_JITTER = 0.35;     /* 노드 비율은 기준의 65~135% 사이에서 흔든다 */
  function rollChapterLength(baseLength){
    const span = Math.max(1, Math.round(baseLength * CHAPTER_LENGTH_VARIANCE));
    const min = Math.max(4, baseLength - span);
    const max = baseLength + span;
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  function rollChapterWeights(baseWeights){
    const out = {};
    Object.keys(baseWeights || {}).forEach(kind=>{
      const jitter = (1 - CHAPTER_WEIGHT_JITTER) + Math.random() * (CHAPTER_WEIGHT_JITTER * 2);
      out[kind] = Math.max(1, Math.round(baseWeights[kind] * jitter));
    });
    return out;
  }
  /* S.chapterVariant 는 하강 시작 지점(descendNextChapter·beginForay)에서 null 로
     비워 둔다. 여기서는 비어 있을 때만 새로 굴리고, 같은 런 안에서 같은 층을
     다시 묻는 모든 호출(chapter, nodePolicy, kindQuota …)이 같은 값을 보게 한다. */
  function ensureChapterVariant(){
    if(S.chapterVariant) return S.chapterVariant;
    const tier = CHAPTERS[Math.min(S.chapter, CHAPTERS.length-1)].tier;
    const base = CHAPTERS.find(c=>c.tier===tier);
    const policy = NODE_POLICY[tier] || NODE_POLICY['메아리의 여울'];
    S.chapterVariant = {
      tier: tier,
      length: rollChapterLength(base.length),
      weights: rollChapterWeights(policy.weights),
      nearBoss: rollChapterWeights(policy.nearBoss),
    };
    return S.chapterVariant;
  }

  function chapter(){
    const ch = CHAPTERS[Math.min(S.chapter, CHAPTERS.length-1)];
    /* 첫 출정은 보스가 없는 5노드 회수 임무다. 원본 챕터 길이는 유지해
       이후 정규 런과 자유 탐사에는 기존 6노드·수문장 구조를 돌려준다. */
    if(firstRunActive()) return Object.assign({}, ch, {length:5});
    return Object.assign({}, ch, {length: ensureChapterVariant().length});
  }
  function isFinalChapter(){ return S.chapter >= CHAPTERS.length-1; }
  /* 다음 하강이 마지막인가 — 등대 기지에서 내려가기 전에 물어야 하므로 따로 둔다 */
  function nextChapterIsFinal(){ return S.chapter + 1 >= CHAPTERS.length-1; }

  /* ============ 월드맵 ============
     한 번 끝까지 내려가 본 사람에게 열리는 자유 탐사의 지도다.

     자리는 좌표로만 적어 둔다. 지금은 빈 판에 점을 찍어 두지만, 나중에 해도 그림이
     나오면 그림을 배경으로 깔고 같은 좌표를 그대로 쓴다 — 점이 투명한 손잡이가 될 뿐,
     이 표는 건드리지 않는다. 두 번째 해역이 붙어도 줄만 늘어난다.

     needs 는 그 자리를 여는 관측 표식이다. 지금은 넷 다 검은 조석 안에 있으므로
     같은 표식 하나로 함께 열린다. */
  const WORLD_SITES = [
    {tier:'메아리의 여울',       x:'26%', y:'22%', needs:'black_tide_spine', note:'고래기름이 처음 발견된 부두'},
    {tier:'역류의 이랑',       x:'62%', y:'38%', needs:'black_tide_spine', note:'기도와 연료 장부가 겹친 성당'},
    {tier:'잔별의 구렁',       x:'32%', y:'60%', needs:'black_tide_spine', note:'별고래가 잠든 난파선'},
    {tier:'끝없는 심연', x:'68%', y:'80%', needs:'black_tide_spine', note:'말뚝이 박힌 연구소와 고래의 무덤'},
  ];
  function worldSiteOpen(site){
    const index=chapterIndexForTier(site.tier);
    /* 자유 탐사는 수문장을 쓰러뜨린 스테이지에만 열린다. 도달 기록만으로는
       해도의 위치를 알 수 있을 뿐, 반복 하강할 권한은 생기지 않는다. */
    return hasClearedWorldStage(index);
  }
  /* 월드맵 자체가 열렸는가 — 표식을 얻는 것만으로는 부족하다.
     끝없는 심연의 최종 보스를 클리어한 뒤에만 자유 탐사가 열린다. */
  function worldMapUnlocked(){ return WORLD_RECORD.cleared.length>0 || hasWorldClear(); }
  function chapterIndexForTier(tier){ return CHAPTERS.findIndex(c=>c.tier===tier); }

  const NODE_TEXT = {
    battle:[
      ['부두','침몰한 항구의 밧줄이 물살과 반대 방향으로 팽팽해진다.'],
      ['선창','검은 물 아래에서 익사자들이 등대의 불빛을 세고 있다.'],
      ['창고','연료통 안쪽에서 누군가 손톱으로 세 번 두드린다.'],
      ['부표','부서진 부표 하나가 살아 있는 심장처럼 오르내린다.'],
    ],
    elite:[
      ['사제','제단을 지키는 형체가 기도와 호흡을 같은 박자로 반복한다.'],
      ['도살자','다른 것들보다 훨씬 크다. 몸 안쪽에서 종소리가 난다.'],
    ],
    rest:[
      ['잠수종','금 간 잠수종 안에서 숨을 고른다. 유리 밖의 어둠이 천천히 호흡한다.'],
      ['기름 저장고','오래된 연료 저장고 안쪽. 잠시 빛이 유지되지만, 벽 너머에서 누군가 같은 박자로 쉰다.'],
    ],
    treasure:[
      ['연료통','부서진 선체 사이로 고래기름 병이 눈동자처럼 반짝인다.'],
      ['관측실 잔해','조류에 밀려온 기록과 유물이 한곳에 모여 있다. 일부는 아직 따뜻하다.'],
    ],
    /* 들어가기 전에는 무엇이 기다리는지 밝히지 않는다 — '수문장' 이라고 적어 두면
       해류가 멈추고 난파선이 움직이는 조우 장면이 이미 김이 빠진 채로 시작한다. */
    boss:[
      ['봉인실','여기서부터 해류가 한 방향으로만 흐른다. 그 끝에는 등대 아래의 말뚝이 있다.'],
    ],
  };

  let nodeSeq = 0;

  /* ============ 노드 정책 ============
     "어느 층에 어떤 노드가 얼마나 놓이는가" 를 표 하나에 모은다. 예전에는 이 규칙이
     rollNodeKind 안의 `if(tier==='메아리의 여울')` 같은 분기와 인라인 가중치로 흩어져 있어서,
     비율 하나를 만지거나 층을 하나 붙이려면 매번 함수를 열어야 했다.

     이제 함수는 표를 읽기만 한다.
       - 층을 더한다     → CHAPTERS 에 줄을 넣고 여기에 정책을 하나 적는다
       - 종류를 더한다   → NODE_TEXT 에 문구, 정책에 가중치, 필요하면 NODE_GATES 에 자격
       - 비율을 만진다   → 아래 숫자만 고친다

       weights      갈림길에 오를 후보와 가중치. 여기 없는 종류는 그 층에 나오지 않는다.
       nearBoss     수문장 앞 nearBossFrom 칸부터 대신 쓰는 가중치. 엘리트를 빼두는
                    자리다 — 엘리트 뒤에는 은신처가 따라붙는데, 마지막 칸들에는
                    그것을 넣을 자리가 없다.
       nearBossFrom 위 표로 갈아타는 지점. 층 끝에서 몇 칸 전인지.
       share        층 전체 노드 대비 [최소, 최대] 상한. NODE_GATES 의 quota 가 읽는다. */
  const NODE_POLICY = {
    /* 도입부라 조우만 놓는다 — 엘리트도 임의 휴식도 없이 덱과 대열부터 확인시킨다 */
    '메아리의 여울':       {weights:{battle:100, treasure:35},
                  nearBoss:{battle:100, treasure:35}, nearBossFrom:3,
                  share:{treasure:[0.20, 0.25]}},
    '역류의 이랑':       {weights:{battle:53, elite:22, rest:25, treasure:35},
                  nearBoss:{battle:72, rest:28, treasure:35}, nearBossFrom:3,
                  share:{treasure:[0.20, 0.25]}},
    '잔별의 구렁':       {weights:{battle:53, elite:22, rest:25, treasure:35},
                  nearBoss:{battle:72, rest:28, treasure:35}, nearBossFrom:3,
                  share:{treasure:[0.20, 0.25]}},
    /* 마지막 층은 엘리트의 밀도로 압박한다. 임의 휴식이 없으니 수문장 앞이라고
       엘리트를 빼둘 이유도 없어 두 표를 같게 둔다. */
    '끝없는 심연': {weights:{battle:58, elite:42, treasure:35},
                  nearBoss:{battle:58, elite:42, treasure:35}, nearBossFrom:3,
                  share:{treasure:[0.20, 0.25]}},
  };
  function nodePolicy(tier){
    const base = NODE_POLICY[tier || chapter().tier] || NODE_POLICY['메아리의 여울'];
    /* 명시적으로 다른 층을 물었거나 첫 출정이면 흔들지 않은 기준표를 그대로 준다.
       지금 내려가는 층을 물을 때만(호출부가 늘 그렇다) 이번 런의 변형 비율을 준다. */
    if(tier || firstRunActive()) return base;
    const variant = ensureChapterVariant();
    return Object.assign({}, base, {weights: variant.weights, nearBoss: variant.nearBoss});
  }

  /* ============ 노드 자격 ============
     가중치가 있어도 '지금 놓아도 되는가' 는 따로 묻는다. 이 표에 없는 종류는 언제나 놓인다.

       after       바로 앞 노드가 이 종류 중 하나여야 한다
       minBattles  이 층에서 전투를 이만큼 치른 뒤에야 처음 나온다
       cooldown    같은 종류가 나온 뒤 이만큼의 노드가 지나야 다시 나온다
       quota       정책의 share 가 정한 층당 상한을 넘지 않는다 */
  const NODE_GATES = {
    /* 은신처는 '언제든 몇 번이든' 이 아니라 박자를 갖는다. 시작하자마자 쉬는 길은 없고,
       쉼표가 붙어 다니지도 않는다. 횟수 상한은 두지 않는다 — 이 두 규칙이 이미 밀도를
       정하므로, 상한을 겹쳐 두면 긴 구역에서 뒤쪽 은신처가 통째로 사라진다.
       수문장 바로 앞은 예외 없이 은신처이며, 그것은 rollChoicesAt 이 강제한다. */
    rest:     {minBattles:2, cooldown:3},
    /* 싸우지 않고 건져 올릴 것은 없다. 그리고 층 전체의 20~25% 를 넘지 않는다.
       회수 노드는 몰아서 나오면 안 되므로 직전 회수 뒤 최소 3칸은 다시 나오지 않는다. */
    treasure: {after:['battle','elite'], quota:true, cooldown:3},
    /* 엘리트는 층 길이에 비례하되 한 런에 3마리를 넘지 않는다(kindQuota 참조). */
    elite: {quota:true},
  };

  /* 이번 구역에서 지나온 노드들 — mapVisited 는 구역을 넘어 쌓이므로 뒤에서 잘라 쓴다 */
  function chapterVisited(){
    return S.mapVisited.slice(Math.max(0, S.mapVisited.length - S.stepInChapter));
  }
  function lastNodeInChapter(){
    const nodes = chapterVisited();
    return nodes[nodes.length-1] || null;
  }
  function battlesInCurrentChapter(){
    return chapterVisited().filter(node=>node && (node.type==='battle' || node.type==='elite')).length;
  }
  function visitedKindCount(kind){
    return chapterVisited().filter(node=>node && node.type===kind).length;
  }
  /* 같은 종류가 마지막으로 나온 뒤 몇 노드가 지났는가. 나온 적이 없으면 무한대로 친다. */
  function nodesSinceKind(kind){
    const nodes = chapterVisited();
    for(let i=nodes.length-1; i>=0; i--){
      if(nodes[i] && nodes[i].type===kind) return nodes.length-1-i;
    }
    return Infinity;
  }
  /* 층당 상한 — 비율을 곱해 반올림하지 않고, 구간 안에 드는 정수에서 뽑는다.
     20노드 층은 4~5 로 흔들리고 10노드 층은 2 하나뿐이다. 6·7노드 층처럼 구간 안에
     정수가 아예 없으면(1.2~1.5 · 1.4~1.75) 아래쪽으로 붙인다 — 올림하면 2/7 = 28.6%
     가 되어 상한을 넘는다. 층에 들어설 때 한 번 정하고 그 층 내내 쓴다. */
  function kindQuota(kind){
    if(!S.nodeQuota || S.nodeQuota.chapter !== S.chapter) S.nodeQuota = {chapter:S.chapter, totals:{}};
    /* 엘리트는 층 길이에 비례하되, 아무리 길어도 한 런에 3마리를 넘지 않는다.
       share 표를 쓰지 않고 길이 구간으로 직접 못박는다 — 챕터 1(메아리의 여울)은
       정책에 elite 자체가 없어 이 자리에 오지 않는다. */
    if(kind === 'elite'){
      if(S.nodeQuota.totals.elite == null){
        const len = chapter().length;
        S.nodeQuota.totals.elite = len <= 8 ? 1 : len <= 15 ? 2 : 3;
      }
      return S.nodeQuota.totals.elite;
    }
    const share = (nodePolicy().share || {})[kind];
    if(!share) return Infinity;
    if(S.nodeQuota.totals[kind] == null){
      const len  = chapter().length;
      const low  = Math.ceil(len*share[0]);
      const high = Math.floor(len*share[1]);
      S.nodeQuota.totals[kind] = high < low ? Math.max(1, high)
                                            : low + Math.floor(Math.random()*(high-low+1));
    }
    /* 회수 노드 상한은 층 길이로 못박는다 — 10노드 이하는 최대 2회,
       그보다 긴 층(현재는 잔별의 구렁 20노드)은 3~4회로 늘어난다. */
    if(kind !== 'treasure') return S.nodeQuota.totals[kind];
    const len = chapter().length;
    if(len <= 10) return Math.min(2, S.nodeQuota.totals[kind]);
    if(S.nodeQuota.treasureCap == null) S.nodeQuota.treasureCap = 3 + Math.floor(Math.random()*2);
    return Math.min(S.nodeQuota.treasureCap, S.nodeQuota.totals[kind]);
  }
  function nodeKindAllowed(kind){
    const gate = NODE_GATES[kind];
    if(!gate) return true;
    if(gate.after){
      const last = lastNodeInChapter();
      if(!last || gate.after.indexOf(last.type) < 0) return false;
    }
    if(gate.minBattles != null && battlesInCurrentChapter() < gate.minBattles) return false;
    if(gate.cooldown   != null && nodesSinceKind(kind)     < gate.cooldown)    return false;
    if(gate.quota && visitedKindCount(kind) >= kindQuota(kind)) return false;
    return true;
  }
  /* rollChoicesAt(그리고 completeCurrentNode 의 강제 재확인)이 엘리트 직후의 은신처를
     따로 묻는다 — 이름을 남겨 둔다 */
  function canOfferRest(){ return nodeKindAllowed('rest'); }

  function makeNode(kind){
    const ch = chapter();
    const pool = NODE_TEXT[kind];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    return {
      id:'n'+(nodeSeq++), tier:ch.tier,
      type: kind==='boss' ? 'battle' : kind,
      boss: kind==='boss',
      title:`${chapterDisplayName(ch.tier)} · ${pick[0]}`, desc:pick[1],
    };
  }
  function firstRunTreasurePlanned(){
    if(!firstRunActive()) return false;
    if(visitedKindCount('treasure')>0) return true;
    return (S.mapWindow||[]).some(options=>Array.isArray(options) && options.some(node=>node && node.type==='treasure'));
  }
  function rollNodeKind(step, excludeFirstRunTreasure){
    /* 어느 층이든 첫 갈림길은 조우만 놓는다. 층별 표보다 위에 있는 전역 규칙이라
       정책에 적지 않는다 — 첫 전투로 덱과 대열을 확인시킨 뒤에 나머지를 연다. */
    if(step === 0) return 'battle';
    const ch = chapter();
    const policy = nodePolicy();
    const weights = step >= ch.length - policy.nearBossFrom ? policy.nearBoss : policy.weights;
    const blockTreasure = firstRunActive() && (excludeFirstRunTreasure || firstRunTreasurePlanned());
    const table = Object.keys(weights).filter(kind=>kind!=='treasure' || !blockTreasure)
                                      .filter(kind=>nodeKindAllowed(kind))
                                      .map(kind=>[weights[kind], kind]);
    /* 자격을 통과한 종류가 하나도 없는 자리는 조우로 메운다 */
    return table.length ? weighted(table) : 'battle';
  }

  /* 표끼리 어긋나면 조용히 이상한 지도가 나온다 — 층 하나가 정책 없이 남거나, 문구가
     없는 종류에 가중치가 붙거나. 부팅할 때 한 번 맞춰 보고 콘솔에 적는다. */
  function checkNodePolicies(){
    const problems = [];
    CHAPTERS.forEach(ch=>{ if(!NODE_POLICY[ch.tier]) problems.push(`${ch.tier}: 노드 정책이 없다`); });
    Object.keys(NODE_POLICY).forEach(tier=>{
      const p = NODE_POLICY[tier];
      if(!p.weights || !Object.keys(p.weights).length) problems.push(`${tier}: weights 가 비었다`);
      if(p.nearBossFrom == null) problems.push(`${tier}: nearBossFrom 이 없다`);
      ['weights','nearBoss'].forEach(field=>{
        Object.keys(p[field] || {}).forEach(kind=>{
          if(!NODE_TEXT[kind]) problems.push(`${tier}.${field}: '${kind}' 의 문구가 NODE_TEXT 에 없다`);
          if(!(p[field][kind] > 0)) problems.push(`${tier}.${field}.${kind}: 가중치가 0 이하다`);
        });
      });
      Object.keys(p.share || {}).forEach(kind=>{
        const sh = p.share[kind];
        if(!Array.isArray(sh) || sh.length !== 2 || !(sh[0] <= sh[1])) problems.push(`${tier}.share.${kind}: [최소,최대] 가 아니다`);
      });
    });
    Object.keys(NODE_GATES).forEach(kind=>{
      if(!NODE_TEXT[kind]) problems.push(`NODE_GATES.${kind}: 문구가 NODE_TEXT 에 없다`);
    });
    if(problems.length && typeof console !== 'undefined' && console.warn){
      console.warn('[노드 정책] ' + problems.join(' / '));
    }
    return problems;
  }
  checkNodePolicies();

  /* 한 갈림길은 1~3개. 메아리의 여울은 같은 '조우'만 주되 장소 문구를 달리해 선택지가
     반복된 카드처럼 보이지 않게 한다. 다른 층은 가능한 한 서로 다른 종류를 먼저 뽑는다.

     step 은 지금 칸이 아니라 미니맵에 미리 그려 둘 칸일 수도 있다 — isCurrent 가 그
     차이를 가른다. "직전 칸이 엘리트였다" 규칙은 실제로 지나온 경로(S.mapVisited)에만
     걸 수 있는 판정이라, 아직 아무도 고르지 않은 미래 칸(isCurrent=false)에는 적용하지
     않는다 — 그 갈림길의 첫 옵션(가정한 직전 칸)을 기준으로만 판정한다. 한 번 굴려서
     미니맵에 보여준 뒤로는 completeCurrentNode 가 다시 덮어쓰지 않으므로, 여기서
     정한 결과가 챕터가 끝날 때까지 그대로 간다. */
  function rollChoicesAt(step, isCurrent){
    if(isCurrent){
      const last = S.mapVisited[S.mapVisited.length-1];
      /* 보스급 보상과 정화를 마친 직후에는 다음 길을 흔들지 않는다. 반드시 숨을 고른다.
         수문장은 구역을 끝내므로 이 지점에 다시 돌아오지 않는다. */
      if(last && last.type==='elite' && canOfferRest()) return [makeNode('rest')];
    }
    /* 챕터의 첫 칸은 갈림길이 아니라 하나뿐인 입구다 — 미니맵에서도 시작점이 하나로
       보여야 하므로, 뒤의 '1~3개 갈림길' 규칙보다 위에서 못박는다. */
    if(step === 0) return [makeNode('battle')];
    if(firstRunActive() && step >= chapter().length-1) return [makeNode('battle')];
    if(step >= chapter().length-1) return [makeNode('boss')];
    /* 정규 챕터 중간에는 세 갈래 분기를 한 번만 만든다. 각 선택지는
       고정된 3~4개 노드 경로를 품고, 마지막에는 하나의 합류 노드로 돌아온다. */
    if(isCurrent && canStartMapBranch(step)){
      const plan=makeMapBranchPlan(step);
      S.mapBranchPlan=plan;
      return plan.routes.map((route,lane)=>{
        const fork=makeNode('battle');
        fork.branchFork=true;
        fork.branchId=plan.id;
        fork.branchLane=lane;
        return fork;
      });
    }
    /* 수문장 바로 앞 칸은 언제나 은신처다. 규칙(전투 2회·간격 3칸)보다 위에 둔다 —
       마지막 문 앞에서 숨을 고를 수 있느냐가 운에 달리면 안 된다. 다만 바로 앞 칸이
       (엘리트 직후 강제 규칙 등으로) 이미 은신처였다면 은신처가 연달아 나오므로,
       그때만 전투로 대신 채운다. */
    if(step === chapter().length-2){
      const prev = lastNodeInChapter();
      return [makeNode(prev && prev.type==='rest' ? 'battle' : 'rest')];
    }
    /* 히든 갈림길 코드(89-secret-paths.js)가 이 스텝에 걸려 있으면, 정답 인덱스가
       실제로 뜰 수 있도록 선택지 수를 그만큼 강제로 늘린다 — 안 그러면 "세 번째를
       고른다"는 지시가 선택지 2개뿐인 갈림길에서는 애초에 불가능해진다. */
    const secretDef = secretDefFor(chapter().tier);
    const forcedCount = (secretDef && !secretFound(secretDef.id) && step-1 < secretDef.code.length)
      ? secretDef.code[step-1] + 1 : 0;
    const count = Math.max(forcedCount, 1 + Math.floor(Math.random()*3));
    const kinds = [];
    const seen = new Set();
    let firstRunTreasureInChoices = firstRunTreasurePlanned();
    for(let i=0; i<count; i++){
      let kind = rollNodeKind(step, firstRunTreasureInChoices);
      /* 메아리의 여울은 조우만 허용한다. 그 밖의 층에서는 중복을 줄이되, 후보가 모자라면 허용한다. */
      if(chapter().tier!=='메아리의 여울'){
        for(let tries=0; tries<8 && seen.has(kind); tries++) kind = rollNodeKind(step);
      }
      kinds.push(kind); seen.add(kind);
      if(firstRunActive() && kind==='treasure') firstRunTreasureInChoices = true;
    }
    return kinds.map(makeNode);
  }

  /* ============ 잠식 ============
     0 에서 시작해 100 에 닿으면 끝난다. 회복 수단은 없다 — 한 방향으로만 흐르는 시계다.
     깊이 내려갈수록 번지는 속도가 빨라져서, 심층에서 시간을 끄는 대가가 커진다. */
  const EROSION_MAX  = 100;
  const EROSION_REST = 5;                       /* 은신처에서 숨을 고르는 값 */
  /* 전투 턴당 증가량. 정수로는 눈금이 너무 거칠어 소수로 쌓고 표시할 때만 반올림한다.
     전투 1회(12~15턴) ≈ 20~38%, 전투 3회짜리 런이면 75% 언저리에 닿는다. */
  /* 길이가 흔들려도 "노드 수 × 턴당 잠식" 총량은 기준 챕터와 같게 맞춘다 —
     짧아진 만큼 턴당 잠식은 오르고, 길어진 만큼 내려간다. */
  function erosionRate(){
    const ch = chapter();
    let perTurn = ch.erosion;
    if(!firstRunActive()){
      const base = CHAPTERS.find(c=>c.tier===ch.tier);
      if(base && ch.length) perTurn = base.erosion * (base.length / ch.length);
    }
    /* 위협만큼 가파르지는 않게 — 잠식은 절반의 기울기로만 따라 오른다.
       그래야 반복 진입이 '못 버티고 죽는' 게 아니라 '점점 세지는 적을 상대'하는
       쪽으로 느껴진다. */
    const expeditionErosionMul = 1 + (expeditionThreatMul()-1)*0.5;
    return perTurn * lighthouseErosionMul() * pactErosionMul() * expeditionErosionMul;
  }
  function addErosion(amount){
    S.erosion = Math.min(EROSION_MAX, S.erosion + amount * relicMul('erosionMul'));
    if(S.erosion > (S.erosionPeakSeen||0)) S.erosionPeakSeen = S.erosion;
    return S.erosion >= EROSION_MAX;
  }
