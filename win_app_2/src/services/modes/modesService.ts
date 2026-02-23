/**
 * Modes service - persists custom and built-in modes in SQLite via IPC
 */

import { db } from '@/db/client'
import type { Mode, AttachedFile } from '@/types/models'

interface DbModeRow {
  id: string
  name: string
  system_prompt: string
  is_default: number
  is_built_in: number
  created_at: string
  updated_at: string
  attached_files: string
}

function rowToMode(row: DbModeRow): Mode {
  let attachedFiles: AttachedFile[] = []
  try {
    attachedFiles = JSON.parse(row.attached_files || '[]')
  } catch {
    attachedFiles = []
  }
  return {
    id: row.id,
    name: row.name,
    systemPrompt: row.system_prompt,
    isDefault: row.is_default === 1,
    createdAt: row.created_at,
    attachedFiles,
  }
}

export const modesService = {
  async getAll(): Promise<Mode[]> {
    const rows = await db.queryAll<DbModeRow>(
      'SELECT * FROM modes ORDER BY is_built_in DESC, created_at ASC'
    )
    return rows.map(rowToMode)
  },

  async getBuiltIn(): Promise<Mode[]> {
    const rows = await db.queryAll<DbModeRow>(
      'SELECT * FROM modes WHERE is_built_in = 1 ORDER BY created_at ASC'
    )
    return rows.map(rowToMode)
  },

  async getCustom(): Promise<Mode[]> {
    const rows = await db.queryAll<DbModeRow>(
      'SELECT * FROM modes WHERE is_built_in = 0 ORDER BY created_at ASC'
    )
    return rows.map(rowToMode)
  },

  async create(mode: Mode): Promise<void> {
    const now = new Date().toISOString()
    await db.query(
      `INSERT INTO modes (id, name, system_prompt, is_default, is_built_in, created_at, updated_at, attached_files)
       VALUES (?, ?, ?, ?, 0, ?, ?, ?)`,
      [
        mode.id,
        mode.name,
        mode.systemPrompt,
        mode.isDefault ? 1 : 0,
        mode.createdAt || now,
        now,
        JSON.stringify(mode.attachedFiles || []),
      ]
    )
  },

  async update(mode: Mode): Promise<void> {
    const now = new Date().toISOString()
    await db.query(
      `UPDATE modes SET name = ?, system_prompt = ?, is_default = ?, updated_at = ?, attached_files = ?
       WHERE id = ? AND is_built_in = 0`,
      [
        mode.name,
        mode.systemPrompt,
        mode.isDefault ? 1 : 0,
        now,
        JSON.stringify(mode.attachedFiles || []),
        mode.id,
      ]
    )
  },

  async remove(id: string): Promise<void> {
    await db.query('DELETE FROM modes WHERE id = ? AND is_built_in = 0', [id])
  },

  async getById(id: string): Promise<Mode | null> {
    const row = await db.queryGet<DbModeRow>('SELECT * FROM modes WHERE id = ?', [id])
    return row ? rowToMode(row) : null
  },
}
