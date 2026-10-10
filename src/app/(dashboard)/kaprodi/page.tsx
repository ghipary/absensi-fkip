import { PageHeader, StatCard } from "@/components/shared/page-header";
import { Users, Activity, BarChart3 } from "lucide-react";

export default function KaprodiDashboard() {
  return (
    <>
      <PageHeader judul="Dashboard Prodi" deskripsi="Statistik kehadiran, aktivitas dosen & rekap prodi" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Mahasiswa Prodi" value={0} sub="orang" ikon={<Users className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Dosen Prodi" value={0} sub="orang" ikon={<Users className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Tinjauan Verifikasi" value={0} sub="menunggu" ikon={<Activity className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Rekap" value="–" sub="periode" ikon={<BarChart3 className="h-4.5 w-4.5 text-fg-muted" />} />
      </div>
    </>
  );
}
