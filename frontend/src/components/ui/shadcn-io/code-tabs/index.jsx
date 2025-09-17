'use client';;
import * as React from 'react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsContents, useTabs } from '@/components/ui/shadcn-io/tabs';


function CodeTabs({
  codes,

  className,
  defaultValue,
  value,
  onValueChange,
  ...props
}) {
  const firstKey = React.useMemo(() => Object.keys(codes)[0] ?? '', [codes]);

  // Handle controlled vs uncontrolled properly
  const tabsProps = value !== undefined 
    ? { value, onValueChange } 
    : { defaultValue: defaultValue ?? firstKey };

  return (
    <Tabs
      data-slot="install-tabs"
      className={cn('w-full gap-0 bg-muted/50 rounded-xl border overflow-hidden', className)}
      {...tabsProps}
      {...props}>
      {/* <MonacoEditorContent codes={codes} {...props} /> */}
    </Tabs>
  );
}

export { CodeTabs };