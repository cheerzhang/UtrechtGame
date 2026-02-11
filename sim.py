import random
import sys

time_slots = ["清晨", "上午", "正午", "傍晚", "深夜"]

locations = [
    {"name": "Dom Tower｜钟塔"},
    {"name": "Dom Square｜广场"},
    {"name": "Canal｜运河"},
    {"name": "Museum｜博物馆"},
    {"name": "Archive｜档案馆"},
    {"name": "Workshop｜工坊"},
]

state = {
    "time": {"modern": 0, "past": 0},
    "location": {"modern": None, "past": None},
    "inventory": {"modern": [], "past": []},
    "silenced": {"modern": False, "past": False},
    "extraShift": {"modern": 0, "past": 0},
    "freeze": {"modern": False, "past": False},
    "blockItemMods": {"modern": False, "past": False},
    "inEvent": False,
    "travelCooldown": {"past": 0},
    "roundStats": {"modern": {"gained": 0, "lost": 0}, "past": {"gained": 0, "lost": 0}},
    "nextFirst": "modern",
    "pendingChoice": {"modern": None, "past": None},
    "winner": None,
    "lastEvent": {"modern": None, "past": None},
    "configured": True,
    "totalPlayers": 4,
    "teamSize": {"modern": 2, "past": 2},
    "playerPos": {"modern": {"modern": 2, "past": 0}, "past": {"modern": 0, "past": 2}},
    "travelNoItem": {"modern": False, "past": False},
    "noModifyNextEvent": {"modern": False, "past": False},
    "eventDrawn": {"modern": False, "past": False},
    "bellTriggered": {"modern": False, "past": False},
    "blockItemModsRound": {"modern": False, "past": False},
    "totalDraws": 0,
    "totalRounds": 0,
    "phase": "modern_pick",
    "lockBy": None,
    "beforeEventApplied": {"modern": False, "past": False},
}


def other_team(team):
    return "past" if team == "modern" else "modern"


def can_modify_items(team):
    if not state["inEvent"]:
        return True
    return not (state["blockItemMods"][team] or state["blockItemModsRound"][team])


def add_item(team, item):
    if not can_modify_items(team):
        return
    state["inventory"][team].append(item)
    state["roundStats"][team]["gained"] += 1


def remove_one_item(team, item):
    if not can_modify_items(team):
        return False
    inv = state["inventory"][team]
    if item not in inv:
        return False
    inv.remove(item)
    state["roundStats"][team]["lost"] += 1
    return True


def count_item(team, item):
    return state["inventory"][team].count(item)


def has_item(team, item):
    return item in state["inventory"][team]


def has_bell_any(team):
    return "铃铛" in state["inventory"][team]


def has_basic_supplies():
    return True


def lose_random_item(team):
    if not can_modify_items(team):
        return
    inv = state["inventory"][team]
    if not inv:
        return
    idx = random.randrange(len(inv))
    inv.pop(idx)
    state["roundStats"][team]["lost"] += 1


def trade_item(team):
    inv = state["inventory"][team]
    if not inv:
        return
    idx = random.randrange(len(inv))
    given = inv.pop(idx)
    state["roundStats"][team]["lost"] += 1
    add_item(other_team(team), given)


def shift_time(team, delta):
    state["time"][team] = (state["time"][team] + delta + len(time_slots)) % len(time_slots)


def team_on_home_timeline(team):
    if team == "modern":
        return state["playerPos"]["modern"]["modern"] == state["teamSize"]["modern"]
    return state["playerPos"]["past"]["past"] == state["teamSize"]["past"]


def can_win_now(team):
    opponent = other_team(team)
    opponent_dom = state["location"][opponent] in ("Dom Tower｜钟塔", "Dom Square｜广场")
    same_time = state["time"][team] == state["time"][opponent]
    return has_bell_any(team) and opponent_dom and same_time and team_on_home_timeline(team)


def travel_one(team, to_timeline):
    if team == "modern":
        if to_timeline == "past" and state["playerPos"]["modern"]["modern"] > 0:
            state["playerPos"]["modern"]["modern"] -= 1
            state["playerPos"]["modern"]["past"] += 1
            state["travelNoItem"]["modern"] = False
            return
        if to_timeline == "modern" and state["playerPos"]["modern"]["past"] > 0:
            state["playerPos"]["modern"]["past"] -= 1
            state["playerPos"]["modern"]["modern"] += 1
            state["travelNoItem"]["modern"] = False
            return
        return
    if to_timeline == "modern" and state["playerPos"]["past"]["past"] > 0:
        state["playerPos"]["past"]["past"] -= 1
        state["playerPos"]["past"]["modern"] += 1
        state["travelNoItem"]["past"] = False
        return
    if to_timeline == "past" and state["playerPos"]["past"]["modern"] > 0:
        state["playerPos"]["past"]["modern"] -= 1
        state["playerPos"]["past"]["past"] += 1
        state["travelNoItem"]["past"] = False


def set_silenced(team):
    state["silenced"][team] = True


def require_past_presence(team):
    if state["playerPos"][team]["past"] == 0:
        return False
    return True


def require_modern_presence(team):
    if state["playerPos"][team]["modern"] == 0:
        return False
    return True


def ring_bell(team):
    if not has_bell_any(team):
        return
    if state["silenced"][team]:
        return
    state["bellTriggered"][team] = True
    if not team_on_home_timeline(team):
        return
    opponent = other_team(team)
    opponent_dom = state["location"][opponent] in ("Dom Tower｜钟塔", "Dom Square｜广场")
    same_time = state["time"][team] == state["time"][opponent]
    if opponent_dom and same_time:
        state["winner"] = team


def pick_location(team, location_name):
    state["location"][team] = location_name


def apply_location_effect_before_event(team):
    loc = state["location"][team]
    if not loc:
        return
    if loc == "Archive｜档案馆":
        if team == "past":
            if "石头" in state["inventory"]["past"]:
                state["pendingChoice"]["past"] = {"type": "archive_past_convert"}
            else:
                shift_time("past", 1)
        if team == "modern":
            if "文件" in state["inventory"]["modern"]:
                state["pendingChoice"]["modern"] = {"type": "archive_modern_convert"}
            else:
                state["blockItemMods"]["modern"] = True
    if loc == "Workshop｜工坊":
        if team == "past":
            if state["travelCooldown"]["past"] > 0:
                return
            state["pendingChoice"]["past"] = {"type": "workshop_past_travel"}
        if team == "modern":
            state["pendingChoice"]["modern"] = {"type": "workshop_modern_travel"}
    if loc == "Dom Tower｜钟塔":
        if team == "past" and "石头" in state["inventory"]["past"] and "文件" in state["inventory"]["past"]:
            state["pendingChoice"]["past"] = {"type": "domtower_past_bell"}
        if team == "modern" and "钥匙" in state["inventory"]["modern"]:
            state["pendingChoice"]["modern"] = {"type": "domtower_modern_ring"}


def apply_location_effect_after_event(team):
    loc = state["location"][team]
    if not loc:
        return
    if state["pendingChoice"][team]:
        return
    if loc == "Canal｜运河":
        if team == "past":
            if "石头" in state["inventory"]["past"]:
                remove_one_item("past", "石头")
            else:
                state["pendingChoice"]["past"] = {"type": "canal_past_gain"}
        if team == "modern":
            state["pendingChoice"]["modern"] = {"type": "canal_modern_gain"}
    if loc == "Museum｜博物馆":
        if team == "past":
            if "文件" in state["inventory"]["past"]:
                remove_one_item("past", "文件")
        if team == "modern":
            had_two = count_item(team, "文件") >= 2
            add_item(team, "文件")
            if had_two:
                state["pendingChoice"][team] = {"type": "discard_any"}
    if loc == "Dom Square｜广场":
        if team == "past" and state["roundStats"]["past"]["gained"] == 0:
            state["pendingChoice"]["past"] = {"type": "domsquare_past_freeze"}
        if team == "modern" and state["roundStats"]["modern"]["lost"] >= 1:
            state["pendingChoice"]["modern"] = {"type": "domsquare_modern_ring"}
    if loc == "Dom Tower｜钟塔":
        return


def has_pre_event_location_action(team):
    loc = state["location"][team]
    return loc in ("Archive｜档案馆", "Workshop｜工坊", "Dom Tower｜钟塔")


def handle_choice(team, choice, item=None):
    pending = state["pendingChoice"][team]
    if not pending:
        return
    ptype = pending["type"]
    if ptype == "canal_past_gain":
        if choice == "gain":
            add_item(team, "石头")
    if ptype == "canal_modern_gain":
        if choice == "gain":
            add_item(team, "石头")
            shift_time(other_team(team), 1)
    if ptype == "museum_modern_gain":
        if choice == "gain":
            had_two = count_item(team, "文件") >= 2
            add_item(team, "文件")
            if had_two:
                state["pendingChoice"][team] = {"type": "discard_any"}
                return
    if ptype == "archive_past_convert":
        if choice == "convert":
            if remove_one_item(team, "石头"):
                add_item(team, "文件")
    if ptype == "archive_modern_convert":
        if choice == "convert":
            if remove_one_item(team, "文件"):
                add_item(team, "钥匙")
        if choice == "skip":
            state["blockItemMods"]["modern"] = True
    if ptype == "workshop_past_travel":
        if choice == "travel":
            state["time"]["past"] = state["time"]["modern"]
            travel_one("past", "modern")
            state["travelCooldown"]["past"] = 2
            state["travelNoItem"]["past"] = False
    if ptype == "workshop_modern_travel":
        if choice == "travel_no_item":
            state["time"]["modern"] = state["time"]["past"]
            travel_one("modern", "past")
            state["travelNoItem"]["modern"] = False
        if choice == "travel_item":
            if state["travelNoItem"]["modern"]:
                return
            if state["inventory"]["modern"]:
                state["pendingChoice"][team] = {"type": "workshop_modern_item"}
                return
    if ptype == "workshop_modern_item":
        if choice == "carry" and item is not None:
            if remove_one_item(team, item):
                state["inventory"]["past"].append(item)
                state["time"]["modern"] = state["time"]["past"]
                shift_time("modern", 1)
                travel_one("modern", "past")
                state["travelNoItem"]["modern"] = False
    if ptype == "domsquare_past_freeze":
        if choice == "freeze":
            state["freeze"]["past"] = True
    if ptype == "domsquare_modern_ring":
        if choice == "ring":
            ring_bell("modern")
    if ptype == "domtower_past_bell":
        if choice == "gain":
            add_item("past", "铃铛")
    if ptype == "domtower_modern_ring":
        if choice == "ring":
            ring_bell("modern")
    if ptype == "discard_any":
        if choice == "discard" and item is not None:
            remove_one_item(team, item)
    if ptype == "event_maintenance_choice":
        if choice == "lose_stone":
            if remove_one_item(team, "石头"):
                trade_item(other_team(team))
        if choice == "modern_plus":
            shift_time("modern", 1)
    if ptype == "event_first_bell_choice":
        if choice == "send_bell":
            if remove_one_item(team, "铃铛"):
                add_item("modern", "铃铛")
            shift_time("past", 1)
    if ptype == "event_build_continue_choice":
        if choice == "travel_no_item":
            if team == "modern":
                state["time"]["modern"] = state["time"]["past"]
                travel_one("modern", "past")
            else:
                state["time"]["past"] = state["time"]["modern"]
                travel_one("past", "modern")
        if choice == "travel_item":
            if state["inventory"][team]:
                state["pendingChoice"][team] = {"type": "event_build_continue_item"}
                return
    if ptype == "event_build_continue_item":
        if choice == "carry" and item is not None:
            if remove_one_item(team, item):
                add_item("modern", item)
                if team == "modern":
                    state["time"]["modern"] = state["time"]["past"]
                    travel_one("modern", "past")
                else:
                    state["time"]["past"] = state["time"]["modern"]
                    travel_one("past", "modern")
    if ptype == "event_fix_fail_choice":
        if choice == "travel_no_item":
            state["time"]["modern"] = state["time"]["past"]
            travel_one(team, "past")
        if choice == "travel_item":
            if state["inventory"][team]:
                state["pendingChoice"][team] = {"type": "event_fix_fail_item"}
                return
    if ptype == "event_fix_fail_item":
        if choice == "carry" and item is not None:
            if remove_one_item(team, item):
                add_item("past", item)
                state["time"]["modern"] = state["time"]["past"]
                travel_one(team, "past")
    if ptype == "event_memory_choice":
        if choice == "gain_bell":
            add_item(team, "铃铛")
        if choice == "travel_item":
            if state["inventory"][team]:
                state["pendingChoice"][team] = {"type": "event_memory_item"}
                return
    if ptype == "event_calibration_choice":
        if choice == "travel_no_item":
            if team == "modern":
                state["time"]["modern"] = state["time"]["past"]
            travel_one(team, "past")
    if ptype == "event_memory_item":
        if choice == "carry" and item is not None:
            if remove_one_item(team, item):
                add_item("modern", item)
                state["time"]["past"] = state["time"]["modern"]
                travel_one("past", "modern")
    if ptype == "event_system_test_choice":
        if choice == "ring":
            ring_bell(team)
            shift_time("modern", 1)
    if ptype == "event_error_choice":
        if choice == "gain_stone":
            add_item(team, "石头")
            state["travelNoItem"][team] = True
        if choice == "freeze_past":
            state["freeze"]["past"] = True
    if ptype == "event_city_error_choice":
        if choice == "lose_stone":
            remove_one_item(team, "石头")
        if choice == "send_item":
            if state["inventory"][team]:
                state["pendingChoice"][team] = {"type": "event_city_error_item"}
                return
    if ptype == "event_city_error_item":
        if choice == "carry" and item is not None:
            if remove_one_item(team, item):
                add_item("modern", item)
    if ptype == "event_oldcity_choice":
        if choice == "carry" and item is not None:
            removed_file = remove_one_item(team, "文件")
            removed_other = remove_one_item(team, item)
            if removed_file and removed_other:
                add_item("modern", "文件")
                add_item("modern", item)
                state["time"]["past"] = state["time"]["modern"]
                travel_one("past", "modern")
            else:
                if removed_other:
                    add_item(team, item)
                if removed_file:
                    add_item(team, "文件")
    state["pendingChoice"][team] = None


# Event deck

def event_deck():
    return [
        {"title": "钟尚未存在", "effect": lambda team: (add_item(team, "铃铛") if require_past_presence(team) and state["location"][team] == "Dom Tower｜钟塔" else (add_item(team, "石头") if require_past_presence(team) else None))},
        {"title": "工匠的第一块石料", "effect": lambda team: (remove_one_item(team, "石头") if require_past_presence(team) and count_item(team, "石头") >= 2 else (add_item(team, "石头"), add_item(team, "石头")) if require_past_presence(team) else None)},
        {"title": "误差", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_error_choice"}) if require_past_presence(team) else None},
        {"title": "第一次敲击", "effect": lambda team: (add_item(team, "铃铛"), state["pendingChoice"].__setitem__(team, {"type": "event_first_bell_choice"})) if require_past_presence(team) else None},
        {"title": "没有记录的日子", "effect": lambda team: (remove_one_item(team, "文件") if count_item(team, "文件") >= 1 else add_item(team, "石头")) if require_past_presence(team) else None},
        {"title": "水位上涨", "effect": lambda team: (add_item(team, "石头") if state["location"][team] == "Canal｜运河" else (remove_one_item(team, "石头") if "石头" in state["inventory"][team] else None)) if require_past_presence(team) else None},
        {"title": "旧城塌陷", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_oldcity_choice"}) if require_past_presence(team) and count_item(team, "文件") >= 1 and [i for i in state["inventory"][team] if i != "文件"] else None},
        {"title": "钟声被误解", "effect": lambda team: (add_item(team, "铃铛") if state["location"][team] == "Dom Square｜广场" else set_silenced(team)) if require_past_presence(team) else None},
        {"title": "建造继续", "effect": lambda team: (add_item(team, "石头"), state["pendingChoice"].__setitem__(team, {"type": "event_build_continue_choice"}) if state["location"][team] == "Workshop｜工坊" else None) if require_past_presence(team) else None},
        {"title": "城市记住了错误", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_city_error_choice"}) if require_past_presence(team) else None},
        {"title": "准备完成", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_memory_choice"}) if require_past_presence(team) and count_item(team, "石头") >= 1 and count_item(team, "文件") >= 1 else (add_item(team, "石头") if require_past_presence(team) else None)},
        {"title": "时间留下的不是答案", "effect": lambda team: (state["freeze"].__setitem__("past", True), shift_time("modern", 1)) if require_past_presence(team) else None},
        {"title": "被整理的历史", "effect": lambda team: (add_item(team, "文件"), state["pendingChoice"].__setitem__(team, {"type": "discard_any"}) if count_item(team, "文件") >= 2 else None) if require_modern_presence(team) else None},
        {"title": "记录不完整", "effect": lambda team: (remove_one_item(team, "文件") if count_item(team, "文件") >= 1 else state["freeze"].__setitem__("modern", True)) if require_modern_presence(team) else None},
        {"title": "校准尝试", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_calibration_choice"}) if require_modern_presence(team) and not has_bell_any(team) else None},
        {"title": "错误的解读", "effect": lambda team: (remove_one_item(team, "文件") if state["location"][team] in ("Museum｜博物馆", "Archive｜档案馆") else add_item(team, "文件")) if require_modern_presence(team) else None},
        {"title": "维护", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_maintenance_choice"}) if require_modern_presence(team) else None},
        {"title": "时间差", "effect": lambda team: (shift_time("modern", 2) if state["time"]["modern"] == state["time"]["past"] else state["freeze"].__setitem__("modern", True)) if require_modern_presence(team) else None},
        {"title": "终于听见", "effect": lambda team: (ring_bell(team) if has_bell_any(team) and not state["bellTriggered"]["past"] else state["freeze"].__setitem__("modern", True)) if require_modern_presence(team) else None},
        {"title": "理解带来的负担", "effect": lambda team: (shift_time("modern", 1) if count_item(team, "文件") >= 3 else add_item(team, "文件")) if require_modern_presence(team) else None},
        {"title": "修复失败", "effect": lambda team: (state["blockItemModsRound"].__setitem__(team, True), state["pendingChoice"].__setitem__(team, {"type": "event_fix_fail_choice"}) if state["location"][team] == "Workshop｜工坊" else None) if require_modern_presence(team) else None},
        {"title": "误以为已经完成", "effect": lambda team: (lose_random_item(team) if len(state["inventory"][team]) != len(state["inventory"][other_team(team)]) else add_item(team, "文件")) if require_modern_presence(team) else None},
        {"title": "系统测试", "effect": lambda team: state["pendingChoice"].__setitem__(team, {"type": "event_system_test_choice"}) if require_modern_presence(team) and has_bell_any(team) else None},
        {"title": "访客", "effect": lambda team: (remove_one_item(team, "文件") if count_item(team, "文件") >= 2 else add_item(team, "钥匙")) if require_modern_presence(team) else None},
    ]


event_cards = event_deck()
PAST_EVENT_COUNT = 12
for idx, card in enumerate(event_cards):
    card["targetTeam"] = "past" if idx < PAST_EVENT_COUNT else "modern"


def draw_event(team):
    if state["pendingChoice"]["modern"] or state["pendingChoice"]["past"]:
        return
    card = random.choice(event_cards)
    actor_team = card.get("targetTeam", team)
    state["lastEvent"][team] = card
    state["inEvent"] = True
    if state["noModifyNextEvent"][team]:
        state["blockItemMods"][team] = True
        state["noModifyNextEvent"][team] = False
    card["effect"](actor_team)
    state["inEvent"] = False
    state["blockItemMods"][team] = False
    apply_location_effect_after_event(team)
    state["eventDrawn"][team] = True
    state["totalDraws"] += 1
    if state["extraShift"][team]:
        shift_time(team, state["extraShift"][team])
        state["extraShift"][team] = 0


def advance_time(team):
    if state["freeze"][team]:
        state["freeze"][team] = False
        return
    shift_time(team, 1)


def reset_round():
    state["silenced"]["modern"] = False
    state["silenced"]["past"] = False
    state["bellTriggered"]["modern"] = False
    state["bellTriggered"]["past"] = False
    state["blockItemModsRound"]["modern"] = False
    state["blockItemModsRound"]["past"] = False
    state["lockBy"] = None
    state["totalRounds"] += 1
    if state["travelCooldown"]["past"] > 0:
        state["travelCooldown"]["past"] -= 1
    state["roundStats"] = {"modern": {"gained": 0, "lost": 0}, "past": {"gained": 0, "lost": 0}}
    state["phase"] = "modern_pick" if state["nextFirst"] == "modern" else "past_pick"


def end_turn(team):
    if team == "modern":
        advance_time("modern")
        state["phase"] = "past_pick"
        return
    advance_time("past")
    reset_round()


def enter_event_phase(team):
    state["phase"] = "modern_event" if team == "modern" else "past_event"
    state["eventDrawn"][team] = False
    state["beforeEventApplied"][team] = False


def location_selectable(team, name):
    other = other_team(team)
    if state["location"][other] == name:
        return False
    if state["lockBy"] and state["lockBy"] != team and state["location"][other] == name:
        return False
    return True


def reset_game():
    state["time"] = {"modern": 0, "past": 0}
    state["location"] = {"modern": None, "past": None}
    state["inventory"] = {"modern": [], "past": []}
    state["silenced"] = {"modern": False, "past": False}
    state["extraShift"] = {"modern": 0, "past": 0}
    state["freeze"] = {"modern": False, "past": False}
    state["blockItemMods"] = {"modern": False, "past": False}
    state["inEvent"] = False
    state["travelCooldown"] = {"past": 0}
    state["roundStats"] = {"modern": {"gained": 0, "lost": 0}, "past": {"gained": 0, "lost": 0}}
    state["nextFirst"] = "modern"
    state["pendingChoice"] = {"modern": None, "past": None}
    state["phase"] = "modern_pick"
    state["winner"] = None
    state["lastEvent"] = {"modern": None, "past": None}
    state["playerPos"] = {
        "modern": {"modern": state["teamSize"]["modern"], "past": 0},
        "past": {"modern": 0, "past": state["teamSize"]["past"]},
    }
    state["travelNoItem"] = {"modern": False, "past": False}
    state["noModifyNextEvent"] = {"modern": False, "past": False}
    state["eventDrawn"] = {"modern": False, "past": False}
    state["bellTriggered"] = {"modern": False, "past": False}
    state["blockItemModsRound"] = {"modern": False, "past": False}
    state["beforeEventApplied"] = {"modern": False, "past": False}
    state["totalDraws"] = 0
    state["totalRounds"] = 0


def step_with_policy(policy):
    if state["winner"]:
        return
    team = "modern" if state["phase"].startswith("modern") else "past"
    pending_team = team if state["pendingChoice"][team] else other_team(team) if state["pendingChoice"][other_team(team)] else None
    if pending_team:
        policy.resolve_choice(pending_team, state["pendingChoice"][pending_team])
        return
    if state["phase"].endswith("pick"):
        policy.pick_location(team)
        enter_event_phase(team)
        return
    if state["phase"].endswith("event"):
        if not state["beforeEventApplied"][team] and has_pre_event_location_action(team):
            apply_location_effect_before_event(team)
            state["beforeEventApplied"][team] = True
            return
        if not state["eventDrawn"][team]:
            draw_event(team)
            return
        end_turn(team)


def run_game(policy, max_draws, max_rounds):
    reset_game()
    while not state["winner"] and state["totalDraws"] < max_draws and state["totalRounds"] < max_rounds:
        step_with_policy(policy)
    return {
        "winner": state["winner"],
        "draws": state["totalDraws"],
        "rounds": state["totalRounds"],
    }


def percentile(samples, p):
    if not samples:
        return None
    samples = sorted(samples)
    idx = min(len(samples) - 1, max(0, int(p * len(samples))))
    return samples[idx]


def find_threshold_overall(samples, target_rate, total_games):
    if not samples:
        return None
    target = int(target_rate * total_games + 0.999999)
    if len(samples) < target:
        return None
    samples = sorted(samples)
    return samples[target - 1]


def run_batch(policy, games, max_draws, max_rounds):
    wins = 0
    win_draws = []
    win_rounds = []
    for _ in range(games):
        result = run_game(policy, max_draws, max_rounds)
        if result["winner"]:
            wins += 1
            win_draws.append(result["draws"])
            win_rounds.append(result["rounds"])
    win_rate = wins / games
    return {
        "winRate": win_rate,
        "winDraws": win_draws,
        "winRounds": win_rounds,
        "p50Draws": percentile(win_draws, 0.5),
        "p80Draws": percentile(win_draws, 0.8),
        "p50Rounds": percentile(win_rounds, 0.5),
        "p80Rounds": percentile(win_rounds, 0.8),
        "drawThreshold70": find_threshold_overall(win_draws, 0.7, games),
        "roundThreshold70": find_threshold_overall(win_rounds, 0.7, games),
    }


class RandomPolicy:
    def pick_location(self, team):
        choices = [loc for loc in locations if location_selectable(team, loc["name"])]
        if choices:
            pick_location(team, random.choice(choices)["name"])

    def resolve_choice(self, team, pending):
        items = state["inventory"][team]
        any_item = random.choice(items) if items else None
        ptype = pending["type"]
        if ptype == "canal_past_gain":
            return handle_choice(team, "gain" if random.random() < 0.5 else "skip")
        if ptype == "canal_modern_gain":
            return handle_choice(team, "gain" if random.random() < 0.5 else "skip")
        if ptype == "museum_modern_gain":
            return handle_choice(team, "gain" if random.random() < 0.5 else "skip")
        if ptype == "archive_past_convert":
            return handle_choice(team, "convert" if random.random() < 0.5 else "skip")
        if ptype == "archive_modern_convert":
            return handle_choice(team, "convert" if random.random() < 0.5 else "skip")
        if ptype == "workshop_past_travel":
            return handle_choice(team, "travel" if random.random() < 0.5 else "skip")
        if ptype == "workshop_modern_travel":
            return handle_choice(team, "travel_no_item" if random.random() < 0.5 else "skip")
        if ptype == "workshop_modern_item":
            return handle_choice(team, "carry", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "domsquare_past_freeze":
            return handle_choice(team, "freeze" if random.random() < 0.5 else "skip")
        if ptype == "domsquare_modern_ring":
            return handle_choice(team, "ring" if random.random() < 0.5 else "skip")
        if ptype == "domtower_past_bell":
            return handle_choice(team, "gain" if random.random() < 0.5 else "skip")
        if ptype == "domtower_modern_ring":
            return handle_choice(team, "ring" if random.random() < 0.5 else "skip")
        if ptype == "discard_any":
            return handle_choice(team, "discard", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "event_maintenance_choice":
            return handle_choice(team, "lose_stone" if random.random() < 0.5 else "modern_plus")
        if ptype == "event_first_bell_choice":
            return handle_choice(team, "send_bell" if random.random() < 0.5 else "keep_bell")
        if ptype == "event_build_continue_choice":
            return handle_choice(team, "travel_no_item" if random.random() < 0.5 else "travel_item")
        if ptype == "event_build_continue_item":
            return handle_choice(team, "carry", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "event_fix_fail_choice":
            return handle_choice(team, "travel_no_item" if random.random() < 0.5 else "travel_item")
        if ptype == "event_fix_fail_item":
            return handle_choice(team, "carry", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "event_memory_choice":
            return handle_choice(team, "gain_bell" if random.random() < 0.5 else "travel_item")
        if ptype == "event_memory_item":
            return handle_choice(team, "carry", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "event_calibration_choice":
            return handle_choice(team, "travel_no_item" if random.random() < 0.5 else "skip")
        if ptype == "event_system_test_choice":
            return handle_choice(team, "ring" if random.random() < 0.5 else "skip")
        if ptype == "event_error_choice":
            return handle_choice(team, "gain_stone" if random.random() < 0.5 else "freeze_past")
        if ptype == "event_city_error_choice":
            return handle_choice(team, "lose_stone" if random.random() < 0.5 else "send_item")
        if ptype == "event_city_error_item":
            return handle_choice(team, "carry", any_item) if any_item else handle_choice(team, "skip")
        if ptype == "event_oldcity_choice":
            if any_item:
                return handle_choice(team, "carry" if random.random() < 0.5 else "skip", any_item)
            return handle_choice(team, "skip")
        return handle_choice(team, "skip")


class HeuristicPolicy:
    def pick_location(self, team):
        choices = [loc for loc in locations if location_selectable(team, loc["name"])]
        if not choices:
            return
        # Aggressive early plan: prioritize bell + endgame positions, de-emphasize resource collection.
        need_stone = (not has_item("modern", "石头")) or (not has_item("past", "石头"))
        need_file = (not has_item("modern", "文件")) or (not has_item("past", "文件"))
        need_key = (not has_item("modern", "钥匙")) or (not has_item("past", "钥匙"))
        modern_has_bell = has_bell_any("modern")
        past_has_bell = has_bell_any("past")
        early_bell = not modern_has_bell
        home_ready = team_on_home_timeline("modern") and team_on_home_timeline("past")
        rush_win_ready = modern_has_bell and has_item("modern", "钥匙") and home_ready
        ready_setup_modern = rush_win_ready
        ready_setup_past = has_basic_supplies() and past_has_bell and home_ready
        times_synced = state["time"]["modern"] == state["time"]["past"]
        slots = len(time_slots)
        delta_modern = (state["time"]["modern"] - state["time"]["past"] + slots) % slots
        past_ahead = delta_modern == 4
        past_ahead_wide = delta_modern in (3, 4)
        win_ready = ready_setup_modern
        plan_modern = "Dom Tower｜钟塔" if win_ready else None
        plan_past = "Dom Square｜广场" if win_ready else None

        # Hard overrides for aggressive play
        if early_bell:
            if team == "past":
                prefer = "Dom Tower｜钟塔" if any(c["name"] == "Dom Tower｜钟塔" for c in choices) else None
                if not prefer and any(c["name"] == "Dom Square｜广场" for c in choices):
                    prefer = "Dom Square｜广场"
                if prefer:
                    pick_location(team, prefer)
                    return
            if team == "modern":
                if any(c["name"] == "Dom Square｜广场" for c in choices):
                    pick_location(team, "Dom Square｜广场")
                    return

        if win_ready and times_synced:
            if team == "modern" and any(c["name"] == "Dom Tower｜钟塔" for c in choices):
                pick_location(team, "Dom Tower｜钟塔")
                return
            if team == "past" and any(c["name"] == "Dom Square｜广场" for c in choices):
                pick_location(team, "Dom Square｜广场")
                return

        def score_location(loc):
            score = 0
            want_dom_for_opponent = (ready_setup_modern and team == "past") or (ready_setup_past and team == "modern")
            prefer_sync = not times_synced
            if ready_setup_modern:
                if team == "modern" and loc["name"] == "Dom Tower｜钟塔":
                    score += 30
                if team == "past" and loc["name"] == "Dom Square｜广场":
                    score += 30
                if team == "modern" and loc["name"] == "Dom Square｜广场":
                    score -= 10
                if team == "past" and loc["name"] == "Dom Tower｜钟塔":
                    score -= 10
            if ready_setup_past:
                if team == "modern" and loc["name"] == "Dom Square｜广场":
                    score += 10
                if team == "past" and loc["name"] == "Dom Square｜广场":
                    score -= 4
            if win_ready:
                if team == "modern" and loc["name"] == plan_modern:
                    score += 26
                if team == "past" and loc["name"] == plan_past:
                    score += 26
                if team == "modern" and loc["name"] == plan_past:
                    score -= 12
                if team == "past" and loc["name"] == plan_modern:
                    score -= 12
            if win_ready and times_synced:
                if team == "modern" and loc["name"] == "Dom Tower｜钟塔":
                    score += 24
                if team == "past" and loc["name"] == "Dom Square｜广场":
                    score += 24

            if loc["name"] == "Canal｜运河" and need_stone:
                score += 1
            if loc["name"] == "Museum｜博物馆" and need_file and team == "modern":
                score += 1
            if loc["name"] == "Archive｜档案馆" and team == "modern" and count_item(team, "文件") >= 1:
                score += 8 if need_key else 4
            if loc["name"] == "Archive｜档案馆" and team == "past" and count_item(team, "石头") >= 1:
                score += 1
            if loc["name"] == "Dom Tower｜钟塔":
                score -= 4
            if loc["name"] == "Workshop｜工坊":
                score -= 6

            if early_bell:
                if team == "past" and not past_has_bell and loc["name"] == "Dom Tower｜钟塔":
                    score += 32
                if team == "past" and not past_has_bell and loc["name"] == "Dom Square｜广场":
                    score += 22
                if team == "past" and past_has_bell and loc["name"] == "Workshop｜工坊":
                    score += 22

            if not times_synced:
                if team == "modern" and 1 <= delta_modern <= 3 and loc["name"] == "Canal｜运河":
                    score += 5
                if team == "modern" and past_ahead and loc["name"] == "Canal｜运河":
                    score -= 5
                if team == "past" and past_ahead_wide and loc["name"] == "Dom Square｜广场":
                    score += 5
                if team == "modern" and past_ahead and loc["name"] == "Dom Square｜广场":
                    score += 3

            if loc["name"] == "Dom Tower｜钟塔":
                if team == "past" and count_item(team, "石头") >= 1 and count_item(team, "文件") >= 1:
                    score += 5
                if has_bell_any(team) and state["location"][other_team(team)] == "Dom Tower｜钟塔":
                    score += 4
                if want_dom_for_opponent:
                    score += 16
                if has_bell_any(team):
                    score -= 6
            if loc["name"] == "Dom Square｜广场" and want_dom_for_opponent:
                score += 16
            if win_ready and not times_synced:
                if team == "modern" and loc["name"] == "Dom Tower｜钟塔":
                    score += 10
                if team == "past" and loc["name"] == "Dom Square｜广场":
                    score += 10

            if loc["name"] == "Workshop｜工坊" and team == "past" and has_bell_any("past") and not has_bell_any("modern"):
                score += 16
            if loc["name"] == "Archive｜档案馆":
                if team == "past" and count_item(team, "石头") >= 1:
                    score += 3
                if team == "modern" and count_item(team, "文件") >= 1:
                    score += 3
                if team == "modern" and not has_item("modern", "钥匙") and count_item(team, "文件") >= 1:
                    score += 6
            if loc["name"] == "Museum｜博物馆" and team == "modern":
                score += 2
            if loc["name"] == "Canal｜运河":
                score += 1
            if loc["name"] == "Dom Square｜广场":
                score += 1
            if loc["name"] == "Workshop｜工坊":
                score += 1
            if prefer_sync and loc["name"] == "Dom Square｜广场":
                score += 2
            if ready_setup_modern and team == "modern" and loc["name"] == "Dom Tower｜钟塔":
                score += 28
            if not modern_has_bell and team == "past" and loc["name"] == "Dom Tower｜钟塔":
                score += 2

            return score

        best = choices[0]
        best_score = -1
        for loc in choices:
            score = score_location(loc)
            if score > best_score:
                best_score = score
                best = loc
        current_name = state["location"][team]
        current = next((l for l in locations if l["name"] == current_name), None) if current_name else None
        current_score = score_location(current) if current else -1
        switch_threshold = 2 if win_ready else 1
        if not current or best_score >= current_score + switch_threshold:
            pick_location(team, best["name"])

    def resolve_choice(self, team, pending):
        rush_win_ready = has_bell_any("modern") and has_item("modern", "钥匙") and team_on_home_timeline("modern") and team_on_home_timeline("past")
        collect_phase = (not has_basic_supplies()) and (not rush_win_ready)
        slots = len(time_slots)
        delta_modern = (state["time"]["modern"] - state["time"]["past"] + slots) % slots
        past_ahead = delta_modern == 4
        modern_ahead = delta_modern == 1
        past_ahead_wide = delta_modern in (3, 4)
        time_synced = state["time"]["modern"] == state["time"]["past"]
        opponent_at_dom = state["location"][other_team("modern")] in ("Dom Tower｜钟塔", "Dom Square｜广场")
        ring_opportunity = (
            team == "modern"
            and state["location"]["modern"] == "Dom Square｜广场"
            and has_bell_any("modern")
            and time_synced
            and opponent_at_dom
            and team_on_home_timeline("modern")
            and has_basic_supplies()
        )
        fast_win_ready = rush_win_ready and time_synced
        stone_safe = count_item(team, "石头") >= 2 or (team == "modern" and has_item("past", "石头")) or (team == "past" and has_item("modern", "石头"))
        file_safe = count_item(team, "文件") >= 2 or (team == "modern" and has_item("past", "文件")) or (team == "past" and has_item("modern", "文件"))
        key_safe = count_item(team, "钥匙") >= 2 or (team == "modern" and has_item("past", "钥匙")) or (team == "past" and has_item("modern", "钥匙"))
        def pick_for_modern(items):
            if not items:
                return None
            if not has_bell_any("modern") and "铃铛" in items:
                return "铃铛"
            if "钥匙" in items:
                return "钥匙"
            return random.choice(items)
        ptype = pending["type"]
        if ptype in ("domsquare_modern_ring", "domtower_modern_ring"):
            return handle_choice(team, "ring") if has_bell_any(team) and can_win_now(team) else handle_choice(team, "skip")
        if ptype == "canal_past_gain":
            return handle_choice(team, "gain")
        if ptype == "canal_modern_gain":
            need_stone = (not has_item("modern", "石头")) or (not has_item("past", "石头"))
            if rush_win_ready:
                return handle_choice(team, "skip")
            if need_stone or 1 <= delta_modern <= 3:
                return handle_choice(team, "gain")
            if not time_synced and past_ahead:
                return handle_choice(team, "skip")
            return handle_choice(team, "gain")
        if ptype == "museum_modern_gain":
            return handle_choice(team, "skip" if rush_win_ready else "gain")
        if ptype == "archive_past_convert":
            return handle_choice(team, "convert")
        if ptype == "archive_modern_convert":
            return handle_choice(team, "skip" if rush_win_ready else "convert")
        if ptype == "workshop_past_travel":
            return handle_choice(team, "skip")
        if ptype == "workshop_modern_travel":
            return handle_choice(team, "skip")
        if ptype == "workshop_modern_item":
            items = state["inventory"][team]
            if items:
                return handle_choice(team, "carry", random.choice(items))
            return handle_choice(team, "skip")
        if ptype == "domsquare_past_freeze":
            return handle_choice(team, "freeze") if past_ahead_wide else handle_choice(team, "skip")
        if ptype == "domtower_past_bell":
            return handle_choice(team, "gain")
        if ptype == "discard_any":
            items = state["inventory"][team]
            if not items:
                return handle_choice(team, "skip")
            other = other_team(team)
            def score_item(item):
                if item == "铃铛":
                    if team == "past" and not has_bell_any("modern"):
                        return -10
                    return -10 if has_bell_any(team) and count_item(team, "铃铛") == 1 else 1
                if item == "石头":
                    return (3 if stone_safe else -3) + (2 if has_item(other, "石头") else 0)
                if item == "文件":
                    return (3 if file_safe else -3) + (2 if has_item(other, "文件") else 0)
                if item == "钥匙":
                    return (3 if key_safe else -3) + (2 if has_item(other, "钥匙") else 0)
                return 0
            pick = sorted(items, key=score_item, reverse=True)[0]
            return handle_choice(team, "discard", pick)
        if ptype == "event_maintenance_choice":
            if ring_opportunity and count_item(team, "石头") >= 1:
                return handle_choice(team, "lose_stone")
            if team == "modern" and count_item(team, "石头") >= 1 and not has_bell_any("modern") and (has_bell_any("past") or has_item("past", "钥匙")):
                return handle_choice(team, "lose_stone")
            if team == "modern" and count_item(team, "石头") >= 1 and not has_item("modern", "钥匙") and has_item("past", "钥匙"):
                return handle_choice(team, "lose_stone")
            if modern_ahead:
                return handle_choice(team, "lose_stone")
            if not time_synced:
                return handle_choice(team, "modern_plus")
            if not stone_safe:
                return handle_choice(team, "modern_plus")
            return handle_choice(team, "lose_stone")
        if ptype == "event_first_bell_choice":
            return handle_choice(team, "send_bell") if not has_bell_any("modern") else handle_choice(team, "keep_bell")
        if ptype == "event_build_continue_choice":
            if rush_win_ready:
                return handle_choice(team, "skip")
            if team == "past" and has_bell_any("past") and not has_bell_any("modern"):
                return handle_choice(team, "travel_item")
            carry_to_modern = (not has_item("modern", "石头")) or (not has_item("modern", "文件")) or (not has_item("modern", "钥匙"))
            if team == "past" and carry_to_modern and state["inventory"][team]:
                return handle_choice(team, "travel_item")
            return handle_choice(team, "skip")
        if ptype == "event_build_continue_item":
            items = state["inventory"][team]
            if items:
                if team == "past":
                    return handle_choice(team, "carry", pick_for_modern(items))
                return handle_choice(team, "carry", random.choice(items))
            return handle_choice(team, "skip")
        if ptype == "event_fix_fail_choice":
            return handle_choice(team, "skip")
        if ptype == "event_fix_fail_item":
            items = state["inventory"][team]
            if items:
                return handle_choice(team, "carry", random.choice(items))
            return handle_choice(team, "skip")
        if ptype == "event_memory_choice":
            if rush_win_ready:
                return handle_choice(team, "gain_bell")
            if team == "past" and has_bell_any("past") and not has_bell_any("modern"):
                return handle_choice(team, "travel_item")
            carry_to_modern = (not has_item("modern", "石头")) or (not has_item("modern", "文件")) or (not has_item("modern", "钥匙"))
            if team == "past" and carry_to_modern and state["inventory"][team]:
                return handle_choice(team, "travel_item")
            if not has_bell_any("modern") and not has_bell_any("past"):
                return handle_choice(team, "gain_bell")
            return handle_choice(team, "gain_bell")
        if ptype == "event_calibration_choice":
            return handle_choice(team, "skip")
        if ptype == "event_memory_item":
            items = state["inventory"][team]
            if items:
                if team == "past":
                    return handle_choice(team, "carry", pick_for_modern(items))
                return handle_choice(team, "carry", random.choice(items))
            return handle_choice(team, "skip")
        if ptype == "event_system_test_choice":
            return handle_choice(team, "ring") if can_win_now(team) else handle_choice(team, "skip")
        if ptype == "event_error_choice":
            if team == "past" and count_item(team, "石头") >= 1 and past_ahead_wide:
                return handle_choice(team, "freeze_past")
            return handle_choice(team, "gain_stone")
        if ptype == "event_city_error_choice":
            if rush_win_ready:
                return handle_choice(team, "lose_stone" if count_item(team, "石头") >= 1 else "send_item")
            if team == "past" and has_bell_any("past") and not has_bell_any("modern"):
                return handle_choice(team, "send_item")
            carry_to_modern = (not has_item("modern", "石头")) or (not has_item("modern", "文件")) or (not has_item("modern", "钥匙"))
            if team == "past" and carry_to_modern:
                return handle_choice(team, "send_item")
            if stone_safe:
                return handle_choice(team, "lose_stone")
            return handle_choice(team, "send_item")
        if ptype == "event_city_error_item":
            items = state["inventory"][team]
            if items:
                if team == "past":
                    return handle_choice(team, "carry", pick_for_modern(items))
                return handle_choice(team, "carry", random.choice(items))
            return handle_choice(team, "skip")
        if ptype == "event_oldcity_choice":
            if team != "past":
                return handle_choice(team, "skip")
            others = [i for i in state["inventory"][team] if i != "文件"]
            if not others:
                return handle_choice(team, "skip")
            if not has_bell_any("modern") and "铃铛" in others:
                return handle_choice(team, "carry", "铃铛")
            if "钥匙" in others:
                return handle_choice(team, "carry", "钥匙")
            return handle_choice(team, "skip")


random_policy = RandomPolicy()
heuristic_policy = HeuristicPolicy()


def main():
    games = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
    max_draws = int(sys.argv[2]) if len(sys.argv) > 2 else 200
    max_rounds = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    random_stats = run_batch(random_policy, games, max_draws, max_rounds)
    heuristic_stats = run_batch(heuristic_policy, games, max_draws, max_rounds)

    def fmt(x):
        return "-" if x is None else str(x)

    print("随机策略:")
    print(f"  胜率: {random_stats['winRate']*100:.1f}%")
    print(f"  50%胜利抽卡: {fmt(random_stats['p50Draws'])} 张")
    print(f"  70%胜利抽卡: {fmt(random_stats['drawThreshold70'])} 张")
    print(f"  50%胜利轮数: {fmt(random_stats['p50Rounds'])} 轮")
    print(f"  70%胜利轮数: {fmt(random_stats['roundThreshold70'])} 轮")
    print("\n启发式策略:")
    print(f"  胜率: {heuristic_stats['winRate']*100:.1f}%")
    print(f"  50%胜利抽卡: {fmt(heuristic_stats['p50Draws'])} 张")
    print(f"  70%胜利抽卡: {fmt(heuristic_stats['drawThreshold70'])} 张")
    print(f"  50%胜利轮数: {fmt(heuristic_stats['p50Rounds'])} 轮")
    print(f"  70%胜利轮数: {fmt(heuristic_stats['roundThreshold70'])} 轮")


if __name__ == "__main__":
    main()
