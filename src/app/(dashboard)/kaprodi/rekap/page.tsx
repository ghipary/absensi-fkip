import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Rekap & Laporan" deskripsi="Rekap absensi prodi + export" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Rekap akan ditampilkan di sini.</CardContent>
      </Card>
    </>
  );
}
