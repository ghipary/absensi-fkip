import { Skeleton, SkeletonKartu, SkeletonTabel } from "./skeleton";

/**
 * Kerangka halaman universal untuk `loading.tsx` per-rute.
 * Meniru bentuk halaman akhir (judul + kartu statistik + tabel) agar transisi
 * antar-tab terasa responsif walau data masih dimuat dari server.
 */
export function PageSkeleton({
  kartu = 4,
  baris = 7,
  kolom = 6,
}: {
  kartu?: number;
  baris?: number;
  kolom?: number;
}) {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Memuat halaman"
    >
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: kartu }).map((_, i) => (
          <SkeletonKartu key={i} />
        ))}
      </div>

      <SkeletonTabel baris={baris} kolom={kolom} />
    </div>
  );
}
