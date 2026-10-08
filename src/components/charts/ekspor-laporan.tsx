"use client";

import * as React from "react";
import { toast } from "sonner";
import { ChevronDown, Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type Format = "xlsx" | "pdf";

const LABEL: Record<Format, string> = { xlsx: "Excel", pdf: "PDF" };

/** Tombol unduh laporan akademik dalam format Excel (.xlsx) atau PDF. */
export function TombolEksporLaporan() {
  const [sibuk, setSibuk] = React.useState<Format | null>(null);

  async function unduh(format: Format) {
    setSibuk(format);
    const idToast = toast.loading(`Menyiapkan berkas ${LABEL[format]}…`);
    try {
      const res = await fetch(`/api/laporan/export?format=${format}`, { cache: "no-store" });
      if (!res.ok) {
        const pesan =
          res.status === 403
            ? "Anda tidak berhak mengunduh laporan ini."
            : res.status === 401
              ? "Sesi berakhir, silakan masuk ulang."
              : "Gagal menyiapkan berkas laporan.";
        throw new Error(pesan);
      }

      const blob = await res.blob();
      const disposisi = res.headers.get("Content-Disposition") ?? "";
      const cocok = /filename="([^"]+)"/.exec(disposisi);
      const nama = cocok?.[1] ?? `laporan-akademik.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nama;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      toast.success("Berkas laporan terunduh.", { id: idToast, description: nama });
    } catch (err) {
      toast.error("Gagal mengunduh laporan", {
        id: idToast,
        description: err instanceof Error ? err.message : "Terjadi kesalahan tak terduga.",
      });
    } finally {
      setSibuk(null);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="secondary" size="sm" loading={sibuk !== null}>
          <Download className="h-4 w-4" strokeWidth={1.5} aria-hidden />
          Unduh laporan
          <ChevronDown className="h-3.5 w-3.5 opacity-70" strokeWidth={1.5} aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[13rem]">
        <DropdownMenuLabel>Pilih format berkas</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => unduh("xlsx")} disabled={sibuk !== null}>
          <FileSpreadsheet className="h-4 w-4 text-success-text" strokeWidth={1.5} aria-hidden />
          Excel (.xlsx)
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => unduh("pdf")} disabled={sibuk !== null}>
          <FileText className="h-4 w-4 text-danger-text" strokeWidth={1.5} aria-hidden />
          PDF (.pdf)
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="font-normal">
          Tabel rapi siap cetak, satu semester penuh.
        </DropdownMenuLabel>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
