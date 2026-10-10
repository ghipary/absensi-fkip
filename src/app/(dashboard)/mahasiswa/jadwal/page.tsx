import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Jadwal Kuliah" deskripsi="Jadwal per hari/minggu" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Belum ada data jadwal.</CardContent>
      </Card>
    </>
  );
}
