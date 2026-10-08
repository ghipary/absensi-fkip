"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { SnapshotNilai } from "@/lib/grade";
import { ShieldCheck, Check, X, ArrowRight, Inbox } from "lucide-react";

type AntreanDto = {
  id: string;
  alasan: string | null;
  createdAt: string;
  pengaju: string;
  mahasiswa: string;
  kelas: string;
  pengampu: string;
  nilaiLama: string | null;
  nilaiBaru: string | null;
};

function parseSnap(json: string | null): SnapshotNilai | null {
  if (!json) return null;
  try {
    return JSON.parse(json) as SnapshotNilai;
  } catch {
    return null;
  }
}

function TeksNilai({ snap, label }: { snap: SnapshotNilai | null; label: string }) {
  if (!snap) return <span className="text-xs text-fg-subtle">{label}: input awal</span>;
  return (
    <span className="font-mono-nums text-xs text-fg-muted">
      {label}: tugas {snap.tugas ?? "—"} · uts {snap.uts ?? "—"} · uas {snap.uas ?? "—"} ·{" "}
      <span className="font-semibold text-fg">akhir {snap.akhir ?? "—"}</span> · grade{" "}
      {snap.grade ?? "—"}
    </span>
  );
}

export function PanelValidasi({ antrean }: { antrean: AntreanDto[] }) {
  const router = useRouter();
  const [sedangId, setSedangId] = useState<string | null>(null);
  const [konfirmasiTolak, setKonfirmasiTolak] = useState<AntreanDto | null>(null);

  async function proses(riwayatId: string, aksi: "setujui" | "tolak") {
    setSedangId(riwayatId + aksi);
    try {
      const res = await fetch("/api/validasi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riwayatId, aksi }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memproses validasi.");
        return;
      }
      toast.success(
        aksi === "setujui"
          ? "Perubahan nilai disetujui."
          : "Perubahan ditolak — nilai dikembalikan ke sebelumnya."
      );
      setKonfirmasiTolak(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangId(null);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Antrean menunggu validasi</CardTitle>
        <p className="text-xs text-fg-muted">
          Diajukan berurutan waktu. Setujui untuk meresmikan; tolak untuk mengembalikan
          nilai ke kondisi sebelum perubahan.
        </p>
      </CardHeader>
      <CardContent>
        {antrean.length === 0 ? (
          <EmptyState
            icon={Inbox}
            judul="Tidak ada antrean"
            deskripsi="Semua perubahan nilai sudah diproses. Ajukan perubahan baru dari dosen pengampu akan muncul di sini."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {antrean.map((r) => {
              const lama = parseSnap(r.nilaiLama);
              const baru = parseSnap(r.nilaiBaru);
              const sedang = sedangId !== null;
              return (
                <div key={r.id} className="rounded-lg border border-border p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-fg">{r.mahasiswa}</span>
                        <Badge variant="warning">
                          <StatusDot tone="warning" />
                          menunggu
                        </Badge>
                      </div>
                      <p className="mt-0.5 text-sm text-fg-muted">{r.kelas}</p>
                      <p className="mt-1 text-xs text-fg-subtle">
                        Diajukan {r.pengaju} · {r.pengampu} ·{" "}
                        {format(new Date(r.createdAt), "d MMM yyyy · HH:mm", { locale: localeId })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setKonfirmasiTolak(r)}
                        disabled={sedang}
                        loading={sedangId === r.id + "tolak"}
                      >
                        <X className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Tolak
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => proses(r.id, "setujui")}
                        disabled={sedang}
                        loading={sedangId === r.id + "setujui"}
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Setujui
                      </Button>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-col gap-1 rounded border border-border bg-surface-muted px-3 py-2">
                    <TeksNilai snap={lama} label="Sebelum" />
                    <span className="flex items-center gap-1 text-2xs text-fg-subtle">
                      <ArrowRight className="h-3 w-3" strokeWidth={1.5} /> perubahan diajukan
                    </span>
                    <TeksNilai snap={baru} label="Sesudah" />
                  </div>

                  <p className="mt-2 text-sm text-fg-muted">
                    <span className="font-medium text-fg">Alasan:</span>{" "}
                    {r.alasan ?? "—"}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>

      <Dialog
        open={konfirmasiTolak !== null}
        onOpenChange={(o) => !o && setKonfirmasiTolak(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tolak perubahan nilai?</DialogTitle>
            <DialogDescription>
              Nilai {konfirmasiTolak?.mahasiswa} akan dikembalikan ke kondisi sebelum
              perubahan. Tindakan ini tercatat permanen di riwayat.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-start gap-2 rounded border border-warning-border bg-warning-bg px-3 py-2 text-xs text-warning-text">
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} />
            Dosen pengampu akan menerima notifikasi beserta nilai hasil pengembalian.
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setKonfirmasiTolak(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => konfirmasiTolak && proses(konfirmasiTolak.id, "tolak")}
              loading={sedangId === (konfirmasiTolak?.id ?? "") + "tolak"}
            >
              Tolak & kembalikan nilai
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
