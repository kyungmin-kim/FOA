  /* ============ RENDER ============ */
  const app = document.getElementById('app');
  /* #content 만 render() 가 통째로 갈아 끼운다. 나머지 층은 살아남는다 —
     대화(#say)와 장면 막(#curtain)이 여기 사는 이유다. 밑에서 전투 화면이 몇 번을
     다시 그려져도 타이핑과 페이드가 끊기지 않는다. */
  /* #hud 는 #say(대화 상자)보다도 위다 — 장면 막·어둠·대화 어느 것에도 가려지면 안 되는
     상시 조작(지금은 프롤로그 건너뛰기 버튼뿐)이 사는 자리다. #content 의 자식으로 두면
     #content(z1)가 세운 쌓임 맥락에 갇혀 아무리 z-index를 올려도 #scenedim(z41) 위로
     못 올라간다 — 그래서 형제 층으로 따로 뺐다. */
  app.innerHTML = '<div id="atmo" aria-hidden="true"></div><div id="content"></div>'
                + '<div id="grain" aria-hidden="true"></div><div id="fx" aria-hidden="true"></div>'
                + '<div id="flash" aria-hidden="true"></div>'
                + '<div id="curtain" aria-hidden="true"></div>'
                + '<div id="scenedim" aria-hidden="true"></div><div id="scenefx" aria-hidden="true"></div>'
                + '<div id="say"></div>'
                + '<div id="hud" aria-hidden="true"></div>';
  const atmoEl = document.getElementById('atmo');
  const contentEl = document.getElementById('content');
  const fxEl = document.getElementById('fx');
  const flashEl = document.getElementById('flash');
  const hudEl = document.getElementById('hud');
  /* render() 가 #content 를 갈아 끼울 때마다 같이 부른다 — #hud 는 그 바깥에 살아서
     render() 의 innerHTML 교체 대상이 아니므로 따로 손대야 한다.
     지금은 채우는 화면이 없다 — 건너뛰기 버튼은 오프닝 화면(renderOpening) 안으로
     옮겨 갔다. 대화·어둠 위에서도 눌려야 하는 상시 조작이 다시 생기면 여기에 그린다. */
  function renderHud(){
    hudEl.innerHTML = '';
  }

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
    ambient: {src:'assets/bgm-ambient.mp3', gain:1,   seconds:213.75},
    battle:  {src:'assets/bgm-battle.mp3',  gain:0.5, seconds:227.462},
    fail:   {src:'assets/bgm-fail.mp3',    gain:0.8, seconds:242.502},
    lighthouse: {src:'assets/bgm-lighthouse.mp3', gain:0.9, seconds:194.504},
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
  let bgmFadeSeq = 0;      /* 빠르게 화면을 넘길 때 이전 페이드가 새 전환을 덮지 않게 한다 */

  function bgmDesiredTrack(){
    if(S && S.screen === 'title') return 'ambient';
    if(S && S.screen === 'battle') return 'battle';
    if(S && S.screen === 'gameover') return 'fail';
    if(S && ['tavern','maintenance','institute','residence','relicSwap','epicAbsorb','epicAbsorbResult'].indexOf(S.screen)>=0) return 'lighthouse';
    return 'ambient';
  }
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
      /* 첫 화면에서 첫 입력과 동시에 재생할 수 있도록 음원을 미리 준비한다. */
      el.preload = 'auto';
      el.playsInline = true;
      el.setAttribute('playsinline','');
      el.volume = 0;
      document.body.appendChild(el);
      bgmEls[key] = el;
    }
    return bgmEls[key];
  }
  function bgmPlayFallback(key){
    const token = ++bgmFadeSeq;
    const old = Object.keys(bgmEls)
      .filter(k=>k !== key && !bgmEls[k].paused)
      .map(k=>({el:bgmEls[k], volume:bgmEls[k].volume}));
    const el = bgmEl(key);
    const targetVolume = BGM_VOLUME * bgmTrackGain(key);
    el.volume = 0;
    /* play()의 Promise가 끝날 때까지 기다리면 제스처 허가가 사라질 수 있다. */
    bgmMode = 'element';
    const p = el.play();
    if(p && p.catch) p.catch(()=>{});
    const started = performance.now();
    const fade = now=>{
      if(token !== bgmFadeSeq) return;
      const ratio = BGM_FADE > 0 ? Math.min(1, (now-started)/(BGM_FADE*1000)) : 1;
      old.forEach(item=>{ item.el.volume = item.volume * (1-ratio); });
      el.volume = targetVolume * ratio;
      if(ratio < 1){ requestAnimationFrame(fade); return; }
      old.forEach(item=>{ item.el.pause(); item.el.volume = 0; });
      el.volume = targetVolume;
    };
    requestAnimationFrame(fade);
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
  function bgmEnsureTitleAmbient(){
    if(!bgmOn || !S || S.screen!=='title') return;
    if(bgmTrack!=='ambient') bgmTrack='ambient';
    if(!bgmPrimed) return;
    if(bgmMode==='element'){
      if(!bgmEls.ambient || bgmEls.ambient.paused) bgmPlayFallback('ambient');
    } else if(!bgmMode){
      bgmPlay('ambient');
    }
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
    /* 첫 입력에서는 디코딩을 기다리지 않고 브라우저의 기본 오디오 요소를
       바로 재생한다. Web Audio의 비동기 디코딩은 브라우저별 자동재생 정책에
       따라 소리가 나지 않는 경우가 있어, 안정적인 요소 재생을 기본 경로로 둔다. */
    if(!bgmTrack) bgmTrack = bgmDesiredTrack();
    /* 버튼을 누를 때마다 같은 곡을 다시 페이드하지 않는다. */
    if(!bgmEls[bgmTrack] || bgmEls[bgmTrack].paused) bgmPlayFallback(bgmTrack);
    bgmPrimed = true;
    return;

    /* file:// 로 실행하면 fetch 로 음원을 읽을 수 없을 수 있다. 이 경우 Web Audio를
       먼저 만들었다가 비동기 실패를 기다리면 첫 입력의 자동재생 허가를 놓친다 —
       같은 제스처 안에서 <audio> 요소를 바로 재생한다. */
    if(window.location && window.location.protocol === 'file:'){
      bgmPrimed = true;
      if(!bgmTrack) bgmTrack = bgmDesiredTrack();
      bgmPlayFallback(bgmTrack);
      return;
    }
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
    else if(bgmMode === 'element' && bgmEls[bgmTrack] && bgmEls[bgmTrack].paused) bgmPlayFallback(bgmTrack);
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
  function resetBgmSetting(){
    bgmOn = true;
    Store.remove(BGM_KEY);
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
    heroHit:'#c4383c', foeHit:'#d4526b',
    dodge:'#8fd4c4', guard:'#9fc0d8', riposte:'#e0574f',
    /* 되받아친 값은 내가 낸 것이라 붉은 피해와 갈라 둔다 — 우리 쪽 반격만 푸르게 */
    riposteHero:'#6fb4ff',
    /* 치명타 — 표시는 어느 쪽이든 같은 경보색이고, 튀는 것만 각자의 피를 따른다 */
    crit:'#ff5a3c', bloodHero:'#b42a2e', bloodFoe:'#a8384f',
    /* 회복은 초록 — 십자와 티끌이 한 가지 빛으로 읽혀야 무엇이 일어났는지 한눈에 갈린다.
       진정(계열)은 그대로 물빛이라 회복과 헷갈리지 않는다. */
    heal:'#6fdc8c', calm:'#7fbfae', death:'#cfe4dd',
    /* 수치는 파편보다 밝아야 초상 위에서 읽힌다.
       내가 맞으면 핏빛, 내가 때리면 뼛빛 — 색만으로 누구의 피해인지 갈린다. */
    dmgHero:'#ff7a70', dmgFoe:'#f7ecd6',
  };
  function clearFxLayer(){ while(fxEl.firstChild) fxEl.removeChild(fxEl.firstChild); }
  function lighthouseFeedFx(){
    const gauge=document.querySelector('.lighthouse-case');
    if(!gauge || !fxEl) return;
    gauge.classList.remove('lighthouse-feed-glow');
    void gauge.offsetWidth;
    gauge.classList.add('lighthouse-feed-glow');
    const fr=fxEl.getBoundingClientRect(), gr=gauge.getBoundingClientRect();
    for(let i=0;i<18;i++){
      const p=document.createElement('i');
      p.className='lighthouse-particle';
      p.style.left=`${gr.left-fr.left+Math.random()*gr.width}px`;
      p.style.top=`${gr.top-fr.top+gr.height/2+(Math.random()-0.5)*8}px`;
      p.style.setProperty('--dx',`${(Math.random()-0.5)*34}px`);
      p.style.setProperty('--dy',`${-12-Math.random()*28}px`);
      p.style.setProperty('--d',`${520+Math.random()*420}ms`);
      fxEl.appendChild(p);
      setTimeout(()=>p.remove(),1100);
    }
    setTimeout(()=>gauge.classList.remove('lighthouse-feed-glow'),850);
  }
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
      /* 아군이 적을 때렸을 때만 발톱이 긁고 지나간 자국을 카드 위에 남긴다 */
      if(!mine) el.classList.add('scratch-hit');

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
  /* 카드가 누구의 기술인가는 사람이 아니라 병과로 적는다 — 카드는 특정 개인의 것이기 전에
     심연기사의 것이고, 그 사람이 죽고 다른 심연기사가 와도 같은 카드를 쓴다. */
  /* 전투 초상에 세우는 이름. 본편에서는 병과다 — 그 자리는 '무엇을 하는 사람인가' 를 묻는다.
     다만 프롤로그의 넷은 사람 이름으로 불려야 한다. 첫 교대의 기록을 보여 주는 장면이기 때문이다. */
  function heroCardLabel(hero){
    if(S && S.prologue) return hero.name;
    const def = CLASS_DEFS[hero.cls];
    return def ? def.className : hero.name;
  }
  function ownerLabel(o){
    if(o==='neutral') return '중립';
    const def = CLASS_DEFS[o];
    return def ? def.className : o;
  }

  /* 게임 가이드 — 초기 전투 안내에서 짚어 주던 규칙을 언제든 다시 펴 볼 수 있게 모았다.
     수치는 실제 상수에서 읽어 온다. 규칙을 고치면 안내문도 따라 바뀌어야 하기 때문이다.
     항목 추가는 이 배열에 {t, lines} 를 하나 더 얹으면 된다. */
  function guideSections(){
    const eroRates = CHAPTERS.map(c=>`${chapterDisplayName(c.tier)} ${c.erosion}%`).join(' · ');
    /* 층에서 확정된 사실은 대사로 흘리고 끝내지 않는다 — 여기 쌓여 언제든 다시 읽힌다.
       아직 아무것도 못 건졌으면 빈 절을 만들지 않는다. */
    const records = learnedRecords().map(r=>({t:`등대 기록 · ${r.title}`, lines:r.lines.slice()}));
    /* 히든 갈림길 코드를 맞혀야 열리는 등대 일지 파편 — 89-secret-paths.js 참조 */
    const journals = learnedJournalEntries().map(j=>({t:j.title, lines:j.lines.slice()}));
    return records.concat(journals).concat([
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
        '<b>100</b>에 닿으면 정신이 무너집니다. <b>5턴</b> 동안 카드로 제어할 수 없고, 매턴 아군·적을 가리지 않고 공격하며, 압박은 매턴 <b>-10</b>씩 저절로 빠집니다.',
        `진정 계열 카드와 은신처 휴식(압박 -${REST_CALM})으로만 내릴 수 있습니다.`,
        `<b>멀쩡한 적</b>을 한 방에 쓰러뜨리면 그 대원이 체력 <b>+${KILL_HEAL}</b> · 압박 <b>-${KILL_CALM}</b>. 이미 깎여 있던 적의 숨통을 끊는 것은 해당하지 않습니다.`,
      ]},
      {t:'잠식', lines:[
        `0에서 시작해 <b>${EROSION_MAX}%</b>에 닿으면 탐색이 그 자리에서 끝납니다. 되돌리는 수단은 없습니다.`,
        `전투의 턴이 끝날 때마다 구역별로 오릅니다 — ${eroRates}.`,
        `은신처에서 숨을 고르면 체력과 압박을 얻는 대신 잠식이 <b>${EROSION_REST}%</b> 오릅니다.`,
      ]},
      {t:'미상 카드 · 오염', lines:[
        '빛이 약한 지역에서는 일반·직업·에픽·전설을 가리지 않고 손패의 카드가 미상 카드로 오염될 수 있습니다.',
        '오염 카드는 손에 들어올 때 팝업을 띄우지 않습니다. 카드를 사용할 때 원래 이름·비용·효과와 오염 리스크가 팝업으로 표시됩니다.',
        '오염은 한 턴의 교란이며, 턴이 끝나면 손패에서 사라지는 일반 카드의 규칙은 그대로 적용됩니다.',
      ]},
      {t:'대열 · 사거리', lines:[
        '서 있는 열이 곧 화력입니다. 병과마다 휘두를 수 있는 자기 열과 닿는 상대 열이 정해져 있습니다.',
        `<b>${REACH.melee.label}</b> — ${REACH.melee.note}`,
        `<b>${REACH.mid.label}</b> — ${REACH.mid.note}`,
        `<b>${REACH.ranged.label}</b> — ${REACH.ranged.note}`,
        '빈 칸은 열로 세지 않으며, 앞이 쓰러지면 뒤가 당겨집니다.',
      ]},
      {t:'노드 · 하강과 귀환', lines:[
        '지도에서는 전투·엘리트·은신처·회수 노드 중 하나를 고릅니다. 노드 종류에 따라 위험과 보상이 달라집니다.',
        '은신처에서 귀환하면 현재까지 얻은 카드·유물·고래기름을 지킬 수 있지만, 더 깊은 보상은 포기하게 됩니다.',
        '전투에서 얻은 고래기름은 등대 기지로 살아 돌아와야 연료고에 들어갑니다.',
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
        `<b>+${MERGE_UPGRADE_START_LEVEL} → +${MERGE_UPGRADE_START_LEVEL+1}</b>부터는 같은 카드·같은 단계 <b>2장</b>을 합쳐야 하며, <b>+${MAX_UPGRADE_LEVEL}</b>가 끝입니다.`,
      ]},
      {t:'유물 · 해금', lines:[
        `유물은 <b>${RELIC_CAP}칸</b>까지 지니며, 한 번 챙기면 그 탐색이 끝날 때까지 벗겨지지 않습니다.`,
        '등대 기지에서 얻은 동료 해금은 탐색이 끝나도 남습니다. 다만 제목 화면의 <b>하강</b>은 처음부터 다시 시작하며 해금까지 지웁니다.',
      ]},
    ]);
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
    /* 덱이 가득 차면 열린다 — 21장이 되어야 '한 벌' 이 되고, 그때부터 볼 값이 생긴다.
       지금은 보여 주기만 한다. show 를 가진 항목은 조건이 맞을 때만 목록에 선다. */
    {id:'deck', label:'카드덱', view:'deck', title:'카드덱', show:deckMenuUnlocked},
    {id:'new-game', label:'새 게임', view:'confirm', title:'새 게임', confirmLabel:'삭제 후 시작',
      desc:'새 게임을 시작하면 진행 중인 모든 상황이 삭제됩니다.<br>현재 런, 대원, 카드, 해금, 등대 밝기, 가이드 기록과 브라우저 캐시가 모두 초기화됩니다.<br>삭제한 진행상황은 복구할 수 없습니다. 계속하시겠습니까?',
      run(){ resetAndStartNewGame(); }},
    {id:'quit', label:'게임 종료', view:'confirm', title:'게임 종료', confirmLabel:'게임 종료',
      desc:'제목 화면으로 나갑니다. 지도·휴식 등 안전한 지점까지는 이미 저장되어 있습니다.',
      run(){ S.screen = 'title'; }},
  ];
  let menuOpen = false;
  let menuStep = null; /* null 이면 목록, 아니면 MENU_ITEMS 의 id */
  let guideOpen = 0;   /* 가이드에서 펼쳐 둔 장의 번호 */
  function guideText(text){ return String(text).replace(/\n/g, '<br>'); }

  function renderMenuOverlay(){
    if(!menuOpen) return '';
    const item = MENU_ITEMS.find(m=>m.id===menuStep) || null;
    let body;
    if(!item){
      /* 이름이 상태에 따라 달라지는 항목(음소거 등)은 함수로 받는다 */
      body = `<div class="menu-list">${MENU_ITEMS.filter(m=>!m.show || m.show()).map(m=>{
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
              ${guideOpen===i ? `<ul class="guide-sec-body">${sec.lines.map(l=>`<li>${guideText(l)}</li>`).join('')}</ul>` : ''}
            </div>`).join('')}
        </div>
        <button class="btn menu-guide-back" data-action="menu-back">뒤로</button>`;
    } else if(item.view==='deck'){
      /* 지금은 보여 주기만 한다 — 고르거나 버리는 손잡이는 달지 않았다.
         같은 카드·같은 단계를 한 줄로 묶어, 합칠 짝이 있는지가 한눈에 보이게 한다. */
      const groups = groupDeckCards(S.runDeck || []).sort((a,b)=>
        b.level - a.level || String(a.owner).localeCompare(String(b.owner)) || a.name.localeCompare(b.name));
      const epics = (S.runDeck||[]).filter(c=>isEpicCard(c) || isLegendaryCard(c)).length;
      body = `
        <div class="menu-deck">
          <div class="deck-sum">${(S.runDeck||[]).length}/${MAX_DECK_SIZE}장 · 에픽 이상 ${epics}장 · ${groups.length}종</div>
          <div class="deck-list">
            ${groups.map(g=>`
              <div class="deck-row ${cardVisualClass(g.card)}">
                <div class="deck-row-head">
                  <span class="deck-row-name">${g.name}</span>
                  <span class="deck-row-meta">AP ${g.card.cost} · ${cardRarityLabel(g.card)}${g.count>1?` · ${g.count}장`:''}</span>
                </div>
                <div class="deck-row-effect">${describeCard(g.card)}</div>
                <div class="deck-row-foot">${ownerLabel(g.owner)}${
                  upgradeNeedsMerge(g) ? ` · 합칠 짝 ${g.count}/2` : ''}</div>
              </div>`).join('')}
          </div>
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
          <div class="menu-panel ${item&&(item.view==='guide'||item.view==='deck')?'wide':''}" data-action="menu-noop">
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
    const light = lighthouseBrightness();
    const lighthouseAtBase = ['title','classSelect','tavern','maintenance','residence','escape','result','worldMap','forayResult','pactSetup'].indexOf(S.screen)>=0;
    /* 프롤로그 1~2단계에서는 잠식 표시 자체를 감춘다. 각본(87-prologue.js, PRO_ABYSS)은
       "잠식이 화면에 처음 뜬다" 고 3단계를 연출하는데, 상단바가 처음부터 그려 두면
       그 대사가 거짓말이 된다 — 아무 설명 없는 숫자만 두 단계 내내 떠 있던 셈이니까. */
    const erosionHidden = S.screen==='battle' && S.prologue && S.prologue.phase==='battle' && !S.prologue.erosionShown;
    /* 프롤로그 건너뛰기 버튼은 여기 안 그린다 — #content 안에 두면 대화가 뜰 때마다
       #scenedim 어둠에 함께 눌린다. #hud 층(renderHud, 위쪽)에서 따로 그린다. */
    return `
      <div class="topbar">
        <div class="ero-row">
          <button class="menu-btn" data-action="open-menu" aria-label="메뉴" aria-haspopup="dialog"><span class="menu-ico"></span></button>
          ${erosionHidden ? '' : lighthouseAtBase ? `
          <div class="ero-label lighthouse-meter-label">등대 밝기</div>
          <div class="ero-case lighthouse-case">
            <div class="lighthouse-fill" style="width:${light}%"></div>
            <div class="ero-num mono">${Math.round(light)}%</div>
          </div>` : `
          <div class="ero-label">잠식</div>
          <div class="ero-case ${danger}">
            <div class="ero-fill" style="width:${pct}%"></div>
            <div class="ero-num mono ${danger}">${Math.round(S.erosion)}%</div>
          </div>`}
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
        <div class="title-art title-layer" style="background-image:url('${ART_KEY}')"></div>
        <div class="title-flicker title-layer" aria-hidden="true"></div>
        <div class="title-bubbles title-layer" aria-hidden="true">${bubbles(14)}</div>
        <div class="title-vignette title-layer" aria-hidden="true"></div>
        <img class="title-wordmark" src="${ART_WORDMARK}" alt="FATHOM OF ABYSS">
        ${hasSavedRun() ? `
          <button class="btn primary" data-action="continue-run">이어하기</button>
          <button class="btn" data-action="new-run">새게임</button>
        ` : `
          <button class="btn primary" data-action="new-run">${hasPlayedBefore() ? '새게임' : '시작하기'}</button>
        `}
        ${worldMapUnlocked() ? '<button class="btn" data-action="world-map">자유 탐사</button>' : ''}
        <button class="btn fullscreen-btn" data-action="toggle-fullscreen">전체화면</button>
        <div class="title-version">v0.4.0</div>
      </div>
      ${renderMenuOverlay()}`;
  }

  /* ── 첫 출정 오프닝 ──
     첫 런 전에만 한 번 도는 짧은 등대 기록. 세 명의 탐사대가 왜 어둠으로 내려가는지와
     고래기름을 가져와야 하는 이유만 남기고, 설명이 끝나면 바로 첫 전투로 넘긴다.

     크롤 상자와 애니메이션은 예전 '회수된 기록' 화면의 것을 그대로 쓴다. 각본에서 빠진 뒤
     쓰이지 않고 남아 있던 시스템이라, 지우지 않고 이 자리에 돌려 썼다.

     크롤은 한 바퀴만 돌고 끝난다(무한 반복 아님) — 다 돌면 animationend 에서 바로
     beginFirstRunBattle 로 넘어간다. 다 읽지 않고 바로 넘어가고 싶을 때를 위해 건너뛰기
     버튼도 함께 둔다. */
  function renderOpening(){
    contentEl.innerHTML = `
      <div class="screen prologue-screen">
        <div class="prologue-scroll-box" aria-label="오프닝">
          <div class="prologue-crawl">
            <p>빛이 닿는 곳만이 현실이다.<br>마지막 등대의 불빛이 닿는 동안에만 인간의 세계는 바다에 잠기지 않는다.</p>
            <p>매일 밤, 한 명의 등대지기와 그가 모은 탐사대가 잠식된 바다로 내려간다.<br>오늘 밤 그 탐사대는 세 명이다.</p>
            <p>빛을 연료로 바꿀 수 있는 고래기름과 잔해를 회수해 돌아오면,<br>등대는 하루 더 현실을 지킨다.</p>
            <p>탐사대가 죽어도 등대는 남는다.<br>다음 원정대가 같은 일을 이어받는다.</p>
            <p class="em">잠수종을 내려라.<br>고래기름을 찾아, 불이 꺼지기 전에 돌아와라.</p>
          </div>
        </div>
        <button class="btn" data-action="skip-opening">오프닝 건너뛰기</button>
      </div>`;
    const crawlEl = contentEl.querySelector('.prologue-crawl');
    if(crawlEl) crawlEl.addEventListener('animationend', function(){
      if(S.screen==='opening'){ beginFirstRunBattle(); render(); }
    }, {once:true});
  }

  /* 전멸 — 색과 UI를 걷고 초상화만 남긴다. 각본이 하나씩 꺼 나간다. */
  function renderPrologueFall(){
    const gone = (S.prologue && S.prologue.gone) || [];
    /* 첫 교대에서 돌아오지 못한 사람들의 흔적은 초상과 배치 변화로만 남긴다. */
    const crippled = (S.prologue && S.prologue.crippled) || null;
    contentEl.innerHTML = `
      <div class="screen prologue-screen prologue-fall-screen">
        <div class="prologue-fallen">${S.party.filter(p=>p).map(p=>`
          <div class="pro-portrait ${gone.indexOf(p.cls)>=0 ? 'gone' : ''} ${p.cls===crippled ? 'crippled' : ''}">
            <div class="portrait portrait-${p.cls}">${CLASS_ICON[p.cls]}</div>
            <div class="pro-portrait-name">${p.name}</div>
          </div>`).join('')}</div>
      </div>`;
  }

  /* 기록 공개와 등대 기지. 글줄만 한 줄씩 떠오른다 — 각본이 밀어 넣는다. */
  function renderPrologueRecord(){
    const pro = S.prologue || {};
    const lines = pro.record || [];
    const tavern = pro.phase === 'tavern';
    contentEl.innerHTML = `
      <div class="screen prologue-screen prologue-record-screen ${tavern?'is-tavern':''}">
        ${tavern ? `<div class="pro-desk">
          <div class="pro-desk-record">마지막 근무 기록</div>
          <div class="pro-desk-sheet">등대 교대표<br><span>—</span><br><span>—</span><br><span>—</span></div>
        </div>` : ''}
        <div class="pro-record ${pro.recordFading?'fading':''}">${lines.map((t,i)=>`<div class="pro-record-line" style="--i:${i}">${t}</div>`).join('')}</div>
        ${pro.salvage ? `<div class="pro-salvage">
          ${relicPortrait(pro.salvage, true)}
          <div class="pro-salvage-name">${pro.salvage.name}</div>
          <div class="pro-salvage-boon">${pro.salvage.boon}</div>
          <div class="pro-salvage-note">새 등대지기가 이것을 지니고 내려간다</div>
        </div>` : ''}
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
            <span class="deck-sect-name">${classFullName(def)}</span>
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

  /* 넷째 자리는 '추가 병과를 만난 뒤' 에만 열린다. 만나기 전에는 채울 사람이 없는
     빈 칸을 보여 줄 이유가 없다 — 대열을 다시 짜는 중이라는 것만으로는 열지 않는다.
     이미 넷이 서 있는 판(예전 저장)에서는 그 인원을 그대로 셈에 넣는다. */
  function partyLimit(){
    const standing = (S && S.party) ? S.party.filter(Boolean).length : 0;
    /* 자유 탐사는 본편을 완주한 뒤에만 열리므로, 추가 병과를 실제로 만났는지와
       상관없이 항상 4인 편성을 쓸 수 있다. 넷째 자리를 서사적으로 여는 본편
       진행(UNLOCKED)은 자유 탐사 밖에서만 여전히 의미가 있다. */
    if(S && S.free) return Math.max(PARTY_MAX, standing);
    return Math.max(UNLOCKED.length ? PARTY_MAX : PARTY_START, standing);
  }

  function renderClassSelect(){
    const st = S.setup;
    const LIM = partyLimit();
    let body = '';
    if(st.phase==='pick-classes'){
      body = `
        <div class="tier-tag">${st.reform?'대열을 다시 짠다':'전문가를 선택하세요'} (${st.selected.length}/${LIM})</div>
        <div class="class-grid">
          ${Object.values(CLASS_DEFS).filter(def=>isUnlocked(def.id)).map(def=>{
            const sel = st.selected.includes(def.id);
            return `
            <div class="class-card ${sel?'sel':''}" data-action="toggle-class" data-id="${def.id}">
              <div class="portrait portrait-${def.id}" style="margin:0 auto 6px;">${CLASS_ICON[def.id]}</div>
              <div class="class-name">${def.className} ${reachChip({reach:def.reach})}</div>
              <div class="class-tagline">${def.tagline}</div>
              <div class="class-blurb">${def.blurb}</div>
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
                   <div class="rank-slot-name">${def.className}</div>
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
            return `<div class="tray-chip ${st.armed===cid?'armed':''}" data-action="arm-hero" data-id="${cid}">${def.className}</div>`;
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

  /* 지나온 발자국과 앞으로 보이는 칸이 같은 아이콘 어휘를 쓴다 — 종류가 같으면 같은 그림이어야
     "저건 아까 그 표식이다" 가 한눈에 읽힌다. */
  function nodeTypeIcon(n){
    return n.type==='battle'?IC_CRUMB_BATTLE:n.type==='elite'?IC_CRUMB_ELITE:n.type==='rest'?IC_CRUMB_REST:IC_CRUMB_LOOT;
  }
  /* 랜덤워크 — 각 행의 가로 위치는 앞 행에서 이어받아 조금씩 흘러간다(누적). 행마다
     따로 흔들리면 위아래가 이어지는 느낌이 없어, 진행 순서(시작→보스)를 따라
     -1/0/+1 스텝을 쌓는다. id(순번 문자열)를 해시해 스텝을 정하므로 저장 상태를
     늘리지 않고도 같은 칸은 다시 그려도 항상 같은 자리에 선다. MAX_LANE 으로 클램프해
     20칸짜리 긴 챕터에서도 화면 밖으로 흘러가지 않게 막는다. */
  const MAP_LANE_MAX = 3;
  const MAP_LANE_PX = 50;
  function laneStep(id){
    const n = parseInt(String(id).replace(/\D/g,''), 10) || 0;
    return ((n * 2654435761) >>> 0) % 3 - 1;   /* -1 | 0 | 1 */
  }
  /* rows 는 시작→보스 순(챕터가 실제로 진행되는 방향)이어야 누적이 의미가 있다 —
     화면 표시용 반전은 이 결과를 호출한 뒤에 한다. */
  function laneWalk(rows){
    let lane = 0;
    return rows.map((r,i)=>{
      if(i>0) lane = Math.max(-MAP_LANE_MAX, Math.min(MAP_LANE_MAX, lane + laneStep(r.nodes[0].id)));
      return lane;
    });
  }
  /* 미니맵 좌표계 — 칸을 flex 로 줄 세우면 줄마다 폭이 달라(1~3개) 연결선이 실제 칩 중심에
     닿지 않고 어긋난다. 그래서 절대좌표로 직접 배치한다: 세로는 행 간격(MAP_ROW_STEP)의
     배수, 가로는 캔버스 절반 폭(MAP_CANVAS_HALF)을 원점으로 삼은 오프셋(px)이다.
     "50%" 대신 고정 원점을 쓰는 이유 — 레인이 화면 왼쪽으로 흘러가면 좌표가 음수가
     되는데, 퍼센트 기준이면 화면 폭에 따라 음의 스크롤 영역이 생겨 브라우저가 그
     방향으로 스크롤을 못 한다. 원점을 캔버스 왼쪽으로 고정하면 전부 양수 좌표가 되어
     가로 스크롤이 양쪽 다 자연스럽게 된다. */
  const MAP_ROW_STEP = 80;
  const MAP_CHIP = 48, MAP_BOSS_H = 70;
  const MAP_LINE_THICK = 2;
  const MAP_CANVAS_HALF = (MAP_LANE_MAX+1)*MAP_LANE_PX + MAP_CHIP/2 + 8;
  function cx(x){ return MAP_CANVAS_HALF + x; }
  /* 두 칩을 대각선이 아니라 직각으로만 잇는다 — 세로(a.y→중간높이) → 가로(a.x→b.x) →
     세로(중간높이→b.y)의 3단 꺾은선. 같은 세로줄에 있으면(x가 같으면) 그냥 한 줄로 잇는다. */
  function orthoLink(a, b){
    const t = MAP_LINE_THICK;
    const bar = (x, top, w, h) => `<div class="map-link" style="left:${cx(x)}px; top:${top}px; width:${w}px; height:${h}px;"></div>`;
    if(Math.abs(a.x - b.x) < 0.5){
      return bar(a.x - t/2, Math.min(a.y, b.y), t, Math.abs(b.y - a.y));
    }
    const midY = (a.y + b.y) / 2;
    return bar(a.x - t/2, Math.min(a.y, midY), t, Math.abs(midY - a.y))
         + bar(Math.min(a.x, b.x), midY - t/2, Math.abs(b.x - a.x), t)
         + bar(b.x - t/2, Math.min(midY, b.y), t, Math.abs(b.y - midY));
  }
  function renderMap(){
    const ch = chapter();
    const visited = S.mapVisited.slice(S.mapVisited.length - S.stepInChapter).map(n=>({nodes:[n], done:true, revealed:true}));
    const future = wholeMapWindow();   /* [지금 갈림길, ...수문장 칸] — 게이트 계산용으로 전부 굴려 두었을 뿐, 그리는 건 future[0]뿐이다 */
    const bossNext = future[0] && future[0].length===1 && future[0][0].boss;
    const branchGuide = S.mapBranch
      ? `분기 경로 ${S.mapBranch.progress}/${S.mapBranch.routeLength} · 합류 지점까지`
      : S.mapBranchPlan ? '세 갈래 길 · 하나를 선택하세요' : null;
    /* 지금 갈림길(future[0]) 너머는 아예 행으로 만들지도 않는다 — 자리도, 선도 안 그려야
       "그 뒤는 안개"가 된다. 남은 칸이 몇 개고 무슨 종류인지는 여기서 화면에 한 조각도
       새어나가지 않는다. */
    const hasHiddenFuture = future.length > 1;
    const rows = visited.concat(future[0] ? [{nodes:future[0], current:true, revealed:true}] : []);
    /* 누적 레인은 반드시 시작→보스 순서(rows, 반전 전)로 계산한다 — 화면 표시(위=지금
       갈림길)는 그 결과를 반전만 시킨다. 화면 위쪽이 지금 고를 수 있는 칸(행 0), 아래쪽이
       챕터 시작점(마지막 행) — 그 위로 더 있었을 자리는 안개(.map-fog)로 덮는다. */
    const lanes = laneWalk(rows);
    const displayRows = rows.slice().reverse();
    const displayLanes = lanes.slice().reverse();
    /* 안개 뒤에 숨은 칸이 있으면 맨 위에 한 행만큼 빈 자리를 남겨, current 칩이 안개 속에서
       올라오는 스텁 선을 그릴 공간을 준다. */
    const topPad = hasHiddenFuture ? MAP_ROW_STEP : 0;
    const laid = displayRows.map((r,di)=>{
      const base = displayLanes[di] * MAP_LANE_PX;
      const n = r.nodes.length;
      const centerY = topPad + di * MAP_ROW_STEP;
      /* 갈림길 옵션은 레인 단위로 벌린다(2개면 ±0.5레인, 3개면 -1·0·+1레인) — 참고 이미지처럼
         뚜렷이 갈라져 보이게 하려면 좁은 픽셀 간격이 아니라 레인 폭 그대로 써야 한다. */
      const nodes = r.nodes.map((node,k)=>{
        const x = base + (k - (n-1)/2) * MAP_LANE_PX;
        return {node, x, y:centerY, h: node.boss ? MAP_BOSS_H : MAP_CHIP};
      });
      return {row:r, nodes};
    });
    const totalHeight = topPad + (displayRows.length-1)*MAP_ROW_STEP + MAP_BOSS_H;
    /* 칩 — 실제 칩 중심(x, y)에 맞춰 절대좌표로 찍는다. 지금 남은 건 지나온 칸과 current뿐이라
       더 이상 안개 칩(.fog)은 없다. */
    const chipsHtml = laid.map(({row:r, nodes})=>nodes.map(({node, x, y, h})=>{
      const cls = ['crumb-chip'];
      if(r.done) cls.push('visited');
      if(r.current) cls.push('current');
      if(node.boss) cls.push('boss');
      if(node.type==='elite') cls.push('elite');
      const action = r.current ? ` data-action="enter-node" data-id="${node.id}"` : '';
      const style = `left:${cx(x)-MAP_CHIP/2}px; top:${y}px; margin-top:${-h/2}px;`;
      return `<div class="${cls.join(' ')}"${action} style="${style}">${nodeTypeIcon(node)}</div>`;
    }).join('')).join('');
    /* 선 — 인접한 두 행의 노드는 실제로 어느 쪽을 골라도 다음 갈림길로 이어지므로,
       한 행의 모든 칩과 다음 행의 모든 칩 사이에 각각 선을 긋는다(완전 연결). 대각선은
       쓰지 않고 직각으로만 꺾는다. */
    const linksHtml = [];
    for(let di=0; di<laid.length-1; di++){
      laid[di].nodes.forEach(a=>{
        laid[di+1].nodes.forEach(b=>{
          linksHtml.push(orthoLink(a, b));
        });
      });
    }
    /* 안개 스텁 — current 칩마다 캔버스 맨 위까지 선을 하나씩 그어 둔다. 길은 실제로
       거기서 계속되지만, .map-fog 그라디언트를 이 선 위에 덧칠해 위쪽일수록 완전히
       삼키고 칩에 가까워질수록만 살짝 비쳐 보이게 한다(칩 자체는 z-index 로 항상
       또렷하게 남는다). */
    const fogStubHtml = hasHiddenFuture ? laid[0].nodes.map(({x,y,h})=>{
      const t = MAP_LINE_THICK;
      return `<div class="map-link" style="left:${cx(x)-t/2}px; top:0px; width:${t}px; height:${Math.max(0,y-h/2)}px;"></div>`;
    }).join('') : '';
    const fogVeilHtml = hasHiddenFuture ? `<div class="map-fog" style="height:${topPad}px;"></div>` : '';
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen map-screen">
        <div class="chapter-tag">${chapterDisplayName(ch.tier)}<span class="chapter-step">${S.stepInChapter}/${ch.length}</span></div>
        <div class="chapter-threat">${tierThreat(ch.tier).label}</div>
        ${S.stepInChapter===0 ? `<div class="chapter-lead">${ch.lead}</div>` : ''}
        <div class="tier-tag">${branchGuide || (bossNext ? '길이 하나로 좁혀졌다' : '다음 향할 곳을 선택하세요')}</div>
        <div class="mini-map">
          <div class="map-canvas" style="width:${MAP_CANVAS_HALF*2}px; height:${totalHeight}px;">${fogStubHtml}${linksHtml.join('')}${fogVeilHtml}${chipsHtml}
          </div>
        </div>
      </div>`;
    const cur = contentEl.querySelector('.mini-map .crumb-chip.current');
    if(cur) cur.scrollIntoView({block:'center', inline:'center'});
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
    /* 건질 유물이 없고(유물 풀이 바닥났거나, 예전 버전 저장분처럼 S.escape 가
       아예 안 채워진 경우) 이미 하나를 골랐다고 볼 수도 없다면, 고를 것도
       없는 빈 목록만 뜨고 다음으로 넘어갈 버튼이 없는 막다른 화면이 된다.
       그 자리에서 멈추는 대신 곧장 등대 기지로 돌려보낸다. */
    if(!picked && (!esc.offer || esc.offer.length===0)){
      enterTavern();
      return;
    }
    contentEl.innerHTML = `
      <div class="screen escape-screen">
        <div class="title-en">Extracted</div>
        <h2 style="margin:0;">${chapterDisplayName(ch.tier)} 구역을 빠져나왔다</h2>
        <div class="escape-note">
          잠수종이 수면으로 오른다. 공기는 낯설지만, 등대의 불빛은 아직 남아 있다.
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
          ${markerRecall(esc.marker) ? `<div class="relic-recall">${markerRecall(esc.marker)}</div>` : ''}
        </div>` : ''}
        ${(picked && S.relics.indexOf(picked)<0) ? `
          <div class="escape-note">자리가 없어 ${picked.name}은(는) 두고 왔다.</div>
          <div class="escape-note">등대 기지의 문이 열려 있다. 다음 하강 전에 들를 수 있는 마지막 안전지대다.</div>
          <button class="btn primary" data-action="to-tavern">등대 기지로 간다</button>
        ` : picked ? `
          <div class="relic-card">
            <div class="relic-glyph">${relicPortrait(picked,true)}</div>
            <div class="relic-name">${picked.name}</div>
            ${relicTier(picked)}
            <div class="relic-boon">${picked.boon}</div>
            <div class="relic-desc">${picked.flavor}</div>
          </div>
          <div class="escape-note">등대 기지의 문이 열려 있다. 다음 하강 전에 들를 수 있는 마지막 안전지대다.</div>
          <button class="btn primary" data-action="to-tavern">등대 기지로 간다</button>
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

  /* 렌즈 보케 — 따뜻한 빛 원반이 화면 여기저기서 저마다 다른 크기·자리·박자로
     떠올랐다 가라앉는다. 자리는 매번 다시 그릴 때마다 새로 굴려 늘 같은 자리에서
     반짝이지 않게 한다. */
  function bokehDotsHtml(n){
    return Array.from({length:n}, ()=>{
      const size = Math.round(8 + Math.random()*36);
      const left = Math.round(Math.random()*100);
      const top = Math.round(Math.random()*100);
      const delay = Math.round(Math.random()*4400);
      const dur = Math.round(3400 + Math.random()*2800);
      const op = (0.28 + Math.random()*0.42).toFixed(2);
      return `<i style="--size:${size}px; --left:${left}%; --top:${top}%; --delay:${delay}ms; --dur:${dur}ms; --op:${op};"></i>`;
    }).join('');
  }
  function renderLighthouseReturnCutscene(){
    contentEl.innerHTML = `
      <div class="screen lighthouse-return-cutscene" aria-label="등대로 귀환">
        <div class="lighthouse-return-bokeh" aria-hidden="true">${bokehDotsHtml(18)}</div>
        <div class="lighthouse-return-glow" aria-hidden="true"></div>
        <div class="lighthouse-return-title">귀환</div>
      </div>`;
  }

  /* 등대에서 다시 층으로 내려설 때 — 잠수종 문이 닫히고 그 층의 이름이 한 번
     푸르게 새겨진다. 귀환 연출과 같은 타이머 구조를 빌리되 색과 상징만 다르다. */
  function stageEntryMotesHtml(n){
    return Array.from({length:n}, ()=>{
      const size = Math.round(3 + Math.random()*5);
      const left = Math.round(Math.random()*100);
      const delay = Math.round(Math.random()*3400);
      const dur = Math.round(2600 + Math.random()*2200);
      return `<i style="--size:${size}px; --left:${left}%; --delay:${delay}ms; --dur:${dur}ms;"></i>`;
    }).join('');
  }
  function renderStageEntryCutscene(){
    const tier = S.stageEntryTier || (S.foray && S.foray.tier) || (chapter() && chapter().tier) || '';
    contentEl.innerHTML = `
      <div class="screen stage-entry-cutscene" aria-label="${chapterDisplayName(tier)} 진입">
        <div class="stage-entry-glow" aria-hidden="true"></div>
        <div class="stage-entry-bubbles" aria-hidden="true">${stageEntryMotesHtml(16)}</div>
        <div class="stage-entry-tier">${tierThreat(tier).label}</div>
        <div class="stage-entry-title">${chapterDisplayName(tier)}</div>
        <div class="stage-entry-door left" aria-hidden="true"></div>
        <div class="stage-entry-door right" aria-hidden="true"></div>
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

  /* 살아 돌아온 횟수 — 초상화 안쪽 오른편에 닻으로 건다. 훈장처럼 읽혀야 하므로
     점이 아니라 형태를 그린다(갈무리에 ⚓ 글리프가 없어 CSS 획으로 세운다).
     본편에서 인양은 세 번뿐이라 셋이 상한이고, 셋이 차면 짧게 맥동한다. */
  const SURVIVAL_MARK_MAX = 3;
  /* 닻의 색으로 랭크를 나타낸다 — 청동(1~2회) → 은(3~5회, 유연한 몸놀림이 확정되는
     지점) → 금(6회 이상, 기존의 '가득 찬' 맥동 유지). 아이콘 수는 청동 구간에서만
     1~2개로 늘고, 은부터는 항상 3개를 채운 채 색만 올라간다. */
  const SURVIVAL_RANK_TIERS = [ {min:6, id:'gold'}, {min:3, id:'silver'}, {min:1, id:'bronze'} ];
  function survivalRankTier(wins){
    for(let i=0;i<SURVIVAL_RANK_TIERS.length;i++){ if(wins>=SURVIVAL_RANK_TIERS[i].min) return SURVIVAL_RANK_TIERS[i].id; }
    return null;
  }
  function survivalMarks(hero){
    const wins = Math.max(0, Math.floor(hero && hero.descentWins || 0));
    if(!wins) return '';
    const tier = survivalRankTier(wins);
    const lit = tier==='bronze' ? Math.min(SURVIVAL_MARK_MAX, wins) : SURVIVAL_MARK_MAX;
    /* 금 랭크는 닻 둘레에 작은 반짝임 세 점을 얹는다 — 훈장이 완성됐다는 표시다. */
    const sparkle = tier==='gold' ? '<i class="mark-sparkle s1"></i><i class="mark-sparkle s2"></i><i class="mark-sparkle s3"></i>' : '';
    return `<span class="survival-marks tier-${tier} ${tier==='gold'?'full':''}" aria-label="생환 ${wins}회 · ${tier} 랭크">`
      + '<i class="survival-mark"></i>'.repeat(lit) + sparkle + '</span>';
  }

  function heroCardHtml(hero){
    if(!hero) return `<div class="hero-card empty">공석</div>`;
    const hpRatio = Math.max(0, hero.hp/hero.maxHp);
    const hpPct = hpRatio*100;
    const shownDp = Math.round(Number.isFinite(hero.dp) ? hero.dp : 0);
    const dead = !hero.alive;
    const rank = heroRank(hero);
    const idle = !dead && !canActFrom(hero, rank);
    /* 위치 교환의 2단계(목적지 선택)에서는 죽은 대원의 자리로도 옮길 수 있어, 생존 여부를
       가리지 않고 자기 자신(방금 고른 그 대원)만 뺀 채 전부 눌리게 한다. */
    const repositioning = S.battle && S.battle.pendingDomain==='ally-slot';
    const targetable = repositioning
      ? S.battle.pendingRepositionFrom !== hero.id
      : (S.battle && S.battle.pendingDomain==='ally' && hero.alive);
    const tutorialPulse = targetable && !repositioning && sayHighlightsUnit(hero);
    const marks = survivalMarks(hero);
    const flexGlow = !dead && !!hero.reachFlexible;
    const breakingDown = !dead && (hero.breakdown||0)>0;
    return `
      <div class="hero-card cls-${hero.cls} ${hero.collapsed?'collapsed':''} ${breakingDown?'breakdown':''} ${targetable?'targetable':''} ${tutorialPulse?'tutorial-pulse':''} ${idle?'idle':''} ${marks?'has-marks':''} ${flexGlow?'flex-imprint':''}"
           style="${dead?'opacity:0.35;':''}"
           data-action="choose-target" data-domain="${repositioning?'ally-slot':'ally'}" data-id="${hero.id}">
        ${marks}
        <div class="status-stack">
          ${reactBadge(hero)}
          ${flexGlow ? `<div class="flex-imprint-tag" title="유연한 몸놀림 — 대열 어느 자리에서도 행동할 수 있다">⟡</div>` : ''}
          ${breakingDown ? `<div class="breakdown-tag" title="정신붕괴 — 제어할 수 없다">붕괴 ${hero.breakdown}</div>` : ''}
          ${(hero.invulnerableTurns||0)>0 ? `<div class="invulnerable-tag">무적 ${hero.invulnerableTurns}</div>` : ''}
          ${(hero.tauntTurns||0)>0 ? `<div class="taunt-tag" title="전장의 고함 — 아군을 노린 공격이 전부 이쪽으로 온다">고함 ${hero.tauntTurns}</div>` : ''}
          ${hero.block>0 ? `<div class="block-tag">${IC_BLOCK}${hero.block}</div>` : ''}
        </div>
        <div class="portrait portrait-${hero.cls}">${CLASS_ICON[hero.cls]}</div>
        <div class="hero-rank">${dead?'전사':rankName(rank)} ${reachChip(hero)}</div>
        <div class="hero-name">${heroCardLabel(hero)}</div>
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

    const tutorialPulse = targetable && sayHighlightsUnit(en);
    const confused = en.alive && (en.confused||0)>0;
    return `
      <div class="foe-card ${targetable?'targetable':''} ${tutorialPulse?'tutorial-pulse':''} ${isElite?'elite-foe':''} ${isBoss?'boss-foe':''} ${isAwakened?'boss-awakened':''} ${idle?'idle':''} ${confused?'confused':''}"
           style="${dead?'opacity:0.3;':''}"
           data-idx="${i}" ${targetable?`data-action="choose-target" data-domain="enemy"`:''}>
        <div class="status-stack">
          ${en.isLeader && en.alive ? `<div class="leader-tag" title="우두머리 — 먼저 쓰러뜨리면 남은 무리가 혼란에 빠진다">★ 우두머리</div>` : ''}
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
        ${confused ? `<div class="confused-badge">혼란 ${en.confused}</div>`
          : en.alive && en.intent ? `<div class="intent-badge ${sayHighlightsIntent(en)?'intent-pulse':''}"><span class="ic">${en.intent.ic}</span>${en.intent.label}${en.intent.val?` · ${en.intent.val}`:''}</div>` : (dead?`<div class="foe-dead">소멸</div>`:'')}
      </div>`;
  }

  function describeCardRaw(card){
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
      case 'sunken_ark': return `${card.turns||1}턴 동안 생존한 아군 전체 무적. 무적 중 받은 피해는 공격한 적에게 그대로 되돌아간다. 강화 불가.`;
      case 'nameless_hymn': return '아군 전체 심도압박을 0으로 만들고, 지운 총합의 1/3만큼 모든 적에게 피해.';
      case 'saints_last_prayer': return `생존한 아군 전체 체력 ${Math.round(card.healRatio*100)}% 회복. ${card.regenTurns}턴 동안 추가로 총 ${card.regenTotal} 회복.`;
      case 'block': return `자신 방어 ${card.block} 획득.`;
      case 'taunt': return `${card.turns}턴 동안 아군을 노리는 모든 공격을 자신이 대신 받는다. 그동안 받는 피해 ${Math.round((card.tauntReduction||0)*100)}% 감소.`;
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
      case 'double_ap': return '사용 직전 AP를 두 배로 만든다.';
      case 'legendary_sanctuary': return `생존한 아군 전체 체력 ${card.heal} 회복 + 심도압박 ${card.calm} 감소 + 방어 ${card.block} 획득.`;
      case 'emergency_escape': return '이 전투에서 빠져나와 지도로 돌아간다. 압박 50 이상인 대원과 유물 대부분을 잃는다.';
      case 'draw': return `카드 ${card.draw}장을 드로우한다.`;
      case 'foresight': return `카드 ${card.draw}장 드로우. 자신 심도압박 ${card.calm} 감소.`;
      case 'reroll_intent': return `적 한 명의 예고된 행동을 다시 정한다.`;
      case 'swap': return `아군 한 명을 전열로 이동시킨다. (이미 전열이면 중열과 교대)`;
      case 'reposition': return `아군 한 명을 골라, 원하는 자리로 옮긴다.`;
      default: return card.desc || '';
    }
  }
  /* 카드 효과는 문장 단위로 끊어 한 박스 안에서도 읽기 쉽게 표시한다. */
  function describeCard(card){
    return String(describeCardRaw(card)).replace(/\.\s+/g, '.\n');
  }

  /* 못 내는 카드에는 이유를 붙여 보여준다 — 왜 회색인지 알아야 자리를 고친다 */
  function castRankNote(card){
    const why = S.battle ? cardBlockReason(card) : null;
    return why ? ` — ${why}` : '';
  }

  /* 새 플레이어의 첫 전투에서만 보여 주는 핵심 시스템 안내.
     프롤로그 대신 실제 전투판 위에서 규칙을 확인하고 바로 플레이를 시작하게 한다. */
  function coreGuidePanel(){
    if(!S || !S.battle || !S.battle.coreGuide) return '';
    const sections = [
      {t:'AP · 카드 사용', lines:[
        '매 턴 AP 3으로 시작합니다. 카드마다 필요한 AP가 다르며, AP가 없으면 사용할 수 없습니다.',
        '정규 AP를 2 이상 남기고 턴을 끝내면 다음 턴에 임시 AP +1을 얻습니다.',
      ]},
      {t:'적의 예고 · 대열', lines:[
        '적 카드의 의도와 피해량을 보고 이번 턴에 막을지 공격할지 결정합니다.',
        '전열·중열·후열에 따라 공격 가능한 대상과 카드 효과가 달라집니다.',
      ]},
      {t:'심도압박 · 잠식', lines:[
        '심도압박은 대원별 수치입니다. 100에 닿으면 정신붕괴 — 5턴 동안 제어를 잃고 아군·적을 가리지 않고 공격합니다.',
        '잠식은 지역 전체의 시계입니다. 100%가 되기 전에 지역을 통과해야 합니다.',
      ]},
      {t:'지도 · 귀환', lines:[
        '전투·엘리트·은신처·회수 노드 중 하나를 선택해 아래로 내려갑니다.',
        '은신처에서는 회복하거나 현재까지의 보상을 지키고 등대 기지로 귀환할 수 있습니다.',
      ]},
      {t:'고래기름 · 등대', lines:[
        '전투 승리 시 고래기름이 무작위로 떨어질 수 있습니다.',
        '고래기름은 전투 중 사용할 수 없습니다. 살아서 등대 기지로 돌아와야 연료고에 들어갑니다.',
      ]},
      {t:'미상 카드 · 오염', lines:[
        '빛이 약해지면 모든 등급의 카드가 미상 카드로 오염될 수 있습니다.',
        '손에 들어올 때는 팝업이 없고, 사용할 때 원래 효과와 리스크가 한 번 표시됩니다.',
        '리스크에는 현재 HP 10% 감소, 심도압박 10% 증가 같은 디버프가 섞여 있습니다.',
      ]},
    ];
    return `<div class="core-guide-overlay" role="dialog" aria-modal="true" aria-label="첫 전투 핵심 시스템 안내">
      <div class="core-guide-panel">
        <div class="tier-tag">첫 하강 · 핵심 시스템</div>
        <h3>등대 밖에서는 이렇게 싸운다</h3>
        <p class="core-guide-intro">${guideText('이번 안내는 첫 전투에서만 표시됩니다. 이후에는 메뉴의 게임 가이드에서 다시 확인할 수 있습니다.')}</p>
        <div class="core-guide-sections">
          ${sections.map(sec=>`<section><h4>${sec.t}</h4><ul>${sec.lines.map(line=>`<li>${guideText(line)}</li>`).join('')}</ul></section>`).join('')}
        </div>
        <button class="btn primary" data-action="dismiss-core-guide">확인</button>
      </div>
    </div>`;
  }

  /* 회피·흘림·방어·반격·치명타가 실제로 발동한 순간에만 보여 주는 전투 규칙 안내.
     combatGuideQueue 는 한 행동에서 여러 효과가 겹쳐도 순서대로 읽게 한다. */
  function combatRuleGuidePanel(){
    const b=S && S.battle;
    const kind=b && Array.isArray(b.combatGuideQueue) ? b.combatGuideQueue[0] : null;
    /* 노트가 발행된 동안에는 노트가 먼저 읽혀야 한다. 큐는 소비하지 않고
       노트가 끝난 뒤 sayStep()의 render()에서 이어서 보여 준다. */
    if(!kind || sayActive()) return '';
    const guides = {
      dodge:{title:'회피', tag:'피격 반응 · 회피', lines:[
        '회피가 발동하면 이번 공격은 피해를 전혀 주지 못합니다.',
        '회피 확률은 대원의 대열과 유물·생환 보너스에 따라 달라집니다.',
        '회피한 공격은 애초에 닿지 않았으므로 치명타가 발생하지 않습니다.',
      ]},
      guard:{title:'흘림', tag:'피격 반응 · 흘림', lines:[
        '흘림이 발동하면 들어올 피해가 절반으로 줄어듭니다.',
        '흘림은 방어와 별도의 피격 반응이며, 이미 부풀어 오른 치명타 피해에도 적용됩니다.',
        '심도압박은 피해가 아니므로 흘림으로 줄일 수 없습니다.',
      ]},
      defense:{title:'방어', tag:'피격 반응 · 방어', lines:[
        '방어는 받은 피해에서 먼저 차감되고, 남은 피해만 체력을 깎습니다.',
        '방어 수치는 턴이 끝나면 사라지므로 공격이 예고된 턴에 맞춰 사용하세요.',
        '심도압박은 피해가 아니므로 방어로 막을 수 없습니다.',
      ]},
      riposte:{title:'반격', tag:'피격 반응 · 반격', lines:[
        '반격이 발동하면 공격을 받은 뒤 공격자에게 즉시 피해를 돌려줍니다.',
        '대원의 대열과 공격자의 위치가 닿을 때만 반격할 수 있으며, 반격에 대한 재반격은 발생하지 않습니다.',
      ]},
      critical:{title:'크리티컬', tag:'전투 판정 · 치명타', lines:[
        `치명타는 약 ${(CRIT_CHANCE*100).toFixed(1)}% 확률로 발생하며 피해가 ${CRIT_MULT_MIN}~${CRIT_MULT_MAX}배로 부풀어 오릅니다.`,
        `최종 피해는 원래 피해의 ${CRIT_MULT_CAP}배를 넘지 않습니다. 아군과 적 모두 같은 규칙을 사용합니다.`,
        '회피로는 치명타를 막지만, 방어와 흘려막기는 이미 부풀어 오른 피해를 줄이는 방식으로 적용됩니다.',
      ]},
      leaderFall:{title:'우두머리 격파', tag:'전투 판정 · 혼란', lines:[
        '적 무리 중 최대체력이 가장 높은 개체가 우두머리입니다 — 카드 위 ★ 표식으로 표시됩니다.',
        `우두머리가 다른 적보다 먼저 쓰러지면, 남은 적 전체가 ${LEADER_CONFUSION_TURNS}턴 동안 혼란에 빠집니다.`,
        '혼란에 빠진 적은 매턴 절반 확률로 얼어붙거나, 절반 확률로 다른 적을 공격합니다.',
      ]},
      breakdown:{title:'정신붕괴', tag:'전투 판정 · 심도압박', lines:[
        '심도압박이 100에 닿으면 대원이 정신붕괴 상태가 됩니다.',
        `${MENTAL_BREAKDOWN_TURNS}턴 동안 카드로 제어할 수 없고, 매턴 아군·적을 가리지 않고 무작위로 공격합니다.`,
        `그동안 심도압박은 매턴 ${MENTAL_BREAKDOWN_DP_DECAY}씩 저절로 빠지며, 다 지나면 제어를 되찾습니다.`,
      ]},
      taunt:{title:'전장의 고함', tag:'전투 판정 · 도발', lines:[
        '외치는 동안, 아군 누구를 노린 공격이든 전부 이 대원이 대신 받습니다(광역기 포함).',
        '그동안 이 대원이 받는 피해는 카드에 적힌 비율만큼 줄어듭니다.',
        '지속 턴이 끝나면 효과가 사라지고 평소처럼 각자 공격을 받습니다.',
      ]},
    };
    const guide=guides[kind] || guides.defense;
    return `<div class="core-guide-overlay combat-rule-guide-overlay" role="dialog" aria-modal="true" aria-label="${guide.title} 전투 가이드">
      <div class="core-guide-panel combat-rule-guide-panel">
        <div class="tier-tag">${guide.tag}</div>
        <h3>${guide.title}</h3>
        <ul class="combat-rule-guide-list">${guide.lines.map(line=>`<li>${guideText(line)}</li>`).join('')}</ul>
        <button class="btn primary" data-action="dismiss-combat-guide" data-kind="${kind}">확인</button>
      </div>
    </div>`;
  }

  /* 처음 에픽을 쥔 순간 한 번 뜨는 안내. 화면을 갈아 끼우지 않고 위에 얹으므로
     보상 화면에서 켜지든 전투 한복판에서 켜지든 같은 판을 쓴다. */
  /* 유일한 생존자 — 어느 화면으로 넘어가든 뜨도록 render() 에서 화면 밖에 얹는다.
     그래서 다른 안내판과 달리 position:fixed 로 스스로 화면을 덮는다. */
  function soleSurvivorGuidePanel(){
    if(!S.soleSurvivorGuide) return '';
    const name = S.soleSurvivorGuide.name || '생존자';
    return `
      <div class="core-guide-overlay sole-survivor-overlay" role="dialog" aria-modal="true" aria-label="업적 · 유일한 생존자">
        <div class="core-guide-panel sole-survivor-panel">
          <div class="tier-tag">업적 해금</div>
          <h3>유일한 생존자</h3>
          <p class="core-guide-intro">${guideText(`탐사대를 전부 잃고도 <b>${name}</b>이(가) 홀로 수문장을 넘겼다.`)}</p>
          <div class="core-guide-sections">
            <section><ul>
              <li>${guideText('닻 배지 랭크가 두 단계 올랐습니다.')}</li>
              <li>${guideText('최대체력·공격력·방어력이 평소 생환 보상보다 훨씬 크게 올랐습니다.')}</li>
            </ul></section>
          </div>
          <button class="btn primary" data-action="dismiss-sole-survivor-guide">확인</button>
        </div>
      </div>`;
  }

  function epicGuidePanel(){
    if(!S.epicGuide) return '';
    /* 예전 저장에는 true 로만 남아 있다 — 등급을 모르면 에픽으로 읽는다 */
    const legendary = S.epicGuide==='legendary';
    return `
      <div class="draw-swap epic-guide">
        <div class="tier-tag">심연이 응답했다</div>
        <h3 style="margin:0;">${legendary ? '전설 카드' : '에픽 카드'}</h3>
        <div class="af-hint">${legendary
          ? `심연이 내려주는 카드 중에서도 가장 무거운 축입니다. <b>AP ${LEGENDARY_CARD_AP}</b>을 전부 쏟아 넣는 대신, 판을 통째로 뒤집는 힘을 냅니다.`
          : `심연이 내려주는 카드입니다. 대부분 <b>AP 0~1</b>로 판을 통째로 뒤집습니다.`}</div>
        <div class="epic-guide-list">
          <div><b>손에 남습니다.</b> 보통 카드는 턴이 끝나면 버려지지만, ${legendary?'전설':'에픽'}은 손에 남아
            <b>최대 ${EPIC_HAND_TURNS}턴</b>까지 쥘 수 있습니다. 카드 오른쪽 위의 숫자가 남은 턴이고,
            <span class="dp">붉게 바뀌면 이번 턴이 마지막</span>입니다.</div>
          ${legendary
            ? `<div><b>한 런에 단 한 장뿐입니다.</b> 이미 한 장을 지녔다면 같은 런에서 두 번째 전설은 나오지 않습니다 — 에픽처럼 겹쳐 흡수시키는 길이 없습니다.</div>
               <div><b>강화 목록에는 오르지 않습니다.</b> 처음 손에 들어온 그 형태 그대로 씁니다.</div>`
            : `<div><b>두 장까지만 지닙니다.</b> 셋째가 들어오면 무엇을 두고 갈지 고르고,
                남은 것 하나가 그 무게를 받아 <b>+1</b> 깊어집니다.</div>
               <div><b>강화 목록에는 오르지 않습니다.</b> 에픽을 깊게 하는 길은 위의 흡수뿐입니다.</div>`}
          <div><b>엘리트와 수문장은 저항합니다.</b> 그들에게는 힘의 <b>${Math.round(EPIC_RESIST*100)}%</b>만 닿습니다 —
            무리를 쓸어내는 데 쓰고, 길을 막고 선 것 앞에서는 덱으로 싸우세요.</div>
        </div>
        <button class="btn primary" data-action="dismiss-epic-guide">확인</button>
      </div>`;
  }

  /* 강화·합성 목록 카드 이름 왼쪽에 붙는 종류 아이콘. cardCategory(20-card-data.js)가
     type 을 공격/방어/지원으로 가른다. */
  function cardTypeIcon(card){
    const cat = cardCategory(card);
    return `<span class="card-type-ico ${cat}" title="${CARD_CATEGORY_LABEL[cat]}" aria-hidden="true"></span>`;
  }

  /* 카드 이름 위에 얹는 공격/방어/지원 분류 배지. */
  function cardCategoryBadge(card){
    const cat = cardCategory(card);
    return `<div class="card-category-badge cat-${cat}">${cardTypeIcon(card)}<span>${CARD_CATEGORY_LABEL[cat]}</span></div>`;
  }

  function cardHtml(card, playable, selecting){
    const glitch = card.contaminated;
    const desc = glitch ? '？？？ 효과 미상' : (describeCard(card) + castRankNote(card));
    const tutorialPulse = sayHighlightsCard(card);
    const cardHero = !glitch && S && Array.isArray(S.party)
      ? S.party.find(hero=>hero && hero.cls===card.owner)
      : null;
    /* 에픽 이상은 손에 남는다 — 몇 턴 더 쥘 수 있는지 카드 위에 적어 둔다.
       마지막 한 턴은 붉게 — 이번에 안 쓰면 사라진다는 뜻이다. */
    const left = glitch ? null : heldTurnsLeft(card);
    return `
      <div class="card owner-${card.owner} ${glitch?'unknown':cardVisualClass(card)} ${playable?'':'unplayable'} ${tutorialPulse?'tutorial-pulse':''} ${glitch?'contaminated':''} ${selecting?'selecting':''}" data-uid="${card.uid}" data-action="play-card">
        ${left!=null ? `<div class="card-hold ${left<=1?'last':''}" title="손에 남는 턴">${left}</div>` : ''}
        <div class="card-cost mono">${glitch ? '?' : card.cost}</div>
        ${glitch ? '' : cardCategoryBadge(card)}
        <div class="card-name ${glitch?'glitch':''}">${glitch ? '미상 카드' : card.name}</div>
        <div class="card-desc ${glitch?'glitch':''}">${desc}</div>
        <div class="card-owner-tag">${glitch ? '등급 · 소속 · 종류 미상' : `${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}${cardHero ? ` · ${cardHero.name}` : ''}`}</div>
      </div>`;
  }

  function contaminationPreviewPanel(){
    const p=S && S.contaminationPreview;
    if(!p) return '';
    if(p.mode==='use') return `<div class="draw-swap contamination-preview contamination-use-preview" data-action="menu-noop">
      <div class="tier-tag">오염 카드 사용</div>
      <h3 style="margin:0;">${escapeHtml(p.name)}</h3>
      <div class="af-hint">카드 효과를 사용하기 전에 오염의 대가를 치러야 합니다.</div>
      <div class="card normal preview-card"><div class="card-cost mono">${p.cost}</div><div class="card-name">${escapeHtml(p.name)}</div><div class="card-desc">${escapeHtml(p.desc)}</div><div class="card-owner-tag">${escapeHtml(p.rarity||'카드')} · 원래 효과</div></div>
      <div class="contamination-risk-box"><div class="tier-tag">리스크 · ${escapeHtml(p.riskName||'오염')}</div><div class="af-hint">${escapeHtml(p.riskDesc||'오염 효과가 적용됩니다.')}</div></div>
      <button class="btn primary" data-action="dismiss-contamination">오염을 감수하고 사용</button>
    </div>`;
    return `<div class="draw-swap contamination-preview" data-action="menu-noop">
      <div class="tier-tag">미상 카드</div>
      <h3 style="margin:0;">오염 기록</h3>
      <div class="af-hint">오염 카드는 사용할 때 원래 효과와 리스크를 확인합니다.</div>
      <div class="card normal preview-card">
        <div class="card-cost mono">${p.cost}</div>
        <div class="card-name">${escapeHtml(p.name)}</div>
        <div class="card-desc">${escapeHtml(p.desc)}</div>
        <div class="card-owner-tag">${escapeHtml(p.rarity||'카드')} · 오염 전</div>
      </div>
      <button class="btn primary" data-action="dismiss-contamination">확인했다</button>
    </div>`;
  }

  /* 설명·지시는 이제 #say 층이 맡는다. 전투판에는 아무것도 얹지 않는다. */
  function prologueBattlePanel(){ return ''; }

  function garble(str){
    const glyphs = ['◈','҂','⁂','†','☩','▒','░','⍟','✢','⌁'];
    return str.split('').map(ch => Math.random()<0.5 ? glyphs[Math.floor(Math.random()*glyphs.length)] : ch).join('');
  }

  function renderBattle(){
    const b = S.battle;

    let pips = '';
    for(let i=0;i<b.maxAp;i++){ pips += `<div class="pip ${i<b.ap?'filled':''}"></div>`; }
    for(let i=0;i<(b.tempAp||0);i++){ pips += `<div class="pip temp filled"></div>`; }

    /* 사망자는 전투 대열의 자리를 차지하지 않는다. 게임 규칙의 effRank만 바뀌고
       화면이 그대로면 뒤의 대원이 앞으로 당겨진 사실을 볼 수 없으므로, 실제 전투
       화면도 생존자만 렌더링해 대열 변화를 보여 준다. 적은 원본 인덱스를 유지해
       표적 선택 데이터가 전투 배열과 어긋나지 않게 한다. */
    const activeHeroes = S.party.filter(h=>h && h.alive);
    const activeFoes = b.enemies.filter(en=>en && en.alive);
    const heroesHtml = activeHeroes.map(h=>heroCardHtml(h)).join('');
    const foesHtml = activeFoes.map(en=>foeCardHtml(en,b.enemies.indexOf(en))).join('');

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
          ${cardCategoryBadge(b.pendingDraw.card)}
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
          <div class="foe-row ${activeFoes.length>2?'many':''} ${activeFoes.length>=4?'crowded':''}">${foesHtml}</div>
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
            <button class="btn ${sayHighlightsEndTurn()?'tutorial-pulse':''}" data-action="end-turn" ${(b.over||b.pendingCardUid||b.pendingDraw||!sayAllowsEndTurn())?'disabled':''}>턴 종료</button>
          </div>
        </div>
        ${drawSwapHtml}
        ${epicGuidePanel()}
        ${contaminationPreviewPanel()}
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
          <div class="rest-party-title">현재 탐사대 상태</div>
          <div class="rest-party-grid">${partyStatus}</div>
        </div>
        <div class="rest-opts">
          <div class="rest-opt ${r.choice==='heal'?'sel':''}" data-action="rest-pick" data-kind="heal">
            <div class="t">상처를 봉합한다</div>
            <div class="d">생존한 아군 전체 체력 +${REST_HEAL}</div>
          </div>
          <div class="rest-opt ${r.choice==='calm'?'sel':''}" data-action="rest-pick" data-kind="calm">
            <div class="t">눈을 감고 침묵한다</div>
            <div class="d">생존한 아군 전체 심도압박 -${REST_CALM}</div>
          </div>
        </div>
        <button class="btn primary" data-action="rest-confirm" ${r.choice?'':'disabled'}>계속 하강한다</button>
        ${S.free ? `<div class="escape-note rest-haul">여기서 귀환 장치를 작동하면 이번 탐사는 거기서 끝난다. 쥔 것은 그대로 가져간다.</div>
        <button class="btn" data-action="rest-return">귀환한다 · 등대 기지로</button>` : ''}
      </div>`;
  }

  function renderAftermath(){
    const a = S.aftermath;
    const node = S.pendingNode;
    const salvage = !!node && node.type==='treasure';
    let body = '';
    if(a.cardOffer && a.cardOffer.length){
      const selIdx = a.cardSelected;
      const selCard = Number.isInteger(selIdx) ? a.cardOffer[selIdx] : null;
      body = `
        <div class="tier-tag">${salvage ? '회수' : '전투 보상'} · 덱 ${S.runDeck.length}/${MAX_DECK_SIZE}</div>
        <div class="af-hint">${salvage ? '잔해에서 건져 올린' : '심연이 남긴'} 카드 3장 중 하나를 덱에 넣습니다. 고르지 않은 카드는 두고 갑니다. 전투 재화와 고래기름은 인양보관함에 보관되어 귀환 시 기지로 복구됩니다.</div>
        <div class="card-reward-grid">${a.cardOffer.map((card,i)=>`
          <div class="card owner-${card.owner} ${cardVisualClass(card)} reward-card ${selIdx===i?'sel':''}" data-action="select-card-reward" data-index="${i}">
            <div class="card-cost mono">${card.cost}</div>
            ${cardCategoryBadge(card)}
            <div class="card-name">${card.name}</div>
            <div class="card-desc">${describeCard(card)}</div>
            <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
          </div>`).join('')}</div>
        ${selCard ? `
          <div class="af-hint"><b>${selCard.name}</b>을(를) 덱에 넣고, 나머지 두 장은 두고 갑니다.</div>
          <div class="confirm-row">
            <button class="btn" data-action="cancel-card-reward">다시 고른다</button>
            <button class="btn primary" data-action="confirm-card-reward">이대로 정한다</button>
          </div>
        ` : ''}`;
    } else if(a.reveal){
      const card = a.reveal.card;
      /* 등급 광원과 파편은 카드가 새로 손에 들어오는 이 한 순간에만 남긴다. */
      const epicAcquired = !!a.reveal.epicAcquired;
      const legendaryAcquired = !!a.reveal.legendaryAcquired;
      const revealFx = legendaryAcquired ? 'legendary' : (epicAcquired ? 'epic' : (a.reveal.kind==='upgrade' ? 'upgrade' : 'fusion'));
      const sparkCount = legendaryAcquired ? 20 : (epicAcquired ? 12 : 0);
      const sparks = sparkCount ? Array.from({length:sparkCount},(_,i)=>`<i class="reveal-spark" style="--i:${i}"></i>`).join('') : '';
      body = `
        <div class="reveal-center">
          <div class="reveal-stage reveal-${revealFx}">
            <div class="reveal-banner">${a.reveal.kind==='upgrade' ? '카드가 강화되었다' : isLegendaryCard(card) ? '전설 카드가 모습을 드러냈다' : isEpicCard(card) ? '심연이 응답했다 — 에픽 카드 획득' : '두 카드가 합성되었다'}</div>
            <div class="reveal-card-wrap">
              <div class="card owner-${card.owner} ${cardVisualClass(card)} reveal-card">
                <div class="card-cost mono">${card.cost}</div>
                ${cardCategoryBadge(card)}
                <div class="card-name">${card.name}</div>
                <div class="card-desc">${describeCard(card)}</div>
                <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
              </div>
              <div class="reveal-sparks" aria-hidden="true">${sparks}</div>
            </div>
            <button class="btn primary" data-action="reveal-confirm">계속하기</button>
          </div>
        </div>`;
    } else if(a.selecting==='upgrade'){
        const opts = groupedUpgradeOptions();
      const selected = opts.find(g=>g.defId===a.upgradeSelected) || null;
      const preview = selected ? previewUpgradeCard(selected.card) : null;
      const upgradeEchoes = selected ? upgradeEchoCost(selected.card) : 0;
      const upgradeCatalysts = selected ? upgradeCatalystCost(selected.card) : 0;
      const upgradeAffordable = selected ? canPayUpgrade(selected.card) : false;
      body = `
        <div class="af-list">
          ${opts.length ? opts.map(g=>{
            const isSelected = !!selected && selected.defId===g.defId;
            const locked = !!selected && !isSelected;
            const materialNote = upgradeNeedsMerge(g) ? ` · 동일 +${g.level} ${g.count}/2장` : '';
            return `<div class="af-row ${cardVisualClass(g.card)} ${isSelected?'sel':''} ${locked?'locked':''}" ${locked?'':`data-action="select-upgrade" data-defid="${g.defId}"`}>
              <div class="af-row-name">${cardTypeIcon(g.card)}${g.name}</div>
              <div class="af-row-owner">${cardRarityLabel(g.card)} · ${ownerLabel(g.owner)} · 보유 ${g.count}장 · +${g.level}/+${MAX_UPGRADE_LEVEL}${materialNote}</div>
            </div>`;
          }).join('') : `<div class="af-empty">지금 강화할 수 있는 카드가 없다.</div>`}
        </div>
        ${selected&&preview ? `<div class="upgrade-preview ${cardVisualClass(selected.card)}">
          <div class="upgrade-preview-title">${selected.name} · +${selected.level} → <b>+${selected.level+1}</b></div>
          <div class="upgrade-preview-line">AP ${preview.cost !== selected.card.cost ? `${selected.card.cost} → <b>${preview.cost}</b>` : selected.card.cost} · ${cardRarityLabel(selected.card)} · ${ownerLabel(selected.owner)} · ${upgradeNeedsMerge(selected) ? `동일 카드 +${selected.level} 2장을 합성` : '선택한 카드 1장'}</div>
          <div class="upgrade-preview-line">현재: ${describeCard(selected.card)}</div>
          <div class="upgrade-preview-line"><b>강화 후:</b> ${describeCard(preview)}</div>
        </div><div class="af-hint">선택한 카드를 다시 누르면 선택을 해제할 수 있습니다.</div><button class="btn primary" data-action="do-upgrade" data-defid="${selected.defId}" ${upgradeAffordable?'':'disabled'}>${upgradeNeedsMerge(selected) ? '두 카드를 합쳐 강화한다' : '이 카드를 강화한다'} · 잔향 ${upgradeEchoes}${upgradeCatalysts?` · 촉매 ${upgradeCatalysts}`:''}${upgradeAffordable?'':` · 재화 부족`}</button>` : `<div class="af-hint">카드를 선택하면 현재 정보와 강화 후 효과를 확인합니다. +${MERGE_UPGRADE_START_LEVEL}부터는 동일 카드 2장이 필요합니다.${mergeWaitingCount() ? ` 짝이 없어 목록에서 빠진 카드가 ${mergeWaitingCount()}종 있습니다.` : ''}</div>`}
        <button class="btn" data-action="aftermath-back">뒤로</button>`;
    } else if(a.selecting==='fuse'){
      const materialCards = fusionMaterialCards();
      const opts = groupedFusionOptions();
      const materials = a.fuseSelected.map(id=>materialCards.find(c=>c.defId===id)).filter(Boolean);
      const fusionEchoes = materials.length===2 ? fusionEchoCost(materials[0],materials[1]) : 0;
      const fusionCatalysts = materials.length===2 ? fusionCatalystCost(materials[0],materials[1]) : 0;
      const fusionAffordable = materials.length===2 && canPayFusion(materials[0],materials[1]);
      const selectedFusionIds = new Set(a.fuseSelected||[]);
      const availableFusionOpts = opts.filter(g=>g.defIds.some(id=>!selectedFusionIds.has(id)));
      /* 고른 재료도 눌러서 뺄 수 있다 — 목록까지 되돌아가 같은 줄을 찾을 이유가 없다 */
      const inspect = c => `<div class="card-inspect pickable ${cardVisualClass(c)}" data-action="unpick-fuse" data-defid="${c.defId}">
        <div class="card-inspect-head"><span>${cardTypeIcon(c)}${isLegendaryCard(c)?'◆ ':isEpicCard(c)?'✦ ':''}${c.name}</span><span class="card-inspect-meta">AP ${c.cost} · ${cardRarityLabel(c)} · ${ownerLabel(c.owner)}</span></div>
        <div class="card-inspect-effect">${describeCard(c)}</div>
      </div>`;
      body = `
        <div class="af-list">
          ${availableFusionOpts.length ? availableFusionOpts.map(g=>{
            const remaining = g.defIds.filter(id=>!selectedFusionIds.has(id)).length;
            return `<div class="af-row ${cardVisualClass(g.card)}" data-action="toggle-fuse" data-defid="${g.defId}">
              <div class="af-row-name">${cardTypeIcon(g.card)}${g.name}</div>
              <div class="af-row-owner">${cardRarityLabel(g.card)} · ${ownerLabel(g.owner)} · 남은 ${remaining}장</div>
            </div>`;
          }).join('') : `<div class="af-empty">합성할 수 있는 덱 카드가 없다.</div>`}
        </div>
        ${materials.length ? `<div class="fusion-inspect"><div class="af-hint">선택한 합성 재료 — 눌러서 뺄 수 있습니다</div>${materials.map(inspect).join('')}</div>` : `<div class="af-hint">카드를 선택하면 AP와 효과를 확인할 수 있습니다.</div>`}
        <div class="af-hint">현재 덱의 카드만 재료로 선택할 수 있습니다. 합성 비용: 심연 잔향 ${materials.length===2?fusionEchoes:'-' }${materials.length===2&&fusionCatalysts ? ` · 심해 촉매 ${fusionCatalysts}` : ''}. 촉매가 필요한 합성만 에픽 결과가 열립니다.</div>
        ${a.fuseSelected.length===2 ? `<button class="btn primary" data-action="do-fuse" ${fusionAffordable?'':'disabled'}>합성하기${fusionAffordable?'':` · 재화 부족`}</button>` : `<div class="af-hint">중립 또는 직업 카드 2장을 선택하세요 (${a.fuseSelected.length}/2)</div>`}
        <button class="btn" data-action="aftermath-back">뒤로</button>`;
    } else if(a.actionsLeft<=0){
      /* 정화 기회가 없는 자리(회수) — 건진 것을 확인하고 나가는 문만 둔다 */
      body = `<button class="btn primary" data-action="aftermath-skip">계속하기</button>`;
    } else {
      body = `
        <div class="rest-opts">
          <div class="rest-opt" data-action="aftermath-pick" data-kind="upgrade"><div class="t">카드 강화</div><div class="d">같은 등급의 카드 2장을 합성해 다음 등급으로 강화한다</div></div>
          <div class="rest-opt" data-action="aftermath-pick" data-kind="fuse"><div class="t">카드 합성</div><div class="d">중립·직업 카드 2장을 무작위 중립·직업·에픽 카드로 합친다</div></div>
        </div>
        <button class="btn" data-action="aftermath-skip">그냥 넘어가기</button>`;
    }
    /* 안내 플래그는 저장 이전 런과의 호환 때문에 보조적으로만 사용한다.
       선택 화면에 처음 진입했는데 플래그가 저장되지 않은 경우에도 반드시 안내한다. */
    const rewardGuide = a.rewardGuide ? `
      <div class="card-system-guide-overlay" role="dialog" aria-modal="true" aria-label="전투 보상 안내">
        <div class="card-system-guide-panel">
          <div class="tier-tag">전투 종료 · 인양 안내</div>
          <h3>전투에서 건져 올린 것</h3>
          <p>${guideText('전투가 끝나면 카드 보상 3장 중 <b>한 장</b>을 선택해 덱에 넣습니다. 덱이 가득 차면 새 카드를 받을 수 없습니다.')}</p>
          <p>${guideText('<b>심연 잔향</b>과 보스가 남긴 <b>심해 촉매</b>는 전투 중 인양보관함에 저장됩니다. 고래기름도 같은 보관함에 담겨 등대 밝기를 회복하는 데 사용됩니다.')}</p>
          <p>${guideText('생환하면 보관함의 내용물이 전부 등대 기지로 복구됩니다. 파티가 전멸하면 인양줄이 보관함의 <b>50%</b>만 건져 올립니다.')}</p>
          <p>${guideText('카드 강화와 합성은 전투 후가 아니라 귀환 뒤 <b>정비실</b>에서 진행할 수 있습니다.')}</p>
          <button class="btn primary" data-action="dismiss-battle-reward-guide">확인</button>
        </div>
      </div>` : '';
    const upgradeGuide = a.selecting==='upgrade' && !hasSeenUpgradeGuide() ? `
      <div class="upgrade-guide-overlay" role="dialog" aria-modal="true" aria-label="강화 규칙 안내">
        <div class="upgrade-guide-panel">
          <h3>강화 규칙</h3>
          <p>${guideText('카드는 <b>+0 → +1</b>까지 한 장으로 강화할 수 있습니다.')}</p>
          <p>${guideText('<b>+1 → +2</b>부터는 같은 카드·같은 강화 단계의 카드 2장이 필요합니다.')}</p>
          <p>${guideText('예: <b>놋쇠 벽 +1</b> 두 장을 합쳐 <b>놋쇠 벽 +2</b> 한 장을 만듭니다.')}</p>
          <button class="btn primary" data-action="dismiss-upgrade-guide">확인</button>
        </div>
      </div>` : '';
    const fusionGuide = a.selecting==='fuse' && !hasSeenFusionGuide() ? `
      <div class="fusion-guide-overlay" role="dialog" aria-modal="true" aria-label="합성 규칙 안내">
        <div class="fusion-guide-panel">
          <div class="tier-tag">새 시스템 · 카드 합성</div>
          <h3>두 카드를 하나로 녹인다</h3>
          <p>${guideText('현재 덱의 <b>중립·직업 카드 2장</b>을 재료로 사용합니다. 선택한 카드는 사라지므로 강화 단계와 효과를 먼저 확인하세요.')}</p>
          <p>${guideText('합성 결과는 중립 또는 현재 탐사대 직업 카드 중 무작위로 정해지며, <b>5% 확률로 에픽 카드</b>가 등장합니다.')}</p>
          <p>${guideText('에픽·전설 카드도 합성 재료가 될 수 있습니다. 단, 결과가 항상 더 강하다는 보장은 없으니 덱의 빈틈을 메울 때 사용하세요.')}</p>
          <button class="btn primary" data-action="dismiss-fusion-guide">확인</button>
        </div>
      </div>` : '';
    const cardSystemGuide = !a.selecting && !a.cardOffer && !a.reveal && a.actionsLeft>0 && !hasSeenCardSystemGuide() ? `
      <div class="card-system-guide-overlay" role="dialog" aria-modal="true" aria-label="카드 시스템 안내">
        <div class="card-system-guide-panel">
          <div class="tier-tag">새 시스템 · 덱 관리</div>
          <h3>카드를 더 깊게 만든다</h3>
          <p>${guideText('<b>카드 강화</b>는 귀환 뒤 정비실에서 진행합니다. +0 → +1은 카드 한 장으로 강화하고, +1부터는 같은 카드·같은 강화 단계 2장이 필요합니다.')}</p>
          <p>${guideText('<b>카드 합성</b>은 중립·직업 카드 2장을 재료로 소모해 새로운 카드를 얻는 선택입니다. 에픽·전설 카드도 재료로 사용할 수 있으며, 결과는 무작위입니다.')}</p>
          <p>${guideText('이 화면의 정화 기회마다 강화 또는 합성 중 하나를 선택할 수 있습니다. 재료로 사용할 카드의 이름·등급·강화 단계를 확인한 뒤 결정하세요.')}</p>
          <button class="btn primary" data-action="dismiss-card-system-guide">확인</button>
        </div>
      </div>` : '';
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">${node?node.title:''}${node&&node.type==='treasure'?'':' · 승리'}</div>
        ${S.fuelCargo ? `<div class="escape-note" style="border-color:var(--gaslamp);color:var(--gaslamp);">고래기름 ${S.fuelCargo}개 운반 중 · 귀환해야 등대에 전달된다</div>` : ''}
        ${a.reveal || (node&&node.type==='treasure') ? '' : `<h3 style="margin:0;">${a.actionsLeft>0? `정화 기회 ${a.actionsLeft}회 남음` : (node&&node.type==='treasure'?'완료':'승리')}</h3>`}
        ${(!a.reveal && node && node.desc) ? `<p class="af-flavor">${node.desc}</p>` : ''}
        ${(!a.reveal && !a.selecting && a.dropped && S.relics.indexOf(a.dropped)>=0) ? `
          <div class="relic-card drop">
            <div class="drop-banner">${salvage ? '잔해 속에서 무언가 건져 올렸다' : '사체 아래에서 무언가 건져 올렸다'}</div>
            <div class="relic-glyph">${relicPortrait(a.dropped,true)}</div>
            <div class="relic-name">${a.dropped.name}</div>
            ${relicTier(a.dropped)}
            <div class="relic-boon">${a.dropped.boon}</div>
            <div class="relic-desc">${a.dropped.flavor}</div>
          </div>` : ''}
        ${body}
      </div>
      ${rewardGuide}${cardSystemGuide}${upgradeGuide}${fusionGuide}${epicGuidePanel()}`;
  }

  /* 등대 기지 — 안전하게 귀환한 뒤에만 열린다. 빈 자리를 채우고 다시 내려간다. */
  function arrivalCardBadge(card, glowing){
    if(!card) return '';
    const rarity=cardRarityLabel(card);
    const icon=card.legendary?'◆':card.epic?'✦':'•';
    return `<span class="arrival-card-badge ${cardVisualClass(card)} ${glowing?'arrival-card-glint':''}"><span class="arrival-card-icon">${icon}</span>${rarity} · ${card.name}</span>`;
  }
  function scheduleArrivalCardSpark(hero){
    if(!hero || !hero.arrivalCardPending || hero.arrivalCardSparkScheduled) return;
    hero.arrivalCardSparkScheduled=true;
    setTimeout(()=>{
      hero.arrivalCardPending=false;
      delete hero.arrivalCardSparkScheduled;
      saveRun();
      if(S.screen==='tavern') render();
    },2600);
  }
  function renderTavern(){
    const tv = S.tavern || {recruited:[], slot:null, unlocked:null, seated:false};
    const next = CHAPTERS[S.chapter+1];
    const fallen = openSlots();
    const cands = recruitCandidates();
    const residence = ensureResidence();
    const pendingGuests = residence.pendingGuests||[];
    if(pendingGuests.length) scheduleArrivalCardSpark(pendingGuests[0]);

    /* 첫 귀환의 방문자는 자동으로 숙소에 기록된다. 별도의 클래스 해금 선택지는 두지 않는다. */
    const firstArrivalComplete = S.chapter===0 && tv.unlocked==='oracle' && UNLOCKED.length===0 && tv.seated;
    const renderTavernSeat = p=>{
      scheduleArrivalCardSpark(p);
      const rank = S.party.indexOf(p);
      return `
        <div class="tavern-seat active" data-action="tavern-character-detail" data-id="${p.characterId||p.id}">
          <div class="portrait portrait-${p.cls}" style="width:30px;height:30px;">${CLASS_ICON[p.cls]}</div>
          <div class="tavern-seat-body">
            <div class="tavern-seat-name">${p.name}</div>
            <div class="tavern-seat-sub">${classNameFor(p.cls)} · ${rankName(rank)}</div>
            ${arrivalCardBadge(p.arrivalCard,p.arrivalCardPending)}
          </div>
          <div class="tavern-detail-hint">상세</div>
        </div>`;
    };
    const activeParty=S.party.filter(p=>p&&p.alive);
    const newArrivals=activeParty.filter(p=>tv.recruited.indexOf(S.party.indexOf(p))>=0);
    const roster=activeParty.filter(p=>newArrivals.indexOf(p)<0).map(renderTavernSeat).join('');
    const detail = S.party.find(p=>p&&p.alive&&(p.characterId||p.id)===tv.detailId);
    const detailCard=detail&&detail.arrivalCard;
    const detailPopup = detail ? `<div class="tavern-detail-overlay" data-action="tavern-detail-close"><div class="tavern-detail-panel" data-action="tavern-detail-noop"><button class="tavern-detail-close" data-action="tavern-detail-close" aria-label="닫기">×</button><div class="portrait portrait-${detail.cls} tavern-detail-portrait">${CLASS_ICON[detail.cls]}</div><div class="tier-tag">${rankName(S.party.indexOf(detail))} · 출정 대기</div><h3>${detail.name}</h3><div class="tavern-detail-class">${classNameFor(detail.cls)} · ${CLASS_DEFS[detail.cls].tagline}</div><div class="tavern-detail-stats"><div>HP <b>${detail.hp}/${detail.maxHp}</b></div><div>공격력 <b>${Math.round((detail.attackPower||1)*100)}%</b></div><div>방어력 <b>${Math.round((detail.defensePower||1)*100)}%</b></div><div>심도압박 저항 <b>${Math.round((1-(detail.dpResistance||1))*100)}%</b></div><div>심도압박 <b>${Math.round(detail.dp||0)}</b></div><div>생환 <b>${detail.descentWins||0}회</b></div></div>${detailCard?`<div class="tavern-detail-card">${arrivalCardBadge(detailCard,false)}<div class="tavern-detail-card-desc">${describeCard(detailCard)}</div></div>`:'<div class="tavern-detail-card-empty">보유한 입소 카드가 없습니다.</div>'}<div class="relic-desc">${CLASS_DEFS[detail.cls].blurb}</div></div></div>` : '';

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
        <div class="tier-tag">${firstArrivalComplete ? '첫 귀환 · 등대 기지' : '등대 기지'}</div>
        <h2 style="margin:0;">${firstArrivalComplete ? '네 번째 불빛' : '잠긴 닻'}</h2>
        <div class="tavern-lighthouse-status">등대 밝기 <b>${Math.round(lighthouseBrightness())}% · ${lighthouseStage()}</b> · 연료고 ${lighthouseOil()}개</div>
        <div class="escape-note">${firstArrivalComplete
          ? '고래기름을 들고 돌아온 세 사람 뒤로, 심연 예언자 한 명이 등대의 빛 안으로 걸어 들어왔다. 누구도 그가 언제부터 따라왔는지 알지 못한다.'
          : '젖은 외투에서 물이 떨어진다. 아무도 어디를 다녀왔는지 묻지 않는다.'}</div>
          ${hasCutLine() ? `<div class="escape-note cut-line-note">정비실 구석에 끊어진 잠수 케이블이 걸려 있다. 끝은 여전히 아래를 가리킨다.</div>` : ''}
        ${picker ? picker : `
          ${newArrivals.length ? `<div class="tavern-new-arrivals"><div class="tavern-new-arrivals-title">새로 들어온 대원</div>${newArrivals.map(renderTavernSeat).join('')}</div>` : ''}
          ${pendingGuests.length ? `<div class="escape-note">숙소 정원이 가득 찼습니다. 새로 도착한 ${pendingGuests[0].name}을(를) 맞이하려면 숙소에서 기존 대원 한 명을 내보내세요.${pendingGuests.length>1?` · 대기 ${pendingGuests.length}명`:''}</div>${arrivalCardBadge(pendingGuests[0].arrivalCard,pendingGuests[0].arrivalCardPending)}` : ''}
          <div class="tavern-roster">${roster}</div>
          ${firstArrivalComplete ? `<div class="escape-note">세 명으로 내려갔던 원정대가 이제 네 명이 되었다.</div>`
            : `<div class="escape-note">현재 출정 가능한 대원만 표시하고 있습니다. 상세 정보는 대원을 눌러 확인하세요.</div>`}
          <div class="escape-note">${partyLimit() >= PARTY_MAX
            ? `이제부터는 ${PARTY_MAX}인까지 데려갈 수 있다.`
            : `아직 ${PARTY_START}인이 한계다. 벽의 명패에서 사람을 만나야 자리가 하나 더 열린다.`}</div>
          <div class="tavern-base-actions"><button class="btn" data-action="open-residence">숙소</button><button class="btn" data-action="open-maintenance">정비실</button><button class="btn" data-action="open-institute">연구실</button></div>
          ${hasCampaignSnapshot() ? `
            <div class="escape-note">자유 탐사 중 잠시 밀어 둔 이야기가 있다.</div>
            <button class="btn primary" data-action="resume-campaign">진행하던 이야기로 돌아간다</button>
          ` : ''}
          ${S.free
            ? `<div class="escape-note">해도에서 다음 자리를 고른다.</div>
               <button class="btn ${hasCampaignSnapshot()?'':'primary'}" data-action="world-map">해도를 편다</button>`
            : `<div class="escape-note">${next ? `${next.title} — ${next.lead}` : ''}</div>
               <button class="btn primary" data-action="descend">${next ? `다시 내려간다 · ${next.length}구역` : '계속한다'}</button>`}
        `}
      </div>${detailPopup}`;
  }

  function initMaintenanceSliders(){
    document.querySelectorAll('.maintenance-card-list').forEach(list=>{
      if(list.dataset.sliderReady==='1' || list.children.length<=1) return;
      list.dataset.sliderReady='1';
      const track=document.createElement('div');
      track.className='maintenance-slider-track';
      while(list.firstElementChild) track.appendChild(list.firstElementChild);
      list.appendChild(track);
      const shell=document.createElement('div');
      shell.className='maintenance-slider';
      list.parentNode.insertBefore(shell,list);
      shell.appendChild(list);
      const prev=document.createElement('button');
      prev.className='maintenance-slider-arrow'; prev.dataset.action='card-slider-prev'; prev.textContent='‹'; prev.setAttribute('aria-label','이전 카드');
      const next=document.createElement('button');
      next.className='maintenance-slider-arrow'; next.dataset.action='card-slider-next'; next.textContent='›'; next.setAttribute('aria-label','다음 카드');
      const counter=document.createElement('div'); counter.className='maintenance-slider-counter'; counter.textContent=`1/${track.children.length}`;
      shell.insertBefore(prev,list); shell.appendChild(next); shell.appendChild(counter);
      track.dataset.index='0'; track.dataset.total=String(track.children.length); track.dataset.counter='';
      counter.dataset.sliderCounter='1';
      track.children[0].classList.add('slider-active');
      /* CSS의 translateX(-78px) 는 데스크톱 카드 폭(156px) 기준 초기값일 뿐이다.
         실측 폭으로 다시 맞춰야 좁은 화면에서 첫 카드부터 어긋나지 않는다. */
      positionCardSlider(track, 0);
    });
  }

  function maintenanceDisplayCard(card, foot, action, defId, extraClass){
    const attrs=action ? `data-action="${action}" data-defid="${defId}"` : '';
    return `<div class="card owner-${card.owner} ${cardVisualClass(card)} maintenance-display-card ${extraClass||''}" ${attrs}>
      <div class="card-cost mono">${card.cost}</div>
      ${cardCategoryBadge(card)}
      <div class="card-name">${card.name}</div>
      <div class="card-desc">${describeCard(card)}</div>
      <div class="card-owner-tag">${cardRarityLabel(card)} · ${ownerLabel(card.owner)}<br>${foot||''}</div>
    </div>`;
  }

  /* 서약·각성 탭 — 심연 계위·심연의 열쇠 진행, 각인 관리(외과의사가 왕진 온 자리),
     각성 카드 전환을 한곳에 모은다. 새 화면을 만드는 대신 정비실 탭 하나로 접는다. */
  function renderEndgameTab(pool){
    const rank = abyssRank();
    const forced = forcedClauseIdsForRank(rank).map(id=>pactClauseDef(id)).filter(Boolean);
    const nextForced = pactClauseDef(forcedClauseIdsForRank(rank+1).slice(-1)[0]);
    const keysFound = CHAPTERS.filter(ch=>hasAbyssKey(ch.tier)).length;
    const rankPanel = `<div class="maintenance-copy"><b>심연 계위 ${rank}</b> — 자유 탐사에서 서약을 걸고 완주할 때마다 오릅니다.<br>
      ${forced.length ? `현재 강제 조항: ${forced.map(c=>c.name).join(' · ')}` : '아직 강제 조항이 없습니다.'}<br>
      ${nextForced ? `다음 계위에서 추가될 조항: ${nextForced.name}(${nextForced.desc})` : '조항을 모두 강제로 걸었습니다.'}</div>
      <div class="maintenance-copy"><b>심연의 열쇠 ${keysFound}/${CHAPTERS.length}</b> — 히든 갈림길의 암호를 맞히면 챕터마다 하나씩 얻습니다.
      ${hasTrueEnding() ? '<br>다른 결말을 이미 확인했습니다.' : '<br>네 열쇠를 전부 들고 서약을 건 채 최심층에 닿으면 다른 결말이 열립니다.'}</div>`;

    const roster = (S.residence && S.residence.roster) || [];
    const imprintRows = roster.map(person=>{
      const held = heroImprints(person.id).map(id=>imprintDef(id)).filter(Boolean);
      if(!held.length) return '';
      return `<div class="maintenance-copy"><b>${person.name}</b>의 각인<br>${held.map(d=>
        `<span class="relic-chip">${d.name}${d.kind==='bad'?' (부정)':''}</span> ${d.desc}
         <button class="btn" data-action="imprint-remove" data-id="${person.id}" data-imprint="${d.id}">제거</button><br>`
      ).join('')}</div>`;
    }).join('');

    const activeClasses = Array.from(new Set((S.party||[]).filter(p=>p&&p.alive).map(p=>p.cls)));
    const awakenRows = activeClasses.map(cls=>{
      const def = CLASS_DEFS[cls] || {};
      const progress = awakenedProgress(cls);
      const unlocked = isAwakenedUnlocked(cls);
      const eligible = pool.some(c=>c.owner===cls && c.signature && !c.awakened);
      const already = pool.some(c=>c.owner===cls && c.awakened);
      return `<div class="maintenance-copy"><b>${def.className||cls}</b> — 각성 진행 ${progress}/${AWAKENED_THRESHOLD}
        ${already ? ' · 이미 각성했습니다.' : unlocked ? (eligible
          ? `<button class="btn" data-action="awaken-signature" data-cls="${cls}">시그니처 카드 각성</button>`
          : ' · 각성할 시그니처 카드가 덱에 없습니다.')
        : ' · 서약을 걸고 수문장을 더 넘겨야 합니다.'}</div>`;
    }).join('');

    return `${rankPanel}
      <div class="maintenance-copy" style="margin-top:8px;"><b>각인</b> — 서약을 걸고 자유 탐사에서 귀환하면 대원 개인에게 영구 흔적이 남을 수 있습니다.</div>
      ${imprintRows || '<div class="af-empty">아직 각인을 얻은 대원이 없습니다.</div>'}
      <div class="maintenance-copy" style="margin-top:8px;"><b>각성 카드</b> — 서약을 걸고 수문장을 넘길 때마다 그 자리의 직업이 진행도를 얻습니다.</div>
      ${awakenRows || '<div class="af-empty">현재 대열에 각성 가능한 직업이 없습니다.</div>'}`;
  }

  /* 등대 연구실 — 정비실과는 별도 화면. 재화를 연구 포인트로 바꾸고, 그 포인트로
     불빛 사거리를 넓혀 헬리온·로버·제스터를 순서대로 해금한다. */
  function renderInstitute(){
    const pts = researchPoints();
    const lvl = lightRangeLevel();
    const nextCls = lightRangeNextClass();
    const nextCost = lightRangeUpgradeCost();
    const canUpgrade = nextCls && pts >= nextCost;
    const exch = kind => {
      const info = researchExchangeInfo(kind);
      const have = kind==='echoes' ? abyssalEchoes() : deepCatalysts();
      const label = kind==='echoes' ? '심연 잔향' : '심해 촉매';
      const ok = have >= info.cost;
      return `<button class="btn institute-wide-btn" data-action="institute-exchange" data-kind="${kind}" ${ok?'':'disabled'}>${label} ${info.cost}개 → 연구 포인트 ${info.gain}</button>`;
    };
    const classRows = UNLOCKABLES.map((id,i)=>{
      const def = CLASS_DEFS[id];
      const unlocked = isUnlocked(id);
      return `<div class="maintenance-card-row institute-class-row ${unlocked?'selected':''}">
        <span class="institute-class-portrait">${CLASS_ICON[id]||''}</span>
        <div class="maintenance-card-main">
          <div class="maintenance-card-name">${def.className}</div>
          <div class="maintenance-card-meta">${def.tagline}</div>
          <div class="maintenance-card-meta">${def.blurb}</div>
        </div>
        <div class="maintenance-card-count">${unlocked?'해금됨':`사거리 Lv.${i+1} 필요`}</div>
      </div>`;
    }).join('');
    contentEl.innerHTML = `${renderTopbar()}<div class="screen maintenance-screen">
      <div class="maintenance-head"><h2>연구실</h2><div class="escape-note">등대 밖으로 뻗어 나가는 불빛의 사거리를 넓혀, 그 빛이 닿는 곳에서 새로운 병과를 데려옵니다.</div></div>
      <div class="maintenance-panel">
      <div class="maintenance-oil">연구 포인트 <b>${pts}</b></div>
      <div class="tier-tag">재화 환전</div>
      <div class="maintenance-oil institute-wide-box">
        <div>기지 재화 · 심연 잔향 <b>${abyssalEchoes()}</b> · 심해 촉매 <b>${deepCatalysts()}</b></div>
        ${exch('echoes')}
        ${exch('catalysts')}
      </div>
      <div class="tier-tag" style="margin-top:8px;">불빛 사거리 · Lv.${lvl}/${LIGHT_RANGE_MAX}</div>
      <div class="maintenance-locker institute-wide-box">
        <div class="maintenance-locker-copy">${nextCls ? `다음 단계 · 연구 포인트 ${nextCost} · 해금 병과 ${CLASS_DEFS[nextCls].className}` : '불빛이 닿을 수 있는 가장 먼 곳까지 이미 밝혔습니다.'}</div>
        ${nextCls ? `<button class="btn primary institute-wide-btn" data-action="institute-upgrade-range" ${canUpgrade?'':'disabled'}>사거리 확장 · 연구 포인트 ${nextCost}</button>` : ''}
      </div>
      <div class="tier-tag" style="margin-top:8px;">사거리로 해금되는 병과</div>
      <div class="maintenance-card-list institute-wide-box institute-class-list">${classRows}</div>
      </div>
      <div class="maintenance-actions"><button class="btn" data-action="institute-close">연구실 나가기</button></div>
    </div>`;
  }

  function renderMaintenance(){
    const m = S.maintenance || {tab:'catalog', deckIds:[], upgradeSelected:null, fuseSelected:[]};
    if(m.reveal && m.reveal.card){
      const reveal=m.reveal;
      const card=reveal.card;
      const epicAcquired=!!reveal.epicAcquired;
      const legendaryAcquired=!!reveal.legendaryAcquired;
      const revealFx=legendaryAcquired ? 'legendary' : (epicAcquired ? 'epic' : (reveal.kind==='upgrade' ? 'upgrade' : 'fusion'));
      const sparkCount=legendaryAcquired ? 20 : (epicAcquired ? 12 : 0);
      const sparks=sparkCount ? Array.from({length:sparkCount},(_,i)=>`<i class="reveal-spark" style="--i:${i}"></i>`).join('') : '';
      const banner=reveal.kind==='upgrade' ? '카드가 강화되었다' : isLegendaryCard(card) ? '전설 카드가 모습을 드러냈다' : isEpicCard(card) ? '심연이 응답했다 — 에픽 카드가 탄생했다' : '두 카드가 합성되었다';
      contentEl.innerHTML=`${renderTopbar()}<div class="screen maintenance-screen"><div class="maintenance-panel"><div class="reveal-center"><div class="reveal-stage reveal-${revealFx}"><div class="reveal-banner">${banner}</div><div class="reveal-card-wrap"><div class="card owner-${card.owner} ${cardVisualClass(card)} reveal-card"><div class="card-cost mono">${card.cost}</div>${cardCategoryBadge(card)}<div class="card-name">${card.name}</div><div class="card-desc">${describeCard(card)}</div><div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div></div><div class="reveal-sparks" aria-hidden="true">${sparks}</div></div><div class="af-hint">결과 카드를 확인했습니다. 확인을 누르면 정비실로 돌아갑니다.</div><button class="btn primary" data-action="maintenance-reveal-confirm">확인</button></div></div></div></div>`;
      return;
    }
    const selectedIds = new Set(m.deckIds||[]);
    const pool = S.runDeck || [];
    const lockerCap = salvageLockerCapacity();
    const lockerCost = salvageLockerUpgradeCost();
    const lockerCanUpgrade = lockerCost>0 && abyssalEchoes()>=lockerCost;
    const activeNames = new Set((S.party||[]).filter(p=>p&&p.alive).map(p=>CLASS_DEFS[p.cls]&&CLASS_DEFS[p.cls].className));
    const ownerName = owner => owner==='neutral' ? '중립' : (CLASS_DEFS[owner] ? CLASS_DEFS[owner].className : ownerLabel(owner));
    let body = '';
    let maintenanceAction = '';
    if(m.tab==='catalog'){
      const rows = maintenanceBaseCards().map(base=>{
        const copies = pool.filter(c=>c.owner===base.owner && baseCardName(c)===base.name);
        const card = copies[0] || base;
        const included = copies.filter(c=>selectedIds.has(c.defId)).length;
        return maintenanceDisplayCard(card, `보관 ${copies.length}장 · 덱 ${included}장`, null, null, 'catalog-card');
      });
      body = `<div class="maintenance-copy">생환한 직업군(${Array.from(activeNames).join(' · ') || '없음'})과 중립 카드의 전체 목록입니다. 정비실에서 강화·합성한 뒤 덱에 넣을 카드를 선택합니다.</div><div class="maintenance-card-list">${rows.join('')}</div>`;
    } else if(m.tab==='upgrade'){
        const opts = groupedUpgradeOptions();
      const selected = opts.find(g=>g.defId===m.upgradeSelected) || null;
      const preview = selected ? previewUpgradeCard(selected.card) : null;
      const upgradeEchoes = selected ? upgradeEchoCost(selected.card) : 0;
      const upgradeCatalysts = selected ? upgradeCatalystCost(selected.card) : 0;
      const upgradeAffordable = selected ? canPayUpgrade(selected.card) : false;
      if(selected&&preview) maintenanceAction=`<button class="btn primary" data-action="maintenance-do-upgrade" data-defid="${selected.defId}" ${upgradeAffordable?'':'disabled'}>${upgradeNeedsMerge(selected)?'같은 카드 2장을 합쳐 강화한다':'이 카드를 강화한다'} · 잔향 ${upgradeEchoes}${upgradeCatalysts?` · 촉매 ${upgradeCatalysts}`:''}${upgradeAffordable?'':` · 재화 부족`}</button>`;
      body = `<div class="af-list maintenance-card-list">${opts.length ? opts.map(g=>{ const isSelected=selected&&selected.defId===g.defId; const locked=selected&&!isSelected; return maintenanceDisplayCard(g.card, `보관 ${g.count}장 · +${g.level}/+${MAX_UPGRADE_LEVEL}<br>잔향 ${upgradeEchoCost(g.card)}${upgradeCatalystCost(g.card)?` · 촉매 ${upgradeCatalystCost(g.card)}`:''}`, locked?'': 'maintenance-select-upgrade', locked?'':g.defId, `${isSelected?'sel':''} ${locked?'locked':''}` ); }).join('') : '<div class="af-empty">강화할 수 있는 카드가 없습니다.</div>'}</div>${selected&&preview ? `<div class="upgrade-preview ${cardVisualClass(selected.card)}" data-action="maintenance-unselect-upgrade" role="button" tabindex="0" title="선택 해제"><div class="upgrade-preview-title">${selected.name} · +${selected.level} → <b>+${selected.level+1}</b></div><div class="upgrade-preview-line">AP ${preview.cost !== selected.card.cost ? `${selected.card.cost} → <b>${preview.cost}</b>` : selected.card.cost}</div><div class="upgrade-preview-line">현재: ${describeCard(selected.card)}</div><div class="upgrade-preview-line"><b>강화 후:</b> ${describeCard(preview)}</div><div class="upgrade-preview-line">비용: 심연 잔향 ${upgradeEchoes}${upgradeCatalystCost(selected.card)?` · 촉매 ${upgradeCatalysts}`:''}</div></div>` : ''}`;
    } else if(m.tab==='fusion'){
      const materialCards = fusionMaterialCards();
        const opts = groupedFusionOptions();
      const materials = (m.fuseSelected||[]).map(id=>materialCards.find(c=>c.defId===id)).filter(Boolean);
      const fusionEchoes = materials.length===2 ? fusionEchoCost(materials[0],materials[1]) : 0;
      const fusionCatalysts = materials.length===2 ? fusionCatalystCost(materials[0],materials[1]) : 0;
      const fusionAffordable = materials.length===2 && canPayFusion(materials[0],materials[1]);
      const selectedFusionIds = new Set(m.fuseSelected||[]);
      const availableFusionOpts = opts.filter(g=>g.defIds.some(id=>!selectedFusionIds.has(id)));
      if(m.fuseSelected.length===2) maintenanceAction=`<button class="btn primary" data-action="maintenance-do-fuse" ${fusionAffordable?'':'disabled'}>합성하기${fusionAffordable?'':` · 재화 부족`}</button>`;
      body = `<div class="af-list maintenance-card-list">${availableFusionOpts.length ? availableFusionOpts.map(g=>{ const remaining=g.defIds.filter(id=>!selectedFusionIds.has(id)).length; return maintenanceDisplayCard(g.card, `남은 ${remaining}장`, 'maintenance-toggle-fuse', g.defId, ''); }).join('') : '<div class="af-empty">합성할 수 있는 카드가 없습니다.</div>'}</div>${materials.length ? `<div class="fusion-inspect"><div class="af-hint">선택한 카드를 누르면 선택이 해제됩니다.</div>${materials.map(c=>`<div class="card-inspect pickable" data-action="maintenance-unpick-fuse" data-defid="${c.defId}"><div class="card-inspect-head"><span>${c.name}</span><span class="card-inspect-meta">AP ${c.cost}</span></div><div class="card-inspect-effect">${describeCard(c)}</div></div>`).join('')}</div>` : ''}${m.fuseSelected.length===2 ? `<div class="maintenance-copy">합성 비용: 심연 잔향 ${fusionEchoes}${fusionCatalysts?` · 심해 촉매 ${fusionCatalysts}`:''}</div>` : `<div class="maintenance-copy">카드를 두 장 선택하세요 (${m.fuseSelected.length}/2)</div>`}`;
    } else if(m.tab==='endgame'){
      body = renderEndgameTab(pool);
    } else {
      const ownedPool = pool.filter(card=>card.deckOrigin!=='maintenance');
      const ownedSelectedIds = new Set((m.deckIds||[]).filter(id=>ownedPool.some(card=>card.defId===id)));
      const rows = ownedPool.map(card=>{ const on=ownedSelectedIds.has(card.defId); return maintenanceDisplayCard(card, on?'덱 포함':'보관 중', 'maintenance-toggle-deck', card.defId, on?'selected':''); });
      body = `<div class="maintenance-copy">실제로 습득한 카드만 다음 하강의 덱으로 선택할 수 있습니다. 최대 ${MAX_DECK_SIZE}장까지 구성할 수 있습니다.</div><div class="maintenance-card-list">${rows.length?rows.join(''):'<div class="af-empty">아직 습득한 카드가 없습니다.</div>'}</div><div class="maintenance-copy">현재 선택 ${ownedSelectedIds.size}/${MAX_DECK_SIZE}장</div>`;
    }
    contentEl.innerHTML = `${renderTopbar()}<div class="screen maintenance-screen"><div class="maintenance-head"><h2>정비실</h2><div class="escape-note">전투에서 살아 돌아온 작업자들의 카드와 기록을 정비합니다.</div></div><div class="maintenance-oil">등대 밝기 <b>${Math.round(lighthouseBrightness())}% · ${lighthouseStage()}</b> · 연료고 ${lighthouseOil()}개${lighthouseOil()>0?' · 기름을 넣으면 밝기가 4% 회복됩니다.':''} ${lighthouseOil()>0?'<button class="light-oil-btn" data-action="feed-lighthouse">기름 넣기</button>':''}</div><div class="maintenance-oil">기지 재화 · 심연 잔향 <b>${abyssalEchoes()}</b> · 심해 촉매 <b>${deepCatalysts()}</b></div><div class="maintenance-locker"><div class="maintenance-locker-title">인양보관함 · +${salvageLockerLevel()}/+10</div><div class="maintenance-locker-copy">전투 중 휴대 용량 · 잔향 ${lockerCap.echoes} · 촉매 ${lockerCap.catalysts} · 고래기름 ${lockerCap.oil}<br>생환 시 전량, 전멸 시 50%가 기지로 복구됩니다.</div><div class="maintenance-locker-actions"><button class="btn" data-action="locker-upgrade" ${lockerCanUpgrade?'':'disabled'}>${salvageLockerLevel()>=10?'최대 단계':`보관함 확장 · 잔향 ${lockerCost}`}</button></div></div><div class="maintenance-tabs">${[['catalog','전체 카드'],['upgrade','강화'],['fusion','합성'],['deck','덱 구성'],['endgame','서약·각성']].map(([id,label])=>`<button class="maintenance-tab ${m.tab===id?'active':''}" data-action="maintenance-tab" data-tab="${id}">${label}</button>`).join('')}</div><div class="maintenance-panel">${body}</div><div class="maintenance-actions"><button class="btn" data-action="maintenance-close">정비실 나가기</button>${maintenanceAction}</div></div>${epicGuidePanel()}`;
    initMaintenanceSliders();
  }

  function renderResidence(){
    const r=ensureResidence();
    const tab = r.tab==='graveyard' ? 'graveyard' : 'roster';
    const selected=new Set(r.selectedIds||[]);
    const placedIds=new Set((r.placements||[]).filter(Boolean));
    const partyById=new Map((S.party||[]).filter(Boolean).map(p=>[p.characterId||p.id,p]));
    const roster=r.roster||[];
    const aliveRoster=roster.filter(p=>p.alive!==false);
    const deadRoster=roster.filter(p=>p.alive===false);
    const rows=aliveRoster.map(person=>{
      const def=CLASS_DEFS[person.cls]||{};
      const hero=partyById.get(person.id);
      const hp=hero ? `${hero.hp}/${hero.maxHp}` : `${person.hp||def.maxHp||0}/${person.maxHp||def.maxHp||0}`;
      const dp=hero ? Math.round(hero.dp||0) : 0;
      const placed=placedIds.has(person.id);
      const on=r.armedId===person.id;
      const activeParty=!!partyById.get(person.id);
      return `<div class="residence-person ${on?'selected':''} ${placed?'placed':''}" data-action="residence-arm" data-id="${person.id}">
        <div class="portrait portrait-${person.cls}" style="width:30px;height:30px;margin:0;">${CLASS_ICON[person.cls]||'?'}</div>
        <div class="residence-person-main"><div class="residence-person-name">${person.name}</div><div class="residence-person-class">${classNameFor(person.cls)||person.cls} · ${def.tagline||''}</div><div class="residence-person-stat">HP ${hp} · 심도압박 ${dp}${hero&&hero.descentWins?` · 생환 ${hero.descentWins}회`:''}</div></div>
        <div class="residence-person-state"><button class="residence-detail-btn" data-action="residence-character-detail" data-id="${person.id}">상세</button>${placed?'배치됨 · 해제':on?'선택됨 · 해제':'선택'}${!activeParty?`<button class="residence-dismiss" data-action="residence-dismiss" data-id="${person.id}">내보내기</button>`:''}</div>
      </div>`;
    }).join('');
    /* 묘지 — 죽은 대원은 대열에 세울 수 없으니 선택 동작 없이 정보와 되살리기 버튼만 둔다 */
    const necro = hasNecromancer();
    const graveRows=deadRoster.map(person=>{
      const def=CLASS_DEFS[person.cls]||{};
      const reviveCost=REVIVE_CATALYST_COST;
      const canRevive=necro && deepCatalysts()>=reviveCost;
      return `<div class="residence-person fallen">
        <div class="portrait portrait-${person.cls}" style="width:30px;height:30px;margin:0;">${CLASS_ICON[person.cls]||'?'}</div>
        <div class="residence-person-main"><div class="residence-person-name">${person.name} <span class="dead-badge">사망</span></div><div class="residence-person-class">${classNameFor(person.cls)||person.cls} · ${def.tagline||''}</div></div>
        <div class="residence-person-state"><button class="residence-detail-btn" data-action="residence-character-detail" data-id="${person.id}">상세</button>${necro
          ? `<button class="btn" data-action="residence-revive" data-id="${person.id}" ${canRevive?'':'disabled'}>되살리기 · 촉매 ${reviveCost}</button>`
          : `<span class="residence-grave-locked">네크로맨서 전직 필요</span>`}</div>
      </div>`;
    }).join('');
    const pending=r.pendingGuests||[];
    const pendingPanel=pending.length ? `<div class="residence-pending"><div class="residence-pending-title">새로 도착한 대원</div><div class="residence-pending-name">${pending[0].name}</div><div class="residence-pending-class">${(CLASS_DEFS[pending[0].cls]||{}).className||pending[0].cls} · ${(CLASS_DEFS[pending[0].cls]||{}).tagline||''}</div>${arrivalCardBadge(pending[0].arrivalCard,pending[0].arrivalCardPending)}<div class="residence-pending-copy">숙소 정원은 ${RESIDENCE_MAX}명입니다. 기존 대원을 한 명 내보내면 이 대원이 들어옵니다.${pending.length>1?` 현재 ${pending.length}명이 순서대로 대기 중입니다.`:''}</div></div>` : '';
    const placed=(r.placements||[]).filter(id=>id&&selected.has(id));
    const placementIssues=[];
    const slots=Array.from({length:4},(_,i)=>{
      const id=r.placements[i];
      const person=roster.find(p=>p.id===id);
      const def=person ? (CLASS_DEFS[person.cls]||{}) : {};
      const mismatch=!!person && !canActFrom({reach:def.reach},i);
      if(mismatch) placementIssues.push({person, rank:i, reach:reachOf({reach:def.reach})});
      const active=!!r.armedId && !id && i<partyLimit();
      const clickable=!!person || active;
      const title=mismatch ? `${person.name} · ${placementIssues[placementIssues.length-1].reach.label} 병과는 ${rankName(i)}에서 행동할 수 없습니다.` : '';
      return `<button class="residence-slot ${person?'filled':''} ${active?'available':''} ${mismatch?'mismatch':''}" data-action="residence-place" data-index="${i}" ${clickable?'':'disabled'} ${title?`title="${title}"`:''}><span class="residence-slot-rank">${rankName(i)}</span><span class="residence-slot-name">${person?person.name:'공석'}</span>${mismatch?'<span class="residence-slot-warning">사거리 불일치</span>':''}${person?'<span class="residence-slot-remove">클릭해 해제</span>':''}</button>`;
    }).join('');
    const placementWarning=placementIssues.length ? `<div class="residence-placement-warning">빨간 전열은 클래스 사거리와 맞지 않습니다. 해당 위치에서는 카드를 사용할 수 없습니다.</div>` : '';
    const ready=selected.size>0 && placed.length===selected.size;
    /* 상세 정보 — 지금 대열에 나가 있으면 그 영웅 객체(실시간 수치)를, 아니면
       숙소 명단·입소 프로필에 남은 값을 기준으로 보여준다. */
    const detailPerson = r.detailId ? roster.find(p=>p.id===r.detailId) : null;
    const detailPopup = (() => {
      if(!detailPerson) return '';
      const def = CLASS_DEFS[detailPerson.cls]||{};
      const hero = partyById.get(detailPerson.id);
      const profile = detailPerson.profile||{};
      const maxHp = hero ? hero.maxHp : (detailPerson.maxHp||profile.maxHp||def.maxHp||0);
      const hp = hero ? hero.hp : (detailPerson.hp!=null ? detailPerson.hp : maxHp);
      const attackPower = hero ? hero.attackPower : (profile.attackPower!=null ? profile.attackPower : 1);
      const defensePower = hero ? hero.defensePower : (profile.defensePower!=null ? profile.defensePower : 1);
      const dpResistance = hero ? hero.dpResistance : (profile.dpResistance!=null ? profile.dpResistance : 1);
      const dp = hero ? Math.round(hero.dp||0) : 0;
      const descentWins = hero ? (hero.descentWins||0) : 0;
      const anchorTier = survivalRankTier(descentWins);
      const anchorTierLabel = {bronze:'청동', silver:'은', gold:'금'}[anchorTier] || '';
      const critBonus = anchorTier ? Math.round((ANCHOR_CRIT_BONUS[anchorTier]||0)*1000)/10 : 0;
      const dead = detailPerson.alive===false;
      return `<div class="tavern-detail-overlay" data-action="residence-detail-close"><div class="tavern-detail-panel" data-action="tavern-detail-noop"><button class="tavern-detail-close" data-action="residence-detail-close" aria-label="닫기">×</button><div class="portrait portrait-${detailPerson.cls} tavern-detail-portrait">${CLASS_ICON[detailPerson.cls]||'?'}</div><div class="tier-tag">${dead?'사망':(hero?`${rankName(S.party.indexOf(hero))} · 출정 대기`:'숙소 대기')}</div><h3>${detailPerson.name}${dead?' <span class="dead-badge">사망</span>':''}</h3><div class="tavern-detail-class">${classNameFor(detailPerson.cls)||detailPerson.cls} · ${def.tagline||''}</div><div class="tavern-detail-stats"><div>HP <b>${hp}/${maxHp}</b></div><div>공격력 <b>${Math.round(attackPower*100)}%</b></div><div>방어력 <b>${Math.round(defensePower*100)}%</b></div><div>심도압박 저항 <b>${Math.round((1-dpResistance)*100)}%</b></div><div>심도압박 <b>${dp}</b></div><div>생환 <b>${descentWins}회</b></div>${critBonus>0?`<div>닻 배지(${anchorTierLabel}) 치명타 <b>+${critBonus}%p</b></div>`:''}</div><div class="relic-desc">${def.blurb||''}</div></div></div>`;
    })();
    const tabsHtml=`<div class="maintenance-tabs"><button class="maintenance-tab ${tab==='roster'?'active':''}" data-action="residence-tab" data-tab="roster">대원 · ${aliveRoster.length}</button><button class="maintenance-tab ${tab==='graveyard'?'active':''}" data-action="residence-tab" data-tab="graveyard">묘지 · ${deadRoster.length}</button></div>`;
    const body = tab==='graveyard'
      ? `<div class="residence-list">${graveRows||'<div class="af-empty">아직 묘지에 잠든 사람이 없습니다.</div>'}</div>`
      : `${pendingPanel}<div class="residence-list">${rows||'<div class="af-empty">아직 숙소에 기록된 사람이 없습니다.</div>'}</div><div class="residence-rank-panel"><div class="residence-rank-title">대열 배치 · ${r.armedId ? `${roster.find(p=>p.id===r.armedId)?.name||''} 배치 중` : '캐릭터를 선택하세요'}</div><div class="residence-rank-copy">처음에는 모든 전열 슬롯과 캐릭터가 비활성화되어 있습니다. 캐릭터를 하나 선택하면 배치 가능한 공석만 활성화됩니다. 네 번째 자리는 파티 확장 후 사용할 수 있습니다.</div><div class="residence-slots">${slots}</div>${placementWarning}</div>`;
    contentEl.innerHTML=`${renderTopbar()}<div class="screen residence-screen"><div class="maintenance-head"><div class="tier-tag">숙소 · ${roster.length}/${RESIDENCE_MAX}</div><h2>불빛 아래 남은 사람들</h2><div class="escape-note">이름과 병과는 달라도, 살아 돌아온 기록은 모두 숙소에 남습니다.</div></div><div class="residence-summary">캐릭터를 하나씩 선택한 뒤 활성화된 공석을 눌러 대열을 배치하세요.<br>배치 ${placed.length}/${selected.size}명 · 최대 ${partyLimit()}명<br><small>숙소에 머무는 동안 피해를 입은 대원은 천천히 회복합니다. 현재 회복 속도: 20초마다 HP 1.</small></div>${tabsHtml}${body}<div class="maintenance-actions"><button class="btn" data-action="residence-cancel">숙소 나가기</button>${tab==='roster'?`<button class="btn primary" data-action="residence-confirm" ${ready?'':'disabled'}>이 대열로 출정</button>`:''}</div></div>${detailPopup}`;
  }

  /* 무엇을 버릴까 — 지닌 유물과 새로 들어온 하나를 나란히 놓고 하나를 고른다.
     새것을 고르면 그냥 두고 가는 것이다. */
  function renderRelicSwap(){
    const sw = S.relicSwap;
    if(!sw){ S.screen='map'; return renderMap(); }
    const selectedId = sw.selected;
    const card = (r, incoming) => {
      const canReplace = incoming || canReplaceRelic(r, sw.incoming);
      const isSelected = selectedId===r.id;
      return `
      <div class="relic-opt ${incoming?'incoming':''} ${canReplace?'':'slot-locked'} ${isSelected?'sel':''}" ${canReplace?'data-action="select-relic-drop" data-id="'+r.id+'"':''}>
        <div class="relic-opt-head">${relicPortrait(r)}<span>${r.name}</span>${relicTier(r)}
          ${incoming?'<span class="relic-new">새로 건진 것</span>':''}${isSelected?'<span class="relic-new">두고 갈 것</span>':''}</div>
        <div class="relic-boon">${r.boon}</div>
        <div class="relic-desc">${r.flavor}</div>
        ${canReplace?'':'<div class="relic-slot-lock">슬롯을 유지하려면 이 유물은 버릴 수 없습니다.</div>'}
      </div>`;
    };
    const selectedRelic = !selectedId ? null : (selectedId===sw.incoming.id ? sw.incoming : S.relics.find(r=>r.id===selectedId));
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">유물 슬롯 ${S.relics.length}/${relicCap()}점</div>
        <h3 style="margin:0;">무엇을 버릴까</h3>
        <p class="af-flavor">버릴 것을 고르면 나머지를 지니고 간다.
          새로 건진 것을 고르면 그대로 두고 온다. 고른 뒤에는 한 번 더 확인합니다.</p>
        <div class="relic-offer">
          ${S.relics.map(r=>card(r,false)).join('')}
          ${card(sw.incoming, true)}
        </div>
        ${selectedRelic ? `
          <div class="af-hint"><b>${selectedRelic.name}</b>을(를) 두고 갑니다. 되돌릴 수 없습니다.</div>
          <div class="confirm-row">
            <button class="btn" data-action="cancel-relic-drop">다시 고른다</button>
            <button class="btn primary" data-action="confirm-relic-drop">이대로 정한다</button>
          </div>
        ` : ''}
      </div>`;
  }

  /* 셋째 에픽이 올라왔다. 두 걸음을 밟는다 —
     먼저 무엇을 두고 갈지 고르고, 그다음 남은 것 하나에 그 무게를 얹는다. */
  function renderEpicAbsorb(){
    const ab = S.epicAbsorb;
    if(!ab){ S.screen='map'; return renderMap(); }
    const cardBox = (c, opts) => {
      const o = opts || {};
      const level = upgradeLevel(c);
      return `
      <div class="relic-opt ${o.incoming?'incoming':''} ${o.locked?'slot-locked':''}"
           ${o.action ? `data-action="${o.action}"${o.defId?` data-defid="${o.defId}"`:''}` : ''}>
        <div class="relic-opt-head"><span>✦ ${c.name}</span>
          ${o.incoming ? '<span class="relic-new">새로 올라온 것</span>'
                       : `<span class="relic-tier tier-legendary">+${level}</span>`}</div>
        <div class="relic-boon">${describeCard(c)}</div>
        ${o.note ? `<div class="relic-desc">${o.note}</div>` : ''}
        ${o.locked ? `<div class="relic-slot-lock">${o.lockNote||''}</div>` : ''}
      </div>`;
    };

    if(ab.phase === 'discard'){
      const choices = epicDiscardChoices();
      contentEl.innerHTML = `
        ${renderTopbar()}
        <div class="screen rest-screen">
          <div class="tier-tag">에픽 ${heldAbyssEpics().length}/${epicHoldCap()}장 · 첫째 걸음</div>
          <h3 style="margin:0;">무엇을 두고 갈까</h3>
          <p class="af-flavor">심연은 셋을 손에 남기지 않는다.
            하나를 두고 오면, 다음 걸음에서 그 무게가 남은 것에 얹힌다.</p>
          <div class="relic-offer">
            ${choices.map(ch=>cardBox(ch.card, {incoming:ch.incoming, action:'epic-discard', defId:ch.defId})).join('')}
          </div>
        </div>`;
      return;
    }

    /* 두 걸음째 — 남은 것 중 하나를 깊게 한다 */
    const held = heldAbyssEpics();
    const usable = held.filter(canAbsorbInto);
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="tier-tag">에픽 ${held.length}/${epicHoldCap()}장 · 둘째 걸음</div>
        <h3 style="margin:0;">무엇을 깊게 할까</h3>
        <p class="af-flavor">${ab.gone ? `${eul(ab.gone)} 두고 왔다. ` : ''}그 무게를 얹을 자리를 고른다.</p>
        <div class="relic-offer">
          ${held.map(c=>{
            const ok = canAbsorbInto(c);
            const preview = ok ? previewUpgradeCard(c) : null;
            return cardBox(c, {
              action: ok ? 'epic-absorb' : null, defId: c.defId, locked: !ok,
              note: preview ? `<b>얹은 뒤:</b> ${describeCard(preview)}` : '',
              lockNote: '이 에픽은 더 깊어질 수 없다.',
            });
          }).join('')}
        </div>
        ${usable.length ? '' : '<div class="af-hint">남은 에픽이 모두 강화 불가라 얹을 곳이 없다.</div>'}
        <button class="btn" data-action="epic-absorb">${usable.length ? '얹지 않고 나간다' : '나간다'}</button>
      </div>`;
  }

  /* 셋째 걸음 — 두고 온 무게가 실제로 얹힌 결과를 보여 준다. 전투 보상 중
     넘친 에픽이 조용히 다른 카드 속으로 사라지지 않고, 무엇이 얼마나 깊어졌는지
     강화·합성 결과 화면과 같은 판으로 한 번 보여 준 뒤에야 원래 화면으로 돌아간다. */
  function renderEpicAbsorbResult(){
    const res = S.epicAbsorbResult;
    if(!res){ S.screen='map'; return renderMap(); }
    const card = res.card;
    const sparks = Array.from({length:12},(_,i)=>`<i class="reveal-spark" style="--i:${i}"></i>`).join('');
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen rest-screen">
        <div class="reveal-center">
          <div class="reveal-stage reveal-epic">
            <div class="reveal-banner">두고 온 무게가 카드에 얹혔다</div>
            <div class="reveal-card-wrap">
              <div class="card owner-${card.owner} ${cardVisualClass(card)} reveal-card">
                <div class="card-cost mono">${card.cost}</div>
                ${cardCategoryBadge(card)}
                <div class="card-name">${card.name}</div>
                <div class="card-desc">${describeCard(card)}</div>
                <div class="card-owner-tag">${cardRarityLabel(card) ? cardRarityLabel(card)+' · ' : ''}${ownerLabel(card.owner)}</div>
              </div>
              <div class="reveal-sparks" aria-hidden="true">${sparks}</div>
            </div>
            <div class="af-hint">+${res.before} → <b>+${upgradeLevel(card)}</b></div>
            <button class="btn primary" data-action="epic-absorb-result-confirm">계속하기</button>
          </div>
        </div>
      </div>`;
  }

  /* 자유 탐사의 해도. 지금은 빈 판에 점만 찍는다 —
     해도 그림이 나오면 .world-plate 의 배경만 그림으로 바꾸면 되고,
     점의 자리(WORLD_SITES 의 x·y)는 그대로 쓴다. */
  function renderWorldMap(){
    /* 해도에서 고른 지점이 곧 하단 버튼의 목적지다. 아직 아무것도 고르지 않았으면
       열려 있는 첫 지점을 기본으로 잡아, 버튼이 빈 이름으로 남지 않게 한다. */
    const openSites = WORLD_SITES.filter(worldSiteOpen);
    const picked = openSites.find(s=>s.tier===S.worldPick) || openSites[0] || null;
    const sites = WORLD_SITES.map(site=>{
      const open = worldSiteOpen(site);
      const th = tierThreat(site.tier);
      const ch = CHAPTERS.find(c=>c.tier===site.tier) || {length:0};
      const isPicked = !!picked && picked.tier===site.tier;
      return `
        <div class="world-site ${open?'':'locked'} ${isPicked?'picked':''}" style="left:${site.x};top:${site.y}"
             ${open?`data-action="world-pick" data-tier="${site.tier}"`:''}>
          <span class="world-pin" aria-hidden="true"></span>
          <span class="world-label">
            <b>${chapterDisplayName(site.tier)}</b>
            <small>${open ? `${ch.length}구역 · ${th.label.split(' · ')[0]}` : '아직 닿지 않았다'}</small>
            ${open ? `<small class="world-note">${site.note}</small>` : ''}
          </span>
        </div>`;
    }).join('');
    const party = (S.party||[]).filter(Boolean);
    const pickedName = picked ? chapterDisplayName(picked.tier) : '';
    const expTotal = expeditionCount();
    const rareMulPct = Math.round(expeditionRareMul()*100);
    const threatMulPct = Math.round(expeditionThreatMul()*100);
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen world-screen">
        <button class="btn world-return-btn" data-action="world-to-tavern">등대로 귀환하기</button>
        <div class="tier-tag">등대의 해도</div>
        <h3 style="margin:0;">어디로 내려갈까</h3>
        <div class="escape-note world-info-line">한 번 지나온 곳은 다시 열린다. 은신처에서 귀환하면 운반한 연료를 지킬 수 있다.</div>
        <div class="escape-note">심연 계위 <b>${abyssRank()}</b> · 심연의 열쇠 ${CHAPTERS.filter(ch=>hasAbyssKey(ch.tier)).length}/${CHAPTERS.length}${hasTrueEnding()?' · 다른 결말 확인함':''}</div>
        <div class="world-plate">${sites}<div class="world-stats">${picked ? `${pickedName} · ` : ''}누적 탐험 ${expTotal}회<br>위협 ${threatMulPct}% · 희귀 ${rareMulPct}%</div></div>
        <div class="escape-note world-info-line">${party.length
          ? `지금 대열 — ${party.map(p=>`${p.name} ${p.hp}/${p.maxHp}`).join(' · ')}`
          : '아직 대열이 없다. 첫 하강 전에 탐사대를 편성한다.'}</div>
        ${picked ? `
          <div class="world-descend-row">
            <button class="btn" data-action="fixed-tide-begin" data-tier="${picked.tier}">탐험설정</button>
            <button class="btn primary" data-action="foray-begin" data-tier="${picked.tier}">${pickedName}(으)로 내려간다</button>
          </div>
        ` : '<div class="escape-note">아직 열린 해역이 없다.</div>'}
      </div>`;
  }

  /* 잠수종 문을 닫기 전, 첫 숨과 서약 조항을 고르는 자리. 자유 탐사에만 있다 —
     본편 하강은 지금까지처럼 그대로 곧장 내려간다. */
  function renderPactSetup(){
    const forced = new Set(S.forcedClauses||[]);
    const active = new Set((S.pactClauses||[]).concat(S.forcedClauses||[]));
    const breathRows = FIRST_BREATH_DEFS.map(d=>`
      <div class="relic-opt ${S.firstBreath===d.id?'incoming':''}" data-action="pact-first-breath" data-id="${d.id}">
        <div class="relic-opt-head"><span>${d.name}</span></div>
        <div class="relic-boon">${d.boon}</div>
        <div class="relic-desc">대가: ${d.drawback}</div>
      </div>`).join('');
    const clauseRows = PACT_CLAUSE_DEFS.map(c=>{
      const on = active.has(c.id);
      const isForced = forced.has(c.id);
      return `<div class="relic-opt ${on?'incoming':''}" ${isForced?'':`data-action="pact-clause-toggle" data-id="${c.id}"`}>
        <div class="relic-opt-head"><span>${c.name}</span>${isForced?'<span class="relic-new">계위 강제</span>':''}</div>
        <div class="relic-boon">${c.desc}</div>
      </div>`;
    }).join('');
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen world-screen">
        <div class="tier-tag">잠수종 · 하강 준비</div>
        <h3 style="margin:0;">첫 숨</h3>
        <div class="escape-note">하강 전 딱 한 번 고른다. 이번 탐사에만 적용된다.</div>
        <div class="relic-offer">${breathRows}</div>
        <h3 style="margin:0;">서약 조항</h3>
        <div class="escape-note">위험을 더 걸수록(서약 심도 <b>${pactDepth()}</b>) 고래기름과 유물 인양 심도 확률이 오른다.</div>
        <div class="relic-offer">${clauseRows}</div>
        <button class="btn primary" data-action="pact-confirm">잠수종 문을 닫는다</button>
      </div>`;
  }

  /* 한 번의 탐사가 닫힌 자리 — 줄을 잡고 올라왔거나, 층을 끝까지 밀었거나. */
  function renderForayResult(){
    const r = S.forayResult;
    if(!r){ S.screen='worldMap'; return renderWorldMap(); }
    const returned = r.reason==='returned';
    contentEl.innerHTML = `
      ${renderTopbar()}
      <div class="screen result-screen foray-screen">
        <div class="title-en">${returned ? 'Hauled Up' : 'Swept Clear'}</div>
        <h2 style="margin:0;">${returned ? '줄을 잡고 올라왔다' : `${chapterDisplayName(r.tier)}을(를) 끝까지 밀었다`}</h2>
        <div class="escape-note">${returned
          ? '더 내려갈 수 있었지만, 쥔 것을 지키기로 했다.'
          : '이 층에서 더 건질 것은 없다. 다음은 더 아래이거나, 다시 여기다.'}</div>
        <div class="result-list mono">
          탐사 구역: ${chapterDisplayName(r.tier)}<br>
          지나온 노드: ${r.nodes}칸<br>
          늘어난 카드: ${r.cards}장<br>
          새 유물: ${r.relics.length ? r.relics.join(' · ') : '없음'}<br>
          올라올 때 잠식: ${r.erosion}%
          ${r.fallen.length ? `<br><span class="dp">돌아오지 못한 사람: ${r.fallen.join(' · ')}</span>` : ''}
        </div>
        ${r.farmRun && r.farmGained ? `<div class="escape-note">고정 조수 파밍 · 이번 획득 기름 ${r.farmGained.oil} · 잔향 ${r.farmGained.echoes} · 촉매 ${r.farmGained.catalysts}<br>누적 ${r.farmTotals.runs}회 · 기름 ${r.farmTotals.oilTotal} · 잔향 ${r.farmTotals.echoesTotal} · 촉매 ${r.farmTotals.catalystsTotal}</div>` : ''}
        ${r.rankAdvanced ? `<div class="escape-note">심연 계위가 올랐다 — 이제 계위 ${abyssRank()}.</div>` : ''}
        ${(r.imprintsGranted||[]).length ? `<div class="escape-note">${r.imprintsGranted.map(g=>`${g.hero}에게 각인 「${g.imprint.name}」이 남았다.`).join(' ')}</div>` : ''}
        ${r.trueEnding && r.tier==='끝없는 심연' ? `<div class="escape-note dp">등대 아래의 문이 다른 방식으로 열렸다.</div>` : ''}
        ${S.relics.length ? `<div class="relic-tray">${S.relics.map(rc=>relicChip(rc)).join('')}</div>` : ''}
        <button class="btn primary" data-action="foray-to-world-map">해도로 돌아간다</button>
      </div>`;
  }

  /* 완주 화면. 인양 화면과 같은 판·같은 아이콘을 쓴다 — 둘 다 '수면으로 돌아온 자리' 이고,
     한쪽만 다르게 생기면 마지막 화면이 남의 화면처럼 보인다.
     escape-screen 을 함께 걸어 배경 원화와 여백을 그대로 물려받는다. */
  function renderResult(){
    const upgradedCount = S.runDeck.filter(c=>c.upgraded).length;
    const finalGrowth = S.finalGrowth || [];
    const markers = ownedMarkers();
    contentEl.innerHTML = `
      <div class="screen escape-screen result-screen">
        <img class="title-crest" src="${ART_CREST}" alt="">
        <div class="title-en">Recovered</div>
        <h2 style="margin:0;">심연의 꿈에서 돌아왔다</h2>
        <div class="escape-note">
          잠수종이 당겨진다. 이번에는 등대의 불빛이 먼저 당신을 알아본다.
        </div>
        ${finalGrowth.length ? `<div class="escape-growth">
          <div class="escape-growth-title">심연 생환 · 마지막 적응</div>
          ${finalGrowth.map(g=>`<div class="escape-growth-row"><span>${g.name} · 생환 ${g.descent}회</span><small>최대 체력 ×2 (${g.hpGain>0?'+':''}${g.hpGain}) · 회피/흘림 +${g.reactPct}%</small></div>`).join('')}
        </div>` : ''}
        ${markers.map(m=>`<div class="relic-card drop">
          <div class="drop-banner">관측 표식을 회수했다</div>
          <div class="relic-glyph"><img class="px" src="${m.asset}" alt="${m.name}" style="width:74px;height:74px;object-fit:contain;margin:auto;"></div>
          <div class="relic-name">${m.name}</div>
          <div class="relic-boon">영구 관측 기록 · ${markers.length}/${MARKER_DEFS.length}</div>
          <div class="relic-desc">${m.flavor}<br>상단의 관측 표식 탭에 보관된다.</div>
          ${markerRecall(m) ? `<div class="relic-recall">${markerRecall(m)}</div>` : ''}
        </div>`).join('')}
        ${S.relics.length ? `
          <div class="tier-tag">함께 올라온 것</div>
          <div class="relic-offer">
            ${S.relics.map(r=>`
              <div class="relic-opt readonly">
                <div class="relic-opt-head">${relicPortrait(r)}<span>${r.name}</span>${relicTier(r)}</div>
                <div class="relic-boon">${r.boon}</div>
                <div class="relic-desc">${r.flavor}</div>
              </div>`).join('')}
          </div>` : ''}
        <div class="result-list mono">
          최종 잠식도: ${Math.round(S.erosion)}%<br>
          회수한 관측물: ${S.relics.length}점<br>
          강화된 카드: ${upgradedCount}장<br>
          ${S.party.filter(p=>p).map(p=> `${p.name} — HP ${p.hp}/${p.maxHp} · 심도압박 ${Math.round(p.dp)}${p.collapsed?' (함몰 경험)':''}`).join('<br>')}
        </div>
        <div class="escape-note">인양은 성공했다. 다만 우리는 아무것도 건져 올리지 못했다.<br><b>무언가가 우리를 건져 올렸을 뿐이다.</b></div>
        <button class="btn primary" data-action="continue-after-victory">다시 등대를 지킨다</button>
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
        <h2 style="margin:0;">잠수 케이블을 붙잡았다</h2>
        <div class="result-list">${chapterDisplayName(ex.tier)}에서 비상 탈출에 성공했다. (성공 확률 ${Math.round(ex.chance*100)}%)<br>
          교전에서만 빠져나왔을 뿐, 하강은 끝나지 않았다.<br><br>
          <b>귀환:</b> ${names(ex.evacuees)}<br>
          <b>인양:</b> 전원 귀환<br><small>인양줄의 대가로 모든 대원이 현재 HP의 50%와 심도압박 50% 증가를 감당한다.</small>
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

  function renderSalvage(){
    const sv=S.salvage||{cards:[],selectedCards:[],relics:[],research:1,recoveredOil:0};
    const selected=new Set(sv.selectedCards||[]);
    const cards=sv.cards.map(card=>`<div class="relic-opt ${selected.has(card.uid)?'sel':''}" data-action="salvage-card" data-uid="${card.uid}"><div class="relic-opt-head"><span>${card.name||'미상 카드'}</span><span>${cardRarityLabel(card)||'일반'}${selected.has(card.uid)?' · 선택됨':''}</span></div><div class="relic-boon">${describeCard(card)}</div><div class="relic-desc">${ownerLabel(card.owner)}</div></div>`).join('');
    const relics=sv.relics.map(relic=>`<div class="relic-opt ${sv.selectedRelicId===relic.id?'sel':''}" data-action="salvage-relic" data-id="${relic.id}"><div class="relic-opt-head"><span>${relic.name}</span><span>${sv.selectedRelicId===relic.id?'선택됨':'유물'}</span></div><div class="relic-boon">${relic.boon}</div><div class="relic-desc">${relic.flavor}</div></div>`).join('');
    contentEl.innerHTML=`<div class="screen result-screen salvage-screen">
      <div class="title-en">The Last Letter</div><h2 style="margin:0;">인양줄이 남긴 마지막 편지</h2>
      <div class="result-list">${S.loseReason}<br><br>탐사대는 돌아오지 못했지만, 인양줄이 손에 남은 것들을 등대까지 끌어 올렸다.</div>
      <div class="tier-tag">마지막 전투의 카드덱 · ${selected.size}/3장 선택</div>
      <div class="relic-offer">${cards||'<div class="af-empty">회수할 카드가 없습니다.</div>'}</div>
      <div class="tier-tag">유물 · 하나 선택</div>
      <div class="relic-offer">${relics||'<div class="af-empty">회수할 유물이 없습니다.</div>'}</div>
      <div class="escape-note">등대 연구 포인트 +${sv.research||1} · 고래기름 ${sv.recoveredOil||0}개가 등대 연료고로 보내졌다. 숙소의 기본 전열은 빈 병과 없이 자동으로 채워졌다.</div>
      <button class="btn primary" data-action="salvage-confirm">편지를 등대로 보낸다</button>
    </div>`;
  }

  /* 같은 화면을 다시 그릴 때 스크롤 위치를 지켜준다.
     innerHTML 을 통째로 갈아끼우므로 그냥 두면 매번 맨 위로 튕기는데,
     덱 구성처럼 목록이 긴 화면에서는 아래쪽 카드를 고를 수가 없게 된다. */
  function screenKey(){
    return S.screen + (S.screen==='classSelect' ? ':'+S.setup.phase : '')
      + (S.screen==='maintenance' && S.maintenance ? ':'+S.maintenance.tab : '')
      + (S.screen==='residence' ? ':'+((S.residence&&S.residence.selectedIds)||[]).join(',') : '');
  }
  let lastScreenKey = null;
  function render(){
    const key = screenKey();
    const prev = contentEl.querySelector('.screen');
    const keepTop = (key===lastScreenKey && prev) ? prev.scrollTop : null;

    renderScreen();
    renderHud();
    /* 화면 전용 템플릿 안에 끼워 두면 그 화면이 아닐 때(다음 프레임에 다른 화면으로
       넘어간 경우 등) 조용히 사라져 버릴 수 있다 — render() 바깥에서 화면과
       상관없이 항상 얹어, 큐에 쌓인 안내가 반드시 뜨게 한다. */
    const combatGuideHtml = combatRuleGuidePanel();
    if(combatGuideHtml) contentEl.insertAdjacentHTML('beforeend', combatGuideHtml);
    const soleSurvivorHtml = soleSurvivorGuidePanel();
    if(soleSurvivorHtml) contentEl.insertAdjacentHTML('beforeend', soleSurvivorHtml);

    if(keepTop != null){
      const next = contentEl.querySelector('.screen');
      if(next) next.scrollTop = keepTop;
    }
    lastScreenKey = key;
    bgmSetTrack(bgmDesiredTrack());   /* 전투에 들고 나는 순간 음악도 함께 넘어간다 */
    bgmEnsureTitleAmbient();
    saveRun();
  }

  function renderScreen(){
    ensureAtmo(tierSlug(currentTier()));
    if(S.screen==='title'){
      /* 전투 튜토리얼·대화가 끝나기 전에 메뉴로 돌아오면 #say 레이어가
         타이틀 버튼 위에 남을 수 있다. 특히 모바일에서는 이 레이어가
         터치를 가로채므로 타이틀 진입 시 반드시 대화를 닫는다. */
      if(typeof sayStop==='function' && sayActive()) sayStop();
      renderTitle();
    }
    else if(S.screen==='opening') renderOpening();
    else if(S.screen==='prologueFall') renderPrologueFall();
    else if(S.screen==='prologueRecord') renderPrologueRecord();
    else if(S.screen==='classSelect') renderClassSelect();
    else if(S.screen==='map') renderMap();
    else if(S.screen==='battle') renderBattle();
    else if(S.screen==='rest') renderRest();
    else if(S.screen==='aftermath') renderAftermath();
    else if(S.screen==='escape') renderEscape();
    else if(S.screen==='returnCutscene') renderLighthouseReturnCutscene();
    else if(S.screen==='stageEntryCutscene') renderStageEntryCutscene();
    else if(S.screen==='maintenance') renderMaintenance();
    else if(S.screen==='institute') renderInstitute();
    else if(S.screen==='residence') renderResidence();
    else if(S.screen==='relicSwap') renderRelicSwap();
    else if(S.screen==='epicAbsorb') renderEpicAbsorb();
    else if(S.screen==='epicAbsorbResult') renderEpicAbsorbResult();
    else if(S.screen==='tavern') renderTavern();
    else if(S.screen==='result') renderResult();
    else if(S.screen==='worldMap') renderWorldMap();
    else if(S.screen==='pactSetup') renderPactSetup();
    else if(S.screen==='forayResult') renderForayResult();
    else if(S.screen==='emergencyExit') renderEmergencyExit();
    else if(S.screen==='gameover') renderGameOver();
    else if(S.screen==='salvage') renderSalvage();
    flushFx();   /* 카드가 새로 배치된 뒤라야 좌표를 잡을 수 있다 */
  }
