'use client';;
import * as React from 'react';
import { useTheme } from 'next-themes';

import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsContents, useTabs } from '@/components/ui/shadcn-io/tabs';
import { CopyButton } from '@/components/ui/shadcn-io/copy-button';

function CodeTabsContent({
  codes,
  lang = 'bash',

  themes = {
    light: 'Vitesse Light',
    dark: 'Material Theme',
  },

  copyButton = true,
  onCopy
}) {
  const { resolvedTheme } = useTheme();
  const { activeValue } = useTabs();

  console.log('Resolved Theme:', resolvedTheme);
  console.log('Active Tab:', activeValue);

  const [highlightedCodes, setHighlightedCodes] = React.useState(codes); // Start with raw codes for instant rendering

  React.useEffect(() => {
    async function loadHighlightedCode() {
      try {
        const { codeToHtml } = await import('shiki');
        const newHighlightedCodes = {};

        for (const [command, val] of Object.entries(codes)) {
          const highlighted = await codeToHtml(val, {
            lang,
            themes: {
              light: themes.light,
              dark: themes.dark,
            },
            defaultColor: resolvedTheme === 'dark' ? 'dark' : 'light',
          });

          newHighlightedCodes[command] = highlighted;
        }

        setHighlightedCodes(newHighlightedCodes);
      } catch (error) {
        console.error('Error highlighting codes', error);
      }
    }
    loadHighlightedCode();
  }, [resolvedTheme, lang, themes.light, themes.dark, codes]);

  return (
    <>
      <TabsList
        data-slot="install-tabs-list"
        className="w-full relative justify-between rounded-none h-10 bg-muted border-b border-border/75 dark:border-border/50 text-current py-0 px-4"
        activeClassName="rounded-none shadow-none bg-transparent after:content-[''] after:absolute after:inset-x-0 after:h-0.5 after:bottom-0 dark:after:bg-white after:bg-black after:rounded-t-full">
        <div className="flex gap-x-3 h-full">
          {Object.keys(codes).map((code) => (
            <TabsTrigger
              key={code}
              value={code}
              className="text-muted-foreground data-[state=active]:text-current px-0">
              {code}
            </TabsTrigger>
          ))}
        </div>

        {copyButton && (
          <CopyButton
            content={codes[activeValue]}
            size="sm"
            variant="ghost"
            className="-me-2 bg-transparent hover:bg-black/5 dark:hover:bg-white/10"
            onCopy={onCopy} />
        )}
      </TabsList>
      <TabsContents data-slot="install-tabs-contents">
        {Object.entries(codes).map(([code, rawCode]) => (
          <TabsContent
            data-slot="install-tabs-content"
            key={code}
            className="w-full text-sm flex items-center p-4 overflow-auto"
            value={code}>
            <div
              className="w-full [&>pre]:m-0 [&>pre]:p-0 [&>pre]:bg-muted [&>pre]:border-none [&>pre]:text-[13px] [&>pre]:leading-relaxed [&_code]:text-[13px] [&_code]:leading-relaxed [&_code]:bg-transparent">
              {highlightedCodes[code] !== rawCode ? (
                <div dangerouslySetInnerHTML={{ __html: highlightedCodes[code] }} />
              ) : (
                <pre className='rounded-2xl'>
                  <code className='rounded-2xl'>{rawCode}</code>
                </pre>
              )}
            </div>
          </TabsContent>
        ))}
      </TabsContents>
    </>
  );
}

function CodeTabs({
  codes,
  lang = 'bash',

  themes = {
    light: 'Vitesse Light',
    dark: 'Material Theme',
  },

  className,
  defaultValue,
  value,
  onValueChange,
  copyButton = true,
  onCopy,
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
      <CodeTabsContent
        codes={codes}
        lang={lang}
        themes={themes}
        copyButton={copyButton}
        onCopy={onCopy} />
    </Tabs>
  );
}

export { CodeTabs };