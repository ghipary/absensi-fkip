import { PageHeader, StatCard } from "@/components/shared/page-header";
import { BookOpen, ClipboardCheck, CalendarDays } from "lucide-react";

export default function DosenDashboard() {
  return (
    <>
      <PageHeader judul="Dashboard Dosen" deskripsi="Kelas hari ini, materi, dan verifikasi absensi" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Kelas Hari Ini" value={0} sub="kelas" ikon={<CalendarDays className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Materi Dibagikan" value={0} sub="item" ikon={<BookOpen className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Menunggu Verifikasi" value={0} sub="absensi" ikon={<ClipboardCheck className="h-4.5 w-4.5 text-fg-muted" />} />
      </div>
    </>
  );
}
