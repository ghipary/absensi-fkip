import PdfPrinter from "pdfmake";
import type {
  Content,
  CustomTableLayout,
  TableCell,
  TDocumentDefinitions,
} from "pdfmake/interfaces";
import type { DataLaporan } from "@/lib/laporan";
import { labelSemester, stempelCetak } from "@/lib/laporan";

/** PDF laporan akademik (A4 landscape) dengan tabel ringkas & detail. */

const WARNA = {
  judul: "#0B4F45",
  header: "#0F766E",
  border: "#D7DEE7",
  teks: "#0F172A",
  muted: "#475569",
  genap: "#F6F9FB",
  suksesBg: "#E7F6EC",
  suksesTeks: "#14653A",
  peringatanBg: "#FDF3D6",
  peringatanTeks: "#8A5A00",
  infoBg: "#E8F0FB",
  infoTeks: "#1D4E89",
  bahayaBg: "#FCE4E4",
  bahayaTeks: "#9B1C1C",
};

type Align = "left" | "center" | "right";

const LAYOUT_RAPI: CustomTableLayout = {
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => WARNA.border,
  vLineColor: () => WARNA.border,
  paddingTop: () => 3,
  paddingBottom: () => 3,
  paddingLeft: () => 4,
  paddingRight: () => 4,
};

function sel(
  nilai: string | number | null,
  o?: { align?: Align; bold?: boolean; fill?: string; color?: string; fontSize?: number }
): TableCell {
  const kosong = nilai === null || nilai === undefined || nilai === "";
  return {
    text: kosong ? "—" : String(nilai),
    alignment: o?.align ?? "left",
    bold: o?.bold ?? false,
    ...(o?.fill ? { fillColor: o.fill } : {}),
    ...(o?.color ? { color: o.color } : {}),
    ...(o?.fontSize ? { fontSize: o.fontSize } : {}),
  };
}

function headerSel(teks: string, align: Align): TableCell {
  return {
    text: teks,
    alignment: align,
    bold: true,
    color: "#FFFFFF",
    fillColor: WARNA.header,
    fontSize: 8,
  };
}

/** Sel tabel rekap kelas (warna bersyarat pada kolom kehadiran & di bawah 75%). */
function barisRekap(k: DataLaporan["kelas"][number]): TableCell[] {
  const warnaLulus = k.rataKehadiran >= 75;
  return [
    sel(k.kode, { align: "center" }),
    sel(k.mataKuliah),
    sel(k.kelas, { align: "center" }),
    sel(k.sks, { align: "center" }),
    sel(k.dosen),
    sel(k.jumlahMahasiswa, { align: "center" }),
    sel(k.totalPertemuan, { align: "center" }),
    sel(`${k.rataKehadiran}%`, {
      align: "center",
      bold: true,
      fill: warnaLulus ? WARNA.suksesBg : WARNA.peringatanBg,
      color: warnaLulus ? WARNA.suksesTeks : WARNA.peringatanTeks,
    }),
    sel(k.diBawah75, {
      align: "center",
      fill: k.diBawah75 > 0 ? WARNA.peringatanBg : WARNA.suksesBg,
      color: k.diBawah75 > 0 ? WARNA.peringatanTeks : WARNA.suksesTeks,
    }),
  ];
}

const WARNA_GRADE: Record<string, { fill: string; color: string }> = {
  A: { fill: WARNA.suksesBg, color: WARNA.suksesTeks },
  B: { fill: WARNA.infoBg, color: WARNA.infoTeks },
  C: { fill: WARNA.peringatanBg, color: WARNA.peringatanTeks },
  D: { fill: WARNA.peringatanBg, color: WARNA.peringatanTeks },
  E: { fill: WARNA.bahayaBg, color: WARNA.bahayaTeks },
};

export async function buatPdfLaporan(data: DataLaporan): Promise<Buffer> {
  const printer = new PdfPrinter({
    Helvetica: {
      normal: "Helvetica",
      bold: "Helvetica-Bold",
      italics: "Helvetica-Oblique",
      bolditalics: "Helvetica-BoldOblique",
    },
  });

  const subjudul = `Semester ${labelSemester(data.semester)}  ·  Dicetak ${stempelCetak(
    data.dicetakPada
  )}`;

  const ringkasan: TableCell[][] = [
    [
      "Kelas Aktif",
      "Kehadiran Rata-rata",
      "Nilai Akhir Rata-rata",
      "Mahasiswa Berisiko",
    ].map((t) =>
      sel(t, { align: "center", fill: WARNA.genap, color: WARNA.muted, fontSize: 8, bold: true })
    ),
    [
      data.kelas.length,
      `${data.rataProdi}%`,
      data.rataNilai ?? "—",
      data.jumlahBerisiko,
    ].map((t) => sel(t, { align: "center", bold: true, fontSize: 13, fill: WARNA.genap })),
  ];

  const tabelRekap: Content = {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [46, 150, 32, 28, 132, 54, 52, 58, 58],
      body: [
        [
          "Kode",
          "Mata Kuliah",
          "Kelas",
          "SKS",
          "Dosen Pengampu",
          "Mahasiswa",
          "Pertemuan",
          "Kehadiran",
          "Di bawah 75%",
        ].map((t, i) => headerSel(t, i === 1 || i === 4 ? "left" : "center")),
        ...data.kelas.map(barisRekap),
      ],
    },
    layout: LAYOUT_RAPI,
  };

  const barisDetail: TableCell[][] = [];
  for (const k of data.kelas) {
    for (const m of k.mahasiswa) {
      const grade = m.grade ? WARNA_GRADE[m.grade] : undefined;
      barisDetail.push([
        sel(k.kode, { align: "center" }),
        sel(k.mataKuliah),
        sel(k.kelas, { align: "center" }),
        sel(k.dosen),
        sel(m.nim, { align: "center" }),
        sel(m.nama),
        sel(m.hadir, { align: "center" }),
        sel(m.sakit, { align: "center" }),
        sel(m.izin, { align: "center" }),
        sel(m.alpha, { align: "center" }),
        sel(`${m.persen}%`, {
          align: "center",
          bold: true,
          color: m.memenuhi ? WARNA.suksesTeks : WARNA.peringatanTeks,
        }),
        sel(m.memenuhi ? "Ya" : "Tidak", {
          align: "center",
          fill: m.memenuhi ? WARNA.suksesBg : WARNA.peringatanBg,
          color: m.memenuhi ? WARNA.suksesTeks : WARNA.peringatanTeks,
        }),
        sel(m.nilaiAkhir, { align: "center" }),
        sel(m.grade, {
          align: "center",
          bold: true,
          fill: grade?.fill,
          color: grade?.color,
        }),
      ]);
    }
  }

  const headerDetail: TableCell[] = [
    "Kode",
    "Mata Kuliah",
    "Kelas",
    "Dosen",
    "NIM",
    "Nama Mahasiswa",
    "H",
    "S",
    "I",
    "A",
    "Kehadiran",
    "Memenuhi 75%",
    "Nilai Akhir",
    "Grade",
  ].map((t, i) => headerSel(t, i === 1 || i === 3 || i === 5 ? "left" : "center"));

  const tabelDetail: Content = {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: [44, 118, 28, 96, 58, 128, 22, 22, 22, 22, 46, 50, 40, 34],
      body: [headerDetail, ...barisDetail],
    },
    layout: LAYOUT_RAPI,
  };

  const docDef: TDocumentDefinitions = {
    pageSize: "A4",
    pageOrientation: "landscape",
    pageMargins: [24, 52, 24, 34],
    defaultStyle: { font: "Helvetica", fontSize: 8, color: WARNA.teks },
    header: (currentPage, pageCount) => ({
      margin: [24, 16, 24, 0],
      columns: [
        { text: "SIAKAD ABSENSI FKIP", bold: true, color: WARNA.judul, fontSize: 9 },
        {
          text: `Halaman ${currentPage} dari ${pageCount}`,
          alignment: "right",
          fontSize: 8,
          color: WARNA.muted,
        },
      ],
    }),
    footer: () => ({
      margin: [24, 0, 24, 12],
      text: `Laporan Akademik ${labelSemester(data.semester)}  ·  Dicetak ${stempelCetak(
        data.dicetakPada
      )}`,
      alignment: "center",
      fontSize: 7,
      color: WARNA.muted,
    }),
    content: [
      { text: "LAPORAN AKADEMIK", fontSize: 18, bold: true, color: WARNA.judul },
      { text: subjudul, fontSize: 9, color: WARNA.muted, margin: [0, 2, 0, 12] },
      { table: { widths: ["*", "*", "*", "*"], body: ringkasan }, layout: LAYOUT_RAPI },
      {
        text: "Rekap per Kelas",
        fontSize: 12,
        bold: true,
        color: WARNA.judul,
        margin: [0, 18, 0, 6],
      },
      data.kelas.length > 0 ? tabelRekap : { text: "Belum ada kelas aktif.", color: WARNA.muted },
      {
        text: "Detail per Mahasiswa",
        fontSize: 12,
        bold: true,
        color: WARNA.judul,
        margin: [0, 6, 0, 6],
        pageBreak: "before",
      },
      barisDetail.length > 0
        ? tabelDetail
        : { text: "Belum ada data mahasiswa.", color: WARNA.muted },
    ],
  };

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = printer.createPdfKitDocument(docDef);
      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
