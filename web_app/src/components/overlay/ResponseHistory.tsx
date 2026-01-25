// Queen Mama LITE - Response History Component
// Displays AI responses with streaming support

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { MarkdownRenderer } from '../shared/MarkdownRenderer';
import { Badge } from '../ui/Badge';
import type { AIResponse } from '../../types';

export interface ResponseHistoryProps {
  responses: AIResponse[];
  currentResponse: string;
  isProcessing: boolean;
  interimText?: string;
}

export function ResponseHistory({
  responses,
  currentResponse,
  isProcessing,
  interimText,
}: ResponseHistoryProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest response
  useEffect(() => {
    if (scrollRef.current && (currentResponse || responses.length)) {
      scrollRef.current.scrollTop = 0;
    }
  }, [currentResponse, responses.length]);

  const isEmpty = !isProcessing && !currentResponse && responses.length === 0;

  return (
    <div
      ref={scrollRef}
      className="h-[180px] overflow-y-auto rounded-qm-md bg-qm-surface-light mb-3"
    >
      <div className="p-3 space-y-3">
        {/* Processing Indicator */}
        {isProcessing && !currentResponse && (
          <ProcessingIndicator />
        )}

        {/* Current Streaming Response */}
        {currentResponse && (
          <ResponseItem
            content={currentResponse}
            isStreaming={true}
            timestamp={new Date().toISOString()}
          />
        )}

        {/* Response History */}
        <AnimatePresence>
          {responses.map((response) => (
            <motion.div
              key={response.id}
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
            >
              <ResponseItem
                content={response.content}
                type={response.type}
                provider={response.provider}
                timestamp={response.timestamp}
                isAutomatic={response.isAutomatic}
                hasScreenshot={response.hasScreenshot}
              />
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Interim Transcript */}
        {interimText && (
          <div className="text-qm-caption text-qm-text-tertiary italic px-2">
            {interimText}...
          </div>
        )}

        {/* Empty State */}
        {isEmpty && <EmptyState />}
      </div>
    </div>
  );
}

// Processing Indicator
function ProcessingIndicator() {
  return (
    <div className="flex items-center gap-2 px-3 py-2">
      <div className="flex gap-1">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="w-1.5 h-1.5 rounded-full bg-qm-accent"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [1, 0.5, 1],
            }}
            transition={{
              duration: 0.6,
              repeat: Infinity,
              delay: i * 0.2,
            }}
          />
        ))}
      </div>
      <span className="text-qm-body-sm text-qm-text-secondary">Analyzing...</span>
    </div>
  );
}

// Provider Icons
const ProviderIcon: React.FC<{ provider: string; className?: string }> = ({ provider, className }) => {
  const lowerProvider = provider.toLowerCase();

  if (lowerProvider.includes('openai') || lowerProvider.includes('gpt')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364l2.0201-1.1638a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z"/>
      </svg>
    );
  }

  if (lowerProvider.includes('anthropic') || lowerProvider.includes('claude')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.3033 3.8465H14.6554L20.8026 20.1538h2.6479L17.3033 3.8465ZM6.6967 3.8465.5495 20.1538h2.7095l1.269-3.3962h6.4833l1.2576 3.3962h2.7096L8.8459 3.8465H6.6967Zm.2571 10.4903 2.287-6.122 2.2869 6.122H6.9538Z"/>
      </svg>
    );
  }

  if (lowerProvider.includes('gemini') || lowerProvider.includes('google')) {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
      </svg>
    );
  }

  // Default sparkle icon
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  );
};

// Response Item
interface ResponseItemProps {
  content: string;
  type?: string;
  provider?: string;
  timestamp: string;
  isStreaming?: boolean;
  isAutomatic?: boolean;
  hasScreenshot?: boolean;
}

function ResponseItem({
  content,
  type,
  provider,
  timestamp,
  isStreaming,
  isAutomatic,
  hasScreenshot,
}: ResponseItemProps) {
  return (
    <div
      className={clsx(
        'response-item',
        isStreaming && 'streaming',
        isAutomatic && 'auto'
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        {isAutomatic ? (
          <Badge variant="auto" size="sm">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AUTO
          </Badge>
        ) : type ? (
          <Badge variant="accent" size="sm">
            {type.toUpperCase()}
          </Badge>
        ) : null}

        <span className="flex-1" />

        {/* Screenshot indicator */}
        {hasScreenshot && (
          <div className="flex items-center gap-1 text-[9px] text-qm-text-tertiary">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}

        {/* Provider icon */}
        {provider && (
          <div className="flex items-center gap-1 text-qm-text-tertiary" title={provider}>
            <ProviderIcon provider={provider} className="w-3 h-3" />
          </div>
        )}

        <span className="text-[9px] text-qm-text-tertiary">
          {formatRelativeTime(timestamp)}
        </span>

        {isStreaming && (
          <motion.div
            className="w-1.5 h-1.5 rounded-full bg-qm-accent"
            animate={{ opacity: [1, 0.3, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          />
        )}
      </div>

      {/* Content */}
      <MarkdownRenderer content={content} />
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center">
      <div className="w-12 h-12 rounded-full bg-qm-gradient/20 flex items-center justify-center mb-3">
        <svg
          className="w-6 h-6 text-qm-accent"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
          />
        </svg>
      </div>
      <p className="text-qm-body-sm text-qm-text-secondary mb-1">Ready to assist</p>
      <p className="text-qm-caption text-qm-text-tertiary">
        Press <kbd className="kbd">⌘</kbd><kbd className="kbd">↩</kbd> or click a tab
      </p>
    </div>
  );
}

// Format relative timestamp (e.g., "now", "5s ago", "2m ago")
function formatRelativeTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffSec = Math.floor(diffMs / 1000);

    if (diffSec < 5) return 'now';
    if (diffSec < 60) return `${diffSec}s ago`;

    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;

    // Fall back to time format for older items
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return '';
  }
}

export default ResponseHistory;
