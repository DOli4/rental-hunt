"""Map pins, drive-time estimates and the core / nearby / outside split."""
import math

# The two places the drive times are measured to
ANCHORS = {
    "tecwise": {"name": "TecWise", "label": "TecWise · Estcourt Ave, Wierdapark", "lat": -25.8722, "lng": 28.1590},
    "drive": {"name": "Drive", "label": "Drive · Guernsey Business Park, Irene", "lat": -25.8538, "lng": 28.2506},
}

# Suburb centres (OpenStreetMap place nodes where available) for listings without an exact pin.
CENTRES = {
    "Die Hoewes": (-25.8460, 28.1950), "Centurion Central": (-25.8540, 28.1880), "Centurion": (-25.8540, 28.1880),
    "Lyttelton Manor": (-25.8294, 28.2028), "Lyttelton": (-25.8294, 28.2028),
    "Highveld": (-25.8700, 28.2300), "Highveld Techno Park": (-25.8740, 28.2200), "Eco Park Estate": (-25.8790, 28.2150),
    "Irene": (-25.8684, 28.2180), "Irene Farm Villages": (-25.8790, 28.2420), "Hereford Estate": (-25.8540, 28.2490),
    "Southdowns Estate": (-25.8850, 28.2360), "Cornwall Hill": (-25.8890, 28.2350),
    "Clubview": (-25.8339, 28.1683), "Zwartkop": (-25.8672, 28.1764), "Hennopspark": (-25.8497, 28.1742),
    "Doringkloof": (-25.8564, 28.2103), "Pierre van Ryneveld": (-25.8369, 28.2417), "Rietvalleipark": (-25.8474, 28.2537),
    "Eldoraigne": (-25.8451, 28.1573), "Eldo Glen": (-25.8530, 28.1500), "Wierda Park": (-25.8603, 28.1467),
    "Valhalla": (-25.8069, 28.1511), "Glen Lauriston": (-25.8253, 28.1558), "Eldo Lakes Estate": (-25.8253, 28.1558),
    "Golden Fields Estate": (-25.9080, 28.1691), "Louwlardia": (-25.9080, 28.1691),
    "Midstream Estate": (-25.9111, 28.1934), "Centurion Golf Estate": (-25.8752, 28.2007),
    "Rooihuiskraal": (-25.8933, 28.1514), "Rooihuiskraal North": (-25.8767, 28.1489), "Simarlo": (-25.8677, 28.1595),
    "The Reeds": (-25.8992, 28.1342), "Heuweloord": (-25.8822, 28.1131), "Heuwelsig Estate": (-25.8709, 28.1117),
    "Celtisdal": (-25.8711, 28.1297), "Amberfield": (-25.8850, 28.1328), "Amberfield Heights": (-25.8850, 28.1328),
    "Amberfield Valley": (-25.8850, 28.1328), "Amberfield Manor": (-25.8850, 28.1328), "Amberfield Crest Estate": (-25.8850, 28.1328),
    "Raslouw": (-25.8529, 28.1187), "Raslouw AH": (-25.8529, 28.1187), "Sunderland Ridge": (-25.8401, 28.1195),
    "Thatchfield": (-25.8975, 28.1137), "Thatchfield Manor": (-25.8975, 28.1137), "Thatchfield Cresent": (-25.8975, 28.1137),
    "Thatchfield Close": (-25.8975, 28.1137), "Thatchfield Estate": (-25.8975, 28.1137), "Thatchfield Ridge": (-25.8975, 28.1137),
    "Monavoni": (-25.8560, 28.1000), "Kosmosdal": (-25.9250, 28.1350), "Mnandi": (-25.8854, 28.0754),
    "Laudium": (-25.7891, 28.1032), "Erasmia": (-25.8124, 28.0944),
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
    exact = l.get("geo") == "exact" or (l.get("lat") is not None and l.get("lng") is not None and l.get("geo") != "suburb")
    if not exact:
        l["lat"], l["lng"] = CENTRES.get(l.get("suburb", ""), CENTRES["Centurion"])
        l["geo"] = "suburb"
    else:
        l["geo"] = "exact"
    p = (l["lat"], l["lng"])
    l["min_tecwise"] = drive_min(km(p, (ANCHORS["tecwise"]["lat"], ANCHORS["tecwise"]["lng"])))
    l["min_drive"] = drive_min(km(p, (ANCHORS["drive"]["lat"], ANCHORS["drive"]["lng"])))
    l.pop("min_insideout", None)
    best = min(l["min_tecwise"], l["min_drive"])
    l["tier"] = "core" if best <= CORE_MIN else ("nearby" if best <= NEARBY_MIN else "outside")
    q = f"{l['lat']},{l['lng']}" if l["geo"] == "exact" else ", ".join(
        x for x in [l.get("address", ""), l.get("suburb", ""), "Centurion"] if x)
    l["maps_url"] = "https://www.google.com/maps/search/?api=1&query=" + q.replace(" ", "+")
    return l
