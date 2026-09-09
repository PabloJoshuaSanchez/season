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

# League-average fantasy value of one opportunity, recomputed each run from the
# prior season. Converts carries and targets onto a single points scale.
PPC_DEFAULT, PPT_DEFAULT, PPA_DEFAULT = 0.645, 1.705, 0.44
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
        cp += num(r["rushing_yards"]) * .1 + num(r["rushing_tds"]) * 6
        rp += num(r["receptions"]) + num(r["receiving_yards"]) * .1 + num(r["receiving_tds"]) * 6
        pp += num(r["passing_yards"]) * .04 + num(r["passing_tds"]) * 4 \
              - num(r.get("passing_interceptions", 0)) * 2
    if tc < 100 or tt < 100 or ta < 100:
        return PPC_DEFAULT, PPT_DEFAULT, PPA_DEFAULT
    return round(cp / tc, 3), round(rp / tt, 3), round(pp / ta, 3)


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
        a["fp"] += num(r["fantasy_points_ppr"])
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
        actual[d][pos] += num(r["fantasy_points_ppr"])
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
    recent = agg_player(cur_weekly, ppc, ppt, ppa, weeks=set(played[-3:])) if played else {}
    dfn = defense_ratios(cur_weekly, cur) if len(played) >= 3 else defense_ratios(prior_weekly, prior)
    dfn_src = SEASON if len(played) >= 3 else PRIOR
    if dfn_src == PRIOR:
        warnings.append(f"matchup ratings still use {PRIOR} defences - they switch "
                        f"to {SEASON} once three weeks are played")

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
        players[k] = rec

    data = {
        "meta": {
            "built": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
            "season": SEASON, "prior": PRIOR,
            "week": cur_week, "played": played,
            "ppc": ppc, "ppt": ppt, "ppa": ppa,
            "defense_season": dfn_src,
            "warnings": warnings,
        },
        "players": players,
        "defense": dfn,
        "games": games,
        "byes": byes,
    }
    with open(OUT, "w") as f:
        json.dump(data, f, separators=(",", ":"))
    size = os.path.getsize(OUT) / 1024
    print(f"wrote {OUT}  {size:.0f} KB")
    print(f"  players {len(players)} | defences {len(dfn)} | games {len(games)}")
    print(f"  season {SEASON} week {cur_week} | weeks played {played or 'none'}")
    print(f"  opportunity values: {ppc}/carry  {ppt}/target  {ppa}/pass attempt")
    for w in warnings:
        print("  warning:", w)


if __name__ == "__main__":
    main()
