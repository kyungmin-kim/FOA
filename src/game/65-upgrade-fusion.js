  /* ============ UPGRADE / FUSION ============ */
  const MAX_UPGRADE_LEVEL = 5;
  /* 예전 저장의 upgraded:true는 +1로 읽는다. 이름은 표시용이므로 따로 원래 이름을 남긴다. */
  function upgradeLevel(card){ return Number.isFinite(card.upgradeLevel) ? card.upgradeLevel : (card.upgraded ? 1 : 0); }
  function baseCardName(card){ return card.baseName || String(card.name||'').replace(/\++$/, ''); }
  /* 덱에는 같은 카드가 여러 장 들어갈 수 있으므로(보상·복제본), 관리 화면에서는
     같은 카드·같은 단계를 한 줄로 묶어 필요한 정보만 보여 준다. */
  function cardManageKey(card){ return `${card.owner}|${baseCardName(card)}|${upgradeLevel(card)}`; }
  function groupDeckCards(cards){
    const groups = new Map();
    cards.forEach(card=>{
      const key = cardManageKey(card);
      if(!groups.has(key)) groups.set(key, {key:key, defId:card.defId, card:card, defIds:[], name:card.name, owner:card.owner, level:upgradeLevel(card), count:0});
      const group = groups.get(key);
      group.defIds.push(card.defId);
      group.count++;
    });
    return Array.from(groups.values());
  }
  /* 강화가 이 카드를 실제로 바꾸는가.
     비상 탈출처럼 올릴 수치가 하나도 없는 카드는 이름에 + 만 붙고 효과는 그대로다 —
     눌러도 달라지는 것이 없는 줄을 목록에 세우면 속이는 것이 된다.
     설명과 AP 를 둘 다 본다. 자리 교환·예고 재결정은 설명에 수치가 없고 AP 만 내려가므로,
     설명만 대조하면 정작 이득이 있는 카드가 통째로 빠진다(그리고 AP 0 이면 그것도 끝이다).
     미리 만들어 본 카드를 직접 대조하므로, 나중에 raiseCardLevel 이 새 필드를 다루게 되면
     이 판정도 저절로 따라온다. */
  function upgradeChangesCard(card){
    const preview = previewUpgradeCard(card);
    if(!preview) return false;
    return preview.cost !== card.cost || describeCard(preview) !== describeCard(card);
  }
  /* 강화는 덱 속 개별 카드 한 장만 대상으로 삼는다.
     목록은 같은 종류를 묶되, 실제 강화는 그 묶음 안의 카드 한 장에만 적용한다. */
  /* 에픽은 전투 뒤의 강화 목록에 오르지 않는다. 그것을 깊게 하는 길은 하나뿐이다 —
     셋째 에픽이 손에 들어올 때, 그것을 녹여 지닌 하나에 얹는 것. */
  function upgradableDeckGroups(){
    return groupDeckCards(S.runDeck.filter(c=>upgradeLevel(c)<MAX_UPGRADE_LEVEL && !c.unupgradable && !isEpicCard(c)
                                              && upgradeChangesCard(c)));
  }
  /* 지금 손댈 수 있는 줄만 세운다. +3부터는 같은 카드·같은 단계 두 장이 있어야 하는데,
     한 장뿐인 카드는 눌리지도 않으면서 목록만 길게 만든다 — 덱에 복제본을 넣지 않으므로
     짝이 없는 +3은 사실상 그 카드의 끝이다. */
  /* 강화·합성 목록 정렬 — 강화 단계가 높은 것부터, 같은 단계면 공격 > 방어 > 지원 순. */
  const CARD_LIST_SORT_RANK = {attack:0, defense:1, support:2};
  function cardListSortRank(card){ const r=CARD_LIST_SORT_RANK[cardCategory(card)]; return r==null ? 3 : r; }
  function groupedUpgradeOptions(){
    return upgradableDeckGroups().filter(canUpgradeGroup).sort((a,b)=>
      b.level-a.level || cardListSortRank(a.card)-cardListSortRank(b.card)
      || String(a.name).localeCompare(String(b.name)) || String(a.owner).localeCompare(String(b.owner)));
  }
  /* 짝이 없어 목록에서 빠진 줄 수 — 왜 안 보이는지 한 줄로 알려 주려고 센다 */
  function mergeWaitingCount(){
    return upgradableDeckGroups().filter(g=>!canUpgradeGroup(g)).length;
  }
  /* +0 → +1은 카드 한 장으로 강화하고, +1 → +2부터 같은 카드·같은 강화 단계
     두 장을 녹인다. 전설은 예외다 — 수문장 전용 드롭이라 중복이 사실상 나오지 않으므로,
     중복 요구를 면제해 재화만으로 +5까지 밀 수 있게 한다. 대신 비용을 훨씬 무겁게 매긴다
     (아래 rarityUpgradeMul · upgradeCatalystCost). */
  const MERGE_UPGRADE_START_LEVEL = 1;
  function upgradeNeedsMerge(cardOrGroup){
    const card = cardOrGroup.card || cardOrGroup;
    if(isLegendaryCard(card)) return false;
    const level = Number.isFinite(cardOrGroup.level) ? cardOrGroup.level : upgradeLevel(cardOrGroup);
    return level >= MERGE_UPGRADE_START_LEVEL;
  }
  function canUpgradeGroup(group){ return !upgradeNeedsMerge(group) || group.count >= 2; }
  /* 등급이 높을수록 강화 자체가 무거워진다. 일반 카드 승화(+4→+5, 배율 1)보다
     전설의 첫 강화(+0→+1, 배율 6)가 더 비싸도록 잡았다 — 지금까지는 거꾸로였다. */
  function rarityUpgradeMul(card){ return isLegendaryCard(card) ? 6 : isEpicCard(card) ? 3 : 1; }
  function upgradeEchoCost(card){ return (2 + upgradeLevel(card)*2) * rarityUpgradeMul(card); }
  function upgradeCatalystCost(card){
    if(isLegendaryCard(card)) return 3 + upgradeLevel(card);
    if(isEpicCard(card)) return 2;
    return upgradeLevel(card)>=4 ? 1 : 0;
  }
  function canPayUpgrade(card){ return abyssalEchoes()>=upgradeEchoCost(card) && deepCatalysts()>=upgradeCatalystCost(card); }
  function fusionEchoCost(a,b){ return 4 + Math.max(upgradeLevel(a),upgradeLevel(b))*2; }
  function fusionCatalystCost(a,b){ return (isEpicCard(a)||isEpicCard(b)||isLegendaryCard(a)||isLegendaryCard(b)||Math.max(upgradeLevel(a),upgradeLevel(b))>=4) ? 1 : 0; }
  function canPayFusion(a,b){ return abyssalEchoes()>=fusionEchoCost(a,b) && deepCatalysts()>=fusionCatalystCost(a,b); }
  function groupedFusionOptions(){
    return groupDeckCards(S.runDeck.filter(c=>!isEpicCard(c) && !isLegendaryCard(c))).sort((a,b)=>
      b.level-a.level || cardListSortRank(a.card)-cardListSortRank(b.card)
      || String(a.name).localeCompare(String(b.name)) || String(a.owner).localeCompare(String(b.owner)));
  }
  function fusionMaterialCards(){
    return S.runDeck.filter(c=>!isEpicCard(c) && !isLegendaryCard(c));
  }
  function raiseCardLevel(c){
    const level = upgradeLevel(c);
    if(level>=MAX_UPGRADE_LEVEL || c.unupgradable) return false;
    c.baseName = baseCardName(c);
    c.upgradeLevel = level+1;
    c.upgraded = true;
    c.name = c.baseName + '+'.repeat(c.upgradeLevel);
    if(c.dmg) c.dmg = Math.round(c.dmg*1.35);
    if(c.block) c.block = Math.round(c.block*1.35);
    if(c.selfBlock) c.selfBlock = Math.round(c.selfBlock*1.35);
    if(c.heal) c.heal = Math.round(c.heal*1.35);
    if(c.calm) c.calm = Math.round(c.calm*1.35);
    if(c.selfDp) c.selfDp = Math.max(0, c.selfDp-2);
    /* 성자의 마지막 기도처럼 비율·총량으로 적힌 것도 함께 올린다.
       빠뜨리면 이름만 +1 이 붙고 효과는 그대로인 카드가 된다. */
    if(c.regenTotal) c.regenTotal = Math.round(c.regenTotal*1.35);
    if(c.healRatio) c.healRatio = Math.min(1, Math.round(c.healRatio*135)/100);
    if(c.type==='draw' || c.type==='foresight') c.draw = (c.draw||0)+1;
    if(c.type==='swap' || c.type==='reposition' || c.type==='reroll_intent') c.cost = Math.max(0, c.cost-1);
    /* +4 카드 두 장을 녹여 +5가 되는 순간, 평범한 기술은 심연의 에픽으로 변한다.
       이미 심연의 것인 카드에는 승화할 자리가 없다 — AP 값을 건드리지 않고 지나간다. */
    if(c.upgradeLevel===MAX_UPGRADE_LEVEL && !isLegendaryCard(c) && !isAbyssEpic(c)){ c.epic=true; c.cost=1; }
    return true;
  }
  function previewUpgradeCard(c){
    const preview = Object.assign({}, c);
    return raiseCardLevel(preview) ? preview : null;
  }
  function applyUpgradeCard(c){
    if(!raiseCardLevel(c)) return false;
    S.logMsg = `${c.name} 카드가 강화되었다.`;
    return true;
  }
  function applyUpgradeByDefId(defId){
    const c = S.runDeck.find(c=>c.defId===defId);
    if(!c) return null;
    let material = null;
    if(upgradeNeedsMerge(c)){
      const key = cardManageKey(c);
      material = S.runDeck.find(other=>other.defId!==c.defId && cardManageKey(other)===key);
      if(!material) return null;
    }
    const echoes=upgradeEchoCost(c), catalysts=upgradeCatalystCost(c);
    if(!canPayUpgrade(c) || !spendUpgradeCurrency(echoes,catalysts)) return null;
    const wasRare = isEpicCard(c) || isLegendaryCard(c);
    if(!applyUpgradeCard(c)) return null;
    /* +5 승화로 이제 막 심연의 에픽이 된 카드도 새로 얻은 것과 같다 */
    if(!wasRare) raiseEpicGuide(c, {acquired:true});
    if(material){
      const materialIdx = S.runDeck.findIndex(other=>other.defId===material.defId);
      if(materialIdx>=0) S.runDeck.splice(materialIdx, 1);
      S.logMsg = `${baseCardName(c)} +${upgradeLevel(c)-1} 두 장이 합쳐져 ${c.name}이(가) 되었다. (잔향 -${echoes}${catalysts?' · 촉매 -'+catalysts:''})`;
    }
    return c;
  }
  function activeFusionClassCards(){
    const presentClasses = new Set(S.party.filter(p=>p && p.alive).map(p=>p.cls));
    return FUSION_CLASS_CARD_POOL.filter(c=>presentClasses.has(c.owner));
  }
  function fusionResultCard(allowRare){
    /* 촉매를 바친 합성만 에픽 결과를 열어 둔다. 일반 합성은 중립·직업 카드만 만든다. */
    if(allowRare && Math.random() < EPIC_FUSION_CHANCE) return {base:pickEpicCard(), epic:true};
    const classCards = activeFusionClassCards();
    const pool = classCards.length && Math.random()<0.5 ? classCards : FUSION_CARD_POOL;
    return {base:pickOne(pool), epic:false};
  }
  function applyFusion(defIdA, defIdB){
    const ia = S.runDeck.findIndex(c=>c.defId===defIdA);
    const ib = S.runDeck.findIndex(c=>c.defId===defIdB);
    if(ia<0 || ib<0 || ia===ib) return null;
    const a=S.runDeck[ia], b=S.runDeck[ib];
    const echoes=fusionEchoCost(a,b), catalysts=fusionCatalystCost(a,b);
    if(!canPayFusion(a,b) || !spendUpgradeCurrency(echoes,catalysts)) return null;
    const first = Math.max(ia,ib), second = Math.min(ia,ib);
    S.runDeck.splice(first,1);
    S.runDeck.splice(second,1);
    const result = fusionResultCard(catalysts>0);
    const epic = result.epic;
    const base = result.base;
    const newCard = mkDeckCard(base, 'fused');
    /* 재료는 이미 녹았다. 셋째 에픽이면 덱에 자리가 없으므로 흡수 화면으로 넘긴다. */
    if(offerEpicAbsorb(newCard, S.screen)){
      S.logMsg = '심연이 응답했지만, 두 손은 이미 차 있다.';
      return newCard;
    }
    S.runDeck.push(newCard);
    raiseEpicGuide(newCard, {acquired:true});
    S.logMsg = epic
      ? `심연이 합성에 응답했다. 에픽 카드가 모습을 드러냈다. (잔향 -${echoes} · 촉매 -${catalysts})`
      : `두 카드가 하나로 융합되었다. (잔향 -${echoes}${catalysts?' · 촉매 -'+catalysts:''})`;
    return newCard;
  }
  /* ============ 에픽의 자리 ============
     심연이 내려주는 에픽은 두 장까지만 손에 남는다. 셋째가 올라오면 두 걸음을 밟는다 —
     먼저 무엇을 두고 갈지 고르고, 그다음 남은 것 하나를 한 단계 깊게 한다.

     두 걸음으로 나눈 이유는 새로 올라온 것을 버릴지 지닐지가 플레이어의 몫이기 때문이다.
     한 걸음이던 시절에는 새것이 언제나 녹아 사라져서, 더 좋은 것이 올라와도 쥘 수 없었다.

     그래서 강화 목록에서는 에픽이 빠진다. 에픽을 키우는 길은 이것 하나뿐이다.
     손을 하나 더 여는 것은 전설 유물 하나뿐이며, 그마저도 좀처럼 올라오지 않는다. */
  const EPIC_HOLD_LIMIT = 2;
  function epicHoldCap(){ return EPIC_HOLD_LIMIT + relicSum('epicSlots'); }
  function heldAbyssEpics(){ return (S && S.runDeck ? S.runDeck : []).filter(isAbyssEpic); }
  function epicOverflows(card){ return isAbyssEpic(card) && heldAbyssEpics().length >= epicHoldCap(); }
  /* 강화 불가 카드(단죄·조류·성궤)는 얹을 자리가 없다.
     무명자의 찬가처럼 올릴 수치가 아예 없는 카드도 마찬가지다 — 이름만 +1 이 붙고
     효과는 그대로면 속이는 것이 된다. 강화 목록과 같은 자를 쓴다(upgradeChangesCard). */
  function canAbsorbInto(card){
    if(!card || card.unupgradable || upgradeLevel(card) >= MAX_UPGRADE_LEVEL) return false;
    return upgradeChangesCard(card);
  }
  /* 넘치는 에픽이 들어오면 화면을 가로챈다 — 부른 쪽은 제 화면 전환을 접어야 한다.
     유물이 자리를 넘칠 때(offerRelic)와 같은 약속이다. */
  function offerEpicAbsorb(card, back){
    if(!epicOverflows(card)) return false;
    S.epicAbsorb = { incoming: card, back: back || S.screen, phase:'discard', gone:null };
    S.screen = 'epicAbsorb';
    return true;
  }
  /* 지금 고를 수 있는 것들 — 지닌 에픽과 새로 올라온 것. 버리는 걸음에서만 쓴다. */
  function epicDiscardChoices(){
    const ab = S.epicAbsorb;
    if(!ab) return [];
    return heldAbyssEpics().map(c=>({card:c, defId:c.defId, incoming:false}))
      .concat([{card:ab.incoming, defId:null, incoming:true}]);
  }

  /* 1걸음 — 하나를 두고 온다. 여기서 덱이 곧바로 정리된다.
     장면 도중에 판을 닫아도 덱은 어긋나지 않는다 — 못 받는 것은 다음 걸음의 +1 뿐이다.
     defId 가 비면 새로 올라온 것을 두고 온다. */
  function discardEpic(defId){
    const ab = S.epicAbsorb;
    if(!ab || ab.phase !== 'discard') return false;
    const incoming = ab.incoming;
    if(defId){
      const at = S.runDeck.findIndex(c=>c.defId===defId && isAbyssEpic(c));
      if(at < 0) return false;
      const gone = S.runDeck[at];
      S.runDeck.splice(at, 1);
      S.runDeck.push(incoming);
      ab.gone = gone.name;
      S.logMsg = `${eul(gone.name)} 심연에 두고, ${eul(incoming.name)} 손에 쥔다.`;
    } else {
      ab.gone = incoming.name;
      S.logMsg = `${incoming.name}은(는) 심연에 두고 왔다.`;
    }
    ab.phase = 'upgrade';
    return true;
  }
  /* 2걸음 — 남은 것 하나를 한 단계 깊게 한다. defId 가 비면 그냥 나간다
     (남은 것이 모두 강화 불가일 때의 길이기도 하다). 실제로 무게가 얹었으면
     그 결과를 보여 주는 화면을 한 번 거친 뒤에야 원래 화면으로 돌아간다 —
     전투 보상 중 넘친 에픽이 조용히 다른 카드 속으로 사라지지 않게 한다. */
  function applyEpicAbsorb(defId){
    const ab = S.epicAbsorb;
    if(!ab) return null;
    /* 버리는 걸음을 건너뛰고 불렸다면 새것을 두고 온 것으로 친다 */
    if(ab.phase === 'discard') discardEpic(null);
    let target = defId ? (S.runDeck.find(c=>c.defId===defId && isAbyssEpic(c)) || null) : null;
    if(target && !canAbsorbInto(target)) target = null;
    const before = target ? upgradeLevel(target) : 0;
    if(target && raiseCardLevel(target)){
      S.logMsg = `두고 온 ${ab.gone}의 무게가 ${target.name}에 얹혔다.`;
    } else {
      target = null;
    }
    const back = ab.back || 'map';
    if(target){
      S.epicAbsorbResult = {card: target, before: before, back: back};
      S.screen = 'epicAbsorbResult';
    } else {
      S.screen = back;
    }
    S.epicAbsorb = null;
    return target;
  }

  const CARD_REWARD_OFFER_SIZE = 3;
  const ELITE_PREMIUM_CARD_CHANCE = EPIC_FUSION_CHANCE * 2;
  const BOSS_LEGENDARY_CARD_CHANCE = 0.05;
  function cardRewardPool(){
    const activeClasses = new Set(S.party.filter(p=>p && p.alive).map(p=>p.cls));
    const pool = CARD_DB.neutral.concat(Array.from(activeClasses).flatMap(cls=>CARD_DB[cls]||[]));
    const owned = new Set(S.runDeck.map(c=>`${c.owner}|${baseCardName(c)}`));
    const fresh = pool.filter(c=>!owned.has(`${c.owner}|${c.name}`));
    return fresh.length ? fresh : pool;
  }
  /* ============ 복제본 보상 ============
     자유 탐사에서만 이미 지닌 카드가 다시 나온다. +3 부터는 같은 카드·같은 단계 두 장이
     있어야 합쳐지는데, 덱에 복제본을 넣지 않으므로 본편에서는 그 벽을 넘을 길이 없다.

     복제본은 +1~+3 중 하나로 온다. +3부터는 같은 단계의 짝을 맞춰야 다음 강화로 이어진다. */
  const DUP_REWARD_CHANCE = 0.45;
  const DUP_GRADE_ROLL = [[55, 1], [30, 2], [15, 3]];
  /* 덱의 카드로부터 원래 정의를 되찾는다 — 강화된 카드를 복제하려면 기준값이 필요하다 */
  function findCardBase(card){
    const name = baseCardName(card);
    const pools = [CARD_DB[card.owner] || [], FUSION_CARD_POOL, FUSION_CLASS_CARD_POOL];
    for(const pool of pools){
      const hit = pool.find(c=>c.name===name && c.owner===card.owner);
      if(hit) return hit;
    }
    return null;
  }
  function duplicateRewardCard(){
    const mine = (S.runDeck||[]).filter(c=>!isEpicCard(c) && !isLegendaryCard(c) && !c.unupgradable);
    if(!mine.length) return null;
    const src = pickOne(mine);
    const base = findCardBase(src);
    /* 원본을 못 찾으면 지금 그 카드를 그대로 베낀다 — 같은 단계라 오히려 바로 합쳐진다.
       신원(defId·uid)은 반드시 떼어낸다. 그대로 두면 mkDeckCard 가 새로 매기려던 번호를
       덮어써서 두 장이 같은 번호를 갖고, 강화와 합성이 엉뚱한 장을 집는다. */
    const dup = Object.assign({}, base || src);
    delete dup.defId; delete dup.uid; delete dup.deckOrigin; delete dup.contaminated; delete dup.heldTurns;
    if(!base) return dup;
    const grade = weighted(DUP_GRADE_ROLL);
    for(let i=0; i<grade; i++){ if(!raiseCardLevel(dup)) break; }
    return dup;
  }

  function premiumRewardCard(allowLegendary){
    const legendaryChance=Math.min(0.35,BOSS_LEGENDARY_CARD_CHANCE*lighthouseRareLootMul()*expeditionRareMul());
    const canLegendary = allowLegendary && !hasLegendaryCard();
    return canLegendary && Math.random()<legendaryChance ? pickOne(LEGENDARY_CARD_POOL) : pickEpicCard();
  }
  function cardRewardOffer(node){
    const offer = shuffle(cardRewardPool().slice()).slice(0, CARD_REWARD_OFFER_SIZE);
    if(!offer.length) return offer;
    /* 복제본은 에픽·전설보다 먼저 자리를 잡는다 — 그쪽이 덮어써도 아쉬울 것이 없다 */
    if(S.free && Math.random() < DUP_REWARD_CHANCE){
      const dup = duplicateRewardCard();
      if(dup) offer[Math.floor(Math.random()*offer.length)] = dup;
    }
    const rewardSlot = Math.floor(Math.random()*offer.length);
    if(node && node.boss){
      /* 구역 수문장은 에픽을 반드시 남긴다. 그중 5%는 전설로 바뀐다.
         자유 탐사 누적 횟수가 오를수록 이 5%도 함께 오른다. */
      offer[rewardSlot] = premiumRewardCard(true);
    } else if(isBossTier(node) && Math.random()<Math.min(0.65,ELITE_PREMIUM_CARD_CHANCE*lighthouseRareLootMul()*expeditionRareMul())){
      /* 정예는 일반 보상(5%)의 두 배 확률로 에픽 이상의 카드를 남긴다. */
      offer[rewardSlot] = premiumRewardCard(true);
    } else if(Math.random()<Math.min(0.35,EPIC_FUSION_CHANCE*lighthouseRareLootMul()*expeditionRareMul())){
      offer[rewardSlot] = pickEpicCard();
    }
    return shuffle(offer);
  }
  function claimCardReward(index){
    const a = S.aftermath;
    const card = a && a.cardOffer && a.cardOffer[index];
    if(!card) return null;
    /* 넘치는 에픽은 덱에 넣지 않는다 — 고른 순간 지닌 것 하나를 깊게 하는 화면으로 간다 */
    if(epicOverflows(card)){
      a.cardOffer = null;
      offerEpicAbsorb(mkDeckCard(card, 'reward'), S.screen);
      return null;
    }
    const added = addRunDeckCard(card, 'reward');
    if(!added) return null;
    a.cardTaken = added;
    a.cardOffer = null;
    S.logMsg = `${added.name} 카드가 덱에 추가되었다. (${S.runDeck.length}/${MAX_DECK_SIZE})`;
    if(isLegendaryCard(added)) a.reveal = {kind:'reward', card:added, legendaryAcquired:true};
    else if(isEpicCard(added)) a.reveal = {kind:'reward', card:added, epicAcquired:true};
    raiseEpicGuide(added, {acquired:true});
    return added;
  }

  /* ============ 정비실 ============
     귀환한 런의 카드와 살아 돌아온 직업군의 전체 카드 목록을 정비실에 올린다.
     정비실을 나갈 때 선택한 카드만 실제 하강 덱으로 되돌리므로, 전투 중 사용하는
     runDeck 규칙과 카드 강화·합성 규칙은 그대로 유지한다. */
  function maintenanceBaseCards(){
    const active = new Set((S.party||[]).filter(p=>p&&p.alive).map(p=>p.cls));
    return CARD_DB.neutral.concat(Array.from(active).flatMap(cls=>CARD_DB[cls]||[]));
  }
  function beginMaintenance(){
    const existing = (S.runDeck||[]).slice();
    const pool = (S.maintenanceLibrary||[]).slice();
    const owned = new Set(pool.map(c=>`${c.owner}|${baseCardName(c)}`));
    existing.forEach(card=>{
      const key = `${card.owner}|${baseCardName(card)}`;
      const same = pool.findIndex(old=>old.defId===card.defId);
      if(same>=0) pool[same]=card;
      else { pool.push(card); owned.add(key); }
    });
    maintenanceBaseCards().forEach(base=>{
      const key = `${base.owner}|${base.name}`;
      if(!owned.has(key)){
        pool.push(mkDeckCard(base,'maintenance'));
        owned.add(key);
      }
    });
    S.maintenance = {tab:'catalog', deckIds:existing.map(c=>c.defId), upgradeSelected:null, fuseSelected:[], reveal:null};
    S.runDeck = pool;
    S.screen = 'maintenance';
  }
  function finishMaintenance(){
    const m = S.maintenance;
    if(!m) return;
    const selected = new Set(m.deckIds||[]);
    S.maintenanceLibrary = (S.runDeck||[]).slice();
    S.runDeck = (S.runDeck||[]).filter(c=>selected.has(c.defId)).slice(0,MAX_DECK_SIZE);
    S.starterDeckCardIds = (S.starterDeckCardIds||[]).filter(id=>selected.has(id));
    S.maintenance = null;
  }
