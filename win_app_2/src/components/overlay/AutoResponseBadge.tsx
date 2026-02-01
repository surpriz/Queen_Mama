import { Zap } from 'lucide-react'

export function AutoResponseBadge() {
  return (
    <div
      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider bg-qm-auto-answer/20 text-qm-auto-answer border border-qm-auto-answer/30"
      title="Auto-generated response"
    >
      <Zap size={8} fill="currentColor" />
      AUTO
    </div>
  )
}
