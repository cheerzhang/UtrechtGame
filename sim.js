const timeSlots = ["清晨", "上午", "正午", "傍晚", "深夜"];

const locations = [
  { name: "Dom Tower｜钟塔" },
  { name: "Dom Square｜广场" },
  { name: "Canal｜运河" },
  { name: "Museum｜博物馆" },
  { name: "Archive｜档案馆" },
  { name: "Workshop｜工坊" },
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
  pendingChoice: { modern: null, past: null },
  winner: null,
  lastEvent: { modern: null, past: null },
  configured: true,
  totalPlayers: 4,
  teamSize: { modern: 2, past: 2 },
  playerPos: { modern: { modern: 2, past: 0 }, past: { modern: 0, past: 2 } },
  travelNoItem: { modern: false, past: false },
  noModifyNextEvent: { modern: false, past: false },
  eventDrawn: { modern: false, past: false },
  bellTriggered: { modern: false, past: false },
  blockItemModsRound: { modern: false, past: false },
  totalDraws: 0,
  totalRounds: 0,
  phase: "modern_pick",
  lockBy: null,
};

function logEntry() {}

function otherTeam(team) {
  return team === "modern" ? "past" : "modern";
}

function canModifyItems(team) {
  if (!state.inEvent) return true;
  return !(state.blockItemMods[team] || state.blockItemModsRound[team]);
}

function addItem(team, item) {
  if (!canModifyItems(team)) return;
  state.inventory[team].push(item);
  state.roundStats[team].gained += 1;
}

function removeOneItem(team, item) {
  if (!canModifyItems(team)) return false;
  const idx = state.inventory[team].indexOf(item);
  if (idx === -1) return false;
  state.inventory[team].splice(idx, 1);
  state.roundStats[team].lost += 1;
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
  return true;
}

function loseRandomItem(team) {
  if (!canModifyItems(team)) return;
  const inv = state.inventory[team];
  if (!inv.length) return;
  const idx = Math.floor(Math.random() * inv.length);
  inv.splice(idx, 1);
  state.roundStats[team].lost += 1;
}

function tradeItem(team) {
  const inv = state.inventory[team];
  if (!inv.length) return;
  const idx = Math.floor(Math.random() * inv.length);
  const [given] = inv.splice(idx, 1);
  state.roundStats[team].lost += 1;
  addItem(otherTeam(team), given);
}

function shiftTime(team, delta) {
  state.time[team] = (state.time[team] + delta + timeSlots.length) % timeSlots.length;
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
  return hasBellAny(team) && opponentDom && sameTime && teamOnHomeTimeline(team) && hasBasicSupplies();
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

function setSilenced(team) {
  state.silenced[team] = true;
}

function requirePastPresence(team) {
  if (state.playerPos[team].past === 0) return false;
  return true;
}

function requireModernPresence(team) {
  if (state.playerPos[team].modern === 0) return false;
  return true;
}

function ringBell(team) {
  if (!hasBellAny(team)) return;
  if (state.silenced[team]) return;
  state.bellTriggered[team] = true;
  if (!teamOnHomeTimeline(team)) return;
  if (!hasBasicSupplies()) return;
  const opponent = otherTeam(team);
  const opponentDom =
    state.location[opponent] === "Dom Tower｜钟塔" || state.location[opponent] === "Dom Square｜广场";
  const sameTime = state.time[team] === state.time[opponent];
  if (opponentDom && sameTime) {
    state.winner = team;
  }
}

function pickLocation(team, locationName) {
  state.location[team] = locationName;
}

function applyLocationEffectBeforeEvent(team) {
  const loc = state.location[team];
  if (!loc) return;
  if (loc === "Archive｜档案馆") {
    if (team === "past") {
      if (state.inventory.past.includes("石头")) {
        state.pendingChoice.past = { type: "archive_past_convert" };
      } else {
        shiftTime("past", 1);
      }
    }
    if (team === "modern") {
      if (state.inventory.modern.includes("文件")) {
        state.pendingChoice.modern = { type: "archive_modern_convert" };
      } else {
        state.blockItemMods.modern = true;
      }
    }
  }
  if (loc === "Workshop｜工坊") {
    if (team === "past") {
      if (state.travelCooldown.past > 0) {
        return;
      }
      state.pendingChoice.past = { type: "workshop_past_travel" };
    }
    if (team === "modern") {
      state.pendingChoice.modern = { type: "workshop_modern_travel" };
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
      }
    }
    if (team === "modern") {
      state.pendingChoice.modern = { type: "canal_modern_gain" };
    }
  }
  if (loc === "Museum｜博物馆") {
    if (team === "past") {
      if (state.inventory.past.includes("文件")) {
        removeOneItem("past", "文件");
      }
    }
    if (team === "modern") {
      state.pendingChoice.modern = { type: "museum_modern_gain" };
    }
  }
  if (loc === "Dom Square｜广场") {
    if (team === "past" && state.roundStats.past.gained === 0) {
      state.pendingChoice.past = { type: "domsquare_past_freeze" };
    }
    if (team === "modern" && state.roundStats.modern.lost >= 1) {
      state.pendingChoice.modern = { type: "domsquare_modern_ring" };
    }
  }
  if (loc === "Dom Tower｜钟塔") {
    if (team === "past" && state.inventory.past.includes("石头") && state.inventory.past.includes("文件")) {
      state.pendingChoice.past = { type: "domtower_past_bell" };
    }
    if (team === "modern" && state.inventory.modern.includes("钥匙")) {
      state.pendingChoice.modern = { type: "domtower_modern_ring" };
    }
  }
}

function handleChoice(team, choice, item) {
  const pending = state.pendingChoice[team];
  if (!pending) return;
  if (pending.type === "canal_past_gain") {
    if (choice === "gain") addItem(team, "石头");
  }
  if (pending.type === "canal_modern_gain") {
    if (choice === "gain") {
      addItem(team, "石头");
      shiftTime(otherTeam(team), 1);
    }
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
  }
  if (pending.type === "archive_past_convert") {
    if (choice === "convert") {
      if (removeOneItem(team, "石头")) addItem(team, "文件");
    }
  }
  if (pending.type === "archive_modern_convert") {
    if (choice === "convert") {
      if (removeOneItem(team, "文件")) addItem(team, "钥匙");
    }
    if (choice === "skip") {
      state.blockItemMods.modern = true;
    }
  }
  if (pending.type === "workshop_past_travel") {
    if (choice === "travel") {
      state.time.past = state.time.modern;
      travelOne("past", "modern");
      state.travelCooldown.past = 2;
      state.travelNoItem.past = false;
    }
  }
  if (pending.type === "workshop_modern_travel") {
    if (choice === "travel_no_item") {
      state.time.modern = state.time.past;
      travelOne("modern", "past");
      state.travelNoItem.modern = false;
    }
    if (choice === "travel_item") {
      if (state.travelNoItem.modern) return;
      if (state.inventory.modern.length) {
        state.pendingChoice[team] = { type: "workshop_modern_item" };
        return;
      }
    }
  }
  if (pending.type === "workshop_modern_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        state.inventory.past.push(item);
        state.time.modern = state.time.past;
        shiftTime("modern", 1);
        travelOne("modern", "past");
        state.travelNoItem.modern = false;
      }
    }
  }
  if (pending.type === "domsquare_past_freeze") {
    if (choice === "freeze") {
      state.freeze.past = true;
    }
  }
  if (pending.type === "domsquare_modern_ring") {
    if (choice === "ring") {
      ringBell("modern");
    }
  }
  if (pending.type === "domtower_past_bell") {
    if (choice === "gain") addItem("past", "铃铛");
  }
  if (pending.type === "domtower_modern_ring") {
    if (choice === "ring") {
      ringBell("modern");
    }
  }
  if (pending.type === "discard_any") {
    if (choice === "discard") {
      removeOneItem(team, item);
    }
  }
  if (pending.type === "event_maintenance_choice") {
    if (choice === "lose_stone") {
      if (removeOneItem(team, "石头")) {
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
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        // no-op
      } else {
        state.pendingChoice[team] = { type: "event_build_continue_item" };
        return;
      }
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
      }
    }
  }
  if (pending.type === "event_fix_fail_choice") {
    if (choice === "travel_no_item") {
      state.time.modern = state.time.past;
      travelOne(team, "past");
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        // no-op
      } else {
        state.pendingChoice[team] = { type: "event_fix_fail_item" };
        return;
      }
    }
  }
  if (pending.type === "event_fix_fail_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("past", item);
        state.time.modern = state.time.past;
        travelOne(team, "past");
      }
    }
  }
  if (pending.type === "event_memory_choice") {
    if (choice === "gain_bell") {
      addItem(team, "铃铛");
    }
    if (choice === "travel_item") {
      if (!state.inventory[team].length) {
        // no-op
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
    }
  }
  if (pending.type === "event_memory_item") {
    if (choice === "carry") {
      if (removeOneItem(team, item)) {
        addItem("modern", item);
        state.time.past = state.time.modern;
        travelOne("past", "modern");
      }
    }
  }
  if (pending.type === "event_system_test_choice") {
    if (choice === "ring") {
      ringBell(team);
      shiftTime("modern", 1);
    }
  }
  if (pending.type === "event_error_choice") {
    if (choice === "gain_stone") {
      addItem(team, "石头");
      state.travelNoItem[team] = true;
    }
    if (choice === "freeze_past") {
      state.freeze.past = true;
    }
  }
  if (pending.type === "event_city_error_choice") {
    if (choice === "lose_stone") {
      removeOneItem(team, "石头");
    }
    if (choice === "send_item") {
      if (!state.inventory[team].length) {
        // no-op
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
      }
    }
  }
  if (pending.type === "event_oldcity_choice") {
    if (choice === "carry") {
      const removedFile = removeOneItem(team, "文件");
      const removedOther = removeOneItem(team, item);
      if (removedFile && removedOther) {
        addItem("modern", "文件");
        addItem("modern", item);
        state.time.past = state.time.modern;
        travelOne("past", "modern");
      } else {
        if (removedOther) addItem(team, item);
        if (removedFile) addItem(team, "文件");
      }
    }
  }
  state.pendingChoice[team] = null;
}

const eventDeck = [
  {
    title: "钟尚未存在",
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
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.pendingChoice[team] = { type: "event_error_choice" };
    },
  },
  {
    title: "第一次敲击",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      addItem(team, "铃铛");
      state.pendingChoice[team] = { type: "event_first_bell_choice" };
    },
  },
  {
    title: "没有记录的日子",
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
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      const hasFile = countItem(team, "文件") >= 1;
      const otherItems = state.inventory[team].filter((item) => item !== "文件");
      if (hasFile && otherItems.length) {
        state.pendingChoice[team] = { type: "event_oldcity_choice" };
      }
    },
  },
  {
    title: "钟声被误解",
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
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      addItem(team, "石头");
      if (state.location[team] === "Workshop｜工坊") {
        state.pendingChoice[team] = { type: "event_build_continue_choice" };
      }
    },
  },
  {
    title: "城市记住了错误",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.pendingChoice[team] = { type: "event_city_error_choice" };
    },
  },
  {
    title: "准备完成",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      if (countItem(team, "石头") >= 1 && countItem(team, "文件") >= 1) {
        state.pendingChoice[team] = { type: "event_memory_choice" };
      } else {
        addItem(team, "石头");
      }
    },
  },
  {
    title: "时间留下的不是答案",
    effect: (team) => {
      if (!requirePastPresence(team)) return;
      state.freeze.past = true;
      shiftTime("modern", 1);
    },
  },
  {
    title: "被整理的历史",
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
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (!hasBellAny(team)) {
        state.pendingChoice[team] = { type: "event_calibration_choice" };
      }
    },
  },
  {
    title: "错误的解读",
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
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      state.pendingChoice[team] = { type: "event_maintenance_choice" };
    },
  },
  {
    title: "时间差",
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
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      state.blockItemModsRound[team] = true;
      if (state.location[team] === "Workshop｜工坊") {
        state.pendingChoice[team] = { type: "event_fix_fail_choice" };
      }
    },
  },
  {
    title: "误以为已经完成",
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
    effect: (team) => {
      if (!requireModernPresence(team)) return;
      if (hasBellAny(team)) {
        state.pendingChoice[team] = { type: "event_system_test_choice" };
      }
    },
  },
  {
    title: "访客",
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

function drawEvent(team) {
  applyLocationEffectBeforeEvent(team);
  if (state.pendingChoice[team]) return;
  const card = eventDeck[Math.floor(Math.random() * eventDeck.length)];
  state.lastEvent[team] = card;
  state.inEvent = true;
  if (state.noModifyNextEvent[team]) {
    state.blockItemMods[team] = true;
    state.noModifyNextEvent[team] = false;
  }
  card.effect(team);
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
}

function locationSelectable(team, name) {
  const other = otherTeam(team);
  if (state.location[other] === name) return false;
  if (state.lockBy && state.lockBy !== team && state.location[other] === name) return false;
  return true;
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
  state.pendingChoice = { modern: null, past: null };
  state.phase = "modern_pick";
  state.winner = null;
  state.lastEvent = { modern: null, past: null };
  state.playerPos = {
    modern: { modern: state.teamSize.modern, past: 0 },
    past: { modern: 0, past: state.teamSize.past },
  };
  state.travelNoItem = { modern: false, past: false };
  state.noModifyNextEvent = { modern: false, past: false };
  state.eventDrawn = { modern: false, past: false };
  state.bellTriggered = { modern: false, past: false };
  state.blockItemModsRound = { modern: false, past: false };
  state.totalDraws = 0;
  state.totalRounds = 0;
}

function stepWithPolicy(policy) {
  if (state.winner) return;
  const team = state.phase.startsWith("modern") ? "modern" : "past";
  const pending = state.pendingChoice[team];
  if (pending) {
    policy.resolveChoice(team, pending);
    return;
  }
  if (state.phase.endsWith("pick")) {
    policy.pickLocation(team);
    enterEventPhase(team);
    return;
  }
  if (state.phase.endsWith("event")) {
    if (!state.eventDrawn[team]) {
      drawEvent(team);
      return;
    }
    endTurn(team);
  }
}

function runGame(policy, maxDraws, maxRounds) {
  resetGame();
  while (!state.winner && state.totalDraws < maxDraws && state.totalRounds < maxRounds) {
    stepWithPolicy(policy);
  }
  return {
    winner: state.winner,
    draws: state.totalDraws,
    rounds: state.totalRounds,
  };
}

function percentileFromSamples(samples, p) {
  if (!samples.length) return null;
  const sorted = samples.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

function findThreshold(samples, targetRate) {
  if (!samples.length) return null;
  const sorted = samples.slice().sort((a, b) => a - b);
  const idx = Math.ceil(targetRate * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

function runBatch(policy, games, maxDraws, maxRounds) {
  let wins = 0;
  const winDraws = [];
  const winRounds = [];
  for (let i = 0; i < games; i += 1) {
    const result = runGame(policy, maxDraws, maxRounds);
    if (result.winner) {
      wins += 1;
      winDraws.push(result.draws);
      winRounds.push(result.rounds);
    }
  }
  const winRate = wins / games;
  return {
    winRate,
    winDraws,
    winRounds,
    p50Draws: percentileFromSamples(winDraws, 0.5),
    p80Draws: percentileFromSamples(winDraws, 0.8),
    p50Rounds: percentileFromSamples(winRounds, 0.5),
    p80Rounds: percentileFromSamples(winRounds, 0.8),
    drawThreshold70: findThreshold(winDraws, 0.7),
    roundThreshold70: findThreshold(winRounds, 0.7),
  };
}

const randomPolicy = {
  pickLocation(team) {
    const choices = locations.filter((loc) => locationSelectable(team, loc.name));
    const pick = choices[Math.floor(Math.random() * choices.length)];
    if (pick) pickLocation(team, pick.name);
  },
  resolveChoice(team, pending) {
    const items = state.inventory[team];
    const anyItem = items.length ? items[Math.floor(Math.random() * items.length)] : null;
    const coin = () => (Math.random() < 0.5 ? "a" : "b");
    switch (pending.type) {
      case "canal_past_gain":
        return handleChoice(team, Math.random() < 0.5 ? "gain" : "skip");
      case "canal_modern_gain":
        return handleChoice(team, Math.random() < 0.5 ? "gain" : "skip");
      case "museum_modern_gain":
        return handleChoice(team, Math.random() < 0.5 ? "gain" : "skip");
      case "archive_past_convert":
        return handleChoice(team, Math.random() < 0.5 ? "convert" : "skip");
      case "archive_modern_convert":
        return handleChoice(team, Math.random() < 0.5 ? "convert" : "skip");
      case "workshop_past_travel":
        return handleChoice(team, Math.random() < 0.5 ? "travel" : "skip");
      case "workshop_modern_travel":
        return handleChoice(team, Math.random() < 0.5 ? "travel_no_item" : "skip");
      case "workshop_modern_item":
        if (anyItem) return handleChoice(team, "carry", anyItem);
        return handleChoice(team, "skip");
      case "domsquare_past_freeze":
        return handleChoice(team, Math.random() < 0.5 ? "freeze" : "skip");
      case "domsquare_modern_ring":
        return handleChoice(team, Math.random() < 0.5 ? "ring" : "skip");
      case "domtower_past_bell":
        return handleChoice(team, Math.random() < 0.5 ? "gain" : "skip");
      case "domtower_modern_ring":
        return handleChoice(team, Math.random() < 0.5 ? "ring" : "skip");
      case "discard_any":
        if (anyItem) return handleChoice(team, "discard", anyItem);
        return handleChoice(team, "skip");
      case "event_maintenance_choice":
        return handleChoice(team, Math.random() < 0.5 ? "lose_stone" : "modern_plus");
      case "event_first_bell_choice":
        return handleChoice(team, Math.random() < 0.5 ? "send_bell" : "keep_bell");
      case "event_build_continue_choice":
        return handleChoice(team, coin() === "a" ? "travel_no_item" : "travel_item");
      case "event_build_continue_item":
        if (anyItem) return handleChoice(team, "carry", anyItem);
        return handleChoice(team, "skip");
      case "event_fix_fail_choice":
        return handleChoice(team, coin() === "a" ? "travel_no_item" : "travel_item");
      case "event_fix_fail_item":
        if (anyItem) return handleChoice(team, "carry", anyItem);
        return handleChoice(team, "skip");
      case "event_memory_choice":
        return handleChoice(team, coin() === "a" ? "gain_bell" : "travel_item");
      case "event_memory_item":
        if (anyItem) return handleChoice(team, "carry", anyItem);
        return handleChoice(team, "skip");
      case "event_calibration_choice":
        return handleChoice(team, Math.random() < 0.5 ? "travel_no_item" : "skip");
      case "event_system_test_choice":
        return handleChoice(team, Math.random() < 0.5 ? "ring" : "skip");
      case "event_error_choice":
        return handleChoice(team, Math.random() < 0.5 ? "gain_stone" : "freeze_past");
      case "event_city_error_choice":
        return handleChoice(team, Math.random() < 0.5 ? "lose_stone" : "send_item");
      case "event_city_error_item":
        if (anyItem) return handleChoice(team, "carry", anyItem);
        return handleChoice(team, "skip");
      case "event_oldcity_choice":
        if (anyItem) return handleChoice(team, Math.random() < 0.5 ? "carry" : "skip", anyItem);
        return handleChoice(team, "skip");
      default:
        return handleChoice(team, "skip");
    }
  },
};

const heuristicPolicy = {
  pickLocation(team) {
    const choices = locations.filter((loc) => locationSelectable(team, loc.name));
    if (!choices.length) return;
    const needStone = !hasItem("modern", "石头") || !hasItem("past", "石头");
    const needFile = !hasItem("modern", "文件") || !hasItem("past", "文件");
    const needKey = !hasItem("modern", "钥匙") || !hasItem("past", "钥匙");
    const modernHasBell = hasBellAny("modern");
    const pastHasBell = hasBellAny("past");
    const modernBellKey = modernHasBell && hasItem("modern", "钥匙");
    const pastBellNeedsSend = pastHasBell && !modernHasBell;
    const earlyBell = !modernHasBell;
    const homeReady = teamOnHomeTimeline("modern") && teamOnHomeTimeline("past");
    const readySetupModern = hasBasicSupplies() && modernHasBell && homeReady;
    const readySetupPast = hasBasicSupplies() && pastHasBell && homeReady;
    const timesSynced = state.time.modern === state.time.past;
    const slots = timeSlots.length;
    const deltaModern = (state.time.modern - state.time.past + slots) % slots;
    const pastAhead = deltaModern === 4;
    const pastAheadWide = deltaModern === 3 || deltaModern === 4;
    const winReady = readySetupModern;
    const fastPlan = winReady && hasItem("modern", "钥匙");
    const planModern = winReady ? (fastPlan ? "Dom Tower｜钟塔" : "Dom Square｜广场") : null;
    const planPast = winReady ? (fastPlan ? "Dom Square｜广场" : "Dom Tower｜钟塔") : null;
    if (team === "past" && pastBellNeedsSend && choices.some((c) => c.name === "Workshop｜工坊")) {
      pickLocation(team, "Workshop｜工坊");
      return;
    }
    if (modernBellKey) {
      if (team === "modern" && choices.some((c) => c.name === "Dom Tower｜钟塔")) {
        pickLocation(team, "Dom Tower｜钟塔");
        return;
      }
      if (team === "past" && choices.some((c) => c.name === "Dom Square｜广场")) {
        pickLocation(team, "Dom Square｜广场");
        return;
      }
    }
    if (earlyBell) {
      if (team === "past") {
        let prefer = choices.find((c) => c.name === "Dom Tower｜钟塔")?.name || null;
        if (!prefer && choices.some((c) => c.name === "Dom Square｜广场")) prefer = "Dom Square｜广场";
        if (prefer) {
          pickLocation(team, prefer);
          return;
        }
      }
      if (team === "modern") {
        if (!hasItem("modern", "钥匙")) {
          if (countItem("modern", "文件") >= 1 && choices.some((c) => c.name === "Archive｜档案馆")) {
            pickLocation(team, "Archive｜档案馆");
            return;
          }
          if (choices.some((c) => c.name === "Museum｜博物馆")) {
            pickLocation(team, "Museum｜博物馆");
            return;
          }
          if (needStone && choices.some((c) => c.name === "Canal｜运河")) {
            pickLocation(team, "Canal｜运河");
            return;
          }
        }
        if (choices.some((c) => c.name === "Dom Square｜广场")) {
          pickLocation(team, "Dom Square｜广场");
          return;
        }
      }
    }
    const scoreLocation = (loc) => {
      let score = 0;
      const wantDomForOpponent =
        (readySetupModern && team === "past") || (readySetupPast && team === "modern");
      const preferSync = !timesSynced;
      if (readySetupModern) {
        if (team === "past" && loc.name === "Dom Tower｜钟塔") score += 18;
        if (team === "modern" && loc.name === "Dom Square｜广场") score += 16;
        if (team === "modern" && loc.name === "Dom Tower｜钟塔") score -= 12;
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
      if (loc.name === "Canal｜运河" && needStone) score += 6;
      if (loc.name === "Museum｜博物馆" && needFile && team === "modern") score += 6;
      if (loc.name === "Archive｜档案馆" && needKey && team === "modern" && countItem(team, "文件") >= 1) score += 6;
      if (loc.name === "Archive｜档案馆" && team === "past" && countItem(team, "石头") >= 1) score += 4;
      if (loc.name === "Dom Tower｜钟塔") score -= 2;
      if (loc.name === "Workshop｜工坊") score -= 2;
      if (!modernHasBell) {
        if (team === "past" && !pastHasBell && (loc.name === "Dom Square｜广场" || loc.name === "Dom Tower｜钟塔")) {
          score += 6;
        }
        if (team === "past" && pastHasBell && loc.name === "Workshop｜工坊") score += 8;
      }
      if (!modernHasBell && !pastHasBell && team === "past" && loc.name === "Dom Tower｜钟塔") {
        score += 20;
      }
      if (!modernHasBell && pastHasBell && team === "past" && loc.name === "Workshop｜工坊") {
        score += 20;
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
        if (wantDomForOpponent) score += 16;
        if (hasBellAny(team) && !false) score -= 6;
      }
      if (loc.name === "Dom Square｜广场") {
        if (wantDomForOpponent) score += 16;
      }
      if (loc.name === "Workshop｜工坊" && team === "past" && hasBellAny("past") && !hasBellAny("modern")) {
        score += 6;
      }
      if (loc.name === "Archive｜档案馆") {
        if (team === "past" && countItem(team, "石头") >= 1) score += 3;
        if (team === "modern" && countItem(team, "文件") >= 1) score += 3;
      }
      if (loc.name === "Museum｜博物馆" && team === "modern") score += 2;
      if (loc.name === "Canal｜运河") score += 1;
      if (loc.name === "Dom Square｜广场") score += 1;
      if (loc.name === "Workshop｜工坊") score += 1;
      if (preferSync && loc.name === "Dom Square｜广场") score += 2;
      if (readySetupModern && team === "modern" && loc.name === "Dom Square｜广场") score += 14;
      if (!modernHasBell && team === "past" && loc.name === "Dom Tower｜钟塔") score += 2;
      return score;
    };
    let best = choices[0];
    let bestScore = -1;
    choices.forEach((loc) => {
      const score = scoreLocation(loc);
      if (score > bestScore) {
        bestScore = score;
        best = loc;
      }
    });
    const currentName = state.location[team];
    const current = currentName ? locations.find((loc) => loc.name === currentName) : null;
    const currentScore = current ? scoreLocation(current) : -1;
    const switchThreshold = modernBellKey ? 0 : 1;
    if (!current || bestScore >= currentScore + switchThreshold) {
      pickLocation(team, best.name);
    }
  },
  resolveChoice(team, pending) {
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
      const needStone = !hasItem("modern", "石头") && !hasItem("past", "石头");
      if (needStone || (deltaModern >= 1 && deltaModern <= 3)) return handleChoice(team, "gain");
      if (!timeSynced && pastAhead) return handleChoice(team, "skip");
      return handleChoice(team, "gain");
    }
    if (pending.type === "museum_modern_gain") return handleChoice(team, "gain");
    if (pending.type === "archive_past_convert") return handleChoice(team, "convert");
    if (pending.type === "archive_modern_convert") return handleChoice(team, "convert");
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
      return handleChoice(team, "skip");
    }
  },
};

function main() {
  const games = Number(process.argv[2] || 5000);
  const maxDraws = Number(process.argv[3] || 200);
  const maxRounds = Number(process.argv[4] || 200);
  const randomStats = runBatch(randomPolicy, games, maxDraws, maxRounds);
  const heuristicStats = runBatch(heuristicPolicy, games, maxDraws, maxRounds);
  const format = (n) => (n == null ? "-" : n);
  console.log("随机策略:");
  console.log(`  胜率: ${(randomStats.winRate * 100).toFixed(1)}%`);
  console.log(`  50%胜利抽卡: ${format(randomStats.p50Draws)} 张`);
  console.log(`  70%胜利抽卡: ${format(randomStats.drawThreshold70)} 张`);
  console.log(`  50%胜利轮数: ${format(randomStats.p50Rounds)} 轮`);
  console.log(`  70%胜利轮数: ${format(randomStats.roundThreshold70)} 轮`);
  console.log("\n启发式策略:");
  console.log(`  胜率: ${(heuristicStats.winRate * 100).toFixed(1)}%`);
  console.log(`  50%胜利抽卡: ${format(heuristicStats.p50Draws)} 张`);
  console.log(`  70%胜利抽卡: ${format(heuristicStats.drawThreshold70)} 张`);
  console.log(`  50%胜利轮数: ${format(heuristicStats.p50Rounds)} 轮`);
  console.log(`  70%胜利轮数: ${format(heuristicStats.roundThreshold70)} 轮`);
}

if (require.main === module) {
  main();
}
