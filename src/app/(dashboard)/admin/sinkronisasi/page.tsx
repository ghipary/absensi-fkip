import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";

export default function Page() {
  return (
    <>
      <PageHeader judul="Sinkronisasi Data" deskripsi="Sinkronisasi data master dari Web A (read-only)" />
      <Card>
        <CardContent className="p-6 text-sm text-fg-muted">Mode saat ini: {process.env.DATA_SOURCE || 'mock'}</CardContent>
      </Card>
    </>
  );
}
