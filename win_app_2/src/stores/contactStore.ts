import { create } from 'zustand'
import type { Contact } from '@/types/models'

interface ContactStoreState {
  contacts: Contact[]
  selectedContact: Contact | null
  searchQuery: string

  setContacts: (contacts: Contact[]) => void
  addContact: (contact: Contact) => void
  updateContact: (id: string, updates: Partial<Contact>) => void
  removeContact: (id: string) => void
  setSelectedContact: (contact: Contact | null) => void
  setSearchQuery: (query: string) => void
}

export const useContactStore = create<ContactStoreState>((set) => ({
  contacts: [],
  selectedContact: null,
  searchQuery: '',

  setContacts: (contacts) => set({ contacts }),
  addContact: (contact) =>
    set((state) => {
      const exists = state.contacts.find((c) => c.id === contact.id)
      if (exists) {
        return {
          contacts: state.contacts.map((c) =>
            c.id === contact.id ? { ...c, ...contact } : c
          ),
        }
      }
      return { contacts: [contact, ...state.contacts] }
    }),
  updateContact: (id, updates) =>
    set((state) => ({
      contacts: state.contacts.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
      selectedContact:
        state.selectedContact?.id === id
          ? { ...state.selectedContact, ...updates }
          : state.selectedContact,
    })),
  removeContact: (id) =>
    set((state) => ({
      contacts: state.contacts.filter((c) => c.id !== id),
      selectedContact: state.selectedContact?.id === id ? null : state.selectedContact,
    })),
  setSelectedContact: (contact) => set({ selectedContact: contact }),
  setSearchQuery: (query) => set({ searchQuery: query }),
}))
