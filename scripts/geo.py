"""Map pins, drive-time estimates and the core / nearby / outside split."""
import math

ANCHORS = {
    "insideout": (-25.8530, 28.1900),   # InsideOut, Lenchen Ave, Centurion
    "drive": (-25.8548, 28.2476),       # Drive.co.za, Guernsey Business Park, Saltus St, Irene
}

# Approximate centres for listings without an exact pin. Add suburbs here as new ones turn up.
CENTRES = {
    "Die Hoewes": (-25.8460, 28.1950), "Centurion Central": (-25.8540, 28.1880),
    "Lyttelton Manor": (-25.8280, 28.2050), "Lyttelton": (-25.8280, 28.2050),
    "Highveld": (-25.8700, 28.2300), "Highveld Techno Park": (-25.8740, 28.2200),
    "Eco Park Estate": (-25.8790, 28.2150), "Irene": (-25.8760, 28.2280),
    "Irene Farm Villages": (-25.8790, 28.2420), "Hereford Estate": (-25.8540, 28.2490),
    "Southdowns Estate": (-25.8850, 28.2360), "Cornwall Hill": (-25.8890, 28.2350),
    "Clubview": (-25.8400, 28.1650), "Zwartkop": (-25.8380, 28.1760),
    "Hennopspark": (-25.8320, 28.1600), "Doringkloof": (-25.8580, 28.2150),
    "Pierre van Ryneveld": (-25.8850, 28.2550), "Eldoraigne": (-25.8560, 28.1550),
    "Eldo Glen": (-25.8620, 28.1500), "Wierda Park": (-25.8570, 28.1420),
    "Valhalla": (-25.8160, 28.1500), "Golden Fields Estate": (-25.8960, 28.2150),
    "Louwlardia": (-25.8960, 28.2150), "Glen Lauriston": (-25.8760, 28.1400),
    "Eldo Lakes Estate": (-25.8760, 28.1400), "Midstream Estate": (-25.9253, 28.2201),
    "Heuweloord": (-25.8900, 28.1400), "Rooihuiskraal": (-25.8900, 28.1500),
    "Centurion Golf Estate": (-25.8700, 28.2050), "Centurion": (-25.8550, 28.1900),
}

CORE_MIN, NEARBY_MIN = 10, 17


def km(a, b):
    la1, lo1, la2, lo2 = map(math.radians, [a[0], a[1], b[0], b[1]])
    d = math.sin((la2 - la1) / 2) ** 2 + math.cos(la1) * math.cos(la2) * math.sin((lo2 - lo1) / 2) ** 2
    return 2 * 6371.0 * math.asin(math.sqrt(d))


def drive_min(k):
    """Straight-line km x 1.35 road factor at ~40 km/h. A rough guide, not a route."""
    return max(3, round(k * 1.35 / 40 * 60))


def enrich(l):
    exact = l.get("lat") is not None and l.get("lng") is not None
    if not exact:
        l["lat"], l["lng"] = CENTRES.get(l.get("suburb", ""), CENTRES["Centurion"])
        l["geo"] = "suburb"
    else:
        l["geo"] = l.get("geo") or "exact"
    p = (l["lat"], l["lng"])
    l["min_insideout"] = drive_min(km(p, ANCHORS["insideout"]))
    l["min_drive"] = drive_min(km(p, ANCHORS["drive"]))
    best = min(l["min_insideout"], l["min_drive"])
    l["tier"] = "core" if best <= CORE_MIN else ("nearby" if best <= NEARBY_MIN else "outside")
    q = f"{l['lat']},{l['lng']}" if l["geo"] == "exact" else ", ".join(
        x for x in [l.get("address", ""), l.get("suburb", ""), "Centurion"] if x)
    l["maps_url"] = "https://www.google.com/maps/search/?api=1&query=" + q.replace(" ", "+")
    return l
