  /* ============ RELICS ============
     가라앉은 예배당에서 건져 올린 골동품들. 인양될 때마다 하나를 챙기고,
     한 번 챙긴 것은 런이 끝날 때까지 벗겨지지 않는다.
     scope — 'all' 은 전원, 그 외에는 사거리 계열('melee'/'mid'/'ranged') 또는 병과 id. */
  const RELIC_POOL = [
    {id:'dead_compass',tier:'common',art:'c1',name:'망자의 나침반',scope:'all',flavor:'북쪽은 이미 물속에 있다. 바늘은 익사자들의 발자국이 아니라, 당신을 향한 시선을 가리킨다.',boon:'모든 공격 피해 +10%',effect:{dmgMul:1.10}},
    {id:'pilgrim_letter',tier:'common',art:'c2',name:'낡은 순례자의 서신',scope:'all',flavor:'봉랍 아래에서 소금물이 마르지 않는다. 마지막 문장은 읽을 때마다 한 줄씩 늘어난다.',boon:'심도압박 상승량 -10%',effect:{dpMul:0.90}},
    {id:'forbidden_record',tier:'common',art:'c3',name:'금단의 기록',scope:'all',flavor:'펼친 쪽마다 다른 필체가 다음 하강을 권한다. 마지막 필체는 당신의 것이다.',boon:'매 턴 카드 1장 추가',effect:{draw:1}},
    {id:'settled_elixir',tier:'common',art:'c4',name:'침전된 연금액',scope:'all',flavor:'가라앉은 침전물은 아직 미세하게 맥박친다. 병을 흔들면 멀리서도 같은 박동이 답한다.',boon:'회복량 +25%',effect:{healMul:1.25}},
    {id:'salt_skull',tier:'common',art:'c5',name:'염해의 해골',scope:'all',flavor:'텅 빈 안와에 밀물이 찬다.',boon:'반격 확률 +10% · 반격 피해 +2',effect:{riposte:0.10,rip:2}},
    {id:'sunken_coin',tier:'rare',art:'c6',name:'침몰한 왕국의 주화',scope:'all',flavor:'앞면에는 왕의 얼굴, 뒷면에는 뜬 눈이 있다. 어느 쪽도 손에 닿기 전에는 결정되지 않는다.',boon:'매 턴 AP +1',effect:{ap:1}},
    {id:'abyss_pilgrim',tier:'uncommon',art:'u1',name:'심연을 엿본 순례자',scope:'all',flavor:'후드는 얼굴을 숨기지 못한다. 안쪽의 눈이 너무 많다.',boon:'전원 최대 체력 +6',effect:{maxHp:6}},
    {id:'deep_lantern',tier:'uncommon',art:'u2',name:'심해의 등불',scope:'all',flavor:'유리 속 불꽃은 물을 태운다. 빛이 닿는 곳마다 어둠도 당신의 얼굴을 배운다.',boon:'전투 시작 시 전원 체력 4 회복',effect:{battleHeal:4}},
    {id:'seabed_jade_ring',tier:'uncommon',art:'u3',name:'해저의 녹옥 반지',scope:'melee',flavor:'손가락이 빠진 자리에서 녹옥만 빛난다.',boon:'근접 병과 흘려막기 +10%',effect:{guard:0.10}},
    {id:'drowned_fang',tier:'uncommon',art:'u4',name:'익사자의 송곳니',scope:'melee',flavor:'무는 법만 기억한 뼈 조각이다.',boon:'근접 병과 공격 피해 +25%',effect:{dmgMul:1.25}},
    {id:'sunken_vault',tier:'uncommon',art:'u5',name:'침몰한 금고',scope:'all',flavor:'쇠문 안에는 금 대신 버티는 법이 보관되어 있었다.',boon:'방어 획득량 +25%',effect:{blockMul:1.25}},
    {id:'black_tide_chalice',tier:'uncommon',art:'u6',name:'검은 조류의 성배',scope:'all',flavor:'마시면 바닷물이 상처의 이름을 잊는다.',boon:'회복량 +50% · 심도압박 상승량 -10%',effect:{healMul:1.5,dpMul:0.90}},
    {id:'sunken_reliquary',tier:'legendary',art:'u5',name:'침몰한 성물함',scope:'all',flavor:'잠긴 칸 하나가 아직 비어 있다. 안쪽에서 누군가 다음 유물을 기다리며 숨을 참는다.',boon:'유물 슬롯 +1',effect:{relicSlots:1}},
    {id:'deep_priest_mask',tier:'rare',art:'r1',name:'심해 사제의 가면',scope:'all',flavor:'가면을 쓰면 속삭임이 기도가 된다.',boon:'심도압박 상승량 -35%',effect:{dpMul:0.65}},
    {id:'drowned_binding',tier:'rare',art:'r2',name:'익사자의 속박',scope:'all',flavor:'사슬은 묶지 않는다. 다가오는 죽음을 한 박자 늦춘다.',boon:'전원 회피 +10%',effect:{dodge:0.10}},
    {id:'sunken_king_crown',tier:'very-rare',art:'r3',name:'침몰왕의 왕관',scope:'all',flavor:'왕관을 쓴 자만이 물의 명령을 더 오래 거스를 수 있다.',boon:'매 턴 AP +1 · 전원 최대 체력 +8',effect:{ap:1,maxHp:8}},
    {id:'abyss_ice_crystal',tier:'rare',art:'r4',name:'심연빙정',scope:'ranged',flavor:'차가운 수정 안에서 먼 바다의 비명이 굳어 있다.',boon:'원거리 병과 공격 피해 +35%',effect:{dmgMul:1.35}},
    {id:'fallen_saint_banner',tier:'rare',art:'r5',name:'몰락한 성자의 기치',scope:'all',flavor:'기치는 찢겼지만 뒤로 물러서지 않는다.',boon:'방어 획득량 +40%',effect:{blockMul:1.40}},
    {id:'abyss_eye',tier:'rare',art:'r6',name:'심연을 보는 눈',scope:'all',flavor:'눈은 감기지 않는다. 당신이 그것으로 심연을 보는지, 심연이 그것으로 당신을 보는지 알 수 없다.',boon:'매 턴 카드 1장 추가 · 전원 회피 +5%',effect:{draw:1,dodge:0.05}},
    {id:'living_abyss_heart',tier:'very-rare',art:'v1',name:'심연의 살아있는 심장',scope:'all',flavor:'그것은 당신보다 먼저 뛰기 시작한다.',boon:'전원 최대 체력 +14',effect:{maxHp:14}},
    {id:'seabed_lord_shackle',tier:'very-rare',art:'v2',name:'해저 군주의 족쇄',scope:'all',flavor:'무거운 족쇄가 몸을 붙들고, 충격도 함께 붙든다.',boon:'전원 흘려막기 +15%',effect:{guard:0.15}},
    {id:'ocean_grimoire',tier:'rare',art:'v3',name:'대양의 금서',scope:'all',flavor:'읽는 동안 페이지 수가 늘어난다. 마지막 장에는 아직 일어나지 않은 인양 기록이 적혀 있다.',boon:'매 턴 카드 2장 추가',effect:{draw:2}},
    {id:'dead_god_chalice',tier:'very-rare',art:'v4',name:'죽은 신의 성배',scope:'all',flavor:'성배는 비어 있지만 마신 이는 되살아난다.',boon:'회복량 +75% · 전투 시작 시 전원 체력 8 회복',effect:{healMul:1.75,battleHeal:8}},
    {id:'drowned_thorn_crown',tier:'very-rare',art:'v5',name:'익사자의 가시환',scope:'all',flavor:'찔린 자의 피가 아니라 공격한 자의 피를 탐낸다.',boon:'반격 확률 +20% · 반격 피해 +3',effect:{riposte:0.20,rip:3}},
    {id:'abyss_serum',tier:'very-rare',art:'v6',name:'심연의 혈청',scope:'all',flavor:'혈관 속에 밀물을 주입한다.',boon:'매 턴 AP +2 · 잠식 진행 +25%',effect:{ap:2,erosionMul:1.25}},
    {id:'abyss_king_crown',tier:'legendary',art:'l1',name:'심연왕의 왕관',scope:'all',flavor:'머리 위의 바다는 왕관을 알아본다.',boon:'매 턴 AP +2 · 전원 최대 체력 +12',effect:{ap:2,maxHp:12}},
    {id:'ocean_watcher',tier:'very-rare',art:'l2',name:'대양의 감시자',scope:'all',flavor:'거대한 눈이 파도 뒤에서 당신의 손을 읽는다. 그 눈은 바다의 일부가 아니라 바다 전체의 창이다.',boon:'매 턴 카드 2장 추가 · 모든 공격 피해 +25%',effect:{draw:2,dmgMul:1.25}},
    {id:'sunken_god_ark',tier:'legendary',art:'l3',name:'침몰한 신의 성궤',scope:'all',flavor:'닫힌 궤 안에서 기도가 갑옷처럼 굳는다.',boon:'방어 획득량 +50% · 회복량 +40%',effect:{blockMul:1.5,healMul:1.4}},
    {id:'kraken_heart_core',tier:'legendary',art:'l4',name:'크라켄의 심장핵',scope:'all',flavor:'붉은 핵이 박동할 때마다 해류가 갈라진다.',boon:'모든 공격 피해 +50%',effect:{dmgMul:1.50}},
    {id:'drowned_god_blade',tier:'legendary',art:'l5',name:'익사신의 성검',scope:'melee',flavor:'칼날이 젖을수록 더 많은 이름을 베어 낸다.',boon:'근접 병과 공격 피해 +60% · 반격 피해 +4',effect:{dmgMul:1.60,rip:4}},
    {id:'abyss_archduke',tier:'legendary',art:'l6',name:'심연의 대공',scope:'all',flavor:'우상은 말하지 않는다. 다만 속삭임이 감히 다가오지 못한다.',boon:'심도압박 상승량 -55% · 전원 회피 +12%',effect:{dpMul:0.45,dodge:0.12}},
  ];

  const RELIC_TIER_LABEL = {common:'일반',uncommon:'고급',rare:'희귀','very-rare':'매우 희귀',legendary:'전설'};
  const RELIC_ART_POS = {
    c1:[-156,-37],c2:[-254,-37],c3:[-348,-37],c4:[-443,-37],c5:[-541,-37],c6:[-636,-37],
    u1:[-156,-132],u2:[-254,-132],u3:[-348,-132],u4:[-443,-132],u5:[-541,-132],u6:[-636,-132],
    r1:[-156,-227],r2:[-254,-227],r3:[-348,-227],r4:[-443,-227],r5:[-541,-227],r6:[-636,-227],
    v1:[-156,-321],v2:[-254,-321],v3:[-348,-321],v4:[-443,-321],v5:[-541,-321],v6:[-636,-321],
    l1:[-156,-417],l2:[-254,-417],l3:[-348,-417],l4:[-443,-417],l5:[-541,-417],l6:[-636,-417]
  };
  /* 36px 칩용 좌표는 액자의 중앙을 향한다. 큰 보상 초상은 액자의 좌상단에서
     시작해야 병·성배·원형 테두리가 잘리지 않는다. (원본 시트는 화면의 1/2 배율) */
  const RELIC_ART_LARGE_POS = {
    c1:[-132,-14],c2:[-230,-14],c3:[-327,-14],c4:[-423,-14],c5:[-520,-14],c6:[-616,-14],
    u1:[-132,-109],u2:[-230,-109],u3:[-327,-109],u4:[-423,-109],u5:[-520,-109],u6:[-616,-109],
    r1:[-132,-204],r2:[-230,-204],r3:[-327,-204],r4:[-423,-204],r5:[-520,-204],r6:[-616,-204],
    v1:[-132,-299],v2:[-230,-299],v3:[-327,-299],v4:[-423,-299],v5:[-520,-299],v6:[-616,-299],
    l1:[-132,-394],l2:[-230,-394],l3:[-327,-394],l4:[-423,-394],l5:[-520,-394],l6:[-616,-394]
  };
  function relicPortrait(r, large, compact){
    const pos = (large ? RELIC_ART_LARGE_POS : RELIC_ART_POS)[r.art] || (large ? [-132,-14] : [-156,-37]);
    /* 상단 유물 선반은 아이콘과 스프라이트 좌표를 함께 절반으로 축소한다. */
    const scale = compact ? 0.35 : 1;
    return `<span class="relic-portrait${large?' large':''}${compact?' compact':''}" style="--relic-x:${pos[0]*scale}px;--relic-y:${pos[1]*scale}px" aria-hidden="true"></span>`;
  }
  function relicTier(r){ return `<span class="relic-tier tier-${r.tier}">${RELIC_TIER_LABEL[r.tier]||'유물'}</span>`; }

  /* 기본 유물함은 셋. 슬롯 유물을 지니면 한 칸이 더 열려 넷째까지 담을 수 있다. */
  const RELIC_CAP = 3;
  function ownedRelics(){ return (S && S.relics) || []; }
  function relicCap(relics){
    const list = relics || ownedRelics();
    return RELIC_CAP + list.reduce((total, r)=>total + ((r.effect && r.effect.relicSlots) || 0), 0);
  }
  function canAddRelic(relic){
    const next = ownedRelics().concat(relic);
    return next.length <= relicCap(next);
  }
  function canReplaceRelic(drop, incoming){
    const next = ownedRelics().filter(r=>r!==drop).concat(incoming);
    return next.length <= relicCap(next);
  }
  /* unit 을 넘기지 않으면 파티 전체에 걸리는 값(잠식·드로우·AP)을 묻는 것이다.
     적을 넘기면 언제나 빈손 — 유물은 적에게 붙지 않는다. */
  function relicApplies(r, unit){
    if(unit && !unit.isHero) return false;
    if(r.scope==='all') return true;
    if(!unit) return false;
    return unit.cls===r.scope || unit.reach===r.scope;
  }
  function relicSum(key, unit){
    let v = 0;
    ownedRelics().forEach(r=>{ if(r.effect[key]!=null && relicApplies(r, unit)) v += r.effect[key]; });
    return v;
  }
  function relicMul(key, unit){
    let v = 1;
    ownedRelics().forEach(r=>{ if(r.effect[key]!=null && relicApplies(r, unit)) v *= r.effect[key]; });
    return v;
  }
  /* 최대 체력은 판정 때마다 더하면 회복량이 꼬인다 — 주울 때 한 번만 몸에 새긴다 */
  function grantRelic(relic){
    S.relics.push(relic);
    if(relic.effect.maxHp){
      S.party.forEach(p=>{
        if(!p || !p.alive || !relicApplies(relic, p)) return;
        p.maxHp += relic.effect.maxHp;
        p.hp    += relic.effect.maxHp;
      });
    }
  }
  /* 내려놓을 때는 몸에 새긴 값을 되돌린다 — 최대 체력을 그대로 두면 유물을 돌려가며
     체력만 불릴 수 있다. 현재 체력은 새 최대치를 넘지 않게 깎는다. */
  function revokeRelic(relic){
    const at = S.relics.indexOf(relic);
    if(at < 0) return;
    S.relics.splice(at, 1);
    if(relic.effect.maxHp){
      S.party.forEach(p=>{
        if(!p || !relicApplies(relic, p)) return;
        p.maxHp = Math.max(1, p.maxHp - relic.effect.maxHp);
        p.hp    = Math.min(p.hp, p.maxHp);
      });
    }
  }

  /* 유물이 들어올 때 반드시 이 문을 지난다. 자리가 없으면 고르는 화면으로 보낸다.
     화면을 가로챘으면 true — 부른 쪽은 제 화면 전환을 접어야 한다. */
  function offerRelic(relic, back){
    if(!relic) return false;
    if(canAddRelic(relic)){ grantRelic(relic); return false; }
    S.relicSwap = { incoming: relic, back: back || S.screen };
    S.screen = 'relicSwap';
    return true;
  }

  /* 새로 합류한 사람도 이미 챙긴 유물의 몫을 받는다 — 몸에 새기는 값이라 합류 시점에 한 번 얹는다 */
  function applyRelicMaxHp(hero){
    ownedRelics().forEach(r=>{
      if(!r.effect.maxHp || !relicApplies(r, hero)) return;
      hero.maxHp += r.effect.maxHp;
      hero.hp    += r.effect.maxHp;
    });
  }
  /* 보스급은 제 몫을 남기고 죽는다.
     '보스급' 의 기준은 정화 기회를 두 번 주는 그 기준(정예·보스)을 그대로 쓴다.
     이미 챙긴 것은 후보에서 빠지고, 열한 점을 다 모았으면 더 나오지 않는다. */
  function isBossTier(node){ return !!node && (node.type==='elite' || node.boss); }
  function dropRelic(){
    const owned = ownedRelics().map(r=>r.id);
    const pool = RELIC_POOL.filter(r=>owned.indexOf(r.id)<0);
    return weightedRelicPick(pool);   /* 실제 획득은 offerRelic 이 맡는다 */
  }

  /* 등급이 높은 것은 더 강력하되, 인양 때마다 쉽게 쌓이지는 않는다. */
  const RELIC_TIER_WEIGHT = {common:46, uncommon:30, rare:16, 'very-rare':6, legendary:2};
  function weightedRelicPick(pool){
    if(!pool.length) return null;
    let roll = Math.random() * pool.reduce((sum,r)=>sum+(RELIC_TIER_WEIGHT[r.tier]||1), 0);
    for(const relic of pool){
      roll -= RELIC_TIER_WEIGHT[relic.tier]||1;
      if(roll < 0) return relic;
    }
    return pool[pool.length-1];
  }
  function relicOffer(){
    const owned = ownedRelics().map(r=>r.id);
    const pool = RELIC_POOL.filter(r=>owned.indexOf(r.id)<0).slice();
    const offer=[];
    while(pool.length && offer.length<3){
      const relic = weightedRelicPick(pool);
      offer.push(relic);
      pool.splice(pool.indexOf(relic),1);
    }
    return offer;
  }

