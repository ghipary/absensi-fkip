import { PageSkeleton } from "@/components/ui/page-skeleton";

export default function Loading() {
  return <PageSkeleton kartu={4} baris={8} kolom={5} />;
}
