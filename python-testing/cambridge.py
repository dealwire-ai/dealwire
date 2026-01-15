import requests
import json
from geopy.geocoders import Nominatim
from pyproj import Transformer

PARCEL_LAYER_URL = "https://services1.arcgis.com/WnzC35krSYGuYov4/arcgis/rest/services/Parcels/FeatureServer/0/query"
ZONING_LAYER_URL = "https://services1.arcgis.com/WnzC35krSYGuYov4/arcgis/rest/services/CDD_ZoningDistricts/FeatureServer/0/query"

OUT_SR = 102100
PARCEL_FIELDS = "PARCEL_ID,Shape__Area"
ZONING_FIELDS = "ZONE_CODE,DISTRICT,OVERLAY"

# ----------------------------
# UTILS
# ----------------------------
def geocode_address(address: str):
    print(f"[LOG] Geocoding address: {address}")
    geolocator = Nominatim(user_agent="cambridge_zoning_lookup")
    location = geolocator.geocode(address)
    if not location:
        raise ValueError(f"[ERROR] Could not geocode address: {address}")
    print(f"[LOG] Geocoded to lat={location.latitude}, lon={location.longitude}")
    return location.latitude, location.longitude

def latlon_to_web_mercator(lat, lon):
    print(f"[LOG] Converting to Web Mercator...")
    transformer = Transformer.from_crs("epsg:4326", "epsg:102100")
    x, y = transformer.transform(lat, lon)
    print(f"[LOG] Converted coordinates: x={x}, y={y}")
    return x, y

def build_geometry(x, y, buffer):
    geom = {"xmin": x - buffer, "ymin": y - buffer, "xmax": x + buffer, "ymax": y + buffer}
    return geom

def query_arcgis_layer(url, geometry, out_fields):
    params = {
        "f": "json",
        "geometry": json.dumps(geometry),
        "geometryType": "esriGeometryEnvelope",
        "inSR": OUT_SR,
        "outSR": OUT_SR,
        "spatialRel": "esriSpatialRelIntersects",
        "outFields": out_fields,
        "where": "1=1",
        "returnCentroid": "true"
    }
    resp = requests.get(url, params=params)
    if resp.status_code != 200:
        raise RuntimeError(f"[ERROR] ArcGIS query failed: {resp.text}")
    data = resp.json()
    return data

def extract_first_feature(data, fields):
    features = data.get("features", [])
    if not features:
        return None
    return features[0]["attributes"]

def find_feature_with_buffer(url, fields, x, y, start_buffer=20, max_buffer=200):
    buffer = start_buffer
    while buffer <= max_buffer:
        print(f"[LOG] Trying buffer: {buffer} meters")
        geom = build_geometry(x, y, buffer)
        data = query_arcgis_layer(url, geom, fields)
        feature = extract_first_feature(data, fields)
        if feature:
            print(f"[LOG] Found feature with buffer {buffer} meters")
            return feature
        buffer *= 2  # double buffer each iteration
    print(f"[WARN] No feature found up to {max_buffer} meters")
    return {field: None for field in fields.split(",")}

# ----------------------------
# MAIN FUNCTION
# ----------------------------
def get_cambridge_parcel_profile(address: str):
    lat, lon = geocode_address(address)
    x, y = latlon_to_web_mercator(lat, lon)

    parcel_info = find_feature_with_buffer(PARCEL_LAYER_URL, PARCEL_FIELDS, x, y)
    zoning_info = find_feature_with_buffer(ZONING_LAYER_URL, ZONING_FIELDS, x, y)

    profile = {
        "address": address,
        "latlon": {"lat": lat, "lon": lon},
        "parcel": parcel_info,
        "zoning": zoning_info
    }
    return profile

# ----------------------------
# RUN EXAMPLE
# ----------------------------
if __name__ == "__main__":
    mit_address = "77 Massachusetts Ave, Cambridge, MA 02139"
    profile = get_cambridge_parcel_profile(mit_address)
    print(json.dumps(profile, indent=2))

