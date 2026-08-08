  /* ============ CLASS DATA ============
     name 은 그 사람의 이름이고, className 은 병과다.

     전투 기록과 대사는 등대지기가 붙인 이름으로 부른다 — 심연은 이름을 따라 현실을
     흉내 내므로, 병과명과 개인명은 서로 다른 정보로 유지한다.
     병과는 '무엇을 하는 사람인가' 를 묻는 자리에서만 쓴다 — 편성 화면과 카드 소유 표시. */
  const CLASS_DEFS = {
    vanguard: {id:'vanguard', name:'아렌', className:'등대 수호병', reach:'melee',  tagline:'근접 · 철벽과 수호', maxHp:32, blurb:'놋쇠 잠수복 안에서 들려오는 두 번째 심장 소리를 무시하며 전열을 막아선다.'},
    chemist:  {id:'chemist',  name:'메라', className:'심연 약제사', reach:'mid',    tagline:'중거리 · 부식과 기동', maxHp:24, blurb:'바닷물에 섞인 검은 침전물을 약병에 담는다. 그것은 상처보다 기억을 먼저 녹인다.'},
    priest:   {id:'priest',   name:'오스', className:'역병 사제', reach:'mid',    tagline:'중거리 · 역병과 정화', maxHp:22, blurb:'기도가 등대 아래의 무언가에게 닿는다는 사실을 알면서도, 매번 다시 입을 연다.'},
    oracle:   {id:'oracle',   name:'시라', className:'심연 예언자', reach:'ranged', tagline:'원거리 · 저주와 예지', maxHp:20, blurb:'별자리 대신 검은 수면의 반사를 읽는다. 그 반사 속에서는 늘 누군가가 먼저 눈을 뜬다.'},
    /* 탐사 때마다 젖은 명패가 발견된다 — 그중 하나를 골라 데려간다.
       plate 는 그 사람 명패에 얽힌 사연이다. 등대 기지의 명패 장면에서 읽힌다. */
    hellion:  {id:'hellion',  name:'브란',      className:'작살광전사', reach:'melee',  tagline:'근접 · 광기와 화력', maxHp:28, blurb:'작살을 휘두를 때마다 자기 피가 아니라 심연의 맥박이 손잡이를 타고 오른다.',
               plate:'포경선 한 척이 통째로 사라진 해에 걸린 명패. 그런데 그는 작살을 쥔 채 혼자 떠올랐고, 손가락이 아직 펴지지 않는다. 조합은 묻을 것이 없어 명패를 걸었을 뿐이다. 자루에 대고 말을 건다 — 다시 내려갈 사람이면 누구든 상관없다고.'},
    robber:   {id:'robber',   name:'카쿠스',    className:'난파도굴꾼', reach:'ranged', tagline:'원거리 · 은신과 급소', maxHp:21, blurb:'침몰선의 금고보다, 안에서 자신을 부르던 목소리를 더 두려워한다.',
               plate:'애초에 걸린 적 없는 명패다. 어느 배에도 이름이 오르지 않았으니까. 이름 하나 남기려고 제 손으로 걸었다. 침몰선 사이의 길을 안다. 외투 안에서 무엇이 소리를 내는지만 묻지 않으면 따라온다.'},
    jester:   {id:'jester',   name:'다윗',      className:'진혼악사',   reach:'mid',    tagline:'중거리 · 진혼과 광란', maxHp:23, blurb:'물속에서도 멎지 않는 노래. 후렴마다 죽은 이들의 이름이 한 음절씩 늘어난다.',
               plate:'배가 가라앉고 삼 주 뒤, 수면에 반듯이 누워 노래하는 채로 발견되었다. 실종자 명부를 후렴으로 부른다. 요즘은 아직 살아 있는 사람의 이름이 한둘 섞인다.'},
  };
  /* 병과와 이름을 함께 세우는 자리에서 쓴다(편성 화면 · 카드 묶음 머리) */
  function classFullName(def){ return def ? `${def.className} ${def.name}` : ''; }
  /* 사제가 네크로맨서로 전직하면 병과 호칭만 바뀐다 — 카드·능력치는 그대로다 */
  function classNameFor(clsId){
    const def = CLASS_DEFS[clsId];
    if(!def) return '';
    if(clsId==='priest' && typeof hasNecromancer==='function' && hasNecromancer()) return '네크로맨서';
    return def.className;
  }

  /* 처음부터 손에 쥐고 시작하는 넷과, 탐사 순서대로 열리는 셋 */
  const BASE_CLASSES  = ['vanguard','chemist','priest','oracle'];
  const UNLOCKABLES   = ['hellion','robber','jester'];
  /* 중세 유럽권 이름을 한글로 옮긴 이름 풀. 1~5자 이름이 섞여 있으며,
     이름을 조합하지 않고 실제 이름 후보에서 뽑아 중세풍의 결을 유지한다. */
  const MEDIEVAL_CREW_NAMES = [
    '아','위','리','휴','엘','베른','로웬','오델','마르','휴고','에드','가엘','노엘','루카','발터','기욤','마티아','브리안','세드릭','로데릭','이졸데','잉그리드','아그네스','이사벨','마르셀','라그나','알드릭','에드윈','베아트릭스','엘레노어','마틸다','아델라이드','콘라드','프리드리히','발렌틴','도미니크','아나스타샤','크리스티안','제오르크','카타리나','알렉산더','마르가레타'
  ];
  function randomCrewName(taken){
    const used = new Set((taken||[]).filter(Boolean));
    for(let attempt=0; attempt<100; attempt++){
      const name = MEDIEVAL_CREW_NAMES[Math.floor(Math.random()*MEDIEVAL_CREW_NAMES.length)];
      if(!used.has(name)) return name;
    }
    return MEDIEVAL_CREW_NAMES[Math.floor(Math.random()*MEDIEVAL_CREW_NAMES.length)];
  }
  function randomResidentName(taken){ return randomCrewName(taken); }
