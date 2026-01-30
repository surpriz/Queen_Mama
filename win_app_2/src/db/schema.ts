import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core'

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  title: text('title').notNull().default('New Session'),
  startTime: text('start_time').notNull(),
  endTime: text('end_time'),
  transcript: text('transcript').notNull().default(''),
  summary: text('summary'),
  actionItems: text('action_items').notNull().default('[]'), // JSON array
  modeId: text('mode_id'),
  // Sync metadata
  syncStatus: text('sync_status').notNull().default('local'), // local | synced | pending | failed
  remoteId: text('remote_id'),
  deviceId: text('device_id'),
  version: integer('version').notNull().default(1),
  checksum: text('checksum'),
})

export const transcriptEntries = sqliteTable('transcript_entries', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => sessions.id, { onDelete: 'cascade' }),
  timestamp: text('timestamp').notNull(),
  speaker: text('speaker').notNull().default('Unknown'),
  text: text('text').notNull().default(''),
  isFinal: integer('is_final', { mode: 'boolean' }).notNull().default(false),
})

export const aiResponses = sqliteTable('ai_responses', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').references(() => sessions.id, { onDelete: 'set null' }),
  type: text('type').notNull().default('Assist'),
  content: text('content').notNull().default(''),
  timestamp: text('timestamp').notNull(),
  provider: text('provider').notNull().default('OpenAI'),
  latencyMs: integer('latency_ms'),
  isAutomatic: integer('is_automatic', { mode: 'boolean' }).notNull().default(false),
})

export const modes = sqliteTable('modes', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
  createdAt: text('created_at').notNull(),
  attachedFiles: text('attached_files').notNull().default('[]'), // JSON array
})
