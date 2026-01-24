// Queen Mama LITE - Tab Bar Component
// Response type selection tabs

import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { TabItem } from '../../types';
import { TAB_ITEMS } from '../../types';

export interface TabBarProps {
  selectedTab: TabItem;
  onTabSelect: (tab: TabItem) => void;
  isProcessing: boolean;
}

// Icon components for tabs
const TabIcons: Record<TabItem, React.FC<{ className?: string }>> = {
  assist: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
    </svg>
  ),
  whatToSay: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  ),
  followUp: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  recap: ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  ),
};

export function TabBar({ selectedTab, onTabSelect, isProcessing }: TabBarProps) {
  return (
    <div className="flex items-center gap-0.5 p-1 bg-qm-surface-light rounded-qm-md mb-3">
      {TAB_ITEMS.map((tab) => {
        const isSelected = selectedTab === tab.id;
        const Icon = TabIcons[tab.id];

        return (
          <button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            disabled={isProcessing}
            className={clsx(
              'relative flex-1 flex items-center justify-center gap-1 py-1.5 rounded-qm-sm',
              'text-[10px] font-medium transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSelected
                ? 'text-qm-accent'
                : 'text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-hover'
            )}
          >
            {/* Active background */}
            {isSelected && (
              <motion.div
                layoutId="activeTabBg"
                className="absolute inset-0 bg-qm-accent/20 rounded-qm-sm"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              />
            )}

            <Icon className="relative w-3 h-3" />
            <span className="relative">{tab.shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}

export default TabBar;
