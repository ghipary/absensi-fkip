"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Megaphone,
  PencilLine,
  Plus,
  Trash2,
  UsersRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/form-extras";
import { EmptyState } from "@/components/ui/states";

export type ItemPengumuman = {
  id: string;
  judul: string;
  konten: string;
  cakupan: "prodi" | "kelas";
  kelas?: { kode: string; nama: string; kodeKelas: string } | null;
  pembuat: string | null;
  publishedAt: string;
  bisaDihapus?: boolean;
};

type Props = {
  daftar: ItemPengumuman[];
  /** Daftar kelas untuk target pengumuman kelas (dosen: kelas diampu; kaprodi: semua kelas aktif). */
  kelasOptions?: { value: string; label: string }[];
  /** Tampilkan aksi buat/hapus (dosen & kaprodi). */
  kelola?: boolean;
};

function formatTanggal(iso: string) {
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function PanelPengumuman({ daftar, kelasOptions = [], kelola = false }: Props) {
  const router = useRouter();

  const [open, setOpen] = React.useState(false);
  const [cakupan, setCakupan] = React.useState<"prodi" | "kelas">("prodi");
  const [kelasId, setKelasId] = React.useState("");
  const [judul, setJudul] = React.useState("");
  const [konten, setKonten] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [menyimpan, setMenyimpan] = React.useState(false);
  const [menghapusId, setMenghapusId] = React.useState<string | null>(null);

  async function simpan(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const body: Record<string, unknown> = { judul, konten, cakupan };
    if (cakupan === "kelas") {
      if (!kelasId) {
        setError("Pilih kelas yang menjadi sasaran pengumuman.");
        return;
      }
      body.kelasId = kelasId;
    }

    setMenyimpan(true);
    try {
      const res = await fetch("/api/pengumuman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Gagal menyimpan pengumuman.");
        return;
      }
      setOpen(false);
      setJudul("");
      setKonten("");
      setCakupan("prodi");
      setKelasId("");
      router.refresh();
    } catch {
      setError("Tidak dapat terhubung ke server.");
    } finally {
      setMenyimpan(false);
    }
  }

  async function hapus(id: string) {
    setMenghapusId(id);
    try {
      const res = await fetch(`/api/pengumuman/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        alert(data.error ?? "Gagal menghapus pengumuman.");
        return;
      }
      router.refresh();
    } catch {
      alert("Tidak dapat terhubung ke server.");
    } finally {
      setMenghapusId(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {kelola && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-fg-muted">
            {daftar.length} pengumuman diterbitkan
          </p>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Tulis pengumuman
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tulis pengumuman</DialogTitle>
                <DialogDescription>
                  Pilih cakupan, lalu isi judul dan isi pengumuman.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={simpan} className="flex flex-col gap-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-fg-muted">Cakupan</span>
                    <Select
                      value={cakupan}
                      onChange={(e) => {
                        setCakupan(e.target.value as "prodi" | "kelas");
                        setKelasId("");
                      }}
                      options={[
                        { value: "prodi", label: "Semua mahasiswa (prodi)" },
                        { value: "kelas", label: "Satu kelas tertentu" },
                      ]}
                    />
                  </label>
                  {cakupan === "kelas" ? (
                    <label className="flex flex-col gap-1.5">
                      <span className="text-xs font-medium text-fg-muted">Kelas</span>
                      <Select
                        value={kelasId}
                        onChange={(e) => setKelasId(e.target.value)}
                        placeholder="Pilih kelas"
                        options={kelasOptions}
                      />
                    </label>
                  ) : null}
                </div>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Judul</span>
                  <Input
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="mis. Jadwal UTS berubah"
                    maxLength={160}
                    required
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-medium text-fg-muted">Isi</span>
                  <Textarea
                    value={konten}
                    onChange={(e) => setKonten(e.target.value)}
                    placeholder="Tulis detail pengumuman…"
                    minLength={5}
                    required
                  />
                </label>
                {error && (
                  <p className="flex items-start gap-1.5 text-sm text-danger-text">
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={1.5} aria-hidden />
                    {error}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={menyimpan}>
                    Terbitkan
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {daftar.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          judul="Belum ada pengumuman"
          deskripsi={
            kelola
              ? "Terbitkan pengumuman pertama untuk mahasiswa atau kelas tertentu."
              : "Pengumuman dari prodi atau dosen akan muncul di sini."
          }
        />
      ) : (
        daftar.map((p) => (
          <article
            key={p.id}
            className="rounded-lg border border-border bg-surface p-4 shadow-card"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={p.cakupan === "kelas" ? "info" : "accent"}>
                  {p.cakupan === "kelas" && p.kelas ? (
                    <>
                      <UsersRound className="h-3 w-3" strokeWidth={1.5} aria-hidden />
                      {p.kelas.kode} · Kelas {p.kelas.kodeKelas}
                    </>
                  ) : (
                    "Prodi"
                  )}
                </Badge>
                <time className="text-2xs text-fg-subtle">{formatTanggal(p.publishedAt)}</time>
              </div>
              {kelola && p.bisaDihapus && (
                <Button
                  variant="danger-ghost"
                  size="sm"
                  onClick={() => hapus(p.id)}
                  loading={menghapusId === p.id}
                  aria-label={`Hapus pengumuman ${p.judul}`}
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                  Hapus
                </Button>
              )}
            </div>
            <h3 className={cn("mt-2 text-base font-semibold text-fg")}>{p.judul}</h3>
            <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-fg-muted">
              {p.konten}
            </p>
            <p className="mt-3 flex items-center gap-1.5 text-2xs text-fg-subtle">
              <PencilLine className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
              {p.pembuat ?? "Admin"} · {p.cakupan === "prodi" ? "seluruh prodi" : "satu kelas"}
            </p>
          </article>
        ))
      )}

      {kelola && (
        <p className="flex items-center gap-1.5 text-2xs text-fg-subtle">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Pengumuman yang diterbitkan otomatis masuk ke pemberitahuan penerima.
        </p>
      )}
    </div>
  );
}