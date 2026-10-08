"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/form-extras";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import { hitungAkhir, hitungGrade, BOBOT_ANGKA } from "@/lib/grade";
import { Save, Undo2, GraduationCap } from "lucide-react";

type KelasDto = {
  id: string;
  kode: string;
  nama: string;
  kodeKelas: string;
  bobot: { bobotTugas: number; bobotUTS: number; bobotUAS: number };
};

type AnggotaDto = {
  mahasiswaId: string;
  nim: string;
  nama: string;
  tugas: number | null;
  uts: number | null;
  uas: number | null;
  akhir: number | null;
  grade: string | null;
};

type Draft = { tugas: string; uts: string; uas: string };

function keAngka(v: string): number | null {
  const t = v.trim();
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n)) return NaN;
  return Math.round(n * 10) / 10;
}

const TONE_GRADE: Record<string, "success" | "info" | "warning" | "danger" | "neutral"> = {
  A: "success",
  B: "info",
  C: "warning",
  D: "warning",
  E: "danger",
};

export function PanelNilai({
  daftarKelas,
  kelasIdAwal,
  anggota,
}: {
  daftarKelas: KelasDto[];
  kelasIdAwal: string;
  anggota: AnggotaDto[];
}) {
  const router = useRouter();
  const [kelasId, setKelasId] = useState(kelasIdAwal);
  const [alasan, setAlasan] = useState("");
  const [draft, setDraft] = useState<Record<string, Draft>>({});
  const [sedangSimpan, setSedangSimpan] = useState(false);
  const [sedangUndo, setSedangUndo] = useState(false);

  const kelas = daftarKelas.find((k) => k.id === kelasId) ?? daftarKelas[0];

  const isiDraft = (mahasiswaId: string, kolom: keyof Draft, nilai: string) => {
    setDraft((d) => ({
      ...d,
      [mahasiswaId]: {
        tugas: d[mahasiswaId]?.tugas ?? "",
        uts: d[mahasiswaId]?.uts ?? "",
        uas: d[mahasiswaId]?.uas ?? "",
        [kolom]: nilai,
      },
    }));
  };

  const nilaiAkhirBaris = (a: AnggotaDto): { akhir: number | null; grade: string | null; valid: boolean } => {
    const d = draft[a.mahasiswaId];
    if (!d) return { akhir: a.akhir, grade: a.grade, valid: true };
    const t = d.tugas === "" ? a.tugas : keAngka(d.tugas);
    const u = d.uts === "" ? a.uts : keAngka(d.uts);
    const w = d.uas === "" ? a.uas : keAngka(d.uas);
    if (t === null || Number.isNaN(t) || u === null || Number.isNaN(u) || w === null || Number.isNaN(w)) {
      return { akhir: null, grade: null, valid: false };
    }
    if (t < 0 || t > 100 || u < 0 || u > 100 || w < 0 || w > 100) {
      return { akhir: null, grade: null, valid: false };
    }
    const akhir = hitungAkhir(t, u, w, kelas!.bobot);
    return { akhir, grade: hitungGrade(akhir), valid: true };
  };

  const jumlahDiubah = useMemo(
    () => Object.values(draft).filter((d) => d.tugas !== "" || d.uts !== "" || d.uas !== "").length,
    [draft]
  );
  const adaEdit = useMemo(
    () =>
      anggota.some((a) => {
        const d = draft[a.mahasiswaId];
        if (!d) return false;
        const t = d.tugas === "" ? null : keAngka(d.tugas);
        const u = d.uts === "" ? null : keAngka(d.uts);
        const w = d.uas === "" ? null : keAngka(d.uas);
        return (
          (t !== null && t !== a.tugas) ||
          (u !== null && u !== a.uts) ||
          (w !== null && w !== a.uas)
        );
      }),
    [draft, anggota]
  );
  const semuaValid = anggota.every((a) => nilaiAkhirBaris(a).valid);

  async function simpan() {
    if (jumlahDiubah === 0) {
      toast.info("Belum ada perubahan nilai untuk disimpan.");
      return;
    }
    if (!semuaValid) {
      toast.error("Ada nilai tidak valid. Periksa kolom 0–100.");
      return;
    }
    if (adaEdit && alasan.trim().length === 0) {
      toast.error("Alasan wajib diisi untuk perubahan nilai yang sudah ada.");
      return;
    }
    setSedangSimpan(true);
    try {
      const baris = anggota
        .filter((a) => draft[a.mahasiswaId])
        .map((a) => {
          const d = draft[a.mahasiswaId];
          return {
            mahasiswaId: a.mahasiswaId,
            tugas: d.tugas === "" ? a.tugas : keAngka(d.tugas),
            uts: d.uts === "" ? a.uts : keAngka(d.uts),
            uas: d.uas === "" ? a.uas : keAngka(d.uas),
          };
        });

      const res = await fetch("/api/nilai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kelasId, alasan: alasan.trim() || undefined, baris }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Gagal menyimpan nilai.");
        return;
      }
      const pesan =
        (data.menunggu ?? 0) > 0
          ? `${data.diterapkan} nilai diterapkan, ${data.menunggu} menunggu validasi kaprodi.`
          : `${data.diterapkan} nilai berhasil disimpan.`;
      toast.success(pesan);
      setDraft({});
      setAlasan("");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangSimpan(false);
    }
  }

  async function urungkanTerakhir() {
    setSedangUndo(true);
    try {
      const res = await fetch("/api/riwayat/terbaru", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kelasId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Tidak ada perubahan untuk diurungkan.");
        return;
      }
      toast.success("Perubahan terakhir berhasil diurungkan.");
      router.refresh();
    } catch {
      toast.error("Terjadi kesalahan jaringan. Coba lagi.");
    } finally {
      setSedangUndo(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-3">
        <div className="min-w-0">
          <CardTitle>Tabel nilai</CardTitle>
          <p className="text-xs text-fg-muted">
            {kelas
              ? `${kelas.kode} · ${kelas.nama} · Kelas ${kelas.kodeKelas} · bobot ${Math.round(kelas.bobot.bobotTugas * 100)}/${Math.round(kelas.bobot.bobotUTS * 100)}/${Math.round(kelas.bobot.bobotUAS * 100)}`
              : ""}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="w-56">
            <Select
              aria-label="Pilih kelas"
              value={kelasId}
              onChange={(e) => {
                setKelasId(e.target.value);
                setDraft({});
                setAlasan("");
                router.push(`/dosen/nilai?kelas=${e.target.value}`);
              }}
              options={daftarKelas.map((k) => ({
                value: k.id,
                label: `${k.kode} · ${k.kodeKelas}`,
              }))}
            />
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {anggota.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            judul="Belum ada mahasiswa di kelas ini"
            deskripsi="Mahasiswa yang ber-KRS aktif pada kelas ini akan tampil di tabel nilai."
          />
        ) : (
          <>
            <div className="rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-36">NIM</TableHead>
                    <TableHead>Nama</TableHead>
                    <TableHead className="w-24 text-right">Tugas</TableHead>
                    <TableHead className="w-24 text-right">UTS</TableHead>
                    <TableHead className="w-24 text-right">UAS</TableHead>
                    <TableHead className="w-20 text-right">Akhir</TableHead>
                    <TableHead className="w-16 text-center">Grade</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {anggota.map((a) => {
                    const d = draft[a.mahasiswaId];
                    const preview = nilaiAkhirBaris(a);
                    const diubah = !!d && (d.tugas !== "" || d.uts !== "" || d.uas !== "");
                    return (
                      <TableRow key={a.mahasiswaId}>
                        <TableCell>
                          <Num>{a.nim}</Num>
                        </TableCell>
                        <TableCell className="min-w-40">
                          <span className="block truncate font-medium text-fg">{a.nama}</span>
                          {diubah && (
                            <Badge variant="warning" className="mt-0.5">
                              diubah
                            </Badge>
                          )}
                        </TableCell>
                        {(["tugas", "uts", "uas"] as const).map((kolom) => (
                          <TableCell key={kolom}>
                            <Input
                              mono
                              inputMode="decimal"
                              aria-label={`${kolom} ${a.nama}`}
                              className="h-8 text-right"
                              placeholder={a[kolom] === null ? "—" : String(a[kolom])}
                              value={d?.[kolom] ?? ""}
                              onChange={(e) => isiDraft(a.mahasiswaId, kolom, e.target.value)}
                              invalid={
                                d?.[kolom] !== undefined &&
                                d[kolom] !== "" &&
                                (Number.isNaN(keAngka(d[kolom])) ||
                                  (keAngka(d[kolom]) ?? -1) < 0 ||
                                  (keAngka(d[kolom]) ?? 101) > 100)
                              }
                            />
                          </TableCell>
                        ))}
                        <TableCell className="text-right">
                          <Num className="font-semibold text-fg">
                            {preview.akhir ?? "—"}
                          </Num>
                        </TableCell>
                        <TableCell className="text-center">
                          {preview.grade ? (
                            <Badge variant={TONE_GRADE[preview.grade] ?? "neutral"}>
                              {preview.grade}
                            </Badge>
                          ) : (
                            <span className="text-fg-subtle">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Aksi simpan */}
            <div className="flex flex-col gap-3 rounded-lg border border-border bg-surface-muted p-3 sm:flex-row sm:items-end">
              <div className="flex-1">
                <Label htmlFor="alasan-nilai">Alasan perubahan</Label>
                <Input
                  id="alasan-nilai"
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value)}
                  placeholder={
                    adaEdit
                      ? "Wajib — mis. 'koreksi nilai UTS salah input'"
                      : "Opsional untuk input baru"
                  }
                  maxLength={300}
                  className="mt-1.5"
                />
                <p className="mt-1 text-2xs text-fg-subtle">
                  {jumlahDiubah} baris diubah · akhir dihitung dari bobot{" "}
                  {kelas
                    ? `${Math.round(kelas.bobot.bobotTugas * 100)}/${Math.round(kelas.bobot.bobotUTS * 100)}/${Math.round(kelas.bobot.bobotUAS * 100)}`
                    : ""}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={urungkanTerakhir}
                  loading={sedangUndo}
                  disabled={jumlahDiubah > 0}
                >
                  <Undo2 className="h-4 w-4" strokeWidth={1.5} />
                  Urungkan terakhir
                </Button>
                <Button
                  onClick={simpan}
                  loading={sedangSimpan}
                  disabled={jumlahDiubah === 0 || !semuaValid}
                >
                  <Save className="h-4 w-4" strokeWidth={1.5} />
                  Simpan nilai
                </Button>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
