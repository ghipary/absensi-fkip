import { PageHeader, StatCard } from "@/components/shared/page-header";
import { UsersRound, Database, RefreshCw } from "lucide-react";

export default function AdminDashboard() {
  return (
    <>
      <PageHeader judul="Dashboard Admin" deskripsi="Pengguna, data akademik & sinkronisasi" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Pengguna" value={0} sub="total" ikon={<UsersRound className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Data Akademik" value={0} sub="entitas" ikon={<Database className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Sinkronisasi" value="–" sub="status" ikon={<RefreshCw className="h-4.5 w-4.5 text-fg-muted" />} />
      </div>
    </>
  );
}
