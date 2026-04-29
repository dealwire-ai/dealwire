-- Add latitude / longitude columns for the parcel map view.
-- Both nullable; the PLUTO ingest will populate them on the next run, and
-- the map page filters out parcels without coordinates so this is forward-
-- compatible without a backfill SQL step.

ALTER TABLE "Parcel" ADD COLUMN "latitude" DOUBLE PRECISION,
ADD COLUMN "longitude" DOUBLE PRECISION;
