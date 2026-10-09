"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { RincianHapus } from "@/lib/hapus";

/**
 * Dialog konfirmasi hapus permanen (hard delete).
 * Menampilkan rincian data terkait yang akan ikut terhapus agar kaprodi sadar
 * dampaknya. Tombol: "Batal" dan "Hapus Permanen" (merah).
 */
export function DialogKonfirmasiHapus({
  open,
  onOpenChange,
  label,
  rincian,
  total,
  loading,
  memproses,
  galat,
  onKonfirmasi,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  rincian: RincianHapus[];
  total: number;
  loading: boolean;
  memproses: boolean;
  galat: string | null;
  onKonfirmasi: () => void;
}) {
  const terisi = rincian.filter((r) => r.jumlah > 0);

  return (
    <Dialog open={open} onOpenChange={(v) => !memproses && onOpenChange(v)}>
      <DialogContent hideClose className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-danger-text">
            <AlertTriangle className="h-5 w-5 shrink-0" strokeWidth={1.5} aria-hidden />
            Hapus permanen?
          </DialogTitle>
          <DialogDescription>
            Tindakan ini tidak dapat dibatalkan. Data yang terhapus tidak dapat
            dikembalikan.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text">
          <span className="font-semibold text-fg">{label}</span> akan dihapus
          permanen beserta seluruh data terkait di bawah ini.
        </div>

        {loading ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-fg-muted">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Menghitung data terkait…
          </p>
        ) : terisi.length > 0 ? (
          <ul className="mt-3 max-h-56 overflow-y-auto rounded-md border border-border">
            {terisi.map((r) => (
              <li
                key={r.label}
                className="flex items-center justify-between border-b border-border px-3 py-2 text-sm last:border-b-0"
              >
                <span className="text-fg-muted">{r.label}</span>
                <span className="font-mono-nums font-medium text-fg">{r.jumlah}</span>
              </li>
            ))}
            <li className="flex items-center justify-between bg-surface-muted px-3 py-2 text-sm font-medium">
              <span className="text-fg">Total data terkait</span>
              <span className="font-mono-nums text-fg">{total}</span>
            </li>
          </ul>
        ) : (
          <p className="mt-3 text-sm text-fg-muted">
            Tidak ada data terkait. Hanya akun/profil yang akan dihapus.
          </p>
        )}

        {galat && <p className="mt-3 text-sm text-danger-text">{galat}</p>}

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={memproses}
          >
            Batal
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onKonfirmasi}
            loading={memproses}
            disabled={loading}
          >
            Hapus Permanen
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
