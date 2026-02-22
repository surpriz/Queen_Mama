import { useState, useCallback } from 'react'
import { Search, Trash2, Users, ArrowLeft, Save } from 'lucide-react'
import { useContactStore } from '@/stores/contactStore'
import * as contactDb from '@/services/contacts/contactDb'
import type { Contact } from '@/types/models'

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
  const [name, setName] = useState(contact.name)
  const [role, setRole] = useState(contact.role || '')
  const [company, setCompany] = useState(contact.company || '')
  const [notes, setNotes] = useState(contact.notes)
  const [isSaving, setIsSaving] = useState(false)

  const handleSave = useCallback(async () => {
    setIsSaving(true)
    const updated: Contact = {
      ...contact,
      name,
      role: role || undefined,
      company: company || undefined,
      notes,
      updatedAt: new Date().toISOString(),
    }
    await contactDb.upsertContact(updated)
    onSave(updated)
    setIsSaving(false)
  }, [contact, name, role, company, notes, onSave])

  return (
    <div className="flex flex-col h-full p-6">
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-qm-sm bg-qm-surface-light hover:bg-qm-surface-hover text-qm-text-secondary transition-colors"
        >
          <ArrowLeft size={16} />
        </button>
        <h2 className="text-title-sm font-semibold text-qm-text-primary">Edit Contact</h2>
      </div>

      <div className="space-y-4 max-w-lg">
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">Role</label>
          <input
            type="text"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. CTO, Project Manager"
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">Company</label>
          <input
            type="text"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            placeholder="e.g. Acme Corp"
            className="w-full px-3 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-caption font-medium text-qm-text-secondary mb-1.5">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add notes about this person..."
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
            {isSaving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => onDelete(contact.id)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-qm-md bg-red-500/10 hover:bg-red-500/20 text-red-400 text-body-sm font-medium transition-colors"
          >
            <Trash2 size={14} />
            Delete
          </button>
        </div>

        {/* Meta info */}
        <div className="pt-4 border-t border-qm-border-subtle space-y-1">
          <p className="text-caption text-qm-text-tertiary">
            Sessions: {contact.sessionCount}
          </p>
          {contact.lastSeen && (
            <p className="text-caption text-qm-text-tertiary">
              Last seen: {new Date(contact.lastSeen).toLocaleDateString()}
            </p>
          )}
          <p className="text-caption text-qm-text-tertiary">
            Created: {new Date(contact.createdAt).toLocaleDateString()}
          </p>
        </div>
      </div>
    </div>
  )
}

export function ContactsView() {
  const contacts = useContactStore((s) => s.contacts)
  const searchQuery = useContactStore((s) => s.searchQuery)
  const setSearchQuery = useContactStore((s) => s.setSearchQuery)
  const selectedContact = useContactStore((s) => s.selectedContact)
  const setSelectedContact = useContactStore((s) => s.setSelectedContact)
  const updateContact = useContactStore((s) => s.updateContact)
  const removeContact = useContactStore((s) => s.removeContact)

  const handleDelete = useCallback(async (id: string) => {
    await contactDb.deleteContact(id)
    removeContact(id)
    setSelectedContact(null)
  }, [removeContact, setSelectedContact])

  const handleSave = useCallback((updated: Contact) => {
    updateContact(updated.id, updated)
    setSelectedContact(null)
  }, [updateContact, setSelectedContact])

  const filtered = contacts.filter((c) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.role?.toLowerCase().includes(q) ?? false) ||
      (c.company?.toLowerCase().includes(q) ?? false)
    )
  })

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
          <h2 className="text-title-sm font-semibold text-qm-text-primary">Contacts</h2>
        </div>
        <span className="text-caption text-qm-text-tertiary">
          {filtered.length} contacts
        </span>
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-qm-text-tertiary" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search contacts..."
          className="w-full pl-10 pr-4 py-2.5 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none"
        />
      </div>

      {/* Contact list */}
      <div className="flex-1 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-qm-text-tertiary text-body-sm">
            {searchQuery ? 'No matching contacts' : 'No contacts yet. Start a session and contacts will be automatically extracted.'}
          </div>
        ) : (
          filtered.map((contact) => (
            <div
              key={contact.id}
              onClick={() => setSelectedContact(contact)}
              className="flex items-center gap-4 p-4 rounded-qm-lg bg-qm-surface-medium hover:bg-qm-surface-hover cursor-pointer transition-colors group"
            >
              {/* Avatar placeholder */}
              <div className="w-10 h-10 rounded-full bg-qm-accent/20 flex items-center justify-center flex-shrink-0">
                <span className="text-body-md font-semibold text-qm-accent">
                  {contact.name.charAt(0).toUpperCase()}
                </span>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-body-md font-medium text-qm-text-primary truncate">
                    {contact.name}
                  </h3>
                </div>
                <div className="flex items-center gap-2 text-caption text-qm-text-tertiary">
                  {contact.role && <span>{contact.role}</span>}
                  {contact.role && contact.company && <span>·</span>}
                  {contact.company && <span>{contact.company}</span>}
                </div>
              </div>

              <div className="text-right flex-shrink-0">
                <p className="text-caption text-qm-text-tertiary">
                  {contact.sessionCount} session{contact.sessionCount !== 1 ? 's' : ''}
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
                title="Delete"
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
