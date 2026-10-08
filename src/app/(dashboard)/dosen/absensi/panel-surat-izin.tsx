"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, FileText, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";

export type SuratMenunggu = {
  id: string;
  mahasiswa: string;
  nim: string;
  mk: string;
  pertemuan: number;
  tanggal: string;
  keterangan: string | null;
  filePath: string;
};

/** Daftar pengajuan surat izin yang menunggu tinjauan dosen pengampu. */
export function PanelSuratIzin({ daftar }: { daftar: SuratMenunggu[] }) {
  const router = useRouter();
  const [proses, setProses] = React.useState<string | null>(null);

  async function tinjau(id: string, aksi: "terima" | "tolak") {
    setProses(`${id}:${aksi}`);
    try {
      const res = await fetch(`/api/surat-izin/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memproses surat izin.");
        return;
      }
      toast.success(aksi === "terima" ? "Surat izin disetujui." : "Surat izin ditolak.");
      router.refresh();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setProses(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-accent" strokeWidth={1.5} aria-hidden />
          Surat izin menunggu
          {daftar.length > 0 && <Badge variant="warning">{daftar.length}</Badge>}
        </CardTitle>
        <p className="text-xs text-fg-muted">
          Menyetujui surat akan mengubah status absensi menjadi izin.
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {daftar.length === 0 ? (
          <EmptyState
            compact
            icon={FileText}
            judul="Tidak ada pengajuan"
            deskripsi="Surat izin dari mahasiswa kelas Anda akan tampil di sini."
          />
        ) : (
          daftar.map((s) => (
            <div key={s.id} className="rounded border border-border px-3 py-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-fg">{s.mahasiswa}</p>
                  <p className="font-mono-nums text-2xs text-fg-subtle">{s.nim}</p>
                </div>
                <a
                  href={s.filePath}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-xs font-medium text-accent hover:underline"
                >
                  Lihat berkas
                </a>
              </div>
              <p className="mt-1.5 text-xs text-fg-muted">
                {s.mk} · pertemuan ke-{s.pertemuan} · {s.tanggal}
              </p>
              {s.keterangan && (
                <p className="mt-1 text-xs text-fg-subtle">&ldquo;{s.keterangan}&rdquo;</p>
              )}
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  size="sm"
                  onClick={() => tinjau(s.id, "terima")}
                  loading={proses === `${s.id}:terima`}
                >
                  <Check className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Setujui
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  onClick={() => tinjau(s.id, "tolak")}
                  loading={proses === `${s.id}:tolak`}
                >
                  <X className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Tolak
                </Button>
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
