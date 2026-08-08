  /* ============ MAP FLOW ============ */
  /* 갈림길은 한 번 뽑으면 고정된다 — 다시 그린다고 선택지가 바뀌면 고를 이유가 없다.

     S.mapWindow 는 [지금 갈림길, 그다음 칸, ... 수문장 칸]까지 챕터에 남은 칸 전체를
     담는 배열이다 — 미니맵이 챕터 전체를 한 번에 보여주므로 다 미리 굴려 둔다.

     문제는 nodeKindAllowed(25-chapter-data.js)의 쿨다운·최소전투수 게이트가 '실제로
     걸어온 경로'(S.mapVisited)만 읽는다는 것이다. 아직 아무도 고르지 않은 갈림길
     너머를 굴리려면 '직전 칸이 뭐였는지' 가 필요한데, 그 갈림길에 1~3개 옵션이 있으면
     아직 정해지지 않은 값이다. 그래서 각 칸을 굴릴 때 그 칸의 첫 번째 옵션을
     '가정한 직전 칸'으로 삼아 S.mapVisited 에 잠깐 얹어 둔 채 다음 칸을 굴리고,
     다 굴린 뒤 얹은 만큼 도로 걷어낸다 — nodeKindAllowed 쪽은 한 글자도 안 건드리면서
     챕터 전체에 걸쳐 쿨다운·회수 할당량이 그럴듯하게 나온다.

     시작 전에 한 번 굴려 두면 그 결과는 챕터가 끝날 때까지 다시 바뀌지 않는다 —
     실제로 어느 옵션을 골랐든(첫 옵션이 엘리트였는데 다른 걸 골랐어도) 미니맵에 이미
     보여준 다음 칸의 종류를 나중에 덮어쓰지 않는다. 그래서 "엘리트 직후는 반드시
     은신처" 규칙은 그 갈림길의 첫 옵션(가정한 직전 칸)이 엘리트일 때만 정확히
     맞아떨어지고, 둘째·셋째 옵션이 엘리트인 경우까지는 보장하지 않는다 — 처음 보여준
     구조를 그대로 지키는 쪽을 골랐다. */
  function ensureMapWindow(){
    if(!Array.isArray(S.mapWindow)) S.mapWindow = [];
    const realStep = S.stepInChapter;
    const total = Math.max(0, chapter().length - realStep);
    let borrowed = 0;
    for(let off=0; off<total; off++){
      /* 지금 갈림길(off===0)도 아직 실제로 고른 게 아니므로, 그 첫 옵션을 '가정한
         직전 칸'으로 빌려서 다음 칸들의 게이트 판정에 쓴다. chapterVisited()(25-chapter-data.js)
         가 S.stepInChapter 만큼 mapVisited 꼬리를 잘라 쓰므로, 빌리는 동안은 step 도
         함께 늘려야 그 꼬리 계산이 어긋나지 않는다 — 끝나면 둘 다 되돌린다. */
      if(!S.mapWindow[off]) S.mapWindow[off] = rollChoicesAt(realStep+off, off===0);
      S.mapVisited.push(S.mapWindow[off][0]);
      S.stepInChapter++;
      borrowed++;
    }
    if(borrowed){
      S.mapVisited.splice(S.mapVisited.length-borrowed, borrowed);
      S.stepInChapter = realStep;
    }
  }
  function availableNodes(){
    if(S.mapBranch) return branchAvailableNodes();
    ensureMapWindow();
    return S.mapWindow[0];
  }
  /* 챕터 전체(지금 갈림길부터 수문장까지)를 미리 굴려 둔 것 — 게이트 계산(위 주석)이
     챕터 전체에 걸쳐 일관되려면 한 번에 다 굴려야 하지만, 미니맵 렌더러(renderMap)는
     이 중 mapWindow[0](=availableNodes())만 그리고 나머지는 안개 뒤에 숨겨 둔다. */
  function wholeMapWindow(){
    if(S.mapBranch) return [branchAvailableNodes()];
    ensureMapWindow();
    return S.mapWindow;
  }

  const MAP_BRANCH_LANES = 3;
  function canStartMapBranch(step){
    const remaining=chapter().length-step;
    return !firstRunActive() && step===2 && !S.mapBranch && !S.mapBranchPlan && remaining>=7;
  }
  function makeMapBranchPlan(step){
    const routeLength=3+Math.floor(Math.random()*2);
    /* 이 갈래는 한 번에 통째로 미리 굴린다 — nodeKindAllowed 는 '실제로 지나온
       경로'(S.mapVisited)만 보므로, 같은 갈래 안에서 방금 놓은 보물·은신처를 다음
       칸을 굴릴 때는 모른다. 그래서 갈래마다 '보물/은신처 이후 몇 칸' · '직전 종류'를
       따로 누적해서, 쿨다운과 '전투·엘리트 뒤에만' 규칙을 이 안에서도 지킨다.
       분기 진입 칸(fork)은 battle 로 고정되므로 그 뒤를 잇는 시작점으로 삼는다. */
    const treasureGate = NODE_GATES.treasure || {};
    const treasureCooldown = treasureGate.cooldown || 0;
    const afterKinds = treasureGate.after || null;
    const sinceTreasureAtFork = nodesSinceKind('treasure');
    const treasureBudget = Math.max(0, kindQuota('treasure') - visitedKindCount('treasure'));
    const restGate = NODE_GATES.rest || {};
    const restCooldown = restGate.cooldown || 0;
    const restMinBattlesOk = restGate.minBattles==null || battlesInCurrentChapter() >= restGate.minBattles;
    const sinceRestAtFork = nodesSinceKind('rest');
    const routes=Array.from({length:MAP_BRANCH_LANES},()=>{
      let sinceTreasure = sinceTreasureAtFork;
      let sinceRest = sinceRestAtFork;
      let prevKind = 'battle';
      let placed = 0;
      return Array.from({length:routeLength},(_,i)=>{
        const kinds=['battle','battle','elite'];
        const afterOk = !afterKinds || afterKinds.indexOf(prevKind)>=0;
        if(i>0 && afterOk && sinceTreasure>=treasureCooldown && placed<treasureBudget) kinds.push('treasure');
        if(restMinBattlesOk && sinceRest>=restCooldown) kinds.push('rest');
        const kind = kinds[Math.floor(Math.random()*kinds.length)];
        sinceTreasure = kind==='treasure' ? 0 : sinceTreasure+1;
        sinceRest = kind==='rest' ? 0 : sinceRest+1;
        if(kind==='treasure') placed++;
        prevKind = kind;
        return makeNode(kind);
      });
    });
    const merge=makeNode('battle');
    merge.branchMerge=true;
    return {id:'branch-'+nextId(), forkStep:step, routeLength:routeLength, routes:routes,
            lane:null, progress:0, merge:merge};
  }
  function branchAvailableNodes(){
    const b=S.mapBranch;
    if(!b) return [];
    if(b.progress<b.routeLength) return [b.routes[b.lane][b.progress]];
    return [b.merge];
  }
  function beginMapBranch(node){
    const plan=S.mapBranchPlan;
    if(!plan || !node || node.branchId!==plan.id) return;
    S.mapBranch=Object.assign({},plan,{lane:node.branchLane,progress:0});
    S.mapBranchPlan=null;
    S.mapWindow=[];
  }
  function aftermathActionsFor(node){
    if(node.type==='rest') return 0;
    /* 회수는 더 이상 강화대가 아니다 — 건져 올린 것을 받고 나가는 자리라 정화 기회가 없다 */
    if(node.type==='treasure') return 0;
    if(node.type==='elite' || node.boss) return 2;
    return 1;
  }
  /* 회수 노드가 남기는 것 — 카드 아니면 유물이다. 카드가 더 자주 나오되, 덱이 가득 차면
     넣을 자리가 없으니 유물로 돌린다. 유물 쪽이 바닥나면 completeCurrentNode 가 다시
     카드로 되돌린다 — 빈손으로 나가는 회수는 없다. */
  const TREASURE_RELIC_CHANCE = 0.35;
  function rollTreasureFind(){
    if(!S.runDeck || S.runDeck.length >= MAX_DECK_SIZE) return 'relic';
    return Math.random() < TREASURE_RELIC_CHANCE ? 'relic' : 'card';
  }
  function enterMapNode(id){
    const options = availableNodes();
    const node = options.find(n=>n.id===id);
    if(!node) return;
    if(node.branchFork) beginMapBranch(node);
    /* 실제로 뜬 선택지 전체를 알 수 있는 시점은 여기뿐이다 — 노드 종류가 갈리기 전에
       몇 번째를 골랐는지부터 기록한다(89-secret-paths.js). */
    const secret = recordPathChoice(options, node);
    S.pendingNode = node;
    if(node.type==='battle' || node.type==='elite'){
      /* 수문장 앞에서는 먼저 장면이 지나간다. 각본이 끝나면 그 자리에서 전투가 열린다.
         각본이 없는 층은 곧바로 싸운다 — 아직 안 쓴 층에서 멈추지 않게 한다. */
      const meeting = node.boss ? wardenMeeting(node.tier) : null;
      if(meeting){
        startBattle(node); render();
        if(S.battle && S.battle.coreGuide){
          sayRun(coreBattleGuide(), ()=>{ S.battle.coreGuide=false; markCoreGuideSeen(); sayRun(meeting); });
        } else sayRun(meeting);
        return;
      }
      startBattle(node);
      if(S.battle && S.battle.coreGuide){
        render();
        sayRun(coreBattleGuide(), ()=>{
          S.battle.coreGuide=false;
          markCoreGuideSeen();
          if(secret && secret.scene) sayRun(secret.scene);
        });
      } else if(secret && secret.scene) sayRun(secret.scene);
    } else if(node.type==='rest'){
      if(addErosion(EROSION_REST)){ triggerGameOver('숨을 고르는 사이 잠식이 한계를 넘었다.'); return; }
      S.rest = {choice:null};
      S.screen = 'rest';
      if(secret && secret.scene) sayRun(secret.scene);
    } else if(node.type==='treasure'){
      completeCurrentNode();
      if(secret && secret.scene) sayRun(secret.scene);
    }
  }
  /* 새 런의 첫 화면은 미니맵이 아니라 실제 전투다.
     첫 갈림길에서 전투 노드를 우선 선택하고, 전투가 끝난 뒤부터 지도 선택을 연다. */
  function beginFirstRunBattle(){
    const options = availableNodes();
    const first = options.find(node=>node.type==='battle' || node.type==='elite') || options[0];
    if(first) enterMapNode(first.id);
  }
  /* 유일한 생존자 — 원래 둘 이상이던 대열이 수문장을 넘긴 순간 단 한 명만 살아
     있으면 발동한다. 닻 랭크를 두 단계 밀어 올리고, 그 순간의 몸 적응은 평소보다
     훨씬 크게 남는다. 업적은 한 번만 해금되지만, 보상은 발동할 때마다 받는다. */
  const SOLE_SURVIVOR_TIERS = ['bronze','silver','gold'];
  const SOLE_SURVIVOR_TIER_MIN = {bronze:1, silver:3, gold:6};
  const SOLE_SURVIVOR_STAT_MUL = 1.35;
  function rankUpSoleSurvivorAnchor(hero){
    const curTier = survivalRankTier(hero.descentWins||0);
    const curIdx = curTier ? SOLE_SURVIVOR_TIERS.indexOf(curTier) : -1;
    const targetTier = SOLE_SURVIVOR_TIERS[Math.min(SOLE_SURVIVOR_TIERS.length-1, curIdx+2)];
    hero.descentWins = Math.max(hero.descentWins||0, SOLE_SURVIVOR_TIER_MIN[targetTier]);
  }
  function checkSoleSurvivorAchievement(node){
    if(!node || !node.boss) return;
    const total = (S.party||[]).filter(Boolean).length;
    const alive = aliveParty();
    if(total<=1 || alive.length!==1) return;
    const hero = alive[0];
    hero.maxHp = Math.max(1, Math.round(hero.maxHp*SOLE_SURVIVOR_STAT_MUL));
    hero.hp = hero.maxHp;
    hero.attackPower = Math.round((hero.attackPower||1)*SOLE_SURVIVOR_STAT_MUL*100)/100;
    hero.defensePower = Math.round((hero.defensePower||1)*SOLE_SURVIVOR_STAT_MUL*100)/100;
    rankUpSoleSurvivorAnchor(hero);
    markSoleSurvivorAchievement();
    S.soleSurvivorGuide = {name:hero.name};
    pushLog(`${hero.name} — 유일한 생존자. 홀로 심연을 넘었다.`);
  }
  function completeCurrentNode(){
    const node = S.pendingNode;
    S.mapVisited.push(node);
    S.stepInChapter += 1;
    /* 정찰 창을 한 칸 당긴다 — 방금 지나온 칸(오프셋 0)을 버리고 나머지를 앞으로 민다.
       시작 전에 한 번 굴려 둔 구조는 이후로 다시 덮어쓰지 않는다 — 실제로 어느 옵션을
       골랐든 미니맵에 이미 보였던 다음 칸의 종류는 그대로 유지된다. */
    S.mapWindow = (S.mapWindow||[]).slice(1);
    if(S.mapBranch){
      if(node && node.branchMerge) S.mapBranch=null;
      else if(node && !node.branchFork) S.mapBranch.progress += 1;
      /* 분기 중에는 일반 미래 노드를 섞지 않는다. 합류 노드를 끝낸 뒤
         현재 위치 기준으로 본선 지도를 다시 굴린다. */
      if(S.mapBranch) S.mapWindow=[];
      else ensureMapWindow();
    } else ensureMapWindow();
    S.party.forEach(p=>{ if(p) p.block=0; });
    /* 강화·합성은 등대 기지의 정비실에서만 가능하다. 전투 후에는 전투 재화와
       카드 보상(또는 회수 유물)만 정리하고 곧바로 다음 노드로 이어진다. */
    const actions = 0;
    const rewardGuide = (node.type==='battle' || node.type==='elite' || node.boss) && !hasSeenBattleRewardGuide();
    const salvaged = (node.type==='treasure' && rollTreasureFind()==='relic') ? dropRelic() : null;
    const dropped = isBossTier(node) ? dropRelic() : salvaged;
    /* 회수에서 유물이 나오지 않았으면(주사위든, 목록이 바닥났든) 카드를 건진다 */
    const wantsCard = node.type==='battle' || node.type==='elite' || (node.type==='treasure' && !dropped);
    const cardOffer = wantsCard && S.runDeck.length<MAX_DECK_SIZE ? cardRewardOffer(node) : null;
    const surfaced = S.stepInChapter >= chapter().length;
    if(S.foray) S.foray.nodes += 1;
    /* 자유 탐사에는 인양도 다음 하강도 없다. 층을 끝까지 밀면 그 자리에서 탐사가 닫힌다.
       적응을 주지 않으므로 rewardExtractionSurvivors 도 타지 않는다. */
    if(S.free){
      checkSoleSurvivorAchievement(node);
      S.afterAftermath = surfaced ? 'forayResult' : 'map';
      if(actions>0 || cardOffer || dropped){
        S.aftermath = {actionsLeft:actions, selecting:null, fuseSelected:[], reveal:null, dropped:dropped, cardOffer:cardOffer, cardSelected:null, cardTaken:null, rewardGuide:rewardGuide};
        S.screen = 'aftermath';
      } else {
        S.screen = S.afterAftermath;
      }
      offerRelic(dropped, S.screen);
      return;
    }
    S.afterAftermath = !surfaced ? 'map' : (firstRunActive() ? 'escape' : (isFinalChapter() ? 'result' : 'escape'));
    if(surfaced){
      const finalAbyss = isFinalChapter();
      const growth = rewardExtractionSurvivors(finalAbyss ? 2 : 1.3, finalAbyss);
      if(finalAbyss){
        S.finalGrowth = growth;
        if(node && node.boss) markWorldClear();
      }
      if(node && node.boss) recordWorldStage(S.chapter,true);
      checkSoleSurvivorAchievement(node);
      /* 수문장을 넘겨 층을 닫든, 수문장 없이 층을 닫든 똑같이 인양 화면을 채운다.
         예전에는 수문장으로 층을 닫을 때(가장 흔한 경우)는 이 자리를 건너뛰어
         S.escape 가 비워진 채로 남았고, 화면에는 아무 것도 못 고르는 빈 목록만
         뜨면서 다음으로 넘어갈 버튼조차 없었다. */
      if(!finalAbyss){
        const marker = markerRewardForChapter(S.chapter);
        S.escape = {offer:relicOffer(), taken:null,
          growth:growth, marker:marker};
      }
    }
    /* 정화 기회가 없어도 건진 것이 있으면 화면을 연다 — 회수는 그 자리에서 받는다 */
    if(actions>0 || cardOffer || dropped){
      S.aftermath = {actionsLeft:actions, selecting:null, fuseSelected:[], reveal:null, dropped:dropped, cardOffer:cardOffer, cardSelected:null, cardTaken:null, rewardGuide:rewardGuide};
      S.screen = 'aftermath';
    } else {
      S.screen = S.afterAftermath;
    }
    /* 자리가 없으면 무엇을 버릴지 먼저 고르고, 그다음 원래 가려던 화면으로 */
    offerRelic(dropped, S.screen);
  }
  function proceedAfterAftermath(){
    S.aftermath = null;
    /* 층을 끝까지 민 자유 탐사는 결과를 챙기고 닫는다 */
    if(S.free && S.afterAftermath==='forayResult'){ finishForay('cleared'); render(); return; }
    /* 첫 출정은 다섯 번째 노드의 보상만 정리한 뒤 곧장 등대 기지로 돌아온다.
       수문장이나 다음 해역으로 이어지지 않으며, 여기서 첫 방문자가 합류한다. */
    if(S.firstRun && S.afterAftermath==='escape'){ enterTavern(); return; }
    S.screen = S.afterAftermath || 'map';
    /* 끝난 런은 이어받을 것이 없다 */
    if(S.screen==='result'){
      settleFuelCargo();
      clearRun();
    }
    render();
    /* 수면으로 올라온 자리에서 실종자의 신호가 잡힌다. 보상 화면 위에서 장면만 돈다. */
    if(S.screen==='escape'){
      const rescue = rescueScript();
      if(rescue) sayRun(rescue);
    }
    /* 수면으로 돌아온 자리 — 기록 장치가 묻지도 않은 것을 먼저 적어 둔다 */
    if(S.screen==='result') sayRun(abyssReturn());
  }

  /* 귀환 연출은 등대 기지 화면을 열기 전에 항상 한 번 재생한다.
     장면 대사와 분리해 두어 첫 출정처럼 자동 귀환하는 경우에도 같은 순서를 지킨다. */
  const LIGHTHOUSE_RETURN_CUTSCENE_MS = 4200;
  let lighthouseReturnCutsceneTimer = null;
  let lighthouseReturnCutsceneDone = null;
  function startLighthouseReturnCutscene(done){
    if(lighthouseReturnCutsceneTimer) clearTimeout(lighthouseReturnCutsceneTimer);
    lighthouseReturnCutsceneDone = typeof done==='function' ? done : null;
    S.screen = 'returnCutscene';
    render();
    lighthouseReturnCutsceneTimer = setTimeout(finishLighthouseReturnCutscene, LIGHTHOUSE_RETURN_CUTSCENE_MS);
  }
  function finishLighthouseReturnCutscene(){
    if(lighthouseReturnCutsceneTimer) clearTimeout(lighthouseReturnCutsceneTimer);
    lighthouseReturnCutsceneTimer = null;
    if(S.screen!=='returnCutscene') return;
    const done = lighthouseReturnCutsceneDone;
    lighthouseReturnCutsceneDone = null;
    if(done) done();
  }

  /* 인양 — 수면으로 올라왔으니 잠식 시계가 처음으로 돌아가고, 숨과 상처를 어느 정도 되찾는다.
     이게 없으면 뒤로 갈수록 길어지는 구역을 버틸 방법이 없다. */
  function enterTavern(){
    /* 잃은 인원 수를 여기서 먼저 세어 둔다 — 아래에서 숙소 명단을 정리하고 나면
       누가 죽었는지는 roster 의 alive 플래그로만 남는다. */
    const lostCount = (S.party||[]).filter(p=>p && !p.alive).length;
    settleFuelCargo();
    recoverSalvageLocker(1);
    recoverAtResidence();
    /* 구조는 물속에서 이미 끝났다. 등대 기지는 무작위로 찾아온 새 대원이 머무는 자리다. */
    S.tavern = {recruited:[], slot:null, unlocked:null, seated:false};
    const firstOracleArrival = !!S.firstRun && S.chapter===0;
    const returnGuest = addResidenceGuest(firstOracleArrival ? 'oracle' : null);
    /* 첫 런은 사망한 객체도 자리로 센다. 죽은 대원을 빈 슬롯으로 보지 않으면
       첫 귀환에서 예언자만 숙소에 남고, 다음 하강이 2~3인으로 시작하는 문제가 생긴다. */
    if(firstOracleArrival){
      const emptySeats=[];
      for(let i=0;i<PARTY_MAX;i++){
        const p=S.party[i];
        if(!p || !p.alive) emptySeats.push(i);
      }
      const aliveClasses=new Set(S.party.filter(p=>p&&p.alive).map(p=>p.cls));
      const requiredClasses=BASE_CLASSES.filter(cls=>!aliveClasses.has(cls));
      const guests=[returnGuest];
      while(guests.length<emptySeats.length){
        const forced=requiredClasses.shift() || null;
        guests.push(addResidenceGuest(forced));
      }
      emptySeats.forEach((seat,i)=>{
        const guest=guests[i];
        const hero=guest ? recruitInto(seat,guest) : null;
        if(hero) S.tavern.recruited.push(seat);
      });
      S.tavern.unlocked = 'oracle';
      S.tavern.seated = S.tavern.recruited.length>0;
    } else {
      /* 본편은 기존 규칙대로 매 귀환 신규 대원 1명과 사망자 보충분을 숙소에 보낸다. */
      for(let i=1; i<lostCount; i++) addResidenceGuest();
    }
    const residence = ensureResidence();
    residence.selectedIds = S.party.filter(p=>p&&p.alive).map(p=>p.characterId||p.id);
    residence.placements = residence.selectedIds.slice();
    residence.armedId = null;
    /* 죽은 자리를 숙소의 다른 생환자로 자동 충원한다 — 다음 하강이 항상 4인
       대열로 시작할 수 있게. 첫 런의 강제 합류(위)는 이미 자리를 채웠으므로
       건드리지 않는다. */
    if(!firstOracleArrival) autoFillResidenceSelection();
    /* 첫 출정의 성공은 여기까지 무사히 돌아온 시점에 확정된다. */
    if(S.firstRun) S.firstRun = false;
    const returnScene = surfaceReturnScene();
    const tavern = tavernScene();
    const scene = (returnScene || []).concat(tavern || []);
    sayStop();
    startLighthouseReturnCutscene(()=>{
      S.screen = 'tavern';
      render();
      if(scene.length) sayRun(scene);
    });
  }

  /* 본편 완주 화면("다시 등대를 지킨다")에서 여기로 들어온다. 예전에는 게임오버
     재시도와 같은 경로(restartFromGameOver→startDirectRun)를 타서, 이겼는데도
     파티·덱·유물이 전부 초기화되고 자유 탐사 대신 챕터 1부터 새로 시작해 버렸다.
     완주는 죽은 것이 아니므로, 지금 대열을 그대로 안고 자유 탐사로 넘어간다. */
  function continueAfterVictory(){
    S.free = true;
    enterTavern();
  }

  /* ============ 자유 탐사 ============
     끝까지 내려가 본 뒤에 열린다. 이미 지나온 층을 골라 다시 내려가되, 은신처에서
     언제든 줄을 잡고 올라올 수 있다 — 본편의 '되돌아갈 길이 없다' 를 깨지 않으려고
     이 문은 완주 전에는 아예 없다.

     생환자 적응(최대 체력 ×1.3)은 여기서 주지 않는다. 인양 횟수에 상한이 없어지므로
     몇 판만 돌아도 적이 의미를 잃는다. 자유 탐사의 사냥감은 카드와 유물이다 —
     둘 다 21장·3칸으로 이미 상한이 있어 끝없이 강해지지 않는다. */
  function enterWorldMap(){
    /* S.free 를 켜기 전에, 아직 본편을 못 끝낸 채 처음 들어오는 거라면 지금
       서 있던 자리를 스냅샷으로 떼어 둔다. */
    snapshotCampaignIfNeeded();
    S.free = true;
    S.foray = null;
    /* 해도에 들어서는 순간 이미 대열이 서 있어야 한다 — 화면 아래의 '지금 대열'
       표시와 하단 버튼이 같은 대열을 말하게 하려면 여기서 확보해 둔다. */
    ensureExpeditionParty();
    S.screen = 'worldMap';
  }
  /* 한 번의 탐사를 연다. 대열과 덱은 등대 기지에서 짜 온 것을 그대로 안고 간다. */
  function beginForay(tier){
    const idx = chapterIndexForTier(tier);
    if(idx < 0) return;
    S.free = true;
    S.chapter = idx;
    S.stepInChapter = 0;
    /* 같은 층에 다시 들어와도 길이·노드 비율을 새로 굴린다 — 반복 진입할 때마다
       구성이 달라지도록 한다. */
    S.chapterVariant = null;
    S.mapWindow = [];
    S.mapBranchPlan = null;
    S.mapBranch = null;
    S.pendingNode = null;
    S.pathCode = [];
    S.escape = null;
    S.tavern = null;
    S.erosion = 0;
    /* 자유 탐사의 대열은 등대 기지 숙소에서 고른 사람들이고, 덱은 정비실에서 고른
       카드다 — 여기서는 절대 다시 묻지 않는다. 세울 대열이 없는 경우까지
       ensureExpeditionParty 가 안에서 처리한다.
       덱 기준선(deckAt)은 그 뒤에 재야 이번 탐사에서 실제로 늘어난 카드만 세어진다. */
    ensureExpeditionParty();
    S.foray = {tier:tier, nodes:0, deckAt:(S.runDeck||[]).length, relicsAt:(S.relics||[]).map(r=>r.id)};
    S.firstBreath = null;
    S.firstBreathOilMul = 1; S.firstBreathUnknownMul = 1; S.firstBreathErosionMul = 1; S.firstBreathDepthBonus = 0;
    S.pactClauses = [];
    S.forcedClauses = forcedClauseIdsForRank(abyssRank());
    recomputePactDepth();
    S.screen = 'pactSetup';
  }
  /* 잠수종 문이 닫히고 실제로 그 층에 들어서는 순간 — 층 이름을 한 번 더 새겨 준다.
     귀환 연출과 같은 틀(타이머로 열고 닫는 화면)을 그대로 빌리되, 색과 문구만 다르다. */
  const STAGE_ENTRY_CUTSCENE_MS = 3200;
  let stageEntryCutsceneTimer = null;
  let stageEntryCutsceneDone = null;
  function startStageEntryCutscene(tier, done){
    if(stageEntryCutsceneTimer) clearTimeout(stageEntryCutsceneTimer);
    stageEntryCutsceneDone = typeof done==='function' ? done : null;
    S.stageEntryTier = tier;
    S.screen = 'stageEntryCutscene';
    render();
    stageEntryCutsceneTimer = setTimeout(finishStageEntryCutscene, STAGE_ENTRY_CUTSCENE_MS);
  }
  function finishStageEntryCutscene(){
    if(stageEntryCutsceneTimer) clearTimeout(stageEntryCutsceneTimer);
    stageEntryCutsceneTimer = null;
    if(S.screen!=='stageEntryCutscene') return;
    const done = stageEntryCutsceneDone;
    stageEntryCutsceneDone = null;
    if(done) done();
  }
  /* 첫 숨·서약 조항을 다 고른 뒤, 실제로 잠수종 문을 닫고 내려간다 */
  function confirmPactSetup(){
    drainLighthouseForDescent();
    S.party.forEach(p=>{
      if(!p || !p.alive) return;
      restoreForDescent(p);
    });
    const tier = (S.foray && S.foray.tier) || chapter().tier;
    startStageEntryCutscene(tier, ()=>{ S.screen='map'; render(); });
  }
  function toggleFirstBreath(id){
    if(S.firstBreath===id){
      S.firstBreath = null;
      S.firstBreathOilMul=1; S.firstBreathUnknownMul=1; S.firstBreathErosionMul=1; S.firstBreathDepthBonus=0;
    } else {
      pickFirstBreath(id);
    }
    recomputePactDepth();
  }
  function togglePactClause(id){
    if(!pactClauseDef(id) || (S.forcedClauses||[]).indexOf(id)>=0) return;
    const i = S.pactClauses.indexOf(id);
    if(i>=0) S.pactClauses.splice(i,1); else S.pactClauses.push(id);
    recomputePactDepth();
  }
  /* 탐사를 닫고 결과를 챙긴다. reason 은 'returned'(줄을 잡고 올라왔다) 또는 'cleared'(끝까지 밀었다). */
  function finishForay(reason){
    const oilSettled = settleFuelCargo();
    const recovered = recoverSalvageLocker(1);
    const f = S.foray || {tier:currentTier(), nodes:0, deckAt:(S.runDeck||[]).length, relicsAt:[]};
    const before = f.relicsAt || [];
    /* 서약을 걸고 무사히 귀환했을 때만 각인이 붙고, 그 탐사가 최심층 완주였다면
       심연 계위가 오른다. 둘 다 성공적인 귀환(finishForay)에서만 판정한다. */
    const imprintsGranted = rollImprintForSurvivors();
    /* 파밍이든 아니든, 자유 탐사에서 무사히 귀환할 때마다 누적 횟수가 오른다.
       이 횟수가 에픽·전설 드롭률과 위협 배율을 함께 밀어 올린다. */
    const expeditionTotal = advanceExpeditionCount();
    let rankAdvanced = false;
    if(reason==='cleared' && f.tier==='끝없는 심연' && (S.pactDepth||0)>0){
      advanceAbyssRank();
      rankAdvanced = true;
    }
    /* 고정 조수(파밍 던전)로 들어왔던 판이면 이번에 실제로 건진 양을 누적 기록에 더한다. */
    const wasFarmRun = !!S.farmRun;
    let farmGained = null;
    if(wasFarmRun){
      farmGained = {oil: oilSettled + recovered.oil, echoes: recovered.echoes, catalysts: recovered.catalysts};
      recordFixedTideRun(farmGained.oil, farmGained.echoes, farmGained.catalysts);
      S.farmRun = false;
    }
    S.forayResult = {
      tier: f.tier,
      reason: reason,
      nodes: f.nodes || 0,
      cards: Math.max(0, (S.runDeck||[]).length - (f.deckAt||0)),
      relics: (S.relics||[]).filter(r=>before.indexOf(r.id) < 0).map(r=>r.name),
      erosion: Math.round(S.erosion),
      fallen: S.party.filter(p=>p && !p.alive).map(p=>p.name),
      imprintsGranted: imprintsGranted,
      rankAdvanced: rankAdvanced,
      trueEnding: hasTrueEnding(),
      farmRun: wasFarmRun,
      farmGained: farmGained,
      farmTotals: wasFarmRun ? fixedTideStats() : null,
      expeditionTotal: expeditionTotal,
    };
    S.foray = null;
    S.battle = null;
    S.pendingNode = null;
    S.mapWindow = [];
    S.erosion = 0;
    S.dpPeakSeen = 0;
    S.erosionPeakSeen = 0;
    S.pactClauses = [];
    S.pactDepth = 0;
    S.firstBreath = null;
    S.firstBreathOilMul = 1;
    S.firstBreathUnknownMul = 1;
    S.firstBreathErosionMul = 1;
    S.firstBreathDepthBonus = 0;
    S.screen = 'forayResult';
  }
  /* 은신처에서 줄을 잡는다. 그 노드는 완료로 치지 않는다 — 다녀온 것이 아니라 그만둔 것이다. */
  function returnFromRest(){
    if(!S.free) return;
    finishForay('returned');
    render();
  }
  /* 결과를 확인하고 등대 기지로. 거기서 대열을 다시 짜고 해도로 돌아간다. */
  /* 결과를 확인한 뒤에는 등대 기지에 들르지 않고 곧장 해도로 돌아간다 — 반복
     탐사 중에는 매번 등대 기지 → '해도를 편다' 두 번 누르게 하지 않기 위해서다.
     귀환 시 새 합류자가 들어오는 것 같은 기지 쪽 처리는 화면에 보이지 않아도
     그대로 진행한다. */
  function forayToWorldMap(){
    S.forayResult = null;
    S.tavern = {recruited:[], slot:null, unlocked:null, seated:false};
    addResidenceGuest();
    sayStop();
    startLighthouseReturnCutscene(()=>{
      enterWorldMap();
      render();
    });
  }

  /* 내려가기 직전의 몸 상태 — 인양이든 자유 탐사든 같은 규칙을 쓴다.
     체력은 최대치의 95%로 맞춘다. 올려 주기도 하고 깎기도 한다 — 수면에 올라와도
     완전히 회복되지는 않으며, 멀쩡하던 사람도 한 칸은 잃은 채로 내려간다.
     심도압박은 남은 값의 30%만 덜어낸다. 정액으로 빼면 후반의 높은 압박에서
     사실상 아무 일도 일어나지 않으므로 비율로 둔다. */
  const DESCENT_HP_RATIO = 0.95;
  const DESCENT_DP_RELIEF = 0.30;
  function restoreForDescent(p){
    p.hp = Math.max(1, Math.round(p.maxHp * DESCENT_HP_RATIO));
    setDp(p, p.dp * (1 - DESCENT_DP_RELIEF));
    p.block = 0;
    p.collapsed = false;
    p.breakdown = 0;
  }

  function descendNextChapter(){
    S.chapter += 1;
    recordWorldStage(S.chapter,false);
    S.stepInChapter = 0;
    /* 다음 층으로 넘어갈 때마다 길이·노드 비율을 새로 굴린다 */
    S.chapterVariant = null;
    S.mapWindow = [];
    S.mapBranchPlan = null;
    S.mapBranch = null;
    S.pendingNode = null;
    S.pathCode = [];
    S.escape = null;
    S.tavern = null;
    S.erosion = 0;
    drainLighthouseForDescent();
    S.party.forEach(p=>{
      if(!p || !p.alive) return;
      restoreForDescent(p);
    });
    S.screen = 'map';
  }

  /* 은신처에서 고르는 두 값. 화면·가이드·실제 처리 세 곳이 같은 수를 말해야 하므로
     한 자리에 둔다 — 예전에는 가이드 문구에만 옛 수치가 남아 압박 -30 이라고 적혀 있었다. */
  const REST_HEAL = 10;
  const REST_CALM = 18;
  function chooseRest(kind){ S.rest.choice = kind; }
  function confirmRest(){
    const alive = aliveParty();
    if(S.rest.choice==='heal'){ alive.forEach(p=>p.hp=Math.min(p.maxHp,p.hp+Math.round(REST_HEAL*relicMul('healMul', p)))); S.logMsg='상처를 돌본다.'; }
    else if(S.rest.choice==='calm'){ alive.forEach(p=>setDp(p, p.dp-REST_CALM)); S.logMsg='잠시 눈을 감고 숨을 고른다.'; }
    completeCurrentNode();
    render();
  }
