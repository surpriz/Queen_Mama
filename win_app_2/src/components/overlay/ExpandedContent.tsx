import { TabBar } from './TabBar'
import { ResponseDisplay } from './ResponseDisplay'
import { ActionBar } from './ActionBar'
import { InputBar } from './InputBar'

export function ExpandedContent() {
  return (
    <div className="flex flex-col flex-1 overflow-hidden">
      <TabBar />
      <ResponseDisplay />
      <ActionBar />
      <InputBar />
    </div>
  )
}
