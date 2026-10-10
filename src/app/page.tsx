import Link from "next/link";
import { GraduationCap, Users, QrCode, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-bg">
      <header className="sticky top-0 z-20 border-b border-border bg-bg/85 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
              <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} />
            </div>
            <span className="text-sm font-semibold">SIAKAD Universitas Wahidiyah</span>
          </div>
          <Button asChild size="sm">
            <Link href="/login">Login dengan Akun Kampus</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-[1400px] px-4 py-10 lg:px-6 lg:py-16">
        <div className="grid gap-6 lg:grid-cols-2 lg:items-center">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-fg lg:text-4xl">
              Portal Absensi & Kegiatan Perkuliahan
            </h1>
            <p className="mt-3 max-w-xl text-base text-fg-muted">
              SIAKAD Universitas Wahidiyah mempermudah mahasiswa melihat jadwal, materi, dan absensi; dosen membagikan materi & verifikasi kehadiran; kaprodi & admin memantau secara terpusat.
            </p>
            <div className="mt-5 flex gap-3">
              <Button asChild size="lg">
                <Link href="/login">Login dengan Akun Kampus</Link>
              </Button>
            </div>
          </div>
          <Card className="overflow-hidden">
            <CardContent className="p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                  <QrCode className="mt-0.5 h-5 w-5 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-semibold text-fg">Absensi QR</p>
                    <p className="mt-0.5 text-sm text-fg-muted">Cek kehadiran cepat & terverifikasi</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                  <Users className="mt-0.5 h-5 w-5 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-semibold text-fg">4 Role Akses</p>
                    <p className="mt-0.5 text-sm text-fg-muted">Mahasiswa, Dosen, Kaprodi, Admin</p>
                  </div>
                </div>
                <div className="flex items-start gap-3 rounded-lg border border-border bg-surface p-4">
                  <BarChart3 className="mt-0.5 h-5 w-5 text-accent" strokeWidth={1.5} />
                  <div>
                    <p className="text-sm font-semibold text-fg">Rekap Prodi</p>
                    <p className="mt-0.5 text-sm text-fg-muted">Monitoring & laporan kehadiran</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
