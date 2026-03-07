import requests
import json
from geopy.geocoders import Nominatim
from pyproj import Transformer

# ----------------------------
# CONFIG
# ----------------------------
ARC_GIS_URL = "https://gisweb.brooklinema.gov/arcgis/rest/services/Map_Gallery/Geophysical/MapServer/17/query"
BUFFER_METERS = 10  # how big around the parcel point to query
OUT_FIELDS = "ZONECLASS"  # fields you want to extract
IN_SR = 4326            # input spatial reference (lat/lon)
OUT_SR = 102100         # Web Mercator for ArcGIS query

# ----------------------------
# UTILS
# ----------------------------
def geocode_address(address: str):
    """Geocode using Nominatim (OpenStreetMap)"""
    geolocator = Nominatim(user_agent="parcel_lookup")
    location = geolocator.geocode(address)
    if not location:
        raise ValueError(f"Could not geocode address: {address}")
    return location.latitude, location.longitude

def latlon_to_web_mercator(lat, lon):
    """Convert lat/lon to Web Mercator (EPSG:102100)"""
    transformer = Transformer.from_crs("epsg:4326", "epsg:102100")
    x, y = transformer.transform(lat, lon)
    return x, y

def build_geometry(x, y, buffer=BUFFER_METERS):
    """Create small bounding box around parcel point"""
    return {
        "xmin": x - buffer,
        "ymin": y - buffer,
        "xmax": x + buffer,
        "ymax": y + buffer
    }

def query_arcgis(geometry):
    """Query ArcGIS FeatureServer for zoning / parcel info"""
    params = {
        "f": "json",
        "geometry": json.dumps(geometry),
        "geometryType": "esriGeometryEnvelope",
        "inSR": OUT_SR,
        "outSR": OUT_SR,
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": OUT_FIELDS,
        "where": "1=1",
        "returnCentroid": "true"
    }
    resp = requests.get(ARC_GIS_URL, params=params)
    if resp.status_code != 200:
        raise RuntimeError(f"ArcGIS query failed: {resp.text}")
    data = resp.json()
    return data

def extract_parcel_profile(data):
    """Convert ArcGIS JSON response into simple parcel profile"""
    features = data.get("features", [])
    if not features:
        return {"zoning": None, "raw": data}
    
    # For now just take the first feature (usually only one)
    feature = features[0]
    profile = {
        "zoning": feature["attributes"].get("ZONECLASS"),
        "centroid": feature.get("geometry")
    }
    return profile

# ----------------------------
# MAIN FUNCTION
# ----------------------------
def get_parcel_profile(address: str):
    # 1️⃣ Geocode
    lat, lon = geocode_address(address)
    
    # 2️⃣ Convert to Web Mercator
    x, y = latlon_to_web_mercator(lat, lon)
    
    # 3️⃣ Build query geometry
    geom = build_geometry(x, y)
    
    # 4️⃣ Query ArcGIS
    data = query_arcgis(geom)
    
    # 5️⃣ Extract parcel profile
    profile = extract_parcel_profile(data)
    profile["address"] = address
    profile["latlon"] = {"lat": lat, "lon": lon}
    
    return profile

# ----------------------------
# EXAMPLE USAGE
# ----------------------------
if __name__ == "__main__":
    address = "93 Williston Rd, Brookline, MA"
    profile = get_parcel_profile(address)
    print(json.dumps(profile, indent=2))

