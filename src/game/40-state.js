  /* ============ STATE ============ */
  let uid = 0;
  const nextId = () => 'u' + (uid++);

  let S = null;
  const RESIDENCE_MAX = 10;

  function rankName(idx){ return idx===0?'전열':idx===1?'중열':idx===2?'후열':idx===3?'심부':'심연'; }

  function randomHeroProfile(classId){
    const def = CLASS_DEFS[classId];
    const hp = Math.max(1, def.maxHp + Math.floor(Math.random()*11) - 5);
    const variance = ()=>Math.round((0.90 + Math.random()*0.20)*100)/100;
    return {maxHp:hp, hp, attackPower:variance(), defensePower:variance(), dpResistance:variance()};
  }
  /* ============ 각인 ============
     서약을 걸고 귀환한 등대지기 개인에게 남는 영구 흔적. 캐릭터 id 에 귀속되므로
     같은 사람이 다시 파티에 들어오면 다시 적용된다. 좋은 것과 나쁜 것이 섞여 있다. */
  const IMPRINT_DEFS = [
    {id:'imprint_deep_hand',   name:'깊이 다녀온 손', kind:'good', desc:'공격력 +8%', statMods:{attackPower:1.08}},
    {id:'imprint_calloused',   name:'굳은살 진 정신', kind:'good', desc:'심도압박 저항 +8%', statMods:{dpResistance:0.92}},
    {id:'imprint_brined_skin', name:'절인 살갗', kind:'good', desc:'방어력 +8%', statMods:{defensePower:1.08}},
    {id:'imprint_wet_lung',    name:'젖은 폐', kind:'bad', desc:'최대 체력 -6%', statMods:{maxHp:0.94}},
    {id:'imprint_flinching',   name:'움츠러든 손', kind:'bad', desc:'공격력 -8%', statMods:{attackPower:0.92}},
    {id:'imprint_thin_nerve',  name:'얇아진 신경', kind:'bad', desc:'심도압박 저항 -10%', statMods:{dpResistance:1.10}},
  ];
  /* 생환 3회(닻 은색 랭크)를 채운 순간 확정으로 붙는 각인 — 자리를 가리지 않게 된
     베테랑이라는 서사. statMods 가 아니라 사거리 판정 자체를 완화하는
     특수 플래그(flex)라 applyImprintsToHero 에서 따로 처리한다. */
  const FLEX_IMPRINT_ID = 'imprint_any_rank';
  IMPRINT_DEFS.push({id:FLEX_IMPRINT_ID, name:'유연한 몸놀림', kind:'good', desc:'대열 어느 자리에서도 행동할 수 있다', flex:true});
  function imprintDef(id){ return IMPRINT_DEFS.find(d=>d.id===id) || null; }
  function applyImprintsToHero(hero){
    heroImprints(hero.characterId).forEach(id=>{
      const def = imprintDef(id);
      if(!def) return;
      if(def.flex) hero.reachFlexible = true;
      if(!def.statMods) return;
      Object.keys(def.statMods).forEach(key=>{
        const mul = def.statMods[key];
        if(key==='maxHp'){ hero.maxHp=Math.max(1,Math.round(hero.maxHp*mul)); hero.hp=Math.min(hero.hp,hero.maxHp); }
        else hero[key] = (hero[key]||1) * mul;
      });
    });
    return hero;
  }
  function makeHero(classId, customName, characterId, profile){
    const def = CLASS_DEFS[classId];
    const name = customName || randomCrewName();
    const stats = profile || randomHeroProfile(classId);
    const hero = {id:classId, characterId:characterId||nextId(), name, cls:classId, reach:def.reach, isHero:true,
            maxHp:stats.maxHp, hp:stats.hp, block:0, dp:0, collapsed:false, breakdown:0, tauntTurns:0, tauntReduction:0, alive:true, react:null,
            attackPower:stats.attackPower, defensePower:stats.defensePower, dpResistance:stats.dpResistance,
            arrivalCard:null, arrivalCardPending:false,
            descentWins:0, descentHp:0, descentReact:0};
    return applyImprintsToHero(hero);
  }
  /* 귀환 성공 시 판정한다 — 서약 심도가 없으면 각인은 생기지 않는다.
     이번 탐사의 최고 dp·최고 잠식이 높을수록, 서약 심도가 높을수록 확률이 오른다. */
  const IMPRINT_BASE_CHANCE = 0.12;
  function rollImprintForSurvivors(){
    const granted = [];
    /* 생환 횟수는 서약 여부와 상관없이 자유 탐사에서 무사 귀환할 때마다 오른다 —
       닻 배지의 랭크(청동/은/금)가 여기서 나온다. 은 랭크(3회)를 막 채운 순간에는
       '유연한 몸놀림'을 확정으로 얹는다. */
    aliveParty().forEach(hero=>{
      if(!hero) return;
      hero.descentWins = (hero.descentWins||0) + 1;
      if(hero.descentWins === SURVIVAL_MARK_MAX){
        const held = heroImprints(hero.characterId);
        if(held.indexOf(FLEX_IMPRINT_ID)<0 && grantImprint(hero.characterId, FLEX_IMPRINT_ID)){
          hero.reachFlexible = true;
          granted.push({hero:hero.name, imprint:imprintDef(FLEX_IMPRINT_ID)});
        }
      }
    });
    const depth = (S.pactDepth||0);
    if(depth<=0) return granted;
    const dpFactor = Math.min(1, (S.dpPeakSeen||0)/100);
    const erosionFactor = Math.min(1, (S.erosionPeakSeen||0)/100);
    const chance = Math.min(0.75, IMPRINT_BASE_CHANCE + depth*0.06 + dpFactor*0.15 + erosionFactor*0.15);
    aliveParty().forEach(hero=>{
      if(!hero || Math.random()>=chance) return;
      const held = heroImprints(hero.characterId);
      const pool = IMPRINT_DEFS.filter(d=>held.indexOf(d.id)<0);
      if(!pool.length) return;
      const pick = pool[Math.floor(Math.random()*pool.length)];
      if(grantImprint(hero.characterId, pick.id)){
        if(pick.flex) hero.reachFlexible = true;
        granted.push({hero:hero.name, imprint:pick});
      }
    });
    return granted;
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
  /* 덱이 가득 차야 '한 벌' 이다 — 그때 카드덱 메뉴가 열린다 */
  function deckMenuUnlocked(){ return !!(S && S.runDeck && S.runDeck.length >= MAX_DECK_SIZE); }
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
  function abyssalEchoes(){ return baseEchoes(); }
  function deepCatalysts(){ return baseCatalysts(); }
  function addAbyssalEchoes(amount){
    if(!S) return 0;
    const cap=salvageLockerCapacity();
    S.salvageLocker=S.salvageLocker||{echoes:0,catalysts:0,oil:0};
    const stored=Math.min(Math.max(0,Math.floor(Number(amount)||0)),Math.max(0,cap.echoes-lockerEchoes()));
    S.salvageLocker.echoes+=stored;
    return stored;
  }
  function addDeepCatalyst(amount){
    if(!S) return 0;
    const cap=salvageLockerCapacity();
    S.salvageLocker=S.salvageLocker||{echoes:0,catalysts:0,oil:0};
    const stored=Math.min(Math.max(0,Math.floor(Number(amount)||0)),Math.max(0,cap.catalysts-lockerCatalysts()));
    S.salvageLocker.catalysts+=stored;
    return stored;
  }
  function spendUpgradeCurrency(echoes,catalysts){
    if(abyssalEchoes()<echoes || deepCatalysts()<catalysts) return false;
    BASE_RESOURCE.echoes-=echoes;
    BASE_RESOURCE.catalysts-=catalysts;
    saveBaseResource();
    return true;
  }
  /* 연구소 환전 — 잔향·촉매를 연구 포인트로 바꾼다. 비율은 researchExchangeInfo 표를 따른다. */
  function exchangeForResearch(kind){
    const info=researchExchangeInfo(kind);
    if(!info) return false;
    const ok=kind==='echoes' ? spendUpgradeCurrency(info.cost,0) : spendUpgradeCurrency(0,info.cost);
    if(!ok) return false;
    addResearchPoints(info.gain);
    return true;
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
  /* 등대 기지에서 새로 합류한 사람 몫 — 제 카드 한 장을 무작위로 쥐고 합류한다. */
  function randomPicks(list, n){
    return shuffle(list.slice()).slice(0,n).map(c=>c.name);
  }
  function randomArrivalCard(classId){
    const roll=Math.random();
    let base;
    if(roll<0.05 && !hasLegendaryCard()) base=LEGENDARY_CARD_POOL[Math.floor(Math.random()*LEGENDARY_CARD_POOL.length)];
    else if(roll<0.20) base=pickEpicCard();
    else base=pickOne((CARD_DB[classId]||CARD_DB.neutral));
    return base ? Object.assign({},base) : null;
  }
  function isStarterRareCard(card){ return !!card && (isEpicCard(card) || isLegendaryCard(card)); }
  function randomStarterArrivalCard(classId, rareCount){
    const card=randomArrivalCard(classId);
    if(isStarterRareCard(card) && rareCount>=1){
      const normal=pickOne((CARD_DB[classId]||CARD_DB.neutral).filter(c=>!isStarterRareCard(c)));
      return normal ? Object.assign({},normal) : card;
    }
    return card;
  }
  function attachArrivalCard(hero, card, pending){
    if(!hero || !card) return null;
    hero.arrivalCard=Object.assign({},card);
    hero.arrivalCardPending=(pending!==false) && !!(card.epic || card.legendary);
    return addRunDeckCard(card,'arrival');
  }

  /* ============ TAVERN ============
     인양된 자리에서만 사람을 바꾼다. 죽은 자의 카드는 덱에서 함께 빠지고,
     새로 온 사람의 카드가 그 자리에 들어온다 — 쓸 사람이 없는 카드로 손패가 막히지 않도록. */
  /* 채울 수 있는 자리 — 쓰러진 자리와, 처음부터 비어 있던 자리 둘 다.
     넷을 짜고 셋만 데리고 내려가므로 네 번째 칸은 늘 null 로 남는다.
     예전에는 이 칸이 후보에서 빠져, 인양해서 사람을 해금해도 앉힐 데가 없었다. */
  function openSlots(){
    const out = [];
    const lim = partyLimit();
    S.party.forEach((p,i)=>{ if(i < lim && (!p || !p.alive)) out.push(i); });
    return out;
  }
  function recruitCandidates(){
    const inParty = S.party.filter(p=>p && p.alive).map(p=>p.cls);
    return unlockedClassIds().filter(id=>inParty.indexOf(id)<0).map(id=>CLASS_DEFS[id]);
  }
  function recruitInto(slotIdx, candidate){
    const character = candidate && typeof candidate==='object' ? candidate : null;
    const classId = character ? character.cls : candidate;
    const fallen = S.party[slotIdx];
    if(fallen && fallen.alive) return null;     /* 살아 있는 사람은 밀어낼 수 없다 */
    if(!isUnlocked(classId)) return null;

    const hero = makeHero(classId, character&&character.name, character&&character.id, character&&character.profile);
    const arrivalCard = character&&character.arrivalCard ? character.arrivalCard : randomArrivalCard(classId);
    attachArrivalCard(hero, arrivalCard, !(character && character.arrivalCardPending===false));
    applyRelicMaxHp(hero);
    S.party[slotIdx] = hero;

    /* 쓰러진 사람의 카드는 함께 빠진다. 빈 칸이었다면 뺄 것이 없다 */
    if(fallen) S.runDeck = S.runDeck.filter(c=>c.owner!==fallen.cls);
    const cardName=arrivalCard ? arrivalCard.name : '빈 손';
    S.setup.picks[classId] = arrivalCard&&arrivalCard.owner===classId ? [cardName] : [];
    S.logMsg = `${hero.name}이(가) ${cardName}을(를) 들고 합류했다.`;
    return hero;
  }

  function ensureResidence(){
    if(!S.residence) S.residence={roster:[], selectedIds:[]};
    if(!Array.isArray(S.residence.roster)) S.residence.roster=[];
    if(!Array.isArray(S.residence.pendingGuests)) S.residence.pendingGuests=[];
    if(S.residence.pendingGuest){
      S.residence.pendingGuests.unshift(S.residence.pendingGuest);
      delete S.residence.pendingGuest;
    }
    const known = new Map(S.residence.roster.map(c=>[c.id,c]));
    (S.party||[]).filter(Boolean).forEach(p=>{
      const id=p.characterId||p.id;
      if(!known.has(id)){
        const entry={id:id, name:p.name, cls:p.cls, alive:p.alive!==false, heroId:p.characterId||null};
        S.residence.roster.push(entry);
        known.set(id, entry);
      } else {
        /* 파티에 남아 있는 동안은 명단의 생사도 실제 영웅 객체와 항상 같게 맞춘다 —
           안 그러면 전투 중 죽은 사람이 숙소 명단에서는 계속 산 사람으로 보여,
           빈 자리를 채우는 로직이 죽은 사람을 다시 골라 버린다. */
        known.get(id).alive = p.alive!==false;
      }
    });
    if(S.screen!=='residence' && (!Array.isArray(S.residence.selectedIds) || !S.residence.selectedIds.length)){
      S.residence.selectedIds=(S.party||[]).filter(p=>p&&p.alive).map(p=>p.characterId||p.id);
    }
    if(S.screen!=='residence' && !Array.isArray(S.residence.placements)){
      S.residence.placements=(S.party||[]).filter(p=>p&&p.alive).map(p=>p.characterId||p.id);
    }
    if(S.residence.armedId===undefined) S.residence.armedId=null;
    if(S.residence.lastRecoveryAt===undefined) S.residence.lastRecoveryAt=0;
    return S.residence;
  }
  /* 죽는 그 순간 곧바로 숙소 명단에 적는다 — 원래는 다음에 등대 기지에 들를 때
     ensureResidence 가 뒤늦게 동기화했는데, 그 사이에 쓰러진 자리가 새 합류자로
     바로 대체되면(recruitInto 등) 죽었다는 기록 자체가 숙소 명단에 한 번도 남지
     않을 수 있었다 — 묘지에 나타나지 않던 원인이다. 죽음은 여기서 즉시 남긴다. */
  function recordResidenceDeath(hero){
    if(!hero) return;
    const r = ensureResidence();
    const id = hero.characterId || hero.id;
    const entry = r.roster.find(p=>p.id===id);
    if(entry) entry.alive = false;
    else r.roster.push({id:id, name:hero.name, cls:hero.cls, alive:false, heroId:hero.characterId||null});
  }
  function recoverAtResidence(){
    const r=ensureResidence();
    const now=Date.now();
    const elapsed=r.lastRecoveryAt ? Math.max(0,now-r.lastRecoveryAt) : 0;
    /* 숙소에 머문 시간 20초마다 1회, 처음 입실할 때는 한 번 회복한다. */
    const ticks=r.lastRecoveryAt ? Math.floor(elapsed/20000) : 1;
    if(ticks<=0) return 0;
    let healed=0;
    /* 죽은 대원은 회복 대상이 아니다 — 안 그러면 전사한 채로 체력만 가득 차서
       다음 전투에 아무 행동도 못 하는 유령처럼 따라온다. */
    (S.party||[]).filter(p=>p && p.alive).forEach(hero=>{
      if(hero.hp<hero.maxHp){ const amount=Math.min(hero.maxHp-hero.hp,ticks); hero.hp+=amount; healed+=amount; }
      if(hero.dp>0) hero.dp=Math.max(0,hero.dp-ticks*2);
    });
    r.lastRecoveryAt=now;
    return healed;
  }
  /* 근접·중거리는 0번 자리(전열)에 설 수 있고, 원거리는 설 수 없다(REACH 표,
     00-prelude.js). 살아 있는 이 두 병과가 이 아래로 떨어지면 새 합류자를
     원거리 대신 그쪽에서 우선 뽑아, 전열이 통째로 비는 사고를 막는다. */
  const FRONTLINE_MIN_ALIVE = 2;
  function isFrontlineClass(cls){ const def=CLASS_DEFS[cls]; return !!def && def.reach!=='ranged'; }
  function aliveFrontlineCount(){
    const r=S.residence;
    const rosterAlive=(r&&Array.isArray(r.roster)?r.roster:[]).filter(p=>p.alive!==false && isFrontlineClass(p.cls)).length;
    return rosterAlive;
  }
  function addResidenceGuest(forcedClass){
    const r=ensureResidence();
    const ids=unlockedClassIds();
    let cls=forcedClass && isUnlocked(forcedClass) ? forcedClass : null;
    if(!cls){
      const frontlinePool=ids.filter(isFrontlineClass);
      const pool=(frontlinePool.length && aliveFrontlineCount()<FRONTLINE_MIN_ALIVE) ? frontlinePool : ids;
      cls=pool[Math.floor(Math.random()*pool.length)];
    }
    const taken=r.roster.map(person=>person&&person.name).concat((S.party||[]).filter(Boolean).map(person=>person.name));
    const arrivalCard=randomArrivalCard(cls);
    const profile=randomHeroProfile(cls);
    const guest=Object.assign({id:nextId(), name:randomResidentName(taken), cls:cls, alive:true, guest:true}, profile, {
      profile, arrivalCard, arrivalCardPending:!!(arrivalCard && (arrivalCard.epic || arrivalCard.legendary))
    });
    if(r.roster.length >= RESIDENCE_MAX){
      r.pendingGuests.push(guest);
      return guest;
    }
    r.roster.push(guest);
    return guest;
  }
  /* 전멸 직후 부른다 — 특정 병과가 아니라 사거리(근접·중거리·원거리) 기준으로 본다.
     숙소에 산 사람 중 그 사거리를 가진 병과가 하나도 없을 때만 채운다 — 이미
     해금해 키워 둔 병과(헬리온·로버·제스터 등)가 그 사거리를 맡고 있으면 굳이
     기본 병과를 또 끼워 넣지 않는다. 다만 죽은 대원이 그 사거리의 병과였다면
     먼저 같은 병과로 증원한다. 사망자의 자리를 완전히 다른 병과로 바꾸면
     플레이어가 키운 대열과 덱의 역할이 갑자기 달라지는 문제가 생기기 때문이다. */
  const REACH_REPRESENTATIVE = {melee:'vanguard', mid:'chemist', ranged:'oracle'};
  function refillReachCoverageInResidence(){
    const r=ensureResidence();
    const aliveReaches=new Set(r.roster.filter(p=>p.alive!==false)
      .map(p=>{ const def=CLASS_DEFS[p.cls]; return def && def.reach; })
      .filter(Boolean));
    Object.keys(REACH_REPRESENTATIVE).forEach(reachId=>{
      if(!aliveReaches.has(reachId)){
        const fallen=r.roster.find(p=>p && p.alive===false && CLASS_DEFS[p.cls] && CLASS_DEFS[p.cls].reach===reachId);
        addResidenceGuest(fallen ? fallen.cls : REACH_REPRESENTATIVE[reachId]);
      }
    });
  }
  /* 묘지에서 대원을 되살린다 — 네크로맨서 전직을 마쳐야 열린다. 죽은 대원이
     하필 지금 대열(S.party)에 그대로 남아 있으면(아직 다른 사람으로 교체되지
     않았으면) 그 실제 영웅 객체까지 함께 되살려야 한다 — 안 그러면
     ensureResidence 가 다음 렌더에서 S.party 쪽 죽은 상태로 다시 덮어써 버린다. */
  function reviveFromGraveyard(id){
    if(!hasNecromancer()) return false;
    const r=ensureResidence();
    const person=r.roster.find(c=>c.id===id);
    if(!person || person.alive!==false) return false;
    if(!spendUpgradeCurrency(0, REVIVE_CATALYST_COST)) return false;
    person.alive = true;
    const def=CLASS_DEFS[person.cls]||{};
    const revivedHp=Math.max(1, Math.round((person.maxHp||def.maxHp||20)*0.5));
    person.hp = revivedHp;
    person.dp = 0;
    const heroObj=(S.party||[]).find(p=>p && (p.characterId||p.id)===id);
    if(heroObj){
      heroObj.alive = true;
      heroObj.hp = revivedHp;
      heroObj.maxHp = person.maxHp||heroObj.maxHp;
      heroObj.dp = 0;
      heroObj.block = 0;
      heroObj.collapsed = false;
      heroObj.breakdown = 0;
    }
    S.logMsg = `${person.name}이(가) 묘지에서 눈을 떴다.`;
    return true;
  }
  function acceptPendingResidenceGuest(){
    const r=ensureResidence();
    if(r.roster.length>=RESIDENCE_MAX || !r.pendingGuests.length) return null;
    const guest=r.pendingGuests.shift();
    r.roster.push(guest);
    return guest;
  }
  function dismissResidencePerson(id){
    const r=ensureResidence();
    const person=r.roster.find(c=>c.id===id);
    if(!person || person.alive===false) return false;
    const active=(S.party||[]).some(p=>p && p.alive && (p.characterId||p.id)===id);
    if(active) return false;
    r.roster=r.roster.filter(c=>c.id!==id);
    r.selectedIds=(r.selectedIds||[]).filter(x=>x!==id);
    r.placements=(r.placements||[]).map(x=>x===id?null:x);
    if(r.armedId===id) r.armedId=null;
    const accepted=acceptPendingResidenceGuest();
    S.logMsg=accepted ? `${person.name}이(가) 숙소를 떠났다. ${accepted.name}이(가) 등대에 들어왔다.` : `${person.name}이(가) 숙소를 떠났다.`;
    return true;
  }
  /* 죽어서 비어 버린 자리를 숙소의 다른 생존자로 자동으로 채운다. 등대 기지에
     돌아올 때마다 부른다 — 수동으로 숙소를 열지 않아도, 다음 하강이 항상 4인
     대열로 시작할 수 있게 하기 위해서다. 0번 자리(전열)는 원거리를 세우면
     아무것도 못 하고 서 있게 되므로, 근접·중거리를 우선 배치한다.
     이미 놓인 자리·이미 쓰인 병과는 건드리지 않는다 — 생환자의 위치와
     플레이어가 손으로 옮겨 둔 배치는 그대로 존중한다. */
  function autoFillResidenceSelection(){
    const r=ensureResidence();
    const limit=partyLimit();
    const placements=(r.placements||[]).slice(0,4);
    while(placements.length<4) placements.push(null);
    const placedPeople=placements.map(id=>id && r.roster.find(p=>p.id===id)).filter(Boolean);
    const usedClasses=new Set(placedPeople.map(p=>p.cls));
    const placedIds=new Set(placedPeople.map(p=>p.id));
    const pool=r.roster.filter(p=>p.alive!==false && !placedIds.has(p.id) && !usedClasses.has(p.cls));
    let filled=placedIds.size;
    /* 0번(전열)만 근접·중거리를 우선하는 걸로는 부족하다 — 3번 자리는 원거리만
       설 수 있고, 2번은 근접이 못 선다(REACH 표, 00-prelude.js). 사거리를 안 보고
       빈 순서대로 채우면 마지막 자리에 근접·중거리가 꽂혀 그 자리에서 아무 카드도
       못 내는 상태가 된다. 그래서 '설 수 있는 후보가 적은 자리'부터 채운다. */
    const fitsRank = (p, idx) => canActFrom({reach:(CLASS_DEFS[p.cls]||{}).reach, reachFlexible:heroImprints(p.id).some(id=>{ const d=imprintDef(id); return d && d.flex; })}, idx);
    const emptyIdxs = [];
    for(let idx=0; idx<4; idx++){ if(!placements[idx]) emptyIdxs.push(idx); }
    emptyIdxs.sort((a,b)=>{
      const countFor = idx => pool.filter(p=>fitsRank(p, idx)).length;
      return countFor(a) - countFor(b);
    });
    emptyIdxs.forEach(idx=>{
      if(filled>=limit) return;
      const at = pool.findIndex(p=>fitsRank(p, idx));
      if(at<0) return;
      const pick=pool[at];
      placements[idx]=pick.id;
      pool.splice(at,1);
      usedClasses.add(pick.cls);
      filled+=1;
    });
    r.placements=placements;
    r.selectedIds=placements.filter(Boolean);
  }
  function applyResidenceParty(){
    const r=ensureResidence();
    const limit=partyLimit();
    const chosen=[];
    const seenClasses=new Set();
    const ordered=(r.placements||[]).filter(id=>(r.selectedIds||[]).includes(id));
    ordered.forEach(id=>{
      const person=r.roster.find(c=>c.id===id);
      if(person && person.alive!==false && !seenClasses.has(person.cls) && chosen.length<limit){ chosen.push(person); seenClasses.add(person.cls); }
    });
    if(!chosen.length) return false;
    const previous=(S.party||[]).filter(Boolean);
    const previousById=new Map(previous.map(p=>[(p.characterId||p.id),p]));
    const previousByClass=new Map(previous.filter(p=>p.alive).map(p=>[p.cls,p]));
    const beforeClasses=new Set(previous.filter(p=>p.alive).map(p=>p.cls));
    const afterClasses=new Set(chosen.map(c=>c.cls));
    beforeClasses.forEach(cls=>{ if(!afterClasses.has(cls)) S.runDeck=S.runDeck.filter(c=>c.owner!==cls); });
    const nextParty=chosen.map(c=>{
      const old=previousById.get(c.id);
      if(old){ old.alive=true; return old; }
      if(previousByClass.has(c.cls)) S.runDeck=S.runDeck.filter(card=>card.owner!==c.cls);
      const hero=makeHero(c.cls,c.name,c.id,c.profile);
      attachArrivalCard(hero,c.arrivalCard||null,c.arrivalCardPending!==false);
      applyRelicMaxHp(hero);
      S.setup.picks[c.cls]=c.arrivalCard&&c.arrivalCard.owner===c.cls ? [c.arrivalCard.name] : [];
      return hero;
    });
    S.party=nextParty.concat(Array(Math.max(0,4-nextParty.length)).fill(null));
    r.selectedIds=nextParty.map(p=>p.characterId||p.id);
    r.placements=r.selectedIds.slice();
    r.armedId=null;
    r.roster.forEach(person=>{ const p=nextParty.find(hero=>(hero.characterId||hero.id)===person.id); if(p) person.alive=true; });
    return true;
  }

  /* 자유 탐사에 세울 대열을 확보한다. 자유 탐사는 이미 완주한 사람의 모드라,
     여기서 병과와 카드를 처음부터 다시 고르게 만들 이유가 없다.

       1) 이미 서 있는 대열이 있으면 그대로 쓴다 — 등대 기지에서 짜 둔 그 대열이다.
       2) 없으면 숙소에서 고른 사람들을 세운다.
       3) 숙소마저 비어 있으면(전멸로 런 저장이 지워진 뒤 제목에서 바로 들어온 경우)
          기본 대열과 시작 덱을 그 자리에서 만들어 준다.

     3번이 없으면 이 경우에만 편성 화면으로 떨어져, "숙소 대열로 바로 시작" 이라는
     규칙이 조용히 깨진다. */
  /* ============ 진행 중이던 시나리오로 복귀 ============
     자유 탐사는 본편을 완주해야 열리는 게 정상이지만, 지금은 챕터 하나만 깨도
     제목 화면에 '자유 탐사' 버튼이 뜬다(worldMapUnlocked 이 첫 클리어만 본다).
     그 상태로 자유 탐사에 들어가면 S.free 가 영구히 켜지면서 진행 중이던 챕터
     위치(S.chapter·stepInChapter·mapWindow 등)를 자유 탐사가 그대로 덮어써 버려,
     본편으로 돌아갈 방법이 없었다.

     그래서 본편을 아직 못 끝낸 상태로 처음 자유 탐사에 들어가는 그 순간에만
     '지금 서 있던 자리'를 스냅샷으로 떼어 둔다. 파티·덱·유물은 두 모드가
     공유하는 자원이라 스냅샷에 넣지 않는다 — 자유 탐사에서 얻은 카드도
     복귀하면 그대로 남아야 한다. */
  function mainCampaignFinished(){
    return hasWorldClear() || WORLD_RECORD.cleared.indexOf(CHAPTERS.length-1) >= 0;
  }
  const CAMPAIGN_SNAPSHOT_FIELDS = ['screen','chapter','stepInChapter','mapWindow','mapBranchPlan','mapBranch',
    'nodeQuota','mapVisited','pathCode','pendingNode','afterAftermath','aftermath','erosion','escape','tavern',
    'firstRun','firstRunGuide','prologue','chapterVariant'];
  function snapshotCampaignIfNeeded(){
    if(S.free || S.campaignSnapshot) return;
    if(mainCampaignFinished()) return;
    const snap = {};
    CAMPAIGN_SNAPSHOT_FIELDS.forEach(key=>{ snap[key] = S[key]; });
    S.campaignSnapshot = snap;
  }
  function hasCampaignSnapshot(){ return !!S.campaignSnapshot; }
  function resumeCampaignSnapshot(){
    const snap = S.campaignSnapshot;
    if(!snap) return false;
    CAMPAIGN_SNAPSHOT_FIELDS.forEach(key=>{ S[key] = snap[key]; });
    S.free = false;
    S.campaignSnapshot = null;
    if(SAFE_SCREENS.indexOf(S.screen) < 0) S.screen = 'tavern';
    return true;
  }

  function ensureExpeditionParty(){
    /* 자리에 뭐라도 있다고 바로 통과시키면 안 된다 — 죽은 사람이 자리를 차지한
       채로 있어도 '이미 파티가 있다'로 잘못 판정해, 숙소 명단으로 다시 채우는
       아래 로직을 건너뛰어 버린다. 그러면 죽은 대원이 다음 하강까지 그대로
       따라와 아무 행동도 못 하는 자리로 남는다. */
    const hasDeadPassenger = (S.party||[]).some(p=>p && !p.alive);
    if(!hasDeadPassenger && S.party && S.party.some(Boolean)) return true;
    autoFillResidenceSelection();
    if(applyResidenceParty()) return true;
    const selected = BASE_CLASSES.slice(0, Math.max(1, partyLimit()));
    if(!selected.length) return false;
    const placements = selected.slice();
    while(placements.length < 4) placements.push(null);
    const picks = {};
    selected.forEach(cid=>{ picks[cid] = []; });
    picks.neutral = startNeutralCardPool().slice(0, PICKS_NEUTRAL).map(card=>card.name);
    S.setup = {phase:'complete', selected:selected.slice(), placements:placements.slice(), armed:null,
               picks:picks, offers:{}, reform:false};
    S.party = buildPartyFromPlacements(placements);
    /* 정비실에서 짠 덱이 남아 있으면 그대로 둔다 — 대열만 없을 수도 있다 */
    if(!S.runDeck || !S.runDeck.length){
      S.runDeck = buildRunDeck(selected, picks);
      S.starterDeckCardIds = S.runDeck.map(card=>card.defId);
    }
    ensureResidence();
    return S.party.some(Boolean);
  }

  /* ============ 저장 ============
     런 하나를 통째로 넣어 둔다. 다만 적이 들고 있는 icon 은 base64 이미지 통짜라
     그대로 담으면 저장소가 금방 찬다 — 이름만 남기고 불러올 때 다시 붙인다.
     전투 중에는 저장하지 않는다. 조준 중이던 카드나 파티클 같은 순간 상태까지
     되살리려면 복잡해지고, 실패하면 런 전체를 잃는다.
     전투에서 나가면 그 노드 입구부터 다시 시작한다. */
  const RUN_KEY = 'fathom.run.v1';
  const UPGRADE_GUIDE_KEY = 'fathom.upgrade-guide.v1';
  const FUSION_GUIDE_KEY = 'fathom.fusion-guide.v1';
  const CARD_SYSTEM_GUIDE_KEY = 'fathom.card-system-guide.v1';
  const BATTLE_REWARD_GUIDE_KEY = 'fathom.battle-reward-guide.v1';
  /* 전투 중 실제로 발동한 반응을 설명하는 안내 — 항목별로 한 번씩만 표시한다. */
  const COMBAT_RULE_GUIDE_KEY = 'fathom.combat-rule-guide.v1';
  /* 에픽을 처음 손에 넣은 사람에게 한 번만 띄우는 안내 */
  const EPIC_GUIDE_KEY = 'fathom.epic-guide.v1';
  /* 새 게임의 첫 전투에서만 보여 주는 핵심 시스템 안내 */
  const CORE_GUIDE_KEY = 'fathom.core-guide.v1';
  /* 한 번이라도 내려가 본 적이 있는지 — '새로운 탐색' 이 해금을 지워도 이 자국만은 남는다.
     처음 켠 사람에게만 제목 화면 버튼을 '시작하기' 로 보여주기 위한 표시다. */
  const PLAYED_KEY = 'fathom.played.v1';
  const SAFE_SCREENS = ['map','rest','aftermath','escape','tavern','maintenance','institute','residence','relicSwap','epicAbsorb','epicAbsorbResult','worldMap','forayResult','pactSetup'];
  function hasSeenUpgradeGuide(){ return Store.get(UPGRADE_GUIDE_KEY)==='1'; }
  function markUpgradeGuideSeen(){ Store.set(UPGRADE_GUIDE_KEY, '1'); }
  function hasSeenFusionGuide(){ return Store.get(FUSION_GUIDE_KEY)==='1'; }
  function markFusionGuideSeen(){ Store.set(FUSION_GUIDE_KEY, '1'); }
  function hasSeenCardSystemGuide(){ return Store.get(CARD_SYSTEM_GUIDE_KEY)==='1'; }
  function markCardSystemGuideSeen(){ Store.set(CARD_SYSTEM_GUIDE_KEY, '1'); }
  function hasSeenBattleRewardGuide(){ return Store.get(BATTLE_REWARD_GUIDE_KEY)==='1'; }
  function markBattleRewardGuideSeen(){ Store.set(BATTLE_REWARD_GUIDE_KEY, '1'); }
  function hasSeenCombatRuleGuide(kind){ return Store.get(`${COMBAT_RULE_GUIDE_KEY}.${kind}`)==='1'; }
  function markCombatRuleGuideSeen(kind){ Store.set(`${COMBAT_RULE_GUIDE_KEY}.${kind}`, '1'); }
  function hasSeenEpicGuide(){ return Store.get(EPIC_GUIDE_KEY)==='1'; }
  function markEpicGuideSeen(){ Store.set(EPIC_GUIDE_KEY, '1'); }
  function hasSeenCoreGuide(){ return Store.get(CORE_GUIDE_KEY)==='1'; }
  function markCoreGuideSeen(){ Store.set(CORE_GUIDE_KEY, '1'); }
  /* 에픽·전설 안내. 화면을 가리지 않고 위에 얹히므로 어느 화면에서 켜지든
     (보상·합성·강화 승화·전투) 같은 판을 쓴다.

     실제로 한 장을 손에 넣는 순간({acquired:true})에는 등급을 가리지 않고 매번 켠다 —
     드물게 나오는 카드라 규칙을 다시 확인하고 싶은 자리가 바로 그 순간이다.
     전투 중 손패에 잡히기만 한 경우는 획득이 아니므로 예전처럼 최초 1회로 묶는다. */
  function raiseEpicGuide(card, opts){
    if(!S) return false;
    if(!isEpicCard(card) && !isLegendaryCard(card)) return false;
    const acquired = !!(opts && opts.acquired);
    if(!acquired && (S.epicGuide || hasSeenEpicGuide())) return false;
    S.epicGuide = isLegendaryCard(card) ? 'legendary' : 'epic';
    return true;
  }
  /* 표시가 없던 시절에 이미 놀던 사람은 남아 있는 기록으로 알아본다 */
  function hasPlayedBefore(){
    return Store.get(PLAYED_KEY)==='1'
      || hasSavedRun() || UNLOCKED.length > 0 || OWNED_MARKERS.length > 0 || hasSeenUpgradeGuide();
  }
  function markPlayed(){ Store.set(PLAYED_KEY, '1'); }

  function foeIconByName(name){
    const scenarioIcon = wardenScenarioIcon(name);
    if(scenarioIcon) return scenarioIcon;
    const all = FOE_SURFACE.concat(FOE_ELITES, FOE_ENDLESS, [FOE_BOSS, FOE_ENDLESS_BOSS]);
    const hit = all.find(f=>f.name===name);
    if(hit) return hit.icon;
    /* 수문장은 층마다 다른 이름으로 불리므로 제 이름으로는 찾히지 않는다 */
    return CHAPTERS.some(c=>c.wardenName===name) ? FOE_BOSS.icon : null;
  }
  function saveRun(){
    if(!S || SAFE_SCREENS.indexOf(S.screen) < 0) return;
    try{
      /* icon 은 적 초상, ic 는 예고 행동 도상 — 둘 다 base64 이미지 통짜다.
         이름과 타입만 남기고 불러올 때 다시 붙인다. */
      const json = JSON.stringify(S, (k,v)=> (k==='icon' || k==='ic' || k==='arrivalCardSparkScheduled') ? undefined : v);
      Store.set(RUN_KEY, json);
    }catch(e){}
  }
  function hasSavedRun(){ return !!Store.get(RUN_KEY); }
  function clearRun(){ Store.remove(RUN_KEY); }
  function clearBrowserCaches(){
    const jobs=[];
    try{
      if(typeof window!=='undefined' && window.FOA_STORAGE && typeof window.FOA_STORAGE.clear==='function'){
        jobs.push(Promise.resolve(window.FOA_STORAGE.clear()));
      } else if(typeof localStorage!=='undefined') localStorage.clear();
    }catch(e){}
    try{ if(typeof sessionStorage!=='undefined') sessionStorage.clear(); }catch(e){}
    try{
      if(typeof caches!=='undefined' && caches.keys){
        jobs.push(caches.keys().then(keys=>Promise.all(keys.map(key=>caches.delete(key)))));
      }
    }catch(e){}
    try{
      if(typeof navigator!=='undefined' && navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
        jobs.push(navigator.serviceWorker.getRegistrations().then(regs=>Promise.all(regs.map(reg=>reg.unregister()))));
      }
    }catch(e){}
    try{
      if(typeof indexedDB!=='undefined' && indexedDB.databases){
        jobs.push(indexedDB.databases().then(dbs=>Promise.all((dbs||[]).filter(db=>db.name).map(db=>new Promise(resolve=>{
          const request=indexedDB.deleteDatabase(db.name);
          request.onsuccess=request.onerror=request.onblocked=()=>resolve();
        })))));
      }
    }catch(e){}
    /* 모바일 Safari/WebView에서는 caches, serviceWorker, IndexedDB가
       삭제 완료 이벤트를 끝내 보내지 않는 경우가 있다. 캐시 정리가
       새 게임 시작을 붙잡지 않도록 각 작업을 제한 시간 안에서만 기다린다. */
    const settle=job=>Promise.race([
      Promise.resolve(job).catch(()=>null),
      new Promise(resolve=>setTimeout(resolve,1200)),
    ]);
    return Promise.all(jobs.map(settle));
  }
  /* 층 이름은 저장 안에 문자열로 남는다 — 노드마다, 전투마다, 탐사 기록마다.
     이름을 갈면 그 저장은 TIER_THREAT·NODE_POLICY 어느 표에도 걸리지 않아 조용히
     기본값으로 굴러떨어진다(수문장 이름은 사라지고 위협 배율은 1.00 이 된다).
     그래서 불러올 때 한 번 옛 이름을 새 이름으로 갈아 끼운다. 노드 제목에도 층 이름이
     접두사로 박혀 있으므로 문자열 앞머리까지 함께 본다. */
  const TIER_RENAMES = {'표층':'메아리의 여울', '중층':'역류의 이랑', '심해':'잔별의 구렁'};
  function migrateTier(tier){
    return (typeof tier === 'string' && TIER_RENAMES[tier]) || tier;
  }
  function migrateTiersInSave(data){
    const fixNode = n=>{
      if(!n || typeof n !== 'object') return;
      if(n.tier){
        const next = migrateTier(n.tier);
        /* '표층 · 조우' 처럼 제목 앞에 붙은 층 이름도 같이 간다 */
        if(next !== n.tier && typeof n.title === 'string' && n.title.indexOf(n.tier + ' ') === 0){
          n.title = next + n.title.slice(n.tier.length);
        }
        n.tier = next;
      }
    };
    (data.mapVisited||[]).forEach(fixNode);
    (data.mapWindow||[]).forEach(row=>(row||[]).forEach(fixNode));
    fixNode(data.pendingNode);
    if(data.battle){ data.battle.tier = migrateTier(data.battle.tier); fixNode(data.battle.node); }
    ['foray','forayResult','emergencyExit','escape'].forEach(k=>{
      if(data[k] && data[k].tier) data[k].tier = migrateTier(data[k].tier);
    });
  }
  /* 정찰(안개) 시스템 이전 저장에는 지금 갈림길이 mapChoices(평평한 배열)에만 있었다.
     그 값을 그대로 mapWindow[0](오프셋 0 = 지금 갈림길)으로 옮긴다 — 플레이어가 보고
     있던 선택지를 잃지 않는다. 정찰(오프셋 1 이상)은 처음 만나는 것이니 비워 두면
     ensureMapWindow 가 다음 렌더에서 알아서 채운다. */
  function migrateMapWindow(data){
    if(Array.isArray(data.mapWindow)) return;
    data.mapWindow = Array.isArray(data.mapChoices) ? [data.mapChoices] : [];
  }
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
      /* 직업 식별자는 유지하고 표시 이름만 최신 정의로 맞춘다.
         이전 버전에서 저장한 이어하기에도 바뀐 호칭이 즉시 반영된다. */
      (data.party||[]).forEach(hero=>{
        if(hero && hero.cls && CLASS_DEFS[hero.cls]) hero.name = CLASS_DEFS[hero.cls].name;
      });
      (data.runDeck||[]).forEach(refreshSpecialEpicCard);
      if(data.epicAbsorb && data.epicAbsorb.incoming) refreshSpecialEpicCard(data.epicAbsorb.incoming);
      if(data.epicAbsorbResult && data.epicAbsorbResult.card) refreshSpecialEpicCard(data.epicAbsorbResult.card);
      if(data.aftermath){
        (data.aftermath.cardOffer||[]).forEach(refreshSpecialEpicCard);
        if(data.aftermath.reveal && data.aftermath.reveal.card) refreshSpecialEpicCard(data.aftermath.reveal.card);
      }
      restoreStarterDeckIds(data);
      migrateMapWindow(data);
      migrateTiersInSave(data);
      data.salvageLocker = Object.assign({echoes:0,catalysts:0,oil:0},data.salvageLocker||{});
      /* 보관함이 추가되기 전 저장의 런 재화를 새 휴대 보관함으로 옮긴다. */
      if(data.abyssalEchoes){ data.salvageLocker.echoes=Math.min(salvageLockerCapacity().echoes,Math.max(0,Math.floor(Number(data.abyssalEchoes)||0))); }
      if(data.deepCatalysts){ data.salvageLocker.catalysts=Math.min(salvageLockerCapacity().catalysts,Math.max(0,Math.floor(Number(data.deepCatalysts)||0))); }
      data.abyssalEchoes=0; data.deepCatalysts=0;
      S = data;
      return true;
    }catch(e){ return false; }
  }
  /* '새로운 탐색' 은 해금까지 지운다 — 말 그대로 처음부터다 */
  function wipeAllSaves(){
    clearRun();
    Store.remove(UNLOCK_KEY);
    Store.remove(MARKER_KEY);
    Store.remove(WORLD_CLEAR_KEY);
    resetWorldRecord();
    Store.remove(RESEARCH_KEY);
    Store.remove(LIGHT_RANGE_KEY);
    Store.remove(NECROMANCER_KEY);
    Store.remove(LAST_LETTER_KEY);
    Store.remove(LIGHTHOUSE_KEY);
    Store.remove(SALVAGE_LOCKER_KEY);
    Store.remove(BASE_RESOURCE_KEY);
    Store.remove(WITNESS_KEY);
    Store.remove(CUTLINE_KEY);
    Store.remove(EPIC_GUIDE_KEY);
    /* 새 게임은 진행 데이터뿐 아니라 로컬에 남은 안내·환경 설정도 처음 상태로 돌린다. */
    [UPGRADE_GUIDE_KEY, FUSION_GUIDE_KEY, CARD_SYSTEM_GUIDE_KEY, BATTLE_REWARD_GUIDE_KEY, CORE_GUIDE_KEY,
      'fathom.combat-rule-guide.v1.dodge', 'fathom.combat-rule-guide.v1.guard',
      'fathom.combat-rule-guide.v1.defense', 'fathom.combat-rule-guide.v1.riposte',
      'fathom.combat-rule-guide.v1.critical', 'fathom.bgm.v1', PLAYED_KEY]
      .forEach(key=>Store.remove(key));
    resetRecords();
    resetSecrets();
    resetJournals();
    resetAbyssRank();
    resetImprints();
    resetAwakenedProgress();
    resetAbyssKeys();
    resetTrueEnding();
    resetSoleSurvivorAchievement();
    resetFixedTide();
    resetExpeditionCount();
    if(typeof resetBgmSetting==='function') resetBgmSetting();
    UNLOCKED = [];
    OWNED_MARKERS = [];
    WITNESSED = [];
    LIGHTHOUSE = {brightness:LIGHTHOUSE_START, oil:0, delivered:0};
    SALVAGE_LOCKER = {level:0};
    BASE_RESOURCE = {echoes:0,catalysts:0};
    /* 앱 진행 데이터와 안내 기록은 위에서 이미 동기적으로 지웠다.
       브라우저 캐시·서비스워커·IndexedDB 정리는 백그라운드에서 마무리한다.
       이 함수가 Promise를 반환하면 모바일 환경에서 새 게임 전환이 멈춘 것처럼
       보일 수 있으므로 의도적으로 기다리지 않는다. */
    clearBrowserCaches();
    return null;
  }
  function resetAndStartNewGame(){
    wipeAllSaves();
    markPlayed();
    startDirectRun();
    S.screen='opening';
    render();
  }
  function restartFromGameOver(){
    const fallenClass=(S.party||[]).find(p=>p && !p.alive && p.cls);
    startDirectRun();
    S.firstRun=false;
    S.firstRunGuide=false;
    S.tavern={recruited:[], slot:null, unlocked:null, seated:false};
    const residence=ensureResidence();
    const guest=addResidenceGuest(fallenClass ? fallenClass.cls : null);
    /* 게임오버 뒤에는 마지막으로 쓰러진 대원의 클래스와 같은 신입을 우선해
       등대에 더하고, 네 명으로 바로 재출정할 수 있게 한다. */
    if(guest && residence.roster.indexOf(guest)>=0){
      const hero=makeHero(guest.cls,guest.name,guest.id,guest.profile);
      attachArrivalCard(hero,guest.arrivalCard,guest.arrivalCardPending!==false);
      S.party=S.party.filter(Boolean).concat(hero).slice(0,PARTY_MAX);
      residence.selectedIds=S.party.map(p=>p.characterId||p.id);
      residence.placements=residence.selectedIds.slice();
    }
    if(typeof sayStop==='function') sayStop();
    startLighthouseReturnCutscene(()=>{
      S.screen='tavern';
      render();
    });
  }

  /* 등대 기지에서 대열을 다시 짠다.
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
      attachArrivalCard(hero,randomArrivalCard(cid));
      applyRelicMaxHp(hero);
      return hero;
    });

    /* 빠진 병과의 카드는 덱에서 함께 나간다 */
    before.filter(c=>after.indexOf(c)<0).forEach(cls=>{
      S.runDeck = S.runDeck.filter(c=>c.owner!==cls);
      delete S.setup.picks[cls];
    });
    /* 새로 들어온 병과는 제 카드 중 하나를 무작위로 쥐고 온다 */
    const joined = after.filter(c=>before.indexOf(c)<0);
    joined.forEach(cls=>{ S.setup.picks[cls] = []; });
    return joined;
  }

  function newRun(){
    S = {
      screen:'title',
      setup: { phase:'pick-classes', selected:[], placements:[null,null,null,null], armed:null,
               picks:{}, offers:{}, reform:false },
      erosion: 0,
      abyssalEchoes: 0,
      deepCatalysts: 0,
      salvageLocker: {echoes:0,catalysts:0,oil:0},
      chapter: 0,
      stepInChapter: 0,
      chapterVariant: null,
      mapWindow: [],
      mapBranchPlan: null,
      mapBranch: null,
      nodeQuota: null,
      mapVisited: [],
      pathCode: [],
      pendingNode: null,
      afterAftermath: null,
      aftermath: null,
      runDeck: null,
      starterDeckCardIds: [],
      party: null,
      battle: null,
      salvage: null,
      rest: null,
      relics: [],
      fuelCargo: 0,
      contaminationPreview: null,
      contaminationPreviewQueue: [],
      escape: null,
      /* 자유 탐사 — 완주 뒤에 열리는 되돌아올 수 있는 탐사 */
      free: false,
      epicGuide: false,
      foray: null,
      forayResult: null,
      emergencyExit: null,
      finalGrowth: null,
      surfaceReturnPending: false,
      tavern: null,
      maintenance: null,
      maintenanceLibrary: [],
      residence: {roster:[], selectedIds:[], placements:[null,null,null,null], armedId:null, pendingGuests:[]},
      firstRunGuide: false,
      firstRunCombatGuideCount: 0,
      firstRun: false,
      prologue: null,
      logMsg: '',
      logLines: [],
      loseReason:'',
      /* ============ 심연과의 서약 (엔드컨텐츠) ============
         전부 런 범위 상태다. 서약 조항·첫 숨은 저장되지 않고, 계위가 강제하는 조항만
         런 시작 시 영구 저장에서 채워 넣는다. */
      firstBreath: null,
      firstBreathOilMul: 1,
      firstBreathUnknownMul: 1,
      firstBreathErosionMul: 1,
      firstBreathDepthBonus: 0,
      pactClauses: [],
      pactDepth: 0,
      forcedClauses: (typeof forcedClauseIdsForRank==='function' && typeof abyssRank==='function') ? forcedClauseIdsForRank(abyssRank()) : [],
      dpPeakSeen: 0,
      erosionPeakSeen: 0,
      awakenedChoices: {},
      /* 고정 조수(파밍 던전) 진입 표시 — 이번 탐사가 그 경로로 들어왔는지만 기록한다 */
      farmRun: false,
      /* 해도에서 마지막으로 고른 지점 — 하단 버튼의 목적지 */
      worldPick: null,
      /* 본편을 아직 못 끝낸 채 처음 자유 탐사에 들어갈 때만 채워지는, 그 자리로
         돌아갈 스냅샷 */
      campaignSnapshot: null,
    };
  }

  /* 튜토리얼용 카드·적 생성기는 구버전 저장과의 호환을 위해 남겨 둔다. */
  function tutorialCard(owner, name){
    const base = (CARD_DB[owner]||[]).find(c=>c.name===name);
    return base ? Object.assign({}, base, {uid:nextId(), defId:nextId(), upgraded:false, contaminated:false}) : null;
  }
  function tutorialFoe(name, hp, atk, reach, role, icon, intent){
    return {id:nextId(), name, maxHp:hp, hp:hp, atk:atk, reach:reach, role:role,
            icon:icon, block:0, intent:intent, alive:true, react:null};
  }
  /* 첫 출정의 기본 런.
     짧은 등대 출정문 뒤 첫 세 직업과 기본 카드 묶음을 자동으로 편성한다.
     파티·덱·노드·전투의 본편 규칙은 기존 런과 동일하게 유지한다. */
  function startDirectRun(){
    newRun();
    recordWorldStage(0,false);
    const selected = BASE_CLASSES.slice(0, PARTY_START);
    const placements = selected.concat([null]);
    const picks = {};
    selected.forEach(cid=>{
      /* 초기 대원도 귀환 합류자와 같은 규칙으로 개인 카드 한 장을 받는다. */
      picks[cid] = [];
    });
    picks.neutral = startNeutralCardPool().slice(0, PICKS_NEUTRAL).map(card=>card.name);
    S.setup = {phase:'complete', selected:selected.slice(), placements:placements.slice(), armed:null,
               picks:picks, offers:{}, reform:false};
    S.party = buildPartyFromPlacements(placements);
    S.runDeck = buildRunDeck(selected, picks);
    let starterRareCount=0;
    S.runDeck=S.runDeck.filter(card=>{
      if(!isStarterRareCard(card)) return true;
      if(starterRareCount>=1) return false;
      starterRareCount+=1;
      return true;
    });
    S.party.filter(Boolean).forEach(hero=>{
      const arrival=randomStarterArrivalCard(hero.cls,starterRareCount);
      if(isStarterRareCard(arrival)) starterRareCount+=1;
      attachArrivalCard(hero,arrival,false);
    });
    const letter=takeLastLetter();
    if(letter.cards.length){
      letter.cards.forEach(card=>{
        if(S.runDeck.length>=MAX_DECK_SIZE || (isStarterRareCard(card) && starterRareCount>=1)) return;
        const added=Object.assign({},card,{uid:nextId(),defId:nextId(),deckOrigin:'last-letter'});
        S.runDeck.push(added);
        if(isStarterRareCard(added)) starterRareCount+=1;
      });
    }
    if(letter.relic) S.relics.push(letter.relic);
    S.starterDeckCardIds = S.runDeck.map(card=>card.defId);
    /* 새 런을 시작할 때마다 첫 전투에서 실제 조작 안내를 시작한다. */
    S.firstRunGuide = !hasSeenCoreGuide();
    /* 첫 핵심 가이드 팝업도 전체 횟수에 포함한다. */
    S.firstRunCombatGuideCount = S.firstRunGuide ? 1 : 0;
    S.firstRun = true;
    S.erosion = 0;
    drainLighthouseForDescent();
    S.screen = 'map';
  }
  /* ── 구버전 오프닝 호환 ──
     새 게임 진입에서는 사용하지 않는다. 기존 저장·화면 호출이 남아 있는 경우에만
     화면을 유지하며, 새 런은 startDirectRun()으로 바로 시작한다. */
  function startOpening(){
    startDirectRun();
    S.screen = 'opening';
    render();
    /* 제목을 덮은 어둠을 여기서 걷는다 */
    sayCurtain('in', 700);
  }

  /* 설명도 표지도 없이 곧장 전투로 들어간다. 플레이어는 이것을 **평범한 화물 확인 잠수**로
     여겨야 한다 — '기록' 이라는 낱말은 넷이 죽은 뒤에 처음 나온다.
     그래서 메아리의 여울의 평범한 적만 세우고, 층 이름도 메아리의 여울로 둔다. */
  function startPrologue(){
    newRun();
    proResetOutcome();
    S.prologue = {phase:'battle', gone:[], record:[], salvage:null, erosionShown:false};
    S.party = BASE_CLASSES.map(makeHero);
    /* 첫 예시는 확률이 아니라 규칙을 보여주는 장면이다 — 회피·반격이 끼어들면
       방어가 피해를 막는 핵심이 흐려진다. */
    S.party.forEach(p=>{ p.reactMod = {dodge:0, guard:0, riposte:0, rip:0}; });
    S.erosion = 6;
    const warden = FOE_SURFACE.find(f=>f.name==='익사체');
    S.battle = {
      tier:'메아리의 여울', node:{type:'battle',tier:'메아리의 여울',title:'메아리의 여울 · 조우',desc:''},
      enemies:[tutorialFoe(warden.name, warden.maxHp, warden.atk, warden.reach, warden.role, warden.icon,
                          {type:'attack_reach', val:12, label:'내려찍기', ic:IC_CLEAVER})],
      deck:[], hand:[tutorialCard('vanguard','놋쇠 벽')], discard:[],
      ap:3, maxAp:3, tempAp:0, turn:1, over:false, pendingCardUid:null, pendingDomain:null
    };
    S.screen = 'battle';
    S.logMsg = '삼등 창고. 안내판대로다. 화물 사이에서 형체 하나가 일어선다.';
    /* 어둠은 그대로 둔 채 밑에서 판을 세운다 — 각본의 첫 박자가 걷어낸다 */
    curtainCover();
    render();
    /* 각본이 등대 기지 장면까지 끝까지 돈 뒤 스스로 finishPrologue 를 부른다 */
    sayRun(proChain());
  }
  /* 기록을 덮었다. 여기서 처음으로 본편이 시작된다.
     프롤로그는 해금·덱·유물을 보너스로 남기지 않는다. 남는 것은 첫 근무에서 확인한
     등대의 규칙과 플레이어가 직접 이어받은 역할뿐이다. */
  function finishPrologue(){
    newRun();
    proGrantOutcome();
    S.screen = 'classSelect';
    render();
    /* 어둠 뒤에서 본편이 세워졌다. 뚝 끊지 않고 같은 호흡으로 연다. */
    sayCurtain('in', 700);
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
