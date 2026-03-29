"use client";

import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApi } from "@/hooks/use-api";

interface ExportButtonProps {
  queryString: string;
}

export function ExportButton({ queryString }: ExportButtonProps) {
  const { apiCall } = useApi();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const response = await apiCall(
        `/public-data/parcels/export?${queryString}`,
        { raw: true },
      );

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = "parcels-export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error("Export failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleExport}
      disabled={loading}
      className="gap-2"
    >
      <Download className="h-4 w-4" />
      {loading ? "Exporting..." : "Export CSV"}
    </Button>
  );
}
