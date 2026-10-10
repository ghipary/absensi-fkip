import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Kelola Pengguna" deskripsi="Tambah/ubah pengguna per role" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Manajemen pengguna.</CardContent>
      </Card>
    </>
  );
}
