  /* ============ 대화 ============
     각본은 코드가 아니라 비트(beat)의 목록이다. 한 줄이 곧 한 박자다.

       {who:'대장', text:'롤랑, 막아.'}    말하는 사람과 대사
       {note:'카드는 AP를 소비한다.'}        해설·규칙 설명 — 한 번에 하나만
       {fade:'out'|'in', ms:400}            장면 전환
       {pause:600}                           잠깐 멈춘다
       {wait:'card', name:'놋쇠 벽'}         여기서 멈추고 조종을 플레이어에게 넘긴다
       {choice:[{text:'…', then:[…]}]}       갈림 — 고른 가지를 그 자리에 끼운다
       {do:fn}                               무대 장치를 움직인다 (적 배치·잠식 등)

     왜 이 모양인가.

       예전에는 stage==='brace' && card.name==='놋쇠 벽' 같은 조건이 상태·전투·렌더
       세 조각에 흩어져 있었다. 각본이 서른 박자로 늘면 그 방식은 못 버틴다.
       비트가 스스로 '무엇을 기다리는지' 말하게 하면, 조건은 이 파일 한 곳에 모인다.

     이 층은 #content 바깥에 산다. render() 는 #content 만 갈아 끼우므로, 대화가
     도는 동안 밑의 전투 화면이 몇 번을 다시 그려져도 타이핑이 끊기지 않는다.

     SAY 를 S 바깥에 두는 것도 같은 이유다. 저장에 딸려 들어가면 대화 한복판에서
     끊긴 판이 생기는데, 그건 이어붙일 수가 없다. 대화는 언제나 처음부터 돈다. */
  let SAY = null;

  const SAY_TYPE_MS = 26;          /* 글자 하나가 드러나는 간격 */
  const SAY_TYPE_MAX = 1400;       /* 긴 줄도 이보다 오래 끌지 않는다 */

  function sayLayer(){ return document.getElementById('say'); }
  function curtainLayer(){ return document.getElementById('curtain'); }
  /* 장면 연출이 사는 층. 막과 어둠보다 위에 있어 검은 화면 위에서도 보인다. */
  function sceneFxLayer(){ return document.getElementById('scenefx'); }
  /* 말이 나오는 동안의 어둠. #say 와 갈라 두어야 그 위의 연출이 함께 눌리지 않는다. */
  function setSceneDim(on){
    const el = document.getElementById('scenedim');
    if(el) el.className = on ? 'on' : '';
  }

  function sayActive(){ return !!SAY; }
  function sayWaiting(){ return SAY ? SAY.waiting : null; }
  /* 선택지를 고르는 장면은 화면 전체 탭으로 넘기지 않는다 — 버튼 선택이 먼저다. */
  function sayChoiceOpen(){
    if(!SAY) return false;
    const beat = SAY.beats[SAY.i - 1];
    return !!(beat && beat.choice);
  }

  /* 각본을 시작한다. onDone 은 마지막 비트를 지난 뒤에 부른다. */
  function sayRun(beats, onDone){
    /* 돌던 각본이 있으면 먼저 걷는다. 남은 타이머가 새 각본을 제멋대로 밀고 나갈 수 있다. */
    if(SAY && SAY.timer) clearTimeout(SAY.timer);
    SAY = { beats: beats.slice(), i:0, waiting:null, done:onDone || null, shownAt:0, typeMs:0, timer:null };
    sayStep();
  }
  function sayStop(){
    if(SAY && SAY.timer) clearTimeout(SAY.timer);
    SAY = null;
    setSceneDim(false);
    const el = sayLayer();
    if(el){ el.innerHTML = ''; el.className = ''; }
  }

  /* 다음 비트로. 기다리는 중이면 움직이지 않는다 — 그건 플레이어의 차례다. */
  function sayStep(){
    if(!SAY) return;
    if(SAY.waiting) return;
    if(SAY.i >= SAY.beats.length){
      const done = SAY.done;
      sayStop();
      /* 각본이 도는 동안 카드와 버튼은 잠겨 있었다. 끝났으면 그것부터 풀어 준다 —
         여기서 다시 그리지 않으면 밑의 화면이 잠긴 모습 그대로 남는다. */
      render();
      if(done) done();
      return;
    }
    const beat = SAY.beats[SAY.i++];

    if(beat.do){ beat.do(); return sayStep(); }

    if(beat.fade){
      sayPaint(null);
      sayCurtain(beat.fade, beat.ms || 420, ()=>sayStep());
      return;
    }
    if(beat.pause){
      /* tap 을 준 멈춤은 눌러서 먼저 넘길 수 있다. 읽는 속도는 사람마다 다르므로
         충분히 오래 두되, 다시 보는 사람이 기다리지 않게 한다. */
      sayPaint(beat.tap ? {hold:true} : null);
      SAY.timer = setTimeout(()=>{ if(SAY) SAY.timer = null; sayStep(); }, beat.pause);
      return;
    }
    if(beat.wait){
      /* 조종을 넘긴다. 말풍선은 걷고 안내만 남긴다 — 카드가 눌려야 하므로 층을 비운다. */
      SAY.waiting = beat;
      sayPaint(beat);
      render();
      return;
    }
    /* 말·설명·갈림은 화면에 얹고 손길을 기다린다 */
    sayPaint(beat);
  }

  /* 플레이어가 대화를 눌렀다. 아직 타이핑 중이면 먼저 끝까지 드러낸다. */
  function sayAdvance(){
    if(!SAY || SAY.waiting) return;
    /* 멈춤을 기다리는 중이면 그것부터 건너뛴다 */
    if(SAY.timer){ clearTimeout(SAY.timer); SAY.timer = null; return sayStep(); }
    const el = sayLayer();
    const box = el && el.querySelector('.say-line');
    if(box && !box.classList.contains('typed') && Date.now() - SAY.shownAt < SAY.typeMs){
      box.classList.add('typed');
      return;
    }
    sayStep();
  }

  /* 갈림에서 한 가지를 골랐다. 고른 가지의 비트를 지금 자리에 끼워 넣는다. */
  function sayChoose(index){
    if(!SAY || SAY.waiting) return;
    const beat = SAY.beats[SAY.i-1];
    if(!beat || !beat.choice) return;
    const picked = beat.choice[index];
    if(!picked) return;
    if(picked.mark) sayMark(picked.mark);
    /* 고른 순간에 곧바로 치른다. 뒤따르는 장면 중에 앱이 닫혀도 결과는 남아야 하는데,
       대화 상태는 일부러 저장되지 않으므로 장면 끝에서 치르면 고르고도 못 얻는 판이 생긴다. */
    if(picked.do) picked.do();
    const branch = picked.then || [];
    SAY.beats.splice(SAY.i, 0, ...branch);
    sayStep();
  }

  /* 지금 자리에 비트를 끼워 넣는다. 갈림이 고른 가지를 끼우는 것과 같은 일이지만,
     {do:} 안에서 조건을 보고 부를 수 있다 — 프롤로그의 회수 유물 장면처럼
     '고른 결과에 따라 장면 하나가 더 붙는' 자리에 쓴다. */
  function sayInsert(beats){
    if(!SAY || !beats || !beats.length) return;
    SAY.beats.splice(SAY.i, 0, ...beats);
  }

  /* 전투가 '플레이어가 이걸 했다'고 알려 온다. 기다리던 것이면 다음 박자로 넘어간다. */
  function sayNotify(kind, detail){
    if(!SAY || !SAY.waiting) return;
    const w = SAY.waiting;
    if(w.wait === 'turns'){
      /* 자유 전투는 턴을 센다 — 턴 종료 알림이 그 눈금을 올린다 */
      if(kind !== 'endturn') return;
      w.seen = (w.seen || 0) + 1;
      if(w.seen < (w.n || 1)) return;
    } else {
      if(w.wait !== kind) return;
      if(kind === 'card' && w.name && detail !== w.name) return;
    }
    SAY.waiting = null;
    /* 기다림이 풀렸으니 잠긴 버튼도 함께 풀어 준다 — 다음 비트가 말이면 렌더가 없다 */
    render();
    sayStep();
  }

  /* 첫 전투용 실제 조작 안내.
     손패와 적을 전투가 시작된 뒤 읽어 동적으로 고르므로, 매번 같은 카드가 나오지 않아도
     현재 화면에서 깜빡이는 대상을 정확히 따라갈 수 있다. */
  function coreBattleGuide(){
    const b=S && S.battle;
    if(!b) return [];
    const card = b.hand.find(c=>c.type!=='emergency_escape' && isAttackCard(c) && enemyTargetsFor(c).length)
      || b.hand.find(c=>c.type!=='emergency_escape' && canPlayCard(c))
      || b.hand.find(c=>c.type!=='emergency_escape') || b.hand[0];
    if(!card) return [{note:'손패가 비어 있습니다. 다음 턴부터 카드를 뽑아 전투를 이어갑니다.'}];
    const target = isAttackCard(card) ? enemyTargetsFor(card)[0] : null;
    const foe = target || b.enemies.find(en=>en.alive) || b.enemies[0];
    const targeted = !!target;
    return [
      {note:'전투는 AP와 손패를 관리하며 진행합니다. 매 턴 AP 3으로 시작하고, 카드를 사용하면 AP가 줄어듭니다.'},
      {wait:'card', name:card.name, domain:targeted?'enemy':undefined, foe:targeted?foe.name:undefined,
       hint:`깜빡이는 ${card.name} 카드를 사용하세요${targeted?' — 이어서 깜빡이는 적을 선택하세요':''}.`},
      {note:'카드를 사용했습니다. 적 카드의 의도와 피해량을 확인한 뒤, 이번 턴을 끝낼지 결정합니다.'},
      {wait:'endturn', foe:foe.name, hint:'적의 예고 행동을 확인한 뒤, 깜빡이는 「턴 종료」를 누르세요.'},
      {note:'적의 턴이 지나갔습니다. 대원 카드 아래의 심도압박은 각 대원이 심연의 감각에 얼마나 동조했는지를 보여 줍니다. 100에 닿으면 정신이 무너져 제어를 잃습니다.'},
      {note:'상단의 잠식은 지역 전체의 시계입니다. 전투 턴이 끝날 때마다 오르고 100%가 되면 탐사가 끝나므로, 오래 머물수록 위험해집니다.'},
      {note:'대열과 사거리를 확인하세요. 전열·중열·후열에 따라 닿는 적이 달라지고, 앞의 대원이 쓰러지면 뒤의 대원이 앞으로 당겨집니다.'},
      {note:'빛이 약해지면 미상 카드 오염이 발생할 수 있습니다. 손에 들어올 때는 조용히 미상으로 남고, 사용할 때 원래 효과와 리스크를 확인하게 됩니다.'},
      {note:'이제 기본 안내가 끝났습니다. 전투가 끝나면 미니맵이 열리고, 다음 노드를 직접 선택할 수 있습니다.'},
    ];
  }

  /* 대화가 도는 동안 무엇을 낼 수 있는가 — 흩어져 있던 프롤로그 조건이 여기 모였다 */
  function sayGateCard(card){
    if(!SAY) return true;                     /* 각본이 없으면 평소 규칙대로 */
    const w = SAY.waiting;
    if(!w) return false;                      /* 말하는 중에는 아무것도 못 낸다 */
    if(w.wait === 'endturn') return false;
    if(w.wait === 'card') return !w.name || card.name === w.name;
    return true;                              /* turns 는 자유 전투다 */
  }
  function sayAllowsEndTurn(){
    if(!SAY) return true;
    const w = SAY.waiting;
    return !!w && (w.wait === 'endturn' || w.wait === 'turns');
  }
  /* ── 튜토리얼의 깜빡임 ──
     지시한 그 하나만 밝힌다. 여럿이 함께 깜빡이면 지목이 아니라 '이 중 아무거나' 가 되고,
     안내 문구가 이름을 대고 있는데 화면이 전원을 밝히면 둘이 어긋난다. */

  /* 지금 눌러야 할 그 한 장인가 — 같은 이름이 여러 장이면 손패에서 앞의 한 장만 */
  function sayHighlightsCard(card){
    const w = sayWaiting();
    if(!w || w.wait !== 'card' || !w.name || !card || card.name !== w.name) return false;
    const hand = (S && S.battle && S.battle.hand) || [];
    const first = hand.find(c=>c.name === w.name);
    return !first || first.uid === card.uid;
  }
  /* 지금 겨눠야 할 그 하나인가.
     비트에 who(병과 id)나 foe(적 이름)가 적혀 있으면 그것만, 없으면 닿는 대상 전체를 밝힌다 —
     적어 두지 않은 옛 비트가 조용히 아무것도 밝히지 않게 되는 것보다는 넓게 밝히는 편이 낫다. */
  function sayHighlightsUnit(unit){
    const w = sayWaiting();
    if(!w || w.wait !== 'card' || !unit) return false;
    if(unit.isHero) return w.domain === 'ally'  && (!w.who || unit.cls  === w.who);
    return               w.domain === 'enemy' && (!w.foe || unit.name === w.foe);
  }
  /* 지금 확인하라고 한 그 예고인가.
     「예고를 확인하고 턴을 끝낸다」 는 두 동작이라 예고 칩과 턴 종료 버튼이 함께 깜빡인다 —
     무엇을 보고 무엇을 누르는지가 한 화면에 같이 서야 문구와 어긋나지 않는다.
     foe 를 적어 두면 그 하나만, 없으면 예고를 든 적 전체를 밝힌다. */
  function sayHighlightsIntent(en){
    const w = sayWaiting();
    if(!w || w.wait !== 'endturn' || !en || !en.alive || !en.intent) return false;
    return !w.foe || en.name === w.foe;
  }
  /* 턴을 넘기라고 지시한 자리인가.
     2턴 버티기 구간(turns)도 결국 눌러야 할 것은 이 버튼이지만, 처음부터 깜빡이면
     카드도 안 내고 턴만 넘기게 된다. AP를 다 쓴 뒤에야 켠다 — 그때가 정말 넘길 때다. */
  function sayHighlightsEndTurn(){
    const w = sayWaiting();
    if(!w) return false;
    if(w.wait === 'endturn') return true;
    if(w.wait !== 'turns') return false;
    const b = S && S.battle;
    return !!b && (b.ap + (b.tempAp || 0)) <= 0;
  }

  /* ── 그리기 ── */

  /* 갈무리는 비트맵 글꼴이라, 글자를 하나씩 밀어 넣으면 줄바꿈이 밀려 상자 높이가 튄다.
     그래서 글자를 미리 다 넣어 두고 opacity 로만 하나씩 드러낸다 — 자리는 처음부터 잡혀 있다.
     간격은 CSS 가 --i 로 계산하므로 타이머가 필요 없고, 움직임을 줄인 환경에서는
     한 줄짜리 미디어 쿼리로 통째로 꺼진다. */
  function sayTyped(text){
    const chars = Array.from(String(text));
    const step = Math.min(SAY_TYPE_MS, Math.max(8, Math.floor(SAY_TYPE_MAX / Math.max(1, chars.length))));
    const html = chars.map((c,i)=> c==='\n'
      ? '<br>'
      : `<i style="--i:${i}">${c===' ' ? '&nbsp;' : escapeHtml(c)}</i>`).join('');
    return { html, ms: chars.length * step, step };
  }
  function escapeHtml(s){
    return String(s).replace(/[&<>"]/g, ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[ch]);
  }

  function sayPaint(beat){
    const el = sayLayer();
    if(!el) return;
    /* 각본이 도는 동안에는 뒤 화면을 어둡게 깔아 둔다. 말과 말 사이의 멈춤에서도
       유지되어야 하므로 비트가 아니라 '각본이 살아 있는가' 로 정한다 —
       비트마다 붙였다 떼면 대사 사이에 화면이 밝아졌다 어두워지며 깜빡인다. */
    const live = SAY ? 'say-live ' : '';
    /* 인양 기록·회수 유물 화면(prologueRecord)과 전멸 초상 화면(prologueFall)은 말상자(#say)가
       한 번도 뜨지 않는다 — 거기 뜨는 글줄·유물·초상 자체가 #content 안에 있어서, 대사를
       돋보이게 하려는 이 어둠이 오히려 그것들을 가려 버린다. PRO_FALL 은 {do}·{pause} 뿐이라
       beat 이 계속 null 인데, 이 조건이 없으면 그 null 도 '살아 있는 각본'으로 잡혀 초상화
       넷이 뜨자마자 어둠에 덮인다. 이 국면들에서는 어둠을 아예 걸지 않는다. */
    const dimSkipPhase = S.prologue && (S.prologue.phase==='record' || S.prologue.phase==='salvage' || S.prologue.phase==='fall');
    setSceneDim(!dimSkipPhase && !!SAY && !(beat && beat.wait));
    if(!beat){ el.innerHTML = ''; el.className = live.trim(); return; }

    if(beat.hold){
      /* 화면 전체가 누를 자리다. 글은 밑(#content)에 있고, 여기는 손길만 받는다. */
      el.className = live + 'say-open say-hold';
      el.innerHTML = '<div class="say-holdtap" data-action="say-advance"><span class="say-more" aria-hidden="true">▾</span></div>';
      return;
    }
    /* 기다릴 때는 어둠을 걷고 층을 통과시킨다 — 밑의 카드를 보고 눌러야 하므로 */
    if(beat.wait){
      el.className = 'say-through';
      el.innerHTML = beat.hint ? `<div class="say-hint">${beat.hint}</div>` : '';
      return;
    }
    if(beat.choice){
      el.className = live + 'say-open';
      el.innerHTML = `<div class="say-box say-choices">
        ${beat.prompt ? `<div class="say-prompt">${escapeHtml(beat.prompt)}</div>` : ''}
        ${beat.choice.map((c,i)=>`<button class="btn say-choice" data-action="say-choose" data-i="${i}">${escapeHtml(c.text)}</button>`).join('')}
      </div>`;
      return;
    }
    if(beat.note){
      const t = sayTyped(beat.note);
      SAY.shownAt = Date.now(); SAY.typeMs = t.ms;
      el.className = live + 'say-open';
      el.innerHTML = `<div class="say-note-capture" data-action="say-advance">
        <div class="say-box say-note">
          <div class="say-line" style="--step:${t.step}ms">${t.html}</div>
          <div class="say-more" aria-hidden="true">▾</div>
        </div>
      </div>`;
      return;
    }
    /* '탐사대원' 은 특정 인물이 아니라 지금 대열에 살아 있는 사람이다. 각본이 만들어질 때는
       대열이 없으므로 이름을 여기서 채운다 — 원본 비트는 건드리지 않고 복사해서 쓴다. */
    if(beat.crew) beat = Object.assign({}, beat, crewVoice());
    const t = sayTyped(beat.text || '');
    SAY.shownAt = Date.now(); SAY.typeMs = t.ms;
    const face = beat.portrait
      ? `<div class="portrait say-face scenario-face">${scenarioPortraitIcon(beat.portrait, 'scenario-say-art')}</div>`
      : beat.cls && CLASS_ICON[beat.cls]
        ? `<div class="portrait portrait-${beat.cls} say-face">${CLASS_ICON[beat.cls]}</div>` : '';
    el.className = live + 'say-open';
    el.innerHTML = `<div class="say-box ${beat.voice ? 'say-voice' : ''}" data-action="say-advance">
      ${face}
      <div class="say-body">
        ${beat.who ? `<div class="say-who">${escapeHtml(beat.who)}</div>` : ''}
        <div class="say-line" style="--step:${t.step}ms">${t.html}</div>
      </div>
      <div class="say-more" aria-hidden="true">▾</div>
    </div>`;
  }

  /* 장면 막. #flash 는 전투의 흰/붉은 비네트라 쓰임이 다르므로 따로 둔다. */
  function sayCurtain(dir, ms, done){
    const el = curtainLayer();
    if(!el){ if(done) done(); return; }
    const reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const span = reduced ? 0 : ms;
    el.style.transition = span ? `opacity ${span}ms ease-in-out` : 'none';
    el.style.pointerEvents = dir === 'out' ? 'auto' : 'none';
    /* 브라우저가 시작값을 한 번 읽어야 전환이 걸린다 */
    void el.offsetWidth;
    el.style.opacity = dir === 'out' ? '1' : '0';
    setTimeout(()=>{
      if(dir === 'in') el.style.pointerEvents = 'none';
      if(done) done();
    }, span + 20);
  }
  function curtainReset(){
    const el = curtainLayer();
    if(!el) return;
    el.style.transition = 'none';
    el.style.opacity = '0';
    el.style.pointerEvents = 'none';
  }
  /* 전환 없이 곧바로 덮는다. 어둠 뒤에서 화면을 갈아 끼운 다음 fade in 으로 여는 용도다. */
  function curtainCover(){
    const el = curtainLayer();
    if(!el) return;
    el.style.transition = 'none';
    el.style.opacity = '1';
    el.style.pointerEvents = 'auto';
    void el.offsetWidth;
  }
