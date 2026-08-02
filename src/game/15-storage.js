  /* ============ 저장 계층 ============
     웹에서는 localStorage 를 쓴다. 다만 iOS 웹뷰의 localStorage 는 저장공간이
     모자라면 OS 가 지울 수 있어서, 앱으로 감쌀 때는 네이티브가 파일로 들고 있는 편이 안전하다.
     그래서 창구를 하나로 모아 두었다 — 네이티브 껍데기가 스크립트보다 먼저
     window.FOA_STORAGE = { get(k), set(k,v), remove(k) } 를 심어 두면 그쪽을 쓴다.

     쓰기가 통째로 막힌 곳(사파리 비공개 모드 등)에서는 메모리에만 들고 있는다 —
     그 판에서는 정상으로 굴러가고, 앱을 닫으면 사라진다. */
  const Store = (function(){
    const native = (typeof window !== 'undefined') && window.FOA_STORAGE;
    if(native && typeof native.get === 'function' && typeof native.set === 'function'){
      return Object.assign({ kind:'native', ok:true }, native);
    }
    const mem = {};
    let ok = true;
    return {
      kind:'local',
      get ok(){ return ok; },
      get(k){
        try{ const v = localStorage.getItem(k); if(v !== null) return v; }catch(e){ ok = false; }
        return (k in mem) ? mem[k] : null;
      },
      set(k, v){
        mem[k] = v;
        try{ localStorage.setItem(k, v); return true; }
        catch(e){ ok = false; return false; }
      },
      remove(k){
        delete mem[k];
        try{ localStorage.removeItem(k); }catch(e){ ok = false; }
      },
    };
  })();

  /* 해금은 런을 넘어 남는다 — 죽어도 한 번 만난 사람은 여관에 계속 앉아 있다. */
  const UNLOCK_KEY = 'fathom.unlocked.v1';
  /* 관측 표식은 일반 유물과 달리 런을 넘어 남는 세계 진행 기록이다.
     지금은 첫 구역의 표식만 획득할 수 있고, 나머지 둘은 후속 구역 확장용으로 보관한다. */
  const MARKER_KEY = 'fathom.markers.v1';
  const MARKER_DEFS = [
    {id:'black_tide_spine', name:'검은 조석의 척추', asset:'assets/marker-black-tide-spine.png', flavor:'심연이 처음 인간의 언어를 배운 곳에서 건져 올린 검은 척추.'},
    {id:'red_eye_gauge', name:'적안의 후심계', asset:'assets/marker-red-eye-gauge.png', flavor:'아직 닿지 않은 붉은 해류가 수면의 맥박을 재고 있다.'},
    {id:'nameless_star_chart', name:'무명성의 해도', asset:'assets/marker-nameless-star-chart.png', flavor:'별이 아니라, 별을 바라보는 어둠의 항로.'},
  ];
  function loadMarkers(){
    try{
      const ids = JSON.parse(Store.get(MARKER_KEY) || '[]');
      return Array.isArray(ids) ? ids.filter(id=>MARKER_DEFS.some(marker=>marker.id===id)) : [];
    }catch(e){ return []; }
  }
  let OWNED_MARKERS = loadMarkers();
  function ownedMarkers(){ return OWNED_MARKERS.map(id=>MARKER_DEFS.find(marker=>marker.id===id)).filter(Boolean); }
  function acquireMarker(id){
    const marker = MARKER_DEFS.find(entry=>entry.id===id);
    if(!marker || OWNED_MARKERS.indexOf(id)>=0) return null;
    OWNED_MARKERS.push(id);
    Store.set(MARKER_KEY, JSON.stringify(OWNED_MARKERS));
    return marker;
  }
  function markerRewardForChapter(chapterIndex){
    /* 첫 구역만 구현한다. 나머지 두 표식은 각자의 구역이 만들어질 때 연결한다. */
    return chapterIndex===0 ? acquireMarker('black_tide_spine') : null;
  }
  function loadUnlocks(){
    try{
      const arr = JSON.parse(Store.get(UNLOCK_KEY) || '[]');
      return Array.isArray(arr) ? arr.filter(id=>UNLOCKABLES.indexOf(id)>=0) : [];
    }catch(e){ return []; }
  }
  let UNLOCKED = loadUnlocks();
  function persistUnlocks(){ Store.set(UNLOCK_KEY, JSON.stringify(UNLOCKED)); }
  function isUnlocked(id){ return BASE_CLASSES.indexOf(id)>=0 || UNLOCKED.indexOf(id)>=0; }
  function unlockedClassIds(){ return Object.keys(CLASS_DEFS).filter(isUnlocked); }
  /* 인양할 때마다 아직 만나지 못한 사람들의 명패가 젖는다.
     순서는 조합이 정하지 않는다 — 누구를 데리고 내려갈지는 플레이어가 고른다.
     고르지 않은 사람은 "아직 덜 말랐다" — 다음 인양 때 다시 걸려 있다. */
  function unlockCandidates(){
    return UNLOCKABLES.filter(cid=>UNLOCKED.indexOf(cid)<0).map(cid=>CLASS_DEFS[cid]);
  }
  function takeUnlock(id){
    if(UNLOCKABLES.indexOf(id)<0 || UNLOCKED.indexOf(id)>=0) return null;
    UNLOCKED.push(id);
    persistUnlocks();
    return CLASS_DEFS[id];
  }

