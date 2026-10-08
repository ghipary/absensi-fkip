import { cn } from "@/lib/utils";

/** Skeleton meniru bentuk akhir halaman — bukan spinner global. */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "animate-pulse rounded bg-surface-muted",
        className
      )}
      {...props}
    />
  );
}

/** Baris skeleton untuk tabel */
function SkeletonBaris({ kolom = 5 }: { kolom?: number }) {
  return (
    <div className="flex h-9 items-center gap-4 border-b border-border px-3">
      {Array.from({ length: kolom }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-3"
          style={{ width: i === 0 ? 120 : 60 + ((i * 17) % 50) }}
        />
      ))}
    </div>
  );
}

function SkeletonTabel({ baris = 6, kolom = 5 }: { baris?: number; kolom?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border bg-surface">
      <div className="flex h-9 items-center gap-4 border-b border-border bg-surface px-3">
        {Array.from({ length: kolom }).map((_, i) => (
          <Skeleton key={i} className="h-3 w-16" />
        ))}
      </div>
      {Array.from({ length: baris }).map((_, i) => (
        <SkeletonBaris key={i} kolom={kolom} />
      ))}
    </div>
  );
}

/** Skeleton kartu statistik */
function SkeletonKartu() {
  return (
    <div className="rounded-lg border border-border bg-surface p-5">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="mt-3 h-7 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export { Skeleton, SkeletonTabel, SkeletonKartu, SkeletonBaris };
