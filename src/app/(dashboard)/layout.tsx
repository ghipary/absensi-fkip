import { redirect } from "next/navigation";
import { getCurrentUser, ambilNama } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LABEL_ROLE } from "@/lib/rbac";
import { DashboardShell } from "@/components/layout/dashboard-shell";
import type { Role } from "@/lib/konstanta";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nama = await ambilNama({ id: user.sub, role: user.role as Role });

  let sublabel = LABEL_ROLE[user.role as Role];
  if (user.role === "mahasiswa") {
    const m = await prisma.mahasiswa.findUnique({ where: { nim: user.sub }, select: { nim: true } });
    if (m) sublabel = `NIM ${m.nim}`;
  } else if (user.role === "dosen" || user.role === "kaprodi") {
    const d = await prisma.dosen.findUnique({ where: { nidn: user.sub }, select: { nidn: true } });
    if (d) sublabel = `NIDN ${d.nidn}`;
  }

  return (
    <DashboardShell role={user.role as Role} nama={nama} sublabel={sublabel}>
      {children}
    </DashboardShell>
  );
}
