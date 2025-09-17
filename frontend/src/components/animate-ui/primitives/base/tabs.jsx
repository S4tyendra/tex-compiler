'use client';;
import * as React from 'react';
import { Tabs as TabsPrimitive } from '@base-ui-components/react/tabs';
import { motion, AnimatePresence } from 'motion/react';

import { Highlight, HighlightItem } from '@/components/animate-ui/primitives/effects/highlight';
import { getStrictContext } from '@/lib/get-strict-context';
import { useControlledState } from '@/hooks/use-controlled-state';
import { AutoHeight } from '@/components/animate-ui/primitives/effects/auto-height';

const [TabsProvider, useTabs] =
  getStrictContext('TabsContext');

function Tabs(props) {
  const [value, setValue] = useControlledState({
    value: props.value,
    defaultValue: props.defaultValue,
    onChange: props.onValueChange,
  });

  return (
    <TabsProvider value={{ value, setValue }}>
      <TabsPrimitive.Root data-slot="tabs" {...props} onValueChange={setValue} />
    </TabsProvider>
  );
}

function TabsHighlight({
  transition = { type: 'spring', stiffness: 200, damping: 25 },
  ...props
}) {
  const { value } = useTabs();

  return (
    <Highlight
      data-slot="tabs-highlight"
      controlledItems
      value={value}
      transition={transition}
      click={false}
      {...props} />
  );
}

function TabsList(props) {
  return <TabsPrimitive.List data-slot="tabs-list" {...props} />;
}

function TabsHighlightItem(props) {
  return <HighlightItem data-slot="tabs-highlight-item" {...props} />;
}

function TabsTab(props) {
  return <TabsPrimitive.Tab data-slot="tabs-tab" {...props} />;
}

function TabsPanel({
  value,
  keepMounted,
  transition = { duration: 0.5, ease: 'easeInOut' },
  ...props
}) {
  return (
    <AnimatePresence mode="wait">
      <TabsPrimitive.Panel
        render={
          <motion.div
            data-slot="tabs-panel"
            layout
            layoutDependency={value}
            initial={{ opacity: 0, filter: 'blur(4px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(4px)' }}
            transition={transition}
            {...props} />
        }
        keepMounted={keepMounted}
        value={value} />
    </AnimatePresence>
  );
}

const defaultTransition = {
  type: 'spring',
  stiffness: 200,
  damping: 30,
};

function isAutoMode(props) {
  return !props.mode || props.mode === 'auto-height';
}

function TabsPanels(props) {
  const { value } = useTabs();

  if (isAutoMode(props)) {
    const { children, transition = defaultTransition, ...autoProps } = props;

    return (
      <AutoHeight
        data-slot="tabs-panels"
        deps={[value]}
        transition={transition}
        {...autoProps}>
        <React.Fragment key={value}>{children}</React.Fragment>
      </AutoHeight>
    );
  }

  const {
    children,
    style,
    transition = defaultTransition,
    ...layoutProps
  } = props;

  return (
    <motion.div
      data-slot="tabs-panels"
      layout="size"
      layoutDependency={value}
      transition={{ layout: transition }}
      style={{ overflow: 'hidden', ...style }}
      {...layoutProps}>
      <React.Fragment key={value}>{children}</React.Fragment>
    </motion.div>
  );
}

export { Tabs, TabsHighlight, TabsHighlightItem, TabsList, TabsTab, TabsPanel, TabsPanels };
