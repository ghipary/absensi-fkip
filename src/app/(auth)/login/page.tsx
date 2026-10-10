import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";
import { GraduationCap } from "lucide-react";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(`/${user.role}`);

  return (
    <div className="flex min-h-screen bg-bg">
      <div className="relative hidden w-[42%] flex-col justify-between overflow-hidden border-r border-border bg-surface-gradient p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded bg-accent text-accent-fg">
            <GraduationCap className="h-4.5 w-4.5" strokeWidth={1.5} />
          </div>
          <div>
            <p className="text-sm font-semibold text-fg">SIAKAD Universitas Wahidiyah</p>
            <p className="text-xs text-fg-subtle">Portal Absensi & Kegiatan Perkuliahan</p>
          </div>
        </div>
        <div className="max-w-md">
          <p className="text-2xl font-semibold leading-snug text-fg">Absensi, materi, dan rekap dalam satu portal</p>
          <p className="mt-3 text-sm leading-relaxed text-fg-muted">Mahasiswa • Dosen • Kaprodi • Admin — terintegrasi & mudah digunakan.</p>
        </div>
        <p className="text-xs text-fg-subtle">© {new Date().getFullYear()} Universitas Wahidiyah</p>
      </div>

      <div className="flex w-full items-center justify-center px-6 py-12 lg:w-[58%]">
        <div className="w-full max-w-sm">
          <h1 className="text-xl font-semibold text-fg">Masuk ke akun Anda</h1>
          <p className="mt-1 text-sm text-fg-muted">Gunakan akun kampus Anda.</p>
          <div className="mt-6">
            <Suspense fallback={null}>
              <LoginForm />
            </Suspense>
          </div>
        </div>
      </div>
    </div>
  );
}
