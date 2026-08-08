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

  /* ============ 마지막 등대 · 밝기와 고래기름 ============
     밝기는 런 밖에 남는 전역 상태다. 고래기름은 탐사 중에는 S.fuelCargo 로 운반하고,
     안전한 귀환이 끝난 뒤에만 연료고로 옮긴다. 덱·유물과 분리된 메타 압박이다. */
  const LIGHTHOUSE_KEY = 'fathom.lighthouse.v1';
  const LIGHTHOUSE_MAX = 100;
  const LIGHTHOUSE_START = 78;
  const LIGHTHOUSE_DESCENT_COST = 5;
  function loadLighthouse(){
    try{
      const data=JSON.parse(Store.get(LIGHTHOUSE_KEY)||'null');
      return {
        brightness:Math.max(0,Math.min(LIGHTHOUSE_MAX,Number.isFinite(data&&data.brightness)?data.brightness:LIGHTHOUSE_START)),
        oil:Math.max(0,Math.floor(Number.isFinite(data&&data.oil)?data.oil:0)),
        delivered:Math.max(0,Math.floor(Number.isFinite(data&&data.delivered)?data.delivered:0)),
      };
    }catch(e){ return {brightness:LIGHTHOUSE_START,oil:0,delivered:0}; }
  }
  let LIGHTHOUSE = loadLighthouse();
  function saveLighthouse(){ Store.set(LIGHTHOUSE_KEY,JSON.stringify(LIGHTHOUSE)); }
  function lighthouseBrightness(){ return LIGHTHOUSE.brightness; }
  function lighthouseOil(){ return LIGHTHOUSE.oil; }
  function lighthouseStage(){
    const b=LIGHTHOUSE.brightness;
    return b>50?'밝음':b>10?'어두움':'매우 어려움';
  }
  function lighthouseDarkness(){ return 1-(LIGHTHOUSE.brightness/LIGHTHOUSE_MAX); }
  function lighthouseThreatMul(){
    const b=lighthouseBrightness();
    if(b<=10) return 1.55;
    if(b<=50) return 1.10 + ((50-b)/40)*0.35;
    return 0.88 + ((100-b)/50)*0.22;
  }
  function lighthouseErosionMul(){
    const b=lighthouseBrightness();
    if(b<=10) return 1.55;
    if(b<=50) return 1.08 + ((50-b)/40)*0.32;
    return 0.86 + ((100-b)/50)*0.20;
  }
  function lighthouseRareLootMul(){ return lighthouseBrightness()<=10 ? 2.5 : 1; }
  /* 밝을 때는 심연의 관측이 흐려져 미상 카드가 드물다.
     밝기 50을 경계로 아래 구간부터 출현 배율이 급격히 올라간다.
     '밝음' 구간(50 초과)은 원래 곡선의 절반으로 한 번 더 낮춘다. */
  function lighthouseUnknownMul(){
    const brightness=lighthouseBrightness();
    if(brightness>50) return (0.30 + ((100-brightness)/50)*0.70) * 0.5;
    return 1 + ((50-brightness)/50)*1.80;
  }
  function drainLighthouseForDescent(){
    LIGHTHOUSE.brightness=Math.max(0,LIGHTHOUSE.brightness-LIGHTHOUSE_DESCENT_COST);
    saveLighthouse();
  }
  function addWhaleOil(amount){
    const n=Math.max(0,Math.floor(Number(amount)||0));
    if(!n) return;
    LIGHTHOUSE.oil+=n;
    LIGHTHOUSE.delivered+=n;
    saveLighthouse();
  }
  function lightWithWhaleOil(amount){
    const n=Math.max(0,Math.min(LIGHTHOUSE.oil,Math.floor(Number(amount)||0)));
    if(!n) return 0;
    LIGHTHOUSE.oil-=n;
    LIGHTHOUSE.brightness=Math.min(LIGHTHOUSE_MAX,LIGHTHOUSE.brightness+n*4);
    saveLighthouse();
    return n;
  }
  function settleFuelCargo(){
    if(!S || !S.fuelCargo) return 0;
    const n=Math.max(0,Math.floor(S.fuelCargo));
    S.fuelCargo=0;
    addWhaleOil(n);
    return n;
  }

  /* ============ 인양보관함 ============
     런에서 들고 돌아온 재화와 고래기름을 등대 기지에 남겨 두는 영구 보관함이다.
     보관함에 넣은 재화도 정비실 비용으로 사용할 수 있지만, 다음 런으로 가져갈 수
     있는 양은 보관함 단계의 용량을 넘지 않는다. 기름은 등대에 바로 붓지 않고
     보관함에 넣어 둘 수도 있다. */
  const SALVAGE_LOCKER_KEY = 'fathom.salvage-locker.v1';
  const BASE_RESOURCE_KEY = 'fathom.base-resource.v1';
  const SALVAGE_LOCKER_CAPACITY = [
    {echoes:10,catalysts:1,oil:5}, {echoes:30,catalysts:2,oil:10},
    {echoes:45,catalysts:3,oil:15}, {echoes:65,catalysts:4,oil:20},
    {echoes:90,catalysts:5,oil:25}, {echoes:120,catalysts:6,oil:30},
    {echoes:155,catalysts:8,oil:40}, {echoes:195,catalysts:10,oil:50},
    {echoes:240,catalysts:12,oil:60}, {echoes:290,catalysts:14,oil:75},
    {echoes:350,catalysts:16,oil:90},
  ];
  function loadSalvageLocker(){
    try{
      const data=JSON.parse(Store.get(SALVAGE_LOCKER_KEY)||'null')||{};
      return {level:Math.max(0,Math.min(10,Math.floor(Number(data.level)||0)))};
    }catch(e){ return {level:0}; }
  }
  let SALVAGE_LOCKER=loadSalvageLocker();
  function saveSalvageLocker(){ Store.set(SALVAGE_LOCKER_KEY,JSON.stringify(SALVAGE_LOCKER)); }
  function loadBaseResource(){
    try{ const data=JSON.parse(Store.get(BASE_RESOURCE_KEY)||'null')||{}; return {echoes:Math.max(0,Math.floor(Number(data.echoes)||0)),catalysts:Math.max(0,Math.floor(Number(data.catalysts)||0))}; }
    catch(e){ return {echoes:0,catalysts:0}; }
  }
  let BASE_RESOURCE=loadBaseResource();
  function saveBaseResource(){ Store.set(BASE_RESOURCE_KEY,JSON.stringify(BASE_RESOURCE)); }
  function salvageLockerLevel(){ return SALVAGE_LOCKER.level; }
  function salvageLockerCapacity(){ return SALVAGE_LOCKER_CAPACITY[salvageLockerLevel()]; }
  function salvageLockerUpgradeCost(){ return salvageLockerLevel()>=10 ? 0 : 10 + salvageLockerLevel()*5; }
  function lockerEchoes(){ return Math.max(0,Math.floor(Number(S&&S.salvageLocker&&S.salvageLocker.echoes)||0)); }
  function lockerCatalysts(){ return Math.max(0,Math.floor(Number(S&&S.salvageLocker&&S.salvageLocker.catalysts)||0)); }
  function lockerOil(){ return Math.max(0,Math.floor(Number(S&&S.salvageLocker&&S.salvageLocker.oil)||0)); }
  function baseEchoes(){ return BASE_RESOURCE.echoes; }
  function baseCatalysts(){ return BASE_RESOURCE.catalysts; }
  function recoverSalvageLocker(rate){
    if(!S || !S.salvageLocker) return {echoes:0,catalysts:0,oil:0};
    const ratio=Math.max(0,Math.min(1,Number(rate)||0));
    const echoes=Math.floor(lockerEchoes()*ratio), catalysts=Math.floor(lockerCatalysts()*ratio), oil=Math.floor(lockerOil()*ratio);
    BASE_RESOURCE.echoes+=echoes; BASE_RESOURCE.catalysts+=catalysts; addWhaleOil(oil);
    S.salvageLocker={echoes:0,catalysts:0,oil:0}; saveBaseResource();
    return {echoes,catalysts,oil};
  }
  function upgradeSalvageLocker(){
    const cost=salvageLockerUpgradeCost();
    if(!cost || baseEchoes()<cost) return false;
    BASE_RESOURCE.echoes-=cost;
    SALVAGE_LOCKER.level=Math.min(10,SALVAGE_LOCKER.level+1);
    saveSalvageLocker(); saveBaseResource(); return true;
  }

  /* 해금은 런을 넘어 남는다 — 죽어도 한 번 만난 사람은 등대 기지에 남는다. */
  const UNLOCK_KEY = 'fathom.unlocked.v1';
  /* 관측 표식은 일반 유물과 달리 런을 넘어 남는 세계 진행 기록이다.
     첫 표식은 침몰한 항구 수문장 전투 후 등대와 탐사자의 흔적을 연결한다.
     나머지 둘은 후속 구역 확장용으로 보관한다. */
  const MARKER_KEY = 'fathom.markers.v1';
  /* 자유 탐사는 끝없는 심연을 끝까지 클리어한 뒤에만 열린다. */
  const WORLD_CLEAR_KEY = 'fathom.world-clear.v1';
  function hasWorldClear(){ return Store.get(WORLD_CLEAR_KEY) === '1'; }
  function markWorldClear(){ Store.set(WORLD_CLEAR_KEY, '1'); }
  const WORLD_RECORD_KEY = 'fathom.world-record.v1';
  function loadWorldRecord(){
    try{
      const data=JSON.parse(Store.get(WORLD_RECORD_KEY)||'null')||{};
      return {reached:Array.isArray(data.reached)?data.reached.filter(Number.isInteger):[],
              cleared:Array.isArray(data.cleared)?data.cleared.filter(Number.isInteger):[]};
    }catch(e){ return {reached:[],cleared:[]}; }
  }
  let WORLD_RECORD=loadWorldRecord();
  function saveWorldRecord(){ Store.set(WORLD_RECORD_KEY,JSON.stringify(WORLD_RECORD)); }
  function recordWorldStage(index, cleared){
    if(!Number.isInteger(index) || index<0) return;
    if(!WORLD_RECORD.reached.includes(index)) WORLD_RECORD.reached.push(index);
    if(cleared && !WORLD_RECORD.cleared.includes(index)) WORLD_RECORD.cleared.push(index);
    saveWorldRecord();
  }
  function hasWorldRecordStage(index){ return WORLD_RECORD.reached.includes(index); }
  function hasClearedWorldStage(index){ return WORLD_RECORD.cleared.includes(index); }
  function resetWorldRecord(){ Store.remove(WORLD_RECORD_KEY); WORLD_RECORD={reached:[],cleared:[]}; }

  const RESEARCH_KEY = 'fathom.lighthouse-research.v1';
  function researchPoints(){ return Math.max(0,Math.floor(Number(Store.get(RESEARCH_KEY)||0))); }
  function addResearchPoints(amount){
    const next=researchPoints()+Math.max(0,Math.floor(Number(amount)||0));
    Store.set(RESEARCH_KEY,String(next));
    return next;
  }
  function spendResearchPoints(amount){
    const cost=Math.max(0,Math.floor(Number(amount)||0));
    const cur=researchPoints();
    if(!cost || cur<cost) return false;
    Store.set(RESEARCH_KEY,String(cur-cost));
    return true;
  }
  /* 등대 연구소 — 재화를 연구 포인트로 환전한다. 촉매가 잔향보다 희귀하므로
     환율을 더 유리하게 둔다. */
  const RESEARCH_EXCHANGE = {echoes:{cost:8,gain:1}, catalysts:{cost:3,gain:1}};
  function researchExchangeInfo(kind){ return RESEARCH_EXCHANGE[kind] || null; }

  /* 불빛 사거리 — 연구 포인트로 넓힌다. 레벨마다 헬리온·로버·제스터를 순서대로 해금한다. */
  const LIGHT_RANGE_KEY = 'fathom.light-range.v1';
  const LIGHT_RANGE_MAX = 3;
  const LIGHT_RANGE_COST = [3,6,10];
  const LIGHT_RANGE_CLASS = ['hellion','robber','jester'];
  function lightRangeLevel(){ return Math.max(0,Math.min(LIGHT_RANGE_MAX,Math.floor(Number(Store.get(LIGHT_RANGE_KEY))||0))); }
  function lightRangeUpgradeCost(){ const lvl=lightRangeLevel(); return lvl<LIGHT_RANGE_MAX ? LIGHT_RANGE_COST[lvl] : 0; }
  function lightRangeNextClass(){ const lvl=lightRangeLevel(); return lvl<LIGHT_RANGE_MAX ? LIGHT_RANGE_CLASS[lvl] : null; }
  function unlockClassByRange(id){
    if(UNLOCKABLES.indexOf(id)<0 || UNLOCKED.indexOf(id)>=0) return false;
    UNLOCKED.push(id); persistUnlocks(); return true;
  }
  function upgradeLightRange(){
    const lvl=lightRangeLevel();
    if(lvl>=LIGHT_RANGE_MAX) return false;
    const cost=LIGHT_RANGE_COST[lvl];
    if(!spendResearchPoints(cost)) return false;
    Store.set(LIGHT_RANGE_KEY,String(lvl+1));
    const cls=LIGHT_RANGE_CLASS[lvl];
    if(cls) unlockClassByRange(cls);
    return true;
  }

  /* 사제 → 네크로맨서 2차 전직. 불빛 사거리를 끝까지 넓힌 뒤에만 열리는
     연구실의 마지막 단계 — 열리면 사제의 호칭이 바뀌고, 숙소 묘지에서
     죽은 대원을 되살릴 수 있게 된다. */
  const NECROMANCER_KEY = 'fathom.necromancer.v1';
  const NECROMANCER_COST = 20;
  function hasNecromancer(){ return Store.get(NECROMANCER_KEY)==='1'; }
  function canUnlockNecromancer(){ return !hasNecromancer() && lightRangeLevel()>=LIGHT_RANGE_MAX; }
  function unlockNecromancer(){
    if(!canUnlockNecromancer()) return false;
    if(!spendResearchPoints(NECROMANCER_COST)) return false;
    Store.set(NECROMANCER_KEY, '1');
    return true;
  }
  /* 묘지에서 대원 하나를 되살리는 값 — 희귀 재화인 심해 촉매를 쓴다 */
  const REVIVE_CATALYST_COST = 5;

  const LAST_LETTER_KEY = 'fathom.last-letter.v1';
  function loadLastLetter(){
    try{ const data=JSON.parse(Store.get(LAST_LETTER_KEY)||'null')||{}; return {cards:Array.isArray(data.cards)?data.cards:[], relic:data.relic||null}; }
    catch(e){ return {cards:[],relic:null}; }
  }
  function saveLastLetter(data){ Store.set(LAST_LETTER_KEY,JSON.stringify({cards:data.cards||[],relic:data.relic||null})); }
  function takeLastLetter(){ const data=loadLastLetter(); Store.remove(LAST_LETTER_KEY); return data; }
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
    /* 표식은 층을 넘길 때가 아니라 그 해역의 보스전 후에 나온다.
       첫 표식은 메아리의 여울에서 얻고, 두 번째 해역이 붙으면 각 보스 후에 이어진다. */
    return null;
  }
  /* 구버전 저장본과의 호환을 위해 남겨 둔 흔적 저장 키다. 새 프롤로그에서는 사용하지 않는다. */
  const CUTLINE_KEY = 'fathom.cutline.v1';
  function hasCutLine(){ return Store.get(CUTLINE_KEY) === '1'; }
  function markCutLine(){ Store.set(CUTLINE_KEY, '1'); }

  /* 프롤로그에서 무엇을 눈치챘는가. 이득도 손실도 아니고 기억이다 —
     세 이상 현상 중 본 것은, 나중에 그에 맞는 표식을 건질 때 한 줄로 되돌아온다.
     표식과 나란히 런을 넘어 남고, '새로운 탐색' 이 지울 때 함께 지워진다. */
  const WITNESS_KEY = 'fathom.witness.v1';
  const WITNESS_IDS = ['echo', 'blood', 'starlight'];
  function loadWitness(){
    try{
      const ids = JSON.parse(Store.get(WITNESS_KEY) || '[]');
      return Array.isArray(ids) ? ids.filter(id=>WITNESS_IDS.indexOf(id)>=0) : [];
    }catch(e){ return []; }
  }
  let WITNESSED = loadWitness();
  function sawWitness(id){ return WITNESSED.indexOf(id) >= 0; }
  function sayMark(id){
    if(WITNESS_IDS.indexOf(id) < 0 || WITNESSED.indexOf(id) >= 0) return;
    WITNESSED.push(id);
    Store.set(WITNESS_KEY, JSON.stringify(WITNESSED));
  }
  /* 표식 하나가 회수하는 이상 현상 — 프롤로그에서 본 사람에게만 한 줄이 더 붙는다 */
  const MARKER_WITNESS = {black_tide_spine:'echo', red_eye_gauge:'blood', nameless_star_chart:'starlight'};
  const WITNESS_RECALL = {
    echo:'그때 파수꾼이 대장의 말을 그대로 되뇌었다. 이것이 그 입이다.',
    blood:'그때 바닥의 피가 상처로 되돌아갔다. 이것이 그 맥박이다.',
    starlight:'그때 해저 아래에서 별과 닮은 불빛이 깜빡였다. 이것이 그 항로다.',
  };
  function markerRecall(marker){
    const id = marker && MARKER_WITNESS[marker.id];
    return id && sawWitness(id) ? WITNESS_RECALL[id] : null;
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

  /* ============ 심연 계위 ============
     자유 탐사를 서약 심도를 걸고 완주할 때마다 하나씩 올라가는 사다리다.
     계위가 오르면 그 단계의 조항이 다음부터 강제로 걸린다 — 껐다 켤 수 없다. */
  const ABYSS_RANK_KEY = 'fathom.abyss-rank.v1';
  function loadAbyssRank(){
    try{ const data=JSON.parse(Store.get(ABYSS_RANK_KEY)||'null')||{}; return Math.max(0,Math.floor(Number(data.rank)||0)); }
    catch(e){ return 0; }
  }
  let ABYSS_RANK = loadAbyssRank();
  function abyssRank(){ return ABYSS_RANK; }
  function advanceAbyssRank(){
    ABYSS_RANK += 1;
    Store.set(ABYSS_RANK_KEY, JSON.stringify({rank:ABYSS_RANK}));
    return ABYSS_RANK;
  }
  function resetAbyssRank(){ Store.remove(ABYSS_RANK_KEY); ABYSS_RANK = 0; }

  /* ============ 각인 ============
     귀환한 등대지기 개인에게 남는 영구 흔적이다. 캐릭터 id 를 키로 삼는 맵이라
     기존의 '전체 배열' 저장 패턴과는 모양이 다르다. */
  const IMPRINT_KEY = 'fathom.imprints.v1';
  function loadImprintMap(){
    try{
      const data=JSON.parse(Store.get(IMPRINT_KEY)||'null')||{};
      const out={};
      Object.keys(data).forEach(cid=>{ if(Array.isArray(data[cid])) out[cid]=data[cid].slice(); });
      return out;
    }catch(e){ return {}; }
  }
  let IMPRINT_MAP = loadImprintMap();
  function saveImprintMap(){ Store.set(IMPRINT_KEY, JSON.stringify(IMPRINT_MAP)); }
  function heroImprints(characterId){ return characterId && IMPRINT_MAP[characterId] ? IMPRINT_MAP[characterId].slice() : []; }
  function grantImprint(characterId, imprintId){
    if(!characterId || !imprintId) return false;
    const list = IMPRINT_MAP[characterId] || (IMPRINT_MAP[characterId]=[]);
    if(list.indexOf(imprintId)>=0) return false;
    list.push(imprintId);
    saveImprintMap();
    return true;
  }
  function removeImprint(characterId, imprintId){
    const list = IMPRINT_MAP[characterId];
    if(!list) return false;
    const idx = list.indexOf(imprintId);
    if(idx<0) return false;
    list.splice(idx,1);
    saveImprintMap();
    return true;
  }
  function resetImprints(){ Store.remove(IMPRINT_KEY); IMPRINT_MAP={}; }

  /* ============ 각성 카드 ============
     서약을 걸고 수문장을 처치할 때마다 그 자리에 있던 직업의 각성 진행도가 오른다.
     임계값에 닿으면 정비실에서 시그니처 카드를 각성판으로 바꿔 쓸 수 있다. */
  const AWAKENED_KEY = 'fathom.awakened.v1';
  const AWAKENED_THRESHOLD = 3;
  function loadAwakenedProgress(){
    try{
      const data=JSON.parse(Store.get(AWAKENED_KEY)||'null')||{};
      const out={};
      Object.keys(data).forEach(cls=>{ out[cls]=Math.max(0,Math.floor(Number(data[cls])||0)); });
      return out;
    }catch(e){ return {}; }
  }
  let AWAKENED_PROGRESS = loadAwakenedProgress();
  function saveAwakenedProgress(){ Store.set(AWAKENED_KEY, JSON.stringify(AWAKENED_PROGRESS)); }
  function awakenedProgress(classId){ return AWAKENED_PROGRESS[classId]||0; }
  function addAwakenedProgress(classId){
    AWAKENED_PROGRESS[classId] = (AWAKENED_PROGRESS[classId]||0) + 1;
    saveAwakenedProgress();
    return AWAKENED_PROGRESS[classId];
  }
  function isAwakenedUnlocked(classId){ return awakenedProgress(classId) >= AWAKENED_THRESHOLD; }
  function resetAwakenedProgress(){ Store.remove(AWAKENED_KEY); AWAKENED_PROGRESS={}; }

  /* ============ 심연의 열쇠 · 트루 엔딩 ============
     히든 갈림길마다 하나씩, 챕터 넷을 다 채우면 최심층에서 다른 결말로 이어진다. */
  const ABYSS_KEY_KEY = 'fathom.abyss-keys.v1';
  function loadAbyssKeys(){
    try{ const ids=JSON.parse(Store.get(ABYSS_KEY_KEY)||'[]'); return Array.isArray(ids)?ids:[]; }
    catch(e){ return []; }
  }
  let ABYSS_KEYS = loadAbyssKeys();
  function hasAbyssKey(tier){ return ABYSS_KEYS.indexOf(tier)>=0; }
  function markAbyssKeyFound(tier){ if(hasAbyssKey(tier)) return; ABYSS_KEYS.push(tier); Store.set(ABYSS_KEY_KEY, JSON.stringify(ABYSS_KEYS)); }
  function hasAllAbyssKeys(){ return CHAPTERS.every(ch=>hasAbyssKey(ch.tier)); }
  function resetAbyssKeys(){ Store.remove(ABYSS_KEY_KEY); ABYSS_KEYS=[]; }

  const TRUE_ENDING_KEY = 'fathom.true-ending.v1';
  function hasTrueEnding(){ return Store.get(TRUE_ENDING_KEY)==='1'; }
  function markTrueEnding(){ Store.set(TRUE_ENDING_KEY,'1'); }
  function resetTrueEnding(){ Store.remove(TRUE_ENDING_KEY); }

  /* 유일한 생존자 — 파티가 나머지를 잃고 혼자 남은 채로 수문장까지 넘겼을 때만 켠다 */
  const SOLE_SURVIVOR_KEY = 'fathom.sole-survivor.v1';
  function hasSoleSurvivorAchievement(){ return Store.get(SOLE_SURVIVOR_KEY)==='1'; }
  function markSoleSurvivorAchievement(){ Store.set(SOLE_SURVIVOR_KEY,'1'); }
  function resetSoleSurvivorAchievement(){ Store.remove(SOLE_SURVIVOR_KEY); }

  /* ============ 고정 조수 · 파밍 던전 ============
     원래는 하루 1회·날짜 시드 도전이었지만, 이제는 제한 없이 반복 진입하는
     파밍 구역이다. 지도는 매번 평범한 무작위로 새로 돌고, 남는 것은
     "몇 번 들어갔고 무엇을 얼마나 건졌는가"의 누적 기록뿐이다. */
  const FIXED_TIDE_KEY = 'fathom.fixed-tide.v2';
  function loadFixedTide(){
    try{
      const data=JSON.parse(Store.get(FIXED_TIDE_KEY)||'null')||{};
      return {
        runs:Math.max(0,Math.floor(Number(data.runs)||0)),
        oilTotal:Math.max(0,Math.floor(Number(data.oilTotal)||0)),
        echoesTotal:Math.max(0,Math.floor(Number(data.echoesTotal)||0)),
        catalystsTotal:Math.max(0,Math.floor(Number(data.catalystsTotal)||0)),
      };
    }catch(e){ return {runs:0, oilTotal:0, echoesTotal:0, catalystsTotal:0}; }
  }
  let FIXED_TIDE = loadFixedTide();
  function fixedTideStats(){ return FIXED_TIDE; }
  function recordFixedTideRun(oil, echoes, catalysts){
    FIXED_TIDE.runs += 1;
    FIXED_TIDE.oilTotal += Math.max(0,Math.floor(Number(oil)||0));
    FIXED_TIDE.echoesTotal += Math.max(0,Math.floor(Number(echoes)||0));
    FIXED_TIDE.catalystsTotal += Math.max(0,Math.floor(Number(catalysts)||0));
    Store.set(FIXED_TIDE_KEY, JSON.stringify(FIXED_TIDE));
  }
  function resetFixedTide(){ Store.remove(FIXED_TIDE_KEY); FIXED_TIDE={runs:0, oilTotal:0, echoesTotal:0, catalystsTotal:0}; }

  /* ============ 자유 탐사 누적 횟수 ============
     고정 조수(파밍)만이 아니라 자유 탐사 전체(귀환·완주 모두)에서 성공적으로
     돌아올 때마다 오르는 총 횟수다. 이 숫자가 에픽·전설 드롭률과 위협 배율을
     함께 밀어 올리는 축이 된다 — 반복할수록 더 잘 주는 대신 더 위험해진다. */
  const EXPEDITION_COUNT_KEY = 'fathom.expedition-count.v1';
  function loadExpeditionCount(){
    try{ return Math.max(0,Math.floor(Number(Store.get(EXPEDITION_COUNT_KEY))||0)); }
    catch(e){ return 0; }
  }
  let EXPEDITION_COUNT = loadExpeditionCount();
  function expeditionCount(){ return EXPEDITION_COUNT; }
  function advanceExpeditionCount(){
    EXPEDITION_COUNT += 1;
    Store.set(EXPEDITION_COUNT_KEY, String(EXPEDITION_COUNT));
    return EXPEDITION_COUNT;
  }
  function resetExpeditionCount(){ Store.remove(EXPEDITION_COUNT_KEY); EXPEDITION_COUNT=0; }
