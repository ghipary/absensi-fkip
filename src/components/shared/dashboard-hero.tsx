import * as React from "react";
import { cn } from "@/lib/utils";
import { GraduationCap } from "lucide-react";

/**
 * Pita sambutan untuk halaman dashboard.
 *
 * Gaya: permukaan kartu dengan lapisan gradasi merek lembut, blob dekoratif,
 * dan watermark ikon akademik — memberi nuansa pendidikan tanpa mengorbankan
 * keterbacaan (teks tetap di atas permukaan solid).
 */
export function DashboardHero({
  label,
  judul,
  deskripsi,
  aksi,
  ikon,
  className,
}: {
  /** Label kecil di atas judul, mis. "Mahasiswa" atau "Kaprodi". */
  label?: string;
  judul: string;
  deskripsi?: string;
  aksi?: React.ReactNode;
  ikon?: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        "relative mb-6 animate-rise overflow-hidden rounded-xl border border-border bg-surface-gradient shadow-card",
        className
      )}
    >
      {/* Lapisan gradasi merek lembut */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-brand-gradient opacity-[0.1]"
      />
      {/* Blob dekoratif untuk kedalaman */}
      <div
        aria-hidden
        className="pointer-events-none absolute -right-16 -top-24 h-56 w-56 rounded-full bg-accent opacity-15 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -left-10 h-52 w-52 rounded-full bg-info opacity-10 blur-3xl"
      />
      {/* Watermark ikon akademik */}
      <GraduationCap
        aria-hidden
        strokeWidth={1}
        className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-accent opacity-10"
      />

      <div className="relative flex flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-brand-gradient text-white shadow-sm motion-safe:animate-gradient-pan">
            {ikon ?? (
              <GraduationCap className="h-5 w-5" strokeWidth={1.5} aria-hidden />
            )}
          </span>
          <div className="min-w-0">
            {label && (
              <p className="text-2xs font-semibold uppercase tracking-wider text-accent">
                {label}
              </p>
            )}
            <h1 className="mt-0.5 truncate text-xl font-semibold tracking-tight text-fg sm:text-2xl">
              {judul}
            </h1>
            {deskripsi && (
              <p className="mt-1 text-sm text-fg-muted">{deskripsi}</p>
            )}
          </div>
        </div>
        {aksi && <div className="flex flex-wrap items-center gap-2">{aksi}</div>}
      </div>
    </section>
  );
}
