import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Materi Kuliah" deskripsi="Materi per mata kuliah" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Belum ada materi.</CardContent>
      </Card>
    </>
  );
}
