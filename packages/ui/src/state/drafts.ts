/** Encrypted authoring drafts. A draft is scoped to user, API, artifact and tab. */
export interface DraftStorageAdapter {
  get(key: string): Promise<unknown>;
  put(key: string, value: unknown): Promise<void>;
  remove(key: string): Promise<void>;
  encryptionKey(key: string): Promise<CryptoKey>;
}
export interface RecoveredDraft<T> { definition: T; baseVersion: number; savedAt: string; }
interface EncryptedDraft { version: 1; iv: Uint8Array; ciphertext: ArrayBuffer; }

export function encryptedDraftStore<T extends object>(adapter: DraftStorageAdapter, key: string) {
  if (!key) throw new Error('A scoped draft key is required.');
  let queue = Promise.resolve();
  function enqueue(operation: () => Promise<void>) {
    const pending = queue.then(operation);
    queue = pending.catch(() => {});
    return pending;
  }
  return {
    async load(): Promise<RecoveredDraft<T> | null> {
      await queue;
      const stored = await adapter.get(key) as EncryptedDraft | undefined;
      if (!stored) return null;
      if (stored.version !== 1 || !(stored.iv instanceof Uint8Array) || !(stored.ciphertext instanceof ArrayBuffer)) throw new Error('This draft uses an unsupported format.');
      const secret = await adapter.encryptionKey(key);
      const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: stored.iv as Uint8Array<ArrayBuffer>, additionalData: new TextEncoder().encode(key) }, secret, stored.ciphertext);
      const record = JSON.parse(new TextDecoder().decode(decrypted)) as RecoveredDraft<T>;
      if (!record.definition || typeof record.definition !== 'object' || Array.isArray(record.definition) || !Number.isInteger(record.baseVersion) || record.baseVersion < 1 || typeof record.savedAt !== 'string') throw new Error('Draft contents are invalid.');
      return record;
    },
    save(definition: T, baseVersion: number): Promise<void> {
      if (!Number.isInteger(baseVersion) || baseVersion < 1) return Promise.reject(new Error('Drafts need a valid base version.'));
      const plaintext = new TextEncoder().encode(JSON.stringify({ definition, baseVersion, savedAt: new Date().toISOString() }));
      return enqueue(async () => {
        const secret = await adapter.encryptionKey(key);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: new TextEncoder().encode(key) }, secret, plaintext);
        await adapter.put(key, { version: 1, iv, ciphertext } satisfies EncryptedDraft);
      });
    },
    clear(): Promise<void> { return enqueue(() => adapter.remove(key)); },
  };
}

/** IndexedDB stores encrypted payloads and non-extractable Web Crypto keys. */
export async function browserDraftStorage(): Promise<DraftStorageAdapter> {
  if (typeof indexedDB === 'undefined' || !globalThis.crypto?.subtle) throw new Error('Draft recovery needs browser storage and a secure context.');
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('mosaic-studio-drafts', 1);
    request.onupgradeneeded = () => { request.result.createObjectStore('drafts'); request.result.createObjectStore('keys'); };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    request.onblocked = () => reject(new Error('Close an older Studio tab to enable draft storage.'));
  });
  function operation(store: 'drafts' | 'keys', mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(store, mode);
      const request = work(transaction.objectStore(store));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(transaction.error ?? request.error ?? new Error('Draft storage failed.'));
      transaction.onerror = () => reject(transaction.error ?? new Error('Draft storage failed.'));
    });
  }
  const pendingKeys = new Map<string, Promise<CryptoKey>>();
  return {
    get: key => operation('drafts', 'readonly', store => store.get(key)),
    put: async (key, value) => { await operation('drafts', 'readwrite', store => store.put(value, key)); },
    remove: async key => { await operation('drafts', 'readwrite', store => store.delete(key)); },
    encryptionKey(key) {
      let pending = pendingKeys.get(key);
      if (!pending) {
        pending = (async () => {
          const existing = await operation('keys', 'readonly', store => store.get(key));
          if (existing) return existing as CryptoKey;
          const generated = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
          await operation('keys', 'readwrite', store => store.put(generated, key));
          return generated;
        })();
        pendingKeys.set(key, pending);
      }
      return pending;
    },
  };
}
