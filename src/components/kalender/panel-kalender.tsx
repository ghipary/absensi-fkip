"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarDays, CalendarPlus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select } from "@/components/ui/form-extras";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/ui/states";

export type ItemAgenda = {
  id: string;
  tanggal: string;
  tipe: "libur" | "ujian" | "event";
  judul: string;
  deskripsi: string | null;
};

const TONE: Record<ItemAgenda["tipe"], "danger" | "warning" | "info"> = {
  libur: "danger",
  ujian: "warning",
  event: "info",
};

const LABEL: Record<ItemAgenda["tipe"], string> = {
  libur: "Libur",
  ujian: "Ujian",
  event: "Kegiatan",
};

function formatTanggal(iso: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(iso));
}

function labelBulan(iso: string) {
  return new Intl.DateTimeFormat("id-ID", { month: "long", year: "numeric" }).format(
    new Date(iso)
  );
}

/** Kalender akademik semester aktif. Kaprodi dapat menambah & menghapus agenda. */
export function PanelKalender({
  agenda,
  bisaKelola,
}: {
  agenda: ItemAgenda[];
  bisaKelola: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [tanggal, setTanggal] = React.useState(() => new Date().toISOString().slice(0, 10));
  const [tipe, setTipe] = React.useState<ItemAgenda["tipe"]>("event");
  const [judul, setJudul] = React.useState("");
  const [deskripsi, setDeskripsi] = React.useState("");
  const [simpan, setSimpan] = React.useState(false);
  const [hapusId, setHapusId] = React.useState<string | null>(null);

  async function tambah() {
    setSimpan(true);
    try {
      const res = await fetch("/api/kalender", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tanggal, tipe, judul, deskripsi }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menambah agenda.");
        return;
      }
      toast.success("Agenda ditambahkan.");
      setOpen(false);
      setJudul("");
      setDeskripsi("");
      setTipe("event");
      setTanggal(new Date().toISOString().slice(0, 10));
      router.refresh();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setSimpan(false);
    }
  }

  async function hapus(id: string) {
    setHapusId(id);
    try {
      const res = await fetch(`/api/kalender/${id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menghapus agenda.");
        return;
      }
      toast.success("Agenda dihapus.");
      router.refresh();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setHapusId(null);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <div>
          <CardTitle>Agenda semester</CardTitle>
          <p className="text-xs text-fg-muted">
            {agenda.length} agenda tercatat pada kalender akademik.
          </p>
        </div>
        {bisaKelola && (
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <CalendarPlus className="h-4 w-4" strokeWidth={1.5} aria-hidden />
                Tambah agenda
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Tambah agenda</DialogTitle>
                <DialogDescription>
                  Agenda ditambahkan ke semester yang sedang aktif.
                </DialogDescription>
              </DialogHeader>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  tambah();
                }}
                className="flex flex-col gap-3"
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="agenda-tanggal">Tanggal</Label>
                    <Input
                      id="agenda-tanggal"
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="agenda-tipe">Tipe</Label>
                    <Select
                      id="agenda-tipe"
                      value={tipe}
                      onChange={(e) => setTipe(e.target.value as ItemAgenda["tipe"])}
                      options={[
                        { value: "event", label: "Kegiatan" },
                        { value: "ujian", label: "Ujian" },
                        { value: "libur", label: "Libur" },
                      ]}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agenda-judul">Judul</Label>
                  <Input
                    id="agenda-judul"
                    value={judul}
                    onChange={(e) => setJudul(e.target.value)}
                    placeholder="mis. Ujian Tengah Semester"
                    maxLength={120}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="agenda-deskripsi">Deskripsi (opsional)</Label>
                  <textarea
                    id="agenda-deskripsi"
                    value={deskripsi}
                    onChange={(e) => setDeskripsi(e.target.value)}
                    placeholder="Keterangan tambahan agenda."
                    maxLength={300}
                    rows={3}
                    className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                  />
                </div>
                <DialogFooter>
                  <Button type="button" variant="secondary" onClick={() => setOpen(false)}>
                    Batal
                  </Button>
                  <Button type="submit" loading={simpan} disabled={!judul || !tanggal}>
                    Simpan agenda
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </CardHeader>
      <CardContent>
        {agenda.length === 0 ? (
          <EmptyState
            compact
            icon={CalendarDays}
            judul="Belum ada agenda"
            deskripsi={
              bisaKelola
                ? "Tambahkan agenda libur, ujian, atau kegiatan pada semester aktif."
                : "Belum ada agenda pada semester aktif ini."
            }
          />
        ) : (
          <div className="flex flex-col gap-5">
            {agenda.map((a, i) => {
              const bulan = labelBulan(a.tanggal);
              const awalBulan = i === 0 || labelBulan(agenda[i - 1].tanggal) !== bulan;
              return (
                <React.Fragment key={a.id}>
                  {awalBulan && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
                      {bulan}
                    </p>
                  )}
                  <div className="flex items-start gap-3 rounded-lg border border-border px-3 py-3">
                    <div className="flex w-14 shrink-0 flex-col items-center rounded border border-border bg-surface-muted py-1">
                      <span className="font-mono-nums text-lg font-semibold leading-none text-fg">
                        {new Date(a.tanggal).getDate()}
                      </span>
                      <span className="text-2xs text-fg-subtle">
                        {new Intl.DateTimeFormat("id-ID", { month: "short" }).format(
                          new Date(a.tanggal)
                        )}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-medium text-fg">{a.judul}</p>
                        <Badge variant={TONE[a.tipe]}>{LABEL[a.tipe]}</Badge>
                      </div>
                      <p className="text-xs text-fg-muted">{formatTanggal(a.tanggal)}</p>
                      {a.deskripsi && (
                        <p className="mt-1 text-sm text-fg-muted">{a.deskripsi}</p>
                      )}
                    </div>
                    {bisaKelola && (
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => hapus(a.id)}
                        loading={hapusId === a.id}
                        aria-label={`Hapus agenda ${a.judul}`}
                      >
                        <Trash2 className="h-4 w-4 text-danger-text" strokeWidth={1.5} aria-hidden />
                      </Button>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
