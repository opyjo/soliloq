import type { AudioAttachment } from "@/lib/types";

const DATABASE_NAME = "still-audio";
const DATABASE_VERSION = 1;
const STORE_NAME = "voice-memos";

type StoredAudioAttachment = {
  key: string;
  id: string;
  userId: string;
  thoughtId: string;
  blob: Blob;
  durationSeconds: number;
  createdAt: string;
};

function attachmentKey(userId: string, thoughtId: string, id: string) {
  return `${userId}:${thoughtId}:${id}`;
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: "key" });
        store.createIndex("thought", ["userId", "thoughtId"], {
          unique: false,
        });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("Could not open voice memo storage."));
  });
}

function runTransaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(STORE_NAME, mode);
        const request = operation(transaction.objectStore(STORE_NAME));
        let result!: T;

        request.onsuccess = () => {
          result = request.result;
        };
        request.onerror = () =>
          reject(request.error ?? new Error("Voice memo storage failed."));
        transaction.oncomplete = () => {
          database.close();
          resolve(result);
        };
        transaction.onerror = () => {
          database.close();
          reject(
            transaction.error ?? new Error("Voice memo storage failed."),
          );
        };
      }),
  );
}

export async function loadAudioAttachments(
  userId: string,
  thoughtId: string,
): Promise<AudioAttachment[]> {
  if (!("indexedDB" in window)) return [];

  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readonly");
    const index = transaction.objectStore(STORE_NAME).index("thought");
    const request = index.getAll(IDBKeyRange.only([userId, thoughtId]));

    request.onsuccess = () => {
      const records = request.result as StoredAudioAttachment[];
      resolve(
        records
          .toSorted((a, b) => b.createdAt.localeCompare(a.createdAt))
          .map((record) => ({
            id: record.id,
            url: URL.createObjectURL(record.blob),
            blob: record.blob,
            durationSeconds: record.durationSeconds,
            createdAt: record.createdAt,
          })),
      );
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not load voice memos."));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not load voice memos."));
    };
  });
}

export async function saveAudioAttachment(
  userId: string,
  thoughtId: string,
  attachment: AudioAttachment,
) {
  if (!("indexedDB" in window)) {
    throw new Error("This browser does not support durable voice memo storage.");
  }
  if (!attachment.blob) {
    throw new Error("The voice memo has no audio data.");
  }

  const record: StoredAudioAttachment = {
    key: attachmentKey(userId, thoughtId, attachment.id),
    id: attachment.id,
    userId,
    thoughtId,
    blob: attachment.blob,
    durationSeconds: attachment.durationSeconds,
    createdAt: attachment.createdAt,
  };

  await runTransaction("readwrite", (store) => store.put(record));
}

export async function removeAudioAttachment(
  userId: string,
  thoughtId: string,
  id: string,
) {
  if (!("indexedDB" in window)) return;
  await runTransaction("readwrite", (store) =>
    store.delete(attachmentKey(userId, thoughtId, id)),
  );
}

export async function removeThoughtAudioAttachments(
  userId: string,
  thoughtId: string,
) {
  if (!("indexedDB" in window)) return;

  const database = await openDatabase();

  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const index = transaction.objectStore(STORE_NAME).index("thought");
    const request = index.openKeyCursor(
      IDBKeyRange.only([userId, thoughtId]),
    );

    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) return;
      transaction.objectStore(STORE_NAME).delete(cursor.primaryKey);
      cursor.continue();
    };
    request.onerror = () =>
      reject(request.error ?? new Error("Could not remove voice memos."));
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error ?? new Error("Could not remove voice memos."));
    };
  });
}
