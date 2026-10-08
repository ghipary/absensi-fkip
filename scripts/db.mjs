/**
 * Database portable untuk development tanpa instalasi PostgreSQL.
 * Produksi tetap pakai DATABASE_URL standar (Neon/Vercel Postgres).
 *
 *   node scripts/db.mjs up    — start embedded PostgreSQL (port 5433)
 *   node scripts/db.mjs down  — stop
 */
import EmbeddedPostgres from "embedded-postgres";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

const pg = new EmbeddedPostgres({
  databaseDir: path.join(root, "data", "pgdata"),
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

const cmd = process.argv[2] ?? "up";

try {
  if (cmd === "up") {
    try {
      await pg.start();
      console.log("✓ Embedded PostgreSQL berjalan di port 5433");
    } catch {
      // belum pernah diinisialisasi
      await pg.initialise();
      await pg.start();
      console.log("✓ Embedded PostgreSQL diinisialisasi & berjalan di port 5433");
    }
    try {
      await pg.createDatabase("absensi_fkip");
      console.log("✓ Database 'absensi_fkip' siap");
    } catch {
      console.log("· Database 'absensi_fkip' sudah ada");
    }
  } else if (cmd === "down") {
    await pg.stop();
    console.log("✓ PostgreSQL dihentikan");
  } else {
    console.error("Pakai: node scripts/db.mjs up|down");
    process.exit(1);
  }
} catch (e) {
  console.error("Gagal:", e.message);
  process.exit(1);
}
