"use client";

import { useState, useEffect } from "react";
import { GlassCard, GradientButton, Input } from "@/components/ui";
import Link from "next/link";

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  lastSeenAt: string;
  createdAt: string;
  _count: {
    sessions: number;
    notes: number;
  };
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "",
  });
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchContacts();
  }, []);

  const fetchContacts = async () => {
    try {
      const res = await fetch("/api/contacts");
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts);
      }
    } catch (error) {
      console.error("Failed to fetch contacts:", error);
    } finally {
      setLoading(false);
    }
  };

  const createContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.firstName.trim()) return;

    setCreating(true);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newContact),
      });

      if (res.ok) {
        setNewContact({ firstName: "", lastName: "", email: "", company: "", role: "" });
        setShowCreateModal(false);
        fetchContacts();
      }
    } catch (error) {
      console.error("Failed to create contact:", error);
    } finally {
      setCreating(false);
    }
  };

  const deleteContact = async (id: string, name: string) => {
    if (!confirm(`Delete contact "${name}"? This action cannot be undone.`)) return;

    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchContacts();
      }
    } catch (error) {
      console.error("Failed to delete contact:", error);
    }
  };

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.firstName.toLowerCase().includes(query) ||
      (contact.lastName?.toLowerCase() || "").includes(query) ||
      (contact.email?.toLowerCase() || "").includes(query) ||
      (contact.company?.toLowerCase() || "").includes(query)
    );
  });

  const getInitials = (firstName: string, lastName?: string | null) => {
    const first = firstName.charAt(0).toUpperCase();
    const last = lastName?.charAt(0).toUpperCase() || "";
    return first + last;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Memory Palace</h1>
          <p className="mt-1 text-[var(--qm-text-secondary)]">Loading contacts...</p>
        </div>
        <div className="flex items-center justify-center py-12">
          <div className="w-8 h-8 border-2 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Memory Palace</h1>
          <p className="mt-1 text-[var(--qm-text-secondary)]">
            Your contacts and conversation history
          </p>
        </div>
        <GradientButton onClick={() => setShowCreateModal(true)} className="shrink-0">
          <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add Contact
        </GradientButton>
      </div>

      {/* Search */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--qm-text-tertiary)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="text"
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-[var(--qm-radius-md)] text-white placeholder:text-[var(--qm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--qm-accent)]/50"
        />
      </div>

      {/* Contacts Grid */}
      {filteredContacts.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <Link key={contact.id} href={`/dashboard/contacts/${contact.id}`}>
              <GlassCard padding="md" className="h-full cursor-pointer group">
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  <div className="w-12 h-12 rounded-full gradient-bg flex items-center justify-center shrink-0">
                    <span className="text-white font-semibold">
                      {getInitials(contact.firstName, contact.lastName)}
                    </span>
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate group-hover:text-[var(--qm-accent)] transition-colors">
                      {contact.firstName} {contact.lastName}
                    </h3>
                    {(contact.role || contact.company) && (
                      <p className="text-sm text-[var(--qm-text-secondary)] truncate">
                        {[contact.role, contact.company].filter(Boolean).join(" @ ")}
                      </p>
                    )}
                    {contact.email && (
                      <p className="text-xs text-[var(--qm-text-tertiary)] truncate mt-0.5">
                        {contact.email}
                      </p>
                    )}
                  </div>

                  {/* Delete button */}
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      deleteContact(contact.id, `${contact.firstName} ${contact.lastName || ""}`);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 text-[var(--qm-text-tertiary)] hover:text-[var(--qm-error)] hover:bg-[var(--qm-error)]/10 rounded transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>

                {/* Stats */}
                <div className="mt-4 pt-3 border-t border-[var(--qm-border-subtle)] flex items-center gap-4 text-xs text-[var(--qm-text-tertiary)]">
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    {contact._count.sessions} sessions
                  </span>
                  <span className="flex items-center gap-1">
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                    {contact._count.notes} notes
                  </span>
                  <span className="ml-auto">Last seen {formatDate(contact.lastSeenAt)}</span>
                </div>
              </GlassCard>
            </Link>
          ))}
        </div>
      ) : contacts.length === 0 ? (
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-12">
            <svg
              className="w-16 h-16 mx-auto text-[var(--qm-text-tertiary)] mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h3 className="text-lg font-medium text-white mb-2">No contacts yet</h3>
            <p className="text-[var(--qm-text-secondary)] max-w-md mx-auto mb-6">
              Contacts are created when you start a session in the Queen Mama app. You can also add
              them manually here.
            </p>
            <GradientButton onClick={() => setShowCreateModal(true)}>Add Your First Contact</GradientButton>
          </div>
        </GlassCard>
      ) : (
        <GlassCard hover={false} padding="lg">
          <div className="text-center py-8">
            <p className="text-[var(--qm-text-secondary)]">
              No contacts match &quot;{searchQuery}&quot;
            </p>
          </div>
        </GlassCard>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-md">
              <form onSubmit={createContact}>
                <div className="p-6 space-y-4">
                  <h2 className="text-xl font-semibold text-white">Add Contact</h2>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                        First Name *
                      </label>
                      <Input
                        value={newContact.firstName}
                        onChange={(e) =>
                          setNewContact({ ...newContact, firstName: e.target.value })
                        }
                        placeholder="John"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                        Last Name
                      </label>
                      <Input
                        value={newContact.lastName}
                        onChange={(e) => setNewContact({ ...newContact, lastName: e.target.value })}
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                      Email
                    </label>
                    <Input
                      type="email"
                      value={newContact.email}
                      onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                      placeholder="john@example.com"
                    />
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                        Company
                      </label>
                      <Input
                        value={newContact.company}
                        onChange={(e) => setNewContact({ ...newContact, company: e.target.value })}
                        placeholder="Acme Inc."
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                        Role
                      </label>
                      <Input
                        value={newContact.role}
                        onChange={(e) => setNewContact({ ...newContact, role: e.target.value })}
                        placeholder="CEO"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3 px-6 py-4 border-t border-[var(--qm-border-subtle)]">
                  <GradientButton
                    type="button"
                    variant="secondary"
                    onClick={() => setShowCreateModal(false)}
                  >
                    Cancel
                  </GradientButton>
                  <GradientButton type="submit" disabled={creating || !newContact.firstName.trim()}>
                    {creating ? "Creating..." : "Create Contact"}
                  </GradientButton>
                </div>
              </form>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
