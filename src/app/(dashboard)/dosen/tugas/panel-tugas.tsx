"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/form-extras";
import { EmptyState } from "@/components/ui/states";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import {
  Plus,
  ClipboardList,
  Pencil,
  Eye,
  EyeOff,
  Trash2,
  Send,
  CheckCircle2,
} from "lucide-react";

type KelasDto = {
  id: string;
  kode: string;
  nama: string;
  kodeKelas: string;
  jumlahMhs: number;
};

type TugasDto = {
  id: string;
  judul: string;
  deskripsi: string | null;
  deadlineAt: string;
  bobotPoin: number;
  published: boolean;
  jumlahKumpul: number;
  jumlahDinilai: number;
};

type SubmissionDto = {
  tugasId: string;
  id: string;
  teks: string | null;
  linkUrl: string | null;
  submittedAt: string;
  isTerlambat: boolean;
  nilai: number | null;
  feedback: string | null;
};

type AnggotaDto = {
  mahasiswaId: string;
  nim: string;
  nama: string;
  submission: SubmissionDto[];
};

type FormTugas = {
  judul: string;
  deskripsi: string;
  deadlineAt: string;
  bobotPoin: string;
};

const FORM_KOSONG: FormTugas = { judul: "", deskripsi: "", deadlineAt: "", bobotPoin: "100" };

/** ISO → value input datetime-local */
function keLocalInput(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function PanelTugas({
  daftarKelas,
  kelasIdAwal,
  daftarTugas,
  anggota,
  namaDosen,
}: {
  daftarKelas: KelasDto[];
  kelasIdAwal: string;
  daftarTugas: TugasDto[];
  anggota: AnggotaDto[];
  namaDosen: string;
}) {
  const router = useRouter();
  const [kelasId, setKelasId] = useState(kelasIdAwal);
  const [dialogBaru, setDialogBaru] = useState(false);
  const [tugasDisunting, setTugasDisunting] = useState<TugasDto | null>(null);
  const [tugasDilihat, setTugasDilihat] = useState<TugasDto | null>(null);
  const [tugasDihapus, setTugasDihapus] = useState<TugasDto | null>(null);
  const [form, setForm] = useState<FormTugas>(FORM_KOSONG);
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangAksi, setSedangAksi] = useState<string | null>(null);

  const kelas = daftarKelas.find((k) => k.id === kelasId) ?? daftarKelas[0];

  function bukaBaru() {
    setForm({
      ...FORM_KOSONG,
      deadlineAt: keLocalInput(new Date(Date.now() + 7 * 86400000).toISOString()),
    });
    setDialogBaru(true);
  }

  function bukaSunting(t: TugasDto) {
    setForm({
      judul: t.judul,
      deskripsi: t.deskripsi ?? "",
      deadlineAt: keLocalInput(t.deadlineAt),
      bobotPoin: String(t.bobotPoin),
    });
    setTugasDisunting(t);
  }

  function validasiForm(): string | null {
    if (form.judul.trim().length < 3) return "Judul minimal 3 karakter.";
    if (form.judul.trim().length > 160) return "Judul maksimal 160 karakter.";
    if (form.deskripsi.length > 5000) return "Deskripsi maksimal 5000 karakter.";
    if (!form.deadlineAt) return "Tenggat waktu wajib diisi.";
    const poin = Number(form.bobotPoin);
    if (!Number.isFinite(poin) || poin < 1 || poin > 1000)
      return "Bobot poin harus antara 1 dan 1000.";
    return null;
  }

  async function simpanTugas() {
    const galat = validasiForm();
    if (galat) {
      toast.error(galat);
      return;
    }
    setSedangSimpan(true);
    try {
      const payload = {
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        deadlineAt: new Date(form.deadlineAt).toISOString(),
        bobotPoin: Number(form.bobotPoin),
      };
      const res = await fetch(tugasDisunting ? `/api/tugas/${tugasDisunting.id}` : "/api/tugas", {
        method: tugasDisunting ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          tugasDisunting ? payload : { ...payload, kelasId, langsungTerbit: true }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan tugas.");
        return;
      }
      toast.success(tugasDisunting ? "Tugas diperbarui." : "Tugas dibuat dan dipublikasikan.");
      setDialogBaru(false);
      setTugasDisunting(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangSimpan(false);
    }
  }

  async function aksiTugas(t: TugasDto, aksi: "terbit" | "tarik" | "hapus") {
    setSedangAksi(t.id + aksi);
    try {
      const res = await fetch(`/api/tugas/${t.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ aksi }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal memproses tugas.");
        return;
      }
      toast.success(
        aksi === "terbit"
          ? "Tugas dipublikasikan."
          : aksi === "tarik"
            ? "Tugas ditarik ke draf."
            : "Tugas dihapus."
      );
      setTugasDihapus(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangAksi(null);
    }
  }

  // ── Penilaian pengumpulan ─────────────────────────────
  const [nilaiDraft, setNilaiDraft] = useState<Record<string, string>>({});
  const [feedbackDraft, setFeedbackDraft] = useState<Record<string, string>>({});
  const [sedangNilai, setSedangNilai] = useState(false);

  const barisPenilaian = useMemo(() => {
    if (!tugasDilihat) return [];
    return anggota
      .map((a) => {
        const sub = a.submission.find((s) => s.tugasId === tugasDilihat.id);
        return { anggota: a, sub: sub ?? null };
      })
      .filter((r) => r.sub !== null);
  }, [tugasDilihat, anggota]);

  function isiNilai(subId: string, v: string) {
    setNilaiDraft((d) => ({ ...d, [subId]: v }));
  }

  async function simpanPenilaian() {
    if (!tugasDilihat) return;
    const penilaian: { submissionId: string; nilai: number; feedback?: string }[] = [];
    for (const r of barisPenilaian) {
      const sub = r.sub!;
      const teks = nilaiDraft[sub.id];
      if (teks === undefined || teks.trim() === "") continue;
      const n = Number(teks);
      if (!Number.isFinite(n) || n < 0 || n > tugasDilihat.bobotPoin) {
        toast.error(`Nilai untuk ${r.anggota.nama} harus 0–${tugasDilihat.bobotPoin}.`);
        return;
      }
      penilaian.push({
        submissionId: sub.id,
        nilai: Math.round(n * 10) / 10,
        feedback: feedbackDraft[sub.id]?.trim() || undefined,
      });
    }
    if (penilaian.length === 0) {
      toast.info("Belum ada nilai yang diisi.");
      return;
    }
    setSedangNilai(true);
    try {
      const res = await fetch(`/api/tugas/${tugasDilihat.id}/penilaian`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ penilaian }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan penilaian.");
        return;
      }
      toast.success(`${data.jumlah} pengumpulan berhasil dinilai.`);
      setNilaiDraft({});
      setFeedbackDraft({});
      setTugasDilihat(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangNilai(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Daftar tugas</CardTitle>
          <p className="text-xs text-fg-muted">
            {kelas ? `${kelas.kode} · ${kelas.nama} · ${kelas.jumlahMhs} mahasiswa` : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-48">
            <Select
              aria-label="Pilih kelas"
              value={kelasId}
              onChange={(e) => {
                setKelasId(e.target.value);
                router.push(`/dosen/tugas?kelas=${e.target.value}`);
              }}
              options={daftarKelas.map((k) => ({
                value: k.id,
                label: `${k.kode} · ${k.kodeKelas}`,
              }))}
            />
          </div>
          <Button onClick={bukaBaru}>
            <Plus className="h-4 w-4" strokeWidth={1.5} />
            Tugas baru
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {daftarTugas.length === 0 ? (
          <EmptyState
            icon={ClipboardList}
            judul="Belum ada tugas"
            deskripsi="Buat tugas pertama untuk kelas ini — mahasiswa akan langsung menerima notifikasi."
            aksi={
              <Button onClick={bukaBaru}>
                <Plus className="h-4 w-4" strokeWidth={1.5} />
                Buat tugas
              </Button>
            }
          />
        ) : (
          <div className="rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Judul</TableHead>
                  <TableHead className="w-44">Tenggat</TableHead>
                  <TableHead className="w-32 text-center">Kumpul</TableHead>
                  <TableHead className="w-28 text-center">Dinilai</TableHead>
                  <TableHead className="w-28 text-center">Status</TableHead>
                  <TableHead className="w-52 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {daftarTugas.map((t) => {
                  const lewat = new Date(t.deadlineAt).getTime() < Date.now();
                  return (
                    <TableRow key={t.id}>
                      <TableCell>
                        <span className="block max-w-72 truncate font-medium text-fg">
                          {t.judul}
                        </span>
                        <span className="text-2xs text-fg-subtle">
                          poin {t.bobotPoin} · {namaDosen}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="font-mono-nums text-xs text-fg-muted">
                          {format(new Date(t.deadlineAt), "d MMM yyyy · HH:mm", { locale: localeId })}
                        </span>
                        {lewat && (
                          <span className="ml-1 text-2xs font-medium text-danger-text">lewat</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <Num className="text-fg-muted">
                          {t.jumlahKumpul}/{kelas?.jumlahMhs ?? 0}
                        </Num>
                      </TableCell>
                      <TableCell className="text-center">
                        <Num className={t.jumlahDinilai > 0 ? "font-medium text-fg" : "text-fg-subtle"}>
                          {t.jumlahDinilai}
                        </Num>
                      </TableCell>
                      <TableCell className="text-center">
                        {t.published ? (
                          <Badge variant="success">
                            <StatusDot tone="success" />
                            terbit
                          </Badge>
                        ) : (
                          <Badge variant="neutral">
                            <StatusDot tone="neutral" />
                            draf
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Lihat pengumpulan"
                            onClick={() => setTugasDilihat(t)}
                          >
                            <Eye className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label="Sunting tugas"
                            onClick={() => bukaSunting(t)}
                          >
                            <Pencil className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={t.published ? "Tarik publikasi" : "Terbitkan"}
                            onClick={() => aksiTugas(t, t.published ? "tarik" : "terbit")}
                            loading={sedangAksi === t.id + (t.published ? "tarik" : "terbit")}
                          >
                            {t.published ? (
                              <EyeOff className="h-4 w-4" strokeWidth={1.5} />
                            ) : (
                              <Send className="h-4 w-4" strokeWidth={1.5} />
                            )}
                          </Button>
                          <Button
                            variant="danger-ghost"
                            size="icon-sm"
                            aria-label="Hapus tugas"
                            onClick={() => setTugasDihapus(t)}
                          >
                            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      {/* Dialog buat / sunting tugas */}
      <Dialog
        open={dialogBaru || tugasDisunting !== null}
        onOpenChange={(o) => {
          if (!o) {
            setDialogBaru(false);
            setTugasDisunting(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{tugasDisunting ? "Sunting tugas" : "Tugas baru"}</DialogTitle>
            <DialogDescription>
              {tugasDisunting
                ? "Perubahan konten langsung terlihat oleh mahasiswa."
                : "Tugas langsung dipublikasikan ke semua mahasiswa peserta kelas."}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="judul-tugas">Judul tugas</Label>
              <Input
                id="judul-tugas"
                value={form.judul}
                onChange={(e) => setForm((f) => ({ ...f, judul: e.target.value }))}
                placeholder="mis. Latihan Bilangan Kuadrat"
                maxLength={160}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="deskripsi-tugas">Deskripsi</Label>
              <Textarea
                id="deskripsi-tugas"
                value={form.deskripsi}
                onChange={(e) => setForm((f) => ({ ...f, deskripsi: e.target.value }))}
                placeholder="Jelaskan instruksi pengerjaan, format pengumpulan, dan kriteria penilaian."
                maxLength={5000}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="deadline-tugas">Tenggat waktu</Label>
                <Input
                  id="deadline-tugas"
                  type="datetime-local"
                  mono
                  value={form.deadlineAt}
                  onChange={(e) => setForm((f) => ({ ...f, deadlineAt: e.target.value }))}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="poin-tugas">Bobot poin</Label>
                <Input
                  id="poin-tugas"
                  mono
                  inputMode="numeric"
                  value={form.bobotPoin}
                  onChange={(e) => setForm((f) => ({ ...f, bobotPoin: e.target.value }))}
                  maxLength={4}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="secondary"
              onClick={() => {
                setDialogBaru(false);
                setTugasDisunting(null);
              }}
            >
              Batal
            </Button>
            <Button onClick={simpanTugas} loading={sedangSimpan}>
              {tugasDisunting ? "Simpan perubahan" : "Buat tugas"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog pengumpulan + penilaian */}
      <Dialog open={tugasDilihat !== null} onOpenChange={(o) => !o && setTugasDilihat(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Pengumpulan — {tugasDilihat?.judul}</DialogTitle>
            <DialogDescription>
              {tugasDilihat
                ? `Tenggat ${format(new Date(tugasDilihat.deadlineAt), "d MMM yyyy · HH:mm", { locale: localeId })} · maksimal ${tugasDilihat.bobotPoin} poin`
                : ""}
            </DialogDescription>
          </DialogHeader>

          {barisPenilaian.length === 0 ? (
            <EmptyState
              compact
              icon={ClipboardList}
              judul="Belum ada pengumpulan"
              deskripsi="Belum ada mahasiswa yang mengumpulkan tugas ini."
            />
          ) : (
            <div className="max-h-[55vh] overflow-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-32">NIM</TableHead>
                    <TableHead>Mahasiswa</TableHead>
                    <TableHead className="w-56">Jawaban / tautan</TableHead>
                    <TableHead className="w-40 text-right">Nilai (0–{tugasDilihat?.bobotPoin})</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {barisPenilaian.map(({ anggota: a, sub }) => {
                    const nilaiIni = nilaiDraft[sub!.id];
                    const nilaiTersimpan = sub!.nilai;
                    const tampilNilai = nilaiIni ?? (nilaiTersimpan !== null ? String(nilaiTersimpan) : "");
                    const poin = tugasDilihat?.bobotPoin ?? 100;
                    const invalid =
                      nilaiIni !== undefined &&
                      nilaiIni !== "" &&
                      (!Number.isFinite(Number(nilaiIni)) ||
                        Number(nilaiIni) < 0 ||
                        Number(nilaiIni) > poin);
                    return (
                      <TableRow key={sub!.id}>
                        <TableCell>
                          <Num>{a.nim}</Num>
                        </TableCell>
                        <TableCell>
                          <span className="block truncate font-medium text-fg">{a.nama}</span>
                          <span className="font-mono-nums text-2xs text-fg-subtle">
                            {format(new Date(sub!.submittedAt), "d MMM HH:mm", { locale: localeId })}
                            {sub!.isTerlambat && (
                              <span className="ml-1 font-medium text-danger-text">terlambat</span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell>
                          {sub!.linkUrl ? (
                            <a
                              href={sub!.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block max-w-52 truncate text-xs text-accent underline-offset-2 hover:underline"
                            >
                              {sub!.linkUrl}
                            </a>
                          ) : sub!.teks ? (
                            <span className="line-clamp-2 text-xs text-fg-muted">{sub!.teks}</span>
                          ) : (
                            <span className="text-xs text-fg-subtle">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center justify-end gap-2">
                            <Input
                              mono
                              inputMode="decimal"
                              aria-label={`Nilai ${a.nama}`}
                              className="h-8 w-20 text-right"
                              value={tampilNilai}
                              invalid={invalid}
                              placeholder="—"
                              onChange={(e) => isiNilai(sub!.id, e.target.value)}
                            />
                            {nilaiTersimpan !== null && nilaiIni === undefined && (
                              <CheckCircle2
                                className="h-4 w-4 shrink-0 text-success"
                                strokeWidth={1.5}
                                aria-label="sudah dinilai"
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          <DialogFooter className="items-center gap-2 sm:justify-between">
            <span className="text-2xs text-fg-subtle">
              Kolom feedback per mahasiswa tersedia setelah nilai tersimpan.
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => setTugasDilihat(null)}>
                Tutup
              </Button>
              <Button onClick={simpanPenilaian} loading={sedangNilai} disabled={barisPenilaian.length === 0}>
                Simpan penilaian
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog konfirmasi hapus */}
      <Dialog open={tugasDihapus !== null} onOpenChange={(o) => !o && setTugasDihapus(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus tugas?</DialogTitle>
            <DialogDescription>
              Tugas &ldquo;{tugasDihapus?.judul}&rdquo; akan disembunyikan dari mahasiswa. Pengumpulan
              yang ada tidak ikut terhapus.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setTugasDihapus(null)}>
              Batal
            </Button>
            <Button
              variant="danger"
              onClick={() => tugasDihapus && aksiTugas(tugasDihapus, "hapus")}
              loading={sedangAksi === (tugasDihapus?.id ?? "") + "hapus"}
            >
              Hapus tugas
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
