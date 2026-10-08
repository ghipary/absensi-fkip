/**
 * Bus notifikasi in-memory untuk SSE (single instance).
 * Listener didaftarkan per-userId sehingga pemberitahuan hanya sampai
 * ke pengguna yang sedang online dan memang menjadi target.
 *
 * Untuk multi-instance (Vercel serverless): ganti implementasi dengan
 * Redis pub/sub tanpa mengubah kontrak pemanggilnya.
 */
type Listener = (data: string) => void;

/** userId → daftar listener SSE milik user tersebut */
const listeners = new Map<string, Set<Listener>>();

export function addListener(userId: string, fn: Listener): () => void {
  const set = listeners.get(userId) ?? new Set<Listener>();
  set.add(fn);
  listeners.set(userId, set);
  return () => {
    set.delete(fn);
    if (set.size === 0) listeners.delete(userId);
  };
}

/**
 * Kirim event ke sekumpulan user. Bila `userIds` tidak diberikan,
 * broadcast ke semua listener (perilaku lama untuk event kecil).
 */
export function broadcastNotifikasi(
  payload: { judul: string; pesan: string; link?: string },
  userIds?: string[]
) {
  const data = JSON.stringify(payload);
  const sasaran =
    userIds && userIds.length > 0
      ? [...new Set(userIds)]
      : [...listeners.keys()];

  for (const uid of sasaran) {
    const set = listeners.get(uid);
    if (!set) continue;
    for (const fn of set) {
      try {
        fn(data);
      } catch {
        set.delete(fn);
      }
    }
  }
}