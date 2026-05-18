import { useState, useCallback } from 'react'
import { Search, Trash2, Users, ArrowLeft, Save, Plus } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import { useTranslation } from 'react-i18next'
import { useContactStore } from '@/stores/contactStore'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import type { Contact } from '@/types/models'

const AVATAR_COLORS = [
  'bg-purple-500/20 text-purple-400',
  'bg-blue-500/20 text-blue-400',
  'bg-emerald-500/20 text-emerald-400',
  'bg-amber-500/20 text-amber-400',
  'bg-pink-500/20 text-pink-400',
  'bg-cyan-500/20 text-cyan-400',
  'bg-rose-500/20 text-rose-400',
]

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) {
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  }
  return name.slice(0, 2).toUpperCase()
}

function getAvatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
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
  const { t } = useTranslation('dashboard')
  const [name, setName] = useState(contact.name)
  const [email, setEmail] = useState(contact.email || '')
  const [role, setRole] = useState(contact.role || '')
  const [company, setCompany] = useState(contact.company || '')
  const [notes, setNotes] = useState(contact.notes)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    const updated: Contact = {
      ...contact,
      name,
      email: email || undefined,
      role: role || undefined,
      company: company || undefined,
      notes,
      updatedAt: new Date().toISOString(),
    }
    await contactDb.upsertContact(updated)
    onSave(updated)
    contactSyncService.pushContacts().catch(() => {})
    setIsSaving(false)
  }, [contact, name, email, role, company, notes, onSave])

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.editContact')}</h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.name')}</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('contacts.emailPlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.role')}</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('contacts.rolePlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.company')}</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t('contacts.companyPlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.notes')}</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder={t('contacts.notesPlaceholder')}
            rows={4}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none resize-none"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleSave}
            disabled={isSaving || !name.trim()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-qm-md bg-qm-accent hover:bg-qm-accent/80 text-white text-body-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {isSaving ? t('actions.saving', { ns: 'common' }) : t('actions.save', { ns: 'common' })}
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-qm-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-body-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            {t('actions.delete', { ns: 'common' })}
          </button>
        </div>

        {/* Meta info */}
        <div className="pt-4 border-t border-qm-border-subtle space-y-1">
          <p className="text-caption text-qm-text-tertiary">
            {t('contacts.sessions')} {contact.sessionCount}
          </p>
          {contact.lastSeen && (
            <p className="text-caption text-qm-text-tertiary">
              {t('contacts.lastSeen')} {new Date(contact.lastSeen).toLocaleDateString()}
            </p>
          )}
          <p className="text-caption text-qm-text-tertiary">
            {t('contacts.created')} {new Date(contact.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}

function CreateContactForm({
  onBack,
  onCreated,
}: {
  onBack: () => void
  onCreated: (contact: Contact) => void
}) {
  const { t } = useTranslation('dashboard')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('')
  const [company, setCompany] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const handleCreate = useCallback(async () => {
    if (!name.trim()) return
    setIsSaving(true)
    const now = new Date().toISOString()
    const newContact: Contact = {
      id: uuidv4(),
      name: name.trim(),
      email: email.trim() || undefined,
      role: role.trim() || undefined,
      company: company.trim() || undefined,
      notes: '',
      sessionCount: 0,
      createdAt: now,
      updatedAt: now,
    }
    await contactDb.upsertContact(newContact)
    onCreated(newContact)
    contactSyncService.pushContacts().catch(() => {})
    setIsSaving(false)
  }, [name, email, role, company, onCreated])

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.newContact')}</h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">
            {t('contacts.name')} <span className="text-qm-error">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('contacts.fullName')}
            autoFocus
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.email')}</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t('contacts.emailPlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.role')}</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder={t('contacts.rolePlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">{t('contacts.company')}</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder={t('contacts.companyPlaceholder')}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>

        <button
          onClick={handleCreate}
          disabled={isSaving || !name.trim()}
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
  const updateContact = useContactStore((s) => s.updateContact)
  const addContact = useContactStore((s) => s.addContact)
  const removeContact = useContactStore((s) => s.removeContact)
  const [isCreating, setIsCreating] = useState(false)

  const handleDelete = useCallback(async (id: string) => {
    await contactDb.deleteContact(id)
    removeContact(id)
    setSelectedContact(null)
  }, [removeContact, setSelectedContact])

  const handleSave = useCallback((updated: Contact) => {
    updateContact(updated.id, updated)
    setSelectedContact(null)
  }, [updateContact, setSelectedContact])

  const handleCreated = useCallback((contact: Contact) => {
    addContact(contact)
    setIsCreating(false)
  }, [addContact])

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
    return (
      <CreateContactForm
        onBack={() => setIsCreating(false)}
        onCreated={handleCreated}
      />
    )
  }

  if (selectedContact) {
    return (
      <ContactDetail
        contact={selectedContact}
        onBack={() => setSelectedContact(null)}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    )
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Users size={22} className="text-qm-accent" />
          <h2 className="text-title-sm font-semibold text-qm-text-primary">{t('contacts.title')}</h2>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-caption text-qm-text-tertiary">
            {t('contacts.contactCount', { count: filtered.length })}
          </span>
          <button
            onClick={() => setIsCreating(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-pill bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow hover-scale transition-all"
          >
            <Plus size={14} /> {t('contacts.newContact')}
          </button>
        </div>
      </div>

      {/* Search */}
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

      {/* Contact list */}
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
          filtered.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="qm-card-hover flex items-center gap-4 p-4 rounded-qm-lg bg-qm-bg-tertiary/60 shadow-qm-elev-1 cursor-pointer group"
            >
              {/* Avatar with 2-letter initials + color cycling */}
              <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 shadow-qm-elev-1 ${getAvatarColor(contact.name)}`}>
                <span className="text-body-sm font-semibold tracking-tight">
                  {getInitials(contact.name)}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-body-md font-medium text-qm-text-primary truncate tracking-tight">
                    {contact.name}
                  </h3>
                  {contact.isSynced && (
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-full font-medium">{t('contacts.synced')}</span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-caption text-qm-text-tertiary mt-0.5">
                  {contact.role && <span>{contact.role}</span>}
                  {contact.role && contact.company && <span className="opacity-50">·</span>}
                  {contact.company && <span>{contact.company}</span>}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-caption text-qm-text-secondary tabular-nums font-medium">
                  {t('contacts.sessionCount', { count: contact.sessionCount })}
                </p>
                {contact.lastSeen && (
                  <p className="text-caption-sm text-qm-text-tertiary">
                    {new Date(contact.lastSeen).toLocaleDateString()}
                  </p>
                )}
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete(contact.id)
                }}
                className="p-1.5 rounded-qm-sm text-qm-text-tertiary hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                title={t('actions.delete', { ns: 'common' })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
