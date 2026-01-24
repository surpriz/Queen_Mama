// Queen Mama LITE - Tabs Component

import { createContext, useContext, useState, forwardRef, HTMLAttributes } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';

// Context for tab state
interface TabsContextValue {
  activeTab: string;
  setActiveTab: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

const useTabsContext = () => {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs components must be used within a Tabs provider');
  }
  return context;
};

// Tabs Root
export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
}

export const Tabs = forwardRef<HTMLDivElement, TabsProps>(
  ({ className, defaultValue, value, onValueChange, children, ...props }, ref) => {
    const [internalValue, setInternalValue] = useState(defaultValue || '');

    const activeTab = value !== undefined ? value : internalValue;
    const setActiveTab = (newValue: string) => {
      if (value === undefined) {
        setInternalValue(newValue);
      }
      onValueChange?.(newValue);
    };

    return (
      <TabsContext.Provider value={{ activeTab, setActiveTab }}>
        <div ref={ref} className={twMerge('w-full', className)} {...props}>
          {children}
        </div>
      </TabsContext.Provider>
    );
  }
);

Tabs.displayName = 'Tabs';

// Tabs List
export interface TabsListProps extends HTMLAttributes<HTMLDivElement> {}

export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <div
        ref={ref}
        role="tablist"
        className={twMerge(
          'inline-flex items-center gap-0.5 p-1 bg-qm-surface-light rounded-qm-md',
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);

TabsList.displayName = 'TabsList';

// Tabs Trigger
export interface TabsTriggerProps extends HTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  disabled?: boolean;
}

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, icon, disabled, children, ...props }, ref) => {
    const { activeTab, setActiveTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <button
        ref={ref}
        role="tab"
        aria-selected={isActive}
        aria-disabled={disabled}
        disabled={disabled}
        onClick={() => setActiveTab(value)}
        className={twMerge(
          clsx(
            'relative inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-medium rounded-qm-sm',
            'transition-all duration-150 ease-in-out cursor-pointer border-none',
            'focus:outline-none focus:ring-2 focus:ring-qm-accent focus:ring-offset-1 focus:ring-offset-qm-bg-primary',
            'disabled:opacity-50 disabled:cursor-not-allowed',
            isActive
              ? 'text-qm-accent'
              : 'text-qm-text-secondary hover:text-qm-text-primary hover:bg-qm-surface-hover',
            className
          )
        )}
        {...props}
      >
        {/* Active background indicator */}
        {isActive && (
          <motion.div
            layoutId="activeTab"
            className="absolute inset-0 bg-qm-accent/20 rounded-qm-sm"
            initial={false}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        )}
        {icon && <span className="relative z-10 flex-shrink-0">{icon}</span>}
        <span className="relative z-10">{children}</span>
      </button>
    );
  }
);

TabsTrigger.displayName = 'TabsTrigger';

// Tabs Content
export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { activeTab } = useTabsContext();
    const isActive = activeTab === value;

    return (
      <AnimatePresence mode="wait">
        {isActive && (
          <motion.div
            ref={ref}
            role="tabpanel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className={twMerge('focus:outline-none', className)}
            {...props}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    );
  }
);

TabsContent.displayName = 'TabsContent';

export default Tabs;
