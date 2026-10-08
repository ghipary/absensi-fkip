"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Error boundary universal untuk semua halaman di bawah (dashboard).
 * Menampilkan pesan galat berbahasa Indonesia + tombol coba lagi.
 */
export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] galat render:", error);
  }, [error]);

  return (
    <div
      role="alert"
      className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center"
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-lg border border-danger-border bg-danger-bg text-danger-text">
        <AlertTriangle className="h-6 w-6" strokeWidth={1.5} aria-hidden />
      </span>
      <h1 className="mt-4 text-lg font-semibold text-fg">Terjadi kesalahan</h1>
      <p className="mt-1.5 max-w-md text-sm text-fg-muted">
        Data gagal dimuat atau terdapat masalah saat menampilkan halaman ini.
        Coba muat ulang; bila masalah berlanjut, hubungi pengelola sistem.
      </p>
      {error.digest && (
        <p className="mt-2 font-mono-nums text-2xs text-fg-subtle">
          Kode galat: {error.digest}
        </p>
      )}
      <Button className="mt-5" onClick={reset}>
        <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
        Coba lagi
      </Button>
    </div>
  );
}
