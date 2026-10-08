"use client";

import { BookOpen, CalendarDays, MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/states";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
  Num,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export type BarisKrs = {
  id: string;
  kode: string;
  nama: string;
  sks: number;
  kodeKelas: string;
  dosen: string;
  status: "pengajuan" | "diambil" | "drop" | "lulus";
  jadwal: { hari: string; jam: string; ruang: string }[];
};

export type SemesterKrs = {
  id: string;
  label: string;
  aktif: boolean;
  totalSks: number;
  baris: BarisKrs[];
};

const TONE_STATUS: Record<BarisKrs["status"], "info" | "success" | "danger" | "warning"> = {
  pengajuan: "warning",
  diambil: "info",
  lulus: "success",
  drop: "danger",
};

const LABEL_STATUS: Record<BarisKrs["status"], string> = {
  pengajuan: "Menunggu validasi",
  diambil: "Diambil",
  lulus: "Lulus",
  drop: "Drop",
};

export function PanelKrs({ data }: { data: SemesterKrs[] }) {
  if (data.length === 0) {
    return (
      <Card>
        <EmptyState
          icon={BookOpen}
          judul="Belum ada KRS"
          deskripsi="Anda belum terdaftar pada mata kuliah mana pun. Hubungi dosen wali atau bagian akademik untuk pengisian KRS."
        />
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kartu Rencana Studi</CardTitle>
        <p className="text-xs text-fg-muted">
          Mata kuliah yang Anda tempuh beserta dosen pengampu dan jadwalnya.
        </p>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={data.find((s) => s.aktif)?.id ?? data[0].id}>
          <TabsList className="max-w-full overflow-x-auto">
            {data.map((s) => (
              <TabsTrigger key={s.id} value={s.id}>
                {s.label}
                {s.aktif && (
                  <span
                    className="h-1.5 w-1.5 rounded-full bg-accent"
                    aria-label="semester aktif"
                  />
                )}
              </TabsTrigger>
            ))}
          </TabsList>

          {data.map((s) => (
            <TabsContent key={s.id} value={s.id}>
              {s.baris.length === 0 ? (
                <EmptyState
                  compact
                  icon={BookOpen}
                  judul="Tidak ada mata kuliah"
                  deskripsi="Semester ini belum ada mata kuliah yang terdaftar pada KRS Anda."
                />
              ) : (
                <div className="rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-24">Kode</TableHead>
                        <TableHead>Mata kuliah</TableHead>
                        <TableHead className="w-14 text-right">SKS</TableHead>
                        <TableHead>Dosen pengampu</TableHead>
                        <TableHead>Jadwal</TableHead>
                        <TableHead className="w-24 text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.baris.map((b) => (
                        <TableRow key={b.id}>
                          <TableCell>
                            <Num className="text-fg-muted">{b.kode}</Num>
                          </TableCell>
                          <TableCell>
                            <span className="block font-medium text-fg">
                              {b.nama}
                            </span>
                            <span className="text-2xs text-fg-subtle">
                              Kelas {b.kodeKelas}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">
                            <Num className="text-fg-muted">{b.sks}</Num>
                          </TableCell>
                          <TableCell className="text-fg-muted">
                            {b.dosen}
                          </TableCell>
                          <TableCell>
                            {b.jadwal.length === 0 ? (
                              <span className="text-2xs text-fg-subtle">
                                Belum dijadwalkan
                              </span>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {b.jadwal.map((j, i) => (
                                  <span
                                    key={i}
                                    className="flex flex-wrap items-center gap-1.5 text-xs text-fg-muted"
                                  >
                                    <CalendarDays
                                      className="h-3 w-3 shrink-0"
                                      strokeWidth={1.5}
                                      aria-hidden
                                    />
                                    {j.hari} {j.jam}
                                    <span className="inline-flex items-center gap-0.5 text-fg-subtle">
                                      <MapPin
                                        className="h-3 w-3"
                                        strokeWidth={1.5}
                                        aria-hidden
                                      />
                                      {j.ruang}
                                    </span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={TONE_STATUS[b.status]}>
                              {LABEL_STATUS[b.status]}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow className="hover:bg-transparent">
                        <TableCell
                          colSpan={2}
                          className="text-xs font-medium text-fg-muted"
                        >
                          {s.baris.filter((b) => b.status !== "drop" && b.status !== "pengajuan").length} mata
                          kuliah
                        </TableCell>
                        <TableCell className="text-right font-mono-nums tnum font-semibold text-fg">
                          {s.totalSks}
                        </TableCell>
                        <TableCell
                          colSpan={3}
                          className="text-2xs text-fg-subtle"
                        >
                          total SKS semester ini
                        </TableCell>
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  );
}
