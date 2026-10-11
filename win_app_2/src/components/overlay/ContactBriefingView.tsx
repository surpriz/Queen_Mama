import { useEffect, useState } from 'react'
import { Mail, Clock, StickyNote, History, UserRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useAppStore } from '@/stores/appStore'
import * as contactDb from '@/services/contacts/contactDb'
import { initials, displaySubtitle } from '@/services/contacts/contactModel'
import type { Contact, ContactNote, Session } from '@/types/models'

type SessionSummary = Pick<Session, 'id' | 'title' | 'startTime' | 'endTime' | 'summary'>

/**
 * Briefing tab (mac `ContactBriefingView` parity): who you are talking to,
 * what was said last time, and the notes you kept. Loaded from the local DB
 * for the contact linked to the running session.
 */
export function ContactBriefingView() {
  const { t, i18n } = useTranslation('overlay')
  const contactId = useAppStore((s) => s.currentContactId)
  const [contact, setContact] = useState<Contact | null>(null)
  const [notes, setNotes] = useState<ContactNote[]>([])
  const [sessions, setSessions] = useState<SessionSummary[]>([])

  useEffect(() => {
    let cancelled = false
    if (!contactId) {
      setContact(null)
      setNotes([])
      setSessions([])
      return
    }
    Promise.all([contactDb.getContact(contactId), contactDb.getNotes(contactId), contactDb.getSessionsForContact(contactId, 5)])
      .then(([c, n, s]) => {
        if (cancelled) return
        setContact(c ?? null)
        setNotes(n)
        setSessions(s)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [contactId])

  if (!contact) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center gap-2 px-6 text-center">
        <UserRound size={22} className="text-qm-text-tertiary" />
        <p className="text-body-sm font-medium text-qm-text-primary">{t('briefing.emptyTitle')}</p>
        <p className="text-caption text-qm-text-tertiary">{t('briefing.emptySubtitle')}</p>
      </div>
    )
  }

  const subtitle = displaySubtitle(contact)
  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString(i18n.language, { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-qm-accent/20 flex items-center justify-center flex-shrink-0">
          <span className="text-body-sm font-semibold text-qm-accent">{initials(contact)}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-body-md font-semibold text-qm-text-primary truncate">{contact.name}</p>
          {subtitle && <p className="text-caption text-qm-text-tertiary truncate">{subtitle}</p>}
          {contact.email && (
            <p className="flex items-center gap-1 text-caption text-qm-text-tertiary truncate">
              <Mail size={10} /> {contact.email}
            </p>
          )}
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-body-md font-semibold text-qm-text-primary tabular-nums">{contact.sessionCount}</p>
          <p className="text-caption-sm text-qm-text-tertiary">{t('briefing.sessions')}</p>
        </div>
      </div>

      {contact.lastSeen && (
        <p className="flex items-center gap-1 text-caption text-qm-text-tertiary">
          <Clock size={10} /> {t('briefing.lastSeen', { date: formatDate(contact.lastSeen) })}
        </p>
      )}

      <section>
        <h4 className="flex items-center gap-1 text-caption font-semibold uppercase tracking-wider text-qm-text-tertiary mb-1.5">
          <History size={11} /> {t('briefing.previousSessions')}
        </h4>
        {sessions.length === 0 ? (
          <p className="text-caption text-qm-text-disabled">{t('briefing.noSessions')}</p>
        ) : (
          <div className="space-y-1.5">
            {sessions.map((s) => (
              <div key={s.id} className="rounded-qm-md bg-qm-bg-tertiary/55 p-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-body-sm font-medium text-qm-text-primary truncate">{s.title}</p>
                  <span className="text-caption-sm text-qm-text-tertiary flex-shrink-0">{formatDate(s.startTime)}</span>
                </div>
                {s.summary && <p className="text-caption text-qm-text-secondary line-clamp-3 mt-0.5">{s.summary}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h4 className="flex items-center gap-1 text-caption font-semibold uppercase tracking-wider text-qm-text-tertiary mb-1.5">
          <StickyNote size={11} /> {t('briefing.notes')}
        </h4>
        {notes.length === 0 ? (
          <p className="text-caption text-qm-text-disabled">{t('briefing.noNotes')}</p>
        ) : (
          <div className="space-y-1.5">
            {notes.map((n) => (
              <div key={n.id} className="rounded-qm-md bg-qm-bg-tertiary/55 p-2">
                <p className="text-body-sm text-qm-text-primary whitespace-pre-wrap">{n.text}</p>
                <p className="text-caption-sm text-qm-text-tertiary mt-0.5">{formatDate(n.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
