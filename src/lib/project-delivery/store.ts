/**
 * Durable project storage (Build 2). Same adapter pattern as
 * `src/lib/lead/storage.ts`: the Supabase/PostgREST implementation when
 * `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` are configured (server-only
 * secret), otherwise an in-process store that is honest about not being
 * durable (`durable: false`). Plain `fetch`, no client SDK.
 * Schema: supabase/migrations/0003_create_projects_table.sql.
 */

export interface StoredProjectRow {
  publicRef: string;
  projectId: string;
  snapshotVersion: number;
  snapshot: unknown;
  createdAt: string;
  updatedAt: string;
}

export interface NewProjectRow {
  publicRef: string;
  projectId: string;
  editTokenHash: string;
  snapshotVersion: number;
  snapshot: unknown;
}

export interface ProjectStore {
  readonly kind: "supabase" | "memory";
  readonly durable: boolean;
  /** Inserts a new project. Returns false only on a public_ref collision. */
  insert(row: NewProjectRow): Promise<boolean>;
  /** Updates the snapshot only when `editTokenHash` matches the row's owner
   * hash -- the ownership check is part of the same atomic statement.
   * Returns the updated row, or null when the ref/token pair does not match. */
  update(
    publicRef: string,
    editTokenHash: string,
    snapshotVersion: number,
    snapshot: unknown,
  ): Promise<StoredProjectRow | null>;
  /** Read access by public reference, only while sharing is enabled. */
  getShared(publicRef: string): Promise<StoredProjectRow | null>;
}

export class ProjectStorageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectStorageError";
  }
}

function getServerEnv(name: string): string | undefined {
  const value = typeof process !== "undefined" ? process.env[name] : undefined;
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

const SELECT = "public_ref,project_id,snapshot_version,snapshot,created_at,updated_at";

interface RowJson {
  public_ref: string;
  project_id: string;
  snapshot_version: number;
  snapshot: unknown;
  created_at: string;
  updated_at: string;
}

const fromJson = (row: RowJson): StoredProjectRow => ({
  publicRef: row.public_ref,
  projectId: row.project_id,
  snapshotVersion: row.snapshot_version,
  snapshot: row.snapshot,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

export class SupabaseProjectStore implements ProjectStore {
  readonly kind = "supabase" as const;
  readonly durable = true;
  constructor(
    private readonly url: string,
    private readonly serviceRoleKey: string,
  ) {}

  private endpoint(query = "") {
    return `${this.url.replace(/\/+$/, "")}/rest/v1/projects${query}`;
  }

  private headers(prefer?: string): Record<string, string> {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(prefer ? { Prefer: prefer } : {}),
    };
  }

  async insert(row: NewProjectRow): Promise<boolean> {
    const response = await fetch(this.endpoint(), {
      method: "POST",
      headers: this.headers("return=minimal"),
      body: JSON.stringify({
        public_ref: row.publicRef,
        project_id: row.projectId,
        edit_token_hash: row.editTokenHash,
        snapshot_version: row.snapshotVersion,
        snapshot: row.snapshot,
      }),
    });
    if (response.status === 409) return false;
    if (!response.ok) {
      throw new ProjectStorageError(`Project insert failed (${response.status}).`);
    }
    return true;
  }

  async update(
    publicRef: string,
    editTokenHash: string,
    snapshotVersion: number,
    snapshot: unknown,
  ): Promise<StoredProjectRow | null> {
    const query = `?public_ref=eq.${encodeURIComponent(publicRef)}&edit_token_hash=eq.${editTokenHash}&select=${SELECT}`;
    const response = await fetch(this.endpoint(query), {
      method: "PATCH",
      headers: this.headers("return=representation"),
      body: JSON.stringify({ snapshot_version: snapshotVersion, snapshot }),
    });
    if (!response.ok) throw new ProjectStorageError(`Project update failed (${response.status}).`);
    const rows = (await response.json()) as RowJson[];
    return rows[0] ? fromJson(rows[0]) : null;
  }

  async getShared(publicRef: string): Promise<StoredProjectRow | null> {
    const query = `?public_ref=eq.${encodeURIComponent(publicRef)}&share_enabled=is.true&select=${SELECT}`;
    const response = await fetch(this.endpoint(query), { headers: this.headers() });
    if (!response.ok) throw new ProjectStorageError(`Project read failed (${response.status}).`);
    const rows = (await response.json()) as RowJson[];
    return rows[0] ? fromJson(rows[0]) : null;
  }
}

/** Process-local fallback: same contract, `durable: false`. Nothing here
 * survives an isolate recycle; the UI says so instead of faking a save. */
export class MemoryProjectStore implements ProjectStore {
  readonly kind = "memory" as const;
  readonly durable = false;
  private rows = new Map<string, StoredProjectRow & { editTokenHash: string }>();

  insert(row: NewProjectRow): Promise<boolean> {
    if (this.rows.has(row.publicRef)) return Promise.resolve(false);
    const now = new Date().toISOString();
    this.rows.set(row.publicRef, {
      publicRef: row.publicRef,
      projectId: row.projectId,
      editTokenHash: row.editTokenHash,
      snapshotVersion: row.snapshotVersion,
      snapshot: structuredClone(row.snapshot),
      createdAt: now,
      updatedAt: now,
    });
    return Promise.resolve(true);
  }

  update(
    publicRef: string,
    editTokenHash: string,
    snapshotVersion: number,
    snapshot: unknown,
  ): Promise<StoredProjectRow | null> {
    const row = this.rows.get(publicRef);
    if (!row || row.editTokenHash !== editTokenHash) return Promise.resolve(null);
    row.snapshotVersion = snapshotVersion;
    row.snapshot = structuredClone(snapshot);
    row.updatedAt = new Date().toISOString();
    const { editTokenHash: _hash, ...visible } = row;
    return Promise.resolve(structuredClone(visible));
  }

  getShared(publicRef: string): Promise<StoredProjectRow | null> {
    const row = this.rows.get(publicRef);
    if (!row) return Promise.resolve(null);
    const { editTokenHash: _hash, ...visible } = row;
    return Promise.resolve(structuredClone(visible));
  }
}

const memoryStore = new MemoryProjectStore();

export function getProjectStore(): ProjectStore {
  const url = getServerEnv("SUPABASE_URL");
  const serviceRoleKey = getServerEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (url && serviceRoleKey) return new SupabaseProjectStore(url, serviceRoleKey);
  return memoryStore;
}
