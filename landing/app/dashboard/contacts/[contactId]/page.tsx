"use client";

import { useState, useEffect, use } from "react";
import { GlassCard, GradientButton, Input } from "@/components/ui";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface ContactNote {
  id: string;
  content: string;
  createdAt: string;
}

interface ContactSession {
  id: string;
  sessionId: string;
  session: {
    id: string;
    title: string;
    startTime: string;
    duration: number | null;
    summary: string | null;
  };
}

interface Contact {
  id: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  company: string | null;
  role: string | null;
  lastSeenAt: string;
  createdAt: string;
  notes: ContactNote[];
  sessions: ContactSession[];
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ contactId: string }>;
}) {
  const { contactId } = use(params);
  const router = useRouter();
  const [contact, setContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "",
  });
  const [saving, setSaving] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    fetchContact();
  }, [contactId]);

  const fetchContact = async () => {
    try {
      const res = await fetch(`/api/contacts/${contactId}`);
      if (res.ok) {
        const data = await res.json();
        setContact(data);
        setEditForm({
          firstName: data.firstName,
          lastName: data.lastName || "",
          email: data.email || "",
          company: data.company || "",
          role: data.role || "",
        });
      } else if (res.status === 404) {
        router.push("/dashboard/contacts");
      }
    } catch (error) {
      console.error("Failed to fetch contact:", error);
    } finally {
      setLoading(false);
    }
  };

  const saveContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editForm.firstName.trim()) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });

      if (res.ok) {
        const updated = await res.json();
        setContact(updated);
        setEditing(false);
      }
    } catch (error) {
      console.error("Failed to update contact:", error);
    } finally {
      setSaving(false);
    }
  };

  const addNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setAddingNote(true);
    try {
      const res = await fetch(`/api/contacts/${contactId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: newNote }),
      });

      if (res.ok) {
        setNewNote("");
        fetchContact();
      }
    } catch (error) {
      console.error("Failed to add note:", error);
    } finally {
      setAddingNote(false);
    }
  };

  const deleteNote = async (noteId: string) => {
    if (!confirm("Delete this note?")) return;

    try {
      const res = await fetch(`/api/contacts/${contactId}/notes/${noteId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        fetchContact();
      }
    } catch (error) {
      console.error("Failed to delete note:", error);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return null;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins === 0) return `${secs}s`;
    return `${mins}m ${secs}s`;
  };

  const getInitials = (firstName: string, lastName?: string | null) => {
    const first = firstName.charAt(0).toUpperCase();
    const last = lastName?.charAt(0).toUpperCase() || "";
    return first + last;
  };

  if (loading) {
    return (
      <div className="space-y-8">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/contacts"
            className="p-2 text-[var(--qm-text-tertiary)] hover:text-white hover:bg-[var(--qm-surface-light)] rounded-[var(--qm-radius-md)] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
          </Link>
          <div className="w-8 h-8 border-2 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!contact) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12">
          <p className="text-[var(--qm-text-secondary)]">Contact not found</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/contacts"
          className="p-2 text-[var(--qm-text-tertiary)] hover:text-white hover:bg-[var(--qm-surface-light)] rounded-[var(--qm-radius-md)] transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 19l-7-7m0 0l7-7m-7 7h18"
            />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-white">
            {contact.firstName} {contact.lastName}
          </h1>
          <p className="mt-1 text-[var(--qm-text-secondary)]">
            Contact since {formatDate(contact.createdAt)}
          </p>
        </div>
        <GradientButton variant="secondary" onClick={() => setEditing(!editing)}>
          {editing ? "Cancel" : "Edit"}
        </GradientButton>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Contact Info */}
        <div className="lg:col-span-1 space-y-6">
          <GlassCard padding="lg">
            {editing ? (
              <form onSubmit={saveContact} className="space-y-4">
                <div className="grid gap-4 grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                      First Name *
                    </label>
                    <Input
                      value={editForm.firstName}
                      onChange={(e) => setEditForm({ ...editForm, firstName: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                      Last Name
                    </label>
                    <Input
                      value={editForm.lastName}
                      onChange={(e) => setEditForm({ ...editForm, lastName: e.target.value })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                    Email
                  </label>
                  <Input
                    type="email"
                    value={editForm.email}
                    onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                    Company
                  </label>
                  <Input
                    value={editForm.company}
                    onChange={(e) => setEditForm({ ...editForm, company: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-[var(--qm-text-secondary)] mb-1">
                    Role
                  </label>
                  <Input
                    value={editForm.role}
                    onChange={(e) => setEditForm({ ...editForm, role: e.target.value })}
                  />
                </div>
                <GradientButton type="submit" disabled={saving || !editForm.firstName.trim()} className="w-full">
                  {saving ? "Saving..." : "Save Changes"}
                </GradientButton>
              </form>
            ) : (
              <div className="space-y-6">
                {/* Avatar & Name */}
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-full gradient-bg flex items-center justify-center">
                    <span className="text-white font-bold text-xl">
                      {getInitials(contact.firstName, contact.lastName)}
                    </span>
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">
                      {contact.firstName} {contact.lastName}
                    </h2>
                    {(contact.role || contact.company) && (
                      <p className="text-[var(--qm-text-secondary)]">
                        {[contact.role, contact.company].filter(Boolean).join(" @ ")}
                      </p>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-3">
                  {contact.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <svg
                        className="w-4 h-4 text-[var(--qm-text-tertiary)]"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                      <a
                        href={`mailto:${contact.email}`}
                        className="text-[var(--qm-accent)] hover:underline"
                      >
                        {contact.email}
                      </a>
                    </div>
                  )}
                  <div className="flex items-center gap-3 text-sm text-[var(--qm-text-secondary)]">
                    <svg
                      className="w-4 h-4 text-[var(--qm-text-tertiary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <span>Last seen {formatDate(contact.lastSeenAt)}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-[var(--qm-text-secondary)]">
                    <svg
                      className="w-4 h-4 text-[var(--qm-text-tertiary)]"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                      />
                    </svg>
                    <span>{contact.sessions.length} sessions</span>
                  </div>
                </div>
              </div>
            )}
          </GlassCard>

          {/* Notes Section */}
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-white mb-4">Memory Palace Notes</h3>

            <form onSubmit={addNote} className="mb-4">
              <textarea
                value={newNote}
                onChange={(e) => setNewNote(e.target.value)}
                placeholder="Add a note about this contact..."
                className="w-full px-3 py-2 bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-[var(--qm-radius-md)] text-white placeholder:text-[var(--qm-text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--qm-accent)]/50 resize-none"
                rows={3}
              />
              <div className="mt-2 flex justify-end">
                <GradientButton
                  type="submit"
                  size="sm"
                  disabled={addingNote || !newNote.trim()}
                >
                  {addingNote ? "Adding..." : "Add Note"}
                </GradientButton>
              </div>
            </form>

            {contact.notes.length > 0 ? (
              <div className="space-y-3">
                {contact.notes.map((note) => (
                  <div
                    key={note.id}
                    className="group p-3 bg-[var(--qm-surface-light)] rounded-[var(--qm-radius-md)]"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm text-[var(--qm-text-secondary)] whitespace-pre-wrap">
                        {note.content}
                      </p>
                      <button
                        onClick={() => deleteNote(note.id)}
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--qm-text-tertiary)] hover:text-[var(--qm-error)] transition-opacity"
                      >
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                    <p className="mt-2 text-xs text-[var(--qm-text-tertiary)]">
                      {formatDate(note.createdAt)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[var(--qm-text-tertiary)] text-center py-4">
                No notes yet. Add notes to remember important details.
              </p>
            )}
          </GlassCard>
        </div>

        {/* Sessions */}
        <div className="lg:col-span-2">
          <GlassCard padding="lg">
            <h3 className="text-lg font-semibold text-white mb-4">Session History</h3>

            {contact.sessions.length > 0 ? (
              <div className="space-y-3">
                {contact.sessions.map((sc) => (
                  <Link key={sc.id} href={`/dashboard/sessions/${sc.session.id}`}>
                    <div className="p-4 bg-[var(--qm-surface-light)] rounded-[var(--qm-radius-md)] hover:bg-[var(--qm-surface-hover)] transition-colors cursor-pointer">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-medium text-white truncate">{sc.session.title}</h4>
                          <div className="mt-1 flex items-center gap-3 text-xs text-[var(--qm-text-tertiary)]">
                            <span>{formatDate(sc.session.startTime)}</span>
                            {sc.session.duration && (
                              <span>{formatDuration(sc.session.duration)}</span>
                            )}
                          </div>
                          {sc.session.summary && (
                            <p className="mt-2 text-sm text-[var(--qm-text-secondary)] line-clamp-2">
                              {sc.session.summary.replace(/[#*_]/g, "").slice(0, 200)}...
                            </p>
                          )}
                        </div>
                        <svg
                          className="w-5 h-5 text-[var(--qm-text-tertiary)] shrink-0 ml-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <svg
                  className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-3"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <p className="text-[var(--qm-text-secondary)]">
                  No sessions with this contact yet.
                </p>
                <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">
                  Sessions will appear here when you select this contact in the Queen Mama app.
                </p>
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
