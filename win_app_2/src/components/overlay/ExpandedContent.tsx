import { TabBar } from './TabBar'
import { ResponseDisplay } from './ResponseDisplay'
import { ActionBar } from './ActionBar'
import { InputBar } from './InputBar'
import { FinalizationIndicator } from './FinalizationIndicator'

export function ExpandedContent() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TabBar />
      <ResponseDisplay />
      <ActionBar />
      <FinalizationIndicator />
      <InputBar />
    </div>
  )
}
