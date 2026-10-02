import type { Library } from './chess';
async function database() {
  return new Promise<IDBDatabase>((resolve,reject) => {
    const request = indexedDB.open('opening-lines', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('library');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function readLibrary(): Promise<Library | null> {
  const db = await database();
  return new Promise((resolve,reject) => {
    const tx = db.transaction('library', 'readonly');
    const request = tx.objectStore('library').get('current');
    tx.oncomplete = () => {db.close(); resolve(request.result ?? null);};
    tx.onerror = () => {db.close(); reject(tx.error);};
  });
}
export async function saveLibrary(library: Library | null) {
  const db = await database();
  return new Promise<void>((resolve,reject) => {
    const tx = db.transaction('library', 'readwrite');
    if (library) tx.objectStore('library').put(library, 'current'); else tx.objectStore('library').delete('current');
    tx.oncomplete = () => {db.close(); resolve();};
    tx.onerror = () => {db.close(); reject(tx.error);};
    tx.onabort = () => {db.close(); reject(tx.error ?? new Error('Storage was interrupted.'));};
  });
}
