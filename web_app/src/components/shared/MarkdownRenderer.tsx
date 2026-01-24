// Queen Mama LITE - Markdown Renderer Component

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { clsx } from 'clsx';

export interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  return (
    <div className={clsx('prose prose-sm prose-invert max-w-none', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Headings
          h1: ({ children }) => (
            <h1 className="text-lg font-bold text-qm-text-primary mt-4 mb-2 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold text-qm-text-primary mt-3 mb-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-qm-text-primary mt-2 mb-1">
              {children}
            </h3>
          ),

          // Paragraphs
          p: ({ children }) => (
            <p className="text-qm-body-sm text-qm-text-primary mb-2 last:mb-0 leading-relaxed">
              {children}
            </p>
          ),

          // Lists
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-qm-body-sm text-qm-text-primary">{children}</li>
          ),

          // Code
          code: ({ className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '');
            const isInline = !match;

            if (isInline) {
              return (
                <code
                  className="px-1 py-0.5 bg-qm-surface-medium rounded text-[11px] font-mono text-qm-accent"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <code
                className={clsx(
                  'block p-3 bg-qm-bg-secondary rounded-qm-md text-[11px] font-mono overflow-x-auto',
                  className
                )}
                {...props}
              >
                {children}
              </code>
            );
          },

          // Block elements
          pre: ({ children }) => (
            <pre className="bg-qm-bg-secondary rounded-qm-md overflow-hidden mb-2">
              {children}
            </pre>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-qm-accent pl-3 my-2 text-qm-text-secondary italic">
              {children}
            </blockquote>
          ),

          // Links
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-qm-accent hover:underline"
            >
              {children}
            </a>
          ),

          // Emphasis
          strong: ({ children }) => (
            <strong className="font-semibold text-qm-text-primary">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-qm-text-secondary">{children}</em>
          ),

          // Horizontal rule
          hr: () => <hr className="border-qm-border-subtle my-3" />,

          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-2">
              <table className="min-w-full text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-qm-surface-light">{children}</thead>
          ),
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => (
            <tr className="border-b border-qm-border-subtle">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-2 py-1 text-left font-semibold text-qm-text-primary">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-2 py-1 text-qm-text-secondary">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownRenderer;
