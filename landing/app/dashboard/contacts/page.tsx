"use client";

import { useState, useEffect, useRef, useCallback } from "react";
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

interface ImportResult {
  imported: number;
  skipped: number;
  total: number;
  errors?: { row: number; reason: string }[];
  mapping: Record<string, string>;
  headers: string[];
}

const FIELD_OPTIONS = [
  { value: "", label: "-- Skip --" },
  { value: "firstName", label: "First Name" },
  { value: "lastName", label: "Last Name" },
  { value: "email", label: "Email" },
  { value: "company", label: "Company" },
  { value: "role", label: "Role" },
];

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newContact, setNewContact] = useState({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    role: "",
  });
  const [creating, setCreating] = useState(false);

  // Import state
  const [importStep, setImportStep] = useState<"upload" | "preview" | "importing" | "results">("upload");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<{ headers: string[]; rows: string[][]; mapping: Record<string, string> } | null>(null);
  const [columnMapping, setColumnMapping] = useState<Record<string, string>>({});
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Import handlers
  const handleFileSelect = useCallback(async (file: File) => {
    const name = file.name.toLowerCase();
    if (!name.endsWith(".csv") && !name.endsWith(".xlsx") && !name.endsWith(".xls")) {
      setImportError("Unsupported file format. Please use .csv, .xlsx, or .xls");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setImportError("File too large. Maximum size is 5MB.");
      return;
    }

    setImportFile(file);
    setImportError(null);

    // Parse preview client-side for CSV, or send to server for detection
    if (name.endsWith(".csv")) {
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      if (lines.length < 2) {
        setImportError("File must contain at least a header row and one data row.");
        return;
      }
      const headers = lines[0].split(",").map((h) => h.trim().replace(/^["']|["']$/g, ""));
      const rows = lines.slice(1, 6).map((line) => {
        // Simple CSV parsing (handles quoted values)
        const values: string[] = [];
        let current = "";
        let inQuotes = false;
        for (const char of line) {
          if (char === '"') {
            inQuotes = !inQuotes;
          } else if (char === "," && !inQuotes) {
            values.push(current.trim());
            current = "";
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        return values;
      });

      const mapping = autoDetectMapping(headers);
      setPreviewData({ headers, rows, mapping });
      setColumnMapping(mapping);
      setImportStep("preview");
    } else {
      // For Excel, we'll do a preview import with just the first few rows
      // Send to server which returns headers + mapping
      const formData = new FormData();
      formData.append("file", file);

      try {
        const res = await fetch("/api/contacts/import", { method: "POST", body: formData });
        const data = await res.json();

        if (!res.ok && data.detectedHeaders) {
          // Server couldn't detect mapping but gave us headers
          setPreviewData({ headers: data.detectedHeaders, rows: [], mapping: {} });
          setColumnMapping({});
          setImportStep("preview");
        } else if (res.ok) {
          // Import already happened (no preview needed for Excel with auto-detection)
          setImportResult(data);
          setImportStep("results");
          fetchContacts();
        } else {
          setImportError(data.message || "Failed to parse file");
        }
      } catch {
        setImportError("Failed to process file");
      }
    }
  }, []);

  const autoDetectMapping = (headers: string[]): Record<string, string> => {
    const aliases: Record<string, string[]> = {
      firstName: ["firstname", "first_name", "first name", "prénom", "prenom", "given name", "givenname"],
      lastName: ["lastname", "last_name", "last name", "nom", "nom de famille", "surname", "family name", "familyname"],
      email: ["email", "e-mail", "mail", "email address", "courriel", "adresse email"],
      company: ["company", "société", "societe", "organization", "organisation", "entreprise", "company name"],
      role: ["role", "titre", "title", "position", "poste", "job title", "job_title", "fonction"],
    };

    const mapping: Record<string, string> = {};
    const normalizedHeaders = headers.map((h) => h.trim().toLowerCase());

    for (const [field, fieldAliases] of Object.entries(aliases)) {
      for (let i = 0; i < normalizedHeaders.length; i++) {
        if (fieldAliases.includes(normalizedHeaders[i])) {
          mapping[field] = headers[i];
          break;
        }
      }
    }
    return mapping;
  };

  const handleImport = async () => {
    if (!importFile) return;

    setImportStep("importing");
    setImportError(null);

    const formData = new FormData();
    formData.append("file", importFile);

    // Send mapping if user customized it
    const reverseMapping: Record<string, string> = {};
    for (const [field, header] of Object.entries(columnMapping)) {
      if (header) reverseMapping[field] = header;
    }
    formData.append("mapping", JSON.stringify(reverseMapping));

    try {
      const res = await fetch("/api/contacts/import", { method: "POST", body: formData });
      const data = await res.json();

      if (res.ok) {
        setImportResult(data);
        setImportStep("results");
        fetchContacts();
      } else {
        setImportError(data.message || "Import failed");
        setImportStep("preview");
      }
    } catch {
      setImportError("Import failed. Please try again.");
      setImportStep("preview");
    }
  };

  const resetImport = () => {
    setImportStep("upload");
    setImportFile(null);
    setPreviewData(null);
    setColumnMapping({});
    setImportResult(null);
    setImportError(null);
  };

  const closeImportModal = () => {
    setShowImportModal(false);
    resetImport();
  };

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFileSelect(file);
    },
    [handleFileSelect]
  );

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
        <div className="flex gap-2 shrink-0">
          <GradientButton variant="secondary" onClick={() => setShowImportModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Import
          </GradientButton>
          <GradientButton onClick={() => setShowCreateModal(true)}>
            <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Contact
          </GradientButton>
        </div>
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
              them manually or import from a CSV/Excel file.
            </p>
            <div className="flex gap-3 justify-center">
              <GradientButton variant="secondary" onClick={() => setShowImportModal(true)}>Import CSV</GradientButton>
              <GradientButton onClick={() => setShowCreateModal(true)}>Add Your First Contact</GradientButton>
            </div>
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

      {/* Import Modal */}
      {showImportModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={closeImportModal}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <GlassCard className="w-full max-w-2xl max-h-[80vh] overflow-y-auto">
              <div className="p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-semibold text-white">Import Contacts</h2>
                    <p className="text-sm text-[var(--qm-text-secondary)] mt-1">
                      {importStep === "upload" && "Upload a CSV or Excel file"}
                      {importStep === "preview" && "Review column mapping"}
                      {importStep === "importing" && "Importing contacts..."}
                      {importStep === "results" && "Import complete"}
                    </p>
                  </div>
                  <button onClick={closeImportModal} className="text-[var(--qm-text-tertiary)] hover:text-white transition-colors">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {importError && (
                  <div className="p-3 rounded-lg bg-[var(--qm-error)]/10 border border-[var(--qm-error)]/30 text-[var(--qm-error)] text-sm">
                    {importError}
                  </div>
                )}

                {/* Step: Upload */}
                {importStep === "upload" && (
                  <div
                    onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                    onDragLeave={() => setIsDragging(false)}
                    onDrop={handleDrop}
                    className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors ${
                      isDragging
                        ? "border-[var(--qm-accent)] bg-[var(--qm-accent)]/5"
                        : "border-[var(--qm-border-subtle)] hover:border-[var(--qm-accent)]/50"
                    }`}
                  >
                    <svg className="w-12 h-12 mx-auto text-[var(--qm-text-tertiary)] mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="text-white font-medium mb-1">Drop your file here</p>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mb-4">
                      Supports .csv, .xlsx, .xls (max 5MB, 1000 rows)
                    </p>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFileSelect(file);
                      }}
                    />
                    <GradientButton variant="secondary" onClick={() => fileInputRef.current?.click()}>
                      Browse Files
                    </GradientButton>
                  </div>
                )}

                {/* Step: Preview & Column Mapping */}
                {importStep === "preview" && previewData && (
                  <div className="space-y-6">
                    {/* Column Mapping */}
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-white">Column Mapping</h3>
                      <p className="text-xs text-[var(--qm-text-tertiary)]">
                        Map your file columns to contact fields. First Name is required.
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2">
                        {previewData.headers.map((header) => {
                          const assignedField = Object.entries(columnMapping).find(
                            ([, v]) => v === header
                          )?.[0] || "";

                          return (
                            <div key={header} className="flex items-center gap-2">
                              <span className="text-sm text-[var(--qm-text-secondary)] w-28 truncate shrink-0" title={header}>
                                {header}
                              </span>
                              <svg className="w-4 h-4 text-[var(--qm-text-tertiary)] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                              </svg>
                              <select
                                value={assignedField}
                                onChange={(e) => {
                                  const newMapping = { ...columnMapping };
                                  // Remove old assignment for this header
                                  for (const key of Object.keys(newMapping)) {
                                    if (newMapping[key] === header) {
                                      delete newMapping[key];
                                    }
                                  }
                                  // Add new assignment
                                  if (e.target.value) {
                                    // Remove old header for this field
                                    delete newMapping[e.target.value];
                                    newMapping[e.target.value] = header;
                                  }
                                  setColumnMapping(newMapping);
                                }}
                                className="flex-1 bg-[var(--qm-surface-light)] border border-[var(--qm-border-subtle)] rounded-md px-2 py-1.5 text-sm text-white focus:outline-none focus:ring-1 focus:ring-[var(--qm-accent)]"
                              >
                                {FIELD_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Preview Table */}
                    {previewData.rows.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-medium text-white">Preview (first 5 rows)</h3>
                        <div className="overflow-x-auto rounded-lg border border-[var(--qm-border-subtle)]">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-[var(--qm-surface-light)]">
                                {previewData.headers.map((h) => (
                                  <th key={h} className="px-3 py-2 text-left text-[var(--qm-text-secondary)] font-medium">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.rows.map((row, i) => (
                                <tr key={i} className="border-t border-[var(--qm-border-subtle)]">
                                  {row.map((cell, j) => (
                                    <td key={j} className="px-3 py-2 text-[var(--qm-text-secondary)] max-w-[200px] truncate">
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* File info */}
                    <div className="flex items-center gap-2 text-xs text-[var(--qm-text-tertiary)]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      {importFile?.name} ({(importFile?.size || 0 / 1024).toFixed(1)} KB)
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between pt-2">
                      <GradientButton variant="secondary" onClick={resetImport}>
                        Back
                      </GradientButton>
                      <GradientButton
                        onClick={handleImport}
                        disabled={!columnMapping.firstName}
                      >
                        {!columnMapping.firstName ? "Map First Name to continue" : "Import Contacts"}
                      </GradientButton>
                    </div>
                  </div>
                )}

                {/* Step: Importing */}
                {importStep === "importing" && (
                  <div className="text-center py-8">
                    <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--qm-accent)] border-t-transparent rounded-full animate-spin" />
                    <p className="text-white font-medium">Importing contacts...</p>
                    <p className="text-sm text-[var(--qm-text-tertiary)] mt-1">This may take a moment</p>
                  </div>
                )}

                {/* Step: Results */}
                {importStep === "results" && importResult && (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="p-4 rounded-lg bg-[var(--qm-accent)]/10 text-center">
                        <p className="text-2xl font-bold text-[var(--qm-accent)]">{importResult.imported}</p>
                        <p className="text-xs text-[var(--qm-text-secondary)]">Imported</p>
                      </div>
                      <div className="p-4 rounded-lg bg-[var(--qm-surface-light)] text-center">
                        <p className="text-2xl font-bold text-[var(--qm-text-secondary)]">{importResult.skipped}</p>
                        <p className="text-xs text-[var(--qm-text-secondary)]">Skipped (duplicates)</p>
                      </div>
                      {importResult.errors && importResult.errors.length > 0 && (
                        <div className="p-4 rounded-lg bg-[var(--qm-error)]/10 text-center">
                          <p className="text-2xl font-bold text-[var(--qm-error)]">{importResult.errors.length}</p>
                          <p className="text-xs text-[var(--qm-text-secondary)]">Errors</p>
                        </div>
                      )}
                    </div>

                    {importResult.errors && importResult.errors.length > 0 && (
                      <div className="space-y-1">
                        <h3 className="text-sm font-medium text-[var(--qm-error)]">Errors</h3>
                        <div className="max-h-32 overflow-y-auto space-y-1">
                          {importResult.errors.slice(0, 10).map((err, i) => (
                            <p key={i} className="text-xs text-[var(--qm-text-tertiary)]">
                              Row {err.row}: {err.reason}
                            </p>
                          ))}
                          {importResult.errors.length > 10 && (
                            <p className="text-xs text-[var(--qm-text-tertiary)]">
                              ...and {importResult.errors.length - 10} more
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <GradientButton onClick={closeImportModal}>Done</GradientButton>
                    </div>
                  </div>
                )}
              </div>
            </GlassCard>
          </div>
        </>
      )}
    </div>
  );
}
