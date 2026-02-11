const timeSlots = ["清晨", "上午", "正午", "傍晚", "深夜"];
const dialAngles = [270, 342, 54, 126, 198];
const MOBILE_QUERY = "(max-width: 900px)";

const locations = [
  {
    name: "Dom Tower｜钟塔",
    desc: "钟塔的回响更像召唤",
    past: "若有石头与文件，可获得铃铛。",
    modern: "若有钥匙，可触发一次铃铛声。",
  },
  {
    name: "Dom Square｜广场",
    desc: "仿佛时间凝固",
    past: "本轮未获得物品：可使过去时间不前进。",
    modern: "本轮失去≥1物品：可触发一次铃铛声。",
  },
  {
    name: "Canal｜运河",
    desc: "石头最容易来，也最容易被冲走",
    past: "抽事件后：若有石头失去1；否则可获得1。",
    modern: "可选择获得1石头；若获得，对方时间+1。",
  },
  {
    name: "Museum｜博物馆",
    desc: "保存历史并不轻松",
    past: "抽事件后：若有文件必须弃1；否则无事发生。",
    modern: "可获得1文件；若已拥有≥2文件，立刻失去1件任意物品。",
  },
  {
    name: "Archive｜档案馆",
    desc: "档案不是奖励，是选择成本",
    past: "可将1石头换1文件；若无法，过去时间额外+1。",
    modern: "可将1文件换1钥匙；若不这样做，抽事件时物品效果无效。",
  },
  {
    name: "Workshop｜工坊",
    desc: "穿越永远不是免费的",
    past: "可穿越到现在（不带物品）；若这样做，下一轮不能再次穿越。",
    modern: "可穿越到过去（可带1物品）；若带物品穿越，现在时间+1。",
  },
];

const items = ["石头", "文件", "钥匙", "铃铛"];
const itemIcons = {
  石头: "🪨",
  文件: "📄",
  钥匙: "🔑",
  铃铛: "🔔",
};

const eventDeck = [
  {
    title: "钟尚未存在",
    text: "获得石头；若在Dom Tower则改为获得铃铛。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (state.location[team] === "Dom Tower｜钟塔") {
        addItem(team, "铃铛");
      } else {
        addItem(team, "石头");
      }
    },
  },
  {
    title: "工匠的第一块石料",
    text: "获得石头×2；若已有≥2石头则改为失去石头×1。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (countItem(team, "石头") >= 2) {
        removeOneItem(team, "石头");
        return;
      }
      addItem(team, "石头");
      addItem(team, "石头");
    },
  },
  {
    title: "误差",
    text: "选择一项：获得石头；或本轮过去时间不前进。若选石头，下次穿越必须不带物品。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.pendingChoice[team] = { type: "event_error_choice" };
      logEntry(`${label(team)}面对误差，需要做出选择。`);
    },
  },
  {
    title: "第一次敲击",
    text: "获得铃铛×1；可将此铃铛传送到现代时间线，若这样做过去时间+1。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      addItem(team, "铃铛");
      state.pendingChoice[team] = { type: "event_first_bell_choice" };
      logEntry(`${label(team)}可以将铃铛传送到现代时间线。`);
    },
  },
  {
    title: "没有记录的日子",
    text: "若有文件则失去1；否则获得石头×1。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (countItem(team, "文件") >= 1) {
        removeOneItem(team, "文件");
      } else {
        addItem(team, "石头");
      }
    },
  },
  {
    title: "水位上涨",
    text: "若在运河则获得石头×1；否则失去石头×1（若有）。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (state.location[team] === "Canal｜运河") {
        addItem(team, "石头");
      } else if (state.inventory[team].includes("石头")) {
        removeOneItem(team, "石头");
      }
    },
  },
  {
    title: "旧城塌陷",
    text: "可带1文件+1件其他物品穿越去现代。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      const hasFile = countItem(team, "文件") >= 1;
      const otherItems = state.inventory[team].filter((item) => item !== "文件");
      if (hasFile && otherItems.length) {
        state.pendingChoice[team] = { type: "event_oldcity_choice" };
        logEntry(`${label(team)}可带1文件+1件其他物品穿越去现代。`);
      } else {
        logEntry(`${label(team)}缺少文件或其他物品，无法穿越。`);
      }
    },
  },
  {
    title: "钟声被误解",
    text: "若在Dom Square则获得铃铛；否则本轮不能使用铃铛相关效果。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (state.location[team] === "Dom Square｜广场") {
        addItem(team, "铃铛");
      } else {
        setSilenced(team);
      }
    },
  },
  {
    title: "建造继续",
    text: "获得石头×1；若在Workshop，可立刻穿越（可带1件物品）。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      addItem(team, "石头");
      if (state.location[team] === "Workshop｜工坊") {
        state.pendingChoice[team] = { type: "event_build_continue_choice" };
        logEntry(`${label(team)}在工坊可立刻穿越。`);
      }
    },
  },
  {
    title: "城市记住了错误",
    text: "选择一项：失去石头×1；或传送1件物品到现代。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.pendingChoice[team] = { type: "event_city_error_choice" };
      logEntry(`${label(team)}面对记忆的错误，需要做出选择。`);
    },
  },
  {
    title: "准备完成",
    text: "若有石头与文件则获得铃铛或带1件物品穿越去现代；否则获得石头×1。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (countItem(team, "石头") >= 1 && countItem(team, "文件") >= 1) {
        state.pendingChoice[team] = { type: "event_memory_choice" };
        logEntry(`${label(team)}可以获得铃铛，或携带物品穿越去现代。`);
      } else {
        addItem(team, "石头");
      }
    },
  },
  {
    title: "时间留下的不是答案",
    text: "本轮过去时间不前进，但现在时间+1。",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.freeze.past = true;
      shiftTime("modern", 1);
    },
  },
  {
    title: "被整理的历史",
    text: "获得文件×1；若已有≥2文件则失去1件任意物品。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      const hadTwo = countItem(team, "文件") >= 2;
      addItem(team, "文件");
      if (hadTwo) {
        state.pendingChoice[team] = { type: "discard_any" };
      }
    },
  },
  {
    title: "记录不完整",
    text: "若有文件则失去1；否则本轮现在时间不前进。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (countItem(team, "文件") >= 1) {
        removeOneItem(team, "文件");
      } else {
        state.freeze.modern = true;
      }
    },
  },
  {
    title: "校准尝试",
    text: "若没有铃铛，则可穿越到过去（不带物品）。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (!hasBellAny(team)) {
        state.pendingChoice[team] = { type: "event_calibration_choice" };
        logEntry(`${label(team)}没有铃铛，可选择穿越到过去。`);
      }
    },
  },
  {
    title: "错误的解读",
    text: "若在博物馆或档案馆则失去文件×1；否则获得文件×1。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      const loc = state.location[team];
      if (loc === "Museum｜博物馆" || loc === "Archive｜档案馆") {
        removeOneItem(team, "文件");
      } else {
        addItem(team, "文件");
      }
    },
  },
  {
    title: "维护",
    text: "选择一项：现在时间+1；或失去1石头，换取对方时间线1件物品。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      state.pendingChoice[team] = { type: "event_maintenance_choice" };
      logEntry(`${label(team)}需要维护系统，做出取舍。`);
    },
  },
  {
    title: "时间差",
    text: "若时间同步则现在时间+2；否则现在时间不前进。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (state.time.modern === state.time.past) {
        shiftTime("modern", 2);
      } else {
        state.freeze.modern = true;
      }
    },
  },
  {
    title: "终于听见",
    text: "若有铃铛且本轮过去未触发铃铛，则可敲铃一次；否则本轮现在时间不前进。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (hasBellAny(team) && !state.bellTriggered.past) {
        ringBell(team);
      } else {
        state.freeze.modern = true;
      }
    },
  },
  {
    title: "理解带来的负担",
    text: "若文件≥3则现在时间+1；否则获得文件×1。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (countItem(team, "文件") >= 3) {
        shiftTime("modern", 1);
      } else {
        addItem(team, "文件");
      }
    },
  },
  {
    title: "修复失败",
    text: "本轮不能使用物品修改事件效果；若在工坊，可穿越（可带1件物品）。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      state.blockItemModsRound[team] = true;
      logEntry(`${label(team)}本轮物品无法修改事件效果。`);
      if (state.location[team] === "Workshop｜工坊") {
        state.pendingChoice[team] = { type: "event_fix_fail_choice" };
        logEntry(`${label(team)}在工坊可穿越到过去。`);
      }
    },
  },
  {
    title: "误以为已经完成",
    text: "若物品数量未对齐则失去1件任意物品；否则获得文件×1。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      const selfCount = state.inventory[team].length;
      const otherCount = state.inventory[otherTeam(team)].length;
      if (selfCount !== otherCount) {
        loseRandomItem(team);
      } else {
        addItem(team, "文件");
      }
    },
  },
  {
    title: "系统测试",
    text: "若有铃铛，可敲铃一次；若这样做，本轮现在时间+1。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (hasBellAny(team)) {
        state.pendingChoice[team] = { type: "event_system_test_choice" };
        logEntry(`${label(team)}可以进行系统测试。`);
      }
    },
  },
  {
    title: "访客",
    text: "若文件≥2则失去1；否则获得钥匙×1。",
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (countItem(team, "文件") >= 2) {
        removeOneItem(team, "文件");
      } else {
        addItem(team, "钥匙");
      }
    },
  },
];
const PAST_EVENT_COUNT = 12;
eventDeck.forEach((card, idx) => {
  card.targetTeam = idx < PAST_EVENT_COUNT ? "past" : "modern";
});

const state = {
  time: { modern: 0, past: 0 },
  location: { modern: null, past: null },
  inventory: { modern: [], past: [] },
  silenced: { modern: false, past: false },
  extraShift: { modern: 0, past: 0 },
  freeze: { modern: false, past: false },
  blockItemMods: { modern: false, past: false },
  inEvent: false,
  travelCooldown: { past: 0 },
  roundStats: { modern: { gained: 0, lost: 0 }, past: { gained: 0, lost: 0 } },
  nextFirst: "modern",
  log: [],
  phase: "modern_pick",
  lockBy: null,
  pendingChoice: { modern: null, past: null },
  winner: null,
  lastEvent: { modern: null, past: null },
  lastEventFocus: null,
  configured: false,
  totalPlayers: 4,
  teamSize: { modern: 2, past: 2 },
  playerPos: { modern: { modern: 2, past: 0 }, past: { modern: 0, past: 2 } },
  travelNoItem: { modern: false, past: false },
  noModifyNextEvent: { modern: false, past: false },
  eventDrawn: { modern: false, past: false },
  auto: { running: false, timer: null, interval: 1200 },
  bellTriggered: { modern: false, past: false },
  blockItemModsRound: { modern: false, past: false },
  totalDraws: 0,
  totalRounds: 0,
  beforeEventApplied: { modern: false, past: false },
};

const elements = {
  status: document.getElementById("status"),
  dialLabels: document.getElementById("dialLabels"),
  markerModern: document.getElementById("markerModern"),
  markerPast: document.getElementById("markerPast"),
  orbModern: document.getElementById("orbModern"),
  orbPast: document.getElementById("orbPast"),
  syncBadge: document.getElementById("syncBadge"),
  timeTrack: document.getElementById("timeTrack"),
  modernLocation: document.getElementById("modernLocation"),
  pastLocation: document.getElementById("pastLocation"),
  modernInventory: document.getElementById("modernInventory"),
  pastInventory: document.getElementById("pastInventory"),
  modernPlayers: document.getElementById("modernPlayers"),
  pastPlayers: document.getElementById("pastPlayers"),
  modernActions: document.getElementById("modernActions"),
  pastActions: document.getElementById("pastActions"),
  modernEffect: document.getElementById("modernEffect"),
  pastEffect: document.getElementById("pastEffect"),
  modernPanel: document.getElementById("modernPanel"),
  pastPanel: document.getElementById("pastPanel"),
  playGrid: document.getElementById("playGrid"),
  locationList: document.getElementById("locationList"),
  eventCards: document.getElementById("eventCards"),
  eventFocusCard: document.getElementById("eventFocusCard"),
  eventLog: document.getElementById("eventLog"),
  resetBtn: document.getElementById("resetBtn"),
  playerCountInput: document.getElementById("playerCountInput"),
  applyPlayersBtn: document.getElementById("applyPlayersBtn"),
  playerHint: document.getElementById("playerHint"),
  autoStatus: document.getElementById("autoStatus"),
  autoToggleBtn: document.getElementById("autoToggleBtn"),
  autoResetBtn: document.getElementById("autoResetBtn"),
  autoSteps: document.getElementById("autoSteps"),
  mobileNav: document.getElementById("mobileNav"),
};

function initDial() {
  elements.dialLabels.innerHTML = "";
  timeSlots.forEach((slot, i) => {
    const span = document.createElement("span");
    span.textContent = slot;
    span.style.transform = `rotate(${dialAngles[i]}deg) translate(0, -118px) rotate(-${dialAngles[i]}deg)`;
    elements.dialLabels.appendChild(span);
  });
}

function initTimeTrack() {
  if (!elements.timeTrack) return;
  elements.timeTrack.innerHTML = timeSlots
    .map(
      (slot, idx) => `
      <div class="time-cell" data-slot="${idx}">
        <div class="time-slot-label">${slot}</div>
        <div class="time-slot-bar"></div>
        <div class="time-slot-teams">
          <span class="time-team time-team-modern">现</span>
          <span class="time-team time-team-past">过</span>
        </div>
      </div>
    `
    )
    .join("");
}

function renderTimeTrack() {
  if (!elements.timeTrack) return;
  elements.timeTrack.querySelectorAll(".time-cell").forEach((cell) => {
    const idx = Number(cell.dataset.slot);
    const modernHere = state.time.modern === idx;
    const pastHere = state.time.past === idx;
    cell.classList.toggle("is-modern", modernHere);
    cell.classList.toggle("is-past", pastHere);
    cell.classList.toggle("is-both", modernHere && pastHere);
  });
}

function setMobileView(view) {
  const panels = document.querySelectorAll(".mobile-view");
  const tabs = elements.mobileNav ? elements.mobileNav.querySelectorAll(".mobile-tab") : [];
  const isMobile = window.matchMedia(MOBILE_QUERY).matches;

  tabs.forEach((btn) => {
    btn.classList.toggle("is-active", btn.dataset.view === view);
  });
  panels.forEach((panel) => {
    if (!isMobile) {
      panel.classList.remove("mobile-hidden");
      return;
    }
    panel.classList.toggle("mobile-hidden", panel.dataset.mobileView !== view);
  });
}

function initMobileViews() {
  const mq = window.matchMedia(MOBILE_QUERY);
  const onChange = () => {
    const active =
      elements.mobileNav && elements.mobileNav.querySelector(".mobile-tab.is-active")
        ? elements.mobileNav.querySelector(".mobile-tab.is-active").dataset.view
        : "play";
    setMobileView(active || "play");
  };
  if (elements.mobileNav) {
    elements.mobileNav.querySelectorAll(".mobile-tab").forEach((btn) => {
      btn.addEventListener("click", () => setMobileView(btn.dataset.view || "play"));
    });
  }
  if (mq.addEventListener) mq.addEventListener("change", onChange);
  else if (mq.addListener) mq.addListener(onChange);
  setMobileView("play");
}

function logEntry(text) {
  state.log.unshift({ text, ts: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) });
  if (state.log.length > 20) state.log.pop();
}

function otherTeam(team) {
  return team === "modern" ? "past" : "modern";
}

function addItem(team, item) {
  if (!canModifyItems(team)) {
    logEntry(`${label(team)}的物品效果被档案馆抑制。`);
    return;
  }
  state.inventory[team].push(item);
  state.roundStats[team].gained += 1;
  logEntry(`${label(team)}获得${item}。`);
}

function addItemIfMissing(team, item) {
  if (!state.inventory[team].includes(item)) addItem(team, item);
}

function addItemIfHas(team, need, give) {
  if (state.inventory[team].includes(need)) addItem(team, give);
}

function removeAllItem(team, item) {
  if (!canModifyItems(team)) {
    logEntry(`${label(team)}的物品效果被档案馆抑制。`);
    return;
  }
  const before = state.inventory[team].length;
  state.inventory[team] = state.inventory[team].filter((i) => i !== item);
  const lost = before - state.inventory[team].length;
  if (lost > 0) {
    state.roundStats[team].lost += lost;
    logEntry(`${label(team)}失去所有${item}。`);
  }
}

function removeOneItem(team, item) {
  if (!canModifyItems(team)) {
    logEntry(`${label(team)}的物品效果被档案馆抑制。`);
    return false;
  }
  const idx = state.inventory[team].indexOf(item);
  if (idx === -1) return false;
  state.inventory[team].splice(idx, 1);
  state.roundStats[team].lost += 1;
  logEntry(`${label(team)}失去${item}。`);
  return true;
}

function countItem(team, item) {
  return state.inventory[team].filter((i) => i === item).length;
}

function hasItem(team, item) {
  return state.inventory[team].includes(item);
}

function hasBellAny(team) {
  return state.inventory[team].includes("铃铛");
}

function hasBasicSupplies() {
  const hasAll = (team) =>
    hasItem(team, "石头") && hasItem(team, "文件") && hasItem(team, "钥匙");
  return hasAll("modern") && hasAll("past");
}

function loseRandomItem(team) {
  if (!canModifyItems(team)) {
    logEntry(`${label(team)}的物品效果被档案馆抑制。`);
    return;
  }
  const inv = state.inventory[team];
  if (!inv.length) return;
  const idx = Math.floor(Math.random() * inv.length);
  const [lost] = inv.splice(idx, 1);
  state.roundStats[team].lost += 1;
  logEntry(`${label(team)}失去${lost}。`);
}

function duplicateItem(team) {
  if (!canModifyItems(team)) {
    logEntry(`${label(team)}的物品效果被档案馆抑制。`);
    return;
  }
  const inv = state.inventory[team];
  if (!inv.length) return;
  const pick = inv[Math.floor(Math.random() * inv.length)];
  addItem(team, pick);
}

function tradeItem(team) {
  const inv = state.inventory[team];
  if (!inv.length) return;
  const idx = Math.floor(Math.random() * inv.length);
  const [given] = inv.splice(idx, 1);
  state.roundStats[team].lost += 1;
  logEntry(`${label(team)}将${given}交给对方。`);
  addItem(otherTeam(team), given);
}

function shiftTime(team, delta) {
  state.time[team] = (state.time[team] + delta + timeSlots.length) % timeSlots.length;
  logEntry(`${label(team)}时间移动${delta > 0 ? "+" : ""}${delta}。`);
}

function syncTime(team) {
  state.time[team] = state.time[otherTeam(team)];
  logEntry(`${label(team)}与对方时间同步。`);
}

function swapTime() {
  const tmp = state.time.modern;
  state.time.modern = state.time.past;
  state.time.past = tmp;
  logEntry("双方时间互换。");
}

function setSilenced(team) {
  state.silenced[team] = true;
  logEntry(`${label(team)}本轮无法敲铃。`);
}

function setNextFirst(team) {
  state.nextFirst = team;
  logEntry(`下一轮${label(team)}先行动。`);
}

function setExtraShift(team) {
  state.extraShift[team] = 1;
  logEntry(`${label(team)}下一次推进时间额外+1。`);
}

function setFreeze(team) {
  state.freeze[team] = true;
  logEntry(`${label(team)}本轮时间冻结。`);
}

function logPeek(team) {
  logEntry(`${label(team)}窥视对方背包：${state.inventory[otherTeam(team)].join("、") || "空"}。`);
}

function setLocationLock(team) {
  state.lockBy = team;
  logEntry(`${label(team)}在本轮锁定地点选择。`);
}

function endTurnEarly(team) {
  logEntry(`${label(team)}行动提前结束。`);
  endTurn(team);
}

function label(team) {
  return team === "modern" ? "现代组" : "过去组";
}

function drawEvent(team) {
  if (state.pendingChoice.modern || state.pendingChoice.past) return;
  const card = eventDeck[Math.floor(Math.random() * eventDeck.length)];
  const actorTeam = card.targetTeam || team;
  logEntry(`${label(team)}抽到事件：${card.title}（${card.text}）`);
  if (actorTeam !== team) {
    logEntry(`该事件由${label(actorTeam)}立即执行（不等待轮次）。`);
  }
  state.lastEvent[team] = card;
  state.lastEventFocus = { card, drawnBy: team, actorTeam };
  state.inEvent = true;
  if (state.noModifyNextEvent[team]) {
    state.blockItemMods[team] = true;
    state.noModifyNextEvent[team] = false;
    logEntry(`${label(team)}本次事件无法被修改。`);
  }
  card.effect(actorTeam);
  state.inEvent = false;
  state.blockItemMods[team] = false;
  applyLocationEffectAfterEvent(team);
  state.eventDrawn[team] = true;
  state.totalDraws += 1;
  if (state.extraShift[team]) {
    shiftTime(team, state.extraShift[team]);
    state.extraShift[team] = 0;
  }
}

function advanceTime(team) {
  if (state.freeze[team]) {
    state.freeze[team] = false;
    return;
  }
  shiftTime(team, 1);
}

function ringBell(team) {
  if (!hasBellAny(team)) {
    logEntry(`${label(team)}没有铃铛可用。`);
    return;
  }
  if (state.silenced[team]) {
    logEntry(`${label(team)}尝试敲铃，但被禁鸣。`);
    return;
  }
  state.bellTriggered[team] = true;
  if (!teamOnHomeTimeline(team)) {
    logEntry(`${label(team)}有人不在自己的时间线，无法获胜。`);
    return;
  }
  const opponent = otherTeam(team);
  const opponentDom =
    state.location[opponent] === "Dom Tower｜钟塔" || state.location[opponent] === "Dom Square｜广场";
  const sameTime = state.time[team] === state.time[opponent];
  if (opponentDom && sameTime) {
    state.winner = team;
    logEntry(`${label(team)}在钟塔回响中敲铃，胜利！`);
  } else {
    logEntry(`${label(team)}敲响铃铛，但条件不足。`);
  }
}

function pickLocation(team, locationName) {
  state.location[team] = locationName;
  logEntry(`${label(team)}选择地点：${locationName}。`);
}

function applyLocationEffectBeforeEvent(team) {
  const loc = state.location[team];
  if (!loc) return;
  if (loc === "Archive｜档案馆") {
    if (team === "past") {
      if (state.inventory.past.includes("石头")) {
        state.pendingChoice.past = { type: "archive_past_convert" };
        logEntry("过去组可在档案馆用石头换文件。");
      } else {
        shiftTime("past", 1);
        logEntry("过去组无法换取文件，时间额外+1。");
      }
    }
    if (team === "modern") {
      if (state.inventory.modern.includes("文件")) {
        state.pendingChoice.modern = { type: "archive_modern_convert" };
        logEntry("现代组可在档案馆用文件换钥匙。");
      } else {
        state.blockItemMods.modern = true;
        logEntry("现代组未换钥匙，本次抽事件物品效果无效。");
      }
    }
  }
  if (loc === "Workshop｜工坊") {
    if (team === "past") {
      if (state.travelCooldown.past > 0) {
        logEntry("过去组上轮已穿越，本轮无法再次穿越。");
        return;
      }
      state.pendingChoice.past = { type: "workshop_past_travel" };
      logEntry("过去组可穿越到现在（不带物品）。");
    }
    if (team === "modern") {
      state.pendingChoice.modern = { type: "workshop_modern_travel" };
      logEntry("现代组可穿越到过去（可带1件物品）。");
    }
  }
  if (loc === "Dom Tower｜钟塔") {
    if (team === "past" && state.inventory.past.includes("石头") && state.inventory.past.includes("文件")) {
      state.pendingChoice.past = { type: "domtower_past_bell" };
      logEntry("钟塔：过去组可获得铃铛。");
    }
    if (team === "modern" && state.inventory.modern.includes("钥匙")) {
      state.pendingChoice.modern = { type: "domtower_modern_ring" };
      logEntry("钟塔：现代组可触发一次铃铛声。");
    }
  }
}

function applyLocationEffectAfterEvent(team) {
  const loc = state.location[team];
  if (!loc) return;
  if (state.pendingChoice[team]) return;
  if (loc === "Canal｜运河") {
    if (team === "past") {
      if (state.inventory.past.includes("石头")) {
        removeOneItem("past", "石头");
      } else {
        state.pendingChoice.past = { type: "canal_past_gain" };
        logEntry("过去组可以在运河获得石头。");
      }
    }
    if (team === "modern") {
      state.pendingChoice.modern = { type: "canal_modern_gain" };
      logEntry("现代组可在运河取石头，但会推动过去时间+1。");
    }
  }
  if (loc === "Museum｜博物馆") {
    if (team === "past") {
      if (state.inventory.past.includes("文件")) {
        removeOneItem("past", "文件");
      } else {
        logEntry("过去组在博物馆没有文件可弃。");
      }
    }
    if (team === "modern") {
      const hadTwo = countItem(team, "文件") >= 2;
      addItem(team, "文件");
      if (hadTwo) {
        state.pendingChoice[team] = { type: "discard_any" };
      }
    }
  }
  if (loc === "Dom Square｜广场") {
    if (team === "past" && state.roundStats.past.gained === 0) {
      state.pendingChoice.past = { type: "domsquare_past_freeze" };
      logEntry("广场：过去组本轮未获得物品，可选择时间不前进。");
    }
    if (team === "modern" && state.roundStats.modern.lost >= 1) {
      state.pendingChoice.modern = { type: "domsquare_modern_ring" };
      logEntry("广场：现代组本轮失去物品，可触发一次铃铛声。");
    }
  }
  if (loc === "Dom Tower｜钟塔") return;
}

function hasPreEventLocationAction(team) {
  const loc = state.location[team];
  return loc === "Archive｜档案馆" || loc === "Workshop｜工坊" || loc === "Dom Tower｜钟塔";
}

function triggerPreEventLocationAction(team) {
  if (state.beforeEventApplied[team]) return;
  applyLocationEffectBeforeEvent(team);
  state.beforeEventApplied[team] = true;
}

function resetRound() {
  state.silenced.modern = false;
  state.silenced.past = false;
  state.bellTriggered.modern = false;
  state.bellTriggered.past = false;
  state.blockItemModsRound.modern = false;
  state.blockItemModsRound.past = false;
  state.lockBy = null;
  state.totalRounds += 1;
  if (state.travelCooldown.past > 0) state.travelCooldown.past -= 1;
  state.roundStats = { modern: { gained: 0, lost: 0 }, past: { gained: 0, lost: 0 } };
  state.phase = state.nextFirst === "modern" ? "modern_pick" : "past_pick";
}

function endTurn(team) {
  if (team === "modern") {
    advanceTime("modern");
    state.phase = "past_pick";
    return;
  }
  advanceTime("past");
  resetRound();
}

function enterEventPhase(team) {
  state.phase = team === "modern" ? "modern_event" : "past_event";
  state.eventDrawn[team] = false;
  state.beforeEventApplied[team] = false;
}

function locationSelectable(team, name) {
  const other = otherTeam(team);
  if (state.location[other] === name) return false;
  if (state.lockBy && state.lockBy !== team && state.location[other] === name) return false;
  return true;
}

function locationTimingLabel(name) {
  if (name === "Archive｜档案馆" || name === "Workshop｜工坊" || name === "Dom Tower｜钟塔") {
    return "前置可主动";
  }
  return "后置自动（事件后）";
}

function currentLocationEffect(team) {
  const name = state.location[team];
  if (!name) return "未翻开地点";
  const loc = locations.find((entry) => entry.name === name);
  if (!loc) return "待定";
  return team === "modern" ? loc.modern || "待定" : loc.past || "待定";
}

function render() {
  normalizeBells();
  elements.status.textContent = state.winner
    ? `钟声共振成功 · 抽卡${state.totalDraws}张 · 时间过${state.totalRounds}轮`
    : `回合阶段：${phaseLabel(state.phase)} · 时间同步：${state.time.modern === state.time.past ? "是" : "否"}`;

  renderPlayerStatus();
  renderAutoSteps();

  elements.markerModern.textContent = `现代 · ${timeSlots[state.time.modern]}`;
  elements.markerPast.textContent = `过去 · ${timeSlots[state.time.past]}`;
  if (elements.syncBadge) {
    const synced = state.time.modern === state.time.past;
    elements.syncBadge.textContent = synced ? "时间已同步" : "时间未同步";
    elements.syncBadge.classList.toggle("is-synced", synced);
  }
  if (elements.orbModern) {
    const synced = state.time.modern === state.time.past;
    const modernAngle = dialAngles[state.time.modern] + (synced ? -7 : 0);
    const modernRadius = synced ? 132 : 126;
    elements.orbModern.style.transform = `rotate(${modernAngle}deg) translate(0, -${modernRadius}px)`;
    elements.orbModern.classList.toggle("is-overlap", synced);
  }
  if (elements.orbPast) {
    const synced = state.time.modern === state.time.past;
    const pastAngle = dialAngles[state.time.past] + (synced ? 7 : 0);
    const pastRadius = synced ? 116 : 126;
    elements.orbPast.style.transform = `rotate(${pastAngle}deg) translate(0, -${pastRadius}px)`;
    elements.orbPast.classList.toggle("is-overlap", synced);
  }
  renderTimeTrack();

  elements.modernLocation.textContent = state.location.modern || "未选择";
  elements.pastLocation.textContent = state.location.past || "未选择";
  if (elements.modernEffect) elements.modernEffect.textContent = `当前地点效果：${currentLocationEffect("modern")}`;
  if (elements.pastEffect) elements.pastEffect.textContent = `当前地点效果：${currentLocationEffect("past")}`;

  elements.modernInventory.innerHTML = renderInventory(state.inventory.modern);
  elements.pastInventory.innerHTML = renderInventory(state.inventory.past);

  elements.locationList.innerHTML = locations
    .map((loc) => {
      const locked = state.location.modern === loc.name || state.location.past === loc.name;
      const who = state.location.modern === loc.name ? "现代组" : state.location.past === loc.name ? "过去组" : "";
      return `
        <div class="location ${locked ? "locked" : ""}">
          <div><strong>${loc.name}</strong></div>
          <div>${loc.desc}</div>
          <div class="logic">
            <div><span class="chip">过去</span>${loc.past || "待定"}</div>
            <div><span class="chip">现代</span>${loc.modern || "待定"}</div>
          </div>
          <div class="chip">结算：${locationTimingLabel(loc.name)}</div>
          ${who ? `<div class="chip">已被${who}翻开</div>` : ""}
        </div>
      `;
    })
    .join("");

  renderEventCard(elements.eventFocusCard, state.lastEventFocus);

  elements.eventLog.innerHTML = state.log
    .map((entry) => `<div class="log-entry">[${entry.ts}] ${entry.text}</div>`)
    .join("");

  elements.modernActions.innerHTML = renderActions("modern");
  elements.pastActions.innerHTML = renderActions("past");
  applyTeamFocus(getFocusTeam());

  bindActions();
}

function getFocusTeam() {
  if (state.pendingChoice.modern && !state.pendingChoice.past) return "modern";
  if (state.pendingChoice.past && !state.pendingChoice.modern) return "past";
  if (state.phase.startsWith("modern")) return "modern";
  if (state.phase.startsWith("past")) return "past";
  return null;
}

function applyTeamFocus(focusTeam) {
  const hasFocus = focusTeam === "modern" || focusTeam === "past";
  if (elements.playGrid) {
    elements.playGrid.dataset.focusTeam = hasFocus ? focusTeam : "";
  }
  [
    { team: "modern", panel: elements.modernPanel, actions: elements.modernActions },
    { team: "past", panel: elements.pastPanel, actions: elements.pastActions },
  ].forEach(({ team, panel, actions }) => {
    if (!panel || !actions) return;
    const active = hasFocus && focusTeam === team;
    const dim = hasFocus && focusTeam !== team;
    panel.classList.toggle("team-active", active);
    panel.classList.toggle("team-dim", dim);
    actions.classList.toggle("actions-muted", dim);
  });
}

function normalizeBells() {
  state.inventory.modern = state.inventory.modern.map((item) => (item === "铃铛(校准)" ? "铃铛" : item));
  state.inventory.past = state.inventory.past.map((item) => (item === "铃铛(校准)" ? "铃铛" : item));
}

function renderInventory(list) {
  if (!list.length) return '<span class="token">空</span>';
  const counts = { 石头: 0, 文件: 0, 钥匙: 0, 铃铛: 0 };
  list.forEach((item) => {
    if (counts[item] !== undefined) counts[item] += 1;
  });
  const order = ["石头", "文件", "钥匙", "铃铛"];
  return order
    .filter((item) => counts[item] > 0)
    .map((item) => {
      const count = counts[item];
      const icon = itemIcons[item] || item;
      return `
        <span class="token token-icon" title="${item}×${count}" aria-label="${item}×${count}">
          <span class="token-glyph">${icon}</span>
          <span class="token-count">${count}</span>
        </span>
      `;
    })
    .join("");
}

function renderPlayerStatus() {
  if (!elements.modernPlayers || !elements.pastPlayers) return;
  const m = state.playerPos.modern;
  const p = state.playerPos.past;
  elements.modernPlayers.textContent = `玩家：${state.teamSize.modern}（现代${m.modern} / 过去${m.past}）`;
  elements.pastPlayers.textContent = `玩家：${state.teamSize.past}（现代${p.modern} / 过去${p.past}）`;
}

function renderEventCard(target, payload) {
  if (!target) return;
  target.className = "event-card event-card--focus";
  if (!payload || !payload.card) {
    target.innerHTML = `
      <div class="event-meta">等待抽卡</div>
      <div class="event-title">尚未抽取</div>
      <div class="event-text">等待抽事件卡。</div>
    `;
    return;
  }
  const { card, drawnBy, actorTeam } = payload;
  const timeline = card.targetTeam === "past" ? "过去事件" : "现代事件";
  const toneClass = card.targetTeam === "past" ? "event-card--past" : "event-card--modern";
  const actorLabel = label(actorTeam);
  const drawLabel = label(drawnBy);
  target.classList.add(toneClass);
  target.innerHTML = `
    <div class="event-meta">${drawLabel}抽到 · ${actorLabel}执行 · <span class="event-tone">${timeline}</span></div>
    <div class="event-title">${card.title}</div>
    <div class="event-text">${card.text}</div>
  `;
}

function renderAutoSteps() {
  if (!elements.autoSteps) return;
  elements.autoSteps.querySelectorAll(".step").forEach((el) => {
    el.classList.toggle("active", el.dataset.step === state.phase);
  });
  if (elements.autoStatus) {
    elements.autoStatus.textContent = state.auto.running ? "运行中" : "已暂停";
  }
  if (elements.autoToggleBtn) {
    const resumeLabel = hasProgressState() ? "继续自动演示" : "开始自动演示";
    elements.autoToggleBtn.textContent = state.auto.running ? "暂停自动演示" : resumeLabel;
  }
}

function hasProgressState() {
  if (state.totalDraws > 0 || state.totalRounds > 0) return true;
  if (state.location.modern || state.location.past) return true;
  if (state.inventory.modern.length || state.inventory.past.length) return true;
  if (state.pendingChoice.modern || state.pendingChoice.past) return true;
  if (state.lastEventFocus) return true;
  if (state.time.modern !== 0 || state.time.past !== 0) return true;
  return false;
}

function renderActions(team) {
  const isModern = team === "modern";
  const canAct = !state.winner && ((isModern && state.phase.startsWith("modern")) || (!isModern && state.phase.startsWith("past")));
  const canPick = canAct && state.phase.endsWith("pick");
  const canEvent = canAct && state.phase.endsWith("event") && !state.eventDrawn[team];
  const canDoPreLocation = canEvent && !state.beforeEventApplied[team] && hasPreEventLocationAction(team);
  const canNext = canAct && (state.phase.endsWith("pick") || state.eventDrawn[team]);
  const pendingChoice = state.pendingChoice[team];
  const currentLoc = state.location[team];
  const timingHint = currentLoc ? `${currentLoc}：${locationTimingLabel(currentLoc)}` : null;

  if (!state.configured) {
    return `<div class="label">请先在上方设置玩家人数。</div>`;
  }

  if (pendingChoice) {
    return renderChoiceActions(team, pendingChoice);
  }

  return `
    ${timingHint ? `<div class="label">地点结算：${timingHint}</div>` : ""}
    <button class="btn" data-action="pick" data-team="${team}" ${canPick ? "" : "disabled"}>选择地点</button>
    <button class="btn alt" data-action="loc-effect" data-team="${team}" ${canDoPreLocation ? "" : "disabled"}>执行地点效果</button>
    <button class="btn alt" data-action="event" data-team="${team}" ${canEvent ? "" : "disabled"}>抽事件卡</button>
    <button class="btn ghost" data-action="next" data-team="${team}" ${canNext ? "" : "disabled"}>结束行动</button>
    ${canPick ? renderLocationButtons(team) : ""}
  `;
}

function phaseLabel(phase) {
  const map = {
    modern_pick: "现代选地点",
    modern_event: "现代抽事件",
    past_pick: "过去选地点",
    past_event: "过去抽事件",
    round_end: "回合结算",
  };
  return map[phase] || phase;
}

function bindActions() {
  elements.modernActions.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => handleAction(btn.dataset.action, "modern", btn.dataset);
  });
  elements.pastActions.querySelectorAll("button").forEach((btn) => {
    btn.onclick = () => handleAction(btn.dataset.action, "past", btn.dataset);
  });
}

function handleAction(action, team, data) {
  if (state.winner) return;
  if (state.auto.running) return;
  let handled = false;

  if (action === "choice") {
    handleChoice(team, data.choice, data.item);
    handled = true;
  } else if (action === "pick-location") {
    pickLocation(team, data.location);
    enterEventPhase(team);
    handled = true;
  } else if (action === "loc-effect") {
    if (!state.phase.endsWith("event") || state.eventDrawn[team]) return;
    triggerPreEventLocationAction(team);
    handled = true;
  } else if (action === "event") {
    if (state.eventDrawn[team]) return;
    drawEvent(team);
    handled = true;
  } else if (action === "bell") {
    ringBell(team);
    handled = true;
  } else if (action === "next") {
    endTurn(team);
    handled = true;
  } else if (action === "pick") {
    return;
  }

  if (handled) render();
}

function renderLocationButtons(team) {
  const choices = locations.filter((loc) => locationSelectable(team, loc.name));
  if (!choices.length) return "<div class=\"label\">没有可选地点</div>";
  return `
    <div class="label">可选地点</div>
    <div class="actions">
      ${choices
        .map(
          (loc) =>
            `<button class="btn ghost" data-action="pick-location" data-team="${team}" data-location="${loc.name}">${loc.name}</button>`
        )
        .join("")}
    </div>
  `;
}

function renderChoiceActions(team, choice) {
  if (choice.type === "canal_past_gain") {
    return `
      <div class="label">运河：没有石头，可选择获得1石头。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain">获得石头</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "canal_modern_gain") {
    return `
      <div class="label">运河：可获得1石头，但对方时间+1。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain">获得石头</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "museum_modern_gain") {
    return `
      <div class="label">博物馆：可获得1文件。若已有≥2文件，将弃1件物品。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain">获得文件</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "archive_past_convert") {
    return `
      <div class="label">档案馆：可将1石头转换为1文件。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="convert">转换</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不转换</button>
    `;
  }
  if (choice.type === "archive_modern_convert") {
    return `
      <div class="label">档案馆：可将1文件转换为1钥匙。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="convert">转换</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不转换</button>
    `;
  }
  if (choice.type === "workshop_past_travel") {
    return `
      <div class="label">工坊：可穿越到现在（不带物品）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel">穿越</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不穿越</button>
    `;
  }
  if (choice.type === "workshop_modern_travel") {
    const mustNoItem = state.travelNoItem[team];
    return `
      <div class="label">工坊：可穿越到过去${mustNoItem ? "（下次必须不带物品）" : ""}。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_no_item">不带物品</button>
      ${mustNoItem ? "" : `<button class="btn" data-action="choice" data-team="${team}" data-choice="travel_item">带1件物品</button>`}
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不穿越</button>
    `;
  }
  if (choice.type === "workshop_modern_item") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可带。</div>`;
    return `
      <div class="label">选择要带往过去的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "domsquare_past_freeze") {
    return `
      <div class="label">广场：可让过去时间本轮不前进。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="freeze">不前进</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "domsquare_modern_ring") {
    return `
      <div class="label">广场：可触发一次铃铛声（需有铃铛）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="ring">触发</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "domtower_past_bell") {
    return `
      <div class="label">钟塔：可获得铃铛。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain">获得铃铛</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "domtower_modern_ring") {
    return `
      <div class="label">钟塔：可触发一次铃铛声（需有铃铛）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="ring">触发</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "discard_any") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可弃。</div>`;
    return `
      <div class="label">请选择要弃掉的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="discard" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "event_maintenance_choice") {
    return `
      <div class="label">维护：选择现在时间+1，或失去1石头换取对方时间线1件物品。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="lose_stone">失去石头换物品</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="modern_plus">现在时间+1</button>
    `;
  }
  if (choice.type === "event_city_error_choice") {
    const items = state.inventory[team];
    return `
      <div class="label">城市记住了错误：选择失去1石头，或传送1件物品到现代。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="lose_stone">失去石头</button>
      ${items.length ? `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="send_item">传送物品</button>` : ""}
    `;
  }
  if (choice.type === "event_city_error_item") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可传送。</div>`;
    return `
      <div class="label">选择要传送到现代的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "event_oldcity_choice") {
    const others = state.inventory[team].filter((item) => item !== "文件");
    if (!others.length) return `<div class="label">没有可携带的其他物品。</div>`;
    return `
      <div class="label">旧城塌陷：选择携带的“另一件物品”，与1文件一起穿越到现代。</div>
      ${others
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">放弃穿越</button>
    `;
  }
  if (choice.type === "event_first_bell_choice") {
    return `
      <div class="label">第一次敲击：可将铃铛传送到现代时间线（过去时间+1）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="send_bell">传送铃铛</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="keep_bell">保留</button>
    `;
  }
  if (choice.type === "event_build_continue_choice") {
    return `
      <div class="label">建造继续：选择是否带1件物品穿越。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_no_item">不带物品</button>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_item">带1件物品</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不穿越</button>
    `;
  }
  if (choice.type === "event_build_continue_item") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可带。</div>`;
    return `
      <div class="label">选择要带往现代的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "event_fix_fail_choice") {
    return `
      <div class="label">修复失败：选择是否带1件物品穿越。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_no_item">不带物品</button>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_item">带1件物品</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不穿越</button>
    `;
  }
  if (choice.type === "event_calibration_choice") {
    return `
      <div class="label">校准尝试：可选择穿越到过去（不带物品）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_no_item">穿越</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">不穿越</button>
    `;
  }
  if (choice.type === "event_fix_fail_item") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可带。</div>`;
    return `
      <div class="label">选择要带往过去的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "event_memory_choice") {
    return `
      <div class="label">回忆：获得铃铛，或带1件物品穿越到现代。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain_bell">获得铃铛</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="travel_item">带物品穿越</button>
    `;
  }
  if (choice.type === "event_memory_item") {
    const items = state.inventory[team];
    if (!items.length) return `<div class="label">没有物品可带。</div>`;
    return `
      <div class="label">选择要带往现代的物品：</div>
      ${items
        .map(
          (item) =>
            `<button class="btn ghost" data-action="choice" data-team="${team}" data-choice="carry" data-item="${item}">${item}</button>`
        )
        .join("")}
    `;
  }
  if (choice.type === "event_system_test_choice") {
    return `
      <div class="label">系统测试：可敲铃一次（若执行，现代时间+1）。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="ring">敲铃</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="skip">跳过</button>
    `;
  }
  if (choice.type === "event_error_choice") {
    return `
      <div class="label">误差：选择获得1石头，或本轮过去时间不前进。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="gain_stone">获得石头</button>
      <button class="btn ghost" data-action="choice" data-team="${team}" data-choice="freeze_past">过去时间不前进</button>
    `;
  }
  return "";
}

function handleChoice(team, choice, item) {
  const pending = state.pendingChoice[team];
  if (!pending) return;
  if (pending.type === "canal_past_gain") {
    if (choice === "gain") addItem(team, "石头");
    if (choice === "skip") logEntry("过去组放弃在运河取石头。");
  }
  if (pending.type === "canal_modern_gain") {
    if (choice === "gain") {
      addItem(team, "石头");
      shiftTime(otherTeam(team), 1);
    }
    if (choice === "skip") logEntry("现代组放弃在运河取石头。");
  }
  if (pending.type === "museum_modern_gain") {
    if (choice === "gain") {
      const hadTwo = countItem(team, "文件") >= 2;
      addItem(team, "文件");
      if (hadTwo) {
        state.pendingChoice[team] = { type: "discard_any" };
        return;
      }
    }
    if (choice === "skip") logEntry("现代组放弃在博物馆取文件。");
  }
  if (pending.type === "archive_past_convert") {
    if (choice === "convert") {
      if (removeOneItem(team, "石头")) addItem(team, "文件");
    }
    if (choice === "skip") logEntry("过去组放弃在档案馆转换石头。");
  }
  if (pending.type === "archive_modern_convert") {
    if (choice === "convert") {
      if (removeOneItem(team, "文件")) addItem(team, "钥匙");
    }
    if (choice === "skip") {
      state.blockItemMods.modern = true;
      logEntry("现代组未换钥匙，本次抽事件物品效果无效。");
    }
  }
  if (pending.type === "workshop_past_travel") {
    if (choice === "travel") {
      state.time.past = state.time.modern;
      travelOne("past", "modern");
      state.travelCooldown.past = 2;
      state.travelNoItem.past = false;
      logEntry("过去组穿越到现在时间线。");
    }
    if (choice === "skip") logEntry("过去组放弃穿越。");
  }
  if (pending.type === "workshop_modern_travel") {
    if (choice === "travel_no_item") {
      state.time.modern = state.time.past;
      travelOne("modern", "past");
      state.travelNoItem.modern = false;
      logEntry("现代组穿越到过去时间线（未带物品）。");
    }
    if (choice === "travel_item") {
      if (state.travelNoItem.modern) {
        logEntry("现代组本次必须不带物品，无法携带穿越。");
        return;
      }
      if (state.inventory.modern.length) {
        state.pendingChoice[team] = { type: "workshop_modern_item" };
        return;
      }
      logEntry("现代组没有物品可带，穿越失败。");
    }
    if (choice === "skip") logEntry("现代组放弃穿越。");
  }
  if (pending.type === "workshop_modern_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        state.inventory.past.push(item);
        state.time.modern = state.time.past;
        shiftTime("modern", 1);
        travelOne("modern", "past");
        state.travelNoItem.modern = false;
        logEntry(`现代组带着${item}穿越到过去。`);
      }
    }
  }
  if (pending.type === "domsquare_past_freeze") {
    if (choice === "freeze") {
      state.freeze.past = true;
      logEntry("过去组在广场冻结时间推进。");
    }
    if (choice === "skip") logEntry("过去组放弃冻结时间。");
  }
  if (pending.type === "domsquare_modern_ring") {
    if (choice === "ring") {
      ringBell("modern");
    }
    if (choice === "skip") logEntry("现代组放弃触发铃铛声。");
  }
  if (pending.type === "domtower_past_bell") {
    if (choice === "gain") addItem("past", "铃铛");
    if (choice === "skip") logEntry("过去组放弃在钟塔取铃铛。");
  }
  if (pending.type === "domtower_modern_ring") {
    if (choice === "ring") {
      ringBell("modern");
    }
    if (choice === "skip") logEntry("现代组放弃触发铃铛声。");
  }
  if (pending.type === "discard_any") {
    if (choice === "discard") {
      removeOneItem(team, item);
    }
  }
  if (pending.type === "event_maintenance_choice") {
    if (choice === "lose_stone") {
    if (!removeOneItem(team, "石头")) {
      logEntry(`${label(team)}没有石头可失去。`);
    } else {
      tradeItem(otherTeam(team));
    }
  }
    if (choice === "modern_plus") {
      shiftTime("modern", 1);
    }
  }
  if (pending.type === "event_first_bell_choice") {
    if (choice === "send_bell") {
      if (removeOneItem(team, "铃铛")) {
        addItem("modern", "铃铛");
      }
      shiftTime("past", 1);
      logEntry(`${label(team)}将铃铛传送到现代时间线。`);
    }
    if (choice === "keep_bell") {
      logEntry(`${label(team)}保留铃铛。`);
    }
  }
  if (pending.type === "event_build_continue_choice") {
    if (choice === "travel_no_item") {
      if (team === "modern") {
        state.time.modern = state.time.past;
        travelOne("modern", "past");
      } else {
        state.time.past = state.time.modern;
        travelOne("past", "modern");
      }
      logEntry(`${label(team)}穿越（不带物品）。`);
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        logEntry(`${label(team)}没有物品可带。`);
      } else {
        state.pendingChoice[team] = { type: "event_build_continue_item" };
        return;
      }
    }
    if (choice === "skip") {
      logEntry(`${label(team)}放弃穿越。`);
    }
  }
  if (pending.type === "event_build_continue_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("modern", item);
        if (team === "modern") {
          state.time.modern = state.time.past;
          travelOne("modern", "past");
        } else {
          state.time.past = state.time.modern;
          travelOne("past", "modern");
        }
        logEntry(`${label(team)}带着${item}穿越。`);
      }
    }
  }
  if (pending.type === "event_fix_fail_choice") {
    if (choice === "travel_no_item") {
      state.time.modern = state.time.past;
      travelOne(team, "past");
      logEntry(`${label(team)}穿越到过去（不带物品）。`);
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        logEntry(`${label(team)}没有物品可带。`);
      } else {
        state.pendingChoice[team] = { type: "event_fix_fail_item" };
        return;
      }
    }
    if (choice === "skip") {
      logEntry(`${label(team)}放弃穿越。`);
    }
  }
  if (pending.type === "event_fix_fail_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("past", item);
        state.time.modern = state.time.past;
        travelOne(team, "past");
        logEntry(`${label(team)}带着${item}穿越到过去。`);
      }
    }
  }
  if (pending.type === "event_memory_choice") {
    if (choice === "gain_bell") {
      addItem(team, "铃铛");
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        logEntry(`${label(team)}没有物品可带。`);
      } else {
        state.pendingChoice[team] = { type: "event_memory_item" };
        return;
      }
    }
  }
  if (pending.type === "event_calibration_choice") {
    if (choice === "travel_no_item") {
      if (team === "modern") {
        state.time.modern = state.time.past;
      }
      travelOne(team, "past");
      logEntry(`${label(team)}穿越到过去（不带物品）。`);
    }
    if (choice === "skip") {
      logEntry(`${label(team)}放弃穿越。`);
    }
  }
  if (pending.type === "event_memory_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("modern", item);
        state.time.past = state.time.modern;
        travelOne("past", "modern");
        logEntry(`${label(team)}带着${item}穿越到现代。`);
      }
    }
  }
  if (pending.type === "event_system_test_choice") {
    if (choice === "ring") {
      ringBell(team);
      shiftTime("modern", 1);
    }
    if (choice === "skip") {
      logEntry(`${label(team)}放弃系统测试。`);
    }
  }
  if (pending.type === "event_error_choice") {
    if (choice === "gain_stone") {
      addItem(team, "石头");
      state.travelNoItem[team] = true;
      logEntry(`${label(team)}下次穿越必须不带物品。`);
    }
    if (choice === "freeze_past") {
      state.freeze.past = true;
      logEntry("过去时间本轮不前进。");
    }
  }
  if (pending.type === "event_city_error_choice") {
    if (choice === "lose_stone") {
      if (!removeOneItem(team, "石头")) {
        logEntry(`${label(team)}没有石头可失去。`);
      }
    }
    if (choice === "send_item") {
      if (!state.inventory[team].length) {
        logEntry(`${label(team)}没有物品可传送。`);
      } else {
        state.pendingChoice[team] = { type: "event_city_error_item" };
        return;
      }
    }
  }
  if (pending.type === "event_city_error_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("modern", item);
        logEntry(`${label(team)}将${item}传送到现代时间线。`);
      }
    }
  }
  if (pending.type === "event_oldcity_choice") {
    if (choice === "carry") {
      const removedFile = removeOneItem(team, "文件");
      const removedOther = removeOneItem(team, item);
      if (!removedFile || !removedOther) {
        if (removedOther) addItem(team, item);
        if (removedFile) addItem(team, "文件");
        logEntry(`${label(team)}物品不足，无法穿越。`);
      } else {
        addItem("modern", "文件");
        addItem("modern", item);
        state.time.past = state.time.modern;
        travelOne("past", "modern");
        logEntry(`${label(team)}带着文件与${item}穿越到现代。`);
      }
    }
    if (choice === "skip") {
      logEntry(`${label(team)}放弃旧城塌陷的穿越。`);
    }
  }
  state.pendingChoice[team] = null;
}

function canModifyItems(team) {
  if (!state.inEvent) return true;
  return !(state.blockItemMods[team] || state.blockItemModsRound[team]);
}

function requirePastPresence(team) {
  if (state.playerPos[team].past === 0) {
    logEntry(`${label(team)}无人处于过去，事件无效。`);
    return false;
  }
  return true;
}

function requireModernPresence(team) {
  if (state.playerPos[team].modern === 0) {
    logEntry(`${label(team)}无人处于现代，事件无效。`);
    return false;
  }
  return true;
}

function teamOnHomeTimeline(team) {
  if (team === "modern") {
    return state.playerPos.modern.modern === state.teamSize.modern;
  }
  return state.playerPos.past.past === state.teamSize.past;
}

function canWinNow(team) {
  const opponent = otherTeam(team);
  const opponentDom =
    state.location[opponent] === "Dom Tower｜钟塔" || state.location[opponent] === "Dom Square｜广场";
  const sameTime = state.time[team] === state.time[opponent];
  return hasBellAny(team) && opponentDom && sameTime && teamOnHomeTimeline(team);
}

function travelOne(team, toTimeline) {
  if (team === "modern") {
    if (toTimeline === "past" && state.playerPos.modern.modern > 0) {
      state.playerPos.modern.modern -= 1;
      state.playerPos.modern.past += 1;
      state.travelNoItem.modern = false;
      return;
    }
    if (toTimeline === "modern" && state.playerPos.modern.past > 0) {
      state.playerPos.modern.past -= 1;
      state.playerPos.modern.modern += 1;
      state.travelNoItem.modern = false;
    }
    return;
  }
  if (toTimeline === "modern" && state.playerPos.past.past > 0) {
    state.playerPos.past.past -= 1;
    state.playerPos.past.modern += 1;
    state.travelNoItem.past = false;
    return;
  }
  if (toTimeline === "past" && state.playerPos.past.modern > 0) {
    state.playerPos.past.modern -= 1;
    state.playerPos.past.past += 1;
    state.travelNoItem.past = false;
  }
}

function travelAll(team, toTimeline) {
  if (team === "modern") {
    const total = state.teamSize.modern;
    state.playerPos.modern.modern = toTimeline === "modern" ? total : 0;
    state.playerPos.modern.past = toTimeline === "past" ? total : 0;
    return;
  }
  const total = state.teamSize.past;
  state.playerPos.past.modern = toTimeline === "modern" ? total : 0;
  state.playerPos.past.past = toTimeline === "past" ? total : 0;
}

function applyPlayerCount(total) {
  const count = Math.max(1, Math.min(10, Math.floor(total)));
  const modern = Math.ceil(count / 2);
  const past = Math.floor(count / 2);
  state.totalPlayers = count;
  state.teamSize = { modern, past };
  state.playerPos = {
    modern: { modern, past: 0 },
    past: { modern: 0, past },
  };
  state.configured = true;
  logEntry(`玩家人数设定：现代组${modern}人，过去组${past}人。`);
}

function resetGame() {
  state.time = { modern: 0, past: 0 };
  state.location = { modern: null, past: null };
  state.inventory = { modern: [], past: [] };
  state.silenced = { modern: false, past: false };
  state.extraShift = { modern: 0, past: 0 };
  state.freeze = { modern: false, past: false };
  state.blockItemMods = { modern: false, past: false };
  state.inEvent = false;
  state.travelCooldown = { past: 0 };
  state.roundStats = { modern: { gained: 0, lost: 0 }, past: { gained: 0, lost: 0 } };
  state.nextFirst = "modern";
  state.lockBy = null;
  state.pendingChoice = { modern: null, past: null };
  state.phase = "modern_pick";
  state.winner = null;
  state.lastEvent = { modern: null, past: null };
  state.lastEventFocus = null;
  state.log = [];
  if (state.configured) {
    state.playerPos = {
      modern: { modern: state.teamSize.modern, past: 0 },
      past: { modern: 0, past: state.teamSize.past },
    };
  }
  state.travelNoItem = { modern: false, past: false };
  state.noModifyNextEvent = { modern: false, past: false };
  state.eventDrawn = { modern: false, past: false };
  state.bellTriggered = { modern: false, past: false };
  state.blockItemModsRound = { modern: false, past: false };
  state.beforeEventApplied = { modern: false, past: false };
  state.totalDraws = 0;
  state.totalRounds = 0;
  logEntry("新游戏开始。现代与过去同在清晨。\n");
  render();
}

initDial();
initTimeTrack();
initMobileViews();
resetGame();

elements.resetBtn.addEventListener("click", () => {
  stopAuto();
  resetGame();
});
elements.applyPlayersBtn.addEventListener("click", () => {
  const val = Number(elements.playerCountInput.value || 4);
  applyPlayerCount(val);
  resetGame();
});

function autoResolveChoice(team, pending) {
  const rushWinReady =
    hasBellAny("modern") && hasItem("modern", "钥匙") && teamOnHomeTimeline("modern") && teamOnHomeTimeline("past");
  const collectPhase = !hasBasicSupplies() && !rushWinReady;
  const slots = timeSlots.length;
  const deltaModern = (state.time.modern - state.time.past + slots) % slots;
  const pastAhead = deltaModern === 4;
  const modernAhead = deltaModern === 1;
  const pastAheadWide = deltaModern === 3 || deltaModern === 4;
  const timeSynced = state.time.modern === state.time.past;
  const opponentAtDom =
    state.location[otherTeam("modern")] === "Dom Tower｜钟塔" || state.location[otherTeam("modern")] === "Dom Square｜广场";
  const ringOpportunity =
    team === "modern" &&
    state.location.modern === "Dom Square｜广场" &&
    hasBellAny("modern") &&
    timeSynced &&
    opponentAtDom &&
    teamOnHomeTimeline("modern") &&
    hasBasicSupplies();
  const fastWinReady = rushWinReady && timeSynced;
  const stoneSafe =
    countItem(team, "石头") >= 2 || (team === "modern" ? hasItem("past", "石头") : hasItem("modern", "石头"));
  const fileSafe =
    countItem(team, "文件") >= 2 || (team === "modern" ? hasItem("past", "文件") : hasItem("modern", "文件"));
  const keySafe =
    countItem(team, "钥匙") >= 2 || (team === "modern" ? hasItem("past", "钥匙") : hasItem("modern", "钥匙"));
  const needModernStone = !hasItem("modern", "石头");
  const needModernFile = !hasItem("modern", "文件");
  const needModernKey = !hasItem("modern", "钥匙");
  const pickForModern = (items) => {
    if (!items.length) return null;
    if (!hasBellAny("modern") && items.includes("铃铛")) return "铃铛";
    if (needModernKey && items.includes("钥匙")) return "钥匙";
    if (needModernFile && items.includes("文件")) return "文件";
    if (needModernStone && items.includes("石头")) return "石头";
    if (items.includes("钥匙")) return "钥匙";
    if (items.includes("文件")) return "文件";
    if (items.includes("石头")) return "石头";
    return items[Math.floor(Math.random() * items.length)];
  };
  const hasUsefulForModern = (items) => {
    if (!items.length) return false;
    if (!hasBellAny("modern") && items.includes("铃铛")) return true;
    if (needModernKey && items.includes("钥匙")) return true;
    if (needModernFile && items.includes("文件")) return true;
    if (needModernStone && items.includes("石头")) return true;
    return false;
  };
  if (pending.type === "domsquare_modern_ring") {
    if (hasBellAny(team) && canWinNow(team)) return handleChoice(team, "ring");
    return handleChoice(team, "skip");
  }
  if (pending.type === "domtower_modern_ring") {
    if (hasBellAny(team) && canWinNow(team)) return handleChoice(team, "ring");
    return handleChoice(team, "skip");
  }
  if (pending.type === "canal_past_gain") return handleChoice(team, "gain");
  if (pending.type === "canal_modern_gain") {
    const needStone = !hasItem("modern", "石头") || !hasItem("past", "石头");
    if (rushWinReady) return handleChoice(team, "skip");
    if (needStone || (deltaModern >= 1 && deltaModern <= 3)) return handleChoice(team, "gain");
    if (!timeSynced && pastAhead) return handleChoice(team, "skip");
    return handleChoice(team, "gain");
  }
  if (pending.type === "museum_modern_gain") return handleChoice(team, rushWinReady ? "skip" : "gain");
  if (pending.type === "archive_past_convert") return handleChoice(team, "convert");
  if (pending.type === "archive_modern_convert") return handleChoice(team, rushWinReady ? "skip" : "convert");
  if (pending.type === "workshop_past_travel") return handleChoice(team, "skip");
  if (pending.type === "workshop_modern_travel") return handleChoice(team, "skip");
  if (pending.type === "workshop_modern_item") {
    const items = state.inventory[team];
    if (items.length) return handleChoice(team, "carry", items[Math.floor(Math.random() * items.length)]);
    return handleChoice(team, "skip");
  }
  if (pending.type === "domsquare_past_freeze") {
    if (pastAheadWide) return handleChoice(team, "freeze");
    return handleChoice(team, "skip");
  }
  if (pending.type === "domtower_past_bell") return handleChoice(team, "gain");
  if (pending.type === "discard_any") {
    const items = state.inventory[team];
    if (!items.length) return handleChoice(team, "skip");
    const other = otherTeam(team);
    const pick = items
      .slice()
      .sort((a, b) => {
        const score = (item) => {
          if (item === "铃铛") {
            if (team === "past" && !hasBellAny("modern")) return -10;
            return hasBellAny(team) && countItem(team, "铃铛") === 1 ? -10 : 1;
          }
          if (item === "石头") return (stoneSafe ? 3 : -3) + (hasItem(other, "石头") ? 2 : 0);
          if (item === "文件") return (fileSafe ? 3 : -3) + (hasItem(other, "文件") ? 2 : 0);
          if (item === "钥匙") return (keySafe ? 3 : -3) + (hasItem(other, "钥匙") ? 2 : 0);
          return 0;
        };
        return score(b) - score(a);
      })[0];
    return handleChoice(team, "discard", pick);
  }
  if (pending.type === "event_maintenance_choice") {
    if (ringOpportunity && countItem(team, "石头") >= 1) return handleChoice(team, "lose_stone");
    if (
      team === "modern" &&
      countItem(team, "石头") >= 1 &&
      !hasBellAny("modern") &&
      (hasBellAny("past") || hasItem("past", "钥匙"))
    ) {
      return handleChoice(team, "lose_stone");
    }
    if (
      team === "modern" &&
      countItem(team, "石头") >= 1 &&
      !hasItem("modern", "钥匙") &&
      hasItem("past", "钥匙")
    ) {
      return handleChoice(team, "lose_stone");
    }
    if (modernAhead) return handleChoice(team, "lose_stone");
    if (!timeSynced) return handleChoice(team, "modern_plus");
    if (!stoneSafe) return handleChoice(team, "modern_plus");
    return handleChoice(team, "lose_stone");
  }
  if (pending.type === "event_first_bell_choice") {
    if (!hasBellAny("modern")) return handleChoice(team, "send_bell");
    return handleChoice(team, "keep_bell");
  }
  if (pending.type === "event_build_continue_choice") {
    if (rushWinReady) return handleChoice(team, "skip");
    if (team === "past" && hasUsefulForModern(state.inventory.past)) return handleChoice(team, "travel_item");
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_build_continue_item") {
    const items = state.inventory[team];
    if (items.length) {
      if (team === "past") return handleChoice(team, "carry", pickForModern(items));
      return handleChoice(team, "carry", items[Math.floor(Math.random() * items.length)]);
    }
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_fix_fail_choice") {
    if (collectPhase) return handleChoice(team, "skip");
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_fix_fail_item") {
    const items = state.inventory[team];
    if (items.length) return handleChoice(team, "carry", items[Math.floor(Math.random() * items.length)]);
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_memory_choice") {
    if (rushWinReady) return handleChoice(team, "gain_bell");
    if (team === "past" && hasUsefulForModern(state.inventory.past)) return handleChoice(team, "travel_item");
    if (!hasBellAny("modern") && !hasBellAny("past")) return handleChoice(team, "gain_bell");
    return handleChoice(team, "gain_bell");
  }
  if (pending.type === "event_calibration_choice") {
    if (collectPhase) return handleChoice(team, "skip");
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_memory_item") {
    const items = state.inventory[team];
    if (items.length) {
      if (team === "past") return handleChoice(team, "carry", pickForModern(items));
      return handleChoice(team, "carry", items[Math.floor(Math.random() * items.length)]);
    }
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_system_test_choice") {
    if (canWinNow(team)) return handleChoice(team, "ring");
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_error_choice") {
    if (team === "past" && countItem(team, "石头") >= 1 && pastAheadWide) return handleChoice(team, "freeze_past");
    return handleChoice(team, "gain_stone");
  }
  if (pending.type === "event_city_error_choice") {
    if (rushWinReady && countItem(team, "石头") >= 1) return handleChoice(team, "lose_stone");
    if (team === "past") {
      if (hasUsefulForModern(state.inventory.past)) return handleChoice(team, "send_item");
      if (!state.inventory.past.length && stoneSafe && countItem(team, "石头") >= 1) {
        return handleChoice(team, "lose_stone");
      }
      return handleChoice(team, "send_item");
    }
    if (rushWinReady) return handleChoice(team, countItem(team, "石头") >= 1 ? "lose_stone" : "send_item");
    return handleChoice(team, "send_item");
  }
  if (pending.type === "event_city_error_item") {
    const items = state.inventory[team];
    if (items.length) {
      if (team === "past") return handleChoice(team, "carry", pickForModern(items));
      return handleChoice(team, "carry", items[Math.floor(Math.random() * items.length)]);
    }
    return handleChoice(team, "skip");
  }
  if (pending.type === "event_oldcity_choice") {
    if (team !== "past") return handleChoice(team, "skip");
    const others = state.inventory[team].filter((item) => item !== "文件");
    if (!others.length) return handleChoice(team, "skip");
    if (!hasBellAny("modern") && others.includes("铃铛")) return handleChoice(team, "carry", "铃铛");
    if (others.includes("钥匙")) return handleChoice(team, "carry", "钥匙");
    return handleChoice(team, "skip");
  }
}

function autoTick() {
  if (!state.auto.running) return;
  if (state.winner) {
    state.auto.running = false;
    render();
    return;
  }
  if (!state.configured) return;
  const team = state.phase.startsWith("modern") ? "modern" : "past";
  const pendingTeam = state.pendingChoice[team] ? team : state.pendingChoice[otherTeam(team)] ? otherTeam(team) : null;
  if (pendingTeam) {
    autoResolveChoice(pendingTeam, state.pendingChoice[pendingTeam]);
    render();
    return;
  }
  if (state.phase.endsWith("pick")) {
    const choices = locations.filter((loc) => locationSelectable(team, loc.name));
    const homeReady = teamOnHomeTimeline("modern") && teamOnHomeTimeline("past");
    const rushWinReady = hasBellAny("modern") && hasItem("modern", "钥匙") && homeReady;
    const collectPhase = !hasBasicSupplies() && !rushWinReady;
    const needStoneAny = !hasItem("modern", "石头") || !hasItem("past", "石头");
    const needFileAny = !hasItem("modern", "文件") || !hasItem("past", "文件");
    const needKeyAny = !hasItem("modern", "钥匙") || !hasItem("past", "钥匙");
    const needStoneTeam = team === "modern" ? !hasItem("modern", "石头") : !hasItem("past", "石头");
    const needFileTeam = team === "modern" ? !hasItem("modern", "文件") : !hasItem("past", "文件");
    const needKeyTeam = team === "modern" ? !hasItem("modern", "钥匙") : !hasItem("past", "钥匙");
    const modernHasBell = hasBellAny("modern");
    const pastHasBell = hasBellAny("past");
    const modernBellKey = modernHasBell && hasItem("modern", "钥匙");
    const pastBellNeedsSend = pastHasBell && !modernHasBell;
    const earlyBell = !modernHasBell;
    const readySetupModern = rushWinReady;
    const readySetupPast = hasBasicSupplies() && pastHasBell && homeReady;
    const timesSynced = state.time.modern === state.time.past;
    const slots = timeSlots.length;
    const deltaModern = (state.time.modern - state.time.past + slots) % slots;
    const modernAhead = deltaModern === 1;
    const pastAhead = deltaModern === 4;
    const pastAheadWide = deltaModern === 3 || deltaModern === 4;
    const readyToRing = readySetupModern && timesSynced;
    const domTargetBoost = 16;
    const domSelfPenalty = 6;
    const winReady = readySetupModern;
    const planModern = winReady ? "Dom Tower｜钟塔" : null;
    const planPast = winReady ? "Dom Square｜广场" : null;

    // Hard rules to make endgame intent explicit and avoid "hesitation".
    if (team === "past" && pastBellNeedsSend && choices.some((loc) => loc.name === "Workshop｜工坊")) {
      pickLocation(team, "Workshop｜工坊");
      enterEventPhase(team);
      render();
      return;
    }
    if (modernBellKey) {
      if (team === "modern" && choices.some((loc) => loc.name === "Dom Tower｜钟塔")) {
        pickLocation(team, "Dom Tower｜钟塔");
        enterEventPhase(team);
        render();
        return;
      }
      if (team === "past" && choices.some((loc) => loc.name === "Dom Square｜广场")) {
        pickLocation(team, "Dom Square｜广场");
        enterEventPhase(team);
        render();
        return;
      }
    }
    if (earlyBell) {
      if (team === "past") {
        const hasTower = choices.some((loc) => loc.name === "Dom Tower｜钟塔");
        const hasSquare = choices.some((loc) => loc.name === "Dom Square｜广场");
        if (hasTower) {
          pickLocation(team, "Dom Tower｜钟塔");
          enterEventPhase(team);
          render();
          return;
        }
        if (hasSquare) {
          pickLocation(team, "Dom Square｜广场");
          enterEventPhase(team);
          render();
          return;
        }
      }
      if (team === "modern") {
        if (!hasItem("modern", "钥匙")) {
          if (countItem("modern", "文件") >= 1 && choices.some((loc) => loc.name === "Archive｜档案馆")) {
            pickLocation(team, "Archive｜档案馆");
            enterEventPhase(team);
            render();
            return;
          }
          if (choices.some((loc) => loc.name === "Museum｜博物馆")) {
            pickLocation(team, "Museum｜博物馆");
            enterEventPhase(team);
            render();
            return;
          }
          if (needStoneAny && choices.some((loc) => loc.name === "Canal｜运河")) {
            pickLocation(team, "Canal｜运河");
            enterEventPhase(team);
            render();
            return;
          }
        }
        if (choices.some((loc) => loc.name === "Dom Square｜广场")) {
          pickLocation(team, "Dom Square｜广场");
          enterEventPhase(team);
          render();
          return;
        }
      }
    }

    if (winReady && timesSynced) {
      if (team === "modern" && choices.some((loc) => loc.name === "Dom Tower｜钟塔")) {
        pickLocation(team, "Dom Tower｜钟塔");
        enterEventPhase(team);
        render();
        return;
      }
      if (team === "past" && choices.some((loc) => loc.name === "Dom Square｜广场")) {
        pickLocation(team, "Dom Square｜广场");
        enterEventPhase(team);
        render();
        return;
      }
    }

    const scoreLocation = (loc) => {
      let score = 0;
      const wantDomForOpponent =
        (readySetupModern && team === "past") || (readySetupPast && team === "modern");
      const preferSync = !collectPhase && !timesSynced;
      if (readySetupModern) {
        if (team === "modern" && loc.name === "Dom Tower｜钟塔") score += 30;
        if (team === "past" && loc.name === "Dom Square｜广场") score += 30;
        if (team === "modern" && loc.name === "Dom Square｜广场") score -= 10;
        if (team === "past" && loc.name === "Dom Tower｜钟塔") score -= 10;
      }
      if (readySetupPast) {
        if (team === "modern" && loc.name === "Dom Square｜广场") score += 10;
        if (team === "past" && loc.name === "Dom Square｜广场") score -= 4;
      }
      if (winReady) {
        if (team === "modern" && loc.name === planModern) score += 26;
        if (team === "past" && loc.name === planPast) score += 26;
        if (team === "modern" && loc.name === planPast) score -= 12;
        if (team === "past" && loc.name === planModern) score -= 12;
      }
      if (winReady && timesSynced) {
        if (team === "modern" && loc.name === "Dom Tower｜钟塔") score += 24;
        if (team === "past" && loc.name === "Dom Square｜广场") score += 24;
      }
      if (collectPhase) {
        if (loc.name === "Canal｜运河" && needStoneTeam) score += 1;
        if (loc.name === "Museum｜博物馆" && needFileTeam && team === "modern") score += 1;
        if (loc.name === "Archive｜档案馆" && team === "modern" && countItem(team, "文件") >= 1) {
          score += needKeyTeam ? 8 : 4;
        }
        if (loc.name === "Archive｜档案馆" && needFileTeam && team === "past" && countItem(team, "石头") >= 1) score += 1;
        if (loc.name === "Dom Tower｜钟塔") score -= 4;
        if (loc.name === "Workshop｜工坊") score -= 6;
      }
      if (!timesSynced) {
        if (team === "modern" && deltaModern >= 1 && deltaModern <= 3 && loc.name === "Canal｜运河") score += 5;
        if (team === "modern" && pastAhead && loc.name === "Canal｜运河") score -= 5;
        if (team === "past" && pastAheadWide && loc.name === "Dom Square｜广场") score += 5;
        if (team === "modern" && pastAhead && loc.name === "Dom Square｜广场") score += 3;
      }
      if (loc.name === "Dom Tower｜钟塔") {
        if (team === "past" && countItem(team, "石头") >= 1 && countItem(team, "文件") >= 1) score += 5;
        if (hasBellAny(team) && state.location[otherTeam(team)] === "Dom Tower｜钟塔") score += 4;
        if (wantDomForOpponent) score += domTargetBoost;
        if (hasBellAny(team) && !collectPhase) score -= domSelfPenalty;
      }
      if (loc.name === "Dom Square｜广场") {
        if (wantDomForOpponent) score += domTargetBoost;
      }
      if (winReady && !timesSynced) {
        if (team === "modern" && loc.name === "Dom Tower｜钟塔") score += 10;
        if (team === "past" && loc.name === "Dom Square｜广场") score += 10;
      }
      if (loc.name === "Workshop｜工坊" && team === "past" && hasBellAny("past") && !hasBellAny("modern")) {
        score += 16;
      }
      if (loc.name === "Archive｜档案馆") {
        if (team === "past" && countItem(team, "石头") >= 1) score += 3;
        if (team === "modern" && countItem(team, "文件") >= 1) score += 3;
        if (team === "modern" && !hasItem("modern", "钥匙") && countItem(team, "文件") >= 1) score += 6;
      }
      if (loc.name === "Museum｜博物馆" && team === "modern" && (needFileAny || collectPhase)) score += 2;
      if (loc.name === "Canal｜运河") score += 1;
      if (loc.name === "Dom Square｜广场") score += 1;
      if (loc.name === "Workshop｜工坊") score += 1;
      if (preferSync && loc.name === "Dom Square｜广场") score += 2;
      if (readyToRing && team === "modern" && loc.name === "Dom Tower｜钟塔") score += 28;
      if (!modernHasBell && team === "past" && loc.name === "Dom Tower｜钟塔") score += 2;
      return score;
    };
    if (choices.length) {
      let best = choices[0];
      let bestScore = -1;
      choices.forEach((loc) => {
        let score = scoreLocation(loc);
        if (score > bestScore) {
          bestScore = score;
          best = loc;
        }
      });
      const currentName = state.location[team];
      const current = currentName ? locations.find((loc) => loc.name === currentName) : null;
      const currentScore = current ? scoreLocation(current) : -1;
      const switchThreshold = modernBellKey ? 0 : winReady ? 1 : 1;
      if (!current || bestScore >= currentScore + switchThreshold) {
        pickLocation(team, best.name);
      }
    }
    enterEventPhase(team);
    render();
    return;
  }
  if (state.phase.endsWith("event")) {
    if (!state.beforeEventApplied[team] && hasPreEventLocationAction(team)) {
      triggerPreEventLocationAction(team);
      render();
      return;
    }
    if (!state.eventDrawn[team]) {
      drawEvent(team);
      render();
      return;
    }
    endTurn(team);
    render();
  }
}

function startAuto() {
  if (state.auto.running) return;
  if (!state.configured) {
    applyPlayerCount(Number(elements.playerCountInput.value || 4));
    resetGame();
  } else if (hasProgressState()) {
    logEntry("自动演示已接管当前局面，将基于现有残局继续决策。");
  }
  state.auto.running = true;
  state.auto.timer = setInterval(autoTick, state.auto.interval);
  autoTick();
  render();
}

function stopAuto() {
  state.auto.running = false;
  if (state.auto.timer) {
    clearInterval(state.auto.timer);
    state.auto.timer = null;
  }
  render();
}

elements.autoToggleBtn.addEventListener("click", () => {
  if (state.auto.running) stopAuto();
  else startAuto();
});

elements.autoResetBtn.addEventListener("click", () => {
  stopAuto();
  resetGame();
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
