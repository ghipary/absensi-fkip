"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { BookOpen, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export type KelasTersedia = {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  kodeKelas: string;
  dosen: string;
  jadwal: string[];
};

/**
 * Form mahasiswa mengajukan KRS: pilih kelas semester aktif lalu kirim
 * ke antrean validasi kaprodi (status "pengajuan").
 */
export function FormPengajuanKrs({ kelas }: { kelas: KelasTersedia[] }) {
  const router = useRouter();
  const [dipilih, setDipilih] = React.useState<Set<string>>(new Set());
  const [kirim, setKirim] = React.useState(false);

  function toggle(id: string) {
    setDipilih((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function ajukan() {
    if (dipilih.size === 0) return;
    setKirim(true);
    try {
      const res = await fetch("/api/krs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kelasIds: [...dipilih] }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengajukan KRS.");
        return;
      }
      toast.success(`${data.diajukan} mata kuliah diajukan.`, {
        description: "Menunggu validasi dari kaprodi.",
      });
      setDipilih(new Set());
      router.refresh();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setKirim(false);
    }
  }

  const totalSks = kelas
    .filter((k) => dipilih.has(k.id))
    .reduce((a, k) => a + k.sks, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pengajuan KRS</CardTitle>
        <p className="text-xs text-fg-muted">
          Pilih mata kuliah pada semester aktif, lalu ajukan untuk divalidasi kaprodi.
          Status akan berubah menjadi <span className="font-medium text-fg">menunggu validasi</span>.
        </p>
      </CardHeader>
      <CardContent>
        {kelas.length === 0 ? (
          <EmptyState
            compact
            icon={BookOpen}
            judul="Tidak ada mata kuliah tersedia"
            deskripsi="Semua kelas semester ini sudah Anda ambil atau sedang menunggu validasi."
          />
        ) : (
          <>
            <div className="flex flex-col divide-y divide-border rounded-lg border border-border">
              {kelas.map((k) => {
                const aktif = dipilih.has(k.id);
                return (
                  <label
                    key={k.id}
                    className={`flex cursor-pointer items-start gap-3 px-3 py-2.5 transition-colors ${
                      aktif ? "bg-accent-subtle" : "hover:bg-surface-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={aktif}
                      onChange={() => toggle(k.id)}
                      className="mt-1 h-4 w-4 cursor-pointer appearance-none rounded border border-border-strong bg-surface checked:border-accent checked:bg-accent [&:checked]:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%2220 6 9 17 4 12%22/></svg>')] [&:checked]:bg-[length:12px] [&:checked]:bg-center [&:checked]:bg-no-repeat focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className="font-medium text-fg">
                          {k.kode} · {k.nama}
                        </span>
                        <Badge variant="neutral">{k.sks} SKS</Badge>
                      </span>
                      <span className="block text-xs text-fg-muted">
                        Kelas {k.kodeKelas} · {k.dosen}
                      </span>
                      {k.jadwal.length > 0 && (
                        <span className="block text-2xs text-fg-subtle">
                          {k.jadwal.join(" · ")}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-xs text-fg-muted">
                {dipilih.size} mata kuliah dipilih · {totalSks} SKS
              </p>
              <Button onClick={ajukan} loading={kirim} disabled={dipilih.size === 0}>
                <Send className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Ajukan KRS
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
