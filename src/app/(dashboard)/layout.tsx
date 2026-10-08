import { redirect } from "next/navigation";
import { getCurrentUser, ambilNama } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LABEL_ROLE } from "@/lib/rbac";
import { DashboardShell } from "@/components/layout/dashboard-shell";

/**
 * Layout induk untuk /mahasiswa, /dosen, /kaprodi.
 * Middleware sudah melakukan filter role; ini double-check + data user.
 * Breadcrumb dihitung dari pathname di sisi client.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const nama = await ambilNama({ id: user.userId, role: user.role });

  // Sublabel sidebar: NIM untuk mahasiswa, NIP untuk dosen
  let sublabel = LABEL_ROLE[user.role];
  if (user.role === "mahasiswa") {
    const m = await prisma.mahasiswa.findUnique({
      where: { userId: user.userId },
      select: { nim: true },
    });
    if (m) sublabel = `NIM ${m.nim}`;
  } else {
    const d = await prisma.dosen.findUnique({
      where: { userId: user.userId },
      select: { nip: true },
    });
    if (d) sublabel = `NIP ${d.nip}`;
  }

  return (
    <DashboardShell role={user.role} nama={nama} sublabel={sublabel}>
      {children}
    </DashboardShell>
  );
}
