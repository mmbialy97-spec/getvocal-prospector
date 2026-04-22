"use client";

import { openDB, DBSchema, IDBPDatabase } from "idb";

// ─── Types ────────────────────────────────────────────────────────────────
export type StoredContact = {
  id: string; // uuid generated client-side
  run_id: string;
  created_at: string;

  // Input
  first_name: string;
  last_name: string;
  company_name: string;
  website: string;
  title: string;
  linkedin_url: string;

  // Status
  status: "pending" | "processing" | "done" | "skipped" | "error";
  error_message?: string;

  // Stage outputs
  stage1?: any;
  stage2?: any;
  email?: any;
  linkedin?: any;
  coldcall?: any;

  // Metadata
  processed_at?: string;
  processing_time_ms?: number;
};

export type StoredRun = {
  id: string;
  name: string;
  created_at: string;
  total_contacts: number;
  status: "pending" | "running" | "complete" | "error";
};

// ─── Schema ───────────────────────────────────────────────────────────────
interface ProspectorDB extends DBSchema {
  runs: {
    key: string;
    value: StoredRun;
    indexes: { "by-created": string };
  };
  contacts: {
    key: string;
    value: StoredContact;
    indexes: { "by-run": string };
  };
}

let dbPromise: Promise<IDBPDatabase<ProspectorDB>> | null = null;

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB<ProspectorDB>("getvocal-prospector", 1, {
      upgrade(db) {
        const runStore = db.createObjectStore("runs", { keyPath: "id" });
        runStore.createIndex("by-created", "created_at");

        const contactStore = db.createObjectStore("contacts", {
          keyPath: "id",
        });
        contactStore.createIndex("by-run", "run_id");
      },
    });
  }
  return dbPromise;
}

// ─── UUID helper (no external deps) ───────────────────────────────────────
export function uuid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  // Fallback for older browsers
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ─── Runs ─────────────────────────────────────────────────────────────────
export async function createRun(
  name: string,
  totalContacts: number
): Promise<StoredRun> {
  const db = await getDB();
  const run: StoredRun = {
    id: uuid(),
    name,
    created_at: new Date().toISOString(),
    total_contacts: totalContacts,
    status: "running",
  };
  await db.put("runs", run);
  return run;
}

export async function updateRunStatus(
  runId: string,
  status: StoredRun["status"]
): Promise<void> {
  const db = await getDB();
  const run = await db.get("runs", runId);
  if (run) {
    run.status = status;
    await db.put("runs", run);
  }
}

export async function listRuns(): Promise<StoredRun[]> {
  const db = await getDB();
  const all = await db.getAllFromIndex("runs", "by-created");
  return all.reverse(); // most recent first
}

export async function deleteRun(runId: string): Promise<void> {
  const db = await getDB();
  const tx = db.transaction(["runs", "contacts"], "readwrite");

  await tx.objectStore("runs").delete(runId);

  const contacts = await tx
    .objectStore("contacts")
    .index("by-run")
    .getAllKeys(runId);
  for (const key of contacts) {
    await tx.objectStore("contacts").delete(key);
  }

  await tx.done;
}

// ─── Contacts ─────────────────────────────────────────────────────────────
export async function addContacts(
  runId: string,
  contactInputs: Array<{
    first_name: string;
    last_name: string;
    company_name: string;
    website: string;
    title: string;
    linkedin_url: string;
  }>
): Promise<StoredContact[]> {
  const db = await getDB();
  const contacts: StoredContact[] = contactInputs.map((c) => ({
    id: uuid(),
    run_id: runId,
    created_at: new Date().toISOString(),
    ...c,
    status: "pending",
  }));

  const tx = db.transaction("contacts", "readwrite");
  for (const c of contacts) {
    await tx.store.put(c);
  }
  await tx.done;

  return contacts;
}

export async function updateContact(
  contactId: string,
  patch: Partial<StoredContact>
): Promise<void> {
  const db = await getDB();
  const existing = await db.get("contacts", contactId);
  if (existing) {
    await db.put("contacts", { ...existing, ...patch });
  }
}

export async function getContactsForRun(
  runId: string
): Promise<StoredContact[]> {
  const db = await getDB();
  return db.getAllFromIndex("contacts", "by-run", runId);
}
