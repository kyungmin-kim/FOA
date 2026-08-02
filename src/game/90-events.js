  /* ============ EVENTS ============ */
  /* 목록을 스크롤한 뒤에도 손을 뗀 지점의 카드가 눌리는 브라우저가 있다.
     강화/합성 선택에만 짧은 드래그 판정을 두어, 실제 탭만 선택으로 넘긴다. */
  const SELECT_ACTIONS = new Set(['select-upgrade','toggle-fuse']);
  let selectionGesture = null;
  let suppressSelectionClickUntil = 0;
  app.addEventListener('pointerdown', function(e){
    const el = e.target.closest('[data-action]');
    if(!el || !SELECT_ACTIONS.has(el.dataset.action)) return;
    selectionGesture = {pointerId:e.pointerId, x:e.clientX, y:e.clientY, moved:false};
  });
  app.addEventListener('pointermove', function(e){
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
  app.addEventListener('pointerup', finishSelectionGesture);
  app.addEventListener('pointercancel', finishSelectionGesture);
  app.addEventListener('click', function(e){
    const el = e.target.closest('[data-action]');
    if(!el || el.disabled) return;
    const action = el.dataset.action;
    if(SELECT_ACTIONS.has(action) && performance.now() < suppressSelectionClickUntil){
      e.preventDefault();
      return;
    }

    if(action==='open-menu'){ menuOpen=true; menuStep=null; render(); }
    else if(action==='close-menu'){ menuOpen=false; menuStep=null; render(); }
    else if(action==='menu-noop'){ /* 팝업 내부 클릭이 바깥 배경 클릭(닫기)으로 번지지 않게 막는다 */ }
    else if(action==='menu-open-item'){
      const item = MENU_ITEMS.find(m=>m.id===el.dataset.menuId);
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
      wipeAllSaves();
      markPlayed();
      startPrologue();
      render();
    }
    else if(action==='continue-run'){
      markPlayed();
      if(loadRun()) render();
      else { newRun(); S.screen='classSelect'; render(); }
    }
    else if(action==='prologue-begin'){ beginPrologueBattle(); render(); }
    else if(action==='prologue-abyss'){ finishPrologue(); render(); }
    else if(action==='prologue-real-run'){ newRun(); S.screen='classSelect'; render(); }

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
        S.screen = 'map';
      }
      render();
    }

    else if(action==='enter-node'){ enterMapNode(el.dataset.id); render(); }

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
        if(targets.length<=1){ resolveCard(uidVal, targets[0] ? {allyId:targets[0].id} : null); }
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
      else if(domain==='ally'){ resolveCard(uidVal, {allyId: el.dataset.id}); }
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
      if(el.dataset.kind==='fuse') S.aftermath.fuseSelected=[];
      if(el.dataset.kind==='upgrade' && !hasSeenUpgradeGuide()) S.aftermath.upgradeGuide = true;
      render();
    }
    else if(action==='take-card-reward'){
      if(claimCardReward(parseInt(el.dataset.index,10))) render();
    }
    else if(action==='aftermath-back'){ S.aftermath.selecting=null; S.aftermath.fuseSelected=[]; S.aftermath.upgradeSelected=null; render(); }
    else if(action==='dismiss-upgrade-guide'){ markUpgradeGuideSeen(); S.aftermath.upgradeGuide=false; render(); }
    else if(action==='aftermath-skip'){ proceedAfterAftermath(); }
    else if(action==='select-upgrade'){
      const selectedId = S.aftermath.upgradeSelected;
      if(selectedId && selectedId!==el.dataset.defid) return;
      S.aftermath.upgradeSelected = selectedId===el.dataset.defid ? null : el.dataset.defid;
      render();
    }
    else if(action==='do-upgrade'){
      const before = S.runDeck.find(c=>c.defId===el.dataset.defid);
      const wasEpic = isEpicCard(before);
      const card = applyUpgradeByDefId(el.dataset.defid);
      if(card){ S.aftermath.selecting=null; S.aftermath.upgradeSelected=null; S.aftermath.reveal={kind:'upgrade', card, epicAcquired:!wasEpic && isEpicCard(card)}; }
      render();
    }
    else if(action==='toggle-fuse'){
      const id = el.dataset.defid;
      S.aftermath.fuseSelected = Array.from(new Set(S.aftermath.fuseSelected));
      const arr = S.aftermath.fuseSelected;
      const group = groupedFusionOptions().find(g=>g.defIds.includes(id));
      if(!group) return;
      const selectedId = arr.find(defId=>group.defIds.includes(defId));
      if(selectedId) arr.splice(arr.indexOf(selectedId),1);
      else if(arr.length<2) arr.push(group.defId);
      render();
    }
    else if(action==='do-fuse'){
      if(S.aftermath.fuseSelected.length===2){
        const newCard = applyFusion(S.aftermath.fuseSelected[0], S.aftermath.fuseSelected[1]);
        S.aftermath.fuseSelected=[];
        if(newCard){ S.aftermath.selecting=null; S.aftermath.reveal={kind:'fuse', card:newCard, epicAcquired:isEpicCard(newCard)}; }
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
    else if(action==='relic-drop'){
      const sw = S.relicSwap;
      if(sw){
        const dropId = el.dataset.id;
        if(dropId !== sw.incoming.id){
          const drop = S.relics.find(r=>r.id===dropId);
          if(drop && canReplaceRelic(drop, sw.incoming)){ revokeRelic(drop); grantRelic(sw.incoming); }
        }
        S.screen = sw.back || 'map';
        S.relicSwap = null;
      }
      render();
    }
    else if(action==='to-tavern'){ enterTavern(); render(); }
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
    /* 젖은 명패 하나를 고른다 — 해금하고, 자리가 비어 있으면 곧바로 앉힌다.
       나머지 명패는 그대로 두었다가 다음 인양 때 다시 젖는다. */
    else if(action==='plate-take'){
      const tv = S.tavern;
      const def = tv ? takeUnlock(el.dataset.cls) : null;
      if(def){
        tv.plates = [];
        tv.unlocked = def.id;
        const seat = openSlots()[0];
        if(seat!==undefined && recruitInto(seat, def.id)){
          tv.recruited.push(seat);
          tv.seated = true;
        }
        if(S.escape) S.escape.plates = [];
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
    else if(action==='descend'){ descendNextChapter(); render(); }

    else if(action==='restart'){ newRun(); render(); }
  });

  newRun();
  render();
})();
