import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  // Sudah login → ke dashboard
  const user = await getCurrentUser();
  if (user) redirect(`/${user.role}`);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Panel kiri: identitas institusi — bukan gradient, bukan hero landing */}
      <div className="hidden w-[42%] flex-col justify-between border-r border-border bg-surface p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
            <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">SIAKAD Absensi FKIP</p>
            <p className="text-xs text-fg-subtle">Universitas Wahidiyah</p>
          </div>
        </div>

        <div className="max-w-md">
          <p className="text-2xl font-semibold leading-snug text-fg">
            Absensi, tugas, dan nilai —
            <br />
            dalam satu sistem yang akuntabel.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">
            Program Studi Pendidikan Matematika, Fakultas Keguruan dan Ilmu
            Pendidikan. Dirancang untuk transparansi kehadiran dengan QR
            ber-signature, penelusuran perubahan nilai, dan laporan per semester.
          </p>
          <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-border pt-6">
            {[
              ["16", "Pertemuan / semester"],
              ["75%", "Syarat kehadiran"],
              ["3", "Peran pengguna"],
            ].map(([v, l]) => (
              <div key={l}>
                <dt className="font-mono-nums text-xl font-semibold text-fg">
                  {v}
                </dt>
                <dd className="mt-0.5 text-xs text-fg-muted">{l}</dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="text-xs text-fg-subtle">
          © {new Date().getFullYear()} Universitas Wahidiyah · FKIP
        </p>
      </div>

      {/* Panel kanan: formulir */}
      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-[58%]">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
                <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} aria-hidden />
              </div>
              <div>
                <p className="text-sm font-semibold text-fg">SIAKAD Absensi FKIP</p>
                <p className="text-xs text-fg-subtle">Universitas Wahidiyah</p>
              </div>
            </div>
          </div>

          <h1 className="text-xl font-semibold text-fg">Masuk ke akun Anda</h1>
          <p className="mt-1 text-sm text-fg-muted">
            Gunakan email kampus yang terdaftar di prodi.
          </p>

          <div className="mt-6">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>

          <p className="mt-8 border-t border-border pt-5 text-xs leading-relaxed text-fg-subtle">
            Belum memiliki akun? Akun dibuat oleh operator prodi saat Anda
            terdaftar sebagai mahasiswa atau dosen. Hubungi bagian akademik
            FKIP Universitas Wahidiyah.
          </p>
        </div>
      </div>
    </div>
  );
}
