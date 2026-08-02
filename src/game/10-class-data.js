  /* ============ CLASS DATA ============ */
  const CLASS_DEFS = {
    vanguard: {id:'vanguard', name:'잠수 돌격병', reach:'melee',  tagline:'근접 · 철벽과 수호', maxHp:32, blurb:'놋쇠 잠수복 안에서 들려오는 두 번째 심장 소리를 무시하며 전열을 막아선다.'},
    chemist:  {id:'chemist',  name:'밀수 화학자', reach:'mid',    tagline:'중거리 · 부식과 기동', maxHp:24, blurb:'바닷물에 섞인 검은 침전물을 약병에 담는다. 그것은 상처보다 기억을 먼저 녹인다.'},
    priest:   {id:'priest',   name:'파문 사제',   reach:'mid',    tagline:'중거리 · 역병과 정화', maxHp:22, blurb:'신에게 파문당한 뒤, 기도가 바다 아래의 무언가에게 닿는다는 것을 알았다.'},
    oracle:   {id:'oracle',   name:'이단 예지자', reach:'ranged', tagline:'원거리 · 저주와 예지', maxHp:20, blurb:'별자리 대신 검은 수면의 반사를 읽는다. 그 반사 속에서는 늘 누군가가 먼저 눈을 뜬다.'},
    /* 인양할 때마다 여관 벽의 명패가 젖는다 — 그중 하나를 골라 데려간다.
       plate 는 그 사람 명패에 얽힌 사연이다. 여관의 「젖은 명패」 장면에서 읽힌다. */
    hellion:  {id:'hellion',  name:'작살 광인',   reach:'melee',  tagline:'근접 · 광기와 화력', maxHp:28, blurb:'작살을 휘두를 때마다 자기 피가 아니라 심연의 맥박이 손잡이를 타고 오른다.',
               plate:'포경선 한 척이 통째로 사라진 해에 걸린 명패. 그런데 그 여자는 작살을 쥔 채 혼자 떠올랐고, 손가락이 아직 펴지지 않는다. 조합은 묻을 것이 없어 명패를 걸었을 뿐이다. 자루에 대고 말을 건다 — 다시 내려갈 사람이면 누구든 상관없다고.'},
    robber:   {id:'robber',   name:'난파선 도굴꾼', reach:'ranged', tagline:'원거리 · 은신과 급소', maxHp:21, blurb:'침몰선의 금고보다, 안에서 자신을 부르던 목소리를 더 두려워한다.',
               plate:'애초에 걸린 적 없는 명패다. 어느 배에도 이름이 오르지 않았으니까. 이름 하나 남기려고 제 손으로 걸었다. 침몰선 사이의 길을 안다. 외투 안에서 무엇이 소리를 내는지만 묻지 않으면 따라온다.'},
    jester:   {id:'jester',   name:'익사자 악사', reach:'mid',    tagline:'중거리 · 진혼과 광란', maxHp:23, blurb:'물속에서도 멎지 않는 노래. 후렴마다 죽은 이들의 이름이 한 음절씩 늘어난다.',
               plate:'배가 가라앉고 삼 주 뒤, 수면에 반듯이 누워 노래하는 채로 발견되었다. 실종자 명부를 후렴으로 부른다. 요즘은 아직 살아 있는 사람의 이름이 한둘 섞인다.'},
  };

  /* 처음부터 손에 쥐고 시작하는 넷과, 인양 순서대로 열리는 셋 */
  const BASE_CLASSES  = ['vanguard','chemist','priest','oracle'];
  const UNLOCKABLES   = ['hellion','robber','jester'];

