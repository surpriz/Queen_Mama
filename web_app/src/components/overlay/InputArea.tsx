// Queen Mama LITE - Input Area Component
// Text input with smart mode toggle and submit button

import { useState, useRef, useEffect } from 'react';
import { clsx } from 'clsx';
import { IconButton } from '../ui/Button';
import { KeyboardShortcut } from '../shared/KeyboardShortcut';
import { useSettingsStore } from '../../stores/settingsStore';

export interface InputAreaProps {
  onSubmit: (customPrompt?: string) => void;
  isProcessing: boolean;
  smartModeEnabled: boolean;
}

export function InputArea({ onSubmit, isProcessing, smartModeEnabled }: InputAreaProps) {
  const [inputText, setInputText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { setSmartModeEnabled } = useSettingsStore();

  // Handle submit
  const handleSubmit = () => {
    if (inputText.trim()) {
      onSubmit(inputText.trim());
      setInputText('');
    } else {
      onSubmit();
    }
  };

  // Handle key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.metaKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="flex items-center gap-2 p-2 bg-qm-surface-light rounded-qm-lg border border-qm-border-subtle">
      {/* Smart Mode Toggle */}
      <button
        onClick={() => setSmartModeEnabled(!smartModeEnabled)}
        className={clsx(
          'flex items-center gap-1 px-2 py-1.5 rounded-full text-[10px] font-medium transition-colors',
          smartModeEnabled
            ? 'bg-qm-accent/15 text-qm-accent'
            : 'bg-transparent text-qm-text-tertiary hover:text-qm-text-secondary'
        )}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        Smart
      </button>

      {/* Text Input */}
      <input
        ref={inputRef}
        type="text"
        value={inputText}
        onChange={(e) => setInputText(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Ask about your screen or conversation..."
        disabled={isProcessing}
        className={clsx(
          'flex-1 bg-transparent border-none text-qm-body-sm text-qm-text-primary',
          'placeholder:text-qm-text-tertiary focus:outline-none',
          'disabled:opacity-50'
        )}
      />

      {/* Shortcut Hint */}
      {!inputText && (
        <KeyboardShortcut shortcut="Cmd+Enter" size="sm" className="opacity-50" />
      )}

      {/* Submit Button with gradient glow */}
      <IconButton
        aria-label="Submit"
        variant="primary"
        size="sm"
        onClick={handleSubmit}
        disabled={isProcessing}
        className="flex-shrink-0 hover:shadow-qm-glow-strong transition-shadow"
      >
        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
        </svg>
      </IconButton>
    </div>
  );
}

export default InputArea;
