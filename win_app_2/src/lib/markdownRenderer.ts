/** Strip markdown formatting for plain text display */
export function stripMarkdown(text: string): string {
  return text
    .replace(/#{1,6}\s+/g, '')      // headers
    .replace(/\*\*(.+?)\*\*/g, '$1') // bold
    .replace(/\*(.+?)\*/g, '$1')     // italic
    .replace(/`(.+?)`/g, '$1')       // inline code
    .replace(/```[\s\S]*?```/g, '')   // code blocks
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // links
    .replace(/^\s*[-*+]\s+/gm, '- ') // list items
    .replace(/^\s*\d+\.\s+/gm, '')   // numbered lists
    .trim()
}

/** Count words in text */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}
