#!/usr/bin/env python3
"""One-shot join of the CoStar land-listing export onto the NJ land screen.

Reads the three CoStar "all columns" xlsx exports (data/costar/), the final
parcel dataset (apps/web/public/demos-data/denholtz-nj-parcels.json), and the
raw parcel geometry (data/raw/parcels.ndjson), then writes:

  - denholtz-nj-parcels.json   (in place: adds `listing` to matched parcels)
  - denholtz-nj-listings.json  (all listings, slim, for the map layer)
  - output/costar-listings-joined-<date>.csv

Join order per listing: exact PAMS_PIN (built from CoStar's muni-block-lot
parcel number) -> point-in-polygon on listing lat/lng -> nearest centroid
within ~400m with 0.5-2x acreage sanity. Idempotent: re-runs strip previously
attached `listing` objects first. This is demo tooling, not a pipeline — the
export is a Jul 24, 2026 snapshot and will not be refreshed.

Usage: python3 scripts/join-costar.py   (from demos/denholtz-nj/)
"""

import csv
import json
import math
import os
import sys
from collections import Counter

import openpyxl

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REPO = os.path.dirname(os.path.dirname(ROOT))
COSTAR_DIR = os.path.join(ROOT, "data", "costar")
RAW_NDJSON = os.path.join(ROOT, "data", "raw", "parcels.ndjson")
PARCELS_JSON = os.path.join(
    REPO, "apps", "web", "public", "demos-data", "denholtz-nj-parcels.json"
)
LISTINGS_JSON = os.path.join(
    REPO, "apps", "web", "public", "demos-data", "denholtz-nj-listings.json"
)
OUT_CSV = os.path.join(ROOT, "output", "costar-listings-joined-2026-07-24.csv")

TIER_BY_FILE = {
    "0.25 to 1 acre all columns.xlsx": "0.25-1",
    "1 to 5 acre all columns.xlsx": "1-5",
    "5 to 100 acre all columns.xlsx": "5-100",
}

# NJ county codes, alphabetical 01-21 (matches PAMS_PIN county prefix)
COUNTY_CODE = {
    name.upper(): f"{i + 1:02d}"
    for i, name in enumerate(
        [
            "Atlantic", "Bergen", "Burlington", "Camden", "Cape May",
            "Cumberland", "Essex", "Gloucester", "Hudson", "Hunterdon",
            "Mercer", "Middlesex", "Monmouth", "Morris", "Ocean",
            "Passaic", "Salem", "Somerset", "Sussex", "Union", "Warren",
        ]
    )
}


def clean(v):
    if v is None:
        return None
    s = str(v).strip()
    return s if s and s != "-" else None


def num(v):
    return float(v) if isinstance(v, (int, float)) else None


def iso(v):
    return v.strftime("%Y-%m-%d") if hasattr(v, "strftime") else None


def strip_zeros(s):
    s = s.lstrip("0")
    return s if s else "0"


def costar_pins(parcel_num, county):
    """'11-01101-0000-00011-01' + Gloucester -> ['0811_1101_11.01', ...]."""
    if not parcel_num or not isinstance(parcel_num, str):
        return []
    cc = COUNTY_CODE.get(str(county).upper())
    if not cc:
        return []
    parts = parcel_num.strip().split("-")
    if len(parts) < 4:
        return []
    muni, block, _qual, lot = parts[0], parts[1], parts[2], parts[3]
    if not (muni.isdigit() and block.isdigit() and lot.isdigit()):
        return []
    b, lot_ = strip_zeros(block), strip_zeros(lot)
    pins = []
    if len(parts) > 4 and parts[4].isdigit():
        pins.append(f"{cc}{muni}_{b}_{lot_}.{parts[4]}")
        pins.append(f"{cc}{muni}_{b}_{lot_}.{strip_zeros(parts[4])}")
    pins.append(f"{cc}{muni}_{b}_{lot_}")
    return pins


def load_listings():
    rows = []
    for fname, tier in TIER_BY_FILE.items():
        path = os.path.join(COSTAR_DIR, fname)
        wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
        ws = wb.active
        it = ws.iter_rows(values_only=True)
        header = {name: i for i, name in enumerate(next(it))}

        def g(r, name):
            return r[header[name]]

        for r in it:
            price = num(g(r, "For Sale Price"))
            acres = num(g(r, "Land Area (AC)"))
            owner = clean(g(r, "True Owner Name")) or clean(g(r, "Owner Name")) \
                or clean(g(r, "Recorded Owner Name"))
            owner_phone = clean(g(r, "True Owner Phone")) or clean(g(r, "Owner Phone")) \
                or clean(g(r, "Recorded Owner Phone"))
            rows.append(
                {
                    "id": int(g(r, "PropertyID")),
                    "tier": tier,
                    "status": "active" if g(r, "For Sale Status") == "Y" else "off-market",
                    "price": price,
                    "dom": num(g(r, "Days On Market")),
                    "acres": acres,
                    "lat": num(g(r, "Latitude")),
                    "lng": num(g(r, "Longitude")),
                    "address": clean(g(r, "Property Address")),
                    "city": clean(g(r, "City")),
                    "county": clean(g(r, "County Name")),
                    "secondaryType": clean(g(r, "Secondary Type")),
                    "use": clean(g(r, "Proposed Land Use")),
                    "zoning": clean(g(r, "Zoning")),
                    "broker": clean(g(r, "Sales Company")),
                    "brokerContact": clean(g(r, "Sales Contact")),
                    "brokerPhone": clean(g(r, "Sales Contact Phone")),
                    "owner": owner,
                    "ownerPhone": owner_phone,
                    "lastSaleDate": iso(g(r, "Last Sale Date")),
                    "lastSalePrice": num(g(r, "Last Sale Price")),
                    "parcelMin": clean(g(r, "Parcel Number 1(Min)")),
                    "parcelMax": clean(g(r, "Parcel Number 2(Max)")),
                }
            )
    return rows


def load_geometry(wanted_pins):
    """pin -> (bbox, rings) for parcels in the final dataset."""
    geoms = {}
    with open(RAW_NDJSON) as f:
        for line in f:
            feat = json.loads(line)
            pin = feat.get("attributes", {}).get("PAMS_PIN")
            if pin not in wanted_pins:
                continue
            rings = (feat.get("geometry") or {}).get("rings")
            if not rings:
                continue
            xs = [pt[0] for ring in rings for pt in ring]
            ys = [pt[1] for ring in rings for pt in ring]
            geoms[pin] = ((min(xs), min(ys), max(xs), max(ys)), rings)
    return geoms


def point_in_rings(lng, lat, rings):
    """Even-odd ray cast across all rings (handles holes)."""
    inside = False
    for ring in rings:
        n = len(ring)
        j = n - 1
        for i in range(n):
            xi, yi = ring[i][0], ring[i][1]
            xj, yj = ring[j][0], ring[j][1]
            if (yi > lat) != (yj > lat) and lng < (xj - xi) * (lat - yi) / (yj - yi) + xi:
                inside = not inside
            j = i
    return inside


def main():
    parcels = json.load(open(PARCELS_JSON))
    for p in parcels:
        p.pop("listing", None)  # idempotent re-runs
    by_pin = {p["pin"]: p for p in parcels}
    listings = load_listings()
    print(f"parcels: {len(parcels)} | costar listings: {len(listings)}")

    geoms = load_geometry(set(by_pin))
    print(f"geometry loaded for {len(geoms)} parcels")

    # grid index over parcel bboxes (~0.01 deg cells) for PIP + centroid fallback
    cell = 0.01
    grid = {}
    for pin, (bbox, _rings) in geoms.items():
        x0, y0, x1, y1 = bbox
        for gx in range(int(x0 / cell), int(x1 / cell) + 1):
            for gy in range(int(y0 / cell), int(y1 / cell) + 1):
                grid.setdefault((gx, gy), []).append(pin)

    def pip_match(lng, lat):
        for pin in grid.get((int(lng / cell), int(lat / cell)), []):
            bbox, rings = geoms[pin]
            if bbox[0] <= lng <= bbox[2] and bbox[1] <= lat <= bbox[3]:
                if point_in_rings(lng, lat, rings):
                    return pin
        return None

    def near_match(lng, lat, acres):
        best, best_d = None, 0.004  # ~400m in degrees
        gx, gy = int(lng / cell), int(lat / cell)
        seen = set()
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                for pin in grid.get((gx + dx, gy + dy), []):
                    if pin in seen:
                        continue
                    seen.add(pin)
                    p = by_pin[pin]
                    d = math.hypot(p["lng"] - lng, p["lat"] - lat)
                    if d < best_d:
                        best, best_d = pin, d
        if best and acres:
            ratio = by_pin[best]["acres"] / acres
            if not (0.5 < ratio < 2.0):
                return None
        return best

    join_counts = Counter()
    matches = []  # (listing, [pins], method)
    for lst in listings:
        pins, method = [], None
        candidates = costar_pins(lst["parcelMin"], lst["county"])
        if lst["parcelMax"] and lst["parcelMax"] != lst["parcelMin"]:
            candidates += costar_pins(lst["parcelMax"], lst["county"])
        hit = [pin for pin in dict.fromkeys(candidates) if pin in by_pin]
        if hit:
            pins, method = hit, "pin"
        elif lst["lat"] and lst["lng"]:
            pin = pip_match(lst["lng"], lst["lat"])
            if pin:
                pins, method = [pin], "geo"
            else:
                pin = near_match(lst["lng"], lst["lat"], lst["acres"])
                if pin:
                    pins, method = [pin], "near"
        join_counts[method or "unmatched"] += 1
        lst["pin"] = pins[0] if pins else None
        lst["join"] = method
        if pins:
            matches.append((lst, pins, method))

    # attach listings to parcels; prefer active, then higher price, on collision
    def priority(lst):
        return (lst["status"] == "active", lst["price"] or 0)

    collisions = 0
    for lst, pins, method in sorted(matches, key=lambda m: priority(m[0])):
        multi = len(pins) > 1
        for pin in pins:
            if "listing" in by_pin[pin]:
                collisions += 1
            entry = {
                "id": lst["id"],
                "status": lst["status"],
                "price": lst["price"],
                "dom": lst["dom"],
                "acres": lst["acres"],
                "broker": lst["broker"],
                "brokerContact": lst["brokerContact"],
                "brokerPhone": lst["brokerPhone"],
                "owner": lst["owner"],
                "ownerPhone": lst["ownerPhone"],
                "zoning": lst["zoning"],
                "use": lst["use"],
                "lastSaleDate": lst["lastSaleDate"],
                "lastSalePrice": lst["lastSalePrice"],
                "join": method,
            }
            if multi:
                entry["multiParcel"] = True
            by_pin[pin]["listing"] = entry

    listed = [p for p in parcels if "listing" in p]
    print(f"\njoin methods: {dict(join_counts)}")
    print(f"parcels with a listing: {len(listed)} (collisions overwritten: {collisions})")

    # --- sanity thresholds (demo-grade, but fail loudly) ---
    assert len(listings) == 1139, f"expected 1139 listings, got {len(listings)}"
    assert len(parcels) == 13751, f"parcel count changed: {len(parcels)}"
    assert len(listed) >= 150, f"too few joined parcels: {len(listed)}"
    assert join_counts["unmatched"] < 950, "join rate collapsed"

    # demo-copy stats
    ratios = sorted(
        p["listing"]["price"] / p["netVal"]
        for p in listed
        if p["listing"]["price"] and p.get("netVal")
    )
    hi = [p for p in parcels if p["score"] >= 80]
    hi_listed = sum(1 for p in hi if "listing" in p)
    print(f"ask/assessed median: {ratios[len(ratios) // 2]:.1f}x (n={len(ratios)})")
    print(f"score>=80 parcels: {len(hi)}, listed: {hi_listed} "
          f"({100 * (len(hi) - hi_listed) / len(hi):.0f}% off-market)")

    # --- outputs ---
    with open(PARCELS_JSON, "w") as f:
        json.dump(parcels, f, separators=(",", ":"), ensure_ascii=False)
    slim_keys = [
        "id", "tier", "status", "price", "dom", "acres", "lat", "lng",
        "address", "city", "county", "secondaryType", "use", "zoning",
        "broker", "brokerContact", "brokerPhone", "lastSaleDate",
        "lastSalePrice", "pin", "join",
    ]
    slim = [{k: lst[k] for k in slim_keys} for lst in listings]
    for s, lst in zip(slim, listings):
        s["score"] = by_pin[lst["pin"]]["score"] if lst["pin"] else None
    with open(LISTINGS_JSON, "w") as f:
        json.dump(slim, f, separators=(",", ":"), ensure_ascii=False)

    csv_cols = slim_keys + ["score", "owner", "ownerPhone", "parcelMin", "parcelMax"]
    with open(OUT_CSV, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(csv_cols)
        for s, lst in zip(slim, listings):
            row = {**lst, **s}
            w.writerow([row.get(c, "") if row.get(c) is not None else "" for c in csv_cols])

    print(f"\nwrote {PARCELS_JSON} ({os.path.getsize(PARCELS_JSON) / 1e6:.1f}MB)")
    print(f"wrote {LISTINGS_JSON} ({os.path.getsize(LISTINGS_JSON) / 1e6:.2f}MB)")
    print(f"wrote {OUT_CSV}")


if __name__ == "__main__":
    sys.exit(main())
