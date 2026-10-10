import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function mulaiBulan(t: Date) { return new Date(t.getFullYear(), t.getMonth(), 1); }
function awalHari(t: Date) { const d=new Date(t); d.setHours(0,0,0,0); return d; }

export async function tulisLog(user: string, aksi: string) {
  try {
    await prisma.logAktivitas.create({ data: { user, aksi } });
  } catch {}
}
