import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Inisial dari nama: "Rani Ayu" → "RA".
 * Aman untuk nama kosong/undefined. Diletakkan di lib (bukan file "use client")
 * agar dapat dipanggil dari Server Component.
 */
export function inisial(nama?: string | null) {
  const bersih = (nama ?? "").trim();
  if (!bersih) return "?";
  return bersih
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

/** Format tanggal Indonesia: "8 Oktober 2026" */
export function tanggalIndo(date: Date | string, opts?: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...opts,
  }).format(new Date(date));
}

/** Format jam: "08:00" */
export function jamIndo(date: Date | string) {
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

/** NIM ditampilkan dengan font mono: "23101042" */
export function formatNim(nim: string) {
  return nim;
}

/** Persentase dibulatkan 1 desimal, hindari -0 */
export function persen(n: number) {
  const v = Math.round(n * 10) / 10;
  return v === 0 ? 0 : v;
}

/** Jarak antar 2 koordinat (meter) — formula haversine */
export function jarakMeter(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
