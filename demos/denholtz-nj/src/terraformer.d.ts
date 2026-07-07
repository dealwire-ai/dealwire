declare module "@terraformer/arcgis" {
  import type { GeoJSON, Geometry } from "geojson";
  export function arcgisToGeoJSON(
    arcgis: unknown,
    idAttribute?: string,
  ): GeoJSON;
  export function geojsonToArcGIS(
    geojson: Geometry | GeoJSON,
    idAttribute?: string,
  ): unknown;
}
