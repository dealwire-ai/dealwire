"use client";

import { useEffect, useMemo, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
} from "@vis.gl/react-google-maps";
import { Layers, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";
import { ParcelDetailSheet } from "@/components/parcels/parcel-detail-sheet";
import type { OrgMember } from "@/components/parcels/assign-popover";
import type { PipelineDeal, PipelineDealsResponse } from "./types";

// Fallback center if no deals have coords (Times Square — middle of NYC).
const NYC_FALLBACK = { lat: 40.7589, lng: -73.9851 };

type MapType = "roadmap" | "satellite";

export function DealMap() {
  const { apiCall } = useApi();
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  const [deals, setDeals] = useState<PipelineDeal[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mapType, setMapType] = useState<MapType>("roadmap");
  const [openBbl, setOpenBbl] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [dealRes, memberRes] = await Promise.all([
          apiCall("/public-data/crm/deals") as Promise<PipelineDealsResponse>,
          apiCall("/public-data/crm/org-members").catch(() => ({
            members: [] as OrgMember[],
          })) as Promise<{ members: OrgMember[] }>,
        ]);
        setDeals(dealRes.deals);
        setMembers(memberRes.members ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load map");
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Only deals whose parcel has coordinates can be plotted. PLUTO populates
  // these on ingest — orgs may need to re-run ingestion to fill in legacy
  // parcels that were stored before this column existed.
  const plottable = useMemo(
    () =>
      deals.filter(
        (d) =>
          typeof d.parcel.latitude === "number" &&
          typeof d.parcel.longitude === "number",
      ),
    [deals],
  );

  if (!apiKey) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Map unavailable — NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is not configured.
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-zinc-500">
        Loading map…
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold text-zinc-100">Map</h1>
          <p className="text-xs text-zinc-500">
            {plottable.length} of {deals.length} deals plotted
            {plottable.length < deals.length && (
              <>
                {" "}
                — the rest are missing coordinates and will appear after the
                next PLUTO ingest run.
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {error && <span className="text-xs text-red-400">{error}</span>}
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setMapType((t) => (t === "roadmap" ? "satellite" : "roadmap"))
            }
          >
            <Layers className="mr-2 h-4 w-4" />
            {mapType === "roadmap" ? "Satellite" : "Map"}
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-hidden rounded-lg border border-zinc-800">
        <APIProvider apiKey={apiKey}>
          <Map
            mapId="dealwire-deal-map"
            mapTypeId={mapType}
            defaultCenter={NYC_FALLBACK}
            defaultZoom={11}
            gestureHandling="greedy"
            disableDefaultUI={false}
            clickableIcons={false}
            colorScheme="DARK"
          >
            <FitBoundsToDeals deals={plottable} />
            {plottable.map((deal) => (
              <AdvancedMarker
                key={deal.id}
                position={{
                  lat: deal.parcel.latitude as number,
                  lng: deal.parcel.longitude as number,
                }}
                title={deal.parcel.address ?? `BBL ${deal.parcel.bbl}`}
                onClick={() => setOpenBbl(deal.parcel.bbl)}
              >
                <Pin color={deal.stage.color} />
              </AdvancedMarker>
            ))}
          </Map>
        </APIProvider>
      </div>

      <ParcelDetailSheet
        open={openBbl !== null}
        onOpenChange={(o) => !o && setOpenBbl(null)}
        bbl={openBbl}
        members={members}
        onParcelUpdated={() => {
          // Map markers don't currently re-render based on parcel mutations
          // (assignee/list don't change a marker's coords or color). If we
          // ever color markers by assignee, refresh the deal list here.
        }}
      />
    </div>
  );
}

// Auto-zoom to fit all plotted deals once the map is ready. Re-fits whenever
// the deal set changes shape (e.g. an org loads more parcels).
function FitBoundsToDeals({ deals }: { deals: PipelineDeal[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || deals.length === 0) return;
    const bounds = new google.maps.LatLngBounds();
    for (const d of deals) {
      bounds.extend({
        lat: d.parcel.latitude as number,
        lng: d.parcel.longitude as number,
      });
    }
    map.fitBounds(bounds, 64);
  }, [map, deals]);
  return null;
}

// Custom drop-pin marker tinted with the stage color so users can see the
// pipeline stage at a glance without needing a hover.
function Pin({ color }: { color: string | null }) {
  const fill = color ?? "#3b82f6";
  return (
    <div
      className="cursor-pointer drop-shadow-md"
      style={{ transform: "translateY(-50%)" }}
    >
      <MapPin
        className="h-7 w-7"
        fill={fill}
        stroke="#0a0a0a"
        strokeWidth={1.5}
      />
    </div>
  );
}
