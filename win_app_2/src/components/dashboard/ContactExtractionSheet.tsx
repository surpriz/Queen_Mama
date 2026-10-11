import { useEffect, useState, useCallback } from 'react'
import { UserPlus, X, Check, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useContactProposalStore } from '@/stores/contactProposalStore'
import { useContactStore } from '@/stores/contactStore'
import { useLicenseStore } from '@/stores/licenseStore'
import { Feature } from '@/types/auth'
import * as contactDb from '@/services/contacts/contactDb'
import * as contactSyncService from '@/services/contacts/contactSyncService'
import { buildContact } from '@/services/contacts/contactModel'
import { toast } from '@/stores/toastStore'
import { cn } from '@/lib/utils'

const INPUT_CLASS =
  'w-full px-3 py-2 rounded-qm-md bg-qm-surface-light border border-qm-border-subtle text-body-sm text-qm-text-primary placeholder:text-qm-text-disabled focus:border-qm-accent focus:outline-none'

/**
 * Review sheet for a contact extracted after a session (mac
 * `ContactExtractionSheet` parity): confidence, editable fields, suggested
 * notes to keep, Add / Dismiss. Nothing is written until the user confirms.
 */
export function ContactExtractionSheet() {
  const { t } = useTranslation('dashboard')
  const proposal = useContactProposalStore((s) => s.proposal)
  const clear = useContactProposalStore((s) => s.clear)
  const addContact = useContactStore((s) => s.addContact)
  const canSync = useLicenseStore((s) => s.isFeatureAvailable(Feature.SessionSync))

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [company, setCompany] = useState('')
  const [role, setRole] = useState('')
  const [selectedNotes, setSelectedNotes] = useState<Set<number>>(new Set())
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!proposal) return
    const c = proposal.contact
    setFirstName(c.firstName)
    setLastName(c.lastName ?? '')
    setEmail(c.email ?? '')
    setCompany(c.company ?? '')
    setRole(c.role ?? '')
    setSelectedNotes(new Set(c.suggestedNotes.map((_, i) => i)))
  }, [proposal])

  const toggleNote = (index: number) => {
    setSelectedNotes((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const handleSave = useCallback(async () => {
    if (!proposal || !firstName.trim() || saving) return
    setSaving(true)
    try {
      const existing = await contactDb.findMatchingContact({
        email: email.trim() || undefined,
        name: `${firstName.trim()} ${lastName.trim()}`.trim(),
      })
      const now = new Date().toISOString()
      const contact = buildContact(
        { id: existing?.id, firstName, lastName, email, company: company || existing?.company, role: role || existing?.role },
        { ...existing, lastSeen: now, sessionCount: (existing?.sessionCount ?? 0) + 1, isSynced: false },
      )
      await contactDb.upsertContact(contact)
      await contactDb.linkContactToSession(contact.id, proposal.sessionId)
      for (const [i, note] of proposal.contact.suggestedNotes.entries()) {
        if (selectedNotes.has(i)) await contactDb.addNote(contact.id, note)
      }
      const refreshed = (await contactDb.getContact(contact.id)) ?? contact
      addContact(refreshed)
      if (canSync) {
        contactSyncService.pushContacts().catch(() => undefined)
      }
      toast.success(t('contacts.extraction.saved', { name: refreshed.name }))
      clear()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : String(error))
    } finally {
      setSaving(false)
    }
  }, [proposal, firstName, lastName, email, company, role, selectedNotes, saving, addContact, canSync, clear, t])

  if (!proposal) return null

  const confidencePct = Math.round(proposal.contact.confidence * 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[460px] max-h-[80vh] bg-qm-surface-medium border border-qm-border-subtle rounded-qm-lg shadow-qm-lg flex flex-col overflow-hidden animate-qm-fade-in">
        <div className="flex items-start justify-between px-5 py-4 border-b border-qm-border-subtle">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-qm-accent/20 flex items-center justify-center">
              <UserPlus size={16} className="text-qm-accent" />
            </div>
            <div>
              <h3 className="text-body-md font-semibold text-qm-text-primary">{t('contacts.extraction.title')}</h3>
              <p className="text-caption text-qm-text-tertiary">{t('contacts.extraction.subtitle')}</p>
            </div>
          </div>
          <button onClick={clear} className="p-1 rounded-qm-sm text-qm-text-tertiary hover:bg-qm-surface-hover transition-colors">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div
            className={cn(
              'inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-caption font-medium',
              confidencePct >= 85 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-300',
            )}
          >
            <Sparkles size={11} />
            {t('contacts.extraction.confidence', { percent: confidencePct })}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="space-y-1">
              <span className="block text-caption font-medium text-qm-text-secondary">{t('contacts.firstName')} *</span>
              <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={INPUT_CLASS} autoFocus />
            </label>
            <label className="space-y-1">
              <span className="block text-caption font-medium text-qm-text-secondary">{t('contacts.lastName')}</span>
              <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={INPUT_CLASS} />
            </label>
            <label className="space-y-1 col-span-2">
              <span className="block text-caption font-medium text-qm-text-secondary">{t('contacts.email')}</span>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t('contacts.emailPlaceholder')} className={INPUT_CLASS} />
            </label>
            <label className="space-y-1">
              <span className="block text-caption font-medium text-qm-text-secondary">{t('contacts.role')}</span>
              <input value={role} onChange={(e) => setRole(e.target.value)} placeholder={t('contacts.rolePlaceholder')} className={INPUT_CLASS} />
            </label>
            <label className="space-y-1">
              <span className="block text-caption font-medium text-qm-text-secondary">{t('contacts.company')}</span>
              <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder={t('contacts.companyPlaceholder')} className={INPUT_CLASS} />
            </label>
          </div>

          {proposal.contact.suggestedNotes.length > 0 && (
            <div>
              <p className="text-caption font-medium text-qm-text-secondary mb-2">{t('contacts.extraction.suggestedNotes')}</p>
              <div className="space-y-1.5">
                {proposal.contact.suggestedNotes.map((note, i) => {
                  const selected = selectedNotes.has(i)
                  return (
                    <button
                      key={i}
                      onClick={() => toggleNote(i)}
                      className={cn(
                        'flex items-start gap-2 w-full text-left px-3 py-2 rounded-qm-md border transition-colors',
                        selected ? 'border-qm-accent/50 bg-qm-accent/10' : 'border-qm-border-subtle bg-qm-surface-light hover:bg-qm-surface-hover',
                      )}
                    >
                      <span className={cn('mt-0.5 w-4 h-4 rounded border flex items-center justify-center flex-shrink-0', selected ? 'bg-qm-accent border-qm-accent' : 'border-qm-border-medium')}>
                        {selected && <Check size={10} className="text-white" />}
                      </span>
                      <span className="text-body-sm text-qm-text-primary">{note}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-qm-border-subtle flex justify-end gap-2">
          <button onClick={clear} className="px-3 py-1.5 rounded-qm-md text-body-sm text-qm-text-secondary hover:bg-qm-surface-hover transition-colors">
            {t('contacts.extraction.dismiss')}
          </button>
          <button
            onClick={handleSave}
            disabled={!firstName.trim() || saving}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-qm-md bg-gradient-to-r from-qm-gradient-start to-qm-gradient-end text-white text-body-sm font-medium hover:shadow-qm-glow transition-all disabled:opacity-50"
          >
            <UserPlus size={14} />
            {saving ? t('actions.saving', { ns: 'common' }) : t('contacts.extraction.save')}
          </button>
        </div>
      </div>
    </div>
  )
}
