/**
 * ContactPicker - Modal for selecting/creating a contact before starting a session
 * Matches macOS ContactPickerSheet behavior:
 * - Show before session starts (pre-session mode)
 * - Select existing contact, create new inline, or skip (start solo)
 * - Also usable mid-session to link a contact
 */

import { useState, useCallback } from 'react'
import { Search, X, UserPlus, Check, ArrowLeft, Plus } from 'lucide-react'
import { useContactStore } from '@/stores/contactStore'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import type { Contact } from '@/types/models'
import { cn } from '@/lib/utils'

interface ContactPickerProps {
  /** If provided, contact will be linked to this session on select */
  sessionId?: string | null
  /** Called when user selects a contact or creates a new one */
  onStart: (contact: Contact | null) => void
  /** Called when user dismisses the picker */
  onClose: () => void
}

export function ContactPicker({ sessionId, onStart, onClose }: ContactPickerProps) {
  const contacts = useContactStore((s) => s.contacts)
  const addContact = useContactStore((s) => s.addContact)
  const [search, setSearch] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // New contact form state
  const [newName, setNewName] = useState('')
  const [newEmail, setNewEmail] = useState('')
  const [newRole, setNewRole] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const filtered = contacts.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.email?.toLowerCase().includes(q) ?? false) ||
      (c.role?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    )
  })

  // Sort: recent contacts first (by lastSeen), then by name
  const sorted = [...filtered].sort((a, b) => {
    if (a.lastSeen && b.lastSeen) return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime()
    if (a.lastSeen) return -1
    if (b.lastSeen) return 1
    return a.name.localeCompare(b.name)
  })

  const recentContacts = sorted.slice(0, 5)
  const otherContacts = sorted.slice(5)

  const handleSelect = useCallback(async (contact: Contact) => {
    // Update lastSeen
    const now = new Date().toISOString()
    const updated = { ...contact, lastSeen: now, updatedAt: now }
    await contactDb.upsertContact(updated)
    addContact(updated)

    // Link to session if we have one
    if (sessionId) {
      await contactDb.linkContactToSession(contact.id, sessionId)
    }

    // Queue for sync
    contactSyncService.pushContacts().catch(() => {})

    onStart(updated)
  }, [sessionId, addContact, onStart])

  const handleCreateAndStart = useCallback(async () => {
    if (!newName.trim() || isSaving) return
    setIsSaving(true)

    const now = new Date().toISOString()
    const newContact: Contact = {
      id: crypto.randomUUID(),
      name: newName.trim(),
      email: newEmail.trim() || undefined,
      role: newRole.trim() || undefined,
      company: newCompany.trim() || undefined,
      notes: '',
      lastSeen: now,
      sessionCount: 0,
      createdAt: now,
      updatedAt: now,
    }

    await contactDb.upsertContact(newContact)
    addContact(newContact)

    if (sessionId) {
      await contactDb.linkContactToSession(newContact.id, sessionId)
    }

    // Queue for sync
    contactSyncService.pushContacts().catch(() => {})

    setIsSaving(false)
    onStart(newContact)
  }, [newName, newEmail, newRole, newCompany, isSaving, sessionId, addContact, onStart])

  const handleStartSolo = useCallback(() => {
    onStart(null)
  }, [onStart])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] max-h-[520px] bg-qm-surface-medium border border-qm-border-subtle rounded-qm-lg shadow-qm-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-qm-border-subtle">
          {isCreating ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsCreating(false)}
                className="p-1 rounded-qm-sm text-qm-text-tertiary hover:bg-qm-surface-hover transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
              <h3 className="text-body-md font-semibold text-qm-text-primary">New Contact</h3>
            </div>
          ) : (
            <h3 className="text-body-md font-semibold text-qm-text-primary">Who are you talking to?</h3>
          )}
          <button
            onClick={onClose}
            className="p-1 rounded-qm-sm text-qm-text-tertiary hover:bg-qm-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {isCreating ? (
          /* New contact form */
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
            <div>
              <label className="block text-caption font-medium text-qm-text-secondary mb-1">
                Name <span className="text-qm-error">*</span>
              </label>
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Full name"
                autoFocus
                className="w-full px-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-caption font-medium text-qm-text-secondary mb-1">Email</label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full px-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
              />
            </div>
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-caption font-medium text-qm-text-secondary mb-1">Role</label>
                <input
                  type="text"
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  placeholder="e.g. CTO"
                  className="w-full px-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
                />
              </div>
              <div className="flex-1">
                <label className="block text-caption font-medium text-qm-text-secondary mb-1">Company</label>
                <input
                  type="text"
                  value={newCompany}
                  onChange={(e) => setNewCompany(e.target.value)}
                  placeholder="e.g. Acme Corp"
                  className="w-full px-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
                />
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="relative px-4 py-3">
              <Search size={14} className="absolute left-7 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search contacts..."
                autoFocus
                className="w-full pl-8 pr-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
              />
            </div>

            {/* Contact list */}
            <div className="flex-1 overflow-y-auto px-2 pb-2">
              {sorted.length === 0 ? (
                <div className="text-center py-8 text-caption text-qm-text-tertiary">
                  {search ? 'No matching contacts' : 'No contacts yet'}
                </div>
              ) : (
                <>
                  {recentContacts.length > 0 && (
                    <div className="mb-2">
                      <p className="text-caption-sm text-qm-text-tertiary px-2 py-1 uppercase tracking-wider">Recent</p>
                      {recentContacts.map((contact) => (
                        <ContactPickerItem
                          key={contact.id}
                          contact={contact}
                          onSelect={() => handleSelect(contact)}
                        />
                      ))}
                    </div>
                  )}
                  {otherContacts.length > 0 && (
                    <div>
                      <p className="text-caption-sm text-qm-text-tertiary px-2 py-1 uppercase tracking-wider">All</p>
                      {otherContacts.map((contact) => (
                        <ContactPickerItem
                          key={contact.id}
                          contact={contact}
                          onSelect={() => handleSelect(contact)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {/* Footer */}
        <div className="px-4 py-3 border-t border-qm-border-subtle flex justify-between">
          {isCreating ? (
            <>
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1.5 rounded-qm-md text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleCreateAndStart}
                disabled={!newName.trim() || isSaving}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-all disabled:opacity-50"
              >
                <Plus size={14} />
                {isSaving ? 'Creating...' : 'Create & Start'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsCreating(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
              >
                <UserPlus size={14} />
                New Contact
              </button>
              <button
                onClick={handleStartSolo}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-qm-md bg-qm-surface-light text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
              >
                Start Solo
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function ContactPickerItem({
  contact,
  onSelect,
}: {
  contact: Contact
  onSelect: () => void
}) {
  const initials = (() => {
    const parts = contact.name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    return contact.name.slice(0, 2).toUpperCase()
  })()

  return (
    <button
      onClick={onSelect}
      className="flex items-center gap-3 w-full px-2 py-2 rounded-qm-md hover:bg-qm-surface-hover transition-colors text-left"
    >
      <div className="w-8 h-8 rounded-full bg-qm-accent/20 flex items-center justify-center flex-shrink-0">
        <span className="text-body-sm font-semibold text-qm-accent">
          {initials}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-qm-text-primary truncate">{contact.name}</p>
        <p className="text-caption text-qm-text-tertiary truncate">
          {[contact.role, contact.company].filter(Boolean).join(' @ ') || 'No details'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {contact.sessionCount > 0 && (
          <span className="text-caption-sm text-qm-text-tertiary">
            {contact.sessionCount}s
          </span>
        )}
        {contact.isSynced && <Check size={12} className="text-green-400" />}
      </div>
    </button>
  )
}
