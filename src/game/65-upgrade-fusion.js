  /* ============ UPGRADE / FUSION ============ */
  const MAX_UPGRADE_LEVEL = 5;
  /* 예전 저장의 upgraded:true는 +1로 읽는다. 이름은 표시용이므로 따로 원래 이름을 남긴다. */
  function upgradeLevel(card){ return Number.isFinite(card.upgradeLevel) ? card.upgradeLevel : (card.upgraded ? 1 : 0); }
  function baseCardName(card){ return card.baseName || String(card.name||'').replace(/\++$/, ''); }
  /* 전투 덱에는 같은 카드가 세 장씩 들어가지만, 인양 뒤 관리 화면에서는
     같은 등급의 카드들을 한 줄로 묶어 필요한 정보만 보여 준다. */
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
  /* 강화는 덱 속 개별 카드 한 장만 대상으로 삼는다.
     목록은 같은 종류를 묶되, 실제 강화는 그 묶음 안의 카드 한 장에만 적용한다. */
  function groupedUpgradeOptions(){
    return groupDeckCards(S.runDeck.filter(c=>upgradeLevel(c)<MAX_UPGRADE_LEVEL && !c.unupgradable));
  }
  /* +3부터는 같은 카드·같은 강화 단계 두 장을 녹여 한 단계 위 카드 한 장으로 만든다. */
  const MERGE_UPGRADE_START_LEVEL = 3;
  function upgradeNeedsMerge(cardOrGroup){
    const level = Number.isFinite(cardOrGroup.level) ? cardOrGroup.level : upgradeLevel(cardOrGroup);
    return level >= MERGE_UPGRADE_START_LEVEL;
  }
  function canUpgradeGroup(group){ return !upgradeNeedsMerge(group) || group.count >= 2; }
  function groupedFusionOptions(){
    return groupDeckCards(S.runDeck.filter(c=>!isEpicCard(c) && !isLegendaryCard(c)));
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
    if(c.type==='draw' || c.type==='foresight') c.draw = (c.draw||0)+1;
    if(c.type==='swap' || c.type==='reroll_intent') c.cost = Math.max(0, c.cost-1);
    /* +4 카드 두 장을 녹여 +5가 되는 순간, 평범한 기술은 심연의 에픽으로 변한다. */
    if(c.upgradeLevel===MAX_UPGRADE_LEVEL && !isLegendaryCard(c)){ c.epic=true; c.cost=1; }
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
    if(!applyUpgradeCard(c)) return null;
    if(material){
      const materialIdx = S.runDeck.findIndex(other=>other.defId===material.defId);
      if(materialIdx>=0) S.runDeck.splice(materialIdx, 1);
      S.logMsg = `${baseCardName(c)} +${upgradeLevel(c)-1} 두 장이 합쳐져 ${c.name}이(가) 되었다.`;
    }
    return c;
  }
  function activeFusionClassCards(){
    const presentClasses = new Set(S.party.filter(p=>p && p.alive).map(p=>p.cls));
    return FUSION_CLASS_CARD_POOL.filter(c=>presentClasses.has(c.owner));
  }
  function fusionResultCard(){
    if(Math.random() < EPIC_FUSION_CHANCE) return {base:pickEpicCard(), epic:true};
    const classCards = activeFusionClassCards();
    const pool = classCards.length && Math.random()<0.5 ? classCards : FUSION_CARD_POOL;
    return {base:pickOne(pool), epic:false};
  }
  function applyFusion(defIdA, defIdB){
    const ia = S.runDeck.findIndex(c=>c.defId===defIdA);
    const ib = S.runDeck.findIndex(c=>c.defId===defIdB);
    if(ia<0 || ib<0 || ia===ib) return null;
    const first = Math.max(ia,ib), second = Math.min(ia,ib);
    S.runDeck.splice(first,1);
    S.runDeck.splice(second,1);
    const result = fusionResultCard();
    const epic = result.epic;
    const base = result.base;
    const newCard = mkDeckCard(base, 'fused');
    S.runDeck.push(newCard);
    S.logMsg = epic ? '심연이 합성에 응답했다. 에픽 카드가 모습을 드러냈다.' : '두 카드가 하나로 융합되었다.';
    return newCard;
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
  function premiumRewardCard(allowLegendary){
    return allowLegendary && Math.random()<BOSS_LEGENDARY_CARD_CHANCE ? pickOne(LEGENDARY_CARD_POOL) : pickEpicCard();
  }
  function cardRewardOffer(node){
    const offer = shuffle(cardRewardPool().slice()).slice(0, CARD_REWARD_OFFER_SIZE);
    if(!offer.length) return offer;
    const rewardSlot = Math.floor(Math.random()*offer.length);
    if(node && node.boss){
      /* 구역 수문장은 에픽을 반드시 남긴다. 그중 5%는 전설로 바뀐다. */
      offer[rewardSlot] = premiumRewardCard(true);
    } else if(isBossTier(node) && Math.random()<ELITE_PREMIUM_CARD_CHANCE){
      /* 정예는 일반 보상(5%)의 두 배 확률로 에픽 이상의 카드를 남긴다. */
      offer[rewardSlot] = premiumRewardCard(true);
    } else if(Math.random()<EPIC_FUSION_CHANCE){
      offer[rewardSlot] = pickEpicCard();
    }
    return shuffle(offer);
  }
  function claimCardReward(index){
    const a = S.aftermath;
    const card = a && a.cardOffer && a.cardOffer[index];
    if(!card) return null;
    const added = addRunDeckCard(card, 'reward');
    if(!added) return null;
    a.cardTaken = added;
    a.cardOffer = null;
    S.logMsg = `${added.name} 카드가 덱에 추가되었다. (${S.runDeck.length}/${MAX_DECK_SIZE})`;
    if(isLegendaryCard(added)) a.reveal = {kind:'reward', card:added, legendaryAcquired:true};
    else if(isEpicCard(added)) a.reveal = {kind:'reward', card:added, epicAcquired:true};
    return added;
  }

