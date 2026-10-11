import { useState, useCallback, useEffect } from 'react'
import { Search, Trash2, Users, ArrowLeft, Save, Plus, RefreshCw, CloudDownload, CloudUpload, StickyNote, History, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useContactStore } from '@/stores/contactStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import { buildContact, initials, displaySubtitle } from '@/services/contacts/contactModel'
import { toast } from '@/stores/toastStore'
import { cn } from '@/lib/utils'
import type { Contact, ContactNote, Session } from '@/types/models'

const AVATAR_COLORS = [
  'bg-purple-500/20 text-purple-400',
  'bg-blue-500/20 text-blue-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-amber-500/20 text-amber-400',
  'bg-pink-500/20 text-pink-400',
  'bg-cyan-500/20 text-cyan-400',
  'bg-rose-500/20 text-rose-400',
]

const INPUT_CLASS =
  'w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none'

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

type SessionSummary = Pick<Session, 'id' | 'title' | 'startTime' | 'endTime' | 'summary'>

/** Two-step inline confirmation (same pattern as the overlay ActionBar). */
function useConfirm(timeoutMs = 3000): [boolean, () => boolean] {
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    if (!armed) return
    const timer = setTimeout(() => setArmed(false), timeoutMs)
    return () => clearTimeout(timer)
  }, [armed, timeoutMs])
  const confirm = () => {
    if (armed) {
      setArmed(false)
      return true
    }
    setArmed(true)
    return false
  }
  return [armed, confirm]
}

function ContactDetail({
  contact,
  onBack,
  onSave,
  onDelete,
}: {
  contact: Contact
  onBack: () => void
  onSave: (updated: Contact) => void
  onDelete: (id: string) => void
}) {
  const { t, i18n } = useTranslation('dashboard')
  const canSync = useLicenseStore((s) => s.isFeatureAvailable(Feature.SessionSync))
  const [firstName, setFirstName] = useState(contact.firstName || contact.name)
  const [lastName, setLastName] = useState(contact.lastName || '')
  const [email, setEmail] = useState(contact.email || '')
  const [role, setRole] = useState(contact.role || '')
  const [company, setCompany] = useState(contact.company || '')
  const [isSaving, setIsSaving] = useState(false)
  const [notes, setNotes] = useState<ContactNote[]>([])
  const [newNote, setNewNote] = useState('')
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [deleteArmed, confirmDelete] = useConfirm()

  useEffect(() => {
    let cancelled = false
    Promise.all([contactDb.getNotes(contact.id), contactDb.getSessionsForContact(contact.id, 50)])
      .then(([n, s]) => {
        if (cancelled) return
        setNotes(n)
        setSessions(s)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [contact.id])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  const handleSave = useCallback(async () => {
    if (!firstName.trim()) return
    setIsSaving(true)
    try {
      const updated = buildContact({ id: contact.id, firstName, lastName, email, role, company }, { ...contact, isSynced: false })
      await contactDb.upsertContact(updated)
      const refreshed = (await contactDb.getContact(contact.id)) ?? updated
      onSave(refreshed)
      if (canSync) contactSyncService.pushContacts().catch(() => undefined)
    } finally {
      setIsSaving(false)
    }
  }, [contact, firstName, lastName, email, role, company, onSave, canSync])

  const handleAddNote = useCallback(async () => {
    const text = newNote.trim()
    if (!text) return
    const note = await contactDb.addNote(contact.id, text)
    await contactDb.markContactDirty(contact.id)
    setNotes((prev) => [note, ...prev])
    setNewNote('')
    if (canSync) contactSyncService.pushContacts().catch(() => undefined)
  }, [contact.id, newNote, canSync])

  const handleDeleteNote = useCallback(
    async (note: ContactNote) => {
      await contactDb.deleteNote(note.id, contact.id)
      setNotes((prev) => prev.filter((n) => n.id !== note.id))
    },
    [contact.id],
  )

  return (
    <div className="flex flex-col h-full p-6 overflow-y-auto">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.editContact')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-4xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">
                {t('contacts.firstName')} <span className="text-qm-error">*</span>
              </label>
              <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLASS} />
            </div>
            <div>
              <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.lastName')}</label>
              <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLASS} />
            </div>
          </div>
          <div>
            <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contacts.emailPlaceholder')} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.role')}</label>
            <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('contacts.rolePlaceholder')} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.company')}</label>
            <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('contacts.companyPlaceholder')} className={INPUT_CLASS} />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={isSaving || !firstName.trim()}
              className="flex items-center gap-2 px-4 py-2.5 rounded-qm-md bg-qm-accent hover:bg-qm-accent/80 text-white text-body-sm font-medium transition-colors disabled:opacity-50"
            >
              <Save size={14} />
              {isSaving ? t('actions.saving', { ns: 'common' }) : t('actions.save', { ns: 'common' })}
            </button>
            <button
              onClick={() => {
                if (confirmDelete()) onDelete(contact.id)
              }}
              className={cn(
                'flex items-center gap-2 px-4 py-2.5 rounded-qm-md text-body-sm font-medium transition-colors',
                deleteArmed ? 'bg-red-500 text-white animate-pulse' : 'bg-red-500/10 hover:bg-red-500/20 text-red-400',
              )}
            >
              <Trash2 size={14} />
              {deleteArmed ? t('contacts.confirmDelete') : t('actions.delete', { ns: 'common' })}
            </button>
          </div>

          <div className="pt-4 border-t border-qm-border-subtle space-y-1">
            <p className="text-caption text-qm-text-tertiary">
              {t('contacts.sessions')} {contact.sessionCount}
            </p>
            {contact.lastSeen && (
              <p className="text-caption text-qm-text-tertiary">
                {t('contacts.lastSeen')} {formatDate(contact.lastSeen)}
              </p>
            )}
            <p className="text-caption text-qm-text-tertiary">
              {t('contacts.created')} {formatDate(contact.createdAt)}
            </p>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="flex items-center gap-1.5 text-label-md text-qm-text-secondary mb-2">
              <StickyNote size={13} /> {t('contacts.notesTimeline')}
            </h3>
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') void handleAddNote()
                }}
                placeholder={t('contacts.addNotePlaceholder')}
                className={INPUT_CLASS}
              />
              <button
                onClick={handleAddNote}
                disabled={!newNote.trim()}
                className="flex items-center gap-1 px-3 rounded-qm-md bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary text-body-sm transition-colors disabled:opacity-50"
              >
                <Plus size={14} /> {t('contacts.addNote')}
              </button>
            </div>
            {notes.length === 0 ? (
              <p className="text-caption text-qm-text-disabled">{t('contacts.noNotes')}</p>
            ) : (
              <ul className="space-y-2">
                {notes.map((note) => (
                  <li key={note.id} className="group flex items-start gap-2 rounded-qm-md bg-qm-bg-tertiary/60 p-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-body-sm text-qm-text-primary whitespace-pre-wrap">{note.text}</p>
                      <p className="text-caption-sm text-qm-text-tertiary mt-1">{formatDate(note.createdAt)}</p>
                    </div>
                    <button
                      onClick={() => handleDeleteNote(note)}
                      className="p-1 rounded-qm-sm text-qm-text-tertiary hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                      title={t('actions.delete', { ns: 'common' })}
                    >
                      <X size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <h3 className="flex items-center gap-1.5 text-label-md text-qm-text-secondary mb-2">
              <History size={13} /> {t('contacts.linkedSessions')}
            </h3>
            {sessions.length === 0 ? (
              <p className="text-caption text-qm-text-disabled">{t('contacts.noLinkedSessions')}</p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => (
                  <li key={s.id} className="rounded-qm-md bg-qm-bg-tertiary/60 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-body-sm font-medium text-qm-text-primary truncate">{s.title}</p>
                      <span className="text-caption-sm text-qm-text-tertiary flex-shrink-0">{formatDate(s.startTime)}</span>
                    </div>
                    {s.summary && <p className="text-caption text-qm-text-secondary line-clamp-2 mt-1">{s.summary}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

function CreateContactForm({ onBack, onCreated }: { onBack: () => void; onCreated: (contact: Contact) => void }) {
  const { t } = useTranslation('dashboard')
  const canSync = useLicenseStore((s) => s.isFeatureAvailable(Feature.SessionSync))
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!firstName.trim()) return
    setIsSaving(true)
    try {
      const newContact = buildContact({ firstName, lastName, email, role, company })
      await contactDb.upsertContact(newContact)
      onCreated(newContact)
      if (canSync) contactSyncService.pushContacts().catch(() => undefined)
    } finally {
      setIsSaving(false)
    }
  }, [firstName, lastName, email, role, company, onCreated, canSync])

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={onBack} className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors">
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.newContact')}</h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">
              {t('contacts.firstName')} <span className="text-qm-error">*</span>
            </label>
            <input type="text" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoFocus className={INPUT_CLASS} />
          </div>
          <div>
            <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.lastName')}</label>
            <input type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLASS} />
          </div>
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.email')}</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contacts.emailPlaceholder')} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.role')}</label>
          <input type="text" value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('contacts.rolePlaceholder')} className={INPUT_CLASS} />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.company')}</label>
          <input type="text" value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('contacts.companyPlaceholder')} className={INPUT_CLASS} />
        </div>

        <button
          onClick={handleCreate}
          disabled={isSaving || !firstName.trim()}
          className="flex items-center gap-2 px-4 py-2.5 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow hover-scale transition-all disabled:opacity-50"
        >
          <Plus size={14} />
          {isSaving ? t('actions.creating', { ns: 'common' }) : t('contacts.createContact')}
        </button>
      </div>
    </div>
  )
}

export function ContactsView() {
  const { t } = useTranslation('dashboard')
  const contacts = useContactStore((s) => s.contacts)
  const searchQuery = useContactStore((s) => s.searchQuery)
  const setSearchQuery = useContactStore((s) => s.setSearchQuery)
  const selectedContact = useContactStore((s) => s.selectedContact)
  const setSelectedContact = useContactStore((s) => s.setSelectedContact)
  const setContacts = useContactStore((s) => s.setContacts)
  const updateContact = useContactStore((s) => s.updateContact)
  const addContact = useContactStore((s) => s.addContact)
  const removeContact = useContactStore((s) => s.removeContact)
  const canSync = useLicenseStore((s) => s.isFeatureAvailable(Feature.SessionSync))
  const [isCreating, setIsCreating] = useState(false)
  const [syncState, setSyncState] = useState(contactSyncService.getSyncState())
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  useEffect(() => contactSyncService.onSyncStateChanged(setSyncState), [])

  useEffect(() => {
    if (!pendingDeleteId) return
    const timer = setTimeout(() => setPendingDeleteId(null), 3000)
    return () => clearTimeout(timer)
  }, [pendingDeleteId])

  const handleDelete = useCallback(
    async (id: string) => {
      await contactDb.deleteContact(id)
      removeContact(id)
      setSelectedContact(null)
      setPendingDeleteId(null)
    },
    [removeContact, setSelectedContact],
  )

  const handleSave = useCallback(
    (updated: Contact) => {
      updateContact(updated.id, updated)
      setSelectedContact(null)
    },
    [updateContact, setSelectedContact],
  )

  const handleCreated = useCallback(
    (contact: Contact) => {
      addContact(contact)
      setIsCreating(false)
    },
    [addContact],
  )

  const reloadContacts = useCallback(async () => {
    setContacts(await contactDb.getAllContacts())
  }, [setContacts])

  const handlePull = useCallback(async () => {
    const imported = await contactSyncService.pullContacts()
    await reloadContacts()
    const err = contactSyncService.getSyncState().lastError
    if (err) toast.error(err)
    else toast.success(t('contacts.pulled', { count: imported.length }))
  }, [reloadContacts, t])

  const handleSync = useCallback(async () => {
    await contactSyncService.syncNow()
    await reloadContacts()
    const err = contactSyncService.getSyncState().lastError
    if (err) toast.error(err)
    else toast.success(t('contacts.syncDone'))
  }, [reloadContacts, t])

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.role?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    )
  })

  if (isCreating) {
    return <CreateContactForm onBack={() => setIsCreating(false)} onCreated={handleCreated} />
  }

  if (selectedContact) {
    return <ContactDetail contact={selectedContact} onBack={() => setSelectedContact(null)} onSave={handleSave} onDelete={handleDelete} />
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-qm-accent" />
          <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.title')}</h2>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-caption text-qm-text-tertiary mr-1">{t('contacts.contactCount', { count: filtered.length })}</span>
          {canSync && (
            <>
              <button
                onClick={handlePull}
                disabled={syncState.isPulling || syncState.isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary text-body-sm transition-colors disabled:opacity-50"
                title={t('contacts.pullHint')}
              >
                <CloudDownload size={14} className={syncState.isPulling ? 'animate-pulse' : ''} />
                {syncState.isPulling ? t('contacts.pulling') : t('contacts.pull')}
              </button>
              <button
                onClick={handleSync}
                disabled={syncState.isPulling || syncState.isSyncing}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary text-body-sm transition-colors disabled:opacity-50"
                title={t('contacts.syncHint')}
              >
                {syncState.isSyncing ? <RefreshCw size={14} className="animate-spin" /> : <CloudUpload size={14} />}
                {syncState.isSyncing ? t('contacts.syncing') : t('contacts.sync')}
                {syncState.pendingCount > 0 && !syncState.isSyncing && (
                  <span className="ml-0.5 px-1.5 rounded-full bg-qm-accent/20 text-qm-accent text-caption-sm tabular-nums">{syncState.pendingCount}</span>
                )}
              </button>
            </>
          )}
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow hover-scale transition-all"
          >
            <Plus size={14} /> {t('contacts.newContact')}
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t('contacts.searchPlaceholder')}
          className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center px-10 py-16">
            <div className="relative w-24 h-24 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-20 blur-2xl animate-qm-pulse" />
              <div className="absolute inset-3 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end opacity-35 blur-lg" />
              <div className="relative w-14 h-14 rounded-full bg-gradient-to-br from-qm-gradient-start to-qm-gradient-end shadow-qm-glow-strong flex items-center justify-center">
                <Users size={22} strokeWidth={1.5} className="text-white" />
              </div>
            </div>
            <h3 className="font-display text-title-sm font-semibold text-qm-text-primary mb-2 tracking-tight">
              {searchQuery ? t('contacts.noMatchingContacts') : t('contacts.noContactsYet')}
            </h3>
            {!searchQuery && (
              <button
                onClick={() => setIsCreating(true)}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-caption font-medium hover:shadow-qm-glow-strong hover-scale transition-all"
              >
                <Plus size={12} /> {t('contacts.newContact')}
              </button>
            )}
          </div>
        ) : (
          filtered.map((contact) => {
            const subtitle = displaySubtitle(contact)
            const armed = pendingDeleteId === contact.id
            return (
              <div
                key={contact.id}
                onClick={() => setSelectedContact(contact)}
                className="qm-card-hover flex items-center gap-4 p-4 rounded-qm-lg bg-qm-bg-tertiary/60 shadow-qm-elev-1 cursor-pointer group"
              >
                <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-qm-elev-1 ${getAvatarColor(contact.name)}`}>
                  <span className="text-body-sm font-semibold tracking-tight">{initials(contact)}</span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-body-md font-medium text-qm-text-primary truncate tracking-tight">{contact.name}</h3>
                    {contact.isSynced && (
                      <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-medium">{t('contacts.synced')}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-caption text-qm-text-tertiary mt-0.5">
                    {subtitle && <span>{subtitle}</span>}
                    {subtitle && contact.email && <span className="opacity-50">·</span>}
                    {contact.email && <span className="truncate">{contact.email}</span>}
                  </div>
                </div>

                <div className="text-right flex-shrink-0">
                  <p className="text-caption text-qm-text-secondary tabular-nums font-medium">{t('contacts.sessionCount', { count: contact.sessionCount })}</p>
                  {contact.lastSeen && <p className="text-caption-sm text-qm-text-tertiary">{new Date(contact.lastSeen).toLocaleDateString()}</p>}
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    if (armed) void handleDelete(contact.id)
                    else setPendingDeleteId(contact.id)
                  }}
                  className={cn(
                    'flex items-center gap-1 p-1.5 rounded-qm-sm transition-all',
                    armed
                      ? 'bg-red-500 text-white opacity-100 px-2 text-caption font-medium animate-pulse'
                      : 'text-qm-text-tertiary hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100',
                  )}
                  title={armed ? t('contacts.confirmDelete') : t('actions.delete', { ns: 'common' })}
                >
                  <Trash2 size={14} />
                  {armed && t('contacts.confirmDelete')}
                </button>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
