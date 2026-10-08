import { prisma } from "./prisma";
import type { AksiAudit } from "@prisma/client";

type Input = {
  userId?: string | null;
  aksi: AksiAudit;
  entityType: string;
  entityId?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * Tulis satu baris audit log. Dipanggil dari semua aksi CRUD penting.
 * Gagal menulis log TIDAK boleh menjatuhkan request utama.
 */
export async function catatAudit(input: Input) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        aksi: input.aksi,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        oldValue: input.oldValue !== undefined ? (input.oldValue as object) : undefined,
        newValue: input.newValue !== undefined ? (input.newValue as object) : undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (e) {
    console.error("[audit] gagal menulis log:", e);
  }
}
