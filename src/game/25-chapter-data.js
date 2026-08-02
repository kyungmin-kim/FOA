  /* ============ MAP DATA (chapters) ============
     세 번의 인양 뒤, 마지막에는 끝없는 심연으로 내려간다 —
     3·5·10 노드를 지나고, 최후의 심연은 보스까지 정확히 7노드다.
     구역이 길어져도 압박이 같도록 잠식 속도를 챕터마다 따로 잡는다. */
  const CHAPTERS = [
    {n:1, tier:'표층', length:3,  erosion:2.5,
     title:'첫 번째 하강', lead:'아직 빛은 닿는다. 하지만 수면의 반사가 당신보다 먼저 눈을 깜빡인다.'},
    {n:2, tier:'중층', length:5,  erosion:1.7,
     title:'두 번째 하강', lead:'빛이 옅어진다. 인양선은 멀어지고, 물속의 속삭임은 문장처럼 또렷해진다.'},
    {n:3, tier:'심해', length:10, erosion:0.8,
     title:'마지막 하강', lead:'되돌아갈 길은 없다. 이곳의 해류는 바다 밖이 아니라 더 깊은 꿈으로 흐른다.'},
    {n:4, tier:'끝없는 심연', length:7, erosion:0.55,
     title:'끝없는 심연', lead:'인양선은 끊겼다. 어둠은 공간이 아니라, 무언가가 꾸고 있는 꿈의 안쪽이다.'},
  ];
  /* 층위 난이도 — 적 풀 자체의 차이와 별개로, 모든 조우에 걸리는 압력 곡선이다.
     심연은 전용 강적의 기본 스탯에도 이 보정이 겹쳐 하드코어 구간이 된다. */
  const TIER_THREAT = {
    '표층':       {hp:1.00, atk:1.00, pressure:1.00, eliteHp:1.00, eliteAtk:1.00, bossHp:1.00, bossAtk:1.00, label:'위협 I · 기준 수치'},
    '중층':       {hp:1.28, atk:1.22, pressure:1.25, eliteHp:1.14, eliteAtk:1.12, bossHp:1.18, bossAtk:1.15, label:'위협 II · 적 체력 ×1.28 · 공격 ×1.22'},
    '심해':       {hp:1.68, atk:1.52, pressure:1.55, eliteHp:1.25, eliteAtk:1.25, bossHp:1.30, bossAtk:1.25, label:'위협 III · 적 체력 ×1.68 · 공격 ×1.52'},
    '끝없는 심연': {hp:1.45, atk:1.35, pressure:1.70, eliteHp:1.35, eliteAtk:1.25, bossHp:1.45, bossAtk:1.35, label:'위협 IV · 심연 개체 강화 · 압박 ×1.70'},
  };
  function tierThreat(tier){ return TIER_THREAT[tier] || TIER_THREAT['표층']; }
  function chapter(){ return CHAPTERS[Math.min(S.chapter, CHAPTERS.length-1)]; }
  function isFinalChapter(){ return S.chapter >= CHAPTERS.length-1; }

  const NODE_TEXT = {
    battle:[
      ['조우','가라앉은 예배당 잔해 속, 기도하던 형체가 당신의 이름을 부른다.'],
      ['조우','물살이 바뀐다. 앞쪽의 형체들은 당신이 오기 전부터 이쪽을 보고 있었다.'],
      ['회랑','무너진 회랑 너머, 벽의 눈들이 한꺼번에 이쪽으로 돌아선다.'],
      ['잔해','부서진 구조물 사이에 웅크린 것은, 당신의 걸음 수를 세고 있다.'],
    ],
    elite:[
      ['감시자','유난히 큰 형체가 길을 막는다. 그것의 안와에는 심연과 같은 어둠이 고여 있다.'],
      ['파수','다른 것들보다 머리 하나는 더 크다. 비켜 갈 길은 없고, 그것은 이미 당신을 기억한다.'],
    ],
    rest:[
      ['은신처','금 간 다이빙 벨 안에서 숨을 고른다. 유리 밖의 어둠이 천천히 호흡한다.'],
      ['기압실','녹슨 해치 안쪽. 잠시 숨을 돌릴 수 있지만, 벽 너머에서 누군가 같은 박자로 쉰다.'],
    ],
    treasure:[
      ['침몰선 잔해','부서진 선체 사이로 눈동자처럼 반짝이는 물건이 있다.'],
      ['유실물','조류에 밀려온 것들이 한곳에 모여 있다. 모두 당신이 잃어버릴 물건들이다.'],
    ],
    boss:[
      ['수문장','이 구역의 주인은 문을 지키지 않는다. 문 너머의 무언가가 당신을 들여다본다.'],
    ],
  };

  let nodeSeq = 0;
  const MAX_RESTS_PER_CHAPTER = 3;
  function restsInCurrentChapter(){
    return S.mapVisited.slice(Math.max(0, S.mapVisited.length-S.stepInChapter)).filter(node=>node && node.type==='rest').length;
  }
  function canOfferRest(){ return restsInCurrentChapter() < MAX_RESTS_PER_CHAPTER; }
  function makeNode(kind){
    const ch = chapter();
    const pool = NODE_TEXT[kind];
    const pick = pool[Math.floor(Math.random()*pool.length)];
    return {
      id:'n'+(nodeSeq++), tier:ch.tier,
      type: kind==='boss' ? 'battle' : kind,
      boss: kind==='boss',
      title:`${ch.tier} · ${pick[0]}`, desc:pick[1],
    };
  }
  function rollNodeKind(step){
    /* 어느 층이든 첫 갈림길은 조우만 놓는다. 첫 전투로 현재 덱과 대열을 확인한 뒤
       그 다음부터 휴식·회수·엘리트의 선택지를 열어 준다. */
    if(chapter().tier==='표층') return 'battle';
    if(step===0) return 'battle';
    /* 마지막 7노드는 회수나 임의 휴식 없이 전투로 압박한다.
       단, 엘리트 직후의 휴식은 기존의 안전 규칙을 지킨다. */
    if(chapter().tier==='끝없는 심연'){
      if(step >= chapter().length-2) return weighted([[72,'battle'],[28,'elite']]);
      return weighted([[58,'battle'],[42,'elite']]);
    }
    /* 엘리트 뒤에는 은신처 한 칸이 반드시 필요하다. 수문장 바로 앞에서 엘리트가
       뜨면 그 칸을 만들 수 없으므로, 마지막 두 일반 구간에서는 엘리트를 빼둔다. */
    if(step >= chapter().length-2) return canOfferRest() ? weighted([[55,'battle'],[27,'rest'],[18,'treasure']]) : weighted([[72,'battle'],[28,'treasure']]);
    return canOfferRest() ? weighted([[45,'battle'],[15,'elite'],[25,'rest'],[15,'treasure']]) : weighted([[53,'battle'],[22,'elite'],[25,'treasure']]);
  }
  /* 한 갈림길은 1~3개. 표층은 같은 '조우'만 주되 장소 문구를 달리해 선택지가
     반복된 카드처럼 보이지 않게 한다. 다른 층은 가능한 한 서로 다른 종류를 먼저 뽑는다. */
  function rollChoices(){
    const step = S.stepInChapter;
    const last = S.mapVisited[S.mapVisited.length-1];
    /* 보스급 보상과 정화를 마친 직후에는 다음 길을 흔들지 않는다. 반드시 숨을 고른다.
       수문장은 구역을 끝내므로 이 지점에 다시 돌아오지 않는다. */
    if(last && last.type==='elite' && canOfferRest()) return [makeNode('rest')];
    if(step >= chapter().length-1) return [makeNode('boss')];
    const count = 1 + Math.floor(Math.random()*3);
    const kinds = [];
    const seen = new Set();
    for(let i=0; i<count; i++){
      let kind = rollNodeKind(step);
      /* 표층은 조우만 허용한다. 그 밖의 층에서는 중복을 줄이되, 후보가 모자라면 허용한다. */
      if(chapter().tier!=='표층'){
        for(let tries=0; tries<8 && seen.has(kind); tries++) kind = rollNodeKind(step);
      }
      kinds.push(kind); seen.add(kind);
    }
    return kinds.map(makeNode);
  }

  /* ============ 잠식 ============
     0 에서 시작해 100 에 닿으면 끝난다. 회복 수단은 없다 — 한 방향으로만 흐르는 시계다.
     깊이 내려갈수록 번지는 속도가 빨라져서, 심층에서 시간을 끄는 대가가 커진다. */
  const EROSION_MAX  = 100;
  const EROSION_REST = 5;                       /* 은신처에서 숨을 고르는 값 */
  /* 전투 턴당 증가량. 정수로는 눈금이 너무 거칠어 소수로 쌓고 표시할 때만 반올림한다.
     전투 1회(12~15턴) ≈ 20~38%, 전투 3회짜리 런이면 75% 언저리에 닿는다. */
  function erosionRate(){ return chapter().erosion; }
  function addErosion(amount){
    S.erosion = Math.min(EROSION_MAX, S.erosion + amount * relicMul('erosionMul'));
    return S.erosion >= EROSION_MAX;
  }

