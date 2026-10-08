import { Skeleton, SkeletonKartu, SkeletonTabel } from "@/components/ui/skeleton";

/** Skeleton universal untuk semua halaman di bawah (dashboard). */
export default function Loading() {
  return (
    <div
      className="flex flex-col gap-6"
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label="Memuat halaman"
    >
      {/* Judul halaman */}
      <div>
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-96 max-w-full" />
      </div>

      {/* Kartu statistik */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonKartu key={i} />
        ))}
      </div>

      {/* Konten tabel */}
      <SkeletonTabel baris={7} kolom={6} />
    </div>
  );
}
