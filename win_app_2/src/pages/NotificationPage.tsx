import { useEffect } from 'react'
import { MeetingReminder } from '@/components/overlay/MeetingReminder'

export function NotificationPage() {
  useEffect(() => {
    document.body.style.background = 'transparent'
    document.documentElement.style.background = 'transparent'

    return () => {
      document.body.style.background = ''
      document.documentElement.style.background = ''
    }
  }, [])

  return <MeetingReminder />
}
