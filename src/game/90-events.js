  /* ============ EVENTS ============ */
  /* 목록을 스크롤한 뒤에도 손을 뗀 지점의 카드가 눌리는 브라우저가 있다.
     강화/합성 선택에만 짧은 드래그 판정을 두어, 실제 탭만 선택으로 넘긴다. */
  const SELECT_ACTIONS = new Set(['select-upgrade','toggle-fuse','unpick-fuse']);
  /* 강화·합성 목록에서 카드를 고르면 방금 고른 카드가 화면 중앙으로 스크롤되어 온다 —
     목록이 길어 방금 누른 카드가 화면 밖으로 밀려도 항상 눈에 띄는 자리로 따라온다. */
  function scrollCardIntoView(defId){
    if(!defId) return;
    const el = app.querySelector(`[data-defid="${defId}"]`);
    if(el && typeof el.scrollIntoView==='function'){
      el.scrollIntoView({behavior:'smooth', block:'center', inline:'center'});
    }
  }
  let selectionGesture = null;
  let sliderGesture = null;
  let suppressSelectionClickUntil = 0;
  let suppressNewRunClickUntil = 0;
  function handleNewRunAction(){
    /* 이어하기가 가능한 저장 런이 있을 때만 삭제 확인을 거친다. */
    if(hasSavedRun()){
      menuOpen=true;
      menuStep='new-game';
      render();
    } else resetAndStartNewGame();
  }
  async function toggleFullscreen(){
    try{
      if(document.fullscreenElement){
        if(document.exitFullscreen) await document.exitFullscreen();
      } else if(document.documentElement.requestFullscreen){
        await document.documentElement.requestFullscreen();
      }
    }catch(e){
      /* 브라우저 정책·WebView 제한 환경에서는 일반 화면을 그대로 유지한다. */
      if(typeof console!=='undefined' && console.debug) console.debug('Fullscreen unavailable',e);
    }
  }
  /* iOS WebView 등 일부 모바일 환경은 위임된 click보다 pointerup을 먼저
     안정적으로 전달한다. 첫 화면의 새게임만 pointerup에서도 처리하고,
     뒤따르는 click은 잠시 무시해 두 번 새 런이 만들어지지 않게 한다. */
  app.addEventListener('pointerup', function(e){
    const el = e.target.closest('[data-action="new-run"]');
    if(!el || el.disabled) return;
    suppressNewRunClickUntil = performance.now() + 500;
    handleNewRunAction();
  });
  app.addEventListener('pointerdown', function(e){
    const slider=e.target.closest('.maintenance-slider');
    if(slider && e.pointerType!=='mouse'){
      sliderGesture={pointerId:e.pointerId, shell:slider, x:e.clientX, y:e.clientY, moved:false};
    }
    const el = e.target.closest('[data-action]');
    if(!el || !SELECT_ACTIONS.has(el.dataset.action)) return;
    selectionGesture = {pointerId:e.pointerId, x:e.clientX, y:e.clientY, moved:false};
  });
  app.addEventListener('pointermove', function(e){
    const s=sliderGesture;
    if(s && s.pointerId===e.pointerId){
      if(Math.hypot(e.clientX-s.x,e.clientY-s.y)>8) s.moved=true;
    }
    const g = selectionGesture;
    if(!g || g.pointerId!==e.pointerId || g.moved) return;
    if(Math.hypot(e.clientX-g.x, e.clientY-g.y) > 8) g.moved = true;
  });
  function finishSelectionGesture(e){
    const g = selectionGesture;
    if(!g || g.pointerId!==e.pointerId) return;
    if(g.moved) suppressSelectionClickUntil = performance.now() + 450;
    selectionGesture = null;
  }
  /* 카드 폭·간격을 미리 계산해 index*step 으로 밀어내는 방식은 clamp(vw) 로 카드 폭이
     소수점 단위로 흔들리는 모바일에서 카드마다 반올림 오차가 조금씩 쌓인다 — 그 오차가
     누적되어 넘길수록 한쪽으로 밀려났다(처음엔 왼쪽, 폭 계산을 고치니 이번엔 오른쪽).
     근본적으로 폭·간격을 추정하지 않고, 목표 카드의 실제 위치(offsetLeft)를 그대로 읽어
     화면 중앙에 강제로 맞춘다 — 카드마다 오차가 있어도 그 카드 자신의 실측값이라 절대
     어긋나지 않는다. */
  function positionCardSlider(track, index){
    const card = track && track.children[index];
    if(!card) return;
    /* 트랙 자체는 CSS(left:50%)로 이미 목록 컨테이너의 가운데에 걸려 있다.
       여기서는 그 지점에서 목표 카드의 실측 중심만큼만 반대로 당기면 된다. */
    const cardCenter = card.offsetLeft + card.offsetWidth/2;
    track.style.transform = `translateX(${Math.round(-cardCenter)}px)`;
  }
  function stepCardSlider(shell, direction){
    const track=shell && shell.querySelector('.maintenance-slider-track');
    if(!track) return;
    const total=parseInt(track.dataset.total||'1',10);
    let index=parseInt(track.dataset.index||'0',10)+direction;
    index=(index+total)%total;
    track.dataset.index=String(index);
    positionCardSlider(track, index);
    Array.from(track.children).forEach((card,i)=>card.classList.toggle('slider-active',i===index));
    const counter=shell.querySelector('.maintenance-slider-counter');
    if(counter) counter.textContent=`${index+1}/${total}`;
  }
  app.addEventListener('pointerup', function(e){
    const s=sliderGesture;
    if(!s || s.pointerId!==e.pointerId) return;
    if(Math.abs(e.clientX-s.x)>35 && Math.abs(e.clientX-s.x)>Math.abs(e.clientY-s.y)){
      stepCardSlider(s.shell,e.clientX<s.x?1:-1);
      suppressSelectionClickUntil=performance.now()+450;
    }
    sliderGesture=null;
  });
  app.addEventListener('pointercancel', function(e){ if(sliderGesture && sliderGesture.pointerId===e.pointerId) sliderGesture=null; });
  app.addEventListener('pointerup', finishSelectionGesture);
  app.addEventListener('pointercancel', finishSelectionGesture);
  app.addEventListener('click', function(e){
    /* 일반 대화·게임마스터 해설은 화면 어디를 눌러도 진행한다.
       전투 조작을 기다리는 비트와 선택지는 기존 입력을 그대로 받는다. */
    const clicked = e.target.closest('[data-action]');
    const clickedAction = clicked && clicked.dataset.action;
    const guideAction = clickedAction==='dismiss-upgrade-guide' || clickedAction==='dismiss-fusion-guide' || clickedAction==='dismiss-combat-guide';
    const menuAction = clickedAction==='open-menu' || clickedAction==='close-menu'
      || clickedAction==='menu-noop' || clickedAction==='menu-open-item'
      || clickedAction==='menu-back' || clickedAction==='menu-confirm'
      || clickedAction==='menu-toggle-setting' || clickedAction==='menu-guide-toggle';
    /* 안내 팝업은 대사 레이어가 남아 있어도 먼저 닫을 수 있어야 한다. */
    /* 대화 상자가 실제로 눌린 경우에만 대화를 진행한다.
       이전에는 SAY가 살아 있기만 하면 밑의 모든 data-action을 sayAdvance()가
       가로챘다. say-through 상태가 모바일/WebView에서 투명해지거나, 장면 전환
       중 대화 상태가 한 프레임 남는 경우에는 새 게임·맵·정비실 버튼까지 전부
       무시되는 문제가 생겼다. 실제 대화 진행 요소는 data-action으로 명확히
       구분되어 있으므로 그 경우만 먼저 처리한다. */
    if(clickedAction==='say-advance'){
      e.preventDefault();
      e.stopPropagation();
      sayAdvance();
      return;
    }
    const el = clicked;
    if(!el || el.disabled) return;
    const action = el.dataset.action;
    /* 일반 대화가 진행 중일 때는 밑 화면의 조작을 잠근다. 단, 사용자가
       명시적으로 누른 오프닝 건너뛰기와 메뉴/가이드 조작은 항상 허용한다. */
    if(SAY && !SAY.waiting && !sayChoiceOpen() && !guideAction && !menuAction
       && action!=='skip-opening' && action!=='enter-node'){
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    if(SELECT_ACTIONS.has(action) && performance.now() < suppressSelectionClickUntil){
      e.preventDefault();
      return;
    }
    if(action==='new-run' && performance.now() < suppressNewRunClickUntil){
      e.preventDefault();
      return;
    }
    if(el.closest('.maintenance-slider') && performance.now() < suppressSelectionClickUntil){
      e.preventDefault();
      return;
    }

    if(action==='toggle-fullscreen'){ toggleFullscreen(); return; }
    if(action==='open-menu'){ menuOpen=true; menuStep=null; render(); }
    /* 구버전 오프닝 저장 화면과의 호환용. 새 게임에서는 이 경로를 사용하지 않는다. */
    else if(action==='skip-opening'){ startDirectRun(); beginFirstRunBattle(); render(); }
    else if(action==='close-menu'){ menuOpen=false; menuStep=null; render(); }
    else if(action==='menu-noop'){ /* 팝업 내부 클릭이 바깥 배경 클릭(닫기)으로 번지지 않게 막는다 */ }
    else if(action==='menu-open-item'){
      const item = MENU_ITEMS.find(m=>m.id===el.dataset.menuId && (!m.show || m.show()));
      /* 하위 화면 없이 그 자리에서 뒤집히는 항목은 목록에 머무른다 —
         소리는 껐다 켜며 귀로 확인하는 것이라 메뉴가 닫히면 오히려 번거롭다. */
      if(item && item.view==='toggle'){ if(item.run) item.run(); }
      else if(item) menuStep = item.id;
      render();
    }
    else if(action==='menu-back'){ menuStep=null; render(); }
    else if(action==='menu-toggle-setting'){
      const t = SETTING_TOGGLES.find(x=>x.id===el.dataset.settingId);
      if(t) t.set(!t.get());
      render();
    }
    else if(action==='menu-guide-toggle'){
      const i = parseInt(el.dataset.index,10);
      guideOpen = (guideOpen===i) ? -1 : i;   /* 펼친 장을 다시 누르면 접는다 */
      render();
    }
    else if(action==='menu-confirm'){
      const item = MENU_ITEMS.find(m=>m.id===el.dataset.menuId);
      if(item && item.run) item.run();
      menuOpen=false; menuStep=null;
      render();
    }
    else if(action==='new-run'){
      handleNewRunAction();
    }
    else if(action==='continue-run'){
      markPlayed();
      if(loadRun()) render();
      else { startDirectRun(); beginFirstRunBattle(); render(); }
    }
    else if(action==='say-advance'){ sayAdvance(); }
    else if(action==='say-choose'){ sayChoose(parseInt(el.dataset.i,10)); }
    else if(action==='dismiss-contamination'){
      const preview=S.contaminationPreview;
      S.contaminationPreview=null;
      if(preview && preview.mode==='use'){
        const card=S.battle && S.battle.hand.find(c=>c.uid===preview.cardUid);
        if(card) card.contaminationRevealed=true;
        resolveCard(preview.cardUid,preview.targetInfo||null);
      } else {
        const queue=S.contaminationPreviewQueue||[];
        S.contaminationPreview=queue.shift()||null;
        S.contaminationPreviewQueue=queue;
        render();
      }
    }
    else if(action==='dismiss-core-guide'){
      if(S.battle) S.battle.coreGuide=false;
      markCoreGuideSeen();
      render();
    }
    else if(action==='dismiss-combat-guide'){
      const b=S.battle;
      const kind=el.dataset.kind;
      if(b && kind){
        if(!Array.isArray(b.combatGuideShown)) b.combatGuideShown=[];
        if(!b.combatGuideShown.includes(kind)) b.combatGuideShown.push(kind);
        markCombatRuleGuideSeen(kind);
        if(Array.isArray(b.combatGuideQueue) && b.combatGuideQueue[0]===kind) b.combatGuideQueue.shift();
      }
      render();
    }
    else if(action==='feed-lighthouse'){
      const used=lightWithWhaleOil(lighthouseOil());
      S.logMsg=used ? `고래기름 ${used}개를 등대에 부었다. 등대가 ${lighthouseStage()} 상태로 밝아졌다.` : '등대 연료고가 비어 있다.';
      render();
      if(used) lighthouseFeedFx();
    }

    else if(action==='toggle-class'){
      const st=S.setup; const id=el.dataset.id;
      const pos=st.selected.indexOf(id);
      if(pos>=0) st.selected.splice(pos,1);
      else if(st.selected.length < partyLimit()) st.selected.push(id);
      render();
    }
    else if(action==='classes-next'){
      if(S.setup.selected.length===partyLimit()){ S.setup.phase='assign-ranks'; S.setup.placements=[null,null,null,null]; S.setup.armed=null; render(); }
    }
    else if(action==='ranks-next'){
      const st=S.setup;
      if(st.placements.filter(Boolean).length===partyLimit()){
        st.phase='build-deck';
        /* 후보는 이 편성에 대해 한 번만 뽑는다 — 대열로 돌아갔다 와도 다시 굴리지 않는다.
           다시 굴릴 수 있으면 마음에 드는 패가 나올 때까지 오갈 뿐이라 고르는 값이 사라진다. */
        if(!st.offers || !Object.keys(st.offers).length){
          st.picks={};
          st.offers={};
          st.selected.forEach(cid=>{
            st.offers[cid] = shuffle(CARD_DB[cid].slice()).slice(0,CLASS_OFFER_SIZE).map(c=>c.name);
          });
          st.offers.neutral = startNeutralOffer();
        }
      }
      render();
    }
    else if(action==='deck-back'){
      S.setup.phase='assign-ranks'; render();
    }
    else if(action==='toggle-pick'){
      const st=S.setup;
      const g=el.dataset.group, name=el.dataset.name;
      const limit = g==='neutral' ? PICKS_NEUTRAL : PICKS_PER_CLASS;
      const cur = st.picks[g] || (st.picks[g]=[]);
      const at = cur.indexOf(name);
      if(at>=0) cur.splice(at,1);
      else if(cur.length < limit) cur.push(name);
      render();
    }
    else if(action==='classes-back'){
      const st=S.setup;
      st.phase='pick-classes'; st.placements=[null,null,null,null]; st.armed=null;
      if(!st.reform){ st.picks={}; st.offers={}; }
      render();
    }
    else if(action==='arm-hero'){
      const st=S.setup; const id=el.dataset.id;
      if(st.armed===id){ st.armed=null; }
      else {
        const placedIdx = st.placements.indexOf(id);
        if(placedIdx>=0) st.placements[placedIdx]=null;
        st.armed = id;
      }
      render();
    }
    else if(action==='place-rank'){
      const st=S.setup; const idx=parseInt(el.dataset.idx,10);
      if(st.armed){
        const displaced = st.placements[idx];
        st.placements[idx] = st.armed;
        st.armed = displaced;
      } else {
        const occ = st.placements[idx];
        if(occ){ st.placements[idx]=null; st.armed=occ; }
      }
      render();
    }
    else if(action==='confirm-setup'){
      const st=S.setup;
      const need  = st.selected.length*PICKS_PER_CLASS + PICKS_NEUTRAL;
      const total = st.selected.reduce((a,cid)=>a+((st.picks[cid]||[]).length),0) + ((st.picks.neutral||[]).length);
      if(st.placements.filter(Boolean).length===partyLimit() && total===need){
        S.party = buildPartyFromPlacements(st.placements);
        S.runDeck = buildRunDeck(st.selected, st.picks);
        S.starterDeckCardIds = S.runDeck.map(c=>c.defId);
        if(S.free){
          /* 자유 탐사는 편성이 끝난 뒤 첫 숨·서약 조항을 고르는 자리를 거친다 */
          S.firstBreath = null;
          S.firstBreathOilMul = 1; S.firstBreathUnknownMul = 1; S.firstBreathErosionMul = 1; S.firstBreathDepthBonus = 0;
          S.pactClauses = [];
          S.forcedClauses = forcedClauseIdsForRank(abyssRank());
          recomputePactDepth();
          S.screen = 'pactSetup';
        } else {
          drainLighthouseForDescent();
          S.screen = 'map';
        }
      }
      render();
    }

    else if(action==='enter-node'){ enterMapNode(el.dataset.id); render(); }
    else if(action==='world-to-tavern'){ S.screen='tavern'; render(); }

    else if(action==='play-card'){
      const uidVal = el.dataset.uid;
      const b = S.battle;
      if(!b || b.over) return;
      if(b.pendingCardUid===uidVal){ cancelTargeting(); render(); return; }
      const card = b.hand.find(c=>c.uid===uidVal);
      if(!card || !canPlayCard(card)) return;
      if(card.range==='ranged'){
        const targets = enemyTargetsFor(card);
        if(targets.length<=1){ resolveCard(uidVal, targets[0] ? {enemyIdx:b.enemies.indexOf(targets[0])} : null); }
        else { beginTargeting(uidVal,'enemy'); render(); }
      } else if(card.range==='support_ally'){
        const targets = aliveParty();
        /* 위치 교환은 대원이 하나뿐이어도 옮길 자리를 반드시 골라야 하므로,
           단일 대상이라고 곧장 정리하지 않고 항상 대상 선택부터 연다. */
        if(card.type==='reposition'){ beginTargeting(uidVal,'ally'); render(); }
        else if(targets.length<=1){ resolveCard(uidVal, targets[0] ? {allyId:targets[0].id} : null); }
        else { beginTargeting(uidVal,'ally'); render(); }
      } else {
        resolveCard(uidVal, null);
      }
    }

    else if(action==='choose-target'){
      const b = S.battle;
      if(!b || !b.pendingCardUid) return;
      const domain = el.dataset.domain;
      if(domain!==b.pendingDomain) return;
      const uidVal = b.pendingCardUid;
      if(domain==='enemy'){ resolveCard(uidVal, {enemyIdx: parseInt(el.dataset.idx,10)}); }
      else if(domain==='ally'){
        const card = b.hand.find(c=>c.uid===uidVal);
        /* 위치 교환은 대원을 고른 뒤 곧바로 정리하지 않고, 옮겨 갈 자리를 한 번 더 고르게 한다 */
        if(card && card.type==='reposition'){
          b.pendingRepositionFrom = el.dataset.id;
          b.pendingDomain = 'ally-slot';
          render();
        } else {
          resolveCard(uidVal, {allyId: el.dataset.id});
        }
      }
      else if(domain==='ally-slot'){
        /* 옮길 대원을 다시 누르면 마음을 바꾼 것으로 보고 카드 자체를 취소한다 */
        if(el.dataset.id===b.pendingRepositionFrom){ cancelTargeting(); render(); return; }
        resolveCard(uidVal, {allyId: b.pendingRepositionFrom, allyDestId: el.dataset.id});
      }
    }

    else if(action==='end-turn'){ endPlayerTurn(); }
    else if(action==='replace-draw'){
      if(replaceForPendingDraw(el.dataset.uid)) render();
    }

    else if(action==='rest-pick'){ chooseRest(el.dataset.kind); render(); }
    else if(action==='rest-confirm'){ confirmRest(); }

    else if(action==='aftermath-pick'){
      S.aftermath.selecting = el.dataset.kind;
      S.aftermath.upgradeSelected = null;
      if(el.dataset.kind==='fuse'){
        S.aftermath.fuseSelected=[];
        if(!hasSeenFusionGuide()) S.aftermath.fusionGuide = true;
      }
      if(el.dataset.kind==='upgrade' && !hasSeenUpgradeGuide()) S.aftermath.upgradeGuide = true;
      render();
    }
    else if(action==='select-card-reward'){
      if(S.aftermath){ S.aftermath.cardSelected = parseInt(el.dataset.index,10); render(); }
    }
    else if(action==='cancel-card-reward'){
      if(S.aftermath){ S.aftermath.cardSelected = null; render(); }
    }
    else if(action==='confirm-card-reward'){
      /* 돌려주는 값은 '덱에 들어갔는가' 이지 '아무 일도 없었는가' 가 아니다.
         에픽이 넘치면 덱에 넣지 않고 흡수 화면으로 넘어가면서 null 을 돌려주는데,
         그때 그리지 않으면 이미 비운 보상 목록이 그대로 남아 화면이 멎는다. */
      const idx = S.aftermath ? S.aftermath.cardSelected : null;
      if(Number.isInteger(idx)) claimCardReward(idx);
      render();
    }
    else if(action==='aftermath-back'){ S.aftermath.selecting=null; S.aftermath.fuseSelected=[]; S.aftermath.upgradeSelected=null; render(); }
    else if(action==='dismiss-upgrade-guide'){ markUpgradeGuideSeen(); S.aftermath.upgradeGuide=false; render(); }
    else if(action==='dismiss-fusion-guide'){ markFusionGuideSeen(); S.aftermath.fusionGuide=false; render(); }
    else if(action==='dismiss-card-system-guide'){
      markCardSystemGuideSeen();
      if(S.aftermath) S.aftermath.cardSystemGuide=false;
      render();
    }
    else if(action==='dismiss-battle-reward-guide'){
      markBattleRewardGuideSeen();
      if(S.aftermath) S.aftermath.rewardGuide=false;
      render();
    }
    else if(action==='dismiss-epic-guide'){ markEpicGuideSeen(); S.epicGuide=false; render(); }
    else if(action==='dismiss-sole-survivor-guide'){ S.soleSurvivorGuide=null; render(); }
    else if(action==='aftermath-skip'){ proceedAfterAftermath(); }
    else if(action==='select-upgrade'){
      const selectedId = S.aftermath.upgradeSelected;
      if(selectedId && selectedId!==el.dataset.defid) return;
      S.aftermath.upgradeSelected = selectedId===el.dataset.defid ? null : el.dataset.defid;
      render();
      scrollCardIntoView(S.aftermath.upgradeSelected);
    }
    else if(action==='do-upgrade'){
      const before = S.runDeck.find(c=>c.defId===el.dataset.defid);
      const wasEpic = isEpicCard(before);
      const card = applyUpgradeByDefId(el.dataset.defid);
      if(card){ S.aftermath.selecting=null; S.aftermath.upgradeSelected=null; S.aftermath.reveal={kind:'upgrade', card, epicAcquired:!wasEpic && isEpicCard(card)}; }
      render();
    }
    /* 선택된 합성 옵션을 다시 누르면 선택을 해제한다. */
    else if(action==='toggle-fuse'){
      const arr = S.aftermath.fuseSelected = Array.from(new Set(S.aftermath.fuseSelected));
      const group = groupedFusionOptions().find(g=>g.defIds.includes(el.dataset.defid));
      if(!group) return;
      const free = group.defIds.find(defId=>arr.indexOf(defId) < 0);
      let pushed = false;
      if(free && arr.length < 2){ arr.push(free); pushed = true; }
      render();
      if(pushed) scrollCardIntoView(free);
    }
    /* 아래 재료 상세는 고른 그 한 장을 가리킨다 — 누르면 그것만 뺀다 */
    else if(action==='unpick-fuse'){
      const arr = S.aftermath.fuseSelected;
      const at = arr.indexOf(el.dataset.defid);
      if(at >= 0) arr.splice(at, 1);
      render();
    }
    else if(action==='do-fuse'){
      if(S.aftermath.fuseSelected.length===2){
        const newCard = applyFusion(S.aftermath.fuseSelected[0], S.aftermath.fuseSelected[1]);
        S.aftermath.fuseSelected=[];
        /* 셋째 에픽이면 흡수 화면이 이미 화면을 가로챘다. 재료는 녹았으므로 합성은 끝난 것으로
           치고 여기서 행동을 차감한다 — 공개 화면을 거치지 않아 그쪽에서 차감되지 않는다. */
        if(S.screen==='epicAbsorb'){ S.aftermath.selecting=null; S.aftermath.actionsLeft--; }
        else if(newCard){ S.aftermath.selecting=null; S.aftermath.reveal={kind:'fuse', card:newCard, epicAcquired:isEpicCard(newCard)}; }
        render();
      }
    }
    else if(action==='reveal-confirm'){
      if(S.aftermath.reveal.kind==='reward'){ S.aftermath.reveal=null; render(); return; }
      S.aftermath.reveal = null;
      S.aftermath.actionsLeft--;
      if(S.aftermath.actionsLeft<=0) proceedAfterAftermath(); else render();
    }

    else if(action==='take-relic'){
      if(S.escape && !S.escape.taken){
        const relic = S.escape.offer.find(r=>r.id===el.dataset.id);
        if(relic){ S.escape.taken = relic; offerRelic(relic, 'escape'); render(); }
      }
    }
    else if(action==='emergency-keep-relic'){
      const ex = S.emergencyExit;
      const relic = ex && S.relics.find(r=>r.id===el.dataset.id);
      if(ex && relic){ ex.keptRelic = relic; S.relics = [relic]; render(); }
    }
    else if(action==='emergency-continue'){ finishEmergencyEscape(); render(); }
    else if(action==='salvage-card'){
      const sv=S.salvage;
      if(sv){
        const uid=el.dataset.uid;
        const at=sv.selectedCards.indexOf(uid);
        if(at>=0) sv.selectedCards.splice(at,1);
        else if(sv.selectedCards.length<3) sv.selectedCards.push(uid);
      }
      render();
    }
    else if(action==='salvage-relic'){
      if(S.salvage) S.salvage.selectedRelicId=S.salvage.selectedRelicId===el.dataset.id ? null : el.dataset.id;
      render();
    }
    else if(action==='salvage-confirm'){
      const sv=S.salvage;
      if(sv){
        const chosen=sv.cards.filter(card=>sv.selectedCards.includes(card.uid)).slice(0,3);
        const relic=sv.relics.find(item=>item.id===sv.selectedRelicId)||null;
        saveLastLetter({cards:chosen,relic:relic});
        addResearchPoints(sv.research||1);
        sv.confirmed=true;
      }
      S.salvage=null;
      S.screen='gameover';
      render();
    }
    else if(action==='select-relic-drop'){
      const sw = S.relicSwap;
      if(sw){ sw.selected = el.dataset.id; render(); }
    }
    else if(action==='cancel-relic-drop'){
      const sw = S.relicSwap;
      if(sw){ sw.selected = null; render(); }
    }
    else if(action==='confirm-relic-drop'){
      const sw = S.relicSwap;
      if(sw && sw.selected){
        const dropId = sw.selected;
        if(dropId !== sw.incoming.id){
          const drop = S.relics.find(r=>r.id===dropId);
          if(drop && canReplaceRelic(drop, sw.incoming)){ revokeRelic(drop); grantRelic(sw.incoming); }
        }
        S.screen = sw.back || 'map';
        S.relicSwap = null;
      }
      render();
    }
    else if(action==='epic-discard'){
      /* 첫째 걸음 — 하나를 두고 온다. 덱은 여기서 곧바로 정리된다. */
      discardEpic(el.dataset.defid || null);
      render();
    }
    else if(action==='epic-absorb'){
      const absorbed = applyEpicAbsorb(el.dataset.defid || null);
      /* 실제로 무게가 얹혔으면 결과 화면부터 보여준다 — 마지막 행동 처리는
         그 화면을 확인(epic-absorb-result-confirm)한 뒤로 미룬다. */
      if(!absorbed && S.screen==='aftermath' && S.aftermath && S.aftermath.actionsLeft<=0) proceedAfterAftermath();
      else render();
    }
    else if(action==='epic-absorb-result-confirm'){
      const res = S.epicAbsorbResult;
      S.epicAbsorbResult = null;
      S.screen = (res && res.back) || 'map';
      /* 합성으로 들어온 길이면 결과를 확인한 지금이 마지막 행동이 끝나는 자리다 */
      if(S.screen==='aftermath' && S.aftermath && S.aftermath.actionsLeft<=0) proceedAfterAftermath();
      else render();
    }
    else if(action==='to-tavern'){ enterTavern(); }   /* 안에서 귀환 연출 뒤 등대 기지까지 이어 간다 */
    else if(action==='tavern-character-detail'){
      if(S.tavern) S.tavern.detailId=el.dataset.id;
      render();
    }
    else if(action==='tavern-detail-close'){
      if(S.tavern) S.tavern.detailId=null;
      render();
    }
    else if(action==='tavern-detail-noop'){
      /* 팝업 패널 안쪽을 눌러도 배경 닫기 동작으로 번지지 않게 한다. */
    }
    else if(action==='open-residence'){
      const r=ensureResidence();
      recoverAtResidence();
      /* 숙소에 들어올 때마다 새로 대열을 짠다. 기존 파티는 확인 전까지 S.party에 남고,
         화면에서는 모든 캐릭터와 슬롯을 비활성화한 뒤 하나씩 선택한다. */
      r.selectedIds=[];
      r.placements=[null,null,null,null];
      r.armedId=null;
      S.screen='residence';
      render();
    }
    else if(action==='residence-arm'){
      const r=ensureResidence();
      const person=r.roster.find(c=>c.id===el.dataset.id);
      if(person && person.alive!==false){
        const placedAt=r.placements.indexOf(person.id);
        if(placedAt>=0){
          /* 이미 배치한 캐릭터를 다시 누르면 해당 슬롯을 비우고 선택 목록에서도 뺀다. */
          r.placements[placedAt]=null;
          r.selectedIds=r.selectedIds.filter(id=>id!==person.id);
          if(r.armedId===person.id) r.armedId=null;
        } else if(r.armedId===person.id){
          /* 아직 슬롯에 놓지 않은 선택 캐릭터를 다시 누르면 선택을 해제한다. */
          r.selectedIds=r.selectedIds.filter(id=>id!==person.id);
          r.armedId=null;
        } else if(r.selectedIds.length<partyLimit()){
          /* 배치되지 않은 대기 선택은 하나만 유지해, 캐릭터를 하나씩 배치한다. */
          r.selectedIds=r.selectedIds.filter(id=>r.placements.includes(id));
          r.selectedIds.push(person.id);
          r.armedId=person.id;
        }
      }
      render();
    }
    else if(action==='residence-dismiss'){
      if(dismissResidencePerson(el.dataset.id)) render();
    }
    else if(action==='residence-tab'){
      const r=ensureResidence();
      r.tab = el.dataset.tab==='graveyard' ? 'graveyard' : 'roster';
      render();
    }
    else if(action==='residence-revive'){
      if(reviveFromGraveyard(el.dataset.id)) render();
    }
    else if(action==='residence-character-detail'){
      const r=ensureResidence();
      r.detailId = el.dataset.id;
      render();
    }
    else if(action==='residence-detail-close'){
      const r=ensureResidence();
      r.detailId = null;
      render();
    }
    else if(action==='residence-place'){
      const r=ensureResidence();
      const idx=parseInt(el.dataset.index,10);
      const id=r.armedId;
      if(idx>=0 && idx<4 && idx<partyLimit() && r.placements[idx]){
        /* 채워진 슬롯을 누르면 그 자리의 캐릭터를 배치 목록에서 해제한다. */
        const removed=r.placements[idx];
        r.placements[idx]=null;
        r.selectedIds=r.selectedIds.filter(selectedId=>selectedId!==removed);
        if(r.armedId===removed) r.armedId=null;
        render();
      } else if(id && r.selectedIds.includes(id) && idx>=0 && idx<4 && idx<partyLimit() && !r.placements[idx]){
        r.placements[idx]=id;
        r.armedId=null;
        render();
      }
    }
    else if(action==='residence-cancel'){
      S.screen='tavern';
      render();
    }
    else if(action==='residence-confirm'){
      const r=ensureResidence();
      const placed=r.placements.filter(id=>id && r.selectedIds.includes(id));
      if(placed.length===r.selectedIds.length && applyResidenceParty()){ S.screen='tavern'; }
      render();
    }
    else if(action==='open-maintenance'){
      beginMaintenance();
      render();
    }
    else if(action==='open-institute'){
      S.screen='institute';
      render();
    }
    else if(action==='institute-close'){
      S.screen='tavern';
      render();
    }
    else if(action==='institute-exchange'){
      if(exchangeForResearch(el.dataset.kind)) render();
    }
    else if(action==='institute-upgrade-range'){
      if(upgradeLightRange()) render();
    }
    else if(action==='institute-unlock-necromancer'){
      if(unlockNecromancer()) render();
    }
    else if(action==='maintenance-tab'){
      if(S.maintenance){ S.maintenance.tab=el.dataset.tab; S.maintenance.upgradeSelected=null; S.maintenance.fuseSelected=[]; render(); }
    }
    else if(action==='card-slider-prev' || action==='card-slider-next'){
      const shell=el.closest('.maintenance-slider');
      stepCardSlider(shell,action==='card-slider-next'?1:-1);
    }
    else if(action==='maintenance-close'){
      finishMaintenance();
      S.screen='tavern';
      render();
    }
    else if(action==='locker-upgrade'){
      if(upgradeSalvageLocker()) render();
    }
    else if(action==='maintenance-toggle-deck'){
      const m=S.maintenance;
      if(m){
        const id=el.dataset.defid;
        const at=m.deckIds.indexOf(id);
        if(at>=0){
          /* 이미 선택한 카드/옵션을 다시 누르면 선택을 해제한다.
             덱이 잠시 0장이 되어도 다음 카드 선택으로 바로 복구할 수 있다. */
          m.deckIds.splice(at,1);
        }
        else if(m.deckIds.length<MAX_DECK_SIZE) m.deckIds.push(id);
        render();
      }
    }
    else if(action==='maintenance-select-upgrade'){
      const m=S.maintenance;
      if(m){
        m.upgradeSelected=m.upgradeSelected===el.dataset.defid ? null : el.dataset.defid;
        render();
        scrollCardIntoView(m.upgradeSelected);
      }
    }
    else if(action==='maintenance-unselect-upgrade'){
      const m=S.maintenance;
      if(m){ m.upgradeSelected=null; render(); }
    }
    else if(action==='maintenance-unpick-fuse'){
      const m=S.maintenance;
      if(m){ const at=m.fuseSelected.indexOf(el.dataset.defid); if(at>=0) m.fuseSelected.splice(at,1); render(); }
    }
    else if(action==='maintenance-do-upgrade'){
      const m=S.maintenance;
      if(m){
        const before=S.runDeck.find(c=>c.defId===el.dataset.defid);
        const wasEpic=before ? isEpicCard(before) : false;
        const card=applyUpgradeByDefId(el.dataset.defid);
        m.upgradeSelected=null;
        if(card) m.reveal={kind:'upgrade', card, epicAcquired:!wasEpic && isEpicCard(card)};
        render();
      }
    }
    else if(action==='maintenance-toggle-fuse'){
      const m=S.maintenance;
      if(m){
        const group=groupedFusionOptions().find(g=>g.defIds.includes(el.dataset.defid));
        if(!group) return;
        /* 목록의 한 줄은 같은 카드 여러 장을 묶어 표시한다. 첫 장을 고른 뒤
           같은 줄을 다시 누르면 기존 선택을 지우지 않고, 묶음 안의 다음 실제
           defId를 두 번째 재료로 채운다. 선택 해제는 아래 선택 목록에서 한다. */
        const free=group.defIds.find(id=>!m.fuseSelected.includes(id));
        let pushed=false;
        if(free && m.fuseSelected.length<2){ m.fuseSelected.push(free); pushed=true; }
        render();
        if(pushed) scrollCardIntoView(free);
      }
    }
    else if(action==='maintenance-do-fuse'){
      const m=S.maintenance;
      if(m && m.fuseSelected.length===2){
        const materials=m.fuseSelected.slice();
        const included=materials.some(id=>m.deckIds.includes(id));
        const result=applyFusion(materials[0],materials[1]);
        m.fuseSelected=[];
        m.deckIds=m.deckIds.filter(id=>(S.runDeck||[]).some(c=>c.defId===id));
        if(result && S.screen==='maintenance' && included) m.deckIds.push(result.defId);
        if(result) m.reveal={kind:'fuse', card:result, epicAcquired:isEpicCard(result), legendaryAcquired:isLegendaryCard(result)};
        render();
      }
    }
    else if(action==='maintenance-reveal-confirm'){
      const m=S.maintenance;
      if(m){ m.reveal=null; render(); }
    }
    else if(action==='reform-party'){
      const st = S.setup;
      st.reform = true;
      st.phase = 'pick-classes';
      st.selected = S.party.filter(p=>p && p.alive).map(p=>p.cls).slice(0, PARTY_MAX);
      st.placements = [null,null,null,null];
      st.armed = null;
      S.screen = 'classSelect';
      render();
    }
    else if(action==='confirm-reform'){
      const st = S.setup;
      if(st.reform && st.placements.filter(Boolean).length===st.selected.length){
        const joined = applyReform(st.placements);
        if(joined.length) S.logMsg = joined.map(c=>CLASS_DEFS[c].name).join(' · ') + '이(가) 합류했다.';
        st.reform = false;
        S.screen = 'tavern';
      }
      render();
    }
    else if(action==='tavern-slot'){ S.tavern.slot = parseInt(el.dataset.idx,10); render(); }
    else if(action==='tavern-cancel'){ S.tavern.slot = null; render(); }
    else if(action==='tavern-hire'){
      const tv = S.tavern;
      if(tv && tv.slot!==null && tv.slot!==undefined){
        const hero = recruitInto(tv.slot, el.dataset.cls);
        if(hero) tv.recruited.push(tv.slot);
        tv.slot = null;
        render();
      }
    }
    else if(action==='world-map'){
      /* 제목에서 들어와도 저장된 판을 먼저 되살린다 — 예전에는 여기서 newRun() 을
         돌려 파티와 덱을 통째로 비웠고, 그래서 자유 탐사에 들어갈 때마다 숙소·정비실에서
         짜 둔 대열과 덱을 버리고 병과·카드를 다시 고르게 만들었다.
         되살릴 판이 아예 없을 때만 새 판을 연다. */
      if(S.screen==='title'){
        markPlayed();
        if(!loadRun()) newRun();
      }
      enterWorldMap(); render();
    }
    else if(action==='resume-campaign'){ resumeCampaignSnapshot(); render(); }
    /* 해도의 지점은 고르기만 한다 — 실제로 내려가는 것은 하단 버튼이다 */
    else if(action==='world-pick'){ S.worldPick = el.dataset.tier; render(); }
    else if(action==='foray-begin'){ beginForay(el.dataset.tier); render(); }
    else if(action==='fixed-tide-begin'){
      S.farmRun = true;
      beginForay(el.dataset.tier || S.worldPick || '메아리의 여울');
      render();
    }
    else if(action==='pact-first-breath'){ toggleFirstBreath(el.dataset.id); render(); }
    else if(action==='pact-clause-toggle'){ togglePactClause(el.dataset.id); render(); }
    else if(action==='pact-confirm'){ confirmPactSetup(); render(); }
    else if(action==='imprint-remove'){ removeImprint(el.dataset.id, el.dataset.imprint); render(); }
    else if(action==='awaken-signature'){ awakenSignatureCard(el.dataset.cls); render(); }
    else if(action==='rest-return'){ returnFromRest(); }
    else if(action==='foray-to-world-map'){ forayToWorldMap(); }
    else if(action==='descend'){
      /* 마지막 하강 앞에서는 플레이어 파티가 지금까지의 기록을 확인하고 내려간다 */
      const words = nextChapterIsFinal() ? abyssTestimony() : null;
      if(words) sayRun(words, ()=>{ descendNextChapter(); render(); sayCurtain('in', 760); });
      else { descendNextChapter(); render(); }
    }

    else if(action==='restart'){ restartFromGameOver(); }
    else if(action==='continue-after-victory'){ continueAfterVictory(); }
  });

  newRun();
  render();
})();
