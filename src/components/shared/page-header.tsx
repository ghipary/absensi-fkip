import * as React from "react";
import { cn } from "@/lib/utils";
import { ChevronRight } from "lucide-react";
import Link from "next/link";

/** Judul halaman + deskripsi + aksi kanan. */
export function PageHeader({
  judul,
  deskripsi,
  aksi,
  className,
}: {
  judul: string;
  deskripsi?: string;
  aksi?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-6 flex flex-wrap items-start justify-between gap-4",
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-fg">
          <span aria-hidden className="h-6 w-1.5 rounded-pill bg-brand-gradient" />
          {judul}
        </h1>
        {deskripsi && (
          <p className="mt-1.5 text-sm text-fg-muted">{deskripsi}</p>
        )}
      </div>
      {aksi && <div className="flex items-center gap-2">{aksi}</div>}
    </div>
  );
}

/** Breadcrumb otomatis dari segmen path. */
export function Breadcrumb({ segments }: { segments: string[] }) {
  const terjemah = (s: string) =>
    s
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      <ol className="flex items-center gap-1">
        {segments.map((seg, i) => {
          const terakhir = i === segments.length - 1;
          return (
            <li key={i} className="flex items-center gap-1">
              {i > 0 && (
                <ChevronRight className="h-3.5 w-3.5 text-fg-subtle" aria-hidden />
              )}
              <span
                className={cn(
                  terakhir ? "font-medium text-fg" : "text-fg-muted",
                  "hover:text-fg"
                )}
                aria-current={terakhir ? "page" : undefined}
              >
                {terjemah(seg)}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

/** Kartu statistik dashboard — angka memakai mono. */
export function StatCard({
  label,
  value,
  sub,
  trend,
  ikon,
  href,
}: {
  label: string;
  value: string | number;
  sub?: string;
  trend?: { arah: "naik" | "turun" | "netral"; teks: string };
  ikon?: React.ReactNode;
  href?: string;
}) {
  const isi = (
    <>
      <div className="flex items-start justify-between gap-3">
        <span className="text-xs font-medium text-fg-muted">{label}</span>
        {ikon && (
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-subtle text-accent transition-transform duration-200 group-hover:scale-110">
            {ikon}
          </span>
        )}
      </div>
      <div className="mt-3 font-mono-nums text-3xl font-semibold tracking-tight text-fg">
        {value}
      </div>
      <div className="mt-1 flex items-center gap-2">
        {trend && (
          <span
            className={cn(
              "text-xs font-medium",
              trend.arah === "naik" && "text-success-text",
              trend.arah === "turun" && "text-danger-text",
              trend.arah === "netral" && "text-fg-muted"
            )}
          >
            {trend.teks}
          </span>
        )}
        {sub && <span className="text-xs text-fg-subtle">{sub}</span>}
      </div>
    </>
  );

  const kelas =
    "group block animate-rise rounded-xl border border-border bg-surface p-5 shadow-card transition-all duration-200 ease-out hover:-translate-y-0.5 hover:border-accent-border hover:shadow-card-hover";

  if (href) {
    return (
      <Link href={href} className={kelas}>
        {isi}
      </Link>
    );
  }
  return <div className={kelas}>{isi}</div>;
}
