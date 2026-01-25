// Queen Mama LITE - Tab Bar Component
// Response type selection tabs with gradient background for selected state

import { motion } from 'framer-motion';
import { clsx } from 'clsx';
import type { TabItem } from '../../types';
import { TAB_ITEMS } from '../../types';

export interface TabBarProps {
  selectedTab: TabItem;
  onTabSelect: (tab: TabItem) => void;
  isProcessing: boolean;
}

// Icon components for tabs - matching macOS app sparkle style for Assist
const TabIcons: Record<TabItem, React.FC<{ className?: string }>> = {
  assist: ({ className }) => (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 2L13.09 8.26L18 6L15.74 10.91L22 12L15.74 13.09L18 18L13.09 15.74L12 22L10.91 15.74L6 18L8.26 13.09L2 12L8.26 10.91L6 6L10.91 8.26L12 2Z" />
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
    <div className="flex items-center gap-1 p-1 bg-qm-surface-light rounded-qm-lg mb-3">
      {TAB_ITEMS.map((tab) => {
        const isSelected = selectedTab === tab.id;
        const Icon = TabIcons[tab.id];

        return (
          <motion.button
            key={tab.id}
            onClick={() => onTabSelect(tab.id)}
            disabled={isProcessing}
            className={clsx(
              'relative flex-1 flex items-center justify-center gap-1.5 py-2 rounded-qm-md',
              'text-[11px] font-medium transition-colors duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              isSelected
                ? 'text-white'
                : 'text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-hover'
            )}
            whileHover={!isSelected ? { scale: 1.02 } : undefined}
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          >
            {/* Active gradient background - matching macOS app purple gradient */}
            {isSelected && (
              <motion.div
                layoutId="activeTabBg"
                className="absolute inset-0 bg-qm-gradient rounded-qm-md shadow-qm-glow-subtle"
                initial={false}
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}

            <Icon className={clsx('relative w-3 h-3', isSelected && 'text-white')} />
            <span className="relative">{tab.shortLabel}</span>
          </motion.button>
        );
      })}
    </div>
  );
}

export default TabBar;
