"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/states";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      pesan={error.message || "Terjadi kesalahan tak terduga."}
      detail={error.digest}
      onRetry={() => reset()}
    />
  );
}
