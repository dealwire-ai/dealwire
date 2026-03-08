-- AlterTable
ALTER TABLE "Parcel" ADD COLUMN     "city" TEXT,
ADD COLUMN     "state" TEXT;

-- Backfill city/state for existing NYC parcels
UPDATE "Parcel" SET
  city = CASE borough
    WHEN '1' THEN 'Manhattan'
    WHEN '2' THEN 'Bronx'
    WHEN '3' THEN 'Brooklyn'
    WHEN '4' THEN 'Queens'
    WHEN '5' THEN 'Staten Island'
  END,
  state = 'NY'
WHERE city IS NULL;
