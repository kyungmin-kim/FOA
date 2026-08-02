  /* ============ CARD DATA ============ */
  const CARD_DB = {
    vanguard: [
      {name:'방패 밀어치기', cost:1, type:'attack', dmg:6, selfBlock:4, owner:'vanguard', range:'melee', desc:'닿는 가장 앞의 적에게 6 피해. 자신 방어 4 획득.'},
      {name:'놋쇠 벽', cost:1, type:'block', block:9, owner:'vanguard', range:'support', desc:'자신 방어 9 획득.'},
      {name:'닻 내리기', cost:2, type:'block_party', block:5, owner:'vanguard', range:'support', desc:'생존한 아군 전체 방어 5 획득.'},
      {name:'쇠사슬 후려치기', cost:2, type:'attack', dmg:12, owner:'vanguard', range:'melee', desc:'닿는 가장 앞의 적에게 12 피해.'},
      {name:'납 장화', cost:0, type:'block', block:5, owner:'vanguard', range:'support', desc:'자신 방어 5 획득.'},
    ],
    chemist: [
      {name:'부식산 투척', cost:1, type:'attack', dmg:5, owner:'chemist', range:'ranged', desc:'적 한 명을 골라 5 피해.'},
      {name:'섬광탄', cost:1, type:'attack', dmg:4, owner:'chemist', range:'aoe', desc:'모든 적에게 4 피해.'},
      {name:'재빠른 조제', cost:0, type:'draw', draw:2, owner:'chemist', range:'support', desc:'카드 2장을 드로우한다.'},
      {name:'수은 증기', cost:2, type:'attack', dmg:8, owner:'chemist', range:'aoe', desc:'모든 적에게 8 피해.'},
      {name:'응급 봉합제', cost:1, type:'heal', heal:7, owner:'chemist', range:'support_ally', desc:'아군 한 명 체력 7 회복.'},
    ],
    priest: [
      {name:'역병 주사', cost:1, type:'attack', dmg:6, owner:'priest', range:'ranged', desc:'적 한 명을 골라 6 피해.'},
      {name:'고해성사', cost:1, type:'heal', heal:8, owner:'priest', range:'support_ally', desc:'아군 한 명 체력 8 회복.'},
      {name:'정화 의식', cost:2, type:'calm_party', calm:6, owner:'priest', range:'support', desc:'생존한 아군 전체 심도압박 6 감소.'},
      {name:'성수 세례', cost:2, type:'attack', dmg:7, owner:'priest', range:'aoe', desc:'모든 적에게 7 피해.'},
      {name:'속죄의 기도', cost:1, type:'calm', calm:12, owner:'priest', range:'support_ally', desc:'아군 한 명 심도압박 12 감소.'},
    ],
    oracle: [
      {name:'저주받은 조준', cost:1, type:'attack', dmg:8, selfDp:5, owner:'oracle', range:'ranged', desc:'적 한 명을 골라 8 피해. 자신 심도압박 5 상승.'},
      {name:'운명 비틀기', cost:1, type:'reroll_intent', owner:'oracle', range:'ranged', desc:'적 한 명의 예고된 행동을 다시 정한다.'},
      {name:'예지의 눈', cost:0, type:'foresight', draw:1, calm:4, owner:'oracle', range:'support', desc:'카드 1장 드로우. 자신 심도압박 4 감소.'},
      {name:'심연의 시선', cost:2, type:'attack', dmg:14, selfDp:8, owner:'oracle', range:'ranged', desc:'적 한 명을 골라 14 피해. 자신 심도압박 8 상승.'},
      {name:'별자리 재배열', cost:2, type:'draw', draw:3, owner:'oracle', range:'support', desc:'카드 3장을 드로우한다.'},
    ],
    hellion: [
      {name:'관통 작살', cost:1, type:'attack', dmg:11, selfDp:4, owner:'hellion', range:'melee', desc:'닿는 가장 앞의 적에게 11 피해. 자신 심도압박 4 상승.'},
      {name:'피의 회전', cost:2, type:'attack', dmg:7, selfDp:3, owner:'hellion', range:'aoe', desc:'모든 적에게 7 피해. 자신 심도압박 3 상승.'},
      {name:'전투 광기', cost:0, type:'draw', draw:2, selfDp:5, owner:'hellion', range:'support', desc:'카드 2장을 드로우한다. 자신 심도압박 5 상승.'},
      {name:'살점 뜯기', cost:2, type:'attack', dmg:16, selfDp:6, owner:'hellion', range:'melee', desc:'닿는 가장 앞의 적에게 16 피해. 자신 심도압박 6 상승.'},
      {name:'피 냄새', cost:1, type:'block', block:10, selfDp:3, owner:'hellion', range:'support', desc:'자신 방어 10 획득. 자신 심도압박 3 상승.'},
    ],
    robber: [
      {name:'독 묻은 단검', cost:1, type:'attack', dmg:7, owner:'robber', range:'ranged', desc:'적 한 명을 골라 7 피해.'},
      {name:'급소 찌르기', cost:2, type:'attack', dmg:13, owner:'robber', range:'ranged', desc:'적 한 명을 골라 13 피해.'},
      {name:'그림자 도약', cost:0, type:'swap', owner:'robber', range:'support_ally', desc:'아군 한 명을 전열로 이동시킨다. (이미 전열이면 중열과 교대)'},
      {name:'연막탄', cost:1, type:'attack', dmg:4, owner:'robber', range:'aoe', desc:'모든 적에게 4 피해.'},
      {name:'뒷주머니 뒤지기', cost:0, type:'draw', draw:2, owner:'robber', range:'support', desc:'카드 2장을 드로우한다.'},
    ],
    jester: [
      {name:'물에 젖은 현', cost:1, type:'attack', dmg:7, owner:'jester', range:'ranged', desc:'적 한 명을 골라 7 피해.'},
      {name:'뱃노래', cost:1, type:'calm', calm:14, owner:'jester', range:'support_ally', desc:'아군 한 명 심도압박 14 감소.'},
      {name:'진혼곡', cost:2, type:'calm_party', calm:9, owner:'jester', range:'support', desc:'생존한 아군 전체 심도압박 9 감소.'},
      {name:'마지막 소절', cost:2, type:'attack', dmg:10, owner:'jester', range:'ranged', desc:'적 한 명을 골라 10 피해.'},
      {name:'불협화음', cost:1, type:'reroll_intent', owner:'jester', range:'ranged', desc:'적 한 명의 예고된 행동을 다시 정한다.'},
    ],
    neutral: [
      {name:'간단한 응급처치', cost:1, type:'heal', heal:6, owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 6 회복.'},
      {name:'숨고르기', cost:1, type:'calm', calm:10, owner:'neutral', range:'support_ally', desc:'아군 한 명 심도압박 10 감소.'},
      {name:'위치 교환', cost:1, type:'swap', owner:'neutral', range:'support_ally', desc:'아군 한 명을 전열로 이동시킨다. (이미 전열이면 중열과 교대)'},
      {name:'젖은 붕대', cost:0, type:'heal', heal:4, owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 4 회복.'},
      {name:'등불 심지', cost:0, type:'draw', draw:1, owner:'neutral', range:'support', desc:'카드 1장을 드로우한다.'},
      {name:'선체 잔해', cost:1, type:'block_party', block:4, owner:'neutral', range:'support', desc:'생존한 아군 전체 방어 4 획득.'},
      {name:'구명줄', cost:2, type:'heal', heal:14, owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 14 회복.'},
      {name:'묵주 세기', cost:2, type:'calm_party', calm:7, owner:'neutral', range:'support', desc:'생존한 아군 전체 심도압박 7 감소.'},
      {name:'비상 탈출', cost:3, type:'emergency_escape', owner:'neutral', range:'support', desc:'이 전투에서 빠져나와 지도로 돌아간다. 부상·심도압박·수심에 따라 실패할 수 있다.'},
    ],
  };

  /* 에픽은 주로 합성에서 5%로 나타난다. 이 중 시작용 공용 에픽 3종은
     첫 덱 구성의 공용 후보에 낮은 확률로 섞여 들어갈 수 있다. */
  const EPIC_FUSION_CHANCE = 0.05;
  const ABYSSAL_VERDICT_EPIC_CHANCE = 0.01;
  const START_EPIC_OFFER_CHANCE = 0.25;
  const START_EPIC_CARD_POOL = [
    {id:'drowned_sentence', name:'익사의 판결', cost:0, type:'drowned_sentence', dmg:40, splashRatio:0.2, owner:'neutral', range:'ranged', epic:true, desc:'적 한 명에게 40 피해. 양옆 적에게 8 피해.'},
    {id:'flooded_bulwark', name:'침수된 방벽', cost:0, type:'block_party', block:18, riposteRatio:0.5, owner:'neutral', range:'support', epic:true, desc:'생존한 아군 전체 방어 18 획득. 공격받으면 방어 획득값의 50% 반격.'},
    {id:'nameless_hymn', name:'무명자의 찬가', cost:0, type:'nameless_hymn', owner:'neutral', range:'support', epic:true, desc:'아군 전체 심도압박을 0으로 만들고, 지운 총합의 1/3만큼 모든 적에게 피해.'},
  ];
  const EPIC_CARD_POOL = [
    {id:'abyssal_verdict', name:'심해왕의 단죄', cost:0, type:'abyssal_verdict', owner:'neutral', range:'ranged', epic:true, unupgradable:true, desc:'보스를 제외한 지정 적을 즉시 섬멸.'},
    {id:'thousand_maws_tide', name:'천 개의 입의 조류', cost:1, type:'thousand_maws_tide', owner:'neutral', range:'ranged', epic:true, unupgradable:true, desc:'선택한 적 양옆의 일반 적을 즉시 섬멸. 엘리트·보스 제외.'},
    {id:'sunken_ark', name:'침몰한 성궤', cost:0, type:'sunken_ark', turns:2, owner:'neutral', range:'support', epic:true, unupgradable:true, desc:'2턴 동안 생존한 아군 전체 무적.'},
    {id:'saints_last_prayer', name:'성자의 마지막 기도', cost:0, type:'saints_last_prayer', healRatio:0.5, regenTotal:30, regenTurns:3, owner:'neutral', range:'support', epic:true, desc:'생존한 아군 전체 체력 50% 회복. 3턴 동안 추가로 총 30 회복.'},
    {id:'star_eating_chart', name:'별을 먹는 해도', cost:3, type:'epic_attack', dmg:50, owner:'neutral', range:'ranged', epic:true, desc:'아무 열의 적 한 명을 골라 50 피해.'},
  ].concat(START_EPIC_CARD_POOL);
  /* 심해왕의 단죄는 에픽 풀 안에서도 1%만 모습을 드러낸다. */
  function pickEpicCard(){
    const verdict = EPIC_CARD_POOL.find(card=>card.id==='abyssal_verdict');
    const others = EPIC_CARD_POOL.filter(card=>card.id!=='abyssal_verdict');
    return verdict && Math.random()<ABYSSAL_VERDICT_EPIC_CHANCE ? verdict : pickOne(others);
  }
  /* 저장된 런의 기존 에픽도 새 규칙으로 갱신한다. 이미 강화했던 판결·성궤·조류는
     강화 불가 카드가 되므로 기본 단계로 되돌리고, 나머지는 기존 강화 단계를 유지한다. */
  function refreshSpecialEpicCard(card){
    if(!card) return card;
    const plainName = String(card.baseName || card.name || '').replace(/\++$/, '');
    const base = EPIC_CARD_POOL.find(entry=>entry.id===card.id || entry.name===plainName);
    if(!base) return card;
    const meta = {uid:card.uid, defId:card.defId, deckOrigin:card.deckOrigin};
    const oldLevel = Number.isFinite(card.upgradeLevel) ? card.upgradeLevel : (card.upgraded ? 1 : 0);
    Object.assign(card, base, meta);
    if(base.unupgradable){
      card.upgraded = false; card.upgradeLevel = 0; card.baseName = base.name; card.name = base.name;
      return card;
    }
    card.upgradeLevel = 0; card.upgraded = false; card.baseName = base.name; card.name = base.name;
    for(let level=0; level<oldLevel; level++) raiseCardLevel(card);
    return card;
  }
  /* 전설은 심연이 남긴 단 한 번의 예외다. 에픽보다 훨씬 드물며 보스 보상에서만 모습을 드러낸다. */
  const LEGENDARY_CARD_POOL = [
    {id:'sunless_noon', name:'태양 없는 정오', cost:0, type:'double_ap', owner:'neutral', range:'support', legendary:true, desc:'현재 턴에 남은 AP를 두 배로 만든다.'},
    {id:'crown_of_the_deep', name:'심해왕의 왕관', cost:2, type:'epic_attack', dmg:48, owner:'neutral', range:'aoe', legendary:true, desc:'모든 적에게 48 피해.'},
    {id:'last_diving_bell', name:'마지막 잠수종', cost:1, type:'legendary_sanctuary', heal:22, calm:22, block:14, owner:'neutral', range:'support', legendary:true, desc:'생존한 아군 전체 체력 22 회복, 심도압박 22 감소, 방어 14 획득.'},
  ];
  function isLegendaryCard(card){ return !!(card && card.legendary); }
  function isEpicCard(card){ return !!(card && card.epic); }
  function cardRarityLabel(card){
    if(isLegendaryCard(card)) return '전설';
    if(isEpicCard(card)) return '에픽';
    return card && card.owner==='neutral' ? '일반' : '직업';
  }
  function cardVisualClass(card){
    if(isLegendaryCard(card)) return 'legendary';
    if(isEpicCard(card)) return 'epic';
    return card && card.owner==='neutral' ? 'normal' : 'class';
  }

  /* 일반 합성 결과. 에픽이 아닌 결과도 매번 같은 카드가 되지 않도록 20종을 둔다.
     합성 공격은 특정 직군의 무기가 아니므로 사거리·대열 제약 없이 심연 자체가 적을 겨눈다. */
  const FUSION_CARD_POOL = [
    {name:'속죄의 결속',       cost:2, type:'fuse_support', heal:5,  calm:8,  owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 5 회복 + 심도압박 8 감소.'},
    {name:'심해 봉합사',       cost:1, type:'heal',          heal:10,          owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 10 회복.'},
    {name:'염수 주사',         cost:0, type:'heal',          heal:5,           owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 5 회복.'},
    {name:'고요의 앰플',       cost:1, type:'calm',          calm:17,          owner:'neutral', range:'support_ally', desc:'아군 한 명 심도압박 17 감소.'},
    {name:'기압 조절기',       cost:0, type:'calm',          calm:9,           owner:'neutral', range:'support_ally', desc:'아군 한 명 심도압박 9 감소.'},
    {name:'잠수사의 묵주',     cost:2, type:'calm_party',    calm:10,          owner:'neutral', range:'support', desc:'생존한 아군 전체 심도압박 10 감소.'},
    {name:'침전된 성수',       cost:1, type:'calm_party',    calm:6,           owner:'neutral', range:'support', desc:'생존한 아군 전체 심도압박 6 감소.'},
    {name:'침몰선 외판',       cost:1, type:'block_party',   block:7,          owner:'neutral', range:'support', desc:'생존한 아군 전체 방어 7 획득.'},
    {name:'납빛 격벽',         cost:2, type:'block_party',   block:13,         owner:'neutral', range:'support', desc:'생존한 아군 전체 방어 13 획득.'},
    {name:'수압 완충막',       cost:0, type:'block_party',   block:4,          owner:'neutral', range:'support', desc:'생존한 아군 전체 방어 4 획득.'},
    {name:'구명 밧줄',         cost:0, type:'swap',                            owner:'neutral', range:'support_ally', desc:'아군 한 명을 전열로 이동시킨다.'},
    {name:'조난 신호',         cost:1, type:'reroll_intent',                  owner:'neutral', range:'ranged', desc:'적 한 명의 예고된 행동을 다시 정한다.'},
    {name:'유실물 수색',       cost:0, type:'draw',          draw:2,           owner:'neutral', range:'support', desc:'카드 2장을 드로우한다.'},
    {name:'해도 보정',         cost:1, type:'draw',          draw:3,           owner:'neutral', range:'support', desc:'카드 3장을 드로우한다.'},
    {name:'온전한 다이빙 벨',  cost:1, type:'fuse_support', heal:7,  calm:10, owner:'neutral', range:'support_ally', desc:'아군 한 명 체력 7 회복 + 심도압박 10 감소.'},
    {name:'녹슨 하푼',         cost:1, type:'fusion_attack', dmg:10,           owner:'neutral', range:'ranged', desc:'적 한 명을 골라 10 피해.'},
    {name:'압력탄',            cost:1, type:'fusion_attack', dmg:5,            owner:'neutral', range:'aoe', desc:'모든 적에게 5 피해.'},
    {name:'심해 작살포',       cost:2, type:'fusion_attack', dmg:18,           owner:'neutral', range:'ranged', desc:'적 한 명을 골라 18 피해.'},
    {name:'가라앉은 해류',     cost:2, type:'fusion_attack', dmg:9,            owner:'neutral', range:'aoe', desc:'모든 적에게 9 피해.'},
    {name:'봉합의 의식',       cost:2, type:'heal_party',    heal:6,           owner:'neutral', range:'support', desc:'생존한 아군 전체 체력 6 회복.'},
  ];

  /* 합성으로만 나오는 직업 카드. 현재 인양대에 있는 전문가의 카드만 결과 후보가 된다. */
  const FUSION_CLASS_CARD_POOL = [
    {name:'심해 방패진',       cost:1, type:'block',       block:16,              owner:'vanguard', range:'support', desc:'자신 방어 16 획득.'},
    {name:'닻의 처형',         cost:2, type:'attack',      dmg:18,                owner:'vanguard', range:'melee', desc:'닿는 가장 앞의 적에게 18 피해.'},
    {name:'황산 폭뢰',         cost:2, type:'attack',      dmg:12,                owner:'chemist',  range:'aoe', desc:'모든 적에게 12 피해.'},
    {name:'심해 응고제',       cost:1, type:'heal',        heal:14,               owner:'chemist',  range:'support_ally', desc:'아군 한 명 체력 14 회복.'},
    {name:'소금의 성유',       cost:1, type:'calm_party',  calm:11,               owner:'priest',   range:'support', desc:'생존한 아군 전체 심도압박 11 감소.'},
    {name:'침몰자의 고해',     cost:2, type:'heal_party',  heal:10,               owner:'priest',   range:'support', desc:'생존한 아군 전체 체력 10 회복.'},
    {name:'심연 좌표',         cost:1, type:'attack',      dmg:16, selfDp:6,      owner:'oracle',   range:'ranged', desc:'적 한 명을 골라 16 피해. 자신 심도압박 6 상승.'},
    {name:'별빛 역류',         cost:0, type:'foresight',   draw:2, calm:8,        owner:'oracle',   range:'support', desc:'카드 2장 드로우. 자신 심도압박 8 감소.'},
    {name:'광기의 작살비',     cost:2, type:'attack',      dmg:13, selfDp:5,      owner:'hellion',  range:'aoe', desc:'모든 적에게 13 피해. 자신 심도압박 5 상승.'},
    {name:'익사의 합주',       cost:1, type:'calm_party',  calm:15,               owner:'jester',   range:'support', desc:'생존한 아군 전체 심도압박 15 감소.'},
  ];

