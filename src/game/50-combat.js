  /* 네루모르는 절반을 잃기 전까지 이름조차 허락하지 않는다.
     피가 흐른 뒤에야 이것이 심연의 눈이 아니라, 그 눈을 지키던 인간이었음이 드러난다. */
  function foeDisplayName(en){
    return en && en.hiddenName && en.hp > en.maxHp*0.5 ? en.hiddenName : en.name;
  }

  function pickOne(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  /* 가중 추첨 — [[무게, 값], ...] */
  function weighted(list){
    const pool = list.filter(p=>p[0] > 0);
    if(!pool.length) return list[0][1];
    let total = 0; pool.forEach(p=>{ total += p[0]; });
    let r = Math.random()*total;
    for(let i=0;i<pool.length;i++){ r -= pool[i][0]; if(r<=0) return pool[i][1]; }
    return pool[pool.length-1][1];
  }

  /* 이 열에서 실제로 손이 닿는 놈만 후보에 올린다 */
  function foePoolFor(tier){
    return tier==='끝없는 심연' ? FOE_SURFACE.concat(FOE_ELITES, FOE_ENDLESS) : FOE_SURFACE;
  }
  function foeCandidates(rank, tier){
    const pool = foePoolFor(tier);
    const ok = pool.filter(f => REACH[f.reach].from.indexOf(rank) >= 0);
    return ok.length ? ok : pool;
  }
  /* 머릿수가 늘면 개체는 약해진다 — 총 위협량을 대충 맞춰둔다 */
  function countScale(n){
    return n<=1 ? 1.35 : n===2 ? 1.0 : n===3 ? 0.78 : n===4 ? 0.62 : 0.50;
  }
  /* 얼마나 깊이 들어왔나 — 지나온 노드 수에 층 보정을 더한다 */
  function stageDepth(node){
    let d = S.mapVisited.length;
    if(node.tier === '중층') d += 2;
    else if(node.tier === '심해') d += 4;
    else if(node.tier === '끝없는 심연') d += 8;
    return d;
  }
  /* 깊어질수록 무리가 커진다. 얕은 곳은 2~3, 심층은 4~5가 기본이 된다.
     (실측 평균: 깊이0 ≈ 2.7마리 → 깊이4+ ≈ 4.2마리) */
  function rollFoeCount(depth, tier){
    if(tier==='끝없는 심연') return weighted([[3,4],[7,5]]);
    const d = Math.min(depth, 5);
    return weighted([
      [Math.max(0, 5 - d*2), 2],
      [4,                    3],
      [2 + d,                4],
      [Math.max(0, d*2 - 1), 5],
    ]);
  }

  function scaleFoeForTier(foe, node, packScale, leader){
    const threat = tierThreat(node.tier);
    const boss = leader && !!node.boss;
    const elite = leader && node.type==='elite';
    const hpRoleMul = boss ? threat.bossHp : elite ? threat.eliteHp : 1;
    const atkRoleMul = boss ? threat.bossAtk : elite ? threat.eliteAtk : 1;
    foe.maxHp = Math.max(8, Math.round(foe.maxHp * packScale * threat.hp * hpRoleMul));
    foe.atk = Math.max(1, Math.round(foe.atk * threat.atk * atkRoleMul));
    foe.pressureMul = threat.pressure;
    return foe;
  }
  function makeFoe(rank, scale, node){
    const base = Object.assign({}, pickOne(foeCandidates(rank, node.tier)));
    return scaleFoeForTier(base, node, scale, false);
  }

  function enemySetFor(node){
    const set = [];
    const depth = stageDepth(node);
    const endless = node.tier==='끝없는 심연';
    /* 우두머리 자체가 무겁다 — 수행원은 깊이에 따라 천천히만 는다 (총 4를 넘기지 않는다) */
    const escortsFor = () => Math.min(3, 1 + Math.floor(Math.random()*2) + Math.floor(depth/4));

    if(node.boss){
      set.push(scaleFoeForTier(Object.assign({}, endless ? FOE_ENDLESS_BOSS : FOE_BOSS), node, 1, true));
      const n = endless ? 3 : escortsFor();
      for(let r=1; r<=n; r++) set.push(makeFoe(r, endless ? 0.92 : 0.8, node));
      return set;
    }
    if(node.type==='elite'){
      const leaders = endless ? FOE_ELITES.concat(FOE_ENDLESS) : FOE_ELITES;
      set.push(scaleFoeForTier(Object.assign({}, pickOne(leaders)), node, 1, true));
      const n = endless ? 3 : escortsFor();
      for(let r=1; r<=n; r++) set.push(makeFoe(r, endless ? 0.95 : 0.8, node));
      return set;
    }
    const n = rollFoeCount(depth, node.tier);
    const scale = countScale(n) * (endless ? 1.22 : 1);
    for(let r=0; r<n; r++) set.push(makeFoe(r, scale, node));
    return set;
  }

  function handSize(){ return Math.min(HAND_LIMIT, 5 + relicSum('draw')); }

  function startBattle(node){
    const enemies = enemySetFor(node).map(e=>Object.assign({}, e, {hp:e.maxHp, block:0, intent:null, alive:true, react:null}));
    const ap = 3 + relicSum('ap');
    S.battle = {
      tier: node.tier, node, enemies,
      deck: cloneForBattle(S.runDeck), hand:[], discard:[],
      ap:ap, maxAp:ap, tempAp:0, turn:1, over:false, rareDraws:{}, rareUses:{},
      pendingCardUid:null, pendingDomain:null, pendingDraw:null,
    };
    S.party.forEach(p=>{ if(p) p.react = null; });
    aliveParty().forEach(p=>{
      const mend = relicSum('battleHeal', p);
      if(mend>0) p.hp = Math.min(p.maxHp, p.hp + mend);
    });
    fxQueue = [];
    clearLog();
    rollIntents();
    drawHand(handSize());
    S.logMsg = node.boss
      ? (node.tier==='끝없는 심연' ? '검은 수면 아래의 눈이 당신을 알아본다. 그 앞에 한 인간의 형체가 서 있다.' : '이곳의 꿈을 지키는 형체가 어둠 속에서 몸을 일으킨다.')
      : node.type==='elite' ? '유난히 거대한 형체가 앞장서 다가온다. 그것은 당신을 처음 보는 얼굴이 아니다.'
      : enemies.length>1 ? `어둠 속에서 ${enemies.length}개의 형체가 열을 이룬다. 모두 같은 박자로 숨을 쉰다.`
      : '어둠 속의 형체가 고개를 든다. 당신이 먼저 보았다고 믿게 만든다.';
    S.screen = 'battle';
  }

  /* 죽은 자는 열을 차지하지 않는다 — 앞이 쓰러지면 뒤가 당겨진다 (다키스트던전식) */
  function effRank(arr, idx){
    let r = 0;
    for(let i=0; i<idx; i++){ const u = arr[i]; if(u && u.alive) r++; }
    return r;
  }
  function heroRank(h){ return effRank(S.party, S.party.indexOf(h)); }
  function foeRank(en){ return effRank(S.battle.enemies, S.battle.enemies.indexOf(en)); }

  /* 이 적이 지금 닿을 수 있는 아군들 */
  function heroesInReach(en){
    const r = foeRank(en);
    if(!canActFrom(en, r)) return [];
    return S.party.filter(h => h && h.alive && canHitRank(en, heroRank(h)));
  }
  function pickHeroTarget(en){
    const pool = heroesInReach(en);
    if(!pool.length) return null;
    /* 원거리는 뒤를, 나머지는 앞을 노린다 */
    return en.reach==='ranged' ? pool[pool.length-1] : pool[0];
  }

  function pressureIntent(en, value){ return Math.max(1, Math.round(value * (en.pressureMul || 1))); }
  /* 적의 예고 행동 — 자기 열에서 실제로 할 수 있는 것만 고른다 */
  function pickIntent(en){
    const rank = foeRank(en);
    const roll = Math.random();
    const stuck = !canActFrom(en, rank) || heroesInReach(en).length===0;

    if(en.kind==='boss'){
      if(stuck) return {type:'guard_up', val:8, label:'웅크림', ic:IC_GUARD};
      if(en.phase===2){
        if(roll<0.34) return {type:'attack_reach', val:en.atk, label:'심연의 강타', ic:IC_CLEAVER};
        if(roll<0.60) return {type:'attack_all', val:Math.round(en.atk*0.7), label:'심연의 포효', ic:IC_ROAR};
        if(roll<0.82) return {type:'whisper_rear', val:pressureIntent(en,11), label:'심연의 응시', ic:IC_GAZE};
        return {type:'guard_up', val:10, label:'웅크림', ic:IC_GUARD};
      }
      if(roll<0.46) return {type:'attack_reach', val:en.atk, label:'대신관의 강타', ic:IC_CLEAVER};
      if(roll<0.78) return {type:'whisper_rear', val:pressureIntent(en,9), label:'심연의 응시', ic:IC_GAZE};
      return {type:'guard_up', val:8, label:'웅크림', ic:IC_GUARD};
    }

    /* 손이 닿지 않으면 자리를 고쳐 잡거나 속삭인다 */
    if(stuck){
      return roll<0.5
        ? {type:'guard_up', val:5, label:'웅크림', ic:IC_GUARD}
        : {type:'whisper_random', val:pressureIntent(en,6), label:'속삭임', ic:IC_GAZE};
    }

    return weighted(intentPool(en));
  }

  /* 역할별 예고 행동 표 — 같은 사거리라도 성향이 다르면 전혀 다르게 싸운다 */
  function intentPool(en){
    const a = en.atk;
    const hit = (v,l,ic)=>({type:'attack_reach', val:Math.max(1,Math.round(v)), label:l, ic:ic||IC_CLEAVER});
    const dbl = (v,l)=>({type:'double_attack_reach', val:Math.max(1,Math.round(v)), label:l, ic:IC_DOUBLE});
    const rear = (v,l)=>({type:'whisper_rear', val:pressureIntent(en,v), label:l, ic:IC_GAZE});
    const anyone = (v,l)=>({type:'whisper_random', val:pressureIntent(en,v), label:l, ic:IC_GAZE});
    const grd = (v)=>({type:'guard_up', val:Math.max(4,Math.round(v)), label:'웅크림', ic:IC_GUARD});
    const snipe = (v,l)=>({type:'snipe_lowest', val:Math.max(1,Math.round(v)), label:l, ic:IC_SNIPE});

    let list;
    switch(en.role){
      case 'brute':
        list = [[4, hit(a*1.75,'강타 예고',IC_HEAVY)], [3, hit(a,'내려찍기')], [1, grd(a*0.8)]]; break;
      case 'skirmisher':
        list = [[4, dbl(a*0.62,'연속 공격')], [3, hit(a,'베어물기')], [1, anyone(6,'속삭임')]]; break;
      case 'warden':
        list = [[4, grd(a*1.4)], [3, hit(a,'밀어붙이기')], [1, anyone(6,'속삭임')]]; break;
      case 'caster':
        list = [[4, rear(9,'심연의 응시')], [3, anyone(7,'속삭임')], [1, hit(a*0.8,'저주 발사',IC_SNIPE)]]; break;
      case 'sniper':
        list = [[4, snipe(a,'약자 저격')], [3, hit(a*0.9,'원거리 사격',IC_SNIPE)], [1, rear(8,'후열 응시')]]; break;
      default:
        list = [[1, hit(a,'공격')]];
    }

    /* 개체별 성향 — 역할표는 그대로 두고 특정 행동의 가중치만 배로 올린다.
       '느리지만 묵직'(웅크림 ×2)이나 '속삭임 빈도 높음'(×4) 같은 것이
       이름표로만 남지 않고 실제로 그렇게 싸우도록. */
    const mod = en.intentMod;
    if(mod){
      list = list.map(p => [p[0] * (mod[p[1].type] || 1), p[1]]);
      /* 역할표에 없는 행동은 새로 얹는다 — 지금은 전체 공격뿐이다 */
      if(mod.attack_all){
        list.push([mod.attack_all, {type:'attack_all', val:Math.max(1,Math.round(a*0.7)),
                                    label:'삼킨 종을 울린다', ic:IC_ROAR}]);
      }
    }
    return list;
  }
  function rollIntents(){ S.battle.enemies.forEach(en=>{ if(en.alive) en.intent = pickIntent(en); }); }

  /* 효과미상은 한 턴의 교란일 뿐, 덱 전체가 영구히 오염되지는 않는다. */
  const UNKNOWN_CARD_MAX_PER_TURN = 3;
  /* 중층의 기존 15% 빈도는 절반으로 낮춘다. 하지만 심해와 끝없는 심연에서는
     심연의 관측이 강해지므로 다시 가파르게 늘어난다. */
  const UNKNOWN_CARD_CHANCE = {'중층':0.075, '심해':0.12, '끝없는 심연':0.18};
  /* 되돌릴 수 없는 카드는 가리지 않는다. 비상 탈출은 무엇인지 모른 채 눌렀다가
     대원과 유물을 잃는 카드라, 교란의 재미가 아니라 사고가 된다. */
  function canBeContaminated(card){ return !!card && card.type !== 'emergency_escape'; }
  function drawNextBattleCard(){
    const b = S.battle;
    /* 한도에 닿은 희귀 카드는 버린 더미로 잠시 보내고 일반 카드를 계속 찾는다.
       덱이 희귀 카드만 남은 경우에는 빈 손패를 반환하며, 다음 전투에서 제한이 초기화된다. */
    let attempts = b.deck.length + b.discard.length;
    while(attempts-- > 0){
      if(b.deck.length===0){
        if(b.discard.length===0) return null;
        b.deck = shuffleBattleDeck(b.discard); b.discard=[];
      }
      const c = b.deck.pop();
      if(isRareBattleCard(c)){
        const counts = rareDrawCounts(b);
        const key = rareDrawKey(c);
        if((counts[key]||0) >= rareDrawLimit(c)){
          b.discard.push(c);
          continue;
        }
        /* 이미 써 본 카드는 쓴 횟수만큼 꺾인 확률을 통과해야 손에 들어온다 */
        const uses = rareUseCounts(b)[key] || 0;
        if(uses > 0 && Math.random() >= rareRedrawChance(uses)){
          b.discard.push(c);
          continue;
        }
        counts[key] = (counts[key]||0) + 1;
      }
      c.contaminated = false;
      const unknownCount = b.hand.filter(card=>card.contaminated).length;
      const unknownChance = UNKNOWN_CARD_CHANCE[b.tier] || 0;
      if(canBeContaminated(c) && unknownCount < UNKNOWN_CARD_MAX_PER_TURN && Math.random() < unknownChance) c.contaminated = true;
      return c;
    }
    return null;
  }
  function drawHand(n){
    const b = S.battle;
    if(!b || n<=0) return;
    if(b.pendingDraw){ b.pendingDraw.remaining += n; return; }
    for(let left=n;left>0;left--){
      const c = drawNextBattleCard();
      if(!c) break;
      if(b.hand.length>=HAND_LIMIT){
        b.pendingDraw = {card:c, remaining:left-1};
        return;
      }
      b.hand.push(c);
    }
  }
  function replaceForPendingDraw(handUid){
    const b = S.battle;
    if(!b || !b.pendingDraw) return false;
    const idx = b.hand.findIndex(c=>c.uid===handUid);
    if(idx<0) return false;
    const removed = b.hand[idx];
    const incoming = b.pendingDraw.card;
    const remaining = b.pendingDraw.remaining;
    b.hand.splice(idx,1, incoming);
    b.discard.push(removed);
    b.pendingDraw = null;
    pushLog(`${removed.name}을(를) 버리고 ${incoming.name}을(를) 받았다.`);
    drawHand(remaining);
    return true;
  }

  /* 로그가 화면 한복판으로 나왔으니 조사도 제대로 붙인다 — 받침 유무로 갈라준다 */
  function hasJong(s){
    if(!s) return false;
    const c = s.charCodeAt(s.length-1);
    if(c < 0xAC00 || c > 0xD7A3) return false;     /* 한글 음절이 아니면 판단 보류 */
    return (c - 0xAC00) % 28 !== 0;
  }
  function ga(n){ return n + (hasJong(n) ? '이' : '가'); }
  function eul(n){ return n + (hasJong(n) ? '을' : '를'); }

  /* 전투 로그 — 적이 여럿이면 한 턴에 여러 줄이 쏟아지므로 최근 3줄을 모아 보여준다 */
  function pushLog(msg){
    if(!msg) return;
    if(!S.logLines) S.logLines = [];
    S.logLines.push(msg);
    while(S.logLines.length > 3) S.logLines.shift();
    S.logMsg = msg;
  }
  function clearLog(){ S.logLines = []; }

  function aliveParty(){ return S.party.filter(p=>p && p.alive); }
  function rearTarget(){ const a=aliveParty(); return a.length? a[a.length-1] : null; }
  function lowestHpTarget(){ const a=aliveParty(); if(!a.length) return null; return a.reduce((x,p)=>p.hp<x.hp?p:x, a[0]); }

  /* ============ 피격 반응 ============
     맞는 쪽이 굴린다: 회피 → 흘려막기 → 그래도 맞으면 반격.
     반격은 자기 열에서 상대 열까지 손이 닿을 때만 나간다.
     반격에 대한 재반격은 없다 (무한 연쇄 방지). */
  function markReact(unit, kind){
    unit.react = {kind:kind};
  }
  /* 표식은 '방금 무슨 일이 있었는지'를 보여주므로, 턴 번호가 아니라 행동 단위로 지운다.
     적 턴에 아군이 피하거나 받아친 것은 그 판정이 끝난 뒤 턴 번호가 올라간 다음에야
     그려진다 — 턴을 대조해 지우면 아군 표식만 영영 뜨지 않았다.
     그래서 다음 행동(카드 사용·턴 종료)이 시작될 때 한 번에 걷는다. */
  function clearReacts(){
    const b = S.battle;
    if(!b) return;
    S.party.forEach(p=>{ if(p) p.react = null; });
    (b.enemies||[]).forEach(en=>{ if(en) en.react = null; });
  }
  function canRiposte(defender, defRank, attacker, atkRank){
    if(!attacker || !attacker.alive) return false;
    return canActFrom(defender, defRank) && canHitRank(defender, atkRank);
  }
  /* ============ 크리티컬 ============
     아주 드물게 한 방이 깊게 들어간다. 아군도 적도 같은 문을 지나므로 확률은 같다.
     배율은 1.5~3.0 을 굴리되 최종 피해는 원래의 두 배를 넘지 않는다 — 굴림의 폭은
     넓게 두고 천장만 낮춰, 터졌을 때 늘 아프되 한 방에 판이 뒤집히지는 않게 한다.
     회피한 공격은 애초에 닿지 않았으므로 굴리지 않는다. */
  const CRIT_CHANCE   = 0.008;   /* 1% 이하 */
  const CRIT_MULT_MIN = 1.5;
  const CRIT_MULT_MAX = 3.0;
  const CRIT_MULT_CAP = 2.0;
  function rollCritMultiplier(){
    if(Math.random() >= CRIT_CHANCE) return 1;
    return Math.min(CRIT_MULT_MIN + Math.random()*(CRIT_MULT_MAX-CRIT_MULT_MIN), CRIT_MULT_CAP);
  }

  /* 회피/흘림 판정 + 방어도 소모. 실제 체력 차감은 호출부에서 한다. */
  /* 결과에는 실제로 깎인 피해(dealt)뿐 아니라 '무엇을 면했는지'도 함께 담는다.
     회피로 통째로 피한 양(avoided), 흘림으로 깎아낸 양(reduced) — 화면에 그 수치를
     띄워 줘야 왜 체력이 예상만큼 줄지 않았는지가 읽힌다. */
  function resolveIncoming(defender, amount){
    const rc = reactOf(defender);
    if(Math.random() < rc.dodge){
      markReact(defender, 'dodge');
      return {dealt:0, kind:'dodge', avoided:amount, reduced:0, crit:false};
    }
    let dmg = amount;
    let kind = 'hit';
    let reduced = 0;
    /* 크리티컬은 흘림·방어보다 먼저 부풀린다 — 깊게 들어간 한 방을 그 뒤에 막아 내는 순서다 */
    const critMult = rollCritMultiplier();
    const crit = critMult > 1;
    if(crit) dmg = Math.max(1, Math.round(dmg * critMult));
    if(Math.random() < rc.guard){
      const halved = Math.max(1, Math.round(dmg*0.5));
      reduced = dmg - halved;
      dmg = halved;
      markReact(defender, 'guard');
      kind = 'guard';
    }
    if(defender.block > 0){
      const absorbed = Math.min(defender.block, dmg);
      defender.block -= absorbed;
      dmg -= absorbed;
    }
    return {dealt:dmg, kind:kind, avoided:0, reduced:reduced, crit:crit};
  }

  /* 전사한 전문가는 자신이 다루던 기술도 함께 잃는다.
     합성·강화 카드는 owner 값으로 병과를 보존하므로 같은 경로로 모두 제거된다. */
  function purgeDeadClassCards(hero){
    if(!hero || !hero.cls || !S || S.prologue) return;
    const cls = hero.cls;
    const before = S.runDeck.length;
    S.runDeck = S.runDeck.filter(c=>c.owner!==cls);
    if(S.setup && S.setup.picks) delete S.setup.picks[cls];

    const b = S.battle;
    if(b){
      ['deck','hand','discard'].forEach(zone=>{
        b[zone] = (b[zone]||[]).filter(c=>c.owner!==cls);
      });
      if(b.pendingCardUid && !b.hand.some(c=>c.uid===b.pendingCardUid)){
        b.pendingCardUid = null;
        b.pendingDomain = null;
      }
    }
    if(before>S.runDeck.length) pushLog(`${hero.name}의 카드가 심연에 잠겼다.`);
  }

  function applyDamageToHero(hero, amount, opts){
    opts = opts || {};
    const stress = opts.stress!==false;
    const attacker = opts.from || null;
    if((hero.invulnerableTurns||0) > 0){
      queueFx('guard', hero);
      pushLog(`${ga(hero.name)} 침몰한 성궤의 보호를 받아 피해를 무시한다.`);
      return {dealt:0, kind:'invulnerable'};
    }
    /* 정신이 함몰되면 몸도 함께 무너진다. 방어·흘림 판정 전에 원피해가 50% 늘어난다. */
    if(hero.collapsed) amount = Math.round(amount * 1.5);
    const res = resolveIncoming(hero, amount);

    if(res.kind==='dodge'){
      queueFx('dodge', hero, res.avoided);
      pushLog(`${ga(hero.name)} 몸을 비틀어 피했다.`);
      triggerBulwarkRiposte(hero, attacker, opts);
      return res;
    }
    hero.hp = Math.max(0, hero.hp - res.dealt);
    if(res.dealt>0){
      flash('red');
      queueFx('impact', hero, res.dealt, res.crit);
      if(res.crit) pushLog(`급소를 찔렸다 — ${hero.name}이(가) 치명타로 ${res.dealt} 피해.`);
      if(stress) addDp(hero, 4);
    }
    if(res.kind==='guard'){ queueFx('guard', hero, res.reduced); pushLog(`${ga(hero.name)} 흘려 막았다. (${res.dealt} 피해)`); }
    if(hero.hp<=0 && hero.alive){
      hero.alive = false;
      purgeDeadClassCards(hero);
      queueFx('death', hero);
    }
    checkCollapse(hero);

    if(triggerBulwarkRiposte(hero, attacker, opts)) return res;

    if(hero.alive && opts.riposte!==false && canRiposte(hero, heroRank(hero), attacker, foeRank(attacker))
       && Math.random() < reactOf(hero).riposte){
      const rip = reactOf(hero).rip;
      markReact(hero, 'riposte');
      queueFx('riposte', hero, rip);
      /* 반격 선언 뒤의 회피·흘림 결과가 마지막 줄에 남도록 한다. */
      pushLog(`${ga(hero.name)} 곧바로 받아친다. (반격 ${rip})`);
      damageEnemy(attacker, rip, {riposte:true});
    }
    return res;
  }
  /* 침수된 방벽은 일반 반격과 달리 거리·확률을 묻지 않는다. 적이 공격을 선언한
     순간 벽에 닿아 되튄다. 반격끼리 되받아치는 무한 연쇄는 기존 규칙처럼 막는다. */
  function triggerBulwarkRiposte(hero, attacker, opts){
    const rip = hero && hero.bulwarkRiposte || 0;
    if(!rip || !hero.alive || !attacker || !attacker.alive || opts.riposte===false) return false;
    markReact(hero, 'riposte');
    queueFx('riposte', hero, rip);
    pushLog(`${ga(hero.name)} 침수된 방벽을 되울린다. (${rip} 반격)`);
    damageEnemy(attacker, rip, {riposte:true});
    return true;
  }
  /* 심도압박은 항상 0~100의 정수로 유지한다. 유물의 백분율 배율이 소수점을 만들 수 있다. */
  function setDp(hero, value){
    const safeValue = Number.isFinite(value) ? value : 0;
    hero.dp = Math.round(Math.max(0, Math.min(100, safeValue)));
    return hero.dp;
  }
  /* 심도압박 상승은 전부 이 문을 지난다 — 유물로 무뎌지는 지점이 한 곳뿐이도록 */
  function addDp(hero, amount){
    setDp(hero, hero.dp + amount * relicMul('dpMul', hero));
  }
  function checkCollapse(hero){
    if(hero.dp>=100 && !hero.collapsed){
      hero.collapsed = true; setDp(hero, 70);
      pushLog(`${hero.name}의 정신이 함몰됐다. 가하는 피해 -50% · 받는 피해 +50%.`);
    }
  }
  function damageEnemy(en, dmg, opts){
    opts = opts || {};
    flash('white');
    const res = resolveIncoming(en, dmg);
    if(res.kind==='dodge'){
      queueFx('dodge', en, res.avoided);
      pushLog(`${ga(foeDisplayName(en))} 미끄러지듯 피한다.`);
      return null;
    }
    en.hp = Math.max(0, en.hp - res.dealt);
    if(res.dealt>0){
      queueFx('impact', en, res.dealt, res.crit);
      if(res.crit) pushLog(`급소를 꿰뚫었다 — ${foeDisplayName(en)}에게 치명타로 ${res.dealt} 피해.`);
    }
    if(res.kind==='guard'){
      queueFx('guard', en, res.reduced);
      pushLog(`${ga(foeDisplayName(en))} 몸을 틀어 흘려낸다. (${res.dealt} 피해)`);
    }

    if(en.hp<=0){
      en.alive = false;
      queueFx('death', en);
    } else if(en.kind==='boss' && en.phase===1 && en.hp <= en.maxHp*0.5){
      en.phase = 2;
      en.atk = Math.round(en.atk*1.2);
      en.block = Math.max(en.block, 6);
      en.intent = pickIntent(en);
      pushLog(en.hiddenName
        ? `${en.name}의 흉부가 열리며 단안이 당신을 향한다. 그것은 심연이 아니라, 심연을 지키던 인간이었다...!`
        : `${ga(en.name)} 진짜 모습을 드러낸다...!`);
    }

    const hero = opts.from || null;
    if(en.alive && !opts.riposte && hero && hero.alive
       && canRiposte(en, foeRank(en), hero, heroRank(hero))
       && Math.random() < reactOf(en).riposte){
      const rip = reactOf(en).rip;
      markReact(en, 'riposte');
      queueFx('riposte', en, rip);
      pushLog(`${ga(foeDisplayName(en))} 이빨을 드러내며 받아친다. (반격 ${rip})`);
      applyDamageToHero(hero, rip, {stress:false, riposte:false});
    }
    return res;
  }

  function isEliteEnemy(en){
    const b = S && S.battle;
    return !!(en && (en.kind==='elite' || (b && b.node && b.node.type==='elite' && b.enemies[0]===en)));
  }
  /* 섬멸은 피해가 아니라 제거다. 회피·흘림·방어와 반격을 거치지 않는다. */
  function annihilateEnemy(en){
    if(!en || !en.alive) return false;
    en.hp = 0;
    en.block = 0;
    en.alive = false;
    queueFx('death', en);
    return true;
  }

  function isAttackCard(card){
    return card.type==='attack' || card.type==='fusion_attack' || card.type==='epic_attack' ||
      card.type==='drowned_sentence' || card.type==='abyssal_verdict' || card.type==='thousand_maws_tide' ||
      card.type==='reroll_intent';
  }
  function ownerOf(card){ return S.party.find(p=>p && p.id===card.owner) || null; }

  /* 이 카드가 지금 실제로 닿을 수 있는 적들 */
  function enemyTargetsFor(card){
    const b = S.battle;
    if(!b) return [];
    /* 합성 공격은 특정 병과가 휘두르는 무기가 아니라, 합성으로 부른 심연 그 자체다. */
    if(card.type==='abyssal_verdict') return b.enemies.filter(e=>e.alive && e.kind!=='boss');
    if(card.type==='fusion_attack' || card.type==='epic_attack' || card.type==='drowned_sentence' || card.type==='thousand_maws_tide' || (card.type==='reroll_intent' && card.owner==='neutral')) return b.enemies.filter(e=>e.alive);
    const owner = ownerOf(card);
    if(!owner || !owner.alive) return [];
    if(!canActFrom(owner, heroRank(owner))) return [];
    return b.enemies.filter(e => e.alive && canHitRank(owner, foeRank(e)));
  }

  /* 못 내는 이유를 문장으로 — 카드에 그대로 찍어 보여준다 */
  function cardBlockReason(card){
    if(!isAttackCard(card)) return null;
    if(card.type==='fusion_attack' || card.type==='epic_attack' || card.type==='drowned_sentence' || card.type==='abyssal_verdict' || card.type==='thousand_maws_tide' || (card.type==='reroll_intent' && card.owner==='neutral')) return null;
    const owner = ownerOf(card);
    if(!owner || !owner.alive) return '시전자가 없다';
    const oRank = heroRank(owner);
    if(!canActFrom(owner, oRank)) return `${reachOf(owner).label} 병과는 ${rankName(oRank)}에서 못 친다`;
    if(!enemyTargetsFor(card).length) return '닿는 적이 없다';
    return null;
  }

  function canPlayCard(card){
    const b = S.battle;
    if(!b || b.over) return false;
    if(b.pendingDraw) return false;
    /* 프롤로그에서는 지금 배울 한 장만 켠다. 다른 카드로 우연히 넘기지 못하게 한다. */
    if(S.prologue){
      const step = S.prologue.stage;
      if(step==='brace' && card.name!=='놋쇠 벽') return false;
      if(step==='strike' && card.name!=='저주받은 조준') return false;
      if(step==='pressure' && card.name!=='속죄의 기도') return false;
      if(step!=='brace' && step!=='strike' && step!=='pressure') return false;
    }
    if(b.pendingCardUid && b.pendingCardUid!==card.uid) return false;
    if(b.ap + (b.tempAp||0) < card.cost) return false;
    if(cardBlockReason(card)) return false;
    return true;
  }

  function beginTargeting(cardUid, domain){ S.battle.pendingCardUid=cardUid; S.battle.pendingDomain=domain; }
  function cancelTargeting(){ if(S.battle){ S.battle.pendingCardUid=null; S.battle.pendingDomain=null; } }

  function resolveCard(cardUidVal, targetInfo){
    const b = S.battle;
    if(!b || b.over) return;
    const idx = b.hand.findIndex(c=>c.uid===cardUidVal);
    if(idx===-1) return;
    const card = b.hand[idx];
    if(!canPlayCard(card)) return;

    flyOutCard(cardUidVal);   /* 손패가 아직 그대로일 때 떠 둔다 */
    clearReacts();   /* 지난 행동의 표식을 걷고, 이 카드가 만든 것만 남긴다 */
    cancelTargeting();
    clearLog();
    /* 임시 AP 는 이 턴이 지나면 사라진다 — 먼저 쓴다 */
    let cost = card.cost;
    const fromTemp = Math.min(b.tempAp||0, cost);
    b.tempAp = (b.tempAp||0) - fromTemp;
    b.ap -= (cost - fromTemp);
    b.hand.splice(idx,1);
    b.discard.push(card);
    card.contaminated = false;
    noteRareCardUsed(card);   /* 다음부터 이 카드가 돌아올 확률이 꺾인다 */

    const owner = ownerOf(card);
    const reachable = enemyTargetsFor(card);

    /* 사거리 밖은 애초에 후보에 없다 */
    let enemyTarget = null;
    if(card.range==='melee' || card.range==='ranged'){
      if(card.range==='ranged' && targetInfo && targetInfo.enemyIdx!=null){
        const t = b.enemies[targetInfo.enemyIdx];
        if(t && reachable.indexOf(t)>=0) enemyTarget = t;
      }
      if(!enemyTarget) enemyTarget = reachable[0] || null;
    }

    let allyTarget = null;
    if(card.range==='support_ally'){
      if(targetInfo && targetInfo.allyId){ allyTarget = S.party.find(p=>p && p.id===targetInfo.allyId && p.alive) || null; }
      if(!allyTarget) allyTarget = lowestHpTarget();
    }

    /* 제 정신을 깎아 쓰는 카드는 공격만이 아니다 — 종류를 가리지 않고 먼저 치른다 */
    if(card.selfDp && owner && owner.alive){ addDp(owner, card.selfDp); checkCollapse(owner); }

    switch(card.type){
      case 'attack':
      case 'fusion_attack':
      case 'epic_attack': {
        let dmg = Math.round(card.dmg * relicMul('dmgMul', owner));
        if(owner && owner.collapsed) dmg = Math.round(dmg*0.5);
        if(card.range==='aoe'){
          /* 선언은 먼저, 회피·흘림·각성 같은 실제 결과는 처리 직후 뒤에 남긴다. */
          pushLog(`${card.name} — 닿는 적 ${reachable.length}체에게 ${dmg} 피해.`);
          reachable.slice().forEach(en=>damageEnemy(en, dmg, {from:owner}));
        } else if(enemyTarget){
          pushLog(`${card.name} — ${foeDisplayName(enemyTarget)}에게 ${dmg} 피해.`);
          damageEnemy(enemyTarget, dmg, {from:owner});
          if(card.selfBlock && owner && owner.alive) owner.block += card.selfBlock;
        }
        break;
      }
      case 'drowned_sentence': {
        if(enemyTarget){
          const dmg = Math.round(card.dmg * relicMul('dmgMul', owner));
          const splash = Math.max(1, Math.round(dmg * card.splashRatio));
          const targetIndex = b.enemies.indexOf(enemyTarget);
          pushLog(`${card.name} — ${foeDisplayName(enemyTarget)}에게 ${dmg} 피해, 양옆에 ${splash} 파문 피해.`);
          damageEnemy(enemyTarget, dmg, {from:owner});
          [targetIndex-1, targetIndex+1].forEach(i=>{
            const side = b.enemies[i];
            if(side && side.alive) damageEnemy(side, splash, {from:owner});
          });
        }
        break;
      }
      case 'block': { if(owner&&owner.alive){ owner.block+=Math.round(card.block*relicMul('blockMul', owner)); pushLog(`${owner.name}이 방어 태세를 취한다.`); } break; }
      case 'block_party': {
        aliveParty().forEach(p=>{
          const grantedBlock = Math.round(card.block*relicMul('blockMul', p));
          p.block += grantedBlock;
          if(card.riposteRatio) p.bulwarkRiposte = Math.max(p.bulwarkRiposte||0, Math.round(grantedBlock*card.riposteRatio));
          else if(card.riposte) p.bulwarkRiposte = Math.max(p.bulwarkRiposte||0, card.riposte);
        });
        const riposte = card.riposteRatio ? Math.round(card.block*card.riposteRatio) : card.riposte;
        pushLog(riposte ? `파티 전체가 방벽을 세운다. 다음 공격은 ${riposte} 반격한다.` : '파티 전체가 대비한다.');
        break;
      }
      case 'heal': { if(allyTarget){ allyTarget.hp=Math.min(allyTarget.maxHp, allyTarget.hp+Math.round(card.heal*relicMul('healMul', allyTarget))); queueFx('heal', allyTarget); pushLog(`${allyTarget.name}의 상처를 봉합했다.`); } break; }
      case 'heal_party': { aliveParty().forEach(p=>{ p.hp=Math.min(p.maxHp,p.hp+Math.round(card.heal*relicMul('healMul', p))); queueFx('heal',p); }); pushLog('파티 전체의 상처를 봉합했다.'); break; }
      case 'calm': { if(allyTarget){ setDp(allyTarget, allyTarget.dp-card.calm); queueFx('calm', allyTarget); pushLog(`${allyTarget.name}이 숨을 고른다.`); } break; }
      case 'calm_party': { aliveParty().forEach(p=>{ setDp(p, p.dp-card.calm); queueFx('calm', p); }); pushLog('파티 전체가 진정된다.'); break; }
      case 'fuse_support': { if(allyTarget){ allyTarget.hp=Math.min(allyTarget.maxHp, allyTarget.hp+Math.round(card.heal*relicMul('healMul', allyTarget))); setDp(allyTarget, allyTarget.dp-card.calm); queueFx('heal', allyTarget); pushLog(`${allyTarget.name}이 정화와 회복을 동시에 받는다.`); } break; }
      case 'nameless_hymn': {
        const cleared = aliveParty().reduce((sum,p)=>sum+(p.dp||0),0);
        aliveParty().forEach(p=>{ setDp(p, 0); queueFx('calm', p); });
        const dmg = Math.floor(cleared/3);
        if(dmg>0) reachable.slice().forEach(en=>damageEnemy(en, dmg, {from:owner}));
        pushLog(`${card.name} — 심도압박 ${cleared}을 지우고, 모든 적에게 ${dmg} 피해.`);
        break;
      }
      case 'saints_last_prayer': {
        const regenPerTurn = Math.floor(card.regenTotal/card.regenTurns);
        aliveParty().forEach(p=>{
          const immediate = Math.round(p.maxHp*card.healRatio*relicMul('healMul', p));
          p.hp = Math.min(p.maxHp, p.hp+immediate);
          p.saintRegen = {amount:regenPerTurn, remaining:card.regenTotal-(regenPerTurn*card.regenTurns), turns:card.regenTurns};
          queueFx('heal', p);
        });
        pushLog(`${card.name} — 파티 전체가 최대 체력의 50%를 회복하고 3턴 동안 총 ${card.regenTotal}을 더 회복한다.`);
        break;
      }
      case 'sunken_ark': {
        const arkTurns = card.turns || 1;
        aliveParty().forEach(p=>{ p.invulnerableTurns = Math.max(p.invulnerableTurns||0, arkTurns); queueFx('guard', p); });
        pushLog(`${card.name} — 다가오는 적 턴 ${arkTurns}회 동안 파티 전체가 무적이 된다.`);
        break;
      }
      case 'thousand_maws_tide': {
        const targetIndex = enemyTarget ? b.enemies.indexOf(enemyTarget) : -1;
        const victims = [targetIndex-1,targetIndex+1].map(i=>b.enemies[i]).filter(en=>en && en.alive && en.kind!=='boss' && !isEliteEnemy(en));
        victims.forEach(annihilateEnemy);
        pushLog(victims.length ? `${card.name} — ${victims.map(foeDisplayName).join(' · ')}을(를) 파도 아래로 섬멸했다.` : `${card.name} — 섬멸할 일반 적이 양옆에 없다.`);
        break;
      }
      case 'abyssal_verdict': {
        if(enemyTarget && enemyTarget.kind!=='boss'){
          const name = foeDisplayName(enemyTarget);
          annihilateEnemy(enemyTarget);
          pushLog(`${card.name} — ${name}을(를) 심연으로 섬멸했다.`);
        }
        break;
      }
      case 'double_ap': {
        const usable = Math.max(0, b.ap + (b.tempAp||0));
        b.ap = usable * 2; b.tempAp = 0;
        pushLog(`태양 없는 정오 — 이 턴에 쓸 수 있는 AP가 ${usable}에서 ${b.ap}(으)로 늘었다.`);
        break;
      }
      case 'legendary_sanctuary': {
        aliveParty().forEach(p=>{
          p.hp=Math.min(p.maxHp,p.hp+Math.round(card.heal*relicMul('healMul', p)));
          setDp(p, p.dp-card.calm);
          p.block+=Math.round(card.block*relicMul('blockMul', p));
          queueFx('heal',p); queueFx('calm',p);
        });
        pushLog('마지막 잠수종이 닫히며 인양대 전체를 감싼다.');
        break;
      }
      case 'emergency_escape': { attemptEmergencyEscape(); return; }
      case 'draw': { drawHand(card.draw); pushLog('카드를 더 끌어온다.'); break; }
      case 'foresight': { drawHand(card.draw); if(owner&&owner.alive){ setDp(owner, owner.dp-card.calm); } pushLog('마음을 가라앉히며 앞일을 살핀다.'); break; }
      case 'reroll_intent': { if(enemyTarget){ enemyTarget.intent = pickIntent(enemyTarget); pushLog(`${foeDisplayName(enemyTarget)}의 운명이 뒤틀린다.`); } break; }
      case 'swap': {
        if(allyTarget){
          const targetIdx = S.party.indexOf(allyTarget);
          if(targetIdx > 0){ const t=S.party[0]; S.party[0]=S.party[targetIdx]; S.party[targetIdx]=t; pushLog(`${ga(allyTarget.name)} 전열로 나선다.`); }
          else if(targetIdx===0 && S.party.length>1){ const t=S.party[0]; S.party[0]=S.party[1]; S.party[1]=t; pushLog('전열과 중열이 자리를 바꾼다.'); }
        }
        break;
      }
    }
    /* 자리가 바뀌면 사거리가 바뀌므로 예고를 다시 계산한다 */
    if(card.type==='swap') rollIntents();

    if(S.prologue && S.prologue.stage==='brace' && card.name==='놋쇠 벽'){
      S.prologue.stage = 'braceDone';
      pushLog('방어가 피해보다 먼저 닳는다. 이제 예고된 공격을 받아 보자.');
    }
    if(S.prologue && S.prologue.stage==='strike' && card.name==='저주받은 조준'){
      S.prologue.stage = 'pressure';
      /* 잠식(전투 바깥의 귀환 제한)과 심도압박(개인 상태)을 섞지 않는다.
         조준의 대가가 지도 제작자 개인의 게이지에 남도록 눈에 보이는 값으로 고정한다. */
      const oracle = S.party.find(p=>p.cls==='oracle');
      if(oracle) setDp(oracle, Math.max(oracle.dp, 42));
      b.hand = prologueHandForCalm();
      pushLog('힘을 빌린 대가로 심도압박이 올랐다. 사제의 기도로 이를 가라앉힐 수 있다.');
    }
    if(S.prologue && S.prologue.stage==='pressure' && card.name==='속죄의 기도'){
      S.prologue.stage = 'abyss';
      pushLog('심도압박은 방어로 막을 수 없지만, 진정 카드로 되돌릴 수 있다.');
    }

    if(b.enemies.every(e=>!e.alive)){ winBattle(); }
    render();
  }

  function executeEnemyTurn(){
    const b = S.battle;
    if(!b || b.over) return;
    clearLog();
    b.enemies.forEach(en=>{
      if(!en.alive) return;
      en.block = 0;
      const intent = en.intent;
      if(!intent) return;

      if(intent.type==='attack_reach'){
        const t = pickHeroTarget(en);
        if(t){
          pushLog(`${ga(foeDisplayName(en))} ${rankName(heroRank(t))}의 ${eul(t.name)} 노린다. (${intent.val})`);
          applyDamageToHero(t, intent.val, {from:en});
        } else pushLog(`${ga(foeDisplayName(en))} 허공을 할퀸다 — 닿지 않는다.`);

      } else if(intent.type==='double_attack_reach'){
        const t = pickHeroTarget(en);
        if(t){
          pushLog(`${ga(foeDisplayName(en))} ${eul(t.name)} 두 번 후려친다.`);
          applyDamageToHero(t, intent.val, {from:en});
          if(t.alive && en.alive) applyDamageToHero(t, intent.val, {from:en});
        } else pushLog(`${ga(foeDisplayName(en))} 헛손질한다.`);

      } else if(intent.type==='attack_all'){
        const pool = heroesInReach(en);
        if(pool.length){
          pushLog(`${ga(foeDisplayName(en))} 닿는 모두를 집어삼킨다. (전체 ${intent.val})`);
          pool.forEach(p=>{ if(en.alive && p.alive) applyDamageToHero(p, intent.val, {from:en}); });
        } else pushLog(`${foeDisplayName(en)}의 포효가 빈 물살을 때린다.`);

      } else if(intent.type==='whisper_random'){
        const alive = aliveParty();
        if(alive.length){
          const t = alive[Math.floor(Math.random()*alive.length)];
          pushLog(`무언가 ${t.name}의 귀에 속삭인다. (심도압박 +${intent.val})`);
          addDp(t, intent.val); checkCollapse(t);
        }

      } else if(intent.type==='whisper_rear'){
        const t = rearTarget();
        if(t){
          pushLog(`${ga(foeDisplayName(en))} 후미의 ${t.name}에게 속삭인다. (심도압박 +${intent.val})`);
          addDp(t, intent.val); checkCollapse(t);
        }

      } else if(intent.type==='snipe_lowest'){
        const pool = heroesInReach(en);
        if(pool.length){
          const t = pool.reduce((x,p)=> p.hp<x.hp ? p : x, pool[0]);
          pushLog(`${ga(foeDisplayName(en))} 가장 약한 ${eul(t.name)} 저격한다. (${intent.val})`);
          applyDamageToHero(t, intent.val, {stress:false, from:en});
        } else pushLog(`${ga(foeDisplayName(en))} 겨눌 표적을 찾지 못한다.`);

      } else if(intent.type==='guard_up'){
        en.block += intent.val;
        pushLog(`${ga(foeDisplayName(en))} 몸을 웅크린다. (방어 +${intent.val})`);
      }
    });
    /* 아군의 반격으로 마지막 적이 쓰러질 수 있다.
       전멸 확인을 아군 쪽만 하면, 적이 다 죽었는데 전투가 끝나지 않고
       빈 대열을 마주한 채 턴만 넘어간다. */
    if(checkPartyWipe()) return;
    if(b.enemies.every(e=>!e.alive)) winBattle();
  }

  function checkPartyWipe(){
    if(aliveParty().length===0){ triggerGameOver('파티 전원이 심연에 잠겼다.'); return true; }
    return false;
  }
  function triggerGameOver(reason){
    clearRun();
    S.loseReason = reason;
    if(S.battle) S.battle.over = true;
    S.screen = 'gameover';
  }
  const EMERGENCY_ESCAPE_CHANCE = {'표층':1, '중층':0.8, '심해':0.5, '끝없는 심연':0.1};
  function emergencyEscapeChance(tier){ return EMERGENCY_ESCAPE_CHANCE[tier] || 0.1; }
  /* 비상 탈출은 패배 판정이 아니라 버릴 수 있는 마지막 선택지다.
     조건·확률에 막히면 카드는 이미 소모되지만, 전투와 인양대는 그대로 남는다. */
  function failEmergencyEscape(reason){
    S.logMsg = reason;
    pushLog(reason);
    render();
    return false;
  }
  function attemptEmergencyEscape(){
    const b = S.battle;
    if(!b || b.over) return false;
    const badlyWounded = S.party.filter(p=>p && p.hp<=p.maxHp*0.5);
    if(badlyWounded.length>=2){
      return failEmergencyEscape('비상 탈출 실패 — 체력이 절반 이하인 대원이 둘 이상이다. 인양줄을 놓쳤다.');
    }
    const evacuees = S.party.filter(p=>p && p.alive && p.dp<50);
    if(!evacuees.length){
      return failEmergencyEscape('비상 탈출 실패 — 심도압박 50 미만인 대원이 없다. 누구도 인양줄을 붙잡지 못했다.');
    }
    const chance = emergencyEscapeChance(b.tier);
    if(Math.random()>=chance){
      return failEmergencyEscape(`${b.tier}의 수압이 인양줄을 끊었다. 비상 탈출에 실패했다. (성공 확률 ${Math.round(chance*100)}%)`);
    }
    b.over = true;
    const leftBehind = S.party.filter(p=>p && evacuees.indexOf(p)<0);
    const keptRelic = S.relics.length===1 ? S.relics[0] : null;
    S.emergencyExit = {tier:b.tier, chance:chance, evacuees:evacuees, leftBehind:leftBehind, keptRelic:keptRelic};
    /* 탐색 기록은 지우지 않는다 — 인양줄로 빠져나오는 것은 이 전투 하나뿐이다 */
    S.screen = 'emergencyExit';
    render();
    return true;
  }
  /* 비상 탈출은 탐색을 끝내지 않는다. 이 전투에서만 빠져나와 지도의 그 자리로
     돌아가고, 하던 탐색을 그대로 이어간다. 대신 값은 그 자리에서 치른다 —
     인양줄을 붙잡지 못한 사람은 두고 오고, 유물도 하나만 건져 올린다.
     두고 온 자리는 여관에서 새 사람을 앉히는 빈자리가 된다. */
  function finishEmergencyEscape(){
    const ex = S.emergencyExit;
    if(!ex) return;
    (ex.leftBehind || []).forEach(p=>{
      if(!p || !p.alive) return;
      p.alive = false;
      p.block = 0;
      purgeDeadClassCards(p);
    });
    S.emergencyExit = null;
    S.battle = null;
    /* 노드는 끝내지 않았다 — 지도로 돌아가면 그 갈림길 앞에 다시 선다 */
    S.pendingNode = null;
    S.screen = 'map';
  }

  function resolvePartyTurnEffects(){
    const healed = [];
    aliveParty().forEach(p=>{
      const regen = p.saintRegen;
      if(regen && regen.turns>0){
        const amount = regen.amount + (regen.remaining>0 ? 1 : 0);
        if(regen.remaining>0) regen.remaining--;
        regen.turns--;
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp+amount);
        if(p.hp>before){ queueFx('heal', p); healed.push(`${p.name} +${p.hp-before}`); }
        if(regen.turns<=0) delete p.saintRegen;
      }
      if((p.invulnerableTurns||0)>0) p.invulnerableTurns--;
    });
    if(healed.length) pushLog(`성자의 마지막 기도의 여운 — ${healed.join(' · ')}`);
  }

  function endPlayerTurn(){
    const b = S.battle;
    if(!b || b.over || b.pendingCardUid || b.pendingDraw) return;
    if(S.prologue && S.prologue.stage!=='braceDone') return;
    clearReacts();   /* 적 턴에 생길 표식만 남도록 먼저 걷는다 */
    b.hand.forEach(c=>{ c.contaminated = false; });
    b.discard.push(...b.hand); b.hand=[];

    executeEnemyTurn();
    /* 침수된 방벽의 강제 반격은 이 적 턴에만 유지된다. */
    S.party.forEach(p=>{ if(p) p.bulwarkRiposte = 0; });
    if(b.over){ render(); return; }
    resolvePartyTurnEffects();

    if(S.prologue && S.prologue.stage==='braceDone'){
      /* 이 한 턴은 잠식과 심도압박이 모두 보이도록 고정한다. */
      S.erosion = Math.min(100, S.erosion + 15);
      /* 놋쇠 벽(1 AP)을 쓰고 남긴 2 AP를 직접 보여준다. 다음 턴에는
         반투명 임시 AP 한 칸이 추가되어, 이월 규칙을 전투판에서 확인할 수 있다. */
      const carry = b.ap >= TEMP_AP_MIN ? TEMP_AP_CARRY : 0;
      b.turn = 2; b.ap = b.maxAp; b.tempAp = carry;
      b.hand = prologueHandForStrike();
      b.enemies[0].intent = {type:'attack_reach', val:14, label:'심연의 강타', ic:IC_HEAVY};
      b.enemies[1].intent = {type:'whisper_rear', val:10, label:'속삭임', ic:IC_GAZE};
      S.prologue.stage = 'strike';
      pushLog(carry ? 'AP를 2개 남겨 임시 AP +1을 얻었다. 반투명한 눈금은 이번 턴에만 쓸 수 있다.' : '잠식이 차오른다. 원거리 적은 후미의 정신을 노린다.');
      render();
      return;
    }

    const rise = b.tier==='중층' ? 2 : (b.node && b.node.type==='elite' ? 1 : 0);
    if(rise>0){ aliveParty().forEach(p=>{ addDp(p, rise); checkCollapse(p); }); }

    const maxed = addErosion(erosionRate());
    if(checkPartyWipe()){ render(); return; }
    if(maxed){ triggerGameOver('잠식이 한계에 다다랐다. 돌아갈 길이 사라졌다.'); render(); return; }

    aliveParty().forEach(p=>p.block=0);
    /* 정규 AP를 둘 이상 남겨도 보존되는 것은 한 칸뿐이다. 임시 AP 자체는 다시
       넘기지 않아, 행동력이 끝없이 쌓이지 않는다. */
    const carry = b.ap >= TEMP_AP_MIN ? TEMP_AP_CARRY : 0;
    b.turn += 1;
    b.ap = b.maxAp;
    b.tempAp = carry;
    rollIntents();
    drawHand(handSize());
    render();
  }

  function winBattle(){
    /* 반격으로 끝난 전투도 일반 공격으로 끝난 전투와 같은 경로를 탄다.
       이미 끝난 전투를 다시 예약하지 않아, 반격 처리 뒤의 턴 정산이나
       늦게 도착한 타이머가 다음 화면을 덮어쓰지 않게 한다. */
    const b = S.battle;
    if(!b || b.over) return;
    b.over = true;
    pushLog('적이 물거품이 되어 흩어진다.');
    setTimeout(()=>{
      if(!S || S.battle!==b || S.screen!=='battle') return;
      completeCurrentNode();
      render();
    }, 550);
  }

