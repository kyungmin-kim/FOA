  /* ============ MAP FLOW ============ */
  /* 갈림길은 한 번 뽑으면 고정된다 — 다시 그린다고 선택지가 바뀌면 고를 이유가 없다 */
  function availableNodes(){
    if(!S.mapChoices) S.mapChoices = rollChoices();
    return S.mapChoices;
  }
  function aftermathActionsFor(node){
    if(node.type==='rest') return 0;
    if(node.type==='elite' || node.boss) return 2;
    return 1;
  }
  function enterMapNode(id){
    const node = availableNodes().find(n=>n.id===id);
    if(!node) return;
    S.pendingNode = node;
    if(node.type==='battle' || node.type==='elite'){
      startBattle(node);
    } else if(node.type==='rest'){
      if(addErosion(EROSION_REST)){ triggerGameOver('숨을 고르는 사이 잠식이 한계를 넘었다.'); return; }
      S.rest = {choice:null};
      S.screen = 'rest';
    } else if(node.type==='treasure'){
      completeCurrentNode();
    }
  }
  function completeCurrentNode(){
    const node = S.pendingNode;
    S.mapVisited.push(node);
    S.mapChoices = null;
    S.stepInChapter += 1;
    S.party.forEach(p=>{ if(p) p.block=0; });
    const actions = aftermathActionsFor(node);
    const dropped = isBossTier(node) ? dropRelic() : null;
    const cardOffer = (node.type==='battle' || node.type==='elite') && S.runDeck.length<MAX_DECK_SIZE ? cardRewardOffer(node) : null;
    const surfaced = S.stepInChapter >= chapter().length;
    S.afterAftermath = !surfaced ? 'map' : (isFinalChapter() ? 'result' : 'escape');
    if(surfaced){
      const finalAbyss = isFinalChapter();
      const growth = rewardExtractionSurvivors(finalAbyss ? 2 : 1.3, finalAbyss);
      if(finalAbyss) S.finalGrowth = growth;
      else {
        const marker = markerRewardForChapter(S.chapter);
        S.escape = {offer:relicOffer(), taken:null, plates:unlockCandidates().map(d=>d.id), growth:growth, marker:marker};
      }
    }
    if(actions>0){
      S.aftermath = {actionsLeft:actions, selecting:null, fuseSelected:[], reveal:null, dropped:dropped, cardOffer:cardOffer, cardTaken:null};
      S.screen = 'aftermath';
    } else {
      S.screen = S.afterAftermath;
    }
    /* 자리가 없으면 무엇을 버릴지 먼저 고르고, 그다음 원래 가려던 화면으로 */
    offerRelic(dropped, S.screen);
  }
  function proceedAfterAftermath(){
    S.aftermath = null;
    S.screen = S.afterAftermath || 'map';
    /* 끝난 런은 이어받을 것이 없다 */
    if(S.screen==='result') clearRun();
    render();
  }

  /* 인양 — 수면으로 올라왔으니 잠식 시계가 처음으로 돌아가고, 숨과 상처를 어느 정도 되찾는다.
     이게 없으면 뒤로 갈수록 길어지는 구역을 버틸 방법이 없다. */
  function enterTavern(){
    /* plates 는 아직 고르지 않은 젖은 명패들, unlocked 는 이미 고른 사람.
       고르기 전에는 여관에 들어서자마자 명패 벽이 먼저 열린다. */
    S.tavern = {recruited:[], slot:null, plates:(S.escape && S.escape.plates) ? S.escape.plates.slice() : [], unlocked:null, seated:false};
    S.screen = 'tavern';
  }

  function descendNextChapter(){
    S.chapter += 1;
    S.stepInChapter = 0;
    S.mapChoices = null;
    S.pendingNode = null;
    S.escape = null;
    S.tavern = null;
    S.erosion = 0;
    S.party.forEach(p=>{
      if(!p || !p.alive) return;
      p.hp = Math.min(p.maxHp, p.hp + Math.round(p.maxHp*0.4));
      setDp(p, p.dp - 30);
      p.block = 0;
      p.collapsed = false;
    });
    S.screen = 'map';
  }

  function chooseRest(kind){ S.rest.choice = kind; }
  function confirmRest(){
    const alive = aliveParty();
    if(S.rest.choice==='heal'){ alive.forEach(p=>p.hp=Math.min(p.maxHp,p.hp+Math.round(10*relicMul('healMul', p)))); S.logMsg='상처를 돌본다.'; }
    else if(S.rest.choice==='calm'){ alive.forEach(p=>setDp(p, p.dp-18)); S.logMsg='잠시 눈을 감고 숨을 고른다.'; }
    completeCurrentNode();
    render();
  }

