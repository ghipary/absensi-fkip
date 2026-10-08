"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { QrCode, MapPin, CheckCircle2, ScanLine } from "lucide-react";

type HasilCek = {
  ok?: boolean;
  error?: string;
  absensi?: {
    status: string;
    checkInAt: string;
    mataKuliah: string;
    pertemuan: number;
  };
};

/** Form check-in: QR (auto dari URL scan) / kode unik manual / lokasi opsional */
export function FormCheckin() {
  const search = useSearchParams();
  const [kode, setKode] = useState("");
  const [sisaToken, setSisaToken] = useState<{ sesi: string; t: string } | null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [gunakanLokasi, setGunakanLokasi] = useState(false);
  const [hasil, setHasil] = useState<HasilCek | null>(null);
  const [loading, startTransition] = useTransition();
  const sudahDikirim = useRef(false);

  // URL hasil scan QR: /mahasiswa/absensi?sesi=...&t=...
  useEffect(() => {
    const sesi = search.get("sesi");
    const t = search.get("t");
    if (sesi && t && !sudahDikirim.current) {
      sudahDikirim.current = true;
      setSisaToken({ sesi, t });
      kirimCheckin({ token: t, sesiId: sesi });
    }
  }, [search]);

  async function mintaLokasi(): Promise<{ latitude?: number; longitude?: number }> {
    if (!gunakanLokasi) return {};
    return new Promise((resolve) => {
      if (!navigator.geolocation) return resolve({});
      navigator.geolocation.getCurrentPosition(
        (pos) =>
          resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        () => {
          toast.warning(
            "Lokasi tidak dapat diambil. Absen tetap dicoba tanpa lokasi."
          );
          resolve({});
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  }

  async function kirimCheckin(payload: Record<string, unknown>) {
    startTransition(async () => {
      try {
        const lokasi = await mintaLokasi();
        const res = await fetch("/api/absensi/checkin", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, ...lokasi }),
        });
        const data: HasilCek = await res.json();
        setHasil(data);
        if (!res.ok) {
          toast.error(data.error ?? "Check-in gagal.");
          sudahDikirim.current = false;
        } else if (data.absensi) {
          toast.success(`Hadir — ${data.absensi.mataKuliah}`, {
            description: `Pertemuan ke-${data.absensi.pertemuan} tercatat.`,
          });
        }
      } catch {
        toast.error("Tidak dapat terhubung ke server.");
        sudahDikirim.current = false;
      }
    });
  }

  function submitKode(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(kode)) {
      toast.error("Kode unik harus 6 digit angka.");
      return;
    }
    kirimCheckin({ kodeUnik: kode, sesiId: sisaToken?.sesi });
  }

  if (hasil?.absensi) {
    return (
      <div
        className="flex flex-col items-center rounded-lg border border-success-border bg-success-bg px-6 py-8 text-center"
        role="status"
      >
        <CheckCircle2 className="h-8 w-8 text-success-text" strokeWidth={1.5} aria-hidden />
        <p className="mt-3 text-base font-semibold text-fg">Kehadiran tercatat</p>
        <p className="mt-1 text-sm text-fg-muted">
          {hasil.absensi.mataKuliah} · Pertemuan ke-{hasil.absensi.pertemuan}
        </p>
        <p className="mt-0.5 font-mono-nums text-xs text-fg-subtle">
          Check-in pukul{" "}
          {new Intl.DateTimeFormat("id-ID", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(new Date(hasil.absensi.checkInAt))}
        </p>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          onClick={() => {
            setHasil(null);
            setKode("");
            setSisaToken(null);
          }}
        >
          Absen untuk kelas lain
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Opsi lokasi */}
      <label className="flex cursor-pointer items-start gap-2.5 rounded border border-border bg-surface p-3">
        <input
          type="checkbox"
          checked={gunakanLokasi}
          onChange={(e) => setGunakanLokasi(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer appearance-none rounded border border-border-strong bg-surface checked:border-accent checked:bg-accent [&:checked]:bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%223%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><polyline points=%2220 6 9 17 4 12%22/></svg>')] [&:checked]:bg-[length:12px] [&:checked]:bg-center [&:checked]:bg-no-repeat focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-bg"
        />
        <span>
          <span className="flex items-center gap-1.5 text-sm font-medium text-fg">
            <MapPin className="h-3.5 w-3.5 text-fg-subtle" strokeWidth={1.5} aria-hidden />
            Sertakan lokasi saat absen
          </span>
          <span className="mt-0.5 block text-xs text-fg-muted">
            Aktifkan bila dosen mewajibkan kehadiran di ruang kelas.
          </span>
        </span>
      </label>

      {/* Kode unik */}
      <form onSubmit={submitKode} className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="kode-unik">Kode unik dari dosen</Label>
          <Input
            id="kode-unik"
            inputMode="numeric"
            maxLength={6}
            placeholder="6 digit angka"
            value={kode}
            onChange={(e) => setKode(e.target.value.replace(/\D/g, ""))}
            className="h-11 text-center font-mono-nums text-xl tracking-[0.4em]"
            disabled={loading}
            autoFocus
          />
        </div>
        <div className="flex gap-2">
          <Button type="submit" loading={loading} className="flex-1">
            Absen sekarang
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => setScannerOpen(true)}
            disabled={loading}
          >
            <ScanLine className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Scan QR
          </Button>
        </div>
      </form>

      <Dialog open={scannerOpen} onOpenChange={setScannerOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pindai QR absensi</DialogTitle>
            <DialogDescription>
              Arahkan kamera ke QR yang ditampilkan dosen di layar kelas.
            </DialogDescription>
          </DialogHeader>
          <QrScanner
            onHasil={(t) => {
              setScannerOpen(false);
              const url = new URL(t);
              const sesi = url.searchParams.get("sesi");
              const tok = url.searchParams.get("t");
              if (sesi && tok) {
                kirimCheckin({ token: tok, sesiId: sesi });
              } else {
                toast.error("QR bukan QR absensi yang valid.");
              }
            }}
          />
        </DialogContent>
      </Dialog>

      {sisaToken && !hasil?.absensi && !hasil?.error && (
        <p className="text-xs text-fg-muted">
          <QrCode className="mr-1 inline h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
          Memproses QR yang dipindai...
        </p>
      )}
    </div>
  );
}

/** Kamera scanner berbasis BarcodeDetector / ZXing fallback */
function QrScanner({ onHasil }: { onHasil: (teks: string) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let stop = false;

    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        // BarcodeDetector bila didukung Chrome/Android
        const W = window as unknown as {
          BarcodeDetector?: new (o: { formats: string[] }) => {
            detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
          };
        };
        if (W.BarcodeDetector) {
          const det = new W.BarcodeDetector({ formats: ["qr_code"] });
          const deteksi = async () => {
            if (stop || !videoRef.current) return;
            try {
              const hasil = await det.detect(videoRef.current);
              if (hasil[0]?.rawValue) {
                onHasil(hasil[0].rawValue);
                return;
              }
            } catch {
              /* frame belum siap */
            }
            window.setTimeout(deteksi, 300);
          };
          deteksi();
        } else {
          setErr(
            "Peramban ini belum mendukung pemindai QR bawaan. Gunakan aplikasi kamera ponsel, lalu tempel tautannya — atau minta kode unik 6 digit dari dosen."
          );
        }
      } catch {
        setErr(
          "Kamera tidak dapat diakses. Berikan izin kamera atau gunakan kode unik dari dosen."
        );
      }
    })();

    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [onHasil]);

  return (
    <div className="overflow-hidden rounded-lg border border-border bg-black">
      {err ? (
        <p className="bg-danger-bg p-4 text-sm text-danger-text">{err}</p>
      ) : (
        <video
          ref={videoRef}
          className="aspect-square w-full object-cover"
          playsInline
          muted
        />
      )}
    </div>
  );
}
