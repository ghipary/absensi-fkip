"use client";

import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Tombol unduh data sebagai file CSV (UTF-8 dengan BOM agar terbaca Excel).
 * `baris` adalah array dua dimensi; nilai di-serialize otomatis.
 */
export function TombolCSV({
  filename,
  baris,
  label,
  ikon,
}: {
  filename: string;
  baris: (string | number | null)[][];
  label: string;
  ikon?: React.ReactNode;
}) {
  function unduh() {
    const csv = baris
      .map((r) =>
        r
          .map((sel) => {
            const s = sel === null || sel === undefined ? "" : String(sel);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
          })
          .join(",")
      )
      .join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <Button variant="secondary" size="sm" onClick={unduh}>
      {ikon ?? <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
      {label}
    </Button>
  );
}