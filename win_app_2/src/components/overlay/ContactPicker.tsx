/**
 * ContactPicker - Modal for selecting a contact before/during a session
 * Matches macOS ContactPickerSheet behavior
 */

import { useState, useEffect } from 'react'
import { Search, X, UserPlus, Check } from 'lucide-react'
import { useContactStore } from '@/stores/contactStore'
import * as contactDb from '@/services/contacts/contactDb'
import type { Contact } from '@/types/models'
import { cn } from '@/lib/utils'

interface ContactPickerProps {
  sessionId: string | null
  onSelect: (contact: Contact) => void
  onClose: () => void
}

export function ContactPicker({ sessionId, onSelect, onClose }: ContactPickerProps) {
  const contacts = useContactStore((s) => s.contacts)
  const [search, setSearch] = useState('')
  const [linkedContacts, setLinkedContacts] = useState<string[]>([])

  // Load already-linked contacts for this session
  useEffect(() => {
    if (!sessionId) return
    contactDb.getContactsForSession(sessionId).then((linked) => {
      setLinkedContacts(linked.map((c) => c.id))
    })
  }, [sessionId])

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

  const handleSelect = async (contact: Contact) => {
    if (sessionId) {
      await contactDb.linkContactToSession(contact.id, sessionId)
      setLinkedContacts((prev) => [...prev, contact.id])
    }
    onSelect(contact)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[400px] max-h-[500px] bg-qm-surface-medium border border-qm-border-subtle rounded-qm-lg shadow-qm-lg flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-qm-border-subtle">
          <h3 className="text-body-md font-semibold text-qm-text-primary">Select Contact</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-qm-sm text-qm-text-tertiary hover:bg-qm-surface-hover transition-colors"
          >
            <X size={16} />
          </button>
        </div>

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
                      isLinked={linkedContacts.includes(contact.id)}
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
                      isLinked={linkedContacts.includes(contact.id)}
                      onSelect={() => handleSelect(contact)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-qm-border-subtle flex justify-between">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-qm-md text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            Skip
          </button>
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-qm-md bg-qm-surface-light text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors"
          >
            <UserPlus size={14} />
            Start Solo
          </button>
        </div>
      </div>
    </div>
  )
}

function ContactPickerItem({
  contact,
  isLinked,
  onSelect,
}: {
  contact: Contact
  isLinked: boolean
  onSelect: () => void
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        'flex items-center gap-3 w-full px-2 py-2 rounded-qm-md transition-colors text-left',
        isLinked ? 'bg-qm-accent/10' : 'hover:bg-qm-surface-hover',
      )}
    >
      <div className="w-8 h-8 rounded-full bg-qm-accent/20 flex items-center justify-center flex-shrink-0">
        <span className="text-body-sm font-semibold text-qm-accent">
          {contact.name.charAt(0).toUpperCase()}
        </span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-body-sm font-medium text-qm-text-primary truncate">{contact.name}</p>
        <p className="text-caption text-qm-text-tertiary truncate">
          {[contact.role, contact.company].filter(Boolean).join(' @ ') || 'No details'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <span className="text-caption-sm text-qm-text-tertiary">
          {contact.sessionCount}s
        </span>
        {isLinked && <Check size={14} className="text-qm-accent" />}
      </div>
    </button>
  )
}
