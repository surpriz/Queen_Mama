// Queen Mama LITE - Response History Component
// Displays AI responses with streaming support

import { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
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

// Response Item
interface ResponseItemProps {
  content: string;
  type?: string;
  provider?: string;
  timestamp: string;
  isStreaming?: boolean;
  isAutomatic?: boolean;
}

function ResponseItem({
  content,
  type,
  provider,
  timestamp,
  isStreaming,
  isAutomatic,
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

        {provider && (
          <span className="text-[9px] text-qm-text-tertiary uppercase">{provider}</span>
        )}

        <span className="text-[9px] text-qm-text-tertiary">
          {formatTime(timestamp)}
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

// Format timestamp
function formatTime(timestamp: string): string {
  try {
    const date = new Date(timestamp);
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
