"""Build data/listings.json from the first manual search (14 Oct 2026).

Later runs use scripts/merge.py to fold new search results into the same file.
"""
import json, math, os, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TODAY = "2026-10-14"

import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from geo import enrich, ANCHORS  # noqa: E402

PP = "Private Property"; P24 = "Property24"; MP = "MyProperty"; GT = "Gumtree"; FB = "Facebook Marketplace"; DEV = "Developer"

# Each row: id, source, url, type, suburb, complex/address, price, beds, baths, size, available,
#           pets, fibre, security, agency, agent, phone, summary, extras(dict)
R = []
def add(id, source, url, type, suburb, addr, price, beds, baths, size=None, available="", pets="unknown",
        fibre="unknown", security="", agency="", agent="", phone="", summary="", **extra):
    R.append(dict(id=id, source=source, url=url, type=type, suburb=suburb, address=addr, price=price,
                  beds=beds, baths=baths, size_m2=size, available=available, pets=pets, fibre=fibre,
                  security=security, agency=agency, agent=agent, phone=phone, email="", summary=summary,
                  **extra))

pp = "https://www.privateproperty.co.za/to-rent/gauteng/centurion/"
p24 = "https://www.property24.com/to-rent/"

# ---------------- Private Property (details read from each listing) ----------------
add("pp-RR4797619", PP, pp+"centurion-east/highveld/eco-park-estate/RR4797619", "Apartment", "Eco Park Estate", "Eco Park Estate, Highveld",
    11190, 3, 2, None, "Now", "unknown", "unknown", "24h guards, boomed access, fenced", "M&T Development", "",
    "", "Tiled 3-bed with en-suite in a boomed, guarded estate; 2 covered bays.", dupes=["p24-117711522"])
add("pp-RR4491555", PP, pp+"centurion-east/pierre-van-ryneveld/RR4491555", "Townhouse", "Pierre van Ryneveld", "",
    13125, 3, 2, 110, "1 Dec", "yes", "unknown", "Access gates", "RE/MAX Jacaranda Faerie Glen", "",
    "", "110 m² townhouse, own garden, double garage. Pets welcome.", dupes=["p24-116406322"])
add("pp-RR4791450", PP, pp+"centurion-east/lyttelton-manor/d9830-smut-avenue/RR4791450", "House", "Lyttelton Manor", "D9830 Smut Avenue",
    16000, 4, 2, 245, "1 Nov", "yes", "yes", "Alarm, CCTV, burglar bars, fenced", "RE/MAX Property Merchants", "",
    "", "Big 4-bed family home with scullery and patio. Two flatlets on the property are rented out.",
    lat=-25.8202, lng=28.2116, dupes=["p24-117689650"])
add("pp-RR4790917", PP, pp+"centurion-east/zwartkop/89-yellowstone/217-end-street/RR4790917", "Apartment", "Zwartkop", "89 Yellowstone, 217 End Street",
    14950, 3, 2, None, "Now", "yes", "yes (free)", "Patrolling guards, electric fence, access gate", "", "",
    "", "Estate unit with free fibre + DStv, prepaid utilities, garden (ground floor) or balcony.",
    note="Same estate is listed as both Zwartkop and Die Hoewes – confirm exact location with the agent.")
add("pp-RR4786893", PP, pp+"centurion-east/die-hoewes/74-yellowstone/217-end-street/RR4786893", "Apartment", "Die Hoewes", "74 Yellowstone, 217 End Street",
    14950, 3, 2, None, "Now", "yes", "yes (free)", "Patrolling guards, electric fence, access gate", "", "",
    "", "Second unit in the Yellowstone estate: free fibre + DStv, prepaid utilities.", dupes=["p24-117515132"],
    note="Same estate as the Zwartkop Yellowstone listing – confirm exact location.")
add("pp-RR4787230", PP, pp+"centurion-east/die-hoewes/RR4787230", "Apartment", "Die Hoewes", "",
    11500, 3, 2, None, "1 Nov", "unknown", "unknown", "Controlled access, gate security", "", "",
    "", "3-bed in a secure complex with covered braai area and 2 garages.", dupes=["p24-117675283"])
add("pp-RR4786691", PP, pp+"centurion-east/lyttelton-manor/RR4786691", "House", "Lyttelton Manor", "",
    13900, 3, 2, None, "Now", "dogs only", "yes", "Access gate, fenced", "", "",
    "", "Neat family house, scullery, fireplace, double garage. Small/medium dogs only – NO cats.",
    dupes=["p24-117581312"])
add("pp-RR4785455", PP, pp+"centurion-east/highveld/k2646f-crystal-cove/9-stansted-street/RR4785455", "Simplex", "Highveld", "Crystal Cove, 9 Stansted Street",
    13500, 3, 2, None, "1 Nov", "unknown", "unknown", "Complex", "Kingsmark Real Estate", "Tracy Scrooby",
    "0823177459", "Corner simplex with big private garden and built-in braai, single garage.",
    phone_work="0124436595", dupes=["p24-111385933"])
add("pp-RR4785034", PP, pp+"centurion-east/clubview/RR4785034", "Apartment", "Clubview", "",
    11500, 3, 2, 135, "1 Nov", "no", "yes", "24/7 CCTV, electric fence, controlled access", "Real Estate Services", "Abigail Birrell",
    "", "135 m² first-floor unit, huge balcony, 2 automated garages. No pets.",
    dupes=["p24-117666856", "mp-2562666"])
add("pp-RR4772585", PP, pp+"centurion-east/die-hoewes/RR4772585", "Townhouse", "Die Hoewes", "",
    16000, 3, 2, 189, "Now", "yes (on approval)", "ready", "Gated complex, night patrols, alarm", "", "",
    "", "Fully renovated 189 m² townhouse, double garage, study nook, Olympic pool. Walk to Gautrain.")
add("pp-RR4776989", PP, pp+"centurion-east/irene/23-galloway/2-saltus-street/RR4776989", "Apartment", "Irene", "23 Galloway, 2 Saltus Street",
    12490, 3, 2, 84, "Now", "unknown", "ready", "24h access control, guard house, boomed", "M&T Development", "Helmut Bohm",
    "", "Galloway estate – right next to Drive. Communal pool, 2 shade-net bays.",
    lat=-25.8548, lng=28.2476, dupes=["p24-117532278"])
add("pp-RR2681594", PP, pp+"centurion-east/die-hoewes/22-271-on-von-willich/271-on-von-willich/RR2681594", "Duplex", "Die Hoewes", "22 271 On Von Willich",
    15950, 3, 2.5, 198, "1 Dec", "no", "yes", "Secure complex, alarm, intercom", "", "",
    "", "198 m² duplex + study, double garage, no load-shedding, walk to Gautrain. No pets.",
    lat=-25.8431, lng=28.1951)
add("pp-RR4775583", PP, pp+"centurion-east/lyttelton-manor/170-van-riebeeck-avenue/RR4775583", "House", "Lyttelton Manor", "170 Van Riebeeck Avenue",
    13500, 3, 2, None, "Now", "unknown", "unknown", "Remote gate", "", "",
    "", "House with scullery, fireplace, double garage. 3 separate cottages on the erf.",
    lat=-25.8259, lng=28.2103)
add("pp-RR4092123", PP, pp+"centurion-east/zwartkop/RR4092123", "Duplex", "Zwartkop", "",
    12500, 3, 2, None, "1 Nov", "unknown", "unknown", "Guard house, security complex", "", "",
    "", "Modern 3-bed duplex in a security complex.", dupes=["p24-114361024"])
add("pp-RR4194063", PP, pp+"centurion-east/highveld/RR4194063", "Simplex", "Highveld", "",
    15500, 4, 2, 142, "1 Nov", "yes", "unknown", "Access control, electric fence", "", "",
    "", "4-bed townhouse with garden. Pets allowed.", dupes=["p24-114873783"])
add("pp-RR4748125", PP, pp+"centurion-east/die-hoewes/RR4748125", "Apartment", "Die Hoewes", "",
    15500, 3, 3, 133, "Now", "unknown", "unknown", "24h security estate", "Lamarc Properties", "Michele Basson",
    "", "Luxury 3-bath duplex apartment with loft and clubhouse estate.", dupes=["p24-117533252", "mp-2553957"])
add("pp-RR4568800", PP, pp+"centurion-east/lyttelton-manor/14-camelot/149-cantonments-rd/RR4568800", "Apartment", "Lyttelton Manor", "14 Camelot, 149 Cantonments Rd",
    9000, 3, 2, 104, "Now", "unknown", "unknown", "", "", "",
    "", "Cheapest in the area: 104 m² 3-bed apartment.", lat=-25.8319, lng=28.1992,
    dupes=["p24-116737461", "mp-2441454"])
add("pp-RR4559123", PP, pp+"centurion-east/zwartkop/RR4559123", "Apartment", "Zwartkop", "",
    10500, 3, 2, None, "Now", "unknown", "unknown", "Guard house, access control, electric fence", "", "",
    "", "Ground-floor 3-bed apartment.")
add("pp-RR4667799", PP, pp+"centurion-east/clubview/RR4667799", "Townhouse", "Clubview", "",
    13500, 3, 2, None, "Now", "unknown", "unknown", "Access control, electric fence, alarm", "", "",
    "", "Double-storey townhouse in a security complex.", dupes=["p24-117253918"])
add("pp-RR4655840", PP, pp+"centurion-east/clubview/RR4655840", "Apartment", "Clubview", "",
    11750, 3, 2, 135, "Now", "no", "yes", "24h security, CCTV, electric fence", "", "",
    "", "135 m² lock-up-and-go with 2 garages. No pets.", dupes=["p24-117135964"])
add("pp-RR4681643", PP, pp+"centurion-west/eldoraigne/eldo-glen/eldoglen/RR4681643", "Apartment", "Eldo Glen", "Eldo Glen",
    15500, 3, 2, 139, "Now", "no", "unknown", "", "", "",
    "", "Ground-floor unit with private garden and double garage, solar.", dupes=["p24-117243010"])
add("pp-RR4792951", PP, pp+"centurion-west/eldoraigne/RR4792951", "Townhouse", "Eldoraigne", "Saxby Place",
    13700, 3, 2.5, 124, "1 Dec", "yes", "unknown", "", "", "",
    "", "Townhouse in Saxby Place, available 1 December.", dupes=["p24-117694629"])
add("pp-RR4777019", PP, pp+"centurion-west/eldoraigne/RR4777019", "Townhouse", "Eldoraigne", "",
    14400, 3, 2, 201, "Now", "unknown", "unknown", "24h guard house, access control", "", "",
    "", "201 m² family townhouse in a secure complex with garden.", dupes=["p24-117663220"])
add("pp-RR4795691", PP, pp+"centurion-west/wierda-park/RR4795691", "Townhouse", "Wierda Park", "",
    15500, 3, 2, None, "Now", "yes", "yes", "24h security, access control", "", "",
    "", "Modern townhouse with garden; pets and fibre.", dupes=["p24-117705019"])
add("pp-RR4759593", PP, pp+"centurion-west/wierda-park/owls-nest/193-owl-avenue/RR4759593", "Apartment", "Wierda Park", "Owls Nest, 193 Owl Avenue",
    11500, 3, 2, 95, "Now", "unknown", "unknown", "Security complex", "", "",
    "", "First-floor unit next to Spar.", lat=-25.8471, lng=28.1434, dupes=["p24-117574213"])
add("pp-RR3738527", PP, pp+"centurion-west/wierda-park/RR3738527", "Apartment", "Wierda Park", "",
    11250, 3, 2, 131, "Now", "unknown", "yes", "Access control, electric fence, CCTV", "Karis Properties", "Suzette van Niekerk",
    "", "2nd floor, garage, water included, solar geyser, braai balcony.", dupes=["p24-112324107", "mp-2103048"])
# nearby tier (10–15 min)
add("pp-RR4747920", PP, pp+"centurion-east/midstream-estate/5-brookehaven/001-grass-owl-street/RR4747920", "Apartment", "Midstream Estate", "5 Brookehaven, Grass Owl Street",
    15900, 3, 2, 92, "Now", "unknown", "unknown", "24h guard house, boomed", "M&T Development", "Jenny van Eeden",
    "", "Simplex in a boomed Midstream enclave.", lat=-25.9253, lng=28.2201)
add("pp-RR4657336", PP, pp+"centurion-east/golden-fields-estate/RR4657336", "Apartment", "Golden Fields Estate", "Louwlardia",
    14500, 3, 2, 92, "Now", "unknown", "unknown", "24h security, controlled access", "", "",
    "", "First-floor unit with inverter + battery, pool and clubhouse.", dupes=["p24-117142587", "p24-117607907"])
add("pp-RR4770438", PP, pp+"centurion-east/golden-fields-estate/RR4770438", "Apartment", "Golden Fields Estate", "Louwlardia",
    15800, 3, 2, None, "Now", "unknown", "yes", "Estate", "", "",
    "", "Upmarket unit with double carport.", dupes=["p24-116836573"])

# ---------------- Property24 (card details only – open link for full info) ----------------
def p(id, path, type, suburb, price, beds, baths, **kw):
    add("p24-"+id, P24, p24+path+"/"+id, type, suburb, kw.pop("addr", ""), price, beds, baths, **kw)

p("117601859", "irene/centurion/gauteng/1497", "Apartment", "Irene", 15990, 3, 2, size=108, available="Now",
  security="24h guard house, boomed, fenced", agency="M&T Homes", agent="Albert Williams", addr="Southdowns View, 1240 John Vorster Dr",
  summary="First-floor unit in Southdowns View, 2 carports.")
p("117598016", "doringkloof/centurion/gauteng/477", "Apartment", "Doringkloof", 14000, 3, 2, available="1 Nov", fibre="yes",
  security="'Excellent security'", agency="Wildfig Prop", agent="Heather Miller",
  summary="Semi-detached unit opposite a park, large garage + carport, braai patio.")
p("117708017", "valhalla/centurion/gauteng/2995", "Apartment", "Valhalla", 9000, 3, 2)
p("116182287", "irene/centurion/gauteng/1497", "Apartment", "Irene", 15000, 3, 2)
p("108448565", "die-hoewes/centurion/gauteng/433", "Townhouse", "Die Hoewes", 14400, 3, 3)
p("117701300", "zwartkop/centurion/gauteng/533", "Apartment", "Zwartkop", 11250, 3, 2)
p("117696619", "hennopspark/centurion/gauteng/487", "Townhouse", "Hennopspark", 11190, 3, 2)
p("117713709", "die-hoewes/centurion/gauteng/433", "Townhouse", "Die Hoewes", 13000, 3, 2)
p("117698717", "die-hoewes/centurion/gauteng/433", "House", "Die Hoewes", 13500, 3, 2)
p("117688785", "valhalla/centurion/gauteng/2995", "House", "Valhalla", 12500, 3, 2)
p("117716853", "irene/centurion/gauteng/1497", "Apartment", "Irene", 15000, 3, 2)
p("116361410", "irene/centurion/gauteng/1497", "Apartment", "Irene", 12000, 3, 2)
p("117687431", "valhalla/centurion/gauteng/2995", "House", "Valhalla", 15000, 3, 2)
p("117687365", "wierda-park/centurion/gauteng/384", "Townhouse", "Wierda Park", 15000, 3, 2)
p("116359590", "irene/centurion/gauteng/1497", "Apartment", "Irene", 14300, 3, 2)
p("117611827", "clubview/centurion/gauteng/440", "House", "Clubview", 12960, 3, 2)
p("115607532", "valhalla/centurion/gauteng/2995", "House", "Valhalla", 13750, 3, 2)
p("112537114", "irene/centurion/gauteng/1497", "Apartment", "Irene", 16000, 3, 2)
p("117632552", "eco-park-estate/centurion/gauteng/12768", "Townhouse", "Eco Park Estate", 16000, 3, 2)
p("113042919", "eco-park-estate/centurion/gauteng/12768", "Townhouse", "Eco Park Estate", 16000, 3, 2)
p("117198005", "die-hoewes/centurion/gauteng/433", "Apartment", "Die Hoewes", 16000, 3, 2)
p("117514953", "clubview/centurion/gauteng/440", "Apartment", "Clubview", 14550, 3, 2)
p("117547553", "valhalla/centurion/gauteng/2995", "House", "Valhalla", 16000, 4, 2)
p("117688237", "eldoraigne/centurion/gauteng/558", "House", "Eldoraigne", 16000, 4, 3.5)
# nearby tier
p("117682253", "eldo-lakes-estate/centurion/gauteng/12722", "Apartment", "Eldo Lakes Estate", 13000, 3, 2)
p("117121232", "eldo-lakes-estate/centurion/gauteng/12722", "Apartment", "Eldo Lakes Estate", 12400, 3, 2)
p("116979695", "eldo-lakes-estate/centurion/gauteng/12722", "Apartment", "Eldo Lakes Estate", 12400, 3, 2)
p("117664311", "glen-lauriston/centurion/gauteng/10848", "Apartment", "Glen Lauriston", 8000, 3, 2)

# ---------------- MyProperty ----------------
add("mp-2495362", MP, "https://www.myproperty.co.za/en-za/to-rent/house/gauteng/centurion/die-hoewes/273a-von-willich-ave-blue-crane-2/2495362",
    "Townhouse", "Die Hoewes", "273A Von Willich Ave, Blue Crane", 16000, 3, 3, 200, "1 Nov", "unknown", "unknown", "", "Rize Property Professionals", "Rikie Massyn",
    "", "200 m² with private office, scullery, north garden, double garage.", dupes=["p24-117660643"])
add("mp-2555904", MP, "https://www.myproperty.co.za/en-za/to-rent/apartment/gauteng/centurion/glen-lauriston/3-bedroom/2555904",
    "Apartment", "Glen Lauriston", "Eldo Lakes East", 12500, 3, 2, 101, "1 Dec", "unknown", "unknown", "Estate", "LuxLiv Property Group", "Vanessa Bloem",
    "", "Renovated third-floor unit, granite kitchen, aircon, split-level main bedroom.", dupes=["p24-117562821"])

# ---------------- Gumtree / Facebook / developers ----------------
add("gt-ls26ymnf5jfn0tsfs7m", GT, "https://www.gumtree.co.za/property/centurion/pet-friendly-3-bedroom-2-bathroom-property-for-rent-in-zwartkop-centurion-ls26ymnf5jfn0tsfs7m",
    "House", "Zwartkop", "", 14900, 3, 2, 120, "", "yes", "unknown", "Freestanding house, garage", "Private owner", "Vanessa De Pinho",
    "", "Pet-friendly freestanding facebrick house, load-shedding free zone, prepaid electricity.")
add("fb-1771860964034548", FB, "https://www.facebook.com/marketplace/item/1771860964034548/",
    "Apartment", "Centurion", "Centurion 0157", 11000, 3, 2, None, "", "unknown", "unknown", "Complex with pool", "Private (Facebook)", "Madeleen",
    "", "2nd-floor unit with balcony, built-in braai, pool and garage.",
    note="Might be the same unit as the Wierda Park R11,250 listing. Never pay a deposit before viewing.")
add("dev-colorado-amberfield", DEV, "https://www.centraldevelopments.co.za/colorado-apartments-and-houses-to-let-in-centurion",
    "Simplex", "Heuweloord", "Colorado @ Amberfield City, 86 Apiesdoring Dr", 15000, 3, 2, 74, "Now", "small pets", "unknown", "Multi-layer 24h security",
    "Central Developments", "Patricia Mokwena", "0600153747", "New developer-run estate renting directly. 3/2 simplex houses from R15,000.")

# ---------------- West side (near TecWise, Wierdapark) – Property24 cards ----------------
for args in [
    ("117712519", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 11850, 3, 2),
    ("117647592", "raslouw/centurion/gauteng/383", "Apartment", "Raslouw", 11000, 3, 2),
    ("117674355", "the-reeds/centurion/gauteng/516", "Townhouse", "The Reeds", 12500, 3, 2),
    ("117448657", "thatchfield-manor/centurion/gauteng/16481", "Townhouse", "Thatchfield Manor", 15000, 3, 2.5),
    ("117710400", "thatchfield-cresent/centurion/gauteng/16996", "Townhouse", "Thatchfield Cresent", 15000, 3, 2),
    ("117698327", "heuwelsig-estate/centurion/gauteng/10935", "Townhouse", "Heuwelsig Estate", 14000, 3, 2),
    ("117698243", "heuwelsig-estate/centurion/gauteng/10935", "Townhouse", "Heuwelsig Estate", 10200, 3, 2),
    ("117716791", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 11750, 3, 2),
    ("112858227", "kosmosdal/centurion/gauteng/10811", "House", "Kosmosdal", 15000, 3, 3),
    ("117699242", "amberfield-heights/centurion/gauteng/569", "Townhouse", "Amberfield Heights", 14000, 3, 2),
    ("112614678", "thatchfield-close/centurion/gauteng/17799", "House", "Thatchfield Close", 16000, 3, 2),
    ("117667527", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 14500, 4, 2),
    ("117676484", "monavoni/centurion/gauteng/382", "Townhouse", "Monavoni", 15999, 3, 2),
    ("117687767", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 13000, 3, 2),
    ("117696624", "thatchfield-estate/centurion/gauteng/10817", "House", "Thatchfield Estate", 14200, 3, 2),
    ("117660470", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 16000, 3, 2.5),
    ("117100608", "amberfield-valley/centurion/gauteng/11864", "House", "Amberfield Valley", 16000, 3, 2),
    ("117678317", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 16000, 3, 2),
    ("117630880", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 13500, 4, 2),
    ("117696702", "raslouw/centurion/gauteng/383", "Townhouse", "Raslouw", 10250, 3, 2),
    ("117676891", "heuweloord/centurion/gauteng/377", "House", "Heuweloord", 12000, 3, 2),
    ("117616335", "thatchfield-ridge/centurion/gauteng/33394", "House", "Thatchfield Ridge", 15500, 3, 2),
    ("117708123", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 9900, 3, 2),
    ("117712120", "monavoni/centurion/gauteng/382", "Townhouse", "Monavoni", 13500, 3, 2),
    ("117583697", "amberfield-manor/centurion/gauteng/10873", "Apartment", "Amberfield Manor", 15500, 3, 2),
    ("117537399", "heuweloord/centurion/gauteng/377", "House", "Heuweloord", 11900, 3, 2),
    ("117620884", "amberfield/centurion/gauteng/579", "Townhouse", "Amberfield", 12200, 3, 2),
    ("117264070", "thatchfield-estate/centurion/gauteng/10817", "House", "Thatchfield Estate", 16000, 3, 2),
    ("117707281", "raslouw-ah/centurion/gauteng/32906", "House", "Raslouw AH", 13900, 3, 2),
    ("117559428", "celtisdal/centurion/gauteng/393", "Townhouse", "Celtisdal", 15000, 3, 2),
    ("113889372", "kosmosdal/centurion/gauteng/10811", "Townhouse", "Kosmosdal", 10000, 3, 2),
    ("117501735", "heuweloord/centurion/gauteng/377", "House", "Heuweloord", 14500, 3, 2),
    ("117552658", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 16000, 3, 2),
    ("117516737", "raslouw-ah/centurion/gauteng/32906", "Townhouse", "Raslouw AH", 14700, 3, 3),
    ("117147245", "monavoni/centurion/gauteng/382", "Apartment", "Monavoni", 13050, 3, 2),
    ("117530828", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 14000, 3, 3),
    ("113615862", "heuwelsig-estate/centurion/gauteng/10935", "Townhouse", "Heuwelsig Estate", 12450, 3, 2),
    ("115941507", "amberfield-manor/centurion/gauteng/10873", "Townhouse", "Amberfield Manor", 14200, 3, 2),
    ("117517402", "thatchfield-close/centurion/gauteng/17799", "Townhouse", "Thatchfield Close", 14500, 3, 2),
    ("114942368", "celtisdal/centurion/gauteng/393", "Apartment", "Celtisdal", 11000, 3, 2),
    ("117500310", "the-reeds/centurion/gauteng/516", "House", "The Reeds", 13900, 3, 2),
    ("117393174", "amberfield-crest-estate/centurion/gauteng/12765", "House", "Amberfield Crest Estate", 14500, 3, 2),
    ("117299552", "celtisdal/centurion/gauteng/393", "Apartment", "Celtisdal", 11000, 3, 2),
    ("117308601", "celtisdal/centurion/gauteng/393", "Apartment", "Celtisdal", 12000, 3, 2),
    ("117148989", "celtisdal/centurion/gauteng/393", "Apartment", "Celtisdal", 10800, 3, 2),
    ("116727646", "rooihuiskraal/centurion/gauteng/409", "Townhouse", "Rooihuiskraal", 14000, 3, 2),
    ("116689076", "heuweloord/centurion/gauteng/377", "House", "Heuweloord", 13500, 3, 2),
    ("117088435", "raslouw/centurion/gauteng/383", "Apartment", "Raslouw", 10500, 3, 2),
    ("117507920", "heuweloord/centurion/gauteng/377", "House", "Heuweloord", 15000, 3, 2),
]:
    p(*args)
p("117703942", "heuweloord/centurion/gauteng/377", "Apartment", "Heuweloord", 12500, 3, 2, available="1 Nov", pets="yes",
  security="24h security", addr="Sagewood", summary="Load-shedding-free unit in Sagewood with solar, double garage, near Mall@55.",
  dupes=["mp-2564948"])
p("117688333", "the-reeds/centurion/gauteng/516", "Apartment", "The Reeds", 13000, 3, 2, size=145, available="Now", pets="yes",
  summary="145 m² unit in a quiet complex, garden access, single garage. Pet friendly.")

out = []
seen_drop = []
for r in R:
    if "lat" in r:
        r["geo"] = "exact"
    enrich(r)
    if r["tier"] == "outside":
        seen_drop.append(r["id"]); continue
    r.setdefault("dupes", [])
    r.setdefault("note", "")
    r.setdefault("phone_work", "")
    r["first_seen"] = TODAY
    r["last_seen"] = TODAY
    r["active"] = True
    r["price_history"] = [{"date": TODAY, "price": r["price"]}]
    out.append(r)

doc = {"updated": TODAY, "criteria": {
    "beds_min": 3, "baths_min": 2, "max_price": 16000,
    "anchors": ANCHORS, "core_minutes": 10, "nearby_minutes": 15,
    "nice_to_have": ["pet friendly (two cats)", "fibre", "good security"]},
    "listings": sorted(out, key=lambda x: (x["tier"] != "core", x["price"]))}
os.makedirs(os.path.join(ROOT, "data", "history"), exist_ok=True)
with open(os.path.join(ROOT, "data", "listings.json"), "w") as f:
    json.dump(doc, f, indent=1, ensure_ascii=False)
with open(os.path.join(ROOT, "data", "history", TODAY + ".json"), "w") as f:
    json.dump(doc, f, indent=1, ensure_ascii=False)
print("dropped (too far):", len(seen_drop)); print(len(out), "listings;", sum(1 for x in out if x["tier"] == "core"), "core")
for x in out:
    print(f"{x['tier']:6} {x['min_tecwise']:>3}/{x['min_drive']:>3}min R{x['price']:>6} {x['beds']}/{x['baths']} {x['suburb']:<20} {x['source']}")
