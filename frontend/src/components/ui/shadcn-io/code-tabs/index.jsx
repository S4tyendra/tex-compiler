'use client';
import * as React from 'react';
import { useTheme } from 'next-themes';
import Editor from '@monaco-editor/react';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger, TabsContents, useTabs } from '@/components/ui/shadcn-io/tabs';

// Custom debounce implementation
const useDebounce = (callback, delay) => {
  const timeoutRef = React.useRef(null);
  
  const debouncedCallback = React.useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
  
  React.useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
};

// Comprehensive LaTeX keywords and commands for autocomplete
const latexKeywords = [
  // Document structure
  'documentclass', 'usepackage', 'begin', 'end', 'input', 'include', 'includeonly',
  
  // Sectioning
  'part', 'chapter', 'section', 'subsection', 'subsubsection', 'paragraph', 'subparagraph',
  
  // Document metadata
  'title', 'author', 'date', 'maketitle', 'thanks', 'and',
  
  // Text formatting
  'textbf', 'textit', 'texttt', 'textsc', 'textsl', 'textsf', 'textrm', 'textup', 'textmd',
  'emph', 'underline', 'overline', 'sout', 'uline', 'uuline', 'uwave',
  'tiny', 'scriptsize', 'footnotesize', 'small', 'normalsize', 'large', 'Large', 'LARGE', 'huge', 'Huge',
  
  // Math mode
  'equation', 'align', 'gather', 'multline', 'split', 'cases', 'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
  'frac', 'dfrac', 'tfrac', 'sqrt', 'sum', 'prod', 'int', 'oint', 'iint', 'iiint',
  'lim', 'sup', 'inf', 'max', 'min', 'arg', 'det', 'exp', 'ln', 'log', 'sin', 'cos', 'tan',
  'arcsin', 'arccos', 'arctan', 'sinh', 'cosh', 'tanh', 'sec', 'csc', 'cot',
  
  // Greek letters
  'alpha', 'beta', 'gamma', 'delta', 'epsilon', 'varepsilon', 'zeta', 'eta', 'theta', 'vartheta',
  'iota', 'kappa', 'lambda', 'mu', 'nu', 'xi', 'pi', 'varpi', 'rho', 'varrho', 'sigma', 'varsigma',
  'tau', 'upsilon', 'phi', 'varphi', 'chi', 'psi', 'omega',
  'Gamma', 'Delta', 'Theta', 'Lambda', 'Xi', 'Pi', 'Sigma', 'Upsilon', 'Phi', 'Psi', 'Omega',
  
  // Lists and environments
  'itemize', 'enumerate', 'description', 'item', 'trivlist',
  'quote', 'quotation', 'verse', 'verbatim', 'flushleft', 'flushright', 'center',
  
  // Tables and figures
  'table', 'figure', 'tabular', 'longtable', 'array', 'includegraphics', 'caption', 'label',
  'hline', 'cline', 'multicolumn', 'multirow',
  
  // References and citations
  'cite', 'citet', 'citep', 'citeauthor', 'citeyear', 'ref', 'eqref', 'pageref', 'nameref',
  'bibliography', 'bibliographystyle', 'bibitem',
  
  // Spacing and layout
  'newpage', 'clearpage', 'cleardoublepage', 'pagebreak', 'nopagebreak', 'linebreak', 'nolinebreak',
  'newline', 'hspace', 'vspace', 'hfill', 'vfill', 'smallskip', 'medskip', 'bigskip',
  'noindent', 'indent', 'par', 'parbox', 'minipage',
  
  // Cross-references
  'tableofcontents', 'listoffigures', 'listoftables', 'appendix', 'index', 'glossary',
  
  // Special characters and symbols
  'textbackslash', 'textbar', 'textless', 'textgreater', 'textasciitilde', 'textasciicircum',
  'textquoteleft', 'textquoteright', 'textquotedblleft', 'textquotedblright',
  'ldots', 'cdots', 'vdots', 'ddots', 'dots'
];

// Comprehensive BibTeX entry types and fields
const bibKeywords = [
  // Entry types
  'article', 'book', 'booklet', 'conference', 'inbook', 'incollection', 'inproceedings',
  'manual', 'mastersthesis', 'misc', 'phdthesis', 'proceedings', 'techreport', 'unpublished',
  'online', 'thesis', 'collection', 'patent', 'report', 'software', 'dataset',
  
  // Standard fields
  'author', 'title', 'journal', 'year', 'volume', 'number', 'pages', 'month', 'note',
  'publisher', 'address', 'editor', 'booktitle', 'chapter', 'school', 'institution',
  'organization', 'series', 'edition', 'howpublished', 'type', 'key', 'annote',
  'crossref', 'doi', 'isbn', 'issn', 'url', 'urldate', 'eprint', 'archivePrefix',
  'primaryClass', 'abstract', 'keywords', 'language', 'location', 'subtitle'
];

// LaTeX environment completions
const latexEnvironments = [
  'document', 'equation', 'align', 'gather', 'multline', 'split', 'cases',
  'itemize', 'enumerate', 'description', 'figure', 'table', 'tabular',
  'matrix', 'pmatrix', 'bmatrix', 'vmatrix', 'Vmatrix',
  'theorem', 'lemma', 'proposition', 'corollary', 'definition', 'example', 'proof',
  'abstract', 'quotation', 'quote', 'verse', 'verbatim', 'center', 'flushleft', 'flushright'
];

// LaTeX packages suggestions
const latexPackages = [
  'amsmath', 'amsfonts', 'amssymb', 'amsthm', 'mathtools', 'geometry', 'graphicx',
  'hyperref', 'url', 'natbib', 'biblatex', 'babel', 'inputenc', 'fontenc',
  'xcolor', 'tikz', 'pgfplots', 'booktabs', 'array', 'longtable', 'multirow',
  'fancyhdr', 'setspace', 'enumitem', 'listings', 'algorithm2e', 'subcaption'
];

function MonacoEditorContent({ content, language, onChange, fileName, readOnly = false, onSave }) {
  const { theme, resolvedTheme } = useTheme();
  const editorRef = React.useRef(null);
  const [isLanguageRegistered, setIsLanguageRegistered] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);

  // Auto-save with debounce
  const debouncedSave = useDebounce((value) => {
    if (onChange && !readOnly) {
      onChange(value);
    }
  }, 500);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // Get the actual theme to use
  const editorTheme = mounted ? (resolvedTheme === 'dark' ? 'vs-dark' : 'vs-light') : 'vs-light';

  const handleEditorDidMount = (editor, monaco) => {
    editorRef.current = editor;
    
    // Add keyboard shortcuts
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (onSave) {
        onSave(editor.getValue());
      }
    });
    
    if (!isLanguageRegistered) {
      // Enhanced LaTeX language definition with better tokenization
      monaco.languages.register({ id: 'latex' });
      monaco.languages.setMonarchTokensProvider('latex', {
        tokenizer: {
          root: [
            // Commands with optional arguments
            [/\\[a-zA-Z@]+\*?(?=\s*\[)/, 'keyword', '@command_with_optional'],
            [/\\[a-zA-Z@]+\*?(?=\s*\{)/, 'keyword', '@command_with_required'],
            [/\\[a-zA-Z@]+\*?/, 'keyword'],
            [/\\[^a-zA-Z@]/, 'keyword'],
            
            // Environments with highlighting
            [/\\begin\{([^}]+)\}/, { token: 'keyword.control', next: '@environment.$1' }],
            [/\\end\{([^}]+)\}/, 'keyword.control'],
            
            // Math delimiters with proper nesting
            [/\$\$/, 'string.delimiter', '@mathDisplay'],
            [/\$/, 'string.delimiter', '@mathInline'],
            [/\\\[/, 'string.delimiter', '@mathDisplayBracket'],
            [/\\\(/, 'string.delimiter', '@mathInlineBracket'],
            
            // Braces and brackets with nesting
            [/\{/, 'delimiter.curly', '@braces'],
            [/\[/, 'delimiter.square', '@brackets'],
            
            // Comments
            [/%.*$/, 'comment'],
            
            // Special characters
            [/[&_^~]/, 'keyword.operator'],
            
            // Numbers
            [/\b\d+(\.\d+)?\b/, 'number'],
          ],
          
          command_with_optional: [
            [/\[/, 'delimiter.square', '@brackets'],
            [/\{/, 'delimiter.curly', '@braces'],
            [/[^\[\{\s]+/, '', '@pop'],
            [/\s+/, '', '@pop']
          ],
          
          command_with_required: [
            [/\{/, 'delimiter.curly', '@braces'],
            [/[^\{\s]+/, '', '@pop'],
            [/\s+/, '', '@pop']
          ],
          
          environment: [
            [/\\end\{$S2\}/, { token: 'keyword.control', next: '@pop' }],
            [/\\[a-zA-Z@]+/, 'keyword'],
            [/\$\$/, 'string.delimiter', '@mathDisplay'],
            [/\$/, 'string.delimiter', '@mathInline'],
            [/%.*$/, 'comment'],
            [/./, 'text']
          ],
          
          mathDisplay: [
            [/\$\$/, 'string.delimiter', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword.math'],
            [/[{}\[\]]/, 'delimiter.math'],
            [/[a-zA-Z]+/, 'variable.math'],
            [/./, 'string']
          ],
          
          mathInline: [
            [/\$/, 'string.delimiter', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword.math'],
            [/[{}\[\]]/, 'delimiter.math'],
            [/[a-zA-Z]+/, 'variable.math'],
            [/./, 'string']
          ],
          
          mathDisplayBracket: [
            [/\\\]/, 'string.delimiter', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword.math'],
            [/[{}\[\]]/, 'delimiter.math'],
            [/[a-zA-Z]+/, 'variable.math'],
            [/./, 'string']
          ],
          
          mathInlineBracket: [
            [/\\\)/, 'string.delimiter', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword.math'],
            [/[{}\[\]]/, 'delimiter.math'],
            [/[a-zA-Z]+/, 'variable.math'],
            [/./, 'string']
          ],
          
          braces: [
            [/\{/, 'delimiter.curly', '@braces'],
            [/\}/, 'delimiter.curly', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword'],
            [/%.*$/, 'comment'],
            [/./, 'text']
          ],
          
          brackets: [
            [/\[/, 'delimiter.square', '@brackets'],
            [/\]/, 'delimiter.square', '@pop'],
            [/\\[a-zA-Z@]+/, 'keyword'],
            [/%.*$/, 'comment'],
            [/./, 'text']
          ]
        }
      });

      // Enhanced BibTeX language definition
      monaco.languages.register({ id: 'bibtex' });
      monaco.languages.setMonarchTokensProvider('bibtex', {
        tokenizer: {
          root: [
            [/@[a-zA-Z]+/, 'keyword.control'],
            [/\{/, 'delimiter.curly', '@entry'],
            [/%.*$/, 'comment'],
          ],
          
          entry: [
            [/\}/, 'delimiter.curly', '@pop'],
            [/[a-zA-Z][a-zA-Z0-9_-]*\s*=/, 'attribute.name'],
            [/"([^"\\]|\\.)*"/, 'string'],
            [/\{[^}]*\}/, 'string'],
            [/[0-9]+/, 'number'],
            [/,/, 'delimiter'],
            [/./, 'text']
          ]
        }
      });

      // LaTeX autocompletion
      monaco.languages.registerCompletionItemProvider('latex', {
        triggerCharacters: ['\\', '{'],
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const suggestions = [];

          // Command completions
          if (textUntilPosition.endsWith('\\')) {
            suggestions.push(...latexKeywords.map(keyword => ({
              label: keyword,
              kind: monaco.languages.CompletionItemKind.Keyword,
              insertText: keyword,
              documentation: `LaTeX command: \\${keyword}`,
              detail: 'LaTeX Command'
            })));
          }

          // Environment completions
          if (textUntilPosition.includes('\\begin{')) {
            suggestions.push(...latexEnvironments.map(env => ({
              label: env,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: env,
              documentation: `LaTeX environment: ${env}`,
              detail: 'LaTeX Environment'
            })));
          }

          // Package completions
          if (textUntilPosition.includes('\\usepackage{')) {
            suggestions.push(...latexPackages.map(pkg => ({
              label: pkg,
              kind: monaco.languages.CompletionItemKind.Module,
              insertText: pkg,
              documentation: `LaTeX package: ${pkg}`,
              detail: 'LaTeX Package'
            })));
          }

          // Snippet completions
          suggestions.push(
            {
              label: 'figure',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: [
                'begin{figure}[htbp]',
                '\t\\centering',
                '\t\\includegraphics[width=0.8\\textwidth]{$1}',
                '\t\\caption{$2}',
                '\t\\label{fig:$3}',
                '\\end{figure}'
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert a figure environment',
              detail: 'Figure snippet'
            },
            {
              label: 'table',
              kind: monaco.languages.CompletionItemKind.Snippet,
              insertText: [
                'begin{table}[htbp]',
                '\t\\centering',
                '\t\\begin{tabular}{|c|c|}',
                '\t\t\\hline',
                '\t\t$1 & $2 \\\\',
                '\t\t\\hline',
                '\t\\end{tabular}',
                '\t\\caption{$3}',
                '\t\\label{tab:$4}',
                '\\end{table}'
              ].join('\n'),
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: 'Insert a table environment',
              detail: 'Table snippet'
            }
          );

          return { suggestions };
        }
      });

      // BibTeX autocompletion
      monaco.languages.registerCompletionItemProvider('bibtex', {
        triggerCharacters: ['@', '{', '='],
        provideCompletionItems: (model, position) => {
          const textUntilPosition = model.getValueInRange({
            startLineNumber: position.lineNumber,
            startColumn: 1,
            endLineNumber: position.lineNumber,
            endColumn: position.column,
          });

          const suggestions = [];

          // Entry type completions
          if (textUntilPosition.endsWith('@')) {
            suggestions.push(...bibKeywords.filter(k => 
              ['article', 'book', 'inproceedings', 'misc', 'phdthesis', 'mastersthesis', 'techreport'].includes(k)
            ).map(entry => ({
              label: entry,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: `${entry}{$1,\n\t$0\n}`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: `BibTeX ${entry} entry`,
              detail: 'BibTeX Entry Type'
            })));
          }

          // Field completions
          if (textUntilPosition.match(/^\s*[a-zA-Z]*$/)) {
            suggestions.push(...bibKeywords.filter(k => 
              !['article', 'book', 'inproceedings', 'misc', 'phdthesis', 'mastersthesis', 'techreport'].includes(k)
            ).map(field => ({
              label: field,
              kind: monaco.languages.CompletionItemKind.Field,
              insertText: `${field} = {$1}`,
              insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
              documentation: `BibTeX field: ${field}`,
              detail: 'BibTeX Field'
            })));
          }

          return { suggestions };
        }
      });

      // Hover provider for LaTeX commands
      monaco.languages.registerHoverProvider('latex', {
        provideHover: (model, position) => {
          const word = model.getWordAtPosition(position);
          if (word && latexKeywords.includes(word.word.replace('\\', ''))) {
            return {
              range: new monaco.Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn),
              contents: [
                { value: `**LaTeX Command:** \\${word.word.replace('\\', '')}` }
              ]
            };
          }
        }
      });

      setIsLanguageRegistered(true);
    }

    // Focus editor
    editor.focus();
  };

  const handleEditorChange = (value) => {
    if (!readOnly) {
      debouncedSave(value || '');
    }
  };

  const handleManualSave = () => {
    if (onSave && editorRef.current) {
      onSave(editorRef.current.getValue());
    }
  };

  return (
    <div style={{ height: '100%', width: '100%' }}>
      <Editor
        height="100%"
        width="100%"
        language={language === 'latex' ? 'latex' : language === 'bibtex' ? 'bibtex' : language}
        value={content || ''}
        theme={theme === 'dark' ? 'vs-dark' : 'vs'}
        onChange={handleEditorChange}
        onMount={handleEditorDidMount}
        options={{
          minimap: { enabled: true },
          scrollBeyondLastLine: false,
          fontSize: 14,
          fontFamily: 'JetBrains Mono, Fira Code, Monaco, Menlo, "Ubuntu Mono", monospace',
          wordWrap: 'on',
          automaticLayout: true,
          suggestOnTriggerCharacters: true,
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true
          },
          quickSuggestionsDelay: 100,
          folding: true,
          foldingStrategy: 'indentation',
          lineNumbers: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          matchBrackets: 'always',
          autoClosingBrackets: 'always',
          autoClosingQuotes: 'always',
          autoSurround: 'languageDefined',
          formatOnPaste: true,
          formatOnType: true,
          tabSize: 2,
          insertSpaces: true,
          detectIndentation: true,
          trimAutoWhitespace: true,
          acceptSuggestionOnCommitCharacter: true,
          acceptSuggestionOnEnter: 'on',
          accessibilitySupport: 'auto',
          codeLens: false,
          colorDecorators: true,
          contextmenu: true,
          cursorBlinking: 'blink',
          cursorSmoothCaretAnimation: true,
          cursorStyle: 'line',
          disableLayerHinting: false,
          disableMonospaceOptimizations: false,
          dragAndDrop: true,
          emptySelectionClipboard: true,
          extraEditorClassName: '',
          fastScrollSensitivity: 5,
          find: {
            seedSearchStringFromSelection: true,
            autoFindInSelection: 'never'
          },
          fixedOverflowWidgets: false,
          fontLigatures: true,
          glyphMargin: false,
          hideCursorInOverviewRuler: false,
          highlightActiveIndentGuide: true,
          links: true,
          mouseWheelZoom: false,
          multiCursorMergeOverlapping: true,
          multiCursorModifier: 'alt',
          overviewRulerBorder: true,
          overviewRulerLanes: 2,
          parameterHints: { enabled: true },
          readOnly: false,
          renderControlCharacters: false,
          renderFinalNewline: true,
          renderIndentGuides: true,
          renderLineHighlight: 'line',
          renderValidationDecorations: 'editable',
          revealHorizontalRightPadding: 30,
          roundedSelection: true,
          rulers: [],
          scrollbar: {
            useShadows: false,
            verticalHasArrows: false,
            horizontalHasArrows: false,
            vertical: 'visible',
            horizontal: 'visible',
            verticalScrollbarSize: 17,
            horizontalScrollbarSize: 17,
            arrowSize: 11
          },
          selectOnLineNumbers: true,
          selectionClipboard: true,
          selectionHighlight: true,
          showFoldingControls: 'mouseover',
          smoothScrolling: true,
          snippetSuggestions: 'top',
          stopRenderingLineAfter: 10000,
          suggest: {
            insertMode: 'insert',
            filterGraceful: true,
            showKeywords: true,
            showSnippets: true,
            showClasses: true,
            showFunctions: true,
            showVariables: true,
            showFields: true,
            showModules: true
          },
          wordBasedSuggestions: true,
          wordSeparators: '`~!@#$%^&*()-=+[{]}\\|;:\'",.<>/?',
          wordWrapBreakAfterCharacters: '\t})]?|/&.,;',
          wordWrapBreakBeforeCharacters: '([{',
          wordWrapColumn: 80,
          wrappingIndent: 'indent'
        }}
      />
    </div>
  );
}

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
      className={cn('w-full gap-0 bg-muted/50 rounded-xl border overflow-hidden h-full', className)}
      {...tabsProps}
      {...props}>
      <MonacoEditorContent codes={codes} {...props} />
    </Tabs>
  );
}

export { CodeTabs, MonacoEditorContent };