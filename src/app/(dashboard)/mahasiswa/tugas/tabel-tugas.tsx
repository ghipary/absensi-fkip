"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, StatusDot } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input, Textarea } from "@/components/ui/input";
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
import { Upload, Paperclip, CheckCircle2, Clock, MessageSquareText } from "lucide-react";

type TugasDto = {
  id: string;
  judul: string;
  deskripsi: string | null;
  deadlineAt: string;
  bobotPoin: number;
  kelas: string;
  dosen: string;
  submission: {
    teks: string | null;
    linkUrl: string | null;
    submittedAt: string;
    isTerlambat: boolean;
    nilai: number | null;
    feedback: string | null;
  } | null;
};

type Status = "belum" | "kumpul" | "terlambat" | "dinilai";

function statusTugas(t: TugasDto): Status {
  if (t.submission?.nilai !== null && t.submission?.nilai !== undefined) return "dinilai";
  if (t.submission) return "kumpul";
  return new Date(t.deadlineAt).getTime() < Date.now() ? "terlambat" : "belum";
}

const INFO_STATUS: Record<Status, { label: string; variant: "neutral" | "success" | "warning" | "danger" }> = {
  belum: { label: "belum dikumpulkan", variant: "neutral" },
  kumpul: { label: "terkumpul", variant: "success" },
  terlambat: { label: "lewat tenggat", variant: "danger" },
  dinilai: { label: "dinilai", variant: "success" },
};

export function TabelTugas({ daftarTugas }: { daftarTugas: TugasDto[] }) {
  const router = useRouter();
  const [tugasAktif, setTugasAktif] = useState<TugasDto | null>(null);
  const [teks, setTeks] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [sedangKumpul, setSedangKumpul] = useState(false);

  function bukaDialog(t: TugasDto) {
    setTugasAktif(t);
    setTeks(t.submission?.teks ?? "");
    setLinkUrl(t.submission?.linkUrl ?? "");
  }

  async function kumpulkan() {
    if (!tugasAktif) return;
    if (!teks.trim() && !linkUrl.trim()) {
      toast.error("Isi jawaban atau tautan sebelum mengumpulkan.");
      return;
    }
    if (linkUrl.trim() && !/^https?:\/\/\S+$/i.test(linkUrl.trim())) {
      toast.error("Tautan harus diawali http:// atau https://.");
      return;
    }
    setSedangKumpul(true);
    try {
      const res = await fetch(`/api/tugas/${tugasAktif.id}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teks: teks.trim(), linkUrl: linkUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengumpulkan tugas.");
        return;
      }
      toast.success(
        data.isTerlambat
          ? "Terkumpul, tapi melewati tenggat — ditandai terlambat."
          : "Tugas berhasil dikumpulkan."
      );
      setTugasAktif(null);
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangKumpul(false);
    }
  }

  const kini = Date.now();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Daftar tugas semester ini</CardTitle>
        <p className="text-xs text-fg-muted">
          Kumpulkan sebelum tenggat. Anda masih bisa memperbarui jawaban selama belum dinilai.
        </p>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tugas</TableHead>
                <TableHead className="w-52">Tenggat</TableHead>
                <TableHead className="w-32 text-center">Status</TableHead>
                <TableHead className="w-24 text-right">Nilai</TableHead>
                <TableHead className="w-44 text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {daftarTugas.map((t) => {
                const status = statusTugas(t);
                const info = INFO_STATUS[status];
                const lewat =
                  t.submission === null && new Date(t.deadlineAt).getTime() <= kini;
                return (
                  <TableRow key={t.id}>
                    <TableCell>
                      <span className="block max-w-72 truncate font-medium text-fg">
                        {t.judul}
                      </span>
                      <span className="text-2xs text-fg-subtle">
                        {t.kelas} · {t.dosen} · poin {t.bobotPoin}
                      </span>
                      {t.submission?.feedback && (
                        <span className="mt-0.5 flex items-center gap-1 text-2xs text-fg-muted">
                          <MessageSquareText className="h-3 w-3" strokeWidth={1.5} />
                          {t.submission.feedback}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="font-mono-nums text-xs text-fg-muted">
                        {format(new Date(t.deadlineAt), "d MMM yyyy · HH:mm", { locale: localeId })}
                      </span>
                      {lewat && (
                        <span className="block text-2xs font-medium text-danger-text">
                          tenggat lewat
                        </span>
                      )}
                      {t.submission && (
                        <span className="block font-mono-nums text-2xs text-fg-subtle">
                          dikumpul {format(new Date(t.submission.submittedAt), "d MMM HH:mm", { locale: localeId })}
                          {t.submission.isTerlambat && (
                            <span className="ml-1 font-medium text-warning-text">terlambat</span>
                          )}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant={info.variant}>
                        <StatusDot
                          tone={
                            info.variant === "success"
                              ? "success"
                              : info.variant === "danger"
                                ? "danger"
                                : info.variant === "warning"
                                  ? "warning"
                                  : "neutral"
                          }
                        />
                        {info.label}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {t.submission?.nilai !== null && t.submission?.nilai !== undefined ? (
                        <Num className="font-semibold text-fg">
                          {t.submission.nilai}/{t.bobotPoin}
                        </Num>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {status === "dinilai" ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-success-text">
                          <CheckCircle2 className="h-4 w-4" strokeWidth={1.5} />
                          selesai
                        </span>
                      ) : (
                        <Button
                          size="sm"
                          variant={t.submission ? "secondary" : "primary"}
                          onClick={() => bukaDialog(t)}
                        >
                          {t.submission ? (
                            <>
                              <Paperclip className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Ubah jawaban
                            </>
                          ) : status === "terlambat" ? (
                            <>
                              <Clock className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Kumpulkan telat
                            </>
                          ) : (
                            <>
                              <Upload className="h-3.5 w-3.5" strokeWidth={1.5} />
                              Kumpulkan
                            </>
                          )}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>

      <Dialog open={tugasAktif !== null} onOpenChange={(o) => !o && setTugasAktif(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Kumpulkan — {tugasAktif?.judul}</DialogTitle>
            <DialogDescription>
              {tugasAktif
                ? `${tugasAktif.kelas} · tenggat ${format(new Date(tugasAktif.deadlineAt), "d MMM yyyy · HH:mm", { locale: localeId })}`
                : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {tugasAktif?.deskripsi && (
              <div className="rounded border border-border bg-surface-muted p-3 text-sm text-fg-muted">
                {tugasAktif.deskripsi}
              </div>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="teks-jawaban">Jawaban / penjelasan</Label>
              <Textarea
                id="teks-jawaban"
                value={teks}
                onChange={(e) => setTeks(e.target.value)}
                placeholder="Tulis jawaban atau ringkasan pengerjaan Anda di sini."
                maxLength={5000}
              />
              <p className="text-2xs text-fg-subtle">{teks.length}/5000 karakter</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="link-tugas">Tautan berkas (opsional)</Label>
              <Input
                id="link-tugas"
                icon={<Paperclip className="h-4 w-4" strokeWidth={1.5} />}
                value={linkUrl}
                onChange={(e) => setLinkUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
                inputMode="url"
              />
              <p className="text-2xs text-fg-subtle">
                Gunakan tautan Google Drive, GitHub, atau dokumen daring lain yang bisa diakses dosen.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="secondary" onClick={() => setTugasAktif(null)}>
              Batal
            </Button>
            <Button onClick={kumpulkan} loading={sedangKumpul}>
              <Upload className="h-4 w-4" strokeWidth={1.5} />
              {tugasAktif?.submission ? "Perbarui jawaban" : "Kumpulkan sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
