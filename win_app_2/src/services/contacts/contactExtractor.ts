import * as proxyApi from '@/services/proxy/proxyApiClient'
import { createLogger } from '@/lib/logger'
import type { Contact } from '@/types/models'
import * as contactDb from './contactDb'

const log = createLogger('ContactExtractor')

interface ExtractedContact {
  name: string
  role?: string
  company?: string
}

export async function extractContactsFromTranscript(
  transcript: string,
  sessionId: string,
): Promise<Contact[]> {
  if (transcript.length < 100) {
    log.info('Transcript too short for contact extraction')
    return []
  }

  try {
    const extractionPrompt = `Extract all people/contacts mentioned in this transcript. Return ONLY a valid JSON array. Each element should have: name (required), role (optional), company (optional). If no people are mentioned, return an empty array [].

Example: [{"name": "John Smith", "role": "CTO", "company": "Acme Corp"}]

Transcript:
${transcript.slice(-4000)}`

    const response = await proxyApi.generateAIResponse({
      model: 'auto',
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract people mentioned in conversations. Return ONLY valid JSON, no markdown, no explanation.',
        },
        { role: 'user', content: extractionPrompt },
      ],
      max_tokens: 500,
      temperature: 0.1,
    })

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = response.trim()
    const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (codeBlockMatch) {
      jsonStr = codeBlockMatch[1].trim()
    }

    const extracted: ExtractedContact[] = JSON.parse(jsonStr)

    if (!Array.isArray(extracted) || extracted.length === 0) {
      log.info('No contacts extracted')
      return []
    }

    const now = new Date().toISOString()
    const contacts: Contact[] = []

    for (const person of extracted) {
      if (!person.name || person.name.trim().length < 2) continue

      // Check if contact already exists by name
      const existing = await contactDb.searchContacts(person.name.trim())
      const match = existing.find(
        (c) => c.name.toLowerCase() === person.name.trim().toLowerCase()
      )

      if (match) {
        // Update existing contact
        const updated: Contact = {
          ...match,
          role: person.role || match.role,
          company: person.company || match.company,
          lastSeen: now,
          sessionCount: match.sessionCount + 1,
          updatedAt: now,
        }
        await contactDb.upsertContact(updated)
        await contactDb.linkContactToSession(match.id, sessionId)
        contacts.push(updated)
      } else {
        // Create new contact
        const newContact: Contact = {
          id: crypto.randomUUID(),
          name: person.name.trim(),
          role: person.role,
          company: person.company,
          notes: '',
          lastSeen: now,
          sessionCount: 1,
          createdAt: now,
          updatedAt: now,
        }
        await contactDb.upsertContact(newContact)
        await contactDb.linkContactToSession(newContact.id, sessionId)
        contacts.push(newContact)
      }
    }

    log.info(`Extracted ${contacts.length} contacts from transcript`)
    return contacts
  } catch (error) {
    log.error('Contact extraction failed:', error)
    return []
  }
}
