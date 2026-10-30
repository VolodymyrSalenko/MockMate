// Interview recordings are kept in this browser (IndexedDB), keyed by session id.
// They never leave the device; a session opened elsewhere simply has no video.

const DB_NAME = 'mockmate'
const STORE   = 'recordings'

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror   = () => reject(req.error)
  })
}

async function run(mode, action) {
  const db = await openDB()
  try {
    return await new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, mode)
      const req = action(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req.result)
      tx.onerror    = () => reject(tx.error)
      tx.onabort    = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

export async function saveRecording(sessionId, blob) {
  try { await run('readwrite', store => store.put(blob, String(sessionId))) } catch { /* storage full or blocked */ }
}

export async function getRecording(sessionId) {
  try { return (await run('readonly', store => store.get(String(sessionId)))) || null } catch { return null }
}

export async function deleteRecording(sessionId) {
  try { await run('readwrite', store => store.delete(String(sessionId))) } catch { /* nothing to delete */ }
}
