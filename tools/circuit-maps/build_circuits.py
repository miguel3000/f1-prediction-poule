#!/usr/bin/env python3
"""Builds the circuit data behind the race weekend preview mail.

  backend/src/data/circuits.ts            length, laps and race distance per circuit
  frontend/public/circuits/<id>.png       the layout, drawn in our palette

Facts come from the race pages on formula1.com (Circuit Length, Number of Laps, Race Distance).
Layouts are drawn by us from OpenF1's GPS positions of one fast qualifying lap, so there is no
third-party artwork in the mail. The traced lap is compared with the official length: a picture
whose length is not within 3 % of the official one is rejected.

Run it when a circuit is new to the calendar (add it to CIRCUITS below first):

  python3 -m venv /tmp/circuit-venv && /tmp/circuit-venv/bin/pip install pillow
  /tmp/circuit-venv/bin/python tools/circuit-maps/build_circuits.py [--cache DIR]

The raw downloads are kept in --cache (default: a temp folder) so a second run does not ask the
servers again. OpenF1's free tier allows about 30 requests a minute; the script waits between calls.
"""
import argparse, json, math, os, re, sys, tempfile, time, urllib.parse, urllib.request
from datetime import date, datetime, timedelta, timezone
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_PNG = os.path.join(ROOT, 'frontend', 'public', 'circuits')
OUT_TS = os.path.join(ROOT, 'backend', 'src', 'data', 'circuits.ts')
UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120 Safari/537.36'

# Jolpi circuitId -> (formula1.com race page, OpenF1 meeting_key of a session on that layout).
# 2026 meetings where the circuit has been raced this year; 2025 for those not yet raced (layout unchanged).
CIRCUITS = {
    'albert_park': ('australia', 1279), 'shanghai': ('china', 1280), 'suzuka': ('japan', 1281),
    'miami': ('miami', 1284), 'villeneuve': ('canada', 1285), 'monaco': ('monaco', 1286),
    'catalunya': ('barcelona-catalunya', 1287), 'red_bull_ring': ('austria', 1288),
    'silverstone': ('great-britain', 1289), 'spa': ('belgium', 1290), 'hungaroring': ('hungary', 1291),
    'zandvoort': ('netherlands', 1292), 'monza': ('italy', 1293), 'madring': ('spain', 1294),
    'baku': ('azerbaijan', 1295), 'sepang': ('bahrain', 1308), 'marina_bay': ('singapore', 1296),
    'americas': ('united-states', 1297), 'rodriguez': ('mexico', 1298), 'interlagos': ('brazil', 1299),
    'vegas': ('las-vegas', 1274), 'losail': ('qatar', 1275), 'yas_marina': ('united-arab-emirates', 1276),
}

W, H, SS = 1200, 600, 3
NAVY, YELLOW, WHITE = (0, 82, 119), (255, 216, 26), (255, 255, 255)
MARGIN, LINE, TICK = 96, 15, 46


def fetch(url, wait=0.0, retries=6):
    last = None
    for attempt in range(retries):
        time.sleep(wait)
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            return urllib.request.urlopen(req, timeout=60).read().decode('utf-8', 'replace')
        except Exception as e:  # rate limit or a hiccup: back off and retry
            last = e
            time.sleep(4 + attempt * 4)
    raise last


def cached_json(path, producer):
    if os.path.exists(path):
        return json.load(open(path))
    data = producer()
    json.dump(data, open(path, 'w'))
    return data


def f1_facts(slug):
    html = fetch(f'https://www.formula1.com/en/racing/2026/{slug}', wait=0.6).replace('\\"', '"')

    def stat(label):
        m = re.search(label + r'</dt><dd[^>]*>([\d.]+)(km)?</dd>', html)
        if not m:
            raise SystemExit(f'{slug}: "{label}" not found on the formula1.com page; its layout changed')
        return float(m.group(1))
    return dict(lengthKm=stat('Circuit Length'), laps=int(stat('Number of Laps')), raceDistanceKm=stat('Race Distance'))


def openf1_trace(meeting):
    j = lambda u: json.loads(fetch(u, wait=2.4))
    s = j(f'https://api.openf1.org/v1/sessions?meeting_key={meeting}&session_name=Qualifying')[0]['session_key']
    laps = [l for l in j(f'https://api.openf1.org/v1/laps?session_key={s}')
            if l.get('lap_duration') and not l.get('is_pit_out_lap') and l.get('date_start')]
    best = min(laps, key=lambda l: l['lap_duration'])
    start = datetime.fromisoformat(best['date_start'].replace('Z', '+00:00')).astimezone(timezone.utc)
    end = start + timedelta(seconds=best['lap_duration'])
    q = lambda d: urllib.parse.quote(d.strftime('%Y-%m-%dT%H:%M:%S.%f')[:-3] + '+00:00')
    loc = j(f"https://api.openf1.org/v1/location?session_key={s}&driver_number={best['driver_number']}&date>={q(start)}&date<={q(end)}")
    return dict(session=s, driver=best['driver_number'], lap=best['lap_number'], lap_duration=best['lap_duration'],
                points=[(p['x'], p['y']) for p in loc if not (p['x'] == 0 and p['y'] == 0)])


def chaikin(pts, rounds=2):
    for _ in range(rounds):
        out = []
        for i in range(len(pts)):
            (x0, y0), (x1, y1) = pts[i], pts[(i + 1) % len(pts)]
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pts = out
    return pts


def render(trace, out_png):
    """Draws the loop; returns the traced length in metres (OpenF1 positions are decimetres)."""
    raw = [(x, -y) for x, y in trace['points']]
    pts = [p for i, p in enumerate(raw) if i == 0 or math.dist(p, raw[i - 1]) > 1]
    traced = (sum(math.dist(pts[i], pts[i + 1]) for i in range(len(pts) - 1)) + math.dist(pts[-1], pts[0])) / 10.0
    for _ in range(2):  # take the GPS quantisation jitter off the straights
        n = len(pts)
        pts = [((pts[i - 1][0] + 2 * pts[i][0] + pts[(i + 1) % n][0]) / 4,
                (pts[i - 1][1] + 2 * pts[i][1] + pts[(i + 1) % n][1]) / 4) for i in range(n)]
    loop = chaikin(pts)
    xs, ys = [p[0] for p in loop], [p[1] for p in loop]
    w, h = max(xs) - min(xs), max(ys) - min(ys)
    k = min((W - 2 * MARGIN) / w, (H - 2 * MARGIN) / h)
    ox, oy = (W - k * w) / 2 - k * min(xs), (H - k * h) / 2 - k * min(ys)
    tx = lambda p: ((k * p[0] + ox) * SS, (k * p[1] + oy) * SS)
    im = Image.new('RGB', (W * SS, H * SS), NAVY)
    d = ImageDraw.Draw(im)
    poly = [tx(p) for p in loop] + [tx(loop[0])]
    d.line(poly, fill=YELLOW, width=LINE * SS, joint='curve')
    r = LINE * SS / 2
    for p in (poly[0], poly[-1]):
        d.ellipse([p[0] - r, p[1] - r, p[0] + r, p[1] + r], fill=YELLOW)
    a, b = tx(loop[0]), tx(loop[min(8, len(loop) - 1)])  # start/finish: a white bar across the track
    dx, dy = b[0] - a[0], b[1] - a[1]
    n = math.hypot(dx, dy) or 1
    nx, ny, t = -dy / n, dx / n, TICK * SS / 2
    d.line([(a[0] - nx * t, a[1] - ny * t), (a[0] + nx * t, a[1] + ny * t)], fill=WHITE, width=8 * SS)
    # flat colours plus an anti-aliased edge: 32 colours look identical and keep each mail image small
    im.resize((W, H), Image.LANCZOS).quantize(colors=32, dither=Image.Dither.NONE).save(out_png, optimize=True)
    return traced


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--cache', default=os.path.join(tempfile.gettempdir(), 'circuit-maps-cache'))
    args = ap.parse_args()
    os.makedirs(args.cache, exist_ok=True)
    os.makedirs(OUT_PNG, exist_ok=True)
    os.makedirs(os.path.dirname(OUT_TS), exist_ok=True)

    facts, problems = {}, []
    for cid, (slug, meeting) in CIRCUITS.items():
        f = cached_json(os.path.join(args.cache, f'{cid}.facts.json'), lambda: f1_facts(slug))
        t = cached_json(os.path.join(args.cache, f'{cid}.trace.json'), lambda: openf1_trace(meeting))
        traced = render(t, os.path.join(OUT_PNG, f'{cid}.png'))
        ratio = traced / (f['lengthKm'] * 1000)
        # the race distance F1 prints uses the FIA's own lap length, so it differs from laps x length by up to ~0.1 %
        spread = abs(f['laps'] * f['lengthKm'] - f['raceDistanceKm']) / f['raceDistanceKm']
        print(f"{cid:14} {f['lengthKm']:6.3f} km  {f['laps']:2d} laps  {f['raceDistanceKm']:8.3f} km   traced/official {ratio:5.3f}   laps x length vs distance {spread*100:4.2f} %")
        if not 0.97 <= ratio <= 1.03:
            problems.append(f'{cid}: traced lap is {ratio:.3f} of the official length')
        if spread > 0.002:
            problems.append(f'{cid}: laps x length is {spread*100:.2f} % away from the race distance')
        facts[cid] = f
    if problems:
        sys.exit('NOT WRITTEN, check these:\n  ' + '\n  '.join(problems))

    rows = ',\n'.join(f"  {cid}: {{ lengthKm: {f['lengthKm']}, laps: {f['laps']}, raceDistanceKm: {f['raceDistanceKm']} }}" for cid, f in facts.items())
    open(OUT_TS, 'w').write(f"""// GENERATED by tools/circuit-maps/build_circuits.py on {date.today().isoformat()}. Do not edit by hand.
// Facts: the 2026 race pages on formula1.com (Circuit Length, Number of Laps, Race Distance).
// Layouts: frontend/public/circuits/<circuitId>.png, drawn from OpenF1 GPS of one qualifying lap.
// Keys are Jolpi's circuitId, the same id the official calendar uses.
export interface CircuitFacts {{
  lengthKm: number;
  laps: number;
  raceDistanceKm: number;
}}

export const CIRCUITS: Record<string, CircuitFacts> = {{
{rows},
}};
""")
    print(f'wrote {len(facts)} circuits to {os.path.relpath(OUT_TS, ROOT)} and {os.path.relpath(OUT_PNG, ROOT)}/')


if __name__ == '__main__':
    main()
