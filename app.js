const timeSlots = ["清晨", "上午", "正午", "傍晚", "深夜"];

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

const eventDeck = [
  { title: "尘封石块", text: "获得石头。", effect: (team) => addItem(team, "石头") },
  { title: "遗失档案", text: "获得文件。", effect: (team) => addItem(team, "文件") },
  { title: "锈蚀钥匙", text: "获得钥匙。", effect: (team) => addItem(team, "钥匙") },
  { title: "回响铃", text: "获得铃铛。", effect: (team) => addItem(team, "铃铛") },
  { title: "潮汐错位", text: "时间标记+1。", effect: (team) => shiftTime(team, 1) },
  { title: "裂缝回滚", text: "时间标记-1。", effect: (team) => shiftTime(team, -1) },
  { title: "镜像步伐", text: "与对方时间同步。", effect: (team) => syncTime(team) },
  { title: "遗失物", text: "随机失去一件物品。", effect: (team) => loseRandomItem(team) },
  { title: "双重回声", text: "复制一件已有物品。", effect: (team) => duplicateItem(team) },
  { title: "沉默钟声", text: "无法敲铃到下一轮。", effect: (team) => setSilenced(team) },
  { title: "流转线索", text: "若无文件则获得文件。", effect: (team) => addItemIfMissing(team, "文件") },
  { title: "磨损石阶", text: "若无石头则获得石头。", effect: (team) => addItemIfMissing(team, "石头") },
  { title: "钥孔亮起", text: "若无钥匙则获得钥匙。", effect: (team) => addItemIfMissing(team, "钥匙") },
  { title: "轻响", text: "若无铃铛则获得铃铛。", effect: (team) => addItemIfMissing(team, "铃铛") },
  { title: "反向回声", text: "对方随机失去一件物品。", effect: (team) => loseRandomItem(otherTeam(team)) },
  { title: "信使", text: "送出一件物品给对方。", effect: (team) => tradeItem(team) },
  { title: "迷雾街道", text: "下一轮你先行动。", effect: (team) => setNextFirst(team) },
  { title: "刻痕", text: "记录：下一次抽牌额外+1时间。", effect: (team) => setExtraShift(team) },
  { title: "静止片刻", text: "本轮时间不推进。", effect: (team) => setFreeze(team) },
  { title: "观测点", text: "可以查看对方背包。", effect: (team) => logPeek(team) },
  { title: "隐匿", text: "对方无法选你当前地点。", effect: (team) => setLocationLock(team) },
  { title: "裂缝回响", text: "你和对方时间互换。", effect: (team) => swapTime() },
  { title: "残留线索", text: "获得文件与石头。", effect: (team) => { addItem(team, "文件"); addItem(team, "石头"); } },
  { title: "旧锁盒", text: "有钥匙则额外获得铃铛。", effect: (team) => addItemIfHas(team, "钥匙", "铃铛") },
  { title: "夜巡", text: "时间标记+2。", effect: (team) => shiftTime(team, 2) },
  { title: "慢钟", text: "时间标记-2。", effect: (team) => shiftTime(team, -2) },
  { title: "遗忘", text: "清空铃铛。", effect: (team) => removeAllItem(team, "铃铛") },
  { title: "烟火", text: "双方都获得石头。", effect: () => { addItem("modern", "石头"); addItem("past", "石头"); } },
  { title: "共鸣", text: "若时间相同则各得文件。", effect: () => { if (state.time.modern === state.time.past) { addItem("modern", "文件"); addItem("past", "文件"); } } },
  { title: "禁鸣", text: "本轮双方无法敲铃。", effect: () => { state.silenced.modern = true; state.silenced.past = true; } },
  { title: "回响终止", text: "结束该方行动。", effect: (team) => endTurnEarly(team) },
];

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
};

const elements = {
  status: document.getElementById("status"),
  timeSlots: document.getElementById("timeSlots"),
  dialLabels: document.getElementById("dialLabels"),
  markerModern: document.getElementById("markerModern"),
  markerPast: document.getElementById("markerPast"),
  modernLocation: document.getElementById("modernLocation"),
  pastLocation: document.getElementById("pastLocation"),
  modernInventory: document.getElementById("modernInventory"),
  pastInventory: document.getElementById("pastInventory"),
  modernActions: document.getElementById("modernActions"),
  pastActions: document.getElementById("pastActions"),
  locationList: document.getElementById("locationList"),
  eventLog: document.getElementById("eventLog"),
  resetBtn: document.getElementById("resetBtn"),
};

function initDial() {
  elements.dialLabels.innerHTML = "";
  const angles = [270, 342, 54, 126, 198];
  timeSlots.forEach((slot, i) => {
    const span = document.createElement("span");
    span.textContent = slot;
    span.style.transform = `rotate(${angles[i]}deg) translate(0, -118px) rotate(-${angles[i]}deg)`;
    elements.dialLabels.appendChild(span);
  });
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
  if (team === "modern") {
    state.phase = "past_pick";
  } else {
    state.phase = "round_end";
  }
}

function label(team) {
  return team === "modern" ? "现代组" : "过去组";
}

function drawEvent(team) {
  applyLocationEffectBeforeEvent(team);
  if (state.pendingChoice[team]) return;
  const card = eventDeck[Math.floor(Math.random() * eventDeck.length)];
  logEntry(`${label(team)}抽到事件：${card.title}（${card.text}）`);
  state.inEvent = true;
  card.effect(team);
  state.inEvent = false;
  state.blockItemMods[team] = false;
  applyLocationEffectAfterEvent(team);
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
  if (!state.inventory[team].includes("铃铛")) {
    logEntry(`${label(team)}没有铃铛可用。`);
    return;
  }
  if (state.silenced[team]) {
    logEntry(`${label(team)}尝试敲铃，但被禁鸣。`);
    return;
  }
  const opponent = otherTeam(team);
  const opponentDom = state.location[opponent] === "Dom Tower｜钟塔";
  const sameTime = state.time[team] === state.time[opponent];
  if (opponentDom && sameTime) {
    state.winner = team;
    logEntry(`${label(team)}在钟塔回响中敲铃，胜利！`);
  } else {
    logEntry(`${label(team)}敲响铃铛，但条件不足。`);
  }
}

function pickLocation(team, locationName) {
  if (state.location[team]) return;
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
      state.pendingChoice.modern = { type: "museum_modern_gain" };
      logEntry("现代组可在博物馆获得文件，但可能需要弃一件物品。");
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

function resetRound() {
  state.location.modern = null;
  state.location.past = null;
  state.silenced.modern = false;
  state.silenced.past = false;
  state.lockBy = null;
  if (state.travelCooldown.past > 0) state.travelCooldown.past -= 1;
  state.roundStats = { modern: { gained: 0, lost: 0 }, past: { gained: 0, lost: 0 } };
  state.phase = state.nextFirst === "modern" ? "modern_pick" : "past_pick";
}

function nextPhase() {
  if (state.phase === "modern_pick") {
    state.phase = "modern_event";
  } else if (state.phase === "modern_event") {
    advanceTime("modern");
    state.phase = "past_pick";
  } else if (state.phase === "past_pick") {
    state.phase = "past_event";
  } else if (state.phase === "past_event") {
    advanceTime("past");
    state.phase = "round_end";
  } else if (state.phase === "round_end") {
    resetRound();
  }
}

function locationSelectable(team, name) {
  if (state.location[team]) return false;
  const other = otherTeam(team);
  if (state.location[other] === name) return false;
  if (state.lockBy && state.lockBy !== team && state.location[other] === name) return false;
  return true;
}

function render() {
  elements.status.textContent = state.winner
    ? `${label(state.winner)}获胜！点击重置开始新局。`
    : `回合阶段：${phaseLabel(state.phase)} · 时间同步：${state.time.modern === state.time.past ? "是" : "否"}`;

  elements.timeSlots.innerHTML = timeSlots
    .map((slot, i) => {
      const classes = ["slot"];
      if (state.time.modern === i) classes.push("active-modern");
      if (state.time.past === i) classes.push("active-past");
      return `
        <div class="${classes.join(" ")}">
          <div>${slot}</div>
          ${state.time.modern === i ? '<div class="tag">现代</div>' : ""}
          ${state.time.past === i ? '<div class="tag">过去</div>' : ""}
        </div>
      `;
    })
    .join("");

  elements.markerModern.textContent = `现代 · ${timeSlots[state.time.modern]}`;
  elements.markerPast.textContent = `过去 · ${timeSlots[state.time.past]}`;

  elements.modernLocation.textContent = state.location.modern || "未选择";
  elements.pastLocation.textContent = state.location.past || "未选择";

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
          ${who ? `<div class="chip">已被${who}翻开</div>` : ""}
        </div>
      `;
    })
    .join("");

  elements.eventLog.innerHTML = state.log
    .map((entry) => `<div class="log-entry">[${entry.ts}] ${entry.text}</div>`)
    .join("");

  elements.modernActions.innerHTML = renderActions("modern");
  elements.pastActions.innerHTML = renderActions("past");

  bindActions();
}

function renderInventory(list) {
  if (!list.length) return '<span class="token">空</span>';
  return list.map((item) => `<span class="token">${item}</span>`).join("");
}

function renderActions(team) {
  const isModern = team === "modern";
  const canAct = !state.winner && ((isModern && state.phase.startsWith("modern")) || (!isModern && state.phase.startsWith("past")));
  const canPick = canAct && state.phase.endsWith("pick");
  const canEvent = canAct && state.phase.endsWith("event");
  const pendingChoice = state.pendingChoice[team];

  if (pendingChoice) {
    return renderChoiceActions(team, pendingChoice);
  }

  return `
    <button class="btn" data-action="pick" data-team="${team}" ${canPick ? "" : "disabled"}>选择地点</button>
    <button class="btn alt" data-action="event" data-team="${team}" ${canEvent ? "" : "disabled"}>抽事件卡</button>
    <button class="btn" data-action="bell" data-team="${team}" ${canAct ? "" : "disabled"}>敲铃</button>
    <button class="btn ghost" data-action="next" data-team="${team}" ${canAct ? "" : "disabled"}>结束行动</button>
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
  if (action === "choice") {
    handleChoice(team, data.choice, data.item);
    render();
    return;
  }
  if (action === "pick") {
    return;
  }
  if (action === "pick-location") {
    pickLocation(team, data.location);
    render();
    return;
  }
  if (action === "event") {
    drawEvent(team);
    render();
    return;
  }
  if (action === "bell") {
    ringBell(team);
    render();
    return;
  }
  if (action === "next") {
    nextPhase();
    render();
  }
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
    return `
      <div class="label">工坊：可穿越到过去。</div>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_no_item">不带物品</button>
      <button class="btn" data-action="choice" data-team="${team}" data-choice="travel_item">带1件物品</button>
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
      state.travelCooldown.past = 2;
      logEntry("过去组穿越到现在时间线。");
    }
    if (choice === "skip") logEntry("过去组放弃穿越。");
  }
  if (pending.type === "workshop_modern_travel") {
    if (choice === "travel_no_item") {
      state.time.modern = state.time.past;
      logEntry("现代组穿越到过去时间线（未带物品）。");
    }
    if (choice === "travel_item") {
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
  state.pendingChoice[team] = null;
}

function canModifyItems(team) {
  return !(state.inEvent && state.blockItemMods[team]);
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
  state.log = [];
  logEntry("新游戏开始。现代与过去同在清晨。\n");
  render();
}

initDial();
resetGame();

elements.resetBtn.addEventListener("click", resetGame);
