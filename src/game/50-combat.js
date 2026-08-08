  /* 심연의 태동은 절반을 잃기 전까지 이름조차 허락하지 않는다.
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
    if(node.tier === '역류의 이랑') d += 2;
    else if(node.tier === '잔별의 구렁') d += 4;
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
    const hpRoleMul = boss ? threat.bossHp * 0.70 : elite ? threat.eliteHp : 1;
    const atkRoleMul = boss ? threat.bossAtk : elite ? threat.eliteAtk : 1;
    foe.maxHp = Math.max(8, Math.round(foe.maxHp * packScale * threat.hp * hpRoleMul));
    /* 첫 번째 출정은 핵심 전투 규칙을 익히는 구간이므로 적 체력을 20으로 제한한다. */
    if(firstRunActive()) foe.maxHp = Math.min(20, foe.maxHp);
    foe.atk = Math.max(1, Math.round(foe.atk * threat.atk * atkRoleMul));
    foe.pressureMul = threat.pressure;
    return foe;
  }
  function isFirstRunFirstBattle(node){
    return !!(S && S.firstRun && S.chapter===0 && S.stepInChapter===0 &&
      (!S.mapVisited || S.mapVisited.length===0) && node &&
      (node.type==='battle' || node.type==='elite'));
  }
  function makeFoe(rank, scale, node){
    const base = Object.assign({}, pickOne(foeCandidates(rank, node.tier)));
    return scaleFoeForTier(base, node, scale, false);
  }

  function enemySetFor(node){
    const set = [];
    const depth = stageDepth(node);
    const endless = node.tier==='끝없는 심연';
    if(isFirstRunFirstBattle(node)){
      const foe=makeFoe(0, 1, node);
      foe.maxHp=20;
      return [foe];
    }
    /* 우두머리 자체가 무겁다 — 수행원은 깊이에 따라 천천히만 는다 (총 4를 넘기지 않는다) */
    const escortsFor = () => Math.min(3, 1 + Math.floor(Math.random()*2) + Math.floor(depth/4));

    if(node.boss){
      const warden = scaleFoeForTier(Object.assign({}, endless ? FOE_ENDLESS_BOSS : FOE_BOSS), node, 1, true);
      /* 층마다 다른 이름으로 부른다. 같은 개체를 세 번 만나는 것이 아니라,
         매번 조명 안으로 드러난 부분만 다르게 보이는 것이다. */
      const called = wardenNameFor(node.tier);
      if(called){
        warden.name = called;
        warden.icon = wardenScenarioIcon(called) || warden.icon;
      }
      set.push(warden);
      const n = endless ? 3 : (S.firstRun ? 2 : escortsFor());
      for(let r=1; r<=n; r++) set.push(makeFoe(r, endless ? 0.92 : 0.8, node));
      return set;
    }
    if(node.type==='elite'){
      const leaders = endless ? FOE_ELITES.concat(FOE_ENDLESS) : FOE_ELITES;
      set.push(scaleFoeForTier(Object.assign({}, pickOne(leaders)), node, 1, true));
      const n = endless ? 3 : (S.firstRun ? 2 : escortsFor());
      for(let r=1; r<=n; r++) set.push(makeFoe(r, endless ? 0.95 : 0.8, node));
      return set;
    }
    const n = S.firstRun ? Math.max(1, Math.min(3, rollFoeCount(depth, node.tier))) : rollFoeCount(depth, node.tier);
    const scale = countScale(n) * (endless ? 1.22 : 1);
    for(let r=0; r<n; r++) set.push(makeFoe(r, scale, node));
    return set;
  }

  function handSize(){ return Math.min(HAND_LIMIT, 5 + relicSum('draw')); }

  function startBattle(node){
    const enemies = enemySetFor(node).map(e=>Object.assign({}, e, {hp:e.maxHp, block:0, intent:null, alive:true, react:null, isLeader:false, confused:0}));
    /* 우두머리 — 체력이 가장 높은 개체를 정한다. 보스·엘리트 전은 그 개체가 이미
       가장 크게 부풀려져 있으니 자연히 우두머리가 된다. 무리 둘 이상일 때만 의미가
       있으므로(하나뿐이면 죽는 순간 전투가 끝난다) 어차피 표식만 해 둔다. */
    if(enemies.length){
      let leader = enemies[0];
      enemies.forEach(en=>{ if(en.maxHp > leader.maxHp) leader = en; });
      leader.isLeader = true;
    }
    const tutorialFirstBattle=isFirstRunFirstBattle(node);
    const ap = 3 + relicSum('ap');
    S.battle = {
      tier: node.tier, node, enemies,
      deck: cloneForBattle(S.runDeck), hand:[], discard:[],
      ap:ap, maxAp:ap, tempAp:0, turn:1, over:false, rareDraws:{}, rareUses:{},
      pendingCardUid:null, pendingDomain:null, pendingDraw:null, pendingRepositionFrom:null,
      combatGuideQueue:[],
      combatGuideShown:[],
      tutorialFirstBattle:tutorialFirstBattle,
      coreGuide: !!S.firstRunGuide,
    };
    S.firstRunGuide = false;
    S.party.forEach(p=>{ if(p) p.react = null; });
    aliveParty().forEach(p=>{
      const mend = relicSum('battleHeal', p);
      if(mend>0) p.hp = Math.min(p.maxHp, p.hp + mend);
    });
    fxQueue = [];
    clearLog();
    rollIntents();
    drawHand(handSize());
    if(tutorialFirstBattle){
      /* 첫 적에게 바로 시험해 볼 수 있는 14 피해 단일 공격을 항상 손에 둔다.
         본편 덱에는 저장하지 않는 일회성 튜토리얼 카드다. */
      const guaranteed=tutorialCard('vanguard','방패 밀어치기');
      if(guaranteed){
        guaranteed.name='확정 일격';
        guaranteed.dmg=14;
        guaranteed.selfBlock=0;
        guaranteed.desc='적 한 명에게 14 피해.';
        S.battle.hand.unshift(guaranteed);
      }
    }
    S.logMsg = node.boss
      ? (node.tier==='끝없는 심연' ? '검은 수면 아래의 눈이 당신을 알아본다. 그 앞에 한 인간의 형체가 서 있다.' : '이곳의 꿈을 지키는 형체가 어둠 속에서 몸을 일으킨다.')
      : node.type==='elite' ? '유난히 거대한 형체가 앞장서 다가온다. 그것은 당신을 처음 보는 얼굴이 아니다.'
      : enemies.length>1 ? `어둠 속에서 ${enemies.length}개의 형체가 열을 이룬다. 모두 같은 박자로 숨을 쉰다.`
      : '어둠 속의 형체가 고개를 든다. 당신이 먼저 보았다고 믿게 만든다.';
    S.screen = 'battle';
  }

  /* 사망자는 대열의 맨 뒤로 밀려난다. 생존자와 전사자의 상대 순서는 유지해
     사용자가 정한 기본 대형을 최대한 보존하면서, 실제 카드 위치도 함께 당긴다. */
  function moveFallenHeroesToRear(){
    if(!S || !Array.isArray(S.party)) return;
    const living = S.party.filter(p=>p && p.alive);
    const fallen = S.party.filter(p=>p && !p.alive);
    const vacant = S.party.filter(p=>!p);
    S.party = living.concat(fallen, vacant);
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

  /* 보스는 각성 후 대열의 가장 약한 고리를 집요하게 물고 늘어진다.
     현재 체력만 보지 않고 최대 체력과 지원 병과를 함께 고려한다. 따라서
     체력이 비슷하면 사제·약제사·관측자·진혼악사가 먼저 위험해진다. */
  function pickBossTarget(en){
    const pool = heroesInReach(en);
    if(!pool.length) return null;
    if(en.phase < 2) return pickHeroTarget(en);
    const support = new Set(['chemist','priest','oracle','jester']);
    return pool.reduce((best, hero)=>{
      const hpRatio = hero.maxHp > 0 ? hero.hp / hero.maxHp : 1;
      const maxHpWeakness = 1 - Math.min(1, hero.maxHp / 32);
      const supportBonus = support.has(hero.cls) ? 0.16 : 0;
      const pressure = Math.min(1, Math.max(0, (hero.dp || 0) / 100)) * 0.10;
      const score = (1 - hpRatio) * 0.58 + maxHpWeakness * 0.16 + supportBonus + pressure;
      if(!best || score > best.score) return {hero, score};
      return best;
    }, null).hero;
  }

  function pressureIntent(en, value){ return Math.max(1, Math.round(value * (en.pressureMul || 1))); }
  /* 적의 예고 행동 — 자기 열에서 실제로 할 수 있는 것만 고른다 */
  function pickIntent(en){
    const rank = foeRank(en);
    const roll = Math.random();
    const stuck = !canActFrom(en, rank) || heroesInReach(en).length===0;

    if(en.kind==='boss'){
      if(stuck) return {type:'guard_up', val:8, label:'웅크림', ic:IC_GUARD};
      return weighted(bossIntentPool(en));
    }

    /* 손이 닿지 않으면 자리를 고쳐 잡거나 속삭인다 */
    if(stuck){
      return roll<0.5
        ? {type:'guard_up', val:5, label:'웅크림', ic:IC_GUARD}
        : {type:'whisper_random', val:pressureIntent(en,6), label:'속삭임', ic:IC_GAZE};
    }

    return weighted(intentPool(en));
  }

  /* ============ 수문장의 공격 패턴 ============
     일반 적이 역할표(intentPool)를 따르듯 수문장도 제 표를 갖는다. 다만 역할이 아니라
     '어느 층의 무엇인가' 로 갈린다 — 층마다 이름이 다르고, 하는 짓도 그 이름을 따라야 한다.

     2페이즈의 공통 규칙은 하나다: 웅크리지 않는다.
     1페이즈에서 방어에 쓰던 몫이 전부 공격으로 넘어간다. 여기에 페이즈 전환의
     공격력 ×1.2 가 이미 얹혀 있으므로, 배수를 크게 잡지 않아도 체감이 확 달라진다.

     표를 고치는 것으로 보스의 성격이 바뀐다 — 전투 코드는 건드리지 않는다. */
  function bossIntentPool(en){
    const a = en.atk;
    const hit    = (v,l,ic)=>({type:'attack_reach', val:Math.max(1,Math.round(v)), label:l, ic:ic||IC_CLEAVER});
    const heavy  = (v,l)=>hit(v, l, IC_HEAVY);
    const dbl    = (v,l)=>({type:'double_attack_reach', val:Math.max(1,Math.round(v)), label:l, ic:IC_DOUBLE});
    const all    = (v,l)=>({type:'attack_all', val:Math.max(1,Math.round(v)), label:l, ic:IC_ROAR});
    const rear   = (v,l)=>({type:'whisper_rear', val:pressureIntent(en,v), label:l, ic:IC_GAZE});
    const anyone = (v,l)=>({type:'whisper_random', val:pressureIntent(en,v), label:l, ic:IC_GAZE});
    const snipe  = (v,l)=>({type:'snipe_lowest', val:Math.max(1,Math.round(v)), label:l, ic:IC_SNIPE});
    const grd    = (v)=>({type:'guard_up', val:Math.max(4,Math.round(v)), label:'웅크림', ic:IC_GUARD});

    const two = en.phase === 2;
    switch((S.battle && S.battle.tier) || '메아리의 여울'){

      /* 잔향을 삼킨 것 — 줄로 끌어당긴다. 2페이즈에서는 끌던 것을 통째로 덮어씌운다. */
      case '메아리의 여울':
        return two
          ? [[3, all(a*0.58, '난파선을 덮어씌운다')],
             [4, heavy(a*1.15, '잠수 케이블을 후려친다')],
             [3, dbl(a*0.5, '줄이 연달아 감긴다')],
             [2, rear(12, '줄 너머에서 본다')]]
          : [[4, hit(a, '난파선을 끌어당긴다')],
             [3, rear(9, '줄 너머에서 본다')],
             [2, grd(a*0.9)]];

      /* 그물에 엉킨 자 — 남의 목소리와 남의 동작을 되풀이한다.
         2페이즈에서는 그 되풀이가 몸이 아니라 머리를 노린다. */
      case '역류의 이랑':
        return two
          ? [[4, rear(15, '기억을 되짚는다')],
             [3, anyone(11, '남의 목소리로 부른다')],
             [3, dbl(a*0.66, '같은 동작을 반복한다')],
             [2, heavy(a*1.2, '되감긴 팔')]]
          : [[4, rear(10, '기록을 읽어 내린다')],
             [3, hit(a, '삼킨 것을 뱉는다')],
             [2, grd(a*0.9)]];

      /* 별을 두른 관측자 — 약한 줄부터 끊는다.
         2페이즈에서는 한 줄씩이 아니라 한꺼번에 당긴다. */
      case '잔별의 구렁':
        return two
          ? [[4, snipe(a*1.2, '가장 약한 줄을 끊는다')],
             [3, all(a*0.6, '줄을 한꺼번에 당긴다')],
             [3, heavy(a*1.2, '심연으로 끌어내린다')],
             [2, rear(13, '아래에서 올려다본다')]]
          : [[4, hit(a, '아래에서 당긴다')],
             [3, snipe(a*0.95, '약한 줄부터 끊는다')],
             [2, grd(a*0.9)]];

      /* 심연의 태동 — 마지막 말뚝. 2페이즈에서는 첫 등대지기의 마지막 지시를 몸으로 되풀이한다. */
      default:
        return two
          ? [[3, all(a*0.62, '심연의 포효')],
             [4, dbl(a*0.6, '두 번 내려친다')],
             [3, heavy(a*1.2, '마지막 지시')],
             [3, rear(16, '기억을 들여다본다')]]
          : [[4, hit(a, '최심의 강타')],
             [3, rear(11, '심연의 응시')],
             [2, grd(a*0.9)]];
    }
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
        list = [[4, hit(a*1.55,'강타 예고',IC_HEAVY)], [3, hit(a,'내려찍기')], [1, grd(a*0.8)]]; break;
      case 'skirmisher':
        list = [[4, dbl(a*0.55,'연속 공격')], [3, hit(a,'베어물기')], [1, anyone(6,'속삭임')]]; break;
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
  /* 역류의 이랑의 기존 15% 빈도는 절반으로 낮춘다. 하지만 잔별의 구렁과 끝없는 심연에서는
     심연의 관측이 강해지므로 다시 가파르게 늘어난다. */
  const UNKNOWN_CARD_CHANCE = {'역류의 이랑':0.075, '잔별의 구렁':0.12, '끝없는 심연':0.18};
  /* 되돌릴 수 없는 카드는 가리지 않는다. 비상 탈출은 무엇인지 모른 채 눌렀다가
     대원과 유물을 잃는 카드라, 교란의 재미가 아니라 사고가 된다. */
  /* 미상 카드는 등급·소속·종류를 가리지 않는다. 비상 탈출 카드도 예외가 아니다. */
  function canBeContaminated(card){ return !!card; }
  const CONTAMINATION_RISKS = [
    {id:'blood_tithe', name:'살점 세금', desc:'카드 사용자의 현재 HP가 10% 감소합니다.'},
    {id:'mind_shear', name:'정신 절삭', desc:'카드 사용자의 심도압박이 10% 증가합니다.'},
    {id:'depth_tax', name:'심도 세금', desc:'카드 사용자의 현재 HP 5%와 심도압박 5%를 추가로 잃습니다.'},
  ];
  function contaminationRisk(){
    const r=CONTAMINATION_RISKS[Math.floor(Math.random()*CONTAMINATION_RISKS.length)];
    return Object.assign({},r);
  }
  function applyContaminationRisk(card, owner){
    const target=(owner && owner.alive) ? owner : aliveParty()[0];
    const risk=card && card.contaminationRisk;
    if(!target || !risk) return;
    if(risk.id==='blood_tithe'){
      const loss=Math.max(1,Math.round(target.hp*0.10));
      target.hp=Math.max(1,target.hp-loss);
      pushLog(`${target.name}의 살점이 오염에 바쳐졌다. (현재 HP -${loss})`);
    } else if(risk.id==='mind_shear'){
      const pressure=10;
      addDp(target,pressure); checkCollapse(target);
      pushLog(`${target.name}의 정신이 오염에 깎였다. (심도압박 +${pressure})`);
    } else if(risk.id==='depth_tax'){
      const loss=Math.max(1,Math.round(target.hp*0.05));
      const pressure=5;
      target.hp=Math.max(1,target.hp-loss);
      addDp(target,pressure); checkCollapse(target);
      pushLog(`${target.name}이 심연의 세금을 치렀다. (현재 HP -${loss} · 심도압박 +${pressure})`);
    }
  }
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
      c.contaminationRisk = null;
      c.contaminationRevealed = false;
      c.heldTurns = 0;          /* 이제 막 손에 들어왔다 */
      /* 시작 덱에 섞여 온 에픽은 획득 화면을 거치지 않는다 — 처음 손에 잡히는 이 자리가 첫 만남이다 */
      raiseEpicGuide(c);
      const unknownCount = b.hand.filter(card=>card.contaminated).length;
      const unknownChance = (UNKNOWN_CARD_CHANCE[b.tier] || 0) * lighthouseUnknownMul() * pactUnknownMul();
      if(canBeContaminated(c) && unknownCount < UNKNOWN_CARD_MAX_PER_TURN && Math.random() < unknownChance){
        c.contaminated = true;
        c.contaminationRisk = contaminationRisk();
      }
      return c;
    }
    return null;
  }
  /* ============ 손에 남는 카드 ============
     보통 손패는 턴이 끝나면 통째로 버린다. 에픽 이상만은 남는다 — 0 AP 로 판을 뒤집는
     카드라 뽑힌 턴에 반드시 써야 한다면 값이 운에 달린다.
     다만 오래는 아니다. 세 턴을 쥐고 있으면 네 번째 턴을 맞기 전에 손을 떠난다 —
     아껴 두었다가 마지막에 한꺼번에 터뜨리는 것도 막는다. */
  const EPIC_HAND_TURNS = 3;
  /* 남는 것은 심연이 내려준 것뿐이다. +5 까지 갈아 승화한 카드는 남지 않는다 —
     파밍으로 그런 카드를 여러 장 만들면 손패가 그것들로 굳어 새로 뽑을 자리가 없어진다.
     이미 AP 1 로 강력해진 카드에 손에 남는 특권까지 줄 이유도 없다. */
  function holdsInHand(card){ return isAbyssEpic(card) || isLegendaryCard(card); }
  /* 이 카드를 앞으로 몇 턴 더 쥘 수 있나 (손에 남지 않는 카드는 null) */
  function heldTurnsLeft(card){
    return holdsInHand(card) ? Math.max(0, EPIC_HAND_TURNS - (card.heldTurns || 0)) : null;
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

  /* ── 수문장이 되뇌는 말 ──
     프롤로그에서 대장이 내리던 지시를, 수문장이 행동할 때마다 하나씩 흘린다.
     말을 배운 것이 아니라 기록에 남은 말을 되풀이하는 것이므로, 순서대로 한 번씩만
     쓰고 다 쓰면 멈춘다 — 같은 말을 무한히 반복하면 기계처럼 읽힌다.

     전투를 멈춰 세우지 않으려고 대화층 대신 전투 기록에 얹는다. 어차피 전투의
     서술이 사는 자리고, 따옴표와 색만 달리해도 다른 목소리로 읽힌다.

     되뇌는 말은 층마다 다르다 — 88-scenario.js 의 WARDEN_ECHOES 를 본다. */
  function isWarden(en){
    const b = S.battle;
    /* 이름이 아니라 '되뇔 말이 있는 층의 보스인가' 로 본다 — 최종 수문장은 이름이 가려져 있다 */
    return !!(en && en.kind==='boss' && b && wardenEchoesFor(b.tier).length);
  }
  function wardenEcho(en){
    const b = S.battle;
    if(!b || !isWarden(en)) return;
    const lines = wardenEchoesFor(b.tier);
    const said = b.echoes || 0;
    if(said >= lines.length) return;
    b.echoes = said + 1;
    pushLog(`<span class="log-echo">${foeDisplayName(en)}: “${lines[said]}”</span>`);
  }

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
  /* 실제 전투 결과가 발생한 뒤에만 넣는다. 한 행동에서 여러 규칙이 연속 발동하면
     큐에 쌓아 팝업을 닫을 때 다음 안내로 넘어간다. */
  function queueCombatRuleGuide(kind){
    const b=S && S.battle;
    if(!b || b.over || b.tutorialFirstBattle) return;
    if(hasSeenCombatRuleGuide(kind)) return;
    /* 첫 런의 전투 규칙 안내는 길게 이어지지 않도록 전체 3회까지만 표시한다. */
    if(S.firstRun && S.chapter===0 && (S.firstRunCombatGuideCount||0)>=3) return;
    if(!Array.isArray(b.combatGuideQueue)) b.combatGuideQueue=[];
    if(!b.combatGuideQueue.includes(kind)){
      b.combatGuideQueue.push(kind);
      if(S.firstRun && S.chapter===0) S.firstRunCombatGuideCount=(S.firstRunCombatGuideCount||0)+1;
    }
  }
  function canRiposte(defender, defRank, attacker, atkRank){
    if(!attacker || !attacker.alive) return false;
    /* 보스는 1열·2열에 걸쳐 있는 것으로 친다 — 어느 쪽이든 닿으면 되받아칠 수 있다 */
    if(attacker.kind==='boss') return canActFrom(defender, defRank) && (canHitRank(defender,0) || canHitRank(defender,1));
    return canActFrom(defender, defRank) && canHitRank(defender, atkRank);
  }
  /* ============ 기본 병과 상시 특성 ============
     각 병과가 늘 켜 두는 작은 특성 하나씩. 각인(±8%대)과 비슷한 자릿수로 눌러서
     2차 전직 패시브가 나왔을 때의 체감 차이를 남겨 둔다. */
  const VANGUARD_FRONTLINE_BLOCK_MUL = 1.15;   /* 전열(0열)에서 방어 획득 +15% */
  const CHEMIST_SPLASH_RATIO = 0.10;           /* 공격 시 주변 적 하나에게 준 피해의 10% 추가 */
  const PRIEST_DP_GAIN_MUL = 0.90;             /* 자신의 심도압박 상승량 -10% */
  const ORACLE_CRIT_BONUS = 0.015;             /* 치명타 확률 +1.5%p — 기본 확률이 0.8%라 +4%p는 5배 이상 뛰어 이 값으로 낮췄다 */
  const HELLION_LOWHP_DMG_MUL = 1.12;          /* 체력 50% 이하일 때 공격력 +12% */
  const ROBBER_DODGE_BONUS = 0.06;             /* 회피 확률 +6%p */
  const JESTER_ONHIT_DP_RELIEF = 2;            /* 피해를 받으면 무작위 아군 심도압박 -2 */
  /* 등대 수호병 — 전열(0열)을 지키고 선 동안 방어를 더 두껍게 쌓는다 */
  function classBlockMul(hero){
    return (hero && hero.cls==='vanguard' && heroRank(hero)===0) ? VANGUARD_FRONTLINE_BLOCK_MUL : 1;
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
  /* 닻 배지(청동/은/금) 랭크에 따라 치명타 확률이 함께 오른다 — survivalRankTier(80-render.js)가
     매기는 랭크를 그대로 쓴다. 새 성장 축을 따로 만들지 않고 이미 표시되는 배지에 실제 효과를 얹는다. */
  const ANCHOR_CRIT_BONUS = {bronze:0.003, silver:0.008, gold:0.015};
  function anchorCritBonus(hero){
    if(!hero || !hero.isHero) return 0;
    const tier = survivalRankTier(hero.descentWins||0);
    return tier ? (ANCHOR_CRIT_BONUS[tier]||0) : 0;
  }
  function rollCritMultiplier(attacker){
    /* 심연 예언자 — 저주와 예지의 눈은 남들보다 급소를 더 잘 짚는다 */
    let bonus = (attacker && attacker.cls==='oracle') ? ORACLE_CRIT_BONUS : 0;
    bonus += anchorCritBonus(attacker);
    if(Math.random() >= CRIT_CHANCE + bonus) return 1;
    return Math.min(CRIT_MULT_MIN + Math.random()*(CRIT_MULT_MAX-CRIT_MULT_MIN), CRIT_MULT_CAP);
  }

  /* 회피/흘림 판정 + 방어도 소모. 실제 체력 차감은 호출부에서 한다. */
  /* 결과에는 실제로 깎인 피해(dealt)뿐 아니라 '무엇을 면했는지'도 함께 담는다.
     회피로 통째로 피한 양(avoided), 흘림으로 깎아낸 양(reduced) — 화면에 그 수치를
     띄워 줘야 왜 체력이 예상만큼 줄지 않았는지가 읽힌다. */
  function resolveIncoming(defender, amount, attacker){
    const rc = reactOf(defender);
    if(Math.random() < rc.dodge){
      markReact(defender, 'dodge');
      return {dealt:0, kind:'dodge', avoided:amount, reduced:0, crit:false};
    }
    let dmg = amount;
    let kind = 'hit';
    let reduced = 0;
    /* 크리티컬은 흘림·방어보다 먼저 부풀린다 — 깊게 들어간 한 방을 그 뒤에 막아 내는 순서다 */
    const critMult = rollCritMultiplier(attacker);
    const crit = critMult > 1;
    if(crit) dmg = Math.max(1, Math.round(dmg * critMult));
    if(Math.random() < rc.guard){
      const halved = Math.max(1, Math.round(dmg*0.5));
      reduced = dmg - halved;
      dmg = halved;
      markReact(defender, 'guard');
      kind = 'guard';
    }
    let blocked = 0;
    if(defender.block > 0){
      const absorbed = Math.min(defender.block, dmg);
      defender.block -= absorbed;
      dmg -= absorbed;
      blocked = absorbed;
    }
    return {dealt:dmg, kind:kind, avoided:0, reduced:reduced, blocked:blocked, crit:crit};
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
    /* 전장의 고함 — 외치고 있는 동안은 다른 누구를 노린 공격이든 전부 이 사람에게 온다.
       광역기라면 그만큼 여러 번 이 문을 다시 지난다. */
    const taunter = S.party.find(p=>p && p.alive && (p.tauntTurns||0)>0);
    if(taunter && taunter.alive && taunter!==hero) hero = taunter;
    if((hero.tauntTurns||0)>0) amount = Math.round(amount * (1 - (hero.tauntReduction||0)));
    const stress = opts.stress!==false;
    const attacker = opts.from || null;
    if((hero.invulnerableTurns||0) > 0){
      queueFx('guard', hero);
      pushLog(`${ga(hero.name)} 침몰한 성궤의 보호를 받아 피해를 무시한다.`);
      /* 무적으로 흘려낸 피해는 그대로 공격한 적에게 되돌아간다.
         자신도 방금 이 피해를 무시했으니, 되돌린 충격에 다시 반격을 걸진 않는다. */
      if(attacker && attacker.alive){
        pushLog(`${ga(hero.name)} 되돌린 충격이 ${foeDisplayName(attacker)}을(를) 덮친다.`);
        damageEnemy(attacker, amount, {from:hero, riposte:true});
      }
      return {dealt:0, kind:'invulnerable'};
    }
    /* 정신이 함몰되면 몸도 함께 무너진다. 방어·흘림 판정 전에 원피해가 50% 늘어난다. */
    if(hero.collapsed) amount = Math.round(amount * 1.5);
    const res = resolveIncoming(hero, amount, attacker);

    if(res.kind==='dodge'){
      queueCombatRuleGuide('dodge');
      queueFx('dodge', hero, res.avoided);
      pushLog(`${ga(hero.name)} 몸을 비틀어 피했다.`);
      triggerBulwarkRiposte(hero, attacker, opts);
      return res;
    }
    /* 프롤로그에서 넷은 각본대로만 죽는다. 자유 전투에서 먼저 쓰러져 버리면
       잠수 케이블이 끊기는 장면에 닿지 못하고 평범한 탐색 실패 화면으로 빠진다. */
    hero.hp = S.prologue ? Math.max(1, hero.hp - res.dealt) : Math.max(0, hero.hp - res.dealt);
    if(res.crit) queueCombatRuleGuide('critical');
    if(res.blocked>0) queueCombatRuleGuide('defense');
    if(res.kind==='guard') queueCombatRuleGuide('guard');
    if(res.dealt>0){
      flash('red');
      queueFx('impact', hero, res.dealt, res.crit, attacker);
      if(res.crit) pushLog(`급소를 찔렸다 — ${hero.name}이(가) 치명타로 ${res.dealt} 피해.`);
      if(stress) addDp(hero, 4);
      /* 진혼악사 — 얻어맞는 순간에도 손이 절로 현을 뜯는다. 무작위 아군의 압박을 달랜다 */
      if(hero.cls==='jester'){
        const pool = aliveParty();
        if(pool.length){
          const soothed = pickOne(pool);
          setDp(soothed, soothed.dp - JESTER_ONHIT_DP_RELIEF);
          queueFx('calm', soothed);
          pushLog(`${ga(hero.name)} 얻어맞으면서도 현을 뜯는다 — ${ga(soothed.name)} 압박이 가라앉는다. (-${JESTER_ONHIT_DP_RELIEF})`);
        }
      }
    }
    if(res.kind==='guard'){ queueFx('guard', hero, res.reduced); pushLog(`${ga(hero.name)} 흘려 막았다. (${res.dealt} 피해)`); }
    if(hero.hp<=0 && hero.alive){
      hero.alive = false;
      moveFallenHeroesToRear();
      purgeDeadClassCards(hero);
      recordResidenceDeath(hero);
      queueFx('death', hero);
    }
    checkCollapse(hero);

    if(triggerBulwarkRiposte(hero, attacker, opts)) return res;

    if(hero.alive && opts.riposte!==false && canRiposte(hero, heroRank(hero), attacker, foeRank(attacker))
       && Math.random() < reactOf(hero).riposte){
      const rip = reactOf(hero).rip;
      queueCombatRuleGuide('riposte');
      markReact(hero, 'riposte');
      queueFx('riposte', hero, rip);
      /* 반격 선언 뒤의 회피·흘림 결과가 마지막 줄에 남도록 한다. */
      pushLog(`${ga(hero.name)} 곧바로 받아친다. (반격 ${rip})`);
      damageEnemy(attacker, rip, {riposte:true, from:hero});
    }
    return res;
  }
  /* 침수된 방벽은 일반 반격과 달리 거리·확률을 묻지 않는다. 적이 공격을 선언한
     순간 벽에 닿아 되튄다. 반격끼리 되받아치는 무한 연쇄는 기존 규칙처럼 막는다. */
  function triggerBulwarkRiposte(hero, attacker, opts){
    const rip = hero && hero.bulwarkRiposte || 0;
    if(!rip || !hero.alive || !attacker || !attacker.alive || opts.riposte===false) return false;
    markReact(hero, 'riposte');
    queueCombatRuleGuide('riposte');
    queueFx('riposte', hero, rip);
    pushLog(`${ga(hero.name)} 침수된 방벽을 되울린다. (${rip} 반격)`);
    damageEnemy(attacker, rip, {riposte:true, from:hero});
    return true;
  }
  /* 심도압박은 항상 0~100의 정수로 유지한다. 유물의 백분율 배율이 소수점을 만들 수 있다. */
  function setDp(hero, value){
    const safeValue = Number.isFinite(value) ? value : 0;
    hero.dp = Math.round(Math.max(0, Math.min(100, safeValue)));
    if(S && hero.dp > (S.dpPeakSeen||0)) S.dpPeakSeen = hero.dp;
    return hero.dp;
  }
  /* 심도압박 상승은 전부 이 문을 지난다 — 유물로 무뎌지는 지점이 한 곳뿐이도록 */
  function addDp(hero, amount){
    /* 역병 사제 — 정화에 익은 몸이라 스스로 물드는 속도가 더디다 */
    const classDpMul = hero && hero.cls==='priest' ? PRIEST_DP_GAIN_MUL : 1;
    setDp(hero, hero.dp + amount * (hero.dpResistance || 1) * relicMul('dpMul', hero) * classDpMul);
  }
  /* 정신붕괴 — 심도압박이 100에 닿으면 5턴 동안 제어를 잃는다.
     그동안은 카드로 낼 수 없고, 턴이 넘어갈 때마다 아군·적을 가리지 않고
     닥치는 대로 한 번씩 휘두르며, 압박은 매턴 10씩 저절로 빠진다. */
  const MENTAL_BREAKDOWN_TURNS = 5;
  const MENTAL_BREAKDOWN_DP_DECAY = 10;
  const MENTAL_BREAKDOWN_DMG = 10;
  function checkCollapse(hero){
    if(hero.dp>=100 && !(hero.breakdown>0)){
      hero.breakdown = MENTAL_BREAKDOWN_TURNS;
      pushLog(`${hero.name}의 정신이 무너졌다. ${MENTAL_BREAKDOWN_TURNS}턴 동안 제어를 잃고 아군과 적을 가리지 않고 공격한다.`);
      queueCombatRuleGuide('breakdown');
    }
  }
  /* 턴이 넘어갈 때 정신붕괴 중인 대원의 몫을 대신 굴린다 — 적 턴과 같은 자리에서 처리한다. */
  function resolveMentalBreakdowns(){
    S.party.filter(Boolean).forEach(hero=>{
      if(!hero.alive || !(hero.breakdown>0)) return;
      const enemyPool = (S.battle ? S.battle.enemies : []).filter(e=>e.alive);
      const allyPool = aliveParty().filter(p=>p!==hero);
      const pool = enemyPool.concat(allyPool);
      if(pool.length){
        const target = pickOne(pool);
        const dmg = Math.round(MENTAL_BREAKDOWN_DMG * (hero.attackPower || 1));
        const atFoe = enemyPool.indexOf(target) >= 0;
        pushLog(`${ga(hero.name)} 정신을 잃은 채 ${atFoe ? foeDisplayName(target) : target.name}에게 달려든다.`);
        if(atFoe) damageEnemy(target, dmg, {from:hero});
        else applyDamageToHero(target, dmg, {});
      }
      hero.breakdown -= 1;
      setDp(hero, hero.dp - MENTAL_BREAKDOWN_DP_DECAY);
      if(hero.breakdown<=0) pushLog(`${hero.name}이(가) 정신을 되찾았다.`);
    });
  }
  /* 멀쩡히 서 있던 적을 한 방에 무너뜨린 손은 잠깐 숨을 돌린다 —
     체력이 조금 붙고 압박이 크게 내려간다. 내려놓는 쪽이 큰 이유는,
     심연에서 버티는 값을 몸보다 정신으로 치르기 때문이다.

     '한 방'의 뜻은 맞기 전 체력이 가득했다는 것이다. 여럿이 깎아 놓은 적의
     숨통을 끊는 것은 그 손의 몫이 아니다. 때린 사람이 분명할 때만 주고,
     피해를 거치지 않고 지우는 섬멸 카드는 이 문을 지나지 않는다. */
  const KILL_HEAL = 5, KILL_CALM = 15;
  function rewardKill(hero){
    if(!hero || !hero.alive) return;
    const before = hero.hp;
    hero.hp = Math.min(hero.maxHp, hero.hp + KILL_HEAL);
    setDp(hero, hero.dp - KILL_CALM);
    queueFx('heal', hero);
    queueFx('calm', hero);
    pushLog(`${ga(hero.name)} 숨을 돌린다. (체력 +${hero.hp - before} · 압박 -${KILL_CALM})`);
  }
  /* '한 방' 여부와 무관하게, 숨통을 끊은 손은 그때마다 조금씩 정신을 가다듬는다.
     rewardKill(위)의 큰 보상은 가득 찬 적을 한 번에 끝냈을 때만 얹히는 보너스고,
     이건 그와 별개로 모든 처치에 매번 붙는 작은 완화다 — 둘은 함께 쌓인다. */
  const KILL_DP_RELIEF = 5;
  function reliefOnKill(hero){
    if(!hero || !hero.alive) return;
    setDp(hero, hero.dp - KILL_DP_RELIEF);
    queueFx('calm', hero);
    pushLog(`${ga(hero.name)} 숨통을 끊고 정신을 가다듬는다. (압박 -${KILL_DP_RELIEF})`);
  }
  /* 우두머리가 먼저 쓰러지면 남은 무리가 흔들린다 — 2턴 동안 절반은 굳어 서고,
     절반은 서로를 문다. 우두머리 하나뿐이던 전투(무리가 그거로 끝)라면 남을
     상대가 없으니 조용히 지나간다. */
  const LEADER_CONFUSION_TURNS = 2;
  function triggerLeaderConfusion(fallenLeader){
    if(!fallenLeader || !fallenLeader.isLeader) return;
    const survivors = S.battle.enemies.filter(en=>en.alive);
    if(!survivors.length) return;
    survivors.forEach(en=>{ en.confused = LEADER_CONFUSION_TURNS; });
    pushLog(`${ga(foeDisplayName(fallenLeader))}이(가) 쓰러지자 남은 무리가 방향을 잃고 흔들린다.`);
    queueCombatRuleGuide('leaderFall');
  }

  function damageEnemy(en, dmg, opts){
    opts = opts || {};
    flash('white');
    /* 저항은 여기 한 곳에서만 깎는다 — 광역이든 파문이든 모든 피해가 이 문을 지난다.
       카드가 먼저 제 이름값을 적어 두었으므로, 밀려난 만큼은 눈에 보이게 말해 준다. */
    if(opts.epic && resistsEpic(en)){
      const declared = dmg;
      dmg = epicPower(en, dmg);
      if(dmg < declared) pushLog(`${ga(foeDisplayName(en))} 심연의 권능을 밀어낸다. (${declared} → ${dmg})`);
    }
    /* 맞기 전에 재 둔다. 아래에서 체력이 깎이고 나면 가득했는지 알 수 없다. */
    const wasUnhurt = en.hp >= en.maxHp;
    const res = resolveIncoming(en, dmg, opts.from);
    if(res.kind==='dodge'){
      queueCombatRuleGuide('dodge');
      queueFx('dodge', en, res.avoided);
      pushLog(`${ga(foeDisplayName(en))} 미끄러지듯 피한다.`);
      return null;
    }
    en.hp = Math.max(0, en.hp - res.dealt);
    if(res.crit) queueCombatRuleGuide('critical');
    if(res.blocked>0) queueCombatRuleGuide('defense');
    if(res.kind==='guard') queueCombatRuleGuide('guard');
    if(res.dealt>0){
      queueFx('impact', en, res.dealt, res.crit, opts.from);
      if(res.crit) pushLog(`급소를 꿰뚫었다 — ${foeDisplayName(en)}에게 치명타로 ${res.dealt} 피해.`);
    }
    if(res.kind==='guard'){
      queueFx('guard', en, res.reduced);
      pushLog(`${ga(foeDisplayName(en))} 몸을 틀어 흘려낸다. (${res.dealt} 피해)`);
    }

    if(en.hp<=0){
      en.alive = false;
      queueFx('death', en);
      reliefOnKill(opts.from);
      if(wasUnhurt) rewardKill(opts.from);
      triggerLeaderConfusion(en);
    } else if(en.kind==='boss' && en.phase===1 && en.hp <= en.maxHp*0.5){
      en.phase = 2;
      en.atk = Math.round(en.atk*1.2);
      en.block = Math.max(en.block, 6);
      en.intent = pickIntent(en);
      pushLog(en.hiddenName
        ? `${en.name}의 흉부가 열리며 단안이 당신을 향한다. 그것은 심연이 아니라, 심연을 지키던 인간이었다...!`
        : `${ga(en.name)} 진짜 모습을 드러낸다...!`);
      /* 이름이 드러나는 순간에는 전투가 멎고 말이 오간다. 각본이 끝나면 그대로 이어 싸운다. */
      const revealScript = bossPhaseTwoScript(en);
      if(revealScript) sayRun(revealScript);
    }

    const hero = opts.from || null;
    if(en.alive && !opts.riposte && hero && hero.alive
       && canRiposte(en, foeRank(en), hero, heroRank(hero))
       && Math.random() < reactOf(en).riposte){
      const rip = reactOf(en).rip;
      queueCombatRuleGuide('riposte');
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
  /* 엘리트와 수문장은 심연의 에픽에 저항한다 — 그 힘의 70%만 몸에 닿는다.
     잡졸은 그대로 맞는다. 에픽 한 장으로 판이 뒤집히는 것은 무리를 쓸어낼 때뿐이고,
     길을 막고 선 것 앞에서는 여전히 덱으로 싸워야 한다.
     섬멸계 에픽(단죄·조류)은 애초에 이들을 대상에서 빼므로 여기 걸릴 일이 없다. */
  const EPIC_RESIST = 0.70;
  function resistsEpic(en){ return !!en && (en.kind==='boss' || isEliteEnemy(en)); }
  function epicPower(en, value){
    if(!resistsEpic(en)) return value;
    return Math.max(1, Math.round(value * EPIC_RESIST));
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
    /* 무명자의 찬가도 병과가 던지는 것이 아니라 파티가 함께 부르는 노래다. 여기 빠져
       있으면 소유 병과를 찾다 실패해 빈 목록이 되고, 압박만 지운 채 아무도 맞지 않는다. */
    if(card.type==='fusion_attack' || card.type==='epic_attack' || card.type==='drowned_sentence' || card.type==='thousand_maws_tide' || card.type==='nameless_hymn' || (card.type==='reroll_intent' && card.owner==='neutral')) return b.enemies.filter(e=>e.alive);
    const owner = ownerOf(card);
    if(!owner || !owner.alive) return [];
    if(!canActFrom(owner, heroRank(owner))) return [];
    /* 보스는 1열·2열 둘 다에 걸쳐 있는 것으로 친다 — 어느 한쪽만 닿아도 공격할 수 있다 */
    return b.enemies.filter(e => e.alive && (e.kind==='boss' ? (canHitRank(owner,0) || canHitRank(owner,1)) : canHitRank(owner, foeRank(e))));
  }

  /* 못 내는 이유를 문장으로 — 카드에 그대로 찍어 보여준다 */
  function cardBlockReason(card){
    if(!isAttackCard(card)) return null;
    if(card.type==='fusion_attack' || card.type==='epic_attack' || card.type==='drowned_sentence' || card.type==='abyssal_verdict' || card.type==='thousand_maws_tide' || (card.type==='reroll_intent' && card.owner==='neutral')) return null;
    const owner = ownerOf(card);
    if(!owner || !owner.alive) return '시전자가 없다';
    if(owner.breakdown>0) return '정신이 무너져 명령을 들을 수 없다';
    const oRank = heroRank(owner);
    if(!canActFrom(owner, oRank)) return `${reachOf(owner).label} 병과는 ${rankName(oRank)}에서 못 친다`;
    if(!enemyTargetsFor(card).length) return '닿는 적이 없다';
    return null;
  }

  function canPlayCard(card){
    const b = S.battle;
    if(!b || b.over) return false;
    /* 저장된 이전 런의 카드에도 0 AP 변경을 소급 적용한다. */
    if(card && card.type==='double_ap') card.cost=0;
    if(b.pendingDraw) return false;
    /* 각본이 도는 동안 무엇을 낼 수 있는지는 대화 쪽이 정한다 — 지금 배울 한 장만 켜진다 */
    if(!sayGateCard(card)) return false;
    if(b.pendingCardUid && b.pendingCardUid!==card.uid) return false;
    if(b.ap + (b.tempAp||0) < card.cost) return false;
    if(cardBlockReason(card)) return false;
    /* 정신붕괴 중인 대원은 공격 카드뿐 아니라 어떤 카드로도 제어할 수 없다 */
    const owner = ownerOf(card);
    if(owner && owner.breakdown>0) return false;
    return true;
  }

  function beginTargeting(cardUid, domain){ S.battle.pendingCardUid=cardUid; S.battle.pendingDomain=domain; }
  function cancelTargeting(){ if(S.battle){ S.battle.pendingCardUid=null; S.battle.pendingDomain=null; S.battle.pendingRepositionFrom=null; } }

  function resolveCard(cardUidVal, targetInfo){
    const b = S.battle;
    if(!b || b.over) return;
    const idx = b.hand.findIndex(c=>c.uid===cardUidVal);
    if(idx===-1) return;
    const card = b.hand[idx];
    if(!canPlayCard(card)) return;
    if(card.contaminated && !card.contaminationRevealed){
      if(!card.contaminationRisk) card.contaminationRisk=contaminationRisk();
      S.contaminationPreview={mode:'use', cardUid:card.uid, targetInfo:targetInfo||null,
        name:card.name, cost:card.cost, desc:describeCard(card), rarity:cardRarityLabel(card),
        riskName:card.contaminationRisk.name, riskDesc:card.contaminationRisk.desc};
      render();
      return;
    }

    const reachable = enemyTargetsFor(card);
    /* 지목한 적이 후보에 없으면 아무 일도 일어나지 않는다 — 이미 쓰러졌거나 닿지 않는다.
       예전에는 여기서 조용히 '살아 있는 첫 적'으로 미끄러져, 쓰러진 적을 눌렀는데
       엉뚱한 적이 맞고 카드만 사라졌다. AP 를 치르기 전에 되돌린다. */
    if(card.range==='ranged' && targetInfo && targetInfo.enemyIdx!=null){
      const picked = b.enemies[targetInfo.enemyIdx];
      if(!picked || reachable.indexOf(picked)<0) return;
    }

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
    card.contaminationRevealed = false;
    noteRareCardUsed(card);   /* 다음부터 이 카드가 돌아올 확률이 꺾인다 */

    const owner = ownerOf(card);
    if(card.contaminationRisk) applyContaminationRisk(card,owner);
    /* 에픽의 피해는 엘리트·수문장 앞에서 깎인다. 전설도 같은 저항을 받는다 —
       심연이 내려주는 힘이라는 점은 같으므로 판정도 한 곳(damageEnemy)에서 같이 한다. */
    const epic = isEpicCard(card) || isLegendaryCard(card);

    /* 사거리 밖은 애초에 후보에 없다. 지목한 적은 위에서 이미 걸러 두었다. */
    let enemyTarget = null;
    if(card.range==='melee' || card.range==='ranged'){
      if(card.range==='ranged' && targetInfo && targetInfo.enemyIdx!=null) enemyTarget = b.enemies[targetInfo.enemyIdx];
      if(!enemyTarget) enemyTarget = reachable[0] || null;
    }

    let allyTarget = null;
    if(card.range==='support_ally'){
      if(targetInfo && targetInfo.allyId){ allyTarget = S.party.find(p=>p && p.id===targetInfo.allyId && p.alive) || null; }
      if(!allyTarget) allyTarget = lowestHpTarget();
    }
    /* 재배치는 죽은 대원의 자리로도 옮길 수 있어야 하므로, 목적지는 생존 여부를 묻지 않는다 */
    let allyDest = null;
    if(card.type==='reposition' && targetInfo && targetInfo.allyDestId){
      allyDest = S.party.find(p=>p && p.id===targetInfo.allyDestId) || null;
    }

    /* 제 정신을 깎아 쓰는 카드는 공격만이 아니다 — 종류를 가리지 않고 먼저 치른다 */
    if(card.selfDp && owner && owner.alive){ addDp(owner, card.selfDp); checkCollapse(owner); }

    switch(card.type){
      case 'attack':
      case 'fusion_attack':
      case 'epic_attack': {
        let dmg = Math.round(card.dmg * (owner && owner.attackPower || 1) * relicMul('dmgMul', owner));
        if(owner && owner.collapsed) dmg = Math.round(dmg*0.5);
        /* 작살광전사 — 체력이 반 밑으로 떨어지면 광기가 올라 공격력이 는다 */
        if(owner && owner.cls==='hellion' && owner.hp <= owner.maxHp*0.5) dmg = Math.round(dmg*HELLION_LOWHP_DMG_MUL);
        if(card.range==='aoe'){
          /* 선언은 먼저, 회피·흘림·각성 같은 실제 결과는 처리 직후 뒤에 남긴다. */
          pushLog(`${card.name} — 닿는 적 ${reachable.length}체에게 ${dmg} 피해.`);
          reachable.slice().forEach(en=>damageEnemy(en, dmg, {from:owner, epic:epic}));
        } else if(enemyTarget){
          pushLog(`${card.name} — ${foeDisplayName(enemyTarget)}에게 ${dmg} 피해.`);
          damageEnemy(enemyTarget, dmg, {from:owner, epic:epic});
          if(card.selfBlock && owner && owner.alive){ owner.block += Math.round(card.selfBlock*(owner.defensePower||1)); queueCombatRuleGuide('defense'); }
          /* 심연 약제사 — 독연이 옆으로 튀어, 주변 적 하나에게 준 피해의 10%가 더 들어간다 */
          if(owner && owner.cls==='chemist'){
            const splashPool = b.enemies.filter(e=>e.alive && e!==enemyTarget);
            if(splashPool.length){
              const splashTarget = pickOne(splashPool);
              const splashDmg = Math.max(1, Math.round(dmg*CHEMIST_SPLASH_RATIO));
              pushLog(`${ga(owner.name)}의 독연이 옆으로 튀어 ${eul(foeDisplayName(splashTarget))} ${splashDmg} 피해.`);
              damageEnemy(splashTarget, splashDmg, {from:owner});
            }
          }
        }
        break;
      }
      case 'drowned_sentence': {
        if(enemyTarget){
          const dmg = Math.round(card.dmg * (owner && owner.attackPower || 1) * relicMul('dmgMul', owner));
          const splash = Math.max(1, Math.round(dmg * card.splashRatio));
          const targetIndex = b.enemies.indexOf(enemyTarget);
          pushLog(`${card.name} — ${foeDisplayName(enemyTarget)}에게 ${dmg} 피해, 양옆에 ${splash} 파문 피해.`);
          damageEnemy(enemyTarget, dmg, {from:owner, epic:epic});
          [targetIndex-1, targetIndex+1].forEach(i=>{
            const side = b.enemies[i];
            if(side && side.alive) damageEnemy(side, splash, {from:owner, epic:epic});
          });
        }
        break;
      }
      case 'block': { if(owner&&owner.alive){ owner.block+=Math.round(card.block*(owner.defensePower||1)*relicMul('blockMul', owner)*classBlockMul(owner)); queueCombatRuleGuide('defense'); pushLog(`${owner.name}이 방어 태세를 취한다.`); } break; }
      /* 전장의 고함 — 외치는 동안 아군을 노린 모든 공격이 이 사람에게 쏠린다 */
      case 'taunt': {
        if(owner && owner.alive){
          owner.tauntTurns = card.turns||1;
          owner.tauntReduction = card.tauntReduction||0;
          pushLog(`${owner.name}이(가) 전장을 뒤흔드는 고함을 지른다 — 모든 시선이 이쪽으로 쏠린다.`);
          queueCombatRuleGuide('taunt');
        }
        break;
      }
      case 'block_party': {
        aliveParty().forEach(p=>{
          const grantedBlock = Math.round(card.block*(p.defensePower||1)*relicMul('blockMul', p)*classBlockMul(p));
          p.block += grantedBlock;
          queueCombatRuleGuide('defense');
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
        if(dmg>0) reachable.slice().forEach(en=>damageEnemy(en, dmg, {from:owner, epic:epic}));
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
        queueCombatRuleGuide('defense');
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
        /* AP 표시는 두 층으로 나뉜다 — 기본 AP 핍은 maxAp 개만 그리고,
           그 위로 넘치는 몫은 tempAp 핍으로 따로 그린다(80-render.js renderBattle).
           여기서 배가된 값을 전부 b.ap 에 몰아넣으면 maxAp 를 넘는 부분이
           화면에 아예 그려지지 않아 '효과가 안 먹는다'처럼 보인다. */
        /* 이 카드의 비용을 먼저 차감하면 기본 AP 3으로 사용했을 때
           0을 두 배로 만드는 문제가 생긴다. 사용 직전의 AP를 두 배로 만든 뒤
           카드 비용을 차감해, 전설 카드가 실제로 현재 턴을 확장하도록 계산한다. */
        const beforeCost = Math.max(0, b.ap + (b.tempAp||0) + card.cost);
        const doubled = beforeCost * 2;
        const remaining = Math.max(0, doubled - card.cost);
        b.ap = Math.min(remaining, b.maxAp);
        b.tempAp = Math.max(0, remaining - b.maxAp);
        pushLog(`태양 없는 정오 — 사용 전 AP ${beforeCost}를 두 배로 만들고, 비용 ${card.cost}를 지불해 ${remaining} AP가 남았다.`);
        break;
      }
      case 'legendary_sanctuary': {
        aliveParty().forEach(p=>{
          p.hp=Math.min(p.maxHp,p.hp+Math.round(card.heal*relicMul('healMul', p)));
          setDp(p, p.dp-card.calm);
          p.block+=Math.round(card.block*(p.defensePower||1)*relicMul('blockMul', p));
          queueFx('heal',p); queueFx('calm',p);
        });
        queueCombatRuleGuide('defense');
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
      /* 위치 교환 — 고른 대원을 원하는 자리로 자유롭게 옮긴다. 목적지는 죽은 대원의
         자리여도 된다(그 경우 죽은 몸이 이쪽 자리로 밀려온다). */
      case 'reposition': {
        if(allyTarget && allyDest && allyTarget!==allyDest){
          const fromIdx = S.party.indexOf(allyTarget);
          const toIdx = S.party.indexOf(allyDest);
          if(fromIdx>=0 && toIdx>=0){
            const t=S.party[fromIdx]; S.party[fromIdx]=S.party[toIdx]; S.party[toIdx]=t;
            pushLog(`${ga(allyTarget.name)} ${rankName(toIdx)}로 자리를 옮긴다.`);
          }
        }
        break;
      }
    }
    /* 자리가 바뀌면 사거리가 바뀌므로 예고를 다시 계산한다 */
    if(card.type==='swap' || card.type==='reposition') rollIntents();

    if(b.enemies.every(e=>!e.alive) && !S.prologue){ winBattle(); }
    render();
    /* 각본이 이 카드를 기다리고 있었다면 다음 박자로 넘어간다 */
    sayNotify('card', card.name);
  }

  function executeEnemyTurn(){
    const b = S.battle;
    if(!b || b.over) return;
    clearLog();
    let spoke = null;
    b.enemies.forEach(en=>{
      if(!en.alive) return;
      en.block = 0;
      /* 혼란 — 우두머리를 잃은 무리는 예고했던 행동 대신 반씩 얼어붙거나 서로를 문다 */
      if(en.confused>0){
        en.confused -= 1;
        const others = b.enemies.filter(o=>o!==en && o.alive);
        if(others.length && Math.random()<0.5){
          const target = pickOne(others);
          const dmg = Math.max(1, Math.round((en.atk||4)*0.8));
          pushLog(`${ga(foeDisplayName(en))} 혼란에 빠져 ${eul(foeDisplayName(target))} 물어뜯는다. (${dmg})`);
          damageEnemy(target, dmg, {from:null});
        } else {
          pushLog(`${ga(foeDisplayName(en))} 혼란에 빠져 그 자리에 얼어붙는다.`);
        }
        return;
      }
      const intent = en.intent;
      if(!intent) return;
      if(isWarden(en)) spoke = en;   /* 이 턴에 수문장이 움직였다 — 목소리는 뒤에 온다 */

      if(intent.type==='attack_reach'){
        const t = en.kind==='boss' ? pickBossTarget(en) : pickHeroTarget(en);
        if(t){
          pushLog(`${ga(foeDisplayName(en))} ${rankName(heroRank(t))}의 ${eul(t.name)} 노린다. (${intent.val})`);
          applyDamageToHero(t, intent.val, {from:en});
        } else pushLog(`${ga(foeDisplayName(en))} 허공을 할퀸다 — 닿지 않는다.`);

      } else if(intent.type==='double_attack_reach'){
        const t = en.kind==='boss' ? pickBossTarget(en) : pickHeroTarget(en);
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
          const t = (en.kind==='boss' ? pickBossTarget(en) : null) || alive[Math.floor(Math.random()*alive.length)];
          pushLog(`무언가 ${t.name}의 귀에 속삭인다. (심도압박 +${intent.val})`);
          addDp(t, intent.val); checkCollapse(t);
        }

      } else if(intent.type==='whisper_rear'){
        const t = en.kind==='boss' && en.phase>=2 ? pickBossTarget(en) : rearTarget();
        if(t){
          pushLog(`${ga(foeDisplayName(en))} 후미의 ${t.name}에게 속삭인다. (심도압박 +${intent.val})`);
          addDp(t, intent.val); checkCollapse(t);
        }

      } else if(intent.type==='snipe_lowest'){
        const pool = heroesInReach(en);
        if(pool.length){
          const t = en.kind==='boss' ? pickBossTarget(en) : pool.reduce((x,p)=> p.hp<x.hp ? p : x, pool[0]);
          pushLog(`${ga(foeDisplayName(en))} 가장 약한 ${eul(t.name)} 저격한다. (${intent.val})`);
          applyDamageToHero(t, intent.val, {stress:false, from:en});
        } else pushLog(`${ga(foeDisplayName(en))} 겨눌 표적을 찾지 못한다.`);

      } else if(intent.type==='guard_up'){
        en.block += intent.val;
        pushLog(`${ga(foeDisplayName(en))} 몸을 웅크린다. (방어 +${intent.val})`);
      }
    });
    /* 정신붕괴 중인 대원의 난동도 적 턴과 같은 자리에서 처리한다 —
       아군을 찍어 전멸을 부르거나, 적을 찍어 전투를 끝낼 수도 있다. */
    resolveMentalBreakdowns();
    /* 아군의 반격으로 마지막 적이 쓰러질 수 있다.
       전멸 확인을 아군 쪽만 하면, 적이 다 죽었는데 전투가 끝나지 않고
       빈 대열을 마주한 채 턴만 넘어간다. */
    /* 수문장의 목소리는 적 턴의 마지막에 온다. 앞에 두면 수행원들의 서술에
       밀려 세 줄 한도 밖으로 사라진다 — 맞고 나서 듣는 편이 더 서늘하기도 하다. */
    if(spoke && spoke.alive) wardenEcho(spoke);
    if(checkPartyWipe()) return;
    if(b.enemies.every(e=>!e.alive)) winBattle();
  }

  function checkPartyWipe(){
    if(aliveParty().length===0){ triggerGameOver('파티 전원이 심연에 잠겼다.'); return true; }
    return false;
  }
  function triggerGameOver(reason){
    /* 손패뿐 아니라 마지막 전투의 카드덱(뽑을 카드·버린 카드까지) 전체에서 고르게 한다 —
       죽는 순간 손에 없었다는 이유로 잃기엔 아까운 카드가 늘 있었다. */
    const b = S.battle;
    const battlePool = b ? (b.deck||[]).concat(b.hand||[], b.discard||[]) : [];
    const hand=battlePool.map(card=>Object.assign({},card,{contaminated:false,contaminationRisk:null,contaminationRevealed:false}));
    const lockerRecovery=recoverSalvageLocker(0.5);
    const recoveredOil=Math.floor((S.fuelCargo||0)*0.5)+lockerRecovery.oil;
    if(recoveredOil) addWhaleOil(recoveredOil);
    S.fuelCargo=0;
    S.farmRun=false;
    recordWorldStage(S.chapter,false);
    S.salvage={cards:hand, selectedCards:[], relics:(S.relics||[]).map(relic=>Object.assign({},relic)), selectedRelicId:null,
      research:1, recoveredOil:recoveredOil};
    /* 새 클래스를 직접 고르게 하던 자리를, 숙소에 근접·중거리·원거리 사거리가
       빠짐없이 갖춰지도록 자동으로 채워 넣는 것으로 바꾼다 — 전멸해도
       다음 대열에 아예 세울 수 없는 사거리가 생기지 않는다. */
    refillReachCoverageInResidence();
    clearRun();
    S.loseReason = reason;
    if(S.battle) S.battle.over = true;
    S.screen = 'salvage';
    render();
  }
  const EMERGENCY_ESCAPE_CHANCE = {'메아리의 여울':1, '역류의 이랑':0.8, '잔별의 구렁':0.5, '끝없는 심연':0.1};
  function emergencyEscapeChance(tier){ return EMERGENCY_ESCAPE_CHANCE[tier] || 0.1; }
  /* 비상 탈출은 패배 판정이 아니라 버릴 수 있는 마지막 선택지다.
     조건·확률에 막히면 카드는 이미 소모되지만, 전투와 탐사대는 그대로 남는다. */
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
      return failEmergencyEscape('비상 탈출 실패 — 체력이 절반 이하인 대원이 둘 이상이다. 잠수 케이블을 놓쳤다.');
    }
    const evacuees = S.party.filter(p=>p && p.alive && p.dp<50);
    if(!evacuees.length){
      return failEmergencyEscape('비상 탈출 실패 — 심도압박 50 미만인 대원이 없다. 누구도 잠수 케이블을 붙잡지 못했다.');
    }
    const chance = emergencyEscapeChance(b.tier);
    if(Math.random()>=chance){
      return failEmergencyEscape(`${chapterDisplayName(b.tier)}의 수압이 잠수 케이블을 끊었다. 비상 탈출에 실패했다. (성공 확률 ${Math.round(chance*100)}%)`);
    }
    b.over = true;
    const leftBehind = S.party.filter(p=>p && evacuees.indexOf(p)<0);
    const keptRelic = S.relics.length===1 ? S.relics[0] : null;
    S.emergencyExit = {tier:b.tier, chance:chance, evacuees:evacuees, leftBehind:leftBehind, keptRelic:keptRelic};
    /* 탐색 기록은 지우지 않는다 — 잠수 케이블로 빠져나오는 것은 이 전투 하나뿐이다 */
    S.screen = 'emergencyExit';
    render();
    return true;
  }

  /* 전투에서만 얻는 고래기름. 탐사 중에는 인양보관함에 넣어 들고 다닌다.
     프롤로그 전투는 기록용이므로 드롭하지 않는다. */
  function rollWhaleOilDrop(node){
    if(!S || S.prologue || !node) return 0;
    const chance=node.boss ? 1 : node.type==='elite' ? 0.62 : 0.24;
    if(Math.random() >= chance) return 0;
    const baseAmount=node.boss ? 2+Math.floor(Math.random()*3) : node.type==='elite' ? 1+Math.floor(Math.random()*2) : 1;
    const amount=Math.max(baseAmount, Math.round(baseAmount * pactOilMul() * farmDropMul()));
    S.salvageLocker=S.salvageLocker||{echoes:0,catalysts:0,oil:0};
    const cap=salvageLockerCapacity();
    const stored=Math.min(amount,Math.max(0,cap.oil-lockerOil()));
    S.salvageLocker.oil+=stored;
    S.logMsg=stored ? `고래기름 ${stored}개를 인양보관함에 넣었다.` : '인양보관함이 가득 차 고래기름을 더 담지 못했다.';
    return stored;
  }
  /* 비상 탈출은 탐색을 끝내지 않는다. 이 전투에서만 빠져나와 지도의 그 자리로
     돌아가고, 하던 탐색을 그대로 이어간다. 대신 값은 그 자리에서 치른다 —
     잠수 케이블을 붙잡지 못한 사람은 두고 오고, 유물도 하나만 건져 올린다.
     두고 온 자리는 등대 기지에서 새 사람을 앉히는 빈자리가 된다. */
  function finishEmergencyEscape(){
    const ex = S.emergencyExit;
    if(!ex) return;
    /* 인양줄은 누구도 버리지 않는다. 대신 살아남은 모든 대원이
       현재 HP의 절반과 현재 심도압박의 50% 증가를 감당한다. */
    (S.party||[]).filter(Boolean).forEach(p=>{
      p.alive=true;
      p.hp=Math.max(1,Math.floor(p.hp*0.5));
      p.dp=Math.min(100,Math.round((p.dp||0)*1.5));
      p.block=0;
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
      if((p.tauntTurns||0)>0){ p.tauntTurns--; if(p.tauntTurns<=0) p.tauntReduction=0; }
    });
    if(healed.length) pushLog(`성자의 마지막 기도의 여운 — ${healed.join(' · ')}`);
  }

  function endPlayerTurn(){
    const b = S.battle;
    if(!b || b.over || b.pendingCardUid || b.pendingDraw) return;
    if(!sayAllowsEndTurn()) return;
    clearReacts();   /* 적 턴에 생길 표식만 남도록 먼저 걷는다 */
    /* 에픽 이상은 손에 남는다. 남은 턴을 다 쓴 것만 버린 더미로 간다. */
    const kept = [], spent = [];
    b.hand.forEach(c=>{
      c.contaminated = false;
      if(!holdsInHand(c)){ spent.push(c); return; }
      c.heldTurns = (c.heldTurns || 0) + 1;
      if(c.heldTurns >= EPIC_HAND_TURNS){ c.heldTurns = 0; spent.push(c); }
      else kept.push(c);
    });
    if(spent.some(holdsInHand)) pushLog(`${eul(spent.filter(holdsInHand).map(c=>c.name).join(' · '))} 더 쥐고 있을 수 없다.`);
    b.discard.push(...spent);
    b.hand = kept;

    executeEnemyTurn();
    /* 침수된 방벽의 강제 반격은 이 적 턴에만 유지된다. */
    S.party.forEach(p=>{ if(p) p.bulwarkRiposte = 0; });
    if(b.over){ render(); return; }
    resolvePartyTurnEffects();

    /* 프롤로그의 잠식은 각본이 직접 잡는다 — 82 → 91 → 97 → 100 으로 조여야
       인양선이 끊기는 박자가 대사와 맞는다. 여기서 굴리면 그 박자가 흐트러진다. */
    if(S.prologue){
      aliveParty().forEach(p=>p.block=0);
      const carry = b.ap >= TEMP_AP_MIN ? TEMP_AP_CARRY : 0;
      b.turn += 1; b.ap = b.maxAp; b.tempAp = carry;
      if(S.erosion >= 82) S.erosion = Math.min(97, S.erosion + 9);
      rollIntents();
      if(sayWaiting() && sayWaiting().wait !== 'endturn') drawHand(Math.max(0, handSize() - b.hand.length));
      render();
      sayNotify('endturn');
      return;
    }

    const rise = b.tier==='역류의 이랑' ? 2 : (b.node && b.node.type==='elite' ? 1 : 0);
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
    drawHand(Math.max(0, handSize() - b.hand.length));
    render();
    /* 일반 전투의 첫 런 가이드도 턴 종료를 다음 단계로 넘겨야 한다. */
    sayNotify('endturn');
  }

  function winBattle(){
    /* 반격으로 끝난 전투도 일반 공격으로 끝난 전투와 같은 경로를 탄다.
       이미 끝난 전투를 다시 예약하지 않아, 반격 처리 뒤의 턴 정산이나
       늦게 도착한 타이머가 다음 화면을 덮어쓰지 않게 한다. */
    const b = S.battle;
    if(!b || b.over) return;
    b.over = true;
    pushLog('적이 물거품이 되어 흩어진다.');
    const node = b.node;
    setTimeout(()=>{
      if(!S || S.battle!==b || S.screen!=='battle') return;
      rollWhaleOilDrop(node);
      /* 심연 잔향은 일반 전투를 반복할수록 조금씩 쌓이는 정비 재화다.
         정예는 더 많이 주지만, 심해 촉매는 수문장에게서만 나온다. */
      if(node && node.boss){
        const stored=addDeepCatalyst(Math.max(1, Math.round(1*farmDropMul())));
        S.logMsg=stored ? `수문장의 핵에서 심해 촉매 ${stored}개를 회수했다.` : '인양보관함이 가득 차 심해 촉매를 담지 못했다.';
        /* 서약을 걸고 수문장을 넘긴 순간의 대열은 각 직업의 각성 진행도를 얻는다 */
        if((S.pactDepth||0) > 0){
          const classesHere = aliveParty().map(p=>p.cls).filter((c,i,arr)=>arr.indexOf(c)===i);
          classesHere.forEach(cls=>addAwakenedProgress(cls));
        }
      } else if(node && node.type==='elite'){
        const echoes=Math.max(1, Math.round((5+Math.min(3,S.chapter)) * farmDropMul()));
        const stored=addAbyssalEchoes(echoes);
        S.logMsg=`심연 잔향 ${stored}개를 인양보관함에 넣었다.`;
      } else if(node && node.type==='battle'){
        const echoes=Math.max(1, Math.round((2+Math.min(3,S.chapter)) * farmDropMul()));
        const stored=addAbyssalEchoes(echoes);
        S.logMsg=`심연 잔향 ${stored}개를 인양보관함에 넣었다.`;
      }
      /* 수문장을 넘긴 뒤에는 장면이 하나 지나간다. 노드를 닫는 것은 그 뒤다 —
         먼저 닫으면 보상 화면이 장면 위로 올라와 버린다. */
      const after = node && node.boss ? wardenAftermath(node.tier) : null;
      if(after){ sayRun(after, ()=>{ completeCurrentNode(); render(); }); return; }
      completeCurrentNode();
      render();
    }, 550);
  }
