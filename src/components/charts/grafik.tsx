"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

/**
 * Grafik kehadiran per mata kuliah — gaya Linear:
 * grid tipis, satu warna aksen, tanpa gradient, tooltip minimal.
 * Batas 75% digambar sebagai garis referensi.
 */

type Baris = { nama: string; persen: number; memenuhi: boolean };

function TooltipKustom({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload: Baris }[];
}) {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded border border-border bg-surface px-2.5 py-1.5 shadow-popover">
      <p className="text-xs font-medium text-fg">{d.nama}</p>
      <p className="font-mono-nums text-xs text-fg-muted">
        {d.persen}% {d.memenuhi ? "· memenuhi" : "· di bawah 75%"}
      </p>
    </div>
  );
}

export function GrafikKehadiran({ data }: { data: Baris[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          margin={{ top: 8, right: 8, left: -16, bottom: 0 }}
          barCategoryGap="28%"
        >
          <CartesianGrid
            stroke="var(--border)"
            strokeDasharray="0"
            vertical={false}
          />
          <XAxis
            dataKey="nama"
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
            interval={0}
            tickFormatter={(v: string) =>
              v.length > 12 ? v.slice(0, 11) + "…" : v
            }
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip content={<TooltipKustom />} cursor={{ fill: "var(--surface-muted)" }} />
          <Bar dataKey="persen" radius={[3, 3, 0, 0]} maxBarSize={36}>
            {data.map((d) => (
              <Cell
                key={d.nama}
                fill={d.memenuhi ? "var(--accent)" : "var(--warning)"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Distribusi = { grade: string; jumlah: number };

/** Distribusi nilai A–E untuk dashboard kaprodi */
export function GrafikDistribusiNilai({ data }: { data: Distribusi[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="grade"
            tick={{ fill: "var(--fg-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--shadow-popover)",
            }}
            labelStyle={{ color: "var(--fg)", fontWeight: 600 }}
            itemStyle={{ color: "var(--fg-muted)" }}
          />
          <Bar
            dataKey="jumlah"
            fill="var(--accent)"
            radius={[3, 3, 0, 0]}
            maxBarSize={44}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

type Deret = { periode: string; persen: number };

/** Tren kehadiran prodi per bulan (line area tipis) */
export function GrafikTrenKehadiran({ data }: { data: Deret[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <CartesianGrid stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="periode"
            tick={{ fill: "var(--fg-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            domain={[0, 100]}
            ticks={[0, 25, 50, 75, 100]}
            tick={{ fill: "var(--fg-subtle)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => `${v}%`}
          />
          <Tooltip
            cursor={{ fill: "var(--surface-muted)" }}
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
              boxShadow: "var(--shadow-popover)",
            }}
            labelStyle={{ color: "var(--fg)", fontWeight: 600 }}
            itemStyle={{ color: "var(--fg-muted)" }}
            formatter={(v: number | string) => [`${v}%`, "Kehadiran"]}
          />
          <Bar dataKey="persen" fill="var(--accent)" radius={[3, 3, 0, 0]} maxBarSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
