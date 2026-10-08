"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GraduationCap, Eye, EyeOff, Lock, Mail } from "lucide-react";

/** Akun demo untuk pengembangan — tidak tampil di produksi. */
const DEMO = [
  { label: "Kaprodi", email: "kaprodi@wahidiyah.ac.id" },
  { label: "Dosen", email: "muhammad.fauzi@wahidiyah.ac.id" },
  { label: "Mahasiswa", email: "mahasiswa1@wahidiyah.ac.id" },
];

export function LoginForm() {
  const router = useRouter();
  const search = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [lihat, setLihat] = useState(false);
  const [loading, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error ?? "Gagal masuk. Coba lagi.");
          return;
        }
        const dari = search.get("dari");
        const tujuan =
          dari && dari.startsWith("/") && !dari.startsWith("//")
            ? dari
            : data.tujuan;
        toast.success("Berhasil masuk.", {
          description: `Selamat datang di SIAKAD Absensi FKIP.`,
        });
        router.push(tujuan);
        router.refresh();
      } catch {
        setError("Tidak dapat terhubung ke server. Periksa koneksi Anda.");
      }
    });
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email kampus</Label>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          required
          placeholder="nama@wahidiyah.ac.id"
          icon={<Mail className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={loading}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between">
          <Label htmlFor="password">Kata sandi</Label>
          <button
            type="button"
            onClick={() => setLihat((v) => !v)}
            className="flex items-center gap-1 text-xs text-fg-subtle transition-colors hover:text-fg-muted"
            aria-label={lihat ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {lihat ? (
              <EyeOff className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            )}
            {lihat ? "Sembunyikan" : "Tampilkan"}
          </button>
        </div>
        <Input
          id="password"
          type={lihat ? "text" : "password"}
          autoComplete="current-password"
          required
          placeholder="••••••••"
          icon={<Lock className="h-4 w-4" strokeWidth={1.5} aria-hidden />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          disabled={loading}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="rounded border border-danger-border bg-danger-bg px-3 py-2 text-sm text-danger-text"
        >
          {error}
        </p>
      )}

      <Button type="submit" loading={loading} className="mt-1 w-full" size="lg">
        Masuk
      </Button>

      {/* Akun demo — hanya di development */}
      {process.env.NODE_ENV !== "production" && (
        <div className="mt-2 rounded border border-border bg-surface-muted px-3 py-2.5">
          <p className="text-2xs font-semibold uppercase tracking-wider text-fg-subtle">
            Akun demo — kata sandi: password123
          </p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DEMO.map((d) => (
              <button
                key={d.email}
                type="button"
                onClick={() => {
                  setEmail(d.email);
                  setPassword("password123");
                }}
                className="rounded-pill border border-border bg-surface px-2 py-0.5 text-2xs text-fg-muted transition-colors hover:border-accent-border hover:text-accent"
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
