#!/usr/bin/env python3
"""
Build data.json for the Season War Room.

Pulls public nflverse data plus the schedule, computes the four signals the app
reasons over, and writes one compact file the browser can read same-origin.

Runs weekly from GitHub Actions. It is deliberately loud about problems: if a
source is missing or stale, that goes in meta.warnings and the app surfaces it
rather than quietly serving last week's numbers.

No credentials, no private endpoints. Everything here is public and free.
"""

import csv, io, json, os, sys, re, unicodedata, urllib.request, datetime
from collections import defaultdict

BASE = "https://github.com/nflverse/nflverse-data/releases/download"
SCHED = "https://raw.githubusercontent.com/nflverse/nfldata/master/data/games.csv"
SEASON = int(os.environ.get("SEASON", "2026"))
PRIOR = SEASON - 1
OUT = os.environ.get("OUT", "data.json")

# ── LEAGUE SCORING ──────────────────────────────────────────────────────────
# Edit this to match your league. Everything downstream is computed from it:
# points per game, expected points, the value of a carry vs a target, the
# matchup ratings. Using the wrong settings quietly biases every number - a
# half-PPR league that scores as full PPR systematically overrates pass
# catchers, which is exactly the sort of error that never announces itself.
SCORING = {
    "pass_yd": 0.04, "pass_td": 4, "int": -1, "pass_2pt": 2, "pass_400_bonus": 3,
    "rush_yd": 0.1, "rush_td": 6, "rush_2pt": 2, "rush_200_bonus": 3,
    "rec": 0.5, "rec_yd": 0.1, "rec_td": 6, "rec_2pt": 2, "rec_200_bonus": 3,
    "fumble_lost": -2, "return_td": 6,
}

# Fallbacks only; the real values are computed from the prior season under the
# scoring above.
PPC_DEFAULT, PPT_DEFAULT, PPA_DEFAULT = 0.5, 1.2, 0.42
POS = ("QB", "RB", "WR", "TE")
warnings = []


def fetch(url, required=False):
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "season-war-room"})
        with urllib.request.urlopen(req, timeout=180) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:
        msg = f"could not fetch {url.rsplit('/',1)[-1]}: {e}"
        if required:
            print("FATAL:", msg, file=sys.stderr)
            sys.exit(1)
        warnings.append(msg)
        return None


def rows(text):
    return list(csv.DictReader(io.StringIO(text))) if text else []


def score(r):
    """Fantasy points for one player-game under SCORING, from raw stats."""
    S = SCORING
    py, ry, cy = num(r["passing_yards"]), num(r["rushing_yards"]), num(r["receiving_yards"])
    pts = (py * S["pass_yd"] + num(r["passing_tds"]) * S["pass_td"]
           + num(r.get("passing_interceptions", 0)) * S["int"]
           + num(r.get("passing_2pt_conversions", 0)) * S["pass_2pt"]
           + ry * S["rush_yd"] + num(r["rushing_tds"]) * S["rush_td"]
           + num(r.get("rushing_2pt_conversions", 0)) * S["rush_2pt"]
           + num(r["receptions"]) * S["rec"] + cy * S["rec_yd"]
           + num(r["receiving_tds"]) * S["rec_td"]
           + num(r.get("receiving_2pt_conversions", 0)) * S["rec_2pt"]
           + num(r.get("special_teams_tds", 0)) * S["return_td"])
    lost = (num(r.get("sack_fumbles_lost", 0)) + num(r.get("rushing_fumbles_lost", 0))
            + num(r.get("receiving_fumbles_lost", 0)))
    pts += lost * S["fumble_lost"]
    # single-game yardage bonuses
    if py >= 400: pts += S["pass_400_bonus"]
    if ry >= 200: pts += S["rush_200_bonus"]
    if cy >= 200: pts += S["rec_200_bonus"]
    return pts


def num(v):
    try:
        return float(v) if v not in ("", "NA", None) else 0.0
    except Exception:
        return 0.0


ALIAS = {"hollywood brown": "marquise brown", "tank dell": "nathaniel dell",
         "cam ward": "cameron ward", "chig okonkwo": "chigoziem okonkwo"}


def key(n):
    n = unicodedata.normalize("NFKD", n or "").encode("ascii", "ignore").decode()
    n = n.lower().replace(".", "").replace("'", "").replace("-", " ")
    n = re.sub(r"\b(jr|sr|ii|iii|iv|v)\b", "", n)
    n = re.sub(r"\s+", " ", n).strip()
    return ALIAS.get(n, n)


# ── 1. schedule, and the implied team totals that come out of it ────────────
def build_schedule():
    sched = rows(fetch(SCHED, required=True))
    cur = [r for r in sched if r["season"] == str(SEASON) and r["game_type"] == "REG"]
    if not cur:
        warnings.append(f"no {SEASON} games in the schedule file")
    games, byes = [], {}
    played = defaultdict(set)
    for r in cur:
        wk = int(r["week"])
        t, s = num(r["total_line"]), num(r["spread_line"])
        has = r["total_line"] not in ("", "NA")
        # spread_line is the HOME line: positive means the home team is favoured
        g = {"w": wk, "a": r["away_team"], "h": r["home_team"],
             "done": r["away_score"] not in ("", "NA")}
        if g["done"]:
            g["as"] = int(num(r["away_score"])); g["hs"] = int(num(r["home_score"]))
        if has:
            g["t"] = round(t, 1)
            g["s"] = round(s, 1)
            g["ia"] = round(t / 2 - s / 2, 1)   # implied away points
            g["ih"] = round(t / 2 + s / 2, 1)   # implied home points
        games.append(g)
        played[r["away_team"]].add(wk); played[r["home_team"]].add(wk)
    weeks = sorted({g["w"] for g in games})
    for team, w in played.items():
        miss = [x for x in weeks if x not in w and x <= 14]
        if miss:
            byes[team] = miss[0]
    lines = sum(1 for g in games if "t" in g)
    if lines < len(games):
        warnings.append(f"betting lines posted for {lines} of {len(games)} games; "
                        "the rest fill in as the season approaches")
    return games, byes, weeks


# ── 2. weekly stats: prior season as the baseline, current as the signal ────
def load_weekly(season, required=False):
    txt = fetch(f"{BASE}/stats_player/stats_player_week_{season}.csv", required=required)
    if txt is None:
        return []
    return [r for r in rows(txt) if r.get("season_type") == "REG"]


def opportunity_values(weekly):
    """
    League average PPR points per opportunity, from actual results.
    Pass attempts are included because a quarterback's volume is throws, not
    carries and targets - leaving them out made every QB project near zero.
    """
    tc = tt = ta = cp = rp = pp = 0.0
    for r in weekly:
        tc += num(r["carries"]); tt += num(r["targets"]); ta += num(r["attempts"])
        S = SCORING
        cp += num(r["rushing_yards"]) * S["rush_yd"] + num(r["rushing_tds"]) * S["rush_td"]
        rp += (num(r["receptions"]) * S["rec"] + num(r["receiving_yards"]) * S["rec_yd"]
               + num(r["receiving_tds"]) * S["rec_td"])
        pp += (num(r["passing_yards"]) * S["pass_yd"] + num(r["passing_tds"]) * S["pass_td"]
               + num(r.get("passing_interceptions", 0)) * S["int"])
    if tc < 100 or tt < 100 or ta < 100:
        return PPC_DEFAULT, PPT_DEFAULT, PPA_DEFAULT
    return round(cp / tc, 3), round(rp / tt, 3), round(pp / ta, 3)


def season_totals(weekly):
    """Counting stats for the raw sheet - what actually happened, not a rate."""
    out = defaultdict(lambda: [0] * 14)
    for r in weekly:
        if r.get("position") not in POS:
            continue
        a = out[key(r["player_display_name"])]
        a[0] += 1
        a[1] += int(num(r.get("completions", 0)))
        a[2] += int(num(r.get("attempts", 0)))
        a[3] += int(num(r["passing_yards"]))
        a[4] += int(num(r["passing_tds"]))
        a[5] += int(num(r.get("passing_interceptions", 0)))
        a[6] += int(num(r["carries"]))
        a[7] += int(num(r["rushing_yards"]))
        a[8] += int(num(r["rushing_tds"]))
        a[9] += int(num(r["targets"]))
        a[10] += int(num(r["receptions"]))
        a[11] += int(num(r["receiving_yards"]))
        a[12] += int(num(r["receiving_tds"]))
        a[13] += round(score(r), 1)
    for k in out:
        out[k][13] = round(out[k][13], 1)
    return dict(out)


def agg_player(weekly, ppc, ppt, ppa, weeks=None):
    """Per-player totals; optionally restricted to a set of weeks."""
    out = defaultdict(lambda: {"g": 0, "fp": 0., "car": 0., "tar": 0., "rec": 0., "att": 0.,
                               "ts": 0., "wopr": 0., "tsn": 0, "pos": "", "team": "", "name": ""})
    for r in weekly:
        if weeks is not None and int(r["week"]) not in weeks:
            continue
        if r.get("position") not in POS:
            continue
        a = out[key(r["player_display_name"])]
        a["g"] += 1
        a["fp"] += score(r)
        a["car"] += num(r["carries"]); a["tar"] += num(r["targets"]); a["rec"] += num(r["receptions"])
        a["att"] += num(r["attempts"])
        a["pos"] = r["position"]; a["team"] = r["team"]; a["name"] = r["player_display_name"]
        if r.get("target_share") not in ("", "NA", None):
            a["ts"] += num(r["target_share"]); a["wopr"] += num(r["wopr"]); a["tsn"] += 1
    res = {}
    for k, a in out.items():
        g = a["g"]
        if not g:
            continue
        res[k] = {
            "name": a["name"], "pos": a["pos"], "team": a["team"], "g": g,
            "ppg": round(a["fp"] / g, 1),
            "xfp": round((a["car"] * ppc + a["tar"] * ppt + a["att"] * ppa) / g, 1),
            "att": round(a["att"] / g, 1),
            "tch": round((a["car"] + a["rec"]) / g, 1),
            "tgt": round(a["tar"] / g, 1),
            "tsh": round(a["ts"] / a["tsn"] * 100, 1) if a["tsn"] else 0.0,
            "wopr": round(a["wopr"] / a["tsn"], 2) if a["tsn"] else 0.0,
        }
    return res


# ── 3. defence allowed by position, adjusted for who they faced ────────────
def defense_ratios(weekly, season_avg):
    """
    Raw points-allowed is confounded by schedule: a defence looks elite if it
    drew three weak offences. This compares what each defence actually gave up
    against what the players it faced average overall. Above 1.0 = generous.
    """
    actual = defaultdict(lambda: defaultdict(float))
    expect = defaultdict(lambda: defaultdict(float))
    n = defaultdict(set)
    for r in weekly:
        pos = r.get("position")
        if pos not in POS:
            continue
        d = r.get("opponent_team")
        if not d:
            continue
        k = key(r["player_display_name"])
        base = season_avg.get(k)
        if not base or base["g"] < 3:
            continue
        actual[d][pos] += score(r)
        expect[d][pos] += base["ppg"]
        n[d].add(int(r["week"]))
    out = {}
    for d in actual:
        row = {"n": len(n[d])}
        for p in POS:
            e = expect[d].get(p, 0.0)
            row[p] = round(actual[d][p] / e, 2) if e > 8 else None
        out[d] = row
    return out


def depth_chart(season):
    """
    Latest depth-chart snapshot per player, plus roster status.

    This is the fix for the biggest weakness in projecting off last season:
    a player's old numbers describe the role he had, not the one he has. Carson
    Wentz put up starter numbers filling in during 2025 and is QB3 in Minnesota
    now; Tyler Shough is New Orleans' QB1. Without this the model ranks them
    backwards.
    """
    txt = fetch(f"{BASE}/depth_charts/depth_charts_{season}.csv")
    ranks = {}
    if txt:
        newest = {}
        for r in rows(txt):
            if r.get("pos_abb") not in POS:
                continue
            k = key(r.get("player_name", ""))
            dt = r.get("dt", "")
            if k not in newest or dt > newest[k][0]:
                try:
                    rk = int(float(r.get("pos_rank") or 99))
                except Exception:
                    rk = 99
                newest[k] = (dt, rk, r.get("team", ""), r.get("pos_abb", ""))
        for k, v in newest.items():
            ranks[k] = {"rank": v[1], "team": v[2], "pos": v[3]}
    else:
        warnings.append(f"no {season} depth charts - role adjustments are off, so "
                        "players who changed jobs will look like their old selves")

    txt = fetch(f"{BASE}/rosters/roster_{season}.csv")
    status = {}
    if txt:
        for r in rows(txt):
            if r.get("position") not in POS:
                continue
            status[key(r.get("full_name", ""))] = {
                "st": r.get("status", ""), "team": r.get("team", "")}
    return ranks, status


def snap_shares(season):
    txt = fetch(f"{BASE}/snap_counts/snap_counts_{season}.csv")
    if not txt:
        return {}, {}
    agg = defaultdict(lambda: {"s": 0.0, "n": 0})
    byweek = defaultdict(dict)
    for r in rows(txt):
        if r.get("game_type") != "REG":
            continue
        pct = num(r.get("offense_pct"))
        if pct <= 0:
            continue
        k = key(r.get("player", ""))
        agg[k]["s"] += pct; agg[k]["n"] += 1
        byweek[k][int(r["week"])] = round(pct * 100, 1)
    return ({k: round(v["s"] / v["n"] * 100, 1) for k, v in agg.items() if v["n"]},
            byweek)


def injuries(season):
    txt = fetch(f"{BASE}/injuries/injuries_{season}.csv")
    if not txt:
        return {}
    latest = {}
    for r in rows(txt):
        k = key(r.get("full_name", ""))
        wk = int(r["week"]) if r.get("week", "").isdigit() else 0
        st = (r.get("report_status") or "").strip()
        if not st:
            continue
        if k not in latest or wk >= latest[k]["w"]:
            latest[k] = {"w": wk, "s": st, "p": (r.get("practice_status") or "").strip()}
    return latest


# ── projection model ───────────────────────────────────────────────────────
# This used to live in the browser. It moved here so every week's projection is
# written down BEFORE the games, which is the only honest way to score
# projected-against-actual later. The app now reads projections rather than
# inventing them: what you see on Tuesday is what gets graded on Monday.
ROLE_CURVE = {"QB": [1, .12, .05, .03], "RB": [1, .60, .30, .15],
              "WR": [1, .92, .72, .45, .25], "TE": [1, .45, .20, .12]}
LEAGUE_AVG_IMPLIED = 22.5


def role_mult(pos, rank, cur_games):
    if rank is None:
        return 1.0
    curve = ROLE_CURVE.get(pos, [1, .8, .5, .3])
    raw = curve[min(len(curve) - 1, max(0, rank - 1))]
    w = max(.2, 1 - (cur_games or 0) / 8)    # real usage supersedes the depth chart
    return 1 + (raw - 1) * w


def project_week(players, dfn, games, wk):
    out = {}
    gmap = {}
    for g in games:
        if g["w"] != wk:
            continue
        gmap[g["a"]] = ("away", g)
        gmap[g["h"]] = ("home", g)
    for k, p in players.items():
        st = p.get("r") or p.get("s") or p.get("b")
        if not st:
            continue
        base = st[2] if st[2] > 0 else st[1]
        side = gmap.get(p["team"])
        if not side:
            continue
        which, g = side
        opp = g["h"] if which == "away" else g["a"]
        m_match, m_env = 1.0, 1.0
        d = dfn.get(opp)
        if d and d.get(p["pos"]):
            m_match = max(.82, min(1.22, d[p["pos"]]))
        implied = g.get("ia") if which == "away" else g.get("ih")
        if implied:
            m_env = max(.85, min(1.18, implied / LEAGUE_AVG_IMPLIED))
        m_role = role_mult(p["pos"], p.get("d"), (p.get("s") or [0])[0])
        out[k] = round(base * m_match * m_env * m_role, 1)
    return out


# ── ESPN league sync (optional) ────────────────────────────────────────────
# Reads your real league: rosters, matchups. Needs three repo secrets. Entirely
# optional - without it the app uses the CSV you paste in, and everything except
# live free-agent status still works.
def espn_league():
    lid = os.environ.get("ESPN_LEAGUE_ID", "").strip()
    s2 = os.environ.get("ESPN_S2", "").strip()
    swid = os.environ.get("ESPN_SWID", "").strip()
    if not (lid and s2 and swid):
        return None
    url = (f"https://lm-api-reads.fantasy.espn.com/apis/v3/games/ffl/seasons/{SEASON}"
           f"/segments/0/leagues/{lid}?view=mRoster&view=mTeam&view=mSettings&view=mMatchupScore")
    try:
        req = urllib.request.Request(url, headers={
            "User-Agent": "Mozilla/5.0 season-war-room",
            "Cookie": f"espn_s2={s2}; SWID={swid}",
            "Accept": "application/json"})
        with urllib.request.urlopen(req, timeout=60) as r:
            raw = json.loads(r.read().decode("utf-8", "replace"))
    except Exception as e:
        warnings.append(f"ESPN sync failed ({e}) - using the roster you imported by hand")
        return None
    try:
        teams, rosters = {}, {}
        for t in raw.get("teams", []):
            nm = (t.get("name") or
                  f"{t.get('location','')} {t.get('nickname','')}".strip() or f"Team {t.get('id')}")
            teams[t.get("id")] = nm
            names = []
            for e in (t.get("roster", {}) or {}).get("entries", []):
                pl = ((e.get("playerPoolEntry") or {}).get("player") or {})
                if pl.get("fullName"):
                    names.append(pl["fullName"])
            rosters[nm] = names
        sched = []
        for m in raw.get("schedule", []):
            if m.get("matchupPeriodId") is None:
                continue
            a, h = m.get("away") or {}, m.get("home") or {}
            sched.append({"w": m["matchupPeriodId"],
                          "a": teams.get(a.get("teamId")), "h": teams.get(h.get("teamId")),
                          "as": round(a.get("totalPoints", 0) or 0, 1),
                          "hs": round(h.get("totalPoints", 0) or 0, 1)})
        print(f"  ESPN: {len(rosters)} teams, {sum(len(v) for v in rosters.values())} rostered")
        return {"rosters": rosters, "matchups": sched}
    except Exception as e:
        warnings.append(f"ESPN returned data that could not be read ({e})")
        return None


# ── assemble ───────────────────────────────────────────────────────────────
def main():
    games, byes, weeks = build_schedule()

    prior_weekly = load_weekly(PRIOR, required=True)
    ppc, ppt, ppa = opportunity_values(prior_weekly)
    prior = agg_player(prior_weekly, ppc, ppt, ppa)

    cur_weekly = load_weekly(SEASON)
    played = sorted({int(r["week"]) for r in cur_weekly}) if cur_weekly else []
    cur_week = (played[-1] + 1) if played else 1
    if not cur_weekly:
        warnings.append(
            f"no {SEASON} games played yet - every number below is {PRIOR} form. "
            "Trends and matchup ratings sharpen from about week 4.")

    cur = agg_player(cur_weekly, ppc, ppt, ppa) if cur_weekly else {}
    prior_tot = season_totals(prior_weekly)
    cur_tot = season_totals(cur_weekly) if cur_weekly else {}
    recent = agg_player(cur_weekly, ppc, ppt, ppa, weeks=set(played[-3:])) if played else {}
    dfn = defense_ratios(cur_weekly, cur) if len(played) >= 3 else defense_ratios(prior_weekly, prior)
    dfn_src = SEASON if len(played) >= 3 else PRIOR
    if dfn_src == PRIOR:
        warnings.append(f"matchup ratings still use {PRIOR} defences - they switch "
                        f"to {SEASON} once three weeks are played")

    depth, status = depth_chart(SEASON)
    snaps_cur, snapweek = snap_shares(SEASON)
    snaps_prior, _ = snap_shares(PRIOR)
    inj = injuries(SEASON)

    players = {}
    for k in set(prior) | set(cur):
        p = cur.get(k) or prior.get(k)
        rec = {"name": p["name"], "pos": p["pos"], "team": p["team"]}
        if k in prior:
            b = prior[k]
            rec["b"] = [b["g"], b["ppg"], b["xfp"], b["tch"], b["tgt"], b["tsh"], b["wopr"], b["att"]]
        if k in cur:
            s = cur[k]
            rec["s"] = [s["g"], s["ppg"], s["xfp"], s["tch"], s["tgt"], s["tsh"], s["wopr"], s["att"]]
        if k in recent:
            r3 = recent[k]
            rec["r"] = [r3["g"], r3["ppg"], r3["xfp"], r3["tch"], r3["tgt"], r3["tsh"], r3["wopr"], r3["att"]]
        sn = snaps_cur.get(k, snaps_prior.get(k))
        if sn is not None:
            rec["sn"] = sn
        if k in inj:
            rec["inj"] = [inj[k]["s"], inj[k]["p"]]
        d = depth.get(k)
        if d:
            rec["d"] = d["rank"]
            if d["team"]:
                rec["team"] = d["team"]          # depth chart is the current truth
        s = status.get(k)
        if s:
            rec["st"] = s["st"]
            if s["team"] and not d:
                rec["team"] = s["team"]
        # season counting totals, for the raw stats sheet
        src = cur_tot.get(k) or prior_tot.get(k)
        if src:
            rec["t"] = src
            rec["tsrc"] = SEASON if k in cur_tot else PRIOR
        players[k] = rec

    proj = {}
    for wk in range(cur_week, min(cur_week + 4, 19)):
        proj[str(wk)] = project_week(players, dfn, games, wk)

    # Permanent record of what we predicted before each week. First write wins,
    # so a later rebuild can never quietly improve its own past forecasts.
    hist, hp = {}, "proj_history.json"
    if os.path.exists(hp):
        try:
            hist = json.load(open(hp))
        except Exception:
            hist = {}
    for wk, vals in proj.items():
        hist.setdefault(wk, vals)
    with open(hp, "w") as f:
        json.dump(hist, f, separators=(",", ":"))

    actual = defaultdict(dict)
    for r in cur_weekly:
        if r.get("position") in POS:
            actual[str(int(r["week"]))][key(r["player_display_name"])] = round(score(r), 1)

    league = espn_league()

    data = {
        "meta": {
            "built": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "season": SEASON, "prior": PRIOR,
            "week": cur_week, "played": played,
            "ppc": ppc, "ppt": ppt, "ppa": ppa, "scoring": SCORING,
            "defense_season": dfn_src,
            "depth": len(depth), "roster_status": len(status),
            "tot_cols": ["g","cmp","att","pass_yd","pass_td","int","car","rush_yd",
                         "rush_td","tgt","rec","rec_yd","rec_td","pts"],
            "warnings": warnings,
        },
        "players": players,
        "proj": proj,
        "hist": {w: v for w, v in hist.items() if w in {str(x) for x in played}},
        "actual": dict(actual),
        "league": league,
        "defense": dfn,
        "games": games,
        "byes": byes,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}  {size:.0f} KB")
    print(f"  players {len(players)} | defences {len(dfn)} | games {len(games)}")
    print(f"  depth-chart ranks {len(depth)} | roster statuses {len(status)}")
    print(f"  projections for weeks {sorted(proj)} | history {sorted(hist) or 'none yet'}")
    print(f"  ESPN league: {'connected' if league else 'not configured'}")
    print(f"  season {SEASON} week {cur_week} | weeks played {played or 'none'}")
    print(f"  opportunity values: {ppc}/carry  {ppt}/target  {ppa}/pass attempt")
    print(f"  scoring: {SCORING['rec']} per reception, {SCORING['int']} per interception")
    for w in warnings:
        print("  warning:", w)


if __name__ == "__main__":
    main()
