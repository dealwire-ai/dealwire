"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { Camera, ImageOff } from "lucide-react";

interface StreetViewImageProps {
  address: string;
  borough: string;
  zipCode: string | null;
  className?: string;
}

const BOROUGH_NAMES: Record<string, string> = {
  "1": "Manhattan",
  "2": "Bronx",
  "3": "Brooklyn",
  "4": "Queens",
  "5": "Staten Island",
};

export function StreetViewImage({
  address,
  borough,
  zipCode,
  className,
}: StreetViewImageProps) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const fullAddress = `${address}, ${BOROUGH_NAMES[borough] ?? borough}, NY${zipCode ? ` ${zipCode}` : ""}`;
  const encodedAddress = encodeURIComponent(fullAddress);

  const [status, setStatus] = useState<"loading" | "available" | "unavailable">(
    apiKey ? "loading" : "unavailable",
  );
  const [imageLoaded, setImageLoaded] = useState(false);

  useEffect(() => {
    if (!apiKey) return;

    const controller = new AbortController();
    fetch(
      `https://maps.googleapis.com/maps/api/streetview/metadata?location=${encodedAddress}&key=${apiKey}`,
      { signal: controller.signal },
    )
      .then((res) => res.json())
      .then((data) =>
        setStatus(data.status === "OK" ? "available" : "unavailable"),
      )
      .catch(() => {
        if (!controller.signal.aborted) setStatus("unavailable");
      });

    return () => controller.abort();
  }, [encodedAddress, apiKey]);

  if (status === "unavailable") {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-zinc-600 ${className ?? "h-[200px] w-full"}`}
      >
        <ImageOff className="h-8 w-8 mb-2" />
        <span className="text-xs">No Street View</span>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div
        className={`flex flex-col items-center justify-center rounded-md bg-zinc-900 border border-zinc-800 text-zinc-600 animate-pulse ${className ?? "h-[200px] w-full"}`}
      >
        <Camera className="h-8 w-8 mb-2" />
        <span className="text-xs">Loading Street View...</span>
      </div>
    );
  }

  const imageUrl = `https://maps.googleapis.com/maps/api/streetview?size=600x400&location=${encodedAddress}&key=${apiKey}`;

  return (
    <div
      className={`relative overflow-hidden rounded-md ${className ?? "h-[200px] w-full"}`}
    >
      {!imageLoaded && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-600 animate-pulse">
          <Camera className="h-8 w-8 mb-2" />
          <span className="text-xs">Loading Street View...</span>
        </div>
      )}
      <Image
        src={imageUrl}
        alt={`Street view of ${address}`}
        width={600}
        height={400}
        className={`object-cover w-full h-full transition-opacity duration-300 ${imageLoaded ? "opacity-100" : "opacity-0"}`}
        unoptimized
        onLoad={() => setImageLoaded(true)}
        onError={() => setStatus("unavailable")}
      />
    </div>
  );
}
