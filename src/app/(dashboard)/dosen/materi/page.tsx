import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Kelola Materi" deskripsi="Upload/hapus materi per jadwal" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Kelola materi kelas Anda.</CardContent>
      </Card>
    </>
  );
}
