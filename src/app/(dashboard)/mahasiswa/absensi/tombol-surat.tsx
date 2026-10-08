"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Upload } from "lucide-react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * Tombol + dialog mahasiswa mengajukan surat izin/sakit untuk satu absensi.
 * Berkas diunggah ke server (PDF/JPG/PNG, maks 5 MB).
 */
export function TombolSurat({
  absensiId,
  konteks,
}: {
  absensiId: string;
  konteks: string;
}) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [keterangan, setKeterangan] = React.useState("");
  const [berkas, setBerkas] = React.useState<File | null>(null);
  const [kirim, setKirim] = React.useState(false);

  async function ajukan() {
    if (!berkas) {
      toast.error("Pilih berkas surat terlebih dahulu.");
      return;
    }
    setKirim(true);
    try {
      const fd = new FormData();
      fd.append("absensiId", absensiId);
      fd.append("keterangan", keterangan);
      fd.append("berkas", berkas);
      const res = await fetch("/api/surat-izin", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Gagal mengirim surat izin.");
        return;
      }
      toast.success("Surat izin terkirim.", {
        description: "Menunggu peninjauan dosen pengampu.",
      });
      setOpen(false);
      setKeterangan("");
      setBerkas(null);
      router.refresh();
    } catch {
      toast.error("Tidak dapat terhubung ke server.");
    } finally {
      setKirim(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" size="sm">
          <Upload className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Ajukan
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Ajukan surat izin</DialogTitle>
          <DialogDescription>
            Unggah surat untuk <span className="font-medium text-fg">{konteks}</span>.
            Format PDF, JPG, atau PNG maksimal 5 MB.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="berkas-surat">Berkas surat</Label>
            <Input
              id="berkas-surat"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(e) => setBerkas(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="keterangan-surat">Keterangan (opsional)</Label>
            <textarea
              id="keterangan-surat"
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              placeholder="mis. Sakit demam, surat dokter terlampir."
              maxLength={500}
              rows={3}
              className="w-full rounded border border-border bg-surface px-3 py-2 text-sm text-fg placeholder:text-fg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setOpen(false)}>
            Batal
          </Button>
          <Button onClick={ajukan} loading={kirim} disabled={!berkas}>
            Kirim surat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
