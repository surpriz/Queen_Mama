import { TabBar } from './TabBar'
import { ResponseDisplay } from './ResponseDisplay'
import { InputBar } from './InputBar'

export function ExpandedContent() {
  return (
    <div className="flex flex-col flex-1 bg-qm-overlay border border-qm-border-subtle border-t-0 rounded-b-qm-xl overflow-hidden">
      <TabBar />
      <ResponseDisplay />
      <InputBar />
    </div>
  )
}
