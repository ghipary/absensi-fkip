import { PageHeader, StatCard } from "@/components/shared/page-header";
import { CalendarDays, BookOpen, QrCode } from "lucide-react";

export default function Page() {
  return (
    <>
      <PageHeader judul="Dashboard Mahasiswa" deskripsi="Ringkasan jadwal hari ini, materi, dan status absensi" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Jadwal Hari Ini" value={0} sub="kelas" ikon={<CalendarDays className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Materi Tersedia" value={0} sub="item" ikon={<BookOpen className="h-4.5 w-4.5 text-fg-muted" />} />
        <StatCard label="Kehadiran" value="0%" sub="rekap" ikon={<QrCode className="h-4.5 w-4.5 text-fg-muted" />} />
      </div>
    </>
  );
}
