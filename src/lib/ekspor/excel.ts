import ExcelJS from "exceljs";
import type { DataLaporan } from "@/lib/laporan";
import { labelSemester, stempelCetak } from "@/lib/laporan";

/**
 * Membuat workbook Excel (.xlsx) laporan akademik yang rapi:
 * judul + subjudul, tabel ber-border, header berwarna & beku,
 * banding baris, lebar kolom, format angka, autofilter, dan
 * pewarnaan bersyarat (kehadiran <75%, grade, dsb.).
 */

const WARNA = {
  judulBg: "FF0B4F45",
  headerBg: "FF0F766E",
  subBg: "FFF1F5F9",
  border: "FFD7DEE7",
  teks: "FF0F172A",
  teksMuted: "FF475569",
  genap: "FFF6F9FB",
  suksesBg: "FFE7F6EC",
  suksesTeks: "FF14653A",
  peringatanBg: "FFFDF3D6",
  peringatanTeks: "FF8A5A00",
  infoBg: "FFE8F0FB",
  infoTeks: "FF1D4E89",
} as const;

const FILL_SOLID = (argb: string): ExcelJS.Fill => ({
  type: "pattern",
  pattern: "solid",
  fgColor: { argb },
});

const BORDER_TIPIS: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: WARNA.border } },
  left: { style: "thin", color: { argb: WARNA.border } },
  bottom: { style: "thin", color: { argb: WARNA.border } },
  right: { style: "thin", color: { argb: WARNA.border } },
};

type Kolom = {
  header: string;
  width: number;
  align?: "left" | "center" | "right";
  numFmt?: string;
};

/** Gaya ringkas dari pewarnai agar tak menyentuh tipe internal ExcelJS. */
type GayaSel = { bg?: string; warnaTeks?: string; tebal?: boolean };
type Pewarnai = (
  indeksBaris: number,
  indeksKolom: number,
  nilai: string | number | null
) => GayaSel | null;

type OpsiTabel = {
  judul: string;
  subjudul: string;
  catatan?: string;
  pewarnai?: Pewarnai;
  xSplit?: number;
};

/** Tulis satu sheet berisi satu tabel rapi; kembalikan worksheet-nya. */
function tambahTabel(
  wb: ExcelJS.Workbook,
  namaSheet: string,
  kolom: Kolom[],
  baris: (string | number | null)[][],
  opsi: OpsiTabel
) {
  const ws = wb.addWorksheet(namaSheet);
  const nKol = kolom.length;

  // Lebar kolom
  kolom.forEach((k, i) => {
    ws.getColumn(i + 1).width = k.width;
  });

  // ── Baris 1: pita judul ────────────────────────────────
  let r = 1;
  ws.getRow(r).height = 28;
  ws.mergeCells(r, 1, r, nKol);
  for (let c = 1; c <= nKol; c++) ws.getCell(r, c).fill = FILL_SOLID(WARNA.judulBg);
  const selJudul = ws.getCell(r, 1);
  selJudul.value = opsi.judul;
  selJudul.font = { bold: true, size: 14, color: { argb: "FFFFFFFF" } };
  selJudul.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  r++;

  // ── Baris 2: subjudul ──────────────────────────────────
  ws.getRow(r).height = 18;
  ws.mergeCells(r, 1, r, nKol);
  for (let c = 1; c <= nKol; c++) ws.getCell(r, c).fill = FILL_SOLID(WARNA.subBg);
  const selSub = ws.getCell(r, 1);
  selSub.value = opsi.subjudul;
  selSub.font = { italic: true, size: 10, color: { argb: WARNA.teksMuted } };
  selSub.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
  r++;

  // ── Baris 3 (opsional): catatan ringkas ────────────────
  if (opsi.catatan) {
    ws.getRow(r).height = 18;
    ws.mergeCells(r, 1, r, nKol);
    for (let c = 1; c <= nKol; c++) ws.getCell(r, c).fill = FILL_SOLID(WARNA.subBg);
    const selCat = ws.getCell(r, 1);
    selCat.value = opsi.catatan;
    selCat.font = { size: 10, color: { argb: WARNA.infoTeks }, bold: true };
    selCat.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
    r++;
  }

  // ── Baris header tabel ─────────────────────────────────
  const barisHeader = r;
  ws.getRow(r).height = 24;
  kolom.forEach((k, i) => {
    const sel = ws.getCell(r, i + 1);
    sel.value = k.header;
    sel.font = { bold: true, size: 10, color: { argb: "FFFFFFFF" } };
    sel.fill = FILL_SOLID(WARNA.headerBg);
    sel.alignment = {
      vertical: "middle",
      horizontal: k.align ?? "left",
      wrapText: true,
    };
    sel.border = BORDER_TIPIS;
  });
  r++;

  // ── Baris data ─────────────────────────────────────────
  const barisPertama = r;
  baris.forEach((row, idxBaris) => {
    ws.getRow(r).height = 18;
    row.forEach((nilai, idxKol) => {
      const sel = ws.getCell(r, idxKol + 1);
      sel.value = nilai === undefined ? null : nilai;
      sel.font = { size: 10, color: { argb: WARNA.teks } };
      sel.alignment = {
        vertical: "middle",
        horizontal: kolom[idxKol]?.align ?? "left",
      };
      sel.border = BORDER_TIPIS;
      if (kolom[idxKol]?.numFmt) sel.numFmt = kolom[idxKol].numFmt!;
      if (idxBaris % 2 === 1) sel.fill = FILL_SOLID(WARNA.genap);

      const gaya = opsi.pewarnai?.(idxBaris, idxKol, nilai ?? null);
      if (gaya) {
        if (gaya.bg) sel.fill = FILL_SOLID(gaya.bg);
        sel.font = {
          size: 10,
          bold: gaya.tebal ?? false,
          color: { argb: gaya.warnaTeks ?? WARNA.teks },
        };
      }
    });
    r++;
  });
  const barisTerakhir = r - 1;

  // ── Bekukan header & autofilter ────────────────────────
  ws.views = [{ state: "frozen", ySplit: barisHeader, xSplit: opsi.xSplit ?? 0 }];
  if (barisTerakhir >= barisHeader) {
    ws.autoFilter = {
      from: { row: barisHeader, column: 1 },
      to: { row: barisTerakhir, column: nKol },
    };
  }

  // ── Pengaturan cetak (A4 landscape, muat 1 halaman lebar) ──
  ws.pageSetup = {
    paperSize: 9,
    orientation: "landscape",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    horizontalCentered: true,
    printTitlesRow: `${barisHeader}:${barisHeader}`,
    margins: { left: 0.3, right: 0.3, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
  };

  return { ws, barisPertama, barisTerakhir };
}

export async function buatExcelLaporan(data: DataLaporan): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "SIAKAD Absensi FKIP";
  wb.created = data.dicetakPada;

  const subjudul = `Semester ${labelSemester(data.semester)}  ·  Dicetak ${stempelCetak(
    data.dicetakPada
  )}`;

  // ── Sheet 1: Rekap per kelas ───────────────────────────
  const kolomKelas: Kolom[] = [
    { header: "Kode", width: 12, align: "center" },
    { header: "Mata Kuliah", width: 34 },
    { header: "Kelas", width: 8, align: "center" },
    { header: "SKS", width: 6, align: "center" },
    { header: "Dosen Pengampu", width: 28 },
    { header: "Mahasiswa", width: 12, align: "center" },
    { header: "Pertemuan", width: 11, align: "center" },
    { header: "Kehadiran Rata-rata", width: 18, align: "center", numFmt: '0.0"%"' },
    { header: "Di bawah 75%", width: 13, align: "center" },
  ];
  const barisKelas = data.kelas.map((k) => [
    k.kode,
    k.mataKuliah,
    k.kelas,
    k.sks,
    k.dosen,
    k.jumlahMahasiswa,
    k.totalPertemuan,
    k.rataKehadiran,
    k.diBawah75,
  ]);
  const catatanKelas = `Kelas aktif: ${data.kelas.length}  ·  Kehadiran rata-rata prodi: ${data.rataProdi}%  ·  Nilai akhir rata-rata: ${
    data.rataNilai ?? "—"
  }  ·  Mahasiswa berisiko (<75%): ${data.jumlahBerisiko}`;

  tambahTabel(wb, "Rekap Kelas", kolomKelas, barisKelas, {
    judul: "SIAKAD ABSENSI FKIP — REKAP KELAS",
    subjudul,
    catatan: catatanKelas,
    pewarnai: (_b, kol, nilai) => {
      if (kol === 7 && typeof nilai === "number") {
        return nilai >= 75
          ? { bg: WARNA.suksesBg, warnaTeks: WARNA.suksesTeks, tebal: true }
          : { bg: WARNA.peringatanBg, warnaTeks: WARNA.peringatanTeks, tebal: true };
      }
      if (kol === 8 && typeof nilai === "number") {
        return nilai > 0
          ? { bg: WARNA.peringatanBg, warnaTeks: WARNA.peringatanTeks }
          : { bg: WARNA.suksesBg, warnaTeks: WARNA.suksesTeks };
      }
      return null;
    },
  });

  // ── Sheet 2: Detail per mahasiswa ──────────────────────
  const kolomMhs: Kolom[] = [
    { header: "Kode", width: 12, align: "center" },
    { header: "Mata Kuliah", width: 30 },
    { header: "Kelas", width: 7, align: "center" },
    { header: "Dosen Pengampu", width: 24 },
    { header: "NIM", width: 13, align: "center" },
    { header: "Nama Mahasiswa", width: 26 },
    { header: "Hadir", width: 7, align: "center" },
    { header: "Sakit", width: 7, align: "center" },
    { header: "Izin", width: 7, align: "center" },
    { header: "Alpha", width: 7, align: "center" },
    { header: "Kehadiran", width: 11, align: "center", numFmt: '0.0"%"' },
    { header: "Memenuhi 75%", width: 13, align: "center" },
    { header: "Nilai Akhir", width: 11, align: "center", numFmt: "0.0" },
    { header: "Grade", width: 8, align: "center" },
  ];

  const barisMhs: (string | number | null)[][] = [];
  for (const k of data.kelas) {
    for (const m of k.mahasiswa) {
      barisMhs.push([
        k.kode,
        k.mataKuliah,
        k.kelas,
        k.dosen,
        m.nim,
        m.nama,
        m.hadir,
        m.sakit,
        m.izin,
        m.alpha,
        m.persen,
        m.memenuhi ? "Ya" : "Tidak",
        m.nilaiAkhir,
        m.grade,
      ]);
    }
  }

  const WARNA_GRADE: Record<string, GayaSel> = {
    A: { bg: WARNA.suksesBg, warnaTeks: WARNA.suksesTeks, tebal: true },
    B: { bg: WARNA.infoBg, warnaTeks: WARNA.infoTeks, tebal: true },
    C: { bg: WARNA.peringatanBg, warnaTeks: WARNA.peringatanTeks, tebal: true },
    D: { bg: WARNA.peringatanBg, warnaTeks: WARNA.peringatanTeks, tebal: true },
    E: { bg: "FFFCE4E4", warnaTeks: "FF9B1C1C", tebal: true },
  };

  tambahTabel(wb, "Detail Mahasiswa", kolomMhs, barisMhs, {
    judul: "SIAKAD ABSENSI FKIP — DETAIL MAHASISWA",
    subjudul,
    catatan: `Total ${barisMhs.length} baris mahasiswa dari ${data.kelas.length} kelas aktif.`,
    xSplit: 4,
    pewarnai: (_b, kol, nilai) => {
      if (kol === 10 && typeof nilai === "number") {
        return nilai >= 75
          ? { warnaTeks: WARNA.suksesTeks, tebal: true }
          : { warnaTeks: WARNA.peringatanTeks, tebal: true };
      }
      if (kol === 11 && typeof nilai === "string") {
        return nilai === "Ya"
          ? { bg: WARNA.suksesBg, warnaTeks: WARNA.suksesTeks }
          : { bg: WARNA.peringatanBg, warnaTeks: WARNA.peringatanTeks, tebal: true };
      }
      if (kol === 13 && typeof nilai === "string") {
        return WARNA_GRADE[nilai] ?? null;
      }
      return null;
    },
  });

  const buf = await wb.xlsx.writeBuffer();
  return Buffer.from(buf);
}
