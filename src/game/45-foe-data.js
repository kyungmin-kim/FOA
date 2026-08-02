  /* 표층 몹 풀 — 표층 조우에서 무작위로 올라온다.
     서 있는 열이 곧 사거리이므로, 그 열에서 손이 닿는 놈만 후보가 된다
     (근접을 후열에 세우면 아무것도 못 하고 서 있게 된다).
     중층·심층 풀은 설계만 되어 있고 아직 자리가 없다 — 지금은 모든 층이 이 풀을 쓴다. */
  const FOE_SURFACE = [
    {name:'조수의 신도',       maxHp:26, atk:6, reach:'melee',  role:'skirmisher', icon:ICON_CULTIST},
    {name:'익사한 파수꾼',     maxHp:28, atk:7, reach:'melee',  role:'brute',      icon:ICON_WARDEN},
    {name:'그물에 걸린 순례자', maxHp:22, atk:5, reach:'melee',  role:'skirmisher', icon:ICON_PILGRIM},
    {name:'소금에 전 예언자',   maxHp:20, atk:4, reach:'mid',    role:'caster',     icon:ICON_PROPHET},
    /* 느리지만 묵직 — 웅크리는 빈도를 두 배로 */
    {name:'잠수종 속의 것',     maxHp:30, atk:6, reach:'melee',  role:'brute',      icon:ICON_BELLTHING,
     intentMod:{guard_up:2}, reactMod:{dodge:0.02, guard:0.30, riposte:0.18, rip:5}},
    {name:'눈먼 그물지기',     maxHp:22, atk:6, reach:'ranged', role:'sniper',     icon:ICON_NETKEEPER},
    {name:'녹슨 잠수복 순찰자', maxHp:27, atk:7, reach:'melee',  role:'brute',      icon:ICON_PATROLLER},
    /* 최약체지만 속삭임이 잦다 — 무작위 속삭임 가중치를 네 배로 */
    {name:'부유하는 익사체',   maxHp:18, atk:5, reach:'melee',  role:'skirmisher', icon:ICON_FLOATER,
     intentMod:{whisper_random:4}, reactMod:{dodge:0.22, guard:0.06, riposte:0.08, rip:3}},
  ];

  const FOE_ELITES = [
    {name:'감시자',            maxHp:36, atk:7, reach:'melee', role:'skirmisher', icon:ICON_WATCHER},
    /* 웅크린 다음 크게 친다 */
    {name:'쇠사슬 파수장',     maxHp:42, atk:8, reach:'melee', role:'brute',      icon:ICON_CHAINWARD,
     intentMod:{guard_up:3}},
    {name:'첫 번째 잠수복',    maxHp:40, atk:7, reach:'mid',   role:'caster',     icon:ICON_FIRSTSUIT},
    /* 속삭임 빈도 매우 높음 */
    {name:'아홉 눈의 조타수',  maxHp:38, atk:6, reach:'mid',   role:'caster',     icon:ICON_HELMSMAN,
     intentMod:{whisper_rear:2, whisper_random:2}},
    /* 삼킨 종을 울려 전열 전체를 친다 */
    {name:'종을 삼킨 자',      maxHp:44, atk:8, reach:'melee', role:'brute',      icon:ICON_BELLEATER,
     intentMod:{attack_all:3}},
    {name:'조수를 부르는 여사제', maxHp:34, atk:5, reach:'mid', role:'caster',    icon:ICON_PRIESTESS},
    /* 가장 단단하다 — 방어 위주 */
    {name:'강철 아가미',       maxHp:46, atk:9, reach:'melee', role:'warden',     icon:ICON_STEELGILL,
     reactMod:{dodge:0.03, guard:0.38, riposte:0.30, rip:6}},
    /* 약한 놈만 골라 끌어내린다. 원거리로 두면 전열에 세울 수 없어 중거리로 둔다 */
    {name:'익사시키는 자',     maxHp:40, atk:8, reach:'mid',   role:'sniper',     icon:ICON_DROWNER},
  ];
  const FOE_BOSS = {name:'꿈꾸는 손의 파수꾼', maxHp:72, atk:9, reach:'mid', role:'brute', icon:ICON_BOSS, kind:'boss', phase:1};

  /* 끝없는 심연의 토착자. 마지막 장에서는 기존 적과 이 풀을 섞어 무작위 조우를 만든다. */
  const FOE_ENDLESS = [
    {name:'사슬 끊는 자',     maxHp:64, atk:14, reach:'melee',  role:'brute',      icon:assetIcon('assets/minion-chain-severer.png'),
     intentMod:{attack_reach:2}, reactMod:{dodge:0.03, guard:0.20, riposte:0.20, rip:7}},
    {name:'흑조의 성가대',    maxHp:50, atk:10, reach:'mid',    role:'caster',     icon:assetIcon('assets/minion-black-tide-choir.png'),
     intentMod:{whisper_rear:3, whisper_random:3}},
    {name:'안구 갑각수',      maxHp:74, atk:12, reach:'melee',  role:'warden',     icon:assetIcon('assets/minion-ocular-carapace.png'),
     intentMod:{guard_up:3}, reactMod:{dodge:0.02, guard:0.42, riposte:0.24, rip:6}},
    {name:'침묵의 등불지기',  maxHp:52, atk:11, reach:'ranged', role:'sniper',     icon:assetIcon('assets/minion-silent-lamplighter.png'),
     intentMod:{whisper_rear:2, snipe_lowest:2}},
    {name:'심연의 낙하자',    maxHp:56, atk:15, reach:'ranged', role:'skirmisher', icon:assetIcon('assets/minion-abyss-diver.png'),
     intentMod:{double_attack_reach:2}, reactMod:{dodge:0.16, guard:0.05, riposte:0.16, rip:6}},
  ];
  const FOE_ENDLESS_BOSS = {
    name:'최심의 안식자 네루모르', hiddenName:'???', maxHp:180, atk:16,
    reach:'mid', role:'brute', icon:assetIcon('assets/boss-nemorum.png'), kind:'boss', phase:1,
    intentMod:{attack_all:2, attack_reach:2}, reactMod:{dodge:0.05, guard:0.24, riposte:0.26, rip:9},
  };

