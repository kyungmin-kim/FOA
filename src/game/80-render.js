  /* ============ RENDER ============ */
  const app = document.getElementById('app');
  app.innerHTML = '<div id="atmo" aria-hidden="true"></div><div id="content"></div>'
                + '<div id="grain" aria-hidden="true"></div><div id="fx" aria-hidden="true"></div>'
                + '<div id="flash" aria-hidden="true"></div>';
  const atmoEl = document.getElementById('atmo');
  const contentEl = document.getElementById('content');
  const fxEl = document.getElementById('fx');
  const flashEl = document.getElementById('flash');

  /* ============ 배경음 ============
     10초짜리 고리 두 개 — 탐색 중에는 심연의 소음이, 전투에서는 교전의 박동이 돈다.

     되도록 Web Audio 로 튼다. 디코딩한 파형을 그대로 물려 돌리므로 이음매가 없고,
     트랙을 바꿀 때 두 소리를 겹쳐 넘길 수 있다. 다만 file:// 로 열면 fetch 가 막히는
     브라우저가 있어, 그때는 트랙마다 <audio loop> 하나씩으로 물러선다
     (이쪽은 되감을 때 아주 짧게 끊기고 겹쳐 넘기지도 못하지만 소리는 계속 난다).

     브라우저는 사용자가 한 번 건드리기 전에는 소리를 내주지 않으므로 첫 입력에 깨운다. */
  /* gain 은 트랙마다 따로 둔다 — 전투 곡은 소리가 촘촘해서 같은 값으로 깔면
     기본음보다 크게 들리고, 무엇보다 전투 중에는 타격음과 화면이 먼저 읽혀야 한다. */
  /* 파일 이름은 곡이 아니라 '자리'를 가리킨다 — bgm-<쓰임>.m4a.
     곡이 바뀌어도 자리 이름은 그대로라, 새 음원을 같은 이름으로 덮어 굽기만 하면 된다.

     싣는 것은 언제나 인코딩된 m4a 다. 무압축 원본(assets/*.wav)은 저장소에서 빠지므로
     그 경로를 가리키면 내려받은 쪽에서는 소리가 통째로 사라진다.
     seconds 는 원본의 정확한 길이 — 인코더가 덧댄 꼬리를 여기서 잘라 낸다.
     트랙마다 길이가 다르므로 한 값으로 묶어 두면 긴 곡이 중간에서 되감긴다. */
  const BGM_TRACKS = {
    ambient: {src:'assets/bgm-ambient.m4a', gain:1,   seconds:20},
    battle:  {src:'assets/bgm-battle.m4a',  gain:0.5, seconds:10},
  };
  const BGM_KEY = 'fathom.bgm.v1';
  /* 음악은 배경이지 무대가 아니다 — 있는 줄 모르고 듣다가 없으면 허전한 정도로만 깐다. */
  const BGM_VOLUME = 0.0675;
  const BGM_FADE = 0.7;          /* 트랙을 겹쳐 넘기는 시간(초) */
  let bgmOn = Store.get(BGM_KEY) !== 'off';
  let bgmCtx = null, bgmMaster = null, bgmTrack = null;
  const bgmBuffers = {};   /* 트랙별 디코딩 결과 — 한 번 받으면 다시 받지 않는다 */
  const bgmEls = {};       /* file:// 대비 요소 재생 */
  let bgmVoice = null;     /* 지금 울리고 있는 {node, gain} */
  let bgmPrimed = false;   /* 제스처 안에서 오디오 잠금을 푼 적이 있는가 */
  let bgmMode = null;      /* 'buffer' | 'element' — 실제로 소리가 나기 시작하면 정해진다 */
  let bgmBufferFailed = false;  /* Web Audio 로 받아 오지 못했다 — 요소로 물러서야 한다 */

  function bgmDesiredTrack(){ return (S && S.screen === 'battle') ? 'battle' : 'ambient'; }
  function bgmTrackGain(key){
    const t = BGM_TRACKS[key];
    return t && Number.isFinite(t.gain) ? t.gain : 1;
  }
  /* 값이 없으면 0 을 돌려주고, 부르는 쪽이 버퍼 길이를 그대로 쓰게 둔다 */
  function bgmTrackSeconds(key){
    const t = BGM_TRACKS[key];
    return t && Number.isFinite(t.seconds) ? t.seconds : 0;
  }

  /* ---- 물러섰을 때: 트랙마다 요소 하나 ---- */
  function bgmEl(key){
    if(!bgmEls[key]){
      const el = document.createElement('audio');
      el.src = BGM_TRACKS[key].src;
      el.loop = true;
      el.preload = 'none';
      el.playsInline = true;
      el.setAttribute('playsinline','');
      el.volume = 0;
      document.body.appendChild(el);
      bgmEls[key] = el;
    }
    return bgmEls[key];
  }
  function bgmPlayFallback(key){
    Object.keys(bgmEls).forEach(k=>{ if(k !== key) bgmEls[k].pause(); });
    const el = bgmEl(key);
    el.volume = BGM_VOLUME * bgmTrackGain(key);
    const p = el.play();
    if(p && p.then) p.then(()=>{ bgmMode = 'element'; }).catch(()=>{});
    else bgmMode = 'element';
  }

  /* ---- Web Audio ---- */
  function bgmLoad(key){
    if(bgmBuffers[key]) return Promise.resolve(bgmBuffers[key]);
    return fetch(BGM_TRACKS[key].src)
      .then(r=>{ if(!r.ok) throw new Error('bgm'); return r.arrayBuffer(); })
      .then(buf=>bgmCtx.decodeAudioData(buf))
      .then(decoded=>{ bgmBuffers[key] = decoded; return decoded; });
  }
  function bgmPlayBuffer(key){
    const buf = bgmBuffers[key];
    if(!bgmCtx || !buf) return;
    const now = bgmCtx.currentTime;
    /* 울리던 것은 끊지 않고 걷어 낸다 — 전투에 드는 순간 소리가 뚝 끊기면 화면보다 먼저 놀란다 */
    if(bgmVoice){
      const old = bgmVoice;
      try{
        old.gain.gain.cancelScheduledValues(now);
        old.gain.gain.setValueAtTime(old.gain.gain.value, now);
        old.gain.gain.linearRampToValueAtTime(0, now + BGM_FADE);
        old.node.stop(now + BGM_FADE + 0.05);
        /* 다 넘어간 뒤에는 그래프에서도 떼어 낸다. 참조만 버리고 두면 소리 없는
           마디가 그래프에 계속 남아 매 렌더 퀀텀마다 처리된다 — 지도와 전투를
           오갈 때마다 하나씩 쌓여, 나중에는 그 자체가 끊김이 된다. */
        old.node.onended = function(){
          try{ old.node.disconnect(); old.gain.disconnect(); }catch(e){}
        };
      }catch(e){}
      bgmVoice = null;
    }
    /* 요소로 먼저 울리고 있었다면 이제 물러난다 */
    Object.keys(bgmEls).forEach(k=>bgmEls[k].pause());
    const gain = bgmCtx.createGain();
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(bgmTrackGain(key), now + BGM_FADE);
    gain.connect(bgmMaster);
    const node = bgmCtx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.loopStart = 0;
    /* 디코딩된 버퍼는 인코더가 덧댄 만큼 원본보다 길 수 있다. 원래 길이에서 끊어야
       한 바퀴가 정확히 맞물린다. 짧게 나오면(있는 그대로) 버퍼 끝까지 쓴다. */
    node.loopEnd = Math.min(bgmTrackSeconds(key) || buf.duration, buf.duration);
    node.connect(gain);
    node.start(now);
    bgmVoice = {node:node, gain:gain};
    bgmMode = 'buffer';
  }
  function bgmPlay(key){
    if(bgmCtx){
      bgmLoad(key)
        .then(()=>{ if(bgmOn && bgmTrack === key) bgmPlayBuffer(key); })
        .catch(()=>{
          bgmBufferFailed = true;   /* 다음 손길에서 제스처 안에 요소로 넘어간다 */
          if(bgmOn && bgmTrack === key) bgmPlayFallback(key);
        });
    } else {
      bgmPlayFallback(key);
    }
  }
  /* 화면이 바뀔 때마다 불린다 — 같은 트랙이면 아무 일도 하지 않는다 */
  function bgmSetTrack(key){
    if(!BGM_TRACKS[key] || bgmTrack === key) return;
    bgmTrack = key;
    if(!bgmOn || !bgmPrimed) return;
    bgmPlay(key);
  }

  /* ---- 잠금 풀기 ----
     모바일은 데스크톱보다 훨씬 깐깐하다. 소리를 처음 내는 일은 반드시 '손가락이
     닿은 그 순간' 동기적으로 해 두어야 하고, 나중에(fetch·decode 가 끝난 뒤) 하면
     거절당한다. AudioContext 를 깨우고 소리 없는 한 칸을 실제로 울리면 풀린다.

     <audio> 요소는 Web Audio 가 없을 때만 미리 눌러 둔다. 예전에는 물러설 자리를
     만든다며 두 트랙을 다 눌러 뒀는데, 그러면 같은 파일을 미디어 파이프라인이
     한 번, Web Audio 가 또 한 번 내려받아 디코딩한다 — 휴대폰에서는 이 중복이
     그대로 첫 끊김과 메모리 압박이 된다. 버퍼 재생이 실패한 뒤에는 다음 손길에서
     동기적으로 요소를 트므로(bgmGesture) 물러설 길은 그대로 남는다. */
  function bgmPrime(){
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if(Ctx && !bgmCtx){
      try{
        bgmCtx = new Ctx();
        bgmMaster = bgmCtx.createGain();
        bgmMaster.gain.value = BGM_VOLUME;
        bgmMaster.connect(bgmCtx.destination);
      }catch(e){ bgmCtx = null; bgmMaster = null; }
    }
    if(bgmCtx){
      if(bgmCtx.state === 'suspended') bgmCtx.resume().catch(()=>{});
      try{
        const tick = bgmCtx.createBufferSource();
        tick.buffer = bgmCtx.createBuffer(1, 1, 22050);
        tick.connect(bgmCtx.destination);
        tick.start(0);
      }catch(e){}
    } else if(!bgmPrimed){
      /* Web Audio 가 아예 없는 곳 — 이때만 요소에 허락을 받아 둔다 */
      Object.keys(BGM_TRACKS).forEach(k=>{
        const el = bgmEl(k);
        el.volume = 0;
        const p = el.play();
        if(p && p.then) p.then(()=>{ if(bgmMode !== 'element') el.pause(); }).catch(()=>{});
      });
    }
    bgmPrimed = true;
  }
  /* 한 번 실패하면 끝이 아니라, 소리가 실제로 날 때까지 손이 닿을 때마다 다시 시도한다.
     첫 탭이 로딩·정책·무음 전환에 걸려 놓치는 일이 모바일에서는 흔하다.
     버퍼 재생이 이미 한 번 엎어졌다면 여기서(제스처 안에서) 곧바로 요소로 넘어간다. */
  function bgmGesture(){
    if(!bgmOn) return;
    bgmPrime();
    if(!bgmTrack) bgmTrack = bgmDesiredTrack();
    if(bgmBufferFailed && bgmMode !== 'element'){ bgmPlayFallback(bgmTrack); return; }
    if(!bgmMode) bgmPlay(bgmTrack);
    else if(bgmCtx && bgmCtx.state === 'suspended') bgmCtx.resume().catch(()=>{});
  }
  function setBgmOn(on){
    bgmOn = !!on;
    Store.set(BGM_KEY, bgmOn ? 'on' : 'off');
    if(!bgmOn){
      if(bgmVoice){
        try{ bgmVoice.node.stop(); }catch(e){}
        try{ bgmVoice.gain.disconnect(); }catch(e){}
        bgmVoice = null;
      }
      Object.keys(bgmEls).forEach(k=>bgmEls[k].pause());
      bgmMode = null;
      return;
    }
    /* 설정에서 켜는 것도 손가락이 닿은 순간이다 — 그대로 잠금을 푼다 */
    bgmPrime();
    if(bgmCtx && bgmCtx.state === 'suspended') bgmCtx.resume().catch(()=>{});
    bgmTrack = bgmDesiredTrack();
    bgmPlay(bgmTrack);
  }
  ['pointerdown','touchstart','keydown'].forEach(evt=>{
    window.addEventListener(evt, bgmGesture, {passive:true});
  });
  /* 화면을 껐다 켜거나 앱을 다녀오면 iOS 는 컨텍스트를 재워 둔다 — 돌아올 때 깨운다 */
  document.addEventListener('visibilitychange', function(){
    if(document.visibilityState !== 'visible' || !bgmOn) return;
    if(bgmCtx && bgmCtx.state === 'suspended') bgmCtx.resume().catch(()=>{});
    if(bgmMode === 'element' && bgmTrack){
      const el = bgmEls[bgmTrack];
      if(el && el.paused){ const p = el.play(); if(p && p.catch) p.catch(()=>{}); }
    }
  });

  /* ============ 파티클 ============
     피해 판정은 render() 앞에서 끝나지만 그때의 DOM 은 곧 버려진다.
     그래서 이벤트만 큐에 쌓아두고, 다시 그린 뒤 카드 위치를 찾아 뿌린다. */
  let fxQueue = [];
  function queueFx(kind, unit, amount, crit){
    if(!S.battle) return;
    const side = S.party.indexOf(unit) >= 0 ? 'hero' : 'foe';
    const key  = side==='hero' ? unit.id : S.battle.enemies.indexOf(unit);
    fxQueue.push({kind:kind, side:side, key:key, amount:amount||0, crit:!!crit});
  }

  /* 낸 카드는 곧 손패에서 지워지고 전투판이 통째로 다시 그려진다.
     지워지기 직전의 카드를 그 모습 그대로 떠서, 다시 그려지지 않는 #fx 레이어에
     같은 자리로 얹어 둔다 — 손에서 한 장이 뽑혀 나가는 것처럼 보이게 하는 잔상이다.
     반드시 손패가 아직 남아 있는 동안(상태를 건드리기 전에) 불러야 한다. */
  function flyOutCard(uid){
    if(!fxEl || !contentEl || S.screen!=='battle') return;
    const el = contentEl.querySelector('.card[data-uid="'+uid+'"]');
    if(!el) return;
    const ar = app.getBoundingClientRect();
    const r  = el.getBoundingClientRect();
    const ghost = el.cloneNode(true);
    ghost.classList.add('card-fly');
    ghost.classList.remove('selecting','tutorial-pulse');
    ghost.removeAttribute('data-action');   /* 잔상이 클릭을 가로채지 않게 */
    ghost.removeAttribute('data-uid');
    ghost.style.left   = (r.left - ar.left) + 'px';
    ghost.style.top    = (r.top  - ar.top)  + 'px';
    ghost.style.width  = r.width  + 'px';
    ghost.style.height = r.height + 'px';
    fxEl.appendChild(ghost);
    setTimeout(()=>{ if(ghost.parentNode) ghost.parentNode.removeChild(ghost); }, 130);
  }

  const FX_COLOR = {
    heroHit:'#c4383c', foeHit:'#b87ad8',
    dodge:'#8fd4c4', guard:'#9fc0d8', riposte:'#e0574f',
    /* 되받아친 값은 내가 낸 것이라 붉은 피해와 갈라 둔다 — 우리 쪽 반격만 푸르게 */
    riposteHero:'#6fb4ff',
    /* 치명타 — 표시는 어느 쪽이든 같은 경보색이고, 튀는 것만 각자의 피를 따른다 */
    crit:'#ff5a3c', bloodHero:'#b42a2e', bloodFoe:'#8f66c4',
    /* 회복은 초록 — 십자와 티끌이 한 가지 빛으로 읽혀야 무엇이 일어났는지 한눈에 갈린다.
       진정(계열)은 그대로 물빛이라 회복과 헷갈리지 않는다. */
    heal:'#6fdc8c', calm:'#7fbfae', death:'#cfe4dd',
    /* 수치는 파편보다 밝아야 초상 위에서 읽힌다.
       내가 맞으면 핏빛, 내가 때리면 뼛빛 — 색만으로 누구의 피해인지 갈린다. */
    dmgHero:'#ff7a70', dmgFoe:'#f7ecd6',
  };
  function clearFxLayer(){ while(fxEl.firstChild) fxEl.removeChild(fxEl.firstChild); }
  const FX_MAX = 180;   /* 타이머가 밀려도 레이어가 무한히 불어나지 않게 */
  function spawn(cls, x, y, color, size, vars, life, text){
    while(fxEl.childElementCount >= FX_MAX) fxEl.removeChild(fxEl.firstChild);
    const p = document.createElement('div');
    p.className = 'p ' + cls;
    p.style.left = x+'px';
    p.style.top  = y+'px';
    if(color) p.style.color = color;
    if(size){ p.style.width = size[0]+'px'; p.style.height = size[1]+'px'; }
    if(vars) for(const k in vars) p.style.setProperty(k, vars[k]);
    /* 적 이름 등 바깥에서 온 문자열은 넣지 않지만, 그래도 textContent 로만 붙인다 */
    if(text != null) p.textContent = text;
    fxEl.appendChild(p);
    setTimeout(()=>{ if(p.parentNode) p.parentNode.removeChild(p); }, life||1100);
  }
  const rnd = (a,b)=> a + Math.random()*(b-a);

  function burst(x, y, color, n, spread){
    for(let i=0;i<n;i++){
      const a = (360/n)*i + rnd(-14,14);
      spawn('p-shard', x, y, color, [rnd(1.5,2.8), rnd(7,13)],
            {'--a':a+'deg', '--r':rnd(spread*0.55, spread)+'px', '--d':rnd(380,620)+'ms'}, 700);
    }
  }
  /* 회피·흘림·반격도 피해와 같은 글꼴·같은 초상 위에 수치를 띄운다.
     다만 붉은 피해 수치와 같은 자리에서 출발하면 겹쳐 읽히지 않으므로 한 줄 위에 얹는다.
     막아낸 것이 없으면(1 피해를 흘리는 등) 배지만 남기고 수치는 띄우지 않는다. */
  function reactNum(x, y, color, label, amount){
    const n = Math.round(amount || 0);
    if(n <= 0) return;
    spawn('p-dmg', x, y - 18, color, null,
          {'--d':'900ms', 'font-size':'13px'}, 1100, label + ' ' + n);
  }
  /* 튄 피 — 위로 솟았다가 아래로 떨어진다. 파편이 곧게 뻗는 것과 달리 호를 그린다. */
  function bloodBurst(x, y, color){
    for(let i=0;i<14;i++){
      const s = rnd(2,4.5);
      spawn('p-blood', x + rnd(-6,6), y + rnd(-6,6), color, [s,s],
            {'--dx':rnd(-34,34)+'px', '--dy':rnd(26,52)+'px',
             '--rise':rnd(8,22)+'px', '--d':rnd(480,780)+'ms'}, 900);
    }
  }

  function playFx(ev, el, stack){
    const ar = app.getBoundingClientRect();
    const r  = el.getBoundingClientRect();
    const cx = r.left - ar.left + r.width/2;
    const cy = r.top  - ar.top  + r.height/2;
    const mine = ev.side==='hero';
    /* 수치는 카드 한가운데가 아니라 맞은 얼굴 위에 뜬다 — 누가 맞았는지가 먼저 읽혀야 한다.
       초상은 아군·적이 서로 다른 클래스를 쓰고, 못 찾으면 카드 기준으로 물러선다. */
    const face = el.querySelector('.portrait, .enemy-portrait');
    const fr = face ? face.getBoundingClientRect() : r;
    const fx = fr.left - ar.left + fr.width/2;
    const fy = fr.top  - ar.top  + fr.height/2;

    if(ev.kind==='impact'){
      const col = mine ? FX_COLOR.heroHit : FX_COLOR.foeHit;
      /* 피해가 클수록 파편이 많고 멀리 튄다 */
      const n = Math.max(6, Math.min(14, 5 + Math.round(ev.amount*0.8)));
      burst(cx, cy, col, n, 30 + Math.min(26, ev.amount*2.2));
      spawn('p-ring', cx, cy, col, [30,30], {'--d':'380ms'}, 500);
      /* 큰 피해일수록 크게, 오래 남는다. 치명타는 거기서 한 번 더 키운다. */
      const big = ev.amount >= 12;
      const s = stack || 0;
      const size = Math.round((big?19:15) * (ev.crit ? 1.25 : 1));
      spawn('p-dmg', fx + (s%2 ? 13 : -13)*Math.ceil(s/2), fy - s*7,
            mine ? FX_COLOR.dmgHero : FX_COLOR.dmgFoe, null,
            {'--d': (big?1050:880)+'ms', 'font-size': size+'px'},
            big?1200:1000, '-'+ev.amount);
      if(ev.crit){
        /* 피는 초상 언저리에서 튀고, 표시는 그 위로 솟는다 */
        bloodBurst(fx, fy, mine ? FX_COLOR.bloodHero : FX_COLOR.bloodFoe);
        spawn('p-crit', fx, fy - 34, FX_COLOR.crit, null, {'--d':'950ms'}, 1150, 'CRITICAL!');
        flash('red');
      }
      el.classList.add('hit-shake');

    } else if(ev.kind==='dodge'){
      for(let i=0;i<3;i++){
        spawn('p-wisp', cx + rnd(-8,8), cy + rnd(-12,12), FX_COLOR.dodge, null,
              {'--dx':rnd(20,36)+'px', '--d':rnd(420,600)+'ms'}, 700);
      }
      /* 통째로 피한 양을 그대로 띄운다 — 체력이 왜 그대로인지가 여기서 읽힌다 */
      reactNum(fx, fy, FX_COLOR.dodge, '회피', ev.amount);

    } else if(ev.kind==='guard'){
      spawn('p-ring', cx, cy, FX_COLOR.guard, [40,40], {'--d':'520ms'}, 650);
      burst(cx, cy, FX_COLOR.guard, 5, 20);
      /* 흘림은 깎아낸 양을 띄운다. 실제로 들어간 피해는 붉은 수치로 따로 뜬다 */
      reactNum(fx, fy, FX_COLOR.guard, '흘림', ev.amount);

    } else if(ev.kind==='riposte'){
      spawn('p-slash', cx, cy, FX_COLOR.riposte, null, {'--a':'-32deg'}, 460);
      spawn('p-slash', cx, cy, FX_COLOR.riposte, null, {'--a':'26deg'}, 460);
      /* 되돌려준 양. 맞은 쪽에는 이 값이 붉은 피해 수치로 다시 뜬다.
         우리 쪽 반격은 푸르게 — 같은 화면에 붉은 수치가 함께 뜨므로 주인이 갈려야 한다. */
      reactNum(fx, fy, mine ? FX_COLOR.riposteHero : FX_COLOR.riposte, '반격', ev.amount);

    } else if(ev.kind==='death'){
      for(let i=0;i<12;i++){
        const s = rnd(3,8);
        spawn('p-bub', cx + rnd(-16,16), cy + rnd(-10,14), null, [s,s],
              {'--dx':rnd(-16,16)+'px', '--dy':rnd(48,92)+'px', '--d':rnd(700,1150)+'ms'}, 1300);
      }
      spawn('p-ring', cx, cy, FX_COLOR.death, [44,44], {'--d':'620ms'}, 800);

    } else if(ev.kind==='heal' || ev.kind==='calm'){
      const col = ev.kind==='heal' ? FX_COLOR.heal : FX_COLOR.calm;
      for(let i=0;i<8;i++){
        const s = rnd(2,4);
        spawn('p-mote', cx + rnd(-18,18), cy + rnd(-4,16), col, [s,s],
              {'--dx':rnd(-10,10)+'px', '--dy':rnd(26,48)+'px', '--d':rnd(560,900)+'ms'}, 1000);
      }
      /* 회복은 카드 둘레를 따라 십자를 돋운다 — 타원으로 돌려야 세로로 긴 카드에서도
         모서리에 몰리지 않고 테두리를 고르게 두른다. 하나씩 시차를 두어 차례로 돋는다. */
      if(ev.kind==='heal'){
        const PLUS_N = 7;
        for(let i=0;i<PLUS_N;i++){
          const a = (Math.PI*2/PLUS_N)*i + rnd(-0.22, 0.22);
          const rx = r.width/2  + rnd(1,7);
          const ry = r.height/2 + rnd(1,7);
          spawn('p-plus', cx + Math.cos(a)*rx, cy + Math.sin(a)*ry, col, null,
                {'--dx':rnd(-6,6)+'px', '--dy':rnd(18,30)+'px',
                 '--d':rnd(720,980)+'ms', '--dl':Math.round(i*55)+'ms'},
                1400, '+');
        }
      }
    }
  }
  function flushFx(){
    if(!fxQueue.length) return;
    const q = fxQueue; fxQueue = [];
    if(!S.battle || S.screen!=='battle'){ clearFxLayer(); return; }
    /* 광역기나 반격으로 한 번에 여러 대를 맞으면 수치가 같은 자리에 겹쳐 한 줄로 뭉친다.
       같은 대상의 몇 번째 피해인지 세어, 뜨는 자리를 조금씩 어긋나게 한다. */
    const hitSeen = {};
    q.forEach(ev=>{
      const sel = ev.side==='hero'
        ? '.hero-card[data-id="'+ev.key+'"]'
        : '.foe-card[data-idx="'+ev.key+'"]';
      const el = contentEl.querySelector(sel);
      if(!el) return;
      let stack = 0;
      if(ev.kind==='impact'){
        const id = ev.side+':'+ev.key;
        stack = hitSeen[id] = (hitSeen[id]||0) + 1;
      }
      playFx(ev, el, stack - 1);
    });
  }
  function flash(type){
    if(!flashEl) return;
    flashEl.classList.remove('flash-white','flash-red');
    void flashEl.offsetWidth; // force reflow so the animation restarts even if same type fires again
    flashEl.classList.add(type==='white' ? 'flash-white' : 'flash-red');
  }
  let lastSlug = null;
  function ensureAtmo(slug){
    if(slug !== lastSlug){ atmoEl.innerHTML = atmoMarkup(slug); lastSlug = slug; }
    if(app.dataset.tier !== slug) app.dataset.tier = slug;
  }

  /* 압박이 오를수록 물빛에서 놋쇠빛으로, 끝에는 핏빛으로 넘어간다 */
  function dpColor(dp){ if(dp>=100) return '#d9452f'; if(dp>=70) return '#d89a3c'; return '#7fbfae'; }

  /* 체력이 줄수록 피가 굳는다 — 색은 선홍에서 검붉게 가라앉고, 맥은 반대로 빨라진다.
     단계로 끊지 않고 비율에 따라 이어지게 두어야 깎여 나가는 것이 눈에 보인다. */
  const VITAL_DUR_FULL = 2.6, VITAL_DUR_EMPTY = 0.75;
  function vitalDuration(ratio){
    const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    return (VITAL_DUR_EMPTY + (VITAL_DUR_FULL - VITAL_DUR_EMPTY) * r).toFixed(2);
  }
  function hpFillColor(ratio){
    const r = Math.max(0, Math.min(1, Number.isFinite(ratio) ? ratio : 0));
    /* 바닥에서도 검은 판 위에서 읽혀야 하므로 완전히 어둡게 내리지는 않는다 */
    const lerp = (empty, full)=>Math.round(empty + (full - empty) * r);
    return `rgb(${lerp(122,196)},${lerp(20,56)},${lerp(24,60)})`;
  }
  function ownerLabel(o){
    if(o==='neutral') return '중립';
    const def = CLASS_DEFS[o];
    return def ? def.name : o;
  }

  /* 게임 가이드 — 프롤로그 튜토리얼이 한 번씩 짚어 준 규칙을 언제든 다시 펴 볼 수 있게 모았다.
     수치는 실제 상수에서 읽어 온다. 규칙을 고치면 안내문도 따라 바뀌어야 하기 때문이다.
     항목 추가는 이 배열에 {t, lines} 를 하나 더 얹으면 된다. */
  function guideSections(){
    const eroRates = CHAPTERS.map(c=>`${c.tier} ${c.erosion}%`).join(' · ');
    return [
      {t:'AP · 행동력', lines:[
        `전투는 매 턴 AP <b>${3}</b>개로 시작하고, 카드는 저마다 적힌 만큼 AP를 씁니다.`,
        `정규 AP를 <b>${TEMP_AP_MIN}개 이상</b> 남기고 턴을 끝내면 다음 턴에 임시 AP <b>+${TEMP_AP_CARRY}</b>를 받습니다.`,
        '반투명한 임시 AP는 그 턴에만 쓰이며 정규 AP보다 <b>먼저</b> 소모됩니다.',
      ]},
      {t:'방어 · 예고', lines:[
        '적 카드 아래에는 다음에 할 행동이 미리 보입니다. 그것을 보고 막을지 때릴지 고릅니다.',
        '방어는 <b>턴이 끝나면 사라집니다.</b> 쟁여 둘 수 없으니 맞을 턴에 맞춰 올리세요.',
      ]},
      {t:'심도압박', lines:[
        '심연의 감각에 인식이 동조되는 정도입니다. <b>방어로는 막을 수 없습니다.</b>',
        '원거리 공격·광기 계열 카드는 위력의 대가로 자신의 압박을 올립니다.',
        '<b>100</b>에 닿으면 정신이 함몰되어 가하는 피해 <b>-50%</b>, 받는 피해 <b>+50%</b>가 되고 70으로 되돌아갑니다.',
        '진정 계열 카드와 은신처 휴식(압박 -30)으로만 내릴 수 있습니다.',
      ]},
      {t:'잠식', lines:[
        `0에서 시작해 <b>${EROSION_MAX}%</b>에 닿으면 탐색이 그 자리에서 끝납니다. 되돌리는 수단은 없습니다.`,
        `전투의 턴이 끝날 때마다 구역별로 오릅니다 — ${eroRates}.`,
        `은신처에서 숨을 고르면 체력과 압박을 얻는 대신 잠식이 <b>${EROSION_REST}%</b> 오릅니다.`,
      ]},
      {t:'대열 · 사거리', lines:[
        '서 있는 열이 곧 화력입니다. 병과마다 휘두를 수 있는 자기 열과 닿는 상대 열이 정해져 있습니다.',
        `<b>${REACH.melee.label}</b> — ${REACH.melee.note}`,
        `<b>${REACH.mid.label}</b> — ${REACH.mid.note}`,
        `<b>${REACH.ranged.label}</b> — ${REACH.ranged.note}`,
        '빈 칸은 열로 세지 않으며, 앞이 쓰러지면 뒤가 당겨집니다.',
      ]},
      {t:'피격 반응', lines:[
        '맞을 때마다 회피·흘림·반격을 굴립니다. 앞에 설수록 받아치고, 뒤에 설수록 비껴납니다.',
        '살아 돌아온 사람은 다음 하강에서 최대 체력과 반응이 조금씩 늘어납니다.',
      ]},
      {t:'치명타', lines:[
        `약 <b>${(CRIT_CHANCE*100).toFixed(1)}%</b> 확률로 한 방이 깊게 들어갑니다. <b>아군과 적 모두</b> 같은 확률로 굴립니다.`,
        `피해가 <b>${CRIT_MULT_MIN}~${CRIT_MULT_MAX}배</b>로 부풀되, 최종 피해는 원래의 <b>${CRIT_MULT_CAP}배</b>를 넘지 않습니다.`,
        '회피한 공격은 애초에 닿지 않았으므로 치명타가 나지 않습니다. 흘림과 방어로는 부풀어 오른 뒤의 피해를 막습니다.',
      ]},
      {t:'덱 · 손패', lines:[
        `손패는 매 턴 <b>${5}</b>장까지 채워집니다(유물로 최대 ${HAND_LIMIT}장). 가득 찬 채로 뽑으면 한 장을 버려야 합니다.`,
        `덱은 전투 보상으로 자라며 최대 <b>${MAX_DECK_SIZE}</b>장까지 늘릴 수 있습니다.`,
      ]},
      {t:'강화 · 합성', lines:[
        `카드는 <b>+${MERGE_UPGRADE_START_LEVEL}</b>까지 한 장씩 강화할 수 있습니다.`,
        `<b>+${MERGE_UPGRADE_START_LEVEL} → +${MERGE_UPGRADE_START_LEVEL+1}</b> 부터는 같은 카드·같은 단계 <b>2장</b>을 합쳐야 하며, <b>+${MAX_UPGRADE_LEVEL}</b>가 끝입니다.`,
      ]},
      {t:'유물 · 해금', lines:[
        `유물은 <b>${RELIC_CAP}칸</b>까지 지니며, 한 번 챙기면 그 탐색이 끝날 때까지 벗겨지지 않습니다.`,
        '여관에서 얻은 동료 해금은 탐색이 끝나도 남습니다. 다만 <b>새로운 탐색</b>은 해금까지 지웁니다.',
      ]},
    ];
  }

  /* 상단 메뉴 팝업 — 항목 추가는 이 배열만 늘리면 된다.
     view:'placeholder' 는 아직 구현되지 않은 기능의 안내문을,
     view:'guide' 는 sections() 가 돌려주는 목록을 접이식 문서로,
     view:'confirm' 은 실행 전 확인이 필요한 항목을 그린다. */
  /* 설정 항목도 배열 하나로 늘린다 — 읽고 쓰는 두 함수만 주면 줄이 하나 더 생긴다. */
  const SETTING_TOGGLES = [
    {id:'bgm', label:'배경음', hint:'심연의 소음이 끊기지 않고 흐른다.',
      get:()=>bgmOn, set:v=>setBgmOn(v)},
  ];

  const MENU_ITEMS = [
    /* view:'toggle' 은 하위 화면 없이 목록에서 바로 뒤집힌다. 소리를 끄는 일은
       설정 안까지 들어가기엔 급할 때가 많다 — 메뉴를 열자마자 한 번에 닿게 둔다. */
    {id:'mute', view:'toggle', label:()=> bgmOn ? '음소거' : '소리 켜기',
      run(){ setBgmOn(!bgmOn); }},
    {id:'settings', label:'설정', view:'settings', title:'설정'},
    {id:'system', label:'게임 가이드', view:'guide', title:'게임 가이드',
      sections:guideSections},
    {id:'quit', label:'게임 종료', view:'confirm', title:'게임 종료', confirmLabel:'게임 종료',
      desc:'제목 화면으로 나갑니다. 지도·휴식 등 안전한 지점까지는 이미 저장되어 있습니다.',
      run(){ S.screen = 'title'; }},
  ];
  let menuOpen = false;
  let menuStep = null; /* null 이면 목록, 아니면 MENU_ITEMS 의 id */
  let guideOpen = 0;   /* 가이드에서 펼쳐 둔 장의 번호 */

  function renderMenuOverlay(){
    if(!menuOpen) return '';
    const item = MENU_ITEMS.find(m=>m.id===menuStep) || null;
    let body;
    if(!item){
      /* 이름이 상태에 따라 달라지는 항목(음소거 등)은 함수로 받는다 */
      body = `<div class="menu-list">${MENU_ITEMS.map(m=>{
        const label = typeof m.label === 'function' ? m.label() : m.label;
        return `<button class="menu-item" data-action="menu-open-item" data-menu-id="${m.id}">${label}</button>`;
      }).join('')}</div>`;
    } else if(item.view==='guide'){
      /* 한 번에 한 장만 펼친다 — 작은 화면에서 통째로 흘리면 어디를 읽는지 놓친다 */
      const sections = item.sections();
      body = `
        <div class="menu-guide">
          ${sections.map((sec,i)=>`
            <div class="guide-sec ${guideOpen===i?'open':''}">
              <button class="guide-sec-head" data-action="menu-guide-toggle" data-index="${i}">
                <span>${sec.t}</span><span class="guide-sec-mark" aria-hidden="true"></span>
              </button>
              ${guideOpen===i ? `<ul class="guide-sec-body">${sec.lines.map(l=>`<li>${l}</li>`).join('')}</ul>` : ''}
            </div>`).join('')}
        </div>
        <button class="btn menu-guide-back" data-action="menu-back">뒤로</button>`;
    } else if(item.view==='settings'){
      body = `
        <div class="menu-settings">
          ${SETTING_TOGGLES.map(t=>{
            const on = !!t.get();
            return `
            <div class="setting-row">
              <div>
                <div class="setting-label">${t.label}</div>
                ${t.hint ? `<div class="setting-hint">${t.hint}</div>` : ''}
              </div>
              <button class="setting-switch ${on?'on':''}" role="switch" aria-checked="${on}"
                      data-action="menu-toggle-setting" data-setting-id="${t.id}">${on?'켬':'끔'}</button>
            </div>`;
          }).join('')}
        </div>
        <button class="btn menu-guide-back" data-action="menu-back">뒤로</button>`;
    } else if(item.view==='confirm'){
      body = `
        <div class="menu-confirm">
          <p>${item.desc}</p>
          <div class="menu-confirm-actions">
            <button class="btn" data-action="menu-back">취소</button>
            <button class="btn danger" data-action="menu-confirm" data-menu-id="${item.id}">${item.confirmLabel||'확인'}</button>
          </div>
        </div>`;
    } else {
      body = `
        <div class="menu-placeholder">
          <p>${item.desc}</p>
          <button class="btn" data-action="menu-back">뒤로</button>
        </div>`;
    }
    return `
      <div class="menu-overlay" role="dialog" aria-modal="true" aria-label="${item?item.title:'메뉴'}" data-action="close-menu">
          <div class="menu-panel ${item&&item.view==='guide'?'wide':''}" data-action="menu-noop">
            <div class="menu-panel-head">
            ${item ? `<h3>${item.title}</h3>` : '<span aria-hidden="true"></span>'}
            <button class="menu-close" data-action="close-menu" aria-label="닫기"><span class="menu-close-ico"></span></button>
          </div>
          ${body}
        </div>
      </div>`;
  }

  function renderTopbar(){
    const pct = Math.max(0, Math.min(100, S.erosion));
    const danger = pct >= 70 ? 'danger' : '';
    return `
      <div class="topbar">
        <div class="ero-row">
          <button class="menu-btn" data-action="open-menu" aria-label="메뉴" aria-haspopup="dialog"><span class="menu-ico"></span></button>
          <div class="ero-label">잠식</div>
          <div class="ero-case ${danger}">
            <div class="ero-fill" style="width:${pct}%"></div>
            <div class="ero-num mono ${danger}">${Math.round(S.erosion)}%</div>
          </div>
        </div>
${(ownedMarkers().length || S.relics.length) ? `<div class="topbar-collection ${S.relics.length?'with-relics':''} ${ownedMarkers().length?'with-markers':''}">
          ${S.relics.length ? `<div class="relic-tray topbar-relics relic-count-${Math.min(4,S.relics.length)}">${S.relics.map(r=>relicChip(r,true)).join('')}</div>` : ''}
          ${ownedMarkers().length ? `<div class="topbar-markers">${ownedMarkers().map(marker=>markerChip(marker)).join('')}</div>` : ''}
        </div>` : ''}
      </div>
      ${renderMenuOverlay()}`;
  }

  function renderTitle(){
    contentEl.innerHTML = `
      <div class="screen title-screen">
        <div class="title-art" style="background-image:url('${ART_KEY}')"></div>
        <img class="title-wordmark" src="${ART_WORDMARK}" alt="FATHOM OF ABYSS">
        ${hasSavedRun() ? `
          <button class="btn primary" data-action="continue-run">이어서 탐색</button>
          <button class="btn" data-action="new-run">새로운 탐색</button>
        ` : `
          <button class="btn primary" data-action="new-run">${hasPlayedBefore() ? '새로운 탐색' : '시작하기'}</button>
        `}
        <div class="title-version">v0.2.0</div>
      </div>`;
  }

  function renderPrologue(){
    contentEl.innerHTML = `
      <div class="screen prologue-screen">
        <img class="title-crest lost" src="assets/new_logo.png" alt="FATHOM OF ABYSS">
        <div class="title-en">Prologue · An Extraction Record</div>
        <h2 style="margin:0;">심해의 인양 기록</h2>
        <div class="prologue-scroll-box" aria-label="프롤로그 이야기">
          <div class="prologue-crawl">
            <p>바다는 모든 것을 삼킨다.<br>빛도, 이름도, 돌아가겠다는 약속도.</p>
            <p>검은 등대 조합은 그것을 성물이라 불렀다.<br>태초의 지식이 새겨져 있다고 했다.</p>
            <p>수심계가 한계를 넘긴 뒤로 아무도 시간을 세지 않았다.<br>창밖은 검은 물조차 아니었다. 유리 너머에서 태초의 어둠이 숨을 쉬었다.</p>
            <p>갈고리가 무언가를 붙잡았다.</p>
            <p class="em">잔해가 아니었다.<br>주먹만 한 눈알 하나. 눈꺼풀도 얼굴도 몸도 없이, 오직 보기 위해서만 만들어진 것.</p>
            <p>들여다본 사람마다 다른 것을 보았다.<br>그 뒤로 우리는 서로의 말을 알아듣지 못했다.</p>
            <p>대장은 보지 않겠다며 제 눈을 바다에 던졌다.<br>그러고도 그는 계속 보았다. 그리고 돌아오지 않았다.</p>
            <p class="em">우리는 심연을 처음으로 보았다.<br><b>같은 순간, 심연도 우리를 보았다.</b></p>
          </div>
        </div>
        <button class="btn primary prologue-proceed" data-action="prologue-begin">기록을 엿본다</button>
      </div>`;
  }

  function renderPrologueFall(){
    contentEl.innerHTML = `
      <div class="screen prologue-screen prologue-fall-screen">
        <div class="title-en">No Return</div>
        <h2 style="margin:0;">심연은 모두를 삼켰다</h2>
        <div class="prologue-copy">인양선은 끝내 닿지 않았다. 남은 것은 심연의 꿈에서 건져 올린 전투 기록뿐이다.</div>
        <div class="prologue-fallen">${S.party.filter(p=>p).map(heroCardHtml).join('')}</div>
        <div class="prologue-panel"><div class="tier-tag">본편으로</div><p>이제 당신은 이 실패의 기록을 바탕으로 새로운 전문가들을 편성해 다시 내려갑니다. 프롤로그의 죽음은 본편의 해금과 덱에 영향을 주지 않습니다.</p></div>
        <button class="btn primary tutorial-pulse" data-action="prologue-real-run">새로운 탐색을 시작한다</button>
      </div>`;
  }

  /* 무엇을 들고 내려갈지 고르는 자리.
     직군마다 무작위 세 장 중 한 장, 공용은 무작위 여섯 장 중 넷을 고른다. */
  function pickRow(group, base, sel, full){
    return `
      <div class="pick-card owner-${base.owner} ${cardVisualClass(base)} ${sel?'sel':''} ${(!sel&&full)?'full':''}"
           data-action="toggle-pick" data-group="${group}" data-name="${base.name}">
        <div class="pick-cost">${base.cost}</div>
        <div class="pick-body">
          <div class="pick-name">${base.name}</div>
          <div class="pick-desc">${base.desc}</div>
        </div>
      </div>`;
  }
  function renderDeckBuild(st){
    /* 떠오른 후보만 늘어놓는다 — 덱에 없는 나머지는 이 판에서는 보이지도 않는다 */
    const offerRows = (group, list, got, full) =>
      (st.offers[group]||[]).map(n=>{
        const b = list.find(c=>c.name===n);
        return b ? pickRow(group, b, got.includes(n), full) : '';
      }).join('');

    const sects = st.selected.map(cid=>{
      const def = CLASS_DEFS[cid];
      const got = st.picks[cid] || [];
      const full = got.length >= PICKS_PER_CLASS;
      return `
        <div class="deck-sect">
          <div class="deck-sect-head">
            <div class="portrait portrait-${cid}" style="width:24px;height:24px;margin:0;">${CLASS_ICON[cid]}</div>
            <span class="deck-sect-name">${def.name}</span>
            <span class="deck-count ${full?'done':''}">${got.length}/${PICKS_PER_CLASS}</span>
          </div>
          ${offerRows(cid, CARD_DB[cid], got, full)}
        </div>`;
    }).join('');

    const nGot = st.picks.neutral || [];
    const nFull = nGot.length >= PICKS_NEUTRAL;
    const neutral = `
      <div class="deck-sect">
        <div class="deck-sect-head">
          <span class="deck-sect-name">중립</span>
          <span class="deck-count ${nFull?'done':''}">${nGot.length}/${PICKS_NEUTRAL}</span>
        </div>
          ${offerRows('neutral', startNeutralCardPool(), nGot, nFull)}
      </div>`;

    const total = st.selected.reduce((a,cid)=>a+((st.picks[cid]||[]).length),0) + nGot.length;
    const need  = st.selected.length*PICKS_PER_CLASS + PICKS_NEUTRAL;
    return `
      <div class="tier-tag">무엇을 들고 내려갈까</div>
      <div class="af-hint">직업 후보 <b>${CLASS_OFFER_SIZE}장</b> 중 <b>${PICKS_PER_CLASS}장</b>, 공용 후보 <b>${NEUTRAL_OFFER_SIZE}장</b> 중 <b>${PICKS_NEUTRAL}장</b>을 고른다.
        공용 후보에는 가끔 에픽이 섞인다 —
        고른 카드는 한 장씩 들어가 모두 ${need}장으로 시작합니다. 전투 보상으로 최대 ${MAX_DECK_SIZE}장까지 늘릴 수 있습니다.</div>
      ${sects}
      ${neutral}
      <div class="setup-btn-row">
        <button class="btn" data-action="deck-back">뒤로</button>
        <button class="btn primary" data-action="confirm-setup" ${total===need?'':'disabled'}>하강 시작 · ${total}/${need}</button>
      </div>`;
  }

  function partyLimit(){ return S.setup.reform || UNLOCKED.length ? PARTY_MAX : PARTY_START; }

  function renderClassSelect(){
    const st = S.setup;
    const LIM = partyLimit();
    let body = '';
    if(st.phase==='pick-classes'){
      body = `
        <div class="tier-tag">${st.reform?'대열을 다시 짠다':'전문가를 선택하세요'} (${st.selected.length}/${LIM})</div>
        <div class="class-grid">
          ${Object.values(CLASS_DEFS).map(def=>{
            const sel = st.selected.includes(def.id);
            const locked = !isUnlocked(def.id);
            return `
            <div class="class-card ${sel?'sel':''} ${locked?'locked':''}" ${locked?'':`data-action="toggle-class" data-id="${def.id}"`}>
              <div class="portrait portrait-${def.id}" style="margin:0 auto 6px;">${CLASS_ICON[def.id]}</div>
              <div class="class-name">${def.name} ${reachChip({reach:def.reach})}</div>
              ${locked ? `<div class="class-locked-tag">여관에서 만나지 못했다</div>`
                       : `<div class="class-tagline">${def.tagline}</div>
                          <div class="class-blurb">${def.blurb}</div>`}
            </div>`;
          }).join('')}
        </div>
        <button class="btn primary" data-action="classes-next" ${st.selected.length===LIM?'':'disabled'}>다음 — 위치 배치</button>`;
    } else if(st.phase==='assign-ranks'){
      const trayIds = st.selected.filter(id=>!st.placements.includes(id));
      /* 빈 칸은 열을 차지하지 않는다 — 실제로 서게 될 열을 미리 보여준다 */
      const badPlacements = st.placements.filter((cid,i)=>{
        if(!cid) return false;
        const eff = st.placements.slice(0,i).filter(Boolean).length;
        return !canActFrom({reach:CLASS_DEFS[cid].reach}, eff);
      }).length;
      body = `
        <div class="tier-tag">대열을 짜세요</div>
        <div class="rank-slots">
          ${Array.from({length:LIM}, (_,i)=>i).map(i=>{
            const cid = st.placements[i];
            const def = cid ? CLASS_DEFS[cid] : null;
            const droppable = st.armed && !cid;
            const eff = st.placements.slice(0,i).filter(Boolean).length;
            const bad = cid && !canActFrom({reach:def.reach}, eff);
            return `
            <div class="rank-slot ${cid?'filled':'empty'} ${droppable?'droppable':''} ${bad?'bad':''}" data-action="place-rank" data-idx="${i}">
              <div class="rank-slot-label">${cid ? rankName(eff) : '—'}</div>
              ${def
                ? `<div class="portrait portrait-${cid}" style="width:30px;height:30px;margin:3px auto;">${CLASS_ICON[cid]}</div>
                   <div class="rank-slot-name">${def.name}</div>
                   <div style="margin-top:3px;">${reachChip({reach:def.reach})}</div>
                   ${bad ? `<div class="rank-warn">공격 불가</div>` : ''}`
                : `<div class="rank-slot-hint">비어있음</div>`}
            </div>`;
          }).join('')}
        </div>
        <div class="reach-legend">
          근접은 <b>전열·중열</b>에서만 휘두르고, 원거리는 <b>전열에 서면</b> 겨눌 수 없다.<br>
          빈 칸은 열로 세지 않으며, 앞이 쓰러지면 뒤가 당겨진다.
        </div>
        ${badPlacements ? `<div class="rank-warn" style="font-size:10px;">지금 배치로는 ${badPlacements}명이 공격할 수 없다</div>` : ''}
        <div class="hero-tray">
          ${trayIds.map(cid=>{
            const def = CLASS_DEFS[cid];
            return `<div class="tray-chip ${st.armed===cid?'armed':''}" data-action="arm-hero" data-id="${cid}">${def.name}</div>`;
          }).join('')}
        </div>
        <div class="af-hint">${st.armed ? '배치할 위치를 탭하세요' : (trayIds.length ? '탭하여 전문가를 든 다음, 위치를 탭하세요' : '전문가 배치가 끝났다')}</div>
        <div class="setup-btn-row">
          <button class="btn" data-action="classes-back">뒤로</button>
          ${st.reform
            ? `<button class="btn primary" data-action="confirm-reform" ${trayIds.length===0?'':'disabled'}>이 대열로 내려간다</button>`
            : `<button class="btn primary" data-action="ranks-next" ${trayIds.length===0?'':'disabled'}>다음 — 덱 구성</button>`}
        </div>`;
    } else {
      body = renderDeckBuild(st);
    }
    contentEl.innerHTML = `
      <div class="screen map-screen">
        ${body}
      </div>`;
  }

  function renderMap(){
    const avail = availableNodes();
    const ch = chapter();
    /* 이번 구역에서 지나온 자취만 남긴다 — 인양될 때마다 발자국은 새로 찍힌다 */
    const crumbs = S.mapVisited.slice(S.mapVisited.length - S.stepInChapter).map(n=>{
      const ic = n.type==='battle'?IC_CRUMB_BATTLE:n.type==='elite'?IC_CRUMB_ELITE:n.type==='rest'?IC_CRUMB_REST:IC_CRUMB_LOOT;
      return `<div class="crumb-chip">${ic}</div>`;
    }).join('');
    const bossNext = avail.length===1 && avail[0].boss;
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen map-screen">
        <div class="chapter-tag">${ch.title} · ${ch.tier}<span class="chapter-step">${S.stepInChapter}/${ch.length}</span></div>
        <div class="chapter-threat">${tierThreat(ch.tier).label}</div>
        ${S.stepInChapter ? `<div class="path-trail">${crumbs}</div>` : `<div class="chapter-lead">${ch.lead}</div>`}
        <div class="tier-tag">${bossNext ? '길이 하나로 좁혀졌다' : '다음 향할 곳을 선택하세요'}</div>
        <div class="node-choices">
          ${avail.map(n=>{
            const typeLabel = n.boss?'수문장':n.type==='battle'?'조우':n.type==='elite'?'엘리트':n.type==='rest'?'은신처':'회수';
            return `
            <div class="node-card${n.boss?' boss':''}" data-action="enter-node" data-id="${n.id}">
              <div class="node-type-tag">${typeLabel} · ${n.tier}</div>
              <h3>${n.title}</h3>
              <p>${n.desc}</p>
              <div class="node-card-cta">${n.boss?'넘어선다 →':'선택 →'}</div>
            </div>`;
          }).join('')}
        </div>
      </div>`;
  }

  function relicChip(r, compact){
    return `<div class="relic-chip" title="${r.boon}">${relicPortrait(r,false,compact)}<span>${r.name}</span></div>`;
  }
  function markerChip(marker){
    return `<div class="marker-chip" title="${marker.name} — ${marker.flavor}"><img src="${marker.asset}" alt="${marker.name}"></div>`;
  }

  function renderEscape(){
    const ch = chapter();
    const esc = S.escape || {offer:[], taken:null, growth:[], marker:null};
    const next = CHAPTERS[S.chapter+1];
    const picked = esc.taken;
    contentEl.innerHTML = `
      <div class="screen escape-screen">
        <div class="title-en">Extracted</div>
        <h2 style="margin:0;">${ch.tier} 구역을 빠져나왔다</h2>
        <div class="escape-note">
          인양줄이 당겨진다. 수면 위의 공기는 낯설지만, 파도는 이제 당신의 이름을 알고 있다.
        </div>
        ${esc.growth && esc.growth.length ? `<div class="escape-growth">
          <div class="escape-growth-title">생환자 적응 · 하강이 몸에 남았다</div>
          ${esc.growth.map(g=>`<div class="escape-growth-row"><span>${g.name} · 생환 ${g.descent}회</span><small>최대 체력 ×${g.hpMultiplier} (${g.hpGain>0?'+':''}${g.hpGain}) · 회피/흘림 +${g.reactPct}%</small></div>`).join('')}
        </div>` : ''}
        ${esc.marker ? `<div class="relic-card drop">
          <div class="drop-banner">관측 표식을 회수했다</div>
          <div class="relic-glyph"><img class="px" src="${esc.marker.asset}" alt="${esc.marker.name}" style="width:74px;height:74px;object-fit:contain;margin:auto;"></div>
          <div class="relic-name">${esc.marker.name}</div>
          <div class="relic-boon">영구 관측 기록 · ${ownedMarkers().length}/${MARKER_DEFS.length}</div>
          <div class="relic-desc">${esc.marker.flavor}<br>상단의 관측 표식 탭에 보관된다.</div>
        </div>` : ''}
        ${(picked && S.relics.indexOf(picked)<0) ? `
          <div class="escape-note">자리가 없어 ${picked.name}은(는) 두고 왔다.</div>
          <div class="escape-note">부두 끝에 불이 켜진 여관이 하나 있다. 하강 전에 들를 수 있는 마지막 자리다.</div>
          <button class="btn primary" data-action="to-tavern">여관으로 간다</button>
        ` : picked ? `
          <div class="relic-card">
            <div class="relic-glyph">${relicPortrait(picked,true)}</div>
            <div class="relic-name">${picked.name}</div>
            ${relicTier(picked)}
            <div class="relic-boon">${picked.boon}</div>
            <div class="relic-desc">${picked.flavor}</div>
          </div>
          <div class="escape-note">부두 끝에 불이 켜진 여관이 하나 있다. 하강 전에 들를 수 있는 마지막 자리다.</div>
          <button class="btn primary" data-action="to-tavern">여관으로 간다</button>
        ` : `
          <div class="tier-tag">건져 올린 것 중 하나를 챙긴다</div>
          <div class="relic-offer">
            ${esc.offer.map(r=>`
              <div class="relic-opt" data-action="take-relic" data-id="${r.id}">
                <div class="relic-opt-head">${relicPortrait(r)}<span>${r.name}</span>${relicTier(r)}</div>
                <div class="relic-boon">${r.boon}</div>
                <div class="relic-desc">${r.flavor}</div>
              </div>`).join('')}
          </div>
        `}
      </div>`;
  }

  function reachChip(unit){
    const r = reachOf(unit);
    return `<span class="reach-chip reach-${r.id}">${r.label}</span>`;
  }
  function reactBadge(unit){
    if(!unit || !unit.react || !S.battle) return '';
    const k = unit.react.kind;
    const ic = k==='dodge' ? IC_DODGE : k==='guard' ? IC_GUARDED : IC_RIPOSTE;
    const label = k==='dodge' ? '회피' : k==='guard' ? '흘림' : '반격';
    return `<div class="react-tag react-${k}">${ic}<span>${label}</span></div>`;
  }
  function pendingCard(){
    const b = S.battle;
    if(!b || !b.pendingCardUid) return null;
    return b.hand.find(c=>c.uid===b.pendingCardUid) || null;
  }

  function survivalMarks(hero){
    const count = Math.min(5, Math.max(0, Math.floor(hero && hero.descentWins || 0)));
    return count ? `<span class="survival-marks" aria-label="생환 ${count}회">${'<i class="survival-mark"></i>'.repeat(count)}</span>` : '';
  }

  function heroCardHtml(hero){
    if(!hero) return `<div class="hero-card empty">공석</div>`;
    const hpRatio = Math.max(0, hero.hp/hero.maxHp);
    const hpPct = hpRatio*100;
    const shownDp = Math.round(Number.isFinite(hero.dp) ? hero.dp : 0);
    const dead = !hero.alive;
    const rank = heroRank(hero);
    const idle = !dead && !canActFrom(hero, rank);
    const targetable = S.battle && S.battle.pendingDomain==='ally' && hero.alive;
    const tutorialPulse = !!(S.prologue && S.prologue.stage==='pressure' && targetable && hero.cls==='oracle');
    return `
      <div class="hero-card cls-${hero.cls} ${hero.collapsed?'collapsed':''} ${targetable?'targetable':''} ${tutorialPulse?'tutorial-pulse':''} ${idle?'idle':''}"
           style="${dead?'opacity:0.35;':''}"
           data-action="choose-target" data-domain="ally" data-id="${hero.id}">
        <div class="status-stack">
          ${reactBadge(hero)}
          ${(hero.invulnerableTurns||0)>0 ? `<div class="invulnerable-tag">무적 ${hero.invulnerableTurns}</div>` : ''}
          ${hero.block>0 ? `<div class="block-tag">${IC_BLOCK}${hero.block}</div>` : ''}
        </div>
        <div class="portrait portrait-${hero.cls}">${CLASS_ICON[hero.cls]}${survivalMarks(hero)}</div>
        <div class="hero-rank">${dead?'전사':rankName(rank)} ${reachChip(hero)}</div>
        <div class="hero-name">${hero.name}</div>
        <div class="hero-hpline dp-line">
          <div class="hpbar dpbar ${dead?'':(shownDp>=70?'urgent':'')}">
            <div class="fill" style="width:${shownDp}%; background-color:${dpColor(shownDp)};"></div>
          </div>
          <div class="hero-num mono">${shownDp}</div>
        </div>
        <div class="hero-hpline">
          <div class="hpbar lifebar ${dead?'':(hpPct<=30?'urgent':'')}" style="--vital-dur:${vitalDuration(hpRatio)}s;">
            <div class="fill" style="width:${hpPct}%; background-color:${hpFillColor(hpRatio)};"></div>
          </div>
          <div class="hero-num mono">${hero.hp}/${hero.maxHp}</div>
        </div>
        ${idle ? `<div class="rank-warn">사거리 밖</div>` : ''}
      </div>`;
  }

  function foeCardHtml(en, i){
    const b = S.battle;
    const hpRatio = Math.max(0, en.hp/en.maxHp);
    const hpPct = hpRatio*100;
    const tSlug = tierSlug(b.tier);
    const rank = foeRank(en);
    const isBoss = en.kind==='boss';
    const isElite = en === b.enemies[0] && b.node && b.node.type==='elite';
    const isAwakened = isBoss && en.phase===2;
    const dead = !en.alive;
    const idle = !dead && (!canActFrom(en, rank) || heroesInReach(en).length===0);

    /* 조준 중인 카드가 실제로 닿는 적만 밝힌다 */
    const pc = pendingCard();
    const targetable = b.pendingDomain==='enemy' && en.alive && pc && enemyTargetsFor(pc).indexOf(en) >= 0;

    const tutorialPulse = !!(S.prologue && S.prologue.stage==='strike' && b.pendingDomain==='enemy' && targetable);
    return `
      <div class="foe-card ${targetable?'targetable':''} ${tutorialPulse?'tutorial-pulse':''} ${isElite?'elite-foe':''} ${isBoss?'boss-foe':''} ${isAwakened?'boss-awakened':''} ${idle?'idle':''}"
           style="${dead?'opacity:0.3;':''}"
           data-action="choose-target" data-domain="enemy" data-idx="${i}">
        <div class="status-stack">
          ${reactBadge(en)}
          ${en.block>0 ? `<div class="block-tag">${IC_BLOCK}${en.block}</div>` : ''}
        </div>
        <div class="foe-rank">${dead?'소멸':(isAwakened?'각성':rankName(rank))} ${reachChip(en)}</div>
        <div class="enemy-portrait tier-${tSlug}">${en.icon || ICON_WATCHER}</div>
        <div class="foe-name">${foeDisplayName(en)}</div>
        <div class="hero-hpline">
          <div class="hpbar ${dead?'':(hpPct<=30?'urgent':'')}" style="--vital-dur:${vitalDuration(hpRatio)}s;">
            <div class="fill" style="width:${hpPct}%"></div>
          </div>
          <div class="hero-num mono">${en.hp}/${en.maxHp}</div>
        </div>
        ${en.alive && en.intent ? `<div class="intent-badge"><span class="ic">${en.intent.ic}</span>${en.intent.label}${en.intent.val?` · ${en.intent.val}`:''}</div>` : (dead?`<div class="foe-dead">소멸</div>`:'')}
      </div>`;
  }

  function describeCard(card){
    /* 설명은 원본 문구가 아니라 카드의 현재 수치로 조립한다.
       따라서 강화·합성으로 바뀐 피해, 방어, 회복 등의 값이 모든 등급에서 즉시 반영된다. */
    switch(card.type){
      case 'attack':
      case 'fusion_attack':
      case 'epic_attack': {
        let s;
        if(card.range==='aoe') s = `모든 적에게 ${card.dmg} 피해.`;
        else if(card.range==='melee') s = `전열 적에게 ${card.dmg} 피해.`;
        else s = `적 한 명을 골라 ${card.dmg} 피해.`;
        if(card.selfBlock) s += ` 자신 방어 ${card.selfBlock} 획득.`;
        if(card.selfDp) s += ` 자신 심도압박 ${card.selfDp} 상승.`;
        return s;
      }
      case 'drowned_sentence': return `적 한 명에게 ${card.dmg} 피해. 양옆 적에게 ${Math.round(card.dmg*card.splashRatio)} 피해(본 피해의 1/5).`;
      case 'abyssal_verdict': return '보스를 제외한 지정 적을 즉시 섬멸. 강화 불가.';
      case 'thousand_maws_tide': return '선택한 적 양옆의 일반 적을 즉시 섬멸. 엘리트·보스 제외 · 강화 불가.';
      case 'sunken_ark': return `${card.turns||1}턴 동안 생존한 아군 전체 무적. 강화 불가.`;
      case 'nameless_hymn': return '아군 전체 심도압박을 0으로 만들고, 지운 총합의 1/3만큼 모든 적에게 피해.';
      case 'saints_last_prayer': return `생존한 아군 전체 체력 ${Math.round(card.healRatio*100)}% 회복. ${card.regenTurns}턴 동안 추가로 총 ${card.regenTotal} 회복.`;
      case 'block': return `자신 방어 ${card.block} 획득.`;
      case 'block_party': {
        let s = `생존한 아군 전체 방어 ${card.block} 획득.`;
        if(card.riposteRatio) s += ` 공격받으면 방어 획득값의 ${Math.round(card.riposteRatio*100)}% 반격.`;
        else if(card.riposte) s += ` 공격받으면 공격자에게 ${card.riposte} 반격.`;
        return s;
      }
      case 'heal': return `아군 한 명 체력 ${card.heal} 회복.`;
      case 'heal_party': return `생존한 아군 전체 체력 ${card.heal} 회복.`;
      case 'calm': return `아군 한 명 심도압박 ${card.calm} 감소.`;
      case 'calm_party': return `생존한 아군 전체 심도압박 ${card.calm} 감소.`;
      case 'fuse_support': return `아군 한 명 체력 ${card.heal} 회복 + 심도압박 ${card.calm} 감소.`;
      case 'double_ap': return '현재 턴에 사용할 수 있는 남은 AP를 두 배로 만든다.';
      case 'legendary_sanctuary': return `생존한 아군 전체 체력 ${card.heal} 회복 + 심도압박 ${card.calm} 감소 + 방어 ${card.block} 획득.`;
      case 'emergency_escape': return '이 전투에서 빠져나와 지도로 돌아간다. 압박 50 이상인 대원과 유물 대부분을 잃는다.';
      case 'draw': return `카드 ${card.draw}장을 드로우한다.`;
      case 'foresight': return `카드 ${card.draw}장 드로우. 자신 심도압박 ${card.calm} 감소.`;
      case 'reroll_intent': return `적 한 명의 예고된 행동을 다시 정한다.`;
      case 'swap': return `아군 한 명을 전열로 이동시킨다. (이미 전열이면 중열과 교대)`;
      default: return card.desc || '';
    }
  }

  /* 못 내는 카드에는 이유를 붙여 보여준다 — 왜 회색인지 알아야 자리를 고친다 */
  function castRankNote(card){
    const why = S.battle ? cardBlockReason(card) : null;
    return why ? ` — ${why}` : '';
  }

  function cardHtml(card, playable, selecting){
    const glitch = card.contaminated;
    const desc = glitch ? '？？？ 효과 미상 — 사용 시 확인됨' : (describeCard(card) + castRankNote(card));
    const tutorialPulse = !!(S.prologue && (
      (S.prologue.stage==='brace' && card.name==='놋쇠 벽') ||
      (S.prologue.stage==='strike' && card.name==='저주받은 조준') ||
      (S.prologue.stage==='pressure' && card.name==='속죄의 기도')
    ));
    return `
      <div class="card owner-${card.owner} ${cardVisualClass(card)} ${playable?'':'unplayable'} ${tutorialPulse?'tutorial-pulse':''} ${glitch?'contaminated':''} ${selecting?'selecting':''}" data-uid="${card.uid}" data-action="play-card">
        <div class="card-cost mono">${card.cost}</div>
        <div class="card-name ${glitch?'glitch':''}">${glitch ? garble(card.name) : card.name}</div>
        <div class="card-desc ${glitch?'glitch':''}">${desc}</div>
        <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
      </div>`;
  }

  function prologueBattlePanel(){
    if(!S.prologue) return '';
    const step = S.prologue.stage;
    const copy = step==='brace'
      ? ['01 · AP와 방어','AP는 카드 비용으로 사용합니다. <b>놋쇠 벽</b>을 눌러 전열의 방어를 준비하세요.']
      : step==='braceDone'
      ? ['02 · 예고와 임시 AP','적의 카드 아래에는 다음 행동이 보입니다. 지금 AP가 <b>2개</b> 남았습니다. <b>턴 종료</b>를 누르면 다음 턴에 반투명한 임시 AP +1을 얻습니다. 방어 9로 <b>내려찍기 12</b>를 버텨 보세요.']
      : step==='strike'
      ? ['03 · 표적과 심도압박','반투명 AP는 이번 턴에만 쓰이며 먼저 소모됩니다. <b>저주받은 조준</b>을 누른 뒤 두 적 중 하나를 골라 보세요. 원거리 공격과 심도압박의 대가를 확인합니다.']
      : step==='pressure'
      ? ['04 · 심도압박','심도압박은 심연의 감각에 인간의 인식이 동조되는 정도입니다. 방어로 막을 수 없습니다. <b>속죄의 기도</b>를 누른 뒤 압박이 오른 이단 예지자를 선택하세요. 100에 닿으면 가하는 피해는 50% 감소하고 받는 피해는 50% 증가합니다.']
      : step==='abyss'
      ? ['05 · 잠식','턴이 지나자 잠식이 25% 올랐습니다. 잠식이 100%가 되면 탐색은 즉시 끝납니다.']
      : null;
    if(!copy) return '';
    return `<div class="prologue-panel"><div class="tier-tag">${copy[0]}</div><p>${copy[1]}</p>
      ${step==='abyss'?'<button class="btn danger tutorial-pulse" style="margin-top:7px;padding:7px 12px;font-size:10px;" data-action="prologue-abyss">더 깊이 내려간다</button>':''}
    </div>`;
  }

  function garble(str){
    const glyphs = ['◈','҂','⁂','†','☩','▒','░','⍟','✢','⌁'];
    return str.split('').map(ch => Math.random()<0.5 ? glyphs[Math.floor(Math.random()*glyphs.length)] : ch).join('');
  }

  function renderBattle(){
    const b = S.battle;

    let pips = '';
    for(let i=0;i<b.maxAp;i++){ pips += `<div class="pip ${i<b.ap?'filled':''}"></div>`; }
    for(let i=0;i<(b.tempAp||0);i++){ pips += `<div class="pip temp filled"></div>`; }

    const heroesHtml = S.party.filter(h=>h).map(h=>heroCardHtml(h)).join('');
    const foesHtml = b.enemies.map((en,i)=>foeCardHtml(en,i)).join('');

    const handHtml = b.hand.map(c=>{
      const playable = canPlayCard(c);
      const selecting = b.pendingCardUid===c.uid;
      return cardHtml(c, playable, selecting);
    }).join('');
    const drawSwapHtml = b.pendingDraw ? `
      <div class="draw-swap">
        <div class="draw-swap-title">손패가 가득 찼다</div>
        <div class="draw-swap-copy">새로 뽑힌 카드를 받으려면 손에 든 카드 한 장을 버려야 합니다.</div>
        <div class="card owner-${b.pendingDraw.card.owner} ${cardVisualClass(b.pendingDraw.card)} draw-swap-card">
          <div class="card-cost mono">${b.pendingDraw.card.cost}</div>
          <div class="card-name">${b.pendingDraw.card.name}</div>
          <div class="card-desc">${describeCard(b.pendingDraw.card)}</div>
          <div class="card-owner-tag">${cardRarityLabel(b.pendingDraw.card) ? cardRarityLabel(b.pendingDraw.card)+' · ' : ''}${ownerLabel(b.pendingDraw.card.owner)}</div>
        </div>
        <div class="draw-swap-copy">버릴 카드 선택</div>
        <div class="draw-replace-list">${b.hand.map(c=>`<div class="draw-replace-row" data-action="replace-draw" data-uid="${c.uid}">${c.name} · AP ${c.cost}</div>`).join('')}</div>
      </div>` : '';

    /* 중앙 명판 — 조준 중이면 안내, 아니면 최근 전투 기록 */
    let logHtml;
    if(b.pendingCardUid){
      logHtml = '대상을 선택하세요 · 카드를 다시 탭하면 취소';
    } else if(S.logLines && S.logLines.length){
      const n = S.logLines.length;
      logHtml = S.logLines.map((l,i)=>`<span class="l ${i===n-1?'latest':'old'}">${l}</span>`).join('');
    } else {
      logHtml = S.logMsg || '';
    }

    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen battle-screen">
        <div class="enemy-zone">
          <div class="foe-row ${b.enemies.length>2?'many':''} ${b.enemies.length>=4?'crowded':''}">${foesHtml}</div>
        </div>

        <div class="mid-stage">
          <div class="log-plate ${b.pendingCardUid?'targeting':''}">${logHtml}</div>
        </div>

        ${prologueBattlePanel()}

        <div class="party-zone">${heroesHtml}</div>

        <div class="hand-zone">
          <div class="ap-row">
            <div class="ap-label">AP</div>
            ${pips}
            <div class="mono" style="font-size:11px;color:var(--muted);margin-left:8px;">턴 ${b.turn}</div>
          </div>
          <div class="hand-row">${handHtml}</div>
          <div class="end-turn-row">
            <button class="btn ${S.prologue&&S.prologue.stage==='braceDone'?'tutorial-pulse':''}" data-action="end-turn" ${(b.over||b.pendingCardUid||b.pendingDraw||(S.prologue&&S.prologue.stage!=='braceDone'))?'disabled':''}>턴 종료</button>
          </div>
        </div>
        ${drawSwapHtml}
      </div>`;
  }

  function renderRest(){
    const r = S.rest;
    const partyStatus = S.party.map((p,i)=>{
      if(!p) return '';   /* 아직 열리지 않은 자리 — 칸을 만들지 않는다 */
      const dp = Math.round(Number.isFinite(p.dp) ? p.dp : 0);
      const state = p.alive ? `${rankName(i)} · 생존` : `${rankName(i)} · 전사`;
      const veteran = p.descentWins ? `<br>생환 ${p.descentWins}회 · 적응 HP +${p.descentHp||0} · 회피/흘림 +${Math.round((p.descentReact||0)*1000)/10}%` : '';
      return `<div class="rest-party-member ${p.alive?'':'dead'}"><div class="rest-party-name">${p.name}</div><div class="rest-party-meta">${state}<br>HP ${p.hp}/${p.maxHp} · <span class="dp">압박 ${dp}</span>${veteran}</div></div>`;
    }).join('');
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">은신처</div>
        <h3 style="margin:0;">잠시 숨을 고른다</h3>
        <div class="rest-party-status">
          <div class="rest-party-title">현재 인양대 상태</div>
          <div class="rest-party-grid">${partyStatus}</div>
        </div>
        <div class="rest-opts">
          <div class="rest-opt ${r.choice==='heal'?'sel':''}" data-action="rest-pick" data-kind="heal">
            <div class="t">상처를 봉합한다</div>
            <div class="d">생존한 아군 전체 체력 +10</div>
          </div>
          <div class="rest-opt ${r.choice==='calm'?'sel':''}" data-action="rest-pick" data-kind="calm">
            <div class="t">눈을 감고 침묵한다</div>
            <div class="d">생존한 아군 전체 심도압박 -18</div>
          </div>
        </div>
        <button class="btn primary" data-action="rest-confirm" ${r.choice?'':'disabled'}>계속 하강한다</button>
      </div>`;
  }

  function renderAftermath(){
    const a = S.aftermath;
    const node = S.pendingNode;
    let body = '';
    if(a.cardOffer && a.cardOffer.length){
      body = `
        <div class="tier-tag">전투 보상 · 덱 ${S.runDeck.length}/${MAX_DECK_SIZE}</div>
        <div class="af-hint">심연이 남긴 카드 3장 중 하나를 덱에 넣습니다.</div>
        <div class="card-reward-grid">${a.cardOffer.map((card,i)=>`
          <div class="card owner-${card.owner} ${cardVisualClass(card)} reward-card" data-action="take-card-reward" data-index="${i}">
            <div class="card-cost mono">${card.cost}</div>
            <div class="card-name">${card.name}</div>
            <div class="card-desc">${describeCard(card)}</div>
            <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
          </div>`).join('')}</div>`;
    } else if(a.reveal){
      const card = a.reveal.card;
      /* 등급 광원과 파편은 카드가 새로 손에 들어오는 이 한 순간에만 남긴다. */
      const epicAcquired = !!a.reveal.epicAcquired;
      const legendaryAcquired = !!a.reveal.legendaryAcquired;
      const revealFx = legendaryAcquired ? 'legendary' : (epicAcquired ? 'epic' : (a.reveal.kind==='upgrade' ? 'upgrade' : 'fusion'));
      const sparkCount = legendaryAcquired ? 20 : (epicAcquired ? 12 : 0);
      const sparks = sparkCount ? Array.from({length:sparkCount},(_,i)=>`<i class="reveal-spark" style="--i:${i}"></i>`).join('') : '';
      body = `
        <div class="reveal-stage reveal-${revealFx}">
          <div class="reveal-banner">${a.reveal.kind==='upgrade' ? '카드가 강화되었다' : isLegendaryCard(card) ? '전설 카드가 모습을 드러냈다' : isEpicCard(card) ? '심연이 응답했다 — 에픽 카드 획득' : '두 카드가 합성되었다'}</div>
          <div class="reveal-card-wrap">
            <div class="card owner-${card.owner} ${cardVisualClass(card)} reveal-card">
              <div class="card-cost mono">${card.cost}</div>
              <div class="card-name">${card.name}</div>
              <div class="card-desc">${describeCard(card)}</div>
              <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
            </div>
            <div class="reveal-sparks" aria-hidden="true">${sparks}</div>
          </div>
          <button class="btn primary" data-action="reveal-confirm">계속하기</button>
        </div>`;
    } else if(a.selecting==='upgrade'){
      const opts = groupedUpgradeOptions();
      const selected = opts.find(g=>g.defId===a.upgradeSelected) || null;
      const preview = selected ? previewUpgradeCard(selected.card) : null;
      body = `
        <div class="af-list">
          ${opts.length ? opts.map(g=>{
            const isSelected = !!selected && selected.defId===g.defId;
            const locked = !!selected && !isSelected;
            const unavailable = upgradeNeedsMerge(g) && !canUpgradeGroup(g);
            const blocked = locked || unavailable;
            const materialNote = upgradeNeedsMerge(g) ? ` · 동일 +${g.level} ${g.count}/2장` : '';
            return `<div class="af-row ${cardVisualClass(g.card)} ${isSelected?'sel':''} ${locked?'locked':''} ${unavailable?'unavailable':''}" ${blocked?'':`data-action="select-upgrade" data-defid="${g.defId}"`}>
              <div class="af-row-name">${g.name}</div>
              <div class="af-row-owner">${cardRarityLabel(g.card)} · ${ownerLabel(g.owner)} · 보유 ${g.count}장 · +${g.level}/+${MAX_UPGRADE_LEVEL}${materialNote}</div>
            </div>`;
          }).join('') : `<div class="af-empty">강화할 수 있는 덱 카드가 없다.</div>`}
        </div>
        ${selected&&preview ? `<div class="upgrade-preview ${cardVisualClass(selected.card)}">
          <div class="upgrade-preview-title">${selected.name} · +${selected.level} → <b>+${selected.level+1}</b></div>
          <div class="upgrade-preview-line">AP ${selected.card.cost} · ${cardRarityLabel(selected.card)} · ${ownerLabel(selected.owner)} · ${upgradeNeedsMerge(selected) ? `동일 카드 +${selected.level} 2장을 합성` : '선택한 카드 1장'}</div>
          <div class="upgrade-preview-line">현재: ${describeCard(selected.card)}</div>
          <div class="upgrade-preview-line"><b>강화 후:</b> ${describeCard(preview)}</div>
        </div><div class="af-hint">선택한 카드를 다시 누르면 선택을 해제할 수 있습니다.</div><button class="btn primary" data-action="do-upgrade" data-defid="${selected.defId}">${upgradeNeedsMerge(selected) ? '두 카드를 합쳐 강화한다' : '이 카드를 강화한다'}</button>` : `<div class="af-hint">카드를 선택하면 현재 정보와 강화 후 효과를 확인합니다. +3부터는 동일 카드 2장이 필요합니다.</div>`}
        <button class="btn" data-action="aftermath-back">뒤로</button>`;
    } else if(a.selecting==='fuse'){
      const materialCards = fusionMaterialCards();
      const opts = groupedFusionOptions();
      const materials = a.fuseSelected.map(id=>materialCards.find(c=>c.defId===id)).filter(Boolean);
      const inspect = c => `<div class="card-inspect ${cardVisualClass(c)}">
        <div class="card-inspect-head"><span>${isLegendaryCard(c)?'◆ ':isEpicCard(c)?'✦ ':''}${c.name}</span><span class="card-inspect-meta">AP ${c.cost} · ${cardRarityLabel(c)} · ${ownerLabel(c.owner)}</span></div>
        <div class="card-inspect-effect">${describeCard(c)}</div>
      </div>`;
      body = `
        <div class="af-list">
          ${opts.length ? opts.map(g=>{
            const chosen = g.defIds.some(id=>a.fuseSelected.includes(id));
            return `<div class="af-row ${cardVisualClass(g.card)} ${chosen?'sel':''}" data-action="toggle-fuse" data-defid="${g.defId}">
              <div class="af-row-name">${g.name}</div>
              <div class="af-row-owner">${cardRarityLabel(g.card)} · ${ownerLabel(g.owner)} · 보유 ${g.count}장</div>
            </div>`;
          }).join('') : `<div class="af-empty">합성할 수 있는 덱 카드가 없다.</div>`}
        </div>
        ${materials.length ? `<div class="fusion-inspect"><div class="af-hint">선택한 합성 재료</div>${materials.map(inspect).join('')}</div>` : `<div class="af-hint">카드를 선택하면 AP와 효과를 확인할 수 있습니다.</div>`}
        <div class="af-hint">현재 덱의 카드만 재료로 선택할 수 있습니다. 결과: 중립 또는 현재 인양대 직업 카드 무작위 · 에픽 출현 5%</div>
        ${a.fuseSelected.length===2 ? `<button class="btn primary" data-action="do-fuse">합성하기</button>` : `<div class="af-hint">중립 또는 직업 카드 2장을 선택하세요 (${a.fuseSelected.length}/2)</div>`}
        <button class="btn" data-action="aftermath-back">뒤로</button>`;
    } else {
      body = `
        <div class="rest-opts">
          <div class="rest-opt" data-action="aftermath-pick" data-kind="upgrade"><div class="t">카드 강화</div><div class="d">보유 카드 한 장을 골라 영구히 강화한다</div></div>
          <div class="rest-opt" data-action="aftermath-pick" data-kind="fuse"><div class="t">카드 합성</div><div class="d">중립·직업 카드 2장을 무작위 중립·직업·에픽 카드로 합친다</div></div>
        </div>
        <button class="btn" data-action="aftermath-skip">그냥 넘어가기</button>`;
    }
    const upgradeGuide = a.selecting==='upgrade' && a.upgradeGuide ? `
      <div class="upgrade-guide-overlay" role="dialog" aria-modal="true" aria-label="강화 규칙 안내">
        <div class="upgrade-guide-panel">
          <h3>강화 규칙</h3>
          <p>카드는 <b>+3까지</b> 한 장씩 강화할 수 있습니다.</p>
          <p><b>+3 → +4</b>, <b>+4 → +5</b> 강화에는 같은 카드·같은 강화 단계의 카드 2장이 필요합니다.</p>
          <p>예: <b>놋쇠 벽 +3</b> 두 장을 합쳐 <b>놋쇠 벽 +4</b> 한 장을 만듭니다.</p>
          <button class="btn primary" data-action="dismiss-upgrade-guide">알겠습니다</button>
        </div>
      </div>` : '';
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">${node?node.title:''} · 완료</div>
        ${a.reveal ? '' : `<h3 style="margin:0;">${a.actionsLeft>0? `정화 기회 ${a.actionsLeft}회 남음` : '완료'}</h3>`}
        ${(!a.reveal && node && node.desc) ? `<p class="af-flavor">${node.desc}</p>` : ''}
        ${(!a.reveal && !a.selecting && a.dropped && S.relics.indexOf(a.dropped)>=0) ? `
          <div class="relic-card drop">
            <div class="drop-banner">사체 아래에서 무언가 건져 올렸다</div>
            <div class="relic-glyph">${relicPortrait(a.dropped,true)}</div>
            <div class="relic-name">${a.dropped.name}</div>
            ${relicTier(a.dropped)}
            <div class="relic-boon">${a.dropped.boon}</div>
            <div class="relic-desc">${a.dropped.flavor}</div>
          </div>` : ''}
        ${body}
      </div>
      ${upgradeGuide}`;
  }

  /* 여관 — 인양된 자리에서만 열린다. 빈 자리를 채우고 다시 내려간다. */
  function renderTavern(){
    const tv = S.tavern || {recruited:[], slot:null, plates:[], unlocked:null, seated:false};
    const next = CHAPTERS[S.chapter+1];
    const fallen = openSlots();
    const cands = recruitCandidates();

    /* ---- 젖은 명패 ----
       인양줄에 딸려 올라온 사람들. 하나만 데려간다.
       고르지 않은 명패는 아직 덜 말랐다 — 다음 인양 때 다시 걸려 있다. */
    const plates = (tv.plates||[]).map(id=>CLASS_DEFS[id]).filter(Boolean);
    if(plates.length && !tv.unlocked){
      contentEl.innerHTML = `
        <div class="screen tavern-screen">
          <div class="tier-tag">부두의 여관</div>
          <h2 style="margin:0;">잠긴 닻</h2>
          <div class="escape-note">젖은 외투에서 물이 떨어진다. 아무도 어디를 다녀왔는지 묻지 않는다.</div>
          <div class="plate-wall">
            <div class="plate-wall-head">안쪽 벽 · 돌아오지 않은 사람들의 놋쇠 명패</div>
            <div class="plate-wall-note">묻을 것이 없을 때 대신 거는 것이다. 그중 ${plates.length}개에서 아직 물이 떨어지고 있다.</div>
          </div>
          <div class="escape-note">"저 사람들은 당신 인양줄에 딸려 올라왔소.<br>하나만 데려가시오 — 나머지는 아직 젖어 있으니."</div>
          <div class="relic-offer">
            ${plates.map(d=>`
              <div class="relic-opt plate-opt" data-action="plate-take" data-cls="${d.id}">
                <div class="relic-opt-head">
                  <div class="portrait portrait-${d.id}" style="width:30px;height:30px;margin:0;">${CLASS_ICON[d.id]}</div>
                  <span>${d.name}</span> ${reachChip({reach:d.reach})}
                </div>
                <div class="relic-desc plate-story">${d.plate}</div>
                <div class="relic-boon">${d.tagline} · 최대 체력 ${d.maxHp}</div>
              </div>`).join('')}
          </div>
          <div class="escape-note">${fallen.length ? '빈 자리가 있다. 고른 사람이 곧바로 앉는다.' : '지금은 앉을 자리가 없다. 고른 사람은 여관에 남는다.'}</div>
        </div>`;
      return;
    }
    const roster = S.party.map((p,i)=>{
      const empty = !p || !p.alive;
      const fresh = tv.recruited.indexOf(i)>=0;
      const label = p ? p.name : '빈 자리';
      const sub   = !p ? '아무도 서지 않았다'
                  : !p.alive ? '자리가 비었다'
                  : `${rankName(i)} · HP ${p.hp}/${p.maxHp}`;
      return `
        <div class="tavern-seat ${empty?'empty':''} ${fresh?'fresh':''}">
          ${p ? `<div class="portrait portrait-${p.cls}" style="width:30px;height:30px;">${CLASS_ICON[p.cls]}</div>`
              : `<div class="portrait portrait-vacant" style="width:30px;height:30px;"></div>`}
          <div class="tavern-seat-body">
            <div class="tavern-seat-name">${label}${fresh?' <span class="tavern-new">새 얼굴</span>':''}</div>
            <div class="tavern-seat-sub">${sub}</div>
          </div>
          ${empty && cands.length ? `<button class="btn tavern-hire" data-action="tavern-slot" data-idx="${i}">영입</button>` : ''}
        </div>`;
    }).join('');

    let picker = '';
    if(tv.slot!==null && tv.slot!==undefined){
      picker = `
        <div class="tier-tag">누구를 앉힐까</div>
        <div class="relic-offer">
          ${cands.map(d=>`
            <div class="relic-opt" data-action="tavern-hire" data-cls="${d.id}">
              <div class="relic-opt-head">
                <div class="portrait portrait-${d.id}" style="width:26px;height:26px;margin:0;">${CLASS_ICON[d.id]}</div>
                <span>${d.name}</span> ${reachChip({reach:d.reach})}
              </div>
              <div class="relic-boon">${d.tagline} · 최대 체력 ${d.maxHp}</div>
              <div class="relic-desc">${d.blurb}</div>
            </div>`).join('')}
        </div>
        <button class="btn" data-action="tavern-cancel">그만둔다</button>`;
    }

    contentEl.innerHTML = `
      <div class="screen tavern-screen">
        <div class="tier-tag">부두의 여관</div>
        <h2 style="margin:0;">잠긴 닻</h2>
        <div class="escape-note">젖은 외투에서 물이 떨어진다. 아무도 어디를 다녀왔는지 묻지 않는다.</div>
        ${(function(){
          /* 예전 저장본은 여기에 병과 객체를 통째로 담았다 — 둘 다 받는다 */
          const uid = (tv.unlocked && tv.unlocked.id) ? tv.unlocked.id : tv.unlocked;
          const u = uid ? CLASS_DEFS[uid] : null;
          if(!u) return '';
          const left = unlockCandidates().length;
          return `
          <div class="tavern-unlock unlocked">
            <div class="unlock-banner">명패에서 물이 그쳤다</div>
            <div class="relic-opt-head">
              <div class="portrait portrait-${u.id}" style="width:34px;height:34px;margin:0;">${CLASS_ICON[u.id]}</div>
              <span>${u.name}</span> ${reachChip({reach:u.reach})}
            </div>
            <div class="relic-boon">${u.tagline} · 최대 체력 ${u.maxHp}</div>
            <div class="relic-desc">${u.blurb}</div>
            <div class="relic-desc plate-left">${tv.seated ? '당신 대열에 앉았다.' : '자리가 없어 여관에 남았다. 자리가 비면 부를 수 있다.'}${left ? ` 벽에는 아직 덜 마른 명패가 ${left}개 남았다.` : ''}</div>
          </div>`;
        })()}
        ${picker ? picker : `
          <div class="tavern-roster">${roster}</div>
          ${fallen.length && cands.length ? `<div class="escape-note">빈 자리가 ${fallen.length}개 있다. 채우고 내려갈 수 있다.</div>`
            : fallen.length ? `<div class="escape-note">빈 자리가 있지만, 지금 여관에 남은 사람이 없다.</div>`
            : `<div class="escape-note">전원이 살아 돌아왔다.</div>`}
          <div class="escape-note">이제부터는 ${PARTY_MAX}인까지 데려갈 수 있다.</div>
          <button class="btn" data-action="reform-party">대열을 다시 짠다</button>
          <div class="escape-note">${next ? `${next.title} — ${next.lead}` : ''}</div>
          <button class="btn primary" data-action="descend">${next ? `다시 내려간다 · ${next.length}구역` : '계속한다'}</button>
        `}
      </div>`;
  }

  /* 무엇을 버릴까 — 지닌 유물과 새로 들어온 하나를 나란히 놓고 하나를 고른다.
     새것을 고르면 그냥 두고 가는 것이다. */
  function renderRelicSwap(){
    const sw = S.relicSwap;
    if(!sw){ S.screen='map'; return renderMap(); }
    const card = (r, incoming) => {
      const canReplace = incoming || canReplaceRelic(r, sw.incoming);
      return `
      <div class="relic-opt ${incoming?'incoming':''} ${canReplace?'':'slot-locked'}" ${canReplace?'data-action="relic-drop" data-id="'+r.id+'"':''}>
        <div class="relic-opt-head">${relicPortrait(r)}<span>${r.name}</span>${relicTier(r)}
          ${incoming?'<span class="relic-new">새로 건진 것</span>':''}</div>
        <div class="relic-boon">${r.boon}</div>
        <div class="relic-desc">${r.flavor}</div>
        ${canReplace?'':'<div class="relic-slot-lock">슬롯을 유지하려면 이 유물은 버릴 수 없습니다.</div>'}
      </div>`;
    };
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">유물 슬롯 ${S.relics.length}/${relicCap()}점</div>
        <h3 style="margin:0;">무엇을 버릴까</h3>
        <p class="af-flavor">버릴 것을 고르면 나머지를 지니고 간다.
          새로 건진 것을 고르면 그대로 두고 온다.</p>
        <div class="relic-offer">
          ${S.relics.map(r=>card(r,false)).join('')}
          ${card(sw.incoming, true)}
        </div>
      </div>`;
  }

  function renderResult(){
    const upgradedCount = S.runDeck.filter(c=>c.upgraded).length;
    const finalGrowth = S.finalGrowth || [];
    contentEl.innerHTML = `
      <div class="screen result-screen">
        <img class="title-crest" src="${ART_CREST}" alt="">
        <div class="title-en">Recovered</div>
        <h2 style="margin:0;">심연의 꿈에서 돌아왔다</h2>
        ${finalGrowth.length ? `<div class="escape-growth">
          <div class="escape-growth-title">심연 생환 · 마지막 적응</div>
          ${finalGrowth.map(g=>`<div class="escape-growth-row"><span>${g.name} · 생환 ${g.descent}회</span><small>최대 체력 ×2 (${g.hpGain>0?'+':''}${g.hpGain}) · 회피/흘림 +${g.reactPct}%</small></div>`).join('')}
        </div>` : ''}
        ${S.relics.length ? `
        <div class="relic-tray">${S.relics.map(r=>relicChip(r)).join('')}</div>` : ''}
        <div class="result-list mono">
          최종 잠식도: ${Math.round(S.erosion)}%<br>
          회수한 관측물: ${S.relics.length}점<br>
          강화된 카드: ${upgradedCount}장<br>
          ${S.party.filter(p=>p).map(p=> `${p.name} — HP ${p.hp}/${p.maxHp} · 심도압박 ${Math.round(p.dp)}${p.collapsed?' (함몰 경험)':''}`).join('<br>')}
        </div>
        <div class="result-list">인양은 성공했다. 다만 우리는 아무것도 건져 올리지 못했다.<br><b>무언가가 우리를 건져 올렸을 뿐이다.</b></div>
        <button class="btn primary" data-action="restart">다시 하강한다</button>
      </div>`;
  }

  function renderEmergencyExit(){
    const ex = S.emergencyExit;
    if(!ex){ S.screen='title'; return renderTitle(); }
    const needsRelic = S.relics.length>1 && !ex.keptRelic;
    const names = list => list.length ? list.map(p=>p.name).join(' · ') : '없음';
    contentEl.innerHTML = `
      <div class="screen result-screen">
        <div class="title-en">Emergency Extract</div>
        <h2 style="margin:0;">인양줄을 붙잡았다</h2>
        <div class="result-list">${ex.tier}에서 비상 탈출에 성공했다. (성공 확률 ${Math.round(ex.chance*100)}%)<br>
          교전에서만 빠져나왔을 뿐, 하강은 끝나지 않았다.<br><br>
          <b>귀환:</b> ${names(ex.evacuees)}<br>
          <b>남겨짐:</b> ${names(ex.leftBehind)}${ex.leftBehind.length ? '<br><small>심도압박 50 이상이거나 이미 쓰러진 대원은 데려갈 수 없었다. 두고 온 자리는 여관에서만 다시 채울 수 있다.</small>' : ''}
        </div>
        ${needsRelic ? `
          <div class="tier-tag">유물은 하나만 건져 올릴 수 있다</div>
          <div class="relic-offer">${S.relics.map(r=>`
            <div class="relic-opt" data-action="emergency-keep-relic" data-id="${r.id}">
              <div class="relic-opt-head">${relicPortrait(r)}<span>${r.name}</span>${relicTier(r)}</div>
              <div class="relic-boon">${r.boon}</div>
              <div class="relic-desc">${r.flavor}</div>
            </div>`).join('')}</div>` : ex.keptRelic ? `
          <div class="relic-card">
            <div class="relic-glyph">${relicPortrait(ex.keptRelic,true)}</div>
            <div class="relic-name">${ex.keptRelic.name}</div>
            ${relicTier(ex.keptRelic)}
            <div class="relic-boon">${ex.keptRelic.boon}</div>
          </div>` : `<div class="escape-note">건져 올린 유물 없이, 빈손으로 돌아왔다.</div>`}
        ${needsRelic ? '' : `<button class="btn primary" data-action="emergency-continue">탐색을 이어간다</button>`}
      </div>`;
  }

  function renderGameOver(){
    contentEl.innerHTML = `
      <div class="screen result-screen lose">
        <div class="title-en">Lost To The Depths</div>
        <h2 style="margin:0;">심연이 당신을 기억했다</h2>
        <div class="result-list">${S.loseReason}<br><br>눈을 감아도 파도는 사라지지 않는다.</div>
        <button class="btn danger" data-action="restart">다시 시도한다</button>
      </div>`;
  }

  /* 같은 화면을 다시 그릴 때 스크롤 위치를 지켜준다.
     innerHTML 을 통째로 갈아끼우므로 그냥 두면 매번 맨 위로 튕기는데,
     덱 구성처럼 목록이 긴 화면에서는 아래쪽 카드를 고를 수가 없게 된다. */
  function screenKey(){
    return S.screen + (S.screen==='classSelect' ? ':'+S.setup.phase : '');
  }
  let lastScreenKey = null;
  function render(){
    const key = screenKey();
    const prev = contentEl.querySelector('.screen');
    const keepTop = (key===lastScreenKey && prev) ? prev.scrollTop : null;

    renderScreen();

    if(keepTop != null){
      const next = contentEl.querySelector('.screen');
      if(next) next.scrollTop = keepTop;
    }
    lastScreenKey = key;
    bgmSetTrack(bgmDesiredTrack());   /* 전투에 들고 나는 순간 음악도 함께 넘어간다 */
    saveRun();
  }

  function renderScreen(){
    ensureAtmo(tierSlug(currentTier()));
    if(S.screen==='title') renderTitle();
    else if(S.screen==='prologue') renderPrologue();
    else if(S.screen==='prologueFall') renderPrologueFall();
    else if(S.screen==='classSelect') renderClassSelect();
    else if(S.screen==='map') renderMap();
    else if(S.screen==='battle') renderBattle();
    else if(S.screen==='rest') renderRest();
    else if(S.screen==='aftermath') renderAftermath();
    else if(S.screen==='escape') renderEscape();
    else if(S.screen==='relicSwap') renderRelicSwap();
    else if(S.screen==='tavern') renderTavern();
    else if(S.screen==='result') renderResult();
    else if(S.screen==='emergencyExit') renderEmergencyExit();
    else if(S.screen==='gameover') renderGameOver();
    flushFx();   /* 카드가 새로 배치된 뒤라야 좌표를 잡을 수 있다 */
  }

