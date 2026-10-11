import { useEffect, useState } from 'react'
import mermaid from 'mermaid'

let mermaidReady = false
function ensureMermaid() {
  if (mermaidReady) return
  // 'strict' → mermaid sanitizes its SVG output (bundled DOMPurify) and disables
  // click/HTML labels. Required since we inject the SVG as live DOM below.
  mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'strict' })
  mermaidReady = true
}

// Stable id per source so re-renders of the same code don't leave throwaway
// DOM nodes behind (mermaid.render creates a temporary element per id).
let seq = 0
const idBySource = new Map<string, string>()
function idFor(code: string): string {
  let id = idBySource.get(code)
  if (!id) {
    id = `qm-mermaid-${seq++}`
    idBySource.set(code, id)
    if (idBySource.size > 200) {
      const first = idBySource.keys().next().value
      if (first !== undefined) idBySource.delete(first)
    }
  }
  return id
}

/** Mermaid fenced block → inline SVG. Lazy-loaded by ResponseDisplay. */
export default function MermaidDiagram({ code }: { code: string }) {
  const [svg, setSvg] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    ensureMermaid()
    mermaid
      .render(idFor(code), code)
      .then(({ svg }) => {
        if (!cancelled) setSvg(svg)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [code])

  if (failed) {
    return <pre className="text-qm-text-tertiary text-xs whitespace-pre-wrap">{code}</pre>
  }
  if (!svg) {
    return <div className="text-qm-text-tertiary text-xs">Rendering diagram…</div>
  }
  return <div className="my-2 overflow-x-auto" dangerouslySetInnerHTML={{ __html: svg }} />
}
