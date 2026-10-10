import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Verifikasi Absensi" deskripsi="Setujui/tolak/koreksi absensi kelas" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Daftar absensi menunggu verifikasi.</CardContent>
      </Card>
    </>
  );
}
