  /* ============ STATE ============ */
  let uid = 0;
  const nextId = () => 'u' + (uid++);

  let S = null;

  function rankName(idx){ return idx===0?'전열':idx===1?'중열':idx===2?'후열':idx===3?'심부':'심연'; }
 
  function makeHero(classId){
    const def = CLASS_DEFS[classId];
    return {id:classId, name:def.name, cls:classId, reach:def.reach, isHero:true,
            maxHp:def.maxHp, hp:def.maxHp, block:0, dp:0, collapsed:false, alive:true, react:null,
            descentWins:0, descentHp:0, descentReact:0};
  }
  /* 인양에 살아 돌아온 사람은 같은 심연을 두 번 겪지 않는다.
     성공한 하강 수가 깊어질수록 한 번의 생환이 더 큰 몸의 적응으로 남는다. */
  const EXTRACTION_REACT_PER_DESCENT = 0.005;
  function rewardExtractionSurvivors(hpMultiplier, finalAbyss){
    const descent = S.chapter + 1;
    return aliveParty().map(hero=>{
      const beforeHp = hero.maxHp;
      hero.maxHp = Math.max(1, Math.round(hero.maxHp * hpMultiplier));
      const hpGain = hero.maxHp - beforeHp;
      const reactGain = EXTRACTION_REACT_PER_DESCENT * descent;
      hero.descentWins = (hero.descentWins || 0) + 1;
      hero.descentHp = (hero.descentHp || 0) + hpGain;
      hero.descentReact = (hero.descentReact || 0) + reactGain;
      hero.hp += hpGain;
      return {name:hero.name, descent:hero.descentWins, hpGain, hpMultiplier, finalAbyss:!!finalAbyss, reactPct:Math.round(reactGain*1000)/10};
    });
  }
  function buildPartyFromPlacements(placements){
    return placements.map(cid => cid ? makeHero(cid) : null);
  }

  /* 덱에 들어간 카드는 강화·합성 후보에도 그대로 반영된다.
     시작 덱은 얇게 출발하고, 전투 보상으로 최대 21장까지 자란다. */
  function mkDeckCard(base, deckOrigin){ return Object.assign({defId:nextId(), upgraded:false, upgradeLevel:0, deckOrigin:deckOrigin||'earned'}, base); }
  /* 시작은 직업별 2장 × 3인(네 번째 슬롯이 열리면 × 4인) + 공용 4장이다.
     복제본은 넣지 않고, 전투 보상으로 21장 한도까지 덱을 채운다. */
  /* 턴이 끝날 때 정규 AP 가 이만큼 남아 있으면, 다음 턴에 임시 AP 하나만 얹어 준다 */
  const TEMP_AP_MIN = 2;
  const TEMP_AP_CARRY = 1;
  const DECK_COPIES = 1;
  const MAX_DECK_SIZE = 21;
  const HAND_LIMIT = 6;
  const PICKS_PER_CLASS = 2;
  const PICKS_NEUTRAL = 4;
  const RECRUIT_PICKS_PER_CLASS = 1;
  /* 처음 내려갈 때는 셋. 인양하고 사람을 해금한 뒤에는 넷까지 데려간다. */
  const PARTY_START = 3;
  const PARTY_MAX   = 4;
  /* 직업은 세 장 중 한 장, 공용은 여섯 장 중 네 장만 손에 쥔다. */
  const CLASS_OFFER_SIZE = 3;
  const NEUTRAL_OFFER_SIZE = 6;

  function addPicked(deck, list, names, deckOrigin){
    names.forEach(n=>{
      const base = list.find(c=>c.name===n);
      if(!base) return;
      for(let i=0;i<DECK_COPIES;i++) deck.push(mkDeckCard(base, deckOrigin));
    });
  }
  function addRunDeckCard(base, deckOrigin){
    if(!S.runDeck || S.runDeck.length>=MAX_DECK_SIZE) return null;
    const card = mkDeckCard(base, deckOrigin);
    S.runDeck.push(card);
    return card;
  }
  function addPickedToRunDeck(list, names, deckOrigin){
    return names.map(name=>{
      const base = list.find(c=>c.name===name);
      return base ? addRunDeckCard(base, deckOrigin) : null;
    }).filter(Boolean);
  }
  function buildRunDeck(selectedClassIds, picks){
    const deck=[];
    selectedClassIds.forEach(cid=>addPicked(deck, CARD_DB[cid], (picks&&picks[cid])||[], 'starter'));
    addPicked(deck, startNeutralCardPool(), (picks&&picks.neutral)||[], 'starter');
    return deck;
  }
  function starterDeckCards(){
    const ids = Array.isArray(S.starterDeckCardIds) ? S.starterDeckCardIds : [];
    return (S.runDeck||[]).filter(c=>ids.includes(c.defId));
  }
  /* 이전 버전 저장은 시작 덱 ID가 없으므로, 당시 선택 기록으로 한 번만 복구한다. */
  function restoreStarterDeckIds(data){
    if(Array.isArray(data.starterDeckCardIds)) return;
    const picks = (data.setup&&data.setup.picks)||{};
    const chosen = new Set();
    Object.keys(picks).forEach(owner=>(picks[owner]||[]).forEach(name=>chosen.add(`${owner}|${String(name).replace(/\++$/, '')}`)));
    data.starterDeckCardIds = (data.runDeck||[])
      .filter(c=>chosen.has(`${c.owner}|${String(c.baseName||c.name||'').replace(/\++$/, '')}`))
      .map(c=>c.defId);
  }
  function startNeutralCardPool(){ return CARD_DB.neutral.concat(START_EPIC_CARD_POOL); }
  function startNeutralOffer(){
    const escape = CARD_DB.neutral.find(c=>c.type==='emergency_escape');
    const normal = CARD_DB.neutral.filter(c=>c.type!=='emergency_escape');
    const offer = shuffle(normal).slice(0, NEUTRAL_OFFER_SIZE-1);
    if(offer.length && Math.random() < START_EPIC_OFFER_CHANCE){
      offer[Math.floor(Math.random()*offer.length)] = pickOne(START_EPIC_CARD_POOL);
    }
    if(escape) offer.push(escape);
    return shuffle(offer).map(c=>c.name);
  }
  /* 여관에서 새로 합류한 사람 몫 — 제 카드 한 장을 무작위로 쥐고 합류한다. */
  function randomPicks(list, n){
    return shuffle(list.slice()).slice(0,n).map(c=>c.name);
  }

  /* ============ TAVERN ============
     인양된 자리에서만 사람을 바꾼다. 죽은 자의 카드는 덱에서 함께 빠지고,
     새로 온 사람의 카드가 그 자리에 들어온다 — 쓸 사람이 없는 카드로 손패가 막히지 않도록. */
  /* 채울 수 있는 자리 — 쓰러진 자리와, 처음부터 비어 있던 자리 둘 다.
     넷을 짜고 셋만 데리고 내려가므로 네 번째 칸은 늘 null 로 남는다.
     예전에는 이 칸이 후보에서 빠져, 인양해서 사람을 해금해도 앉힐 데가 없었다. */
  function openSlots(){
    const out = [];
    S.party.forEach((p,i)=>{ if(!p || !p.alive) out.push(i); });
    return out;
  }
  function recruitCandidates(){
    const inParty = S.party.filter(p=>p && p.alive).map(p=>p.cls);
    return unlockedClassIds().filter(id=>inParty.indexOf(id)<0).map(id=>CLASS_DEFS[id]);
  }
  function recruitInto(slotIdx, classId){
    const fallen = S.party[slotIdx];
    if(fallen && fallen.alive) return null;     /* 살아 있는 사람은 밀어낼 수 없다 */
    if(!isUnlocked(classId)) return null;

    const hero = makeHero(classId);
    applyRelicMaxHp(hero);
    S.party[slotIdx] = hero;

    /* 쓰러진 사람의 카드는 함께 빠진다. 빈 칸이었다면 뺄 것이 없다 */
    if(fallen) S.runDeck = S.runDeck.filter(c=>c.owner!==fallen.cls);
    const picked = randomPicks(CARD_DB[classId], RECRUIT_PICKS_PER_CLASS);
    S.setup.picks[classId] = picked;
    const added = addPickedToRunDeck(CARD_DB[classId], picked, 'recruit');
    S.logMsg = added.length ? `${CLASS_DEFS[classId].name}이(가) ${picked.join(' · ')}을(를) 들고 합류했다.` : `${CLASS_DEFS[classId].name}은(는) 합류했지만, 덱이 가득 차 카드는 맡기지 못했다.`;
    return hero;
  }

  /* ============ 저장 ============
     런 하나를 통째로 넣어 둔다. 다만 적이 들고 있는 icon 은 base64 이미지 통짜라
     그대로 담으면 저장소가 금방 찬다 — 이름만 남기고 불러올 때 다시 붙인다.
     전투 중에는 저장하지 않는다. 조준 중이던 카드나 파티클 같은 순간 상태까지
     되살리려면 복잡해지고, 실패하면 런 전체를 잃는다.
     전투에서 나가면 그 노드 입구부터 다시 시작한다. */
  const RUN_KEY = 'fathom.run.v1';
  const UPGRADE_GUIDE_KEY = 'fathom.upgrade-guide.v1';
  /* 한 번이라도 내려가 본 적이 있는지 — '새로운 탐색' 이 해금을 지워도 이 자국만은 남는다.
     처음 켠 사람에게만 제목 화면 버튼을 '시작하기' 로 보여주기 위한 표시다. */
  const PLAYED_KEY = 'fathom.played.v1';
  const SAFE_SCREENS = ['map','rest','aftermath','escape','tavern','relicSwap'];
  function hasSeenUpgradeGuide(){ return Store.get(UPGRADE_GUIDE_KEY)==='1'; }
  function markUpgradeGuideSeen(){ Store.set(UPGRADE_GUIDE_KEY, '1'); }
  /* 표시가 없던 시절에 이미 놀던 사람은 남아 있는 기록으로 알아본다 */
  function hasPlayedBefore(){
    return Store.get(PLAYED_KEY)==='1'
      || hasSavedRun() || UNLOCKED.length > 0 || OWNED_MARKERS.length > 0 || hasSeenUpgradeGuide();
  }
  function markPlayed(){ Store.set(PLAYED_KEY, '1'); }

  function foeIconByName(name){
    const all = FOE_SURFACE.concat(FOE_ELITES, FOE_ENDLESS, [FOE_BOSS, FOE_ENDLESS_BOSS]);
    const hit = all.find(f=>f.name===name);
    return hit ? hit.icon : null;
  }
  function saveRun(){
    if(!S || SAFE_SCREENS.indexOf(S.screen) < 0) return;
    try{
      /* icon 은 적 초상, ic 는 예고 행동 도상 — 둘 다 base64 이미지 통짜다.
         이름과 타입만 남기고 불러올 때 다시 붙인다. */
      const json = JSON.stringify(S, (k,v)=> (k==='icon' || k==='ic') ? undefined : v);
      Store.set(RUN_KEY, json);
    }catch(e){}
  }
  function hasSavedRun(){ return !!Store.get(RUN_KEY); }
  function clearRun(){ Store.remove(RUN_KEY); }
  function loadRun(){
    try{
      const raw = Store.get(RUN_KEY);
      if(!raw) return false;
      const data = JSON.parse(raw);
      if(!data || SAFE_SCREENS.indexOf(data.screen) < 0) return false;
      /* 저장할 때 떼어낸 초상을 이름으로 다시 붙인다 */
      if(data.battle && data.battle.enemies){
        data.battle.enemies.forEach(en=>{
          en.icon = foeIconByName(en.name);
          /* 예고 행동은 다음 전투가 시작될 때 어차피 새로 뽑는다 —
             전투 중에는 저장하지 않으므로 여기서는 비워 두면 된다 */
          en.intent = null;
        });
      }
      (data.runDeck||[]).forEach(refreshSpecialEpicCard);
      if(data.aftermath){
        (data.aftermath.cardOffer||[]).forEach(refreshSpecialEpicCard);
        if(data.aftermath.reveal && data.aftermath.reveal.card) refreshSpecialEpicCard(data.aftermath.reveal.card);
      }
      restoreStarterDeckIds(data);
      S = data;
      return true;
    }catch(e){ return false; }
  }
  /* '새로운 탐색' 은 해금까지 지운다 — 말 그대로 처음부터다 */
  function wipeAllSaves(){
    clearRun();
    Store.remove(UNLOCK_KEY);
    Store.remove(MARKER_KEY);
    UNLOCKED = [];
    OWNED_MARKERS = [];
  }

  /* 여관에서 대열을 다시 짠다.
     살아서 돌아온 사람은 그대로 데려간다 — 체력도 심도압박도 이어받는다.
     새로 들어온 사람만 몸을 만들고, 덱은 빠진 병과의 카드를 걷어내고
     들어온 병과의 카드를 채운다(강화해 둔 카드는 그 병과가 남아 있으면 그대로다). */
  function applyReform(placements){
    const keep = {};
    S.party.forEach(p=>{ if(p && p.alive) keep[p.cls] = p; });

    const before = Object.keys(keep);
    const after  = placements.filter(Boolean);

    S.party = placements.map(cid=>{
      if(!cid) return null;
      if(keep[cid]) return keep[cid];
      const hero = makeHero(cid);
      applyRelicMaxHp(hero);
      return hero;
    });

    /* 빠진 병과의 카드는 덱에서 함께 나간다 */
    before.filter(c=>after.indexOf(c)<0).forEach(cls=>{
      S.runDeck = S.runDeck.filter(c=>c.owner!==cls);
      delete S.setup.picks[cls];
    });
    /* 새로 들어온 병과는 제 카드 중 둘을 무작위로 쥐고 온다 */
    const joined = after.filter(c=>before.indexOf(c)<0);
    joined.forEach(cls=>{
      const picked = randomPicks(CARD_DB[cls], RECRUIT_PICKS_PER_CLASS);
      S.setup.picks[cls] = picked;
      addPickedToRunDeck(CARD_DB[cls], picked, 'recruit');
    });
    return joined;
  }

  function newRun(){
    S = {
      screen:'title',
      setup: { phase:'pick-classes', selected:[], placements:[null,null,null,null], armed:null,
               picks:{}, offers:{}, reform:false },
      erosion: 0,
      chapter: 0,
      stepInChapter: 0,
      mapChoices: null,
      mapVisited: [],
      pendingNode: null,
      afterAftermath: null,
      aftermath: null,
      runDeck: null,
      starterDeckCardIds: [],
      party: null,
      battle: null,
      rest: null,
      relics: [],
      escape: null,
      emergencyExit: null,
      finalGrowth: null,
      tavern: null,
      prologue: null,
      logMsg: '',
      logLines: [],
      loseReason:'',
    };
  }

  /* 프롤로그는 저장되는 런과 분리한다. 네 사람이 이미 한 번 심연에 닿았다는
     사실만 남기고, 본편의 선택·해금·덱에는 어떤 이득도 남기지 않는다. */
  function tutorialCard(owner, name){
    const base = (CARD_DB[owner]||[]).find(c=>c.name===name);
    return base ? Object.assign({}, base, {uid:nextId(), defId:nextId(), upgraded:false, contaminated:false}) : null;
  }
  function tutorialFoe(name, hp, atk, reach, role, icon, intent){
    return {id:nextId(), name, maxHp:hp, hp:hp, atk:atk, reach:reach, role:role,
            icon:icon, block:0, intent:intent, alive:true, react:null};
  }
  function startPrologue(){
    newRun();
    S.prologue = {stage:'briefing'};
    S.screen = 'prologue';
  }
  function beginPrologueBattle(){
    S.party = BASE_CLASSES.map(makeHero);
    /* 첫 예시는 확률이 아니라 규칙을 보여주는 장면이다 — 회피·반격이 끼어들면
       방어가 피해를 막는 핵심이 흐려진다. */
    S.party[0].reactMod = {dodge:0, guard:0, riposte:0, rip:0};
    S.erosion = 10;
    const frontIntent = {type:'attack_reach', val:12, label:'내려찍기', ic:IC_CLEAVER};
    const rearIntent  = {type:'whisper_rear', val:7, label:'심연의 응시', ic:IC_GAZE};
    const ranged = FOE_ENDLESS.find(f=>f.name==='침묵의 등불지기');
    const finalBoss = tutorialFoe(FOE_ENDLESS_BOSS.name, FOE_ENDLESS_BOSS.maxHp, FOE_ENDLESS_BOSS.atk, FOE_ENDLESS_BOSS.reach, FOE_ENDLESS_BOSS.role, FOE_ENDLESS_BOSS.icon, frontIntent);
    /* 프롤로그의 기록에서도 정체는 끝까지 가린다. */
    finalBoss.kind = 'boss'; finalBoss.phase = 1; finalBoss.hiddenName = '???';
    const enemies = [
      finalBoss,
      tutorialFoe(ranged.name, ranged.maxHp, ranged.atk, ranged.reach, ranged.role, ranged.icon, rearIntent)
    ];
    S.battle = {
      tier:'끝없는 심연', node:{type:'battle',tier:'끝없는 심연',title:'되돌아갈 수 없는 문턱',desc:''}, enemies,
      deck:[], hand:[tutorialCard('vanguard','놋쇠 벽')], discard:[],
      ap:3, maxAp:3, tempAp:0, turn:1, over:false, pendingCardUid:null, pendingDomain:null
    };
    S.prologue.stage = 'brace';
    S.logMsg = '이름 없는 거대한 존재와 심연의 등불지기가 인양대를 바라본다.';
    S.screen = 'battle';
  }
  function prologueHandForStrike(){
    return [tutorialCard('oracle','저주받은 조준')].filter(Boolean);
  }
  function prologueHandForCalm(){
    return [tutorialCard('priest','속죄의 기도')].filter(Boolean);
  }
  function finishPrologue(){
    S.party.forEach(p=>{ p.hp=0; p.dp=100; p.block=0; p.alive=false; p.collapsed=true; });
    S.battle = null;
    S.prologue.stage = 'fallen';
    S.screen = 'prologueFall';
  }

  function shuffle(arr){
    for(let i=arr.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; }
    return arr;
  }
  /* 강한 카드는 덱에 남아 있어도 초반 손패를 독점하지 않는다.
     섞일 때 일반 1 : 에픽 0.4 : 전설 0.2의 가중치를 쓴다. */
  const BATTLE_DRAW_WEIGHT = {normal:1, epic:0.4, legendary:0.2};
  /* 희귀 카드는 '전부 몇 장'이 아니라 '한 장이 몇 번'으로 센다.
     같은 에픽 하나가 한 전투 내내 되돌아오며 손패를 독점하는 것을 막되,
     서로 다른 에픽을 모아 온 덱은 모은 만큼 다양하게 쓸 수 있다.
     세는 단위는 카드의 정체(id·원래 이름)라 같은 카드를 여러 장 가져도 한도는 하나다.
     한도에 닿은 카드는 버린 더미로 돌아가고, 다음 전투에서 다시 0부터 센다. */
  const RARE_DRAW_MAX_PER_BATTLE = {epic:4, legendary:4};
  function battleDrawWeight(card){ return isLegendaryCard(card) ? BATTLE_DRAW_WEIGHT.legendary : (isEpicCard(card) ? BATTLE_DRAW_WEIGHT.epic : BATTLE_DRAW_WEIGHT.normal); }
  function isRareBattleCard(card){ return isEpicCard(card) || isLegendaryCard(card); }
  /* +5 강화로 에픽이 된 카드는 풀의 id 가 없다 — 그때는 강화 전 이름으로 센다. */
  function rareDrawKey(card){ return card.id || card.baseName || card.name; }
  function rareDrawLimit(card){
    return isLegendaryCard(card) ? RARE_DRAW_MAX_PER_BATTLE.legendary : RARE_DRAW_MAX_PER_BATTLE.epic;
  }
  function rareDrawCounts(b){
    /* 예전 저장은 이 값이 숫자(전체 합계)였다 — 장부 모양이 다르면 새로 편다. */
    if(!b.rareDraws || typeof b.rareDraws !== 'object') b.rareDraws = {};
    return b.rareDraws;
  }
  /* 한 번 써 버린 에픽은 같은 전투에서 점점 돌아오기 어려워진다.
     뽑은 횟수가 아니라 '쓴 횟수'로 꺾는다 — 손에 들고만 있던 것은 값을 치르지 않았으므로.
     아직 안 쓴 카드는 그대로, 한 번 썼으면 50%, 두 번이면 10%, 세 번부터는 0.1%.
     굴림에 진 카드는 버린 더미로 돌아가고, 다음 전투에서 장부가 비워진다. */
  const RARE_REDRAW_CHANCE = [1, 0.5, 0.1, 0.001];
  function rareRedrawChance(uses){
    if(uses <= 0) return 1;
    return RARE_REDRAW_CHANCE[Math.min(uses, RARE_REDRAW_CHANCE.length - 1)];
  }
  function rareUseCounts(b){
    if(!b.rareUses || typeof b.rareUses !== 'object') b.rareUses = {};
    return b.rareUses;
  }
  function noteRareCardUsed(card){
    const b = S.battle;
    if(!b || !isRareBattleCard(card)) return;
    const uses = rareUseCounts(b);
    const key = rareDrawKey(card);
    uses[key] = (uses[key] || 0) + 1;
  }
  function shuffleBattleDeck(cards){
    const pool = cards.slice();
    const ordered = [];
    while(pool.length){
      const total = pool.reduce((sum,card)=>sum+battleDrawWeight(card),0);
      let roll = Math.random()*total;
      let idx = pool.length-1;
      for(let i=0;i<pool.length;i++){
        roll -= battleDrawWeight(pool[i]);
        if(roll<=0){ idx=i; break; }
      }
      ordered.push(pool.splice(idx,1)[0]);
    }
    /* drawNextBattleCard 는 pop()으로 뽑으므로 첫 후보가 배열 끝에 오도록 뒤집는다. */
    return ordered.reverse();
  }
  function cloneForBattle(runDeck){
    return shuffleBattleDeck(runDeck.map(c=>Object.assign({}, c, {uid:nextId(), contaminated:false})));
  }

  /* ============ 적 도감 ============
     적도 아군과 똑같은 규칙을 쓴다 — 서 있는 열이 곧 사거리다.
     역할(role)이 성향을, 사거리(reach)가 제약을 맡는다:
       brute      — 한 방이 무겁다
       skirmisher — 잘게 여러 번
       warden     — 웅크리고 버틴다
       caster     — 살을 깎지 않고 정신을 깎는다
       sniper     — 약한 놈만 골라 쏜다
     react 로 개체마다 회피/흘림/반격 성향을 덧씌운다. */
