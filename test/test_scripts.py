"""The nightly merge: filters, enrich, adds, reprices, fills only empty fields, marks places gone.
Usage: python -m unittest discover -s test -p "test_*.py"   (no private data needed: work places are faked)"""
import json, os, sys, tempfile, unittest

sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "scripts"))
import geo, merge  # noqa: E402

ANCHORS = {"tecwise": {"lat": -25.86, "lng": 28.15, "label": "Work A"}, "drive": {"lat": -25.85, "lng": 28.19, "label": "Work B"}}
geo.anchors = merge.anchors = lambda: ANCHORS


def place(i, **kw):
    return {"id": i, "source": "Property24", "price": 12000, "beds": 3, "baths": "2", "suburb": "Zwartkop", **kw}


class GeoTest(unittest.TestCase):
    def test_tier_and_times(self):
        self.assertEqual([geo.tier(m) for m in (10, 17, 18)], ["core", "nearby", "outside"])
        self.assertEqual(geo.drive_min(0), 3)
        self.assertAlmostEqual(geo.km((0, 0), (0, 1)), 111.2, places=1)

    def test_enrich(self):
        exact = geo.enrich(place("a", lat=-25.86, lng=28.16, address="1 Main Rd"))
        self.assertEqual((exact["geo"], exact["tier"]), ("exact", "core"))
        self.assertIn("-25.86,28.16", exact["maps_url"])
        rough = geo.enrich(place("b", suburb="Nowhere", address="2 Side St"))
        self.assertEqual(rough["geo"], "suburb")
        self.assertIn("2+Side+St,+Nowhere,+Centurion", rough["maps_url"])


class MergeTest(unittest.TestCase):
    def test_nightly_merge(self):
        with tempfile.TemporaryDirectory() as root:
            os.makedirs(os.path.join(root, "data"))
            listings = os.path.join(root, "data", "listings.json")
            old = [place("keep", price=13000, first_seen="2026-10-01", photos=[], phone="082", price_history=[]),
                   place("gone", first_seen="2026-10-01"), place("other-site", source="Gumtree", first_seen="2026-10-01")]
            json.dump({"criteria": {"anchors": ANCHORS}, "listings": [geo.enrich(o) for o in old]}, open(listings, "w", encoding="utf-8"))
            run = os.path.join(root, "run.json")
            json.dump({"date": "2026-10-15", "sources_ok": ["Property24"], "listings": [
                place("keep", price=12500, photos=["https://x/1.jpg"], phone="083", available="Now"),
                place("new"), place("pricey", price=20000), place("small", beds=2), place("far", suburb="Laudium")]}, open(run, "w", encoding="utf-8"))
            merge.ROOT, merge.LISTINGS = root, listings
            merge.main(run)
            out = {l["id"]: l for l in json.load(open(listings, encoding="utf-8"))["listings"]}
            self.assertEqual(sorted(out), ["gone", "keep", "new", "other-site"])
            keep = out["keep"]
            self.assertEqual((keep["price"], keep["price_history"][-1]["price"]), (12500, 12500))
            self.assertEqual(keep["photos"], ["https://x/1.jpg"])  # was empty, so filled
            self.assertEqual(keep["phone"], "082")  # already set, never overwritten
            self.assertEqual(keep["available"], "Now")
            self.assertEqual(out["new"]["first_seen"], "2026-10-15")
            self.assertFalse(out["gone"]["active"])
            self.assertTrue(out["other-site"].get("active", True))  # its site didn't answer tonight
            meta = json.load(open(os.path.join(root, "data", "meta.json"), encoding="utf-8"))
            self.assertEqual((meta["added"], meta["gone"], meta["repriced"]), (1, 1, 1))
            self.assertEqual(meta["anchors"], "Work A and Work B")


if __name__ == "__main__":
    unittest.main()
