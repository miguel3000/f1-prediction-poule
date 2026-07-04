#!/usr/bin/env python3
"""
FastF1 data sync utility for F1 Prediction Poule.

Fetches session results via the FastF1 library, which connects to F1's own
timing system and is faster than Ergast/Jolpi for freshly completed sessions.

Requirements:
  pip install fastf1

Usage (from project root):
  python backend/scripts/fastf1_sync.py --year 2026 --round 7 --session R
  python backend/scripts/fastf1_sync.py --year 2026 --round 7 --session Q
  python backend/scripts/fastf1_sync.py --year 2026 --round 7 --session SQ
  python backend/scripts/fastf1_sync.py --year 2026 --round 7 --session S
  python backend/scripts/fastf1_sync.py --year 2026 --round 7 --session FP1

Inside Docker:
  docker exec f1-app python /app/scripts/fastf1_sync.py --year 2026 --round 7 --session R

Output: JSON printed to stdout — pipe or redirect as needed.
  python fastf1_sync.py ... | python -m json.tool   # pretty-print
"""

import argparse
import json
import math
import sys
from pathlib import Path

SESSION_MAP = {
    "R":   "Race",
    "Q":   "Qualifying",
    "S":   "Sprint",
    "SQ":  "Sprint Qualifying",
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
}


def safe_float(val, default=0.0):
    try:
        f = float(val)
        return default if math.isnan(f) else f
    except (TypeError, ValueError):
        return default


def safe_int(val, default=0):
    try:
        f = float(val)
        return default if math.isnan(f) else int(f)
    except (TypeError, ValueError):
        return default


def main():
    parser = argparse.ArgumentParser(description="Fetch F1 session results via FastF1")
    parser.add_argument("--year", type=int, required=True, help="Season year, e.g. 2026")
    parser.add_argument("--round", type=int, required=True, help="Race round number")
    parser.add_argument(
        "--session",
        type=str,
        required=True,
        choices=SESSION_MAP.keys(),
        help="Session identifier: R, Q, S, SQ, FP1, FP2, FP3",
    )
    parser.add_argument(
        "--no-cache",
        action="store_true",
        help="Disable FastF1 file cache (always fetch fresh data)",
    )
    args = parser.parse_args()

    try:
        import fastf1
    except ImportError:
        print(json.dumps({"error": "fastf1 not installed — run: pip install fastf1"}))
        sys.exit(1)

    # Set up local cache to speed up repeated calls
    if not args.no_cache:
        cache_dir = Path(__file__).parent.parent.parent / ".fastf1_cache"
        cache_dir.mkdir(exist_ok=True)
        fastf1.Cache.enable_cache(str(cache_dir))

    session_name = SESSION_MAP[args.session]

    try:
        session = fastf1.get_session(args.year, args.round, session_name)
        # Skip heavy lap/telemetry data — we only need the results table
        session.load(laps=False, telemetry=False, weather=False, messages=False)
    except Exception as e:
        print(json.dumps({"error": f"Failed to load session: {e}"}))
        sys.exit(1)

    results_df = session.results
    if results_df is None or results_df.empty:
        print(json.dumps({"error": "No results available yet for this session"}))
        sys.exit(1)

    output = []
    for _, row in results_df.iterrows():
        output.append(
            {
                "position": safe_int(row.get("Position")),
                "number": str(safe_int(row.get("DriverNumber"))),
                "driverCode": str(row.get("Abbreviation", "")),
                "driverName": str(row.get("FullName", "")),
                "team": str(row.get("TeamName", "")),
                "status": str(row.get("Status", "Unknown")),
                "points": safe_float(row.get("Points")),
                "time": str(row.get("Time", "")),
            }
        )

    output.sort(key=lambda x: x["position"])

    print(
        json.dumps(
            {
                "source": "fastf1",
                "session": session_name,
                "year": args.year,
                "round": args.round,
                "count": len(output),
                "results": output,
            }
        )
    )


if __name__ == "__main__":
    main()
