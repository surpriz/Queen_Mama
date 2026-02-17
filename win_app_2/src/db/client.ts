/**
 * Database client for renderer process
 *
 * This module provides async access to the SQLite database via IPC.
 * The actual database runs in the main process.
 */

export interface QueryResult {
  rows: unknown[]
  changes?: number
  lastInsertRowid?: number | bigint
}

// Type-safe database API
export const db = {
  /**
   * Execute a SQL query and return all results
   */
  async query(sql: string, params: unknown[] = []): Promise<QueryResult> {
    return window.electronAPI.db.query(sql, params)
  },

  /**
   * Execute a SQL query and return the first result
   */
  async queryGet<T = unknown>(sql: string, params: unknown[] = []): Promise<T | undefined> {
    return window.electronAPI.db.queryGet(sql, params) as Promise<T | undefined>
  },

  /**
   * Execute a SQL query and return all results as an array
   */
  async queryAll<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return window.electronAPI.db.queryAll(sql, params) as Promise<T[]>
  },

  /**
   * Insert a record into a table
   */
  async insert(table: string, data: Record<string, unknown>): Promise<QueryResult> {
    return window.electronAPI.db.insert(table, data)
  },

  /**
   * Update records in a table
   */
  async update(
    table: string,
    data: Record<string, unknown>,
    where: string,
    whereParams: unknown[] = []
  ): Promise<QueryResult> {
    return window.electronAPI.db.update(table, data, where, whereParams)
  },

  /**
   * Delete records from a table
   */
  async delete(table: string, where: string, whereParams: unknown[] = []): Promise<QueryResult> {
    return window.electronAPI.db.delete(table, where, whereParams)
  },

  /**
   * Force a WAL checkpoint to flush all pending writes to disk
   */
  async walCheckpoint(): Promise<void> {
    await window.electronAPI.db.walCheckpoint()
  },
}

// Accessor function for sessionDb and other consumers
export function getDb() {
  return db
}

// Legacy exports for compatibility with existing code that imports initializeDatabase
export async function initializeDatabase(_userDataPath?: string): Promise<void> {
  // Database is now initialized in main process, this is a no-op
  console.log('[DB Client] Database initialized in main process')
}

export function closeDatabase(): void {
  // Database is closed in main process
}

// Re-export schema for type definitions
export * from './schema'
