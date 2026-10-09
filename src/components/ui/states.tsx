import * as React from "react";
import { cn } from "@/lib/utils";
import { Inbox, AlertTriangle, type LucideIcon } from "lucide-react";
import { Button } from "./button";

/**
 * Tiga state wajib tiap halaman.
 * EmptyState: ikon outline + kalimat penjelas + CTA relevan.
 * ErrorState: pesan manusiawi + tombol coba lagi + detail teknis tersembunyi.
 */

type EmptyStateProps = {
  icon?: LucideIcon;
  judul: string;
  deskripsi: string;
  aksi?: React.ReactNode;
  /** Ukuran compact untuk panel samping */
  compact?: boolean;
};

function EmptyState({
  icon: Icon = Inbox,
  judul,
  deskripsi,
  aksi,
  compact,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "px-6 py-16"
      )}
      role="status"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-surface-muted text-fg-muted">
        <Icon className="h-5 w-5" strokeWidth={1.5} aria-hidden />
      </div>
      <p className="mt-4 text-base font-semibold text-fg">{judul}</p>
      <p className="mt-1 max-w-sm text-sm text-fg-muted">{deskripsi}</p>
      {aksi && <div className="mt-4">{aksi}</div>}
    </div>
  );
}

type ErrorStateProps = {
  judul?: string;
  pesan: string;
  detail?: string;
  onRetry?: () => void;
  compact?: boolean;
};

function ErrorState({
  judul = "Terjadi kesalahan",
  pesan,
  detail,
  onRetry,
  compact,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-danger-border bg-danger-bg text-center",
        compact ? "px-4 py-6" : "px-6 py-12"
      )}
      role="alert"
    >
      <AlertTriangle className="h-5 w-5 text-danger-text" strokeWidth={1.5} aria-hidden />
      <p className="mt-3 text-base font-semibold text-fg">{judul}</p>
      <p className="mt-1 max-w-md text-sm text-fg-muted">{pesan}</p>
      <div className="mt-4 flex items-center gap-3">
        {onRetry && (
          <Button variant="secondary" size="sm" onClick={onRetry}>
            Coba lagi
          </Button>
        )}
        {detail && (
          <details className="text-left">
            <summary className="cursor-pointer text-xs text-fg-subtle underline-offset-2 hover:underline">
              Detail teknis
            </summary>
            <pre className="mt-2 max-w-md overflow-auto rounded border border-border bg-surface p-2 font-mono-nums text-2xs text-fg-muted">
              {detail}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

/** Halaman penuh: judul + deskripsi + ikon */
function HalamanKosong({
  judul,
  deskripsi,
  aksi,
  icon,
}: {
  judul: string;
  deskripsi: string;
  aksi?: React.ReactNode;
  icon?: LucideIcon;
}) {
  return (
    <div className="rounded-lg border border-border bg-surface-gradient">
      <EmptyState icon={icon} judul={judul} deskripsi={deskripsi} aksi={aksi} />
    </div>
  );
}

export { EmptyState, ErrorState, HalamanKosong };
