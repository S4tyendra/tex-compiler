import { useState, useEffect, useRef, useCallback } from "react";
import { fileStorage, getFileExtension, getLanguageFromExtension, isEditableFile } from "@/lib/file-storage";
import { Card } from "@/components/ui/card";
import { AlertCircle, FileX, X, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MonacoEditorContent } from "@/components/ui/shadcn-io/code-tabs";
import { Tabs, TabsList, TabsTab, TabsPanels, TabsPanel } from "@/components/animate-ui/components/base/tabs";
import { useTheme } from "next-themes";

// Custom debounce hook
const useDebounce = (callback, delay) => {
  const timeoutRef = useRef(null);
  
  const debouncedCallback = useCallback((...args) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callback(...args);
    }, delay);
  }, [callback, delay]);
  
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);
  
  return debouncedCallback;
};

export default function EnhancedCodeEditor({ selectedFile, onFileSelect }) {
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState(null);
  const [tabContents, setTabContents] = useState({});
  const [unsavedChanges, setUnsavedChanges] = useState(new Set());
  const [isInitialized, setIsInitialized] = useState(false);
  const { resolvedTheme } = useTheme();
  const initRef = useRef(false);

  // Auto-save debounce
  const debouncedSave = useDebounce(async (filePath, content) => {
    try {
      await fileStorage.updateFile(filePath, content);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    } catch (error) {
      console.error("Error auto-saving file:", error);
    }
  }, 500);

  // Initialize storage - run only once
  useEffect(() => {
    const initEditor = async () => {
      if (initRef.current) return; // Prevent multiple initializations
      initRef.current = true;
      
      try {
        await fileStorage.init();
        setIsInitialized(true);
        
        // Open default file
        const fileToOpen = selectedFile || '/main.tex';
        await openFileInTab(fileToOpen);
      } catch (error) {
        console.error("Error initializing editor:", error);
        initRef.current = false; // Reset on error
      }
    };
    
    initEditor();
  }, []); // No dependencies

  // Handle selectedFile changes - only after initialization
  useEffect(() => {
    if (!isInitialized || !selectedFile) return;
    
    // Only open file if it's different from the current active tab
    if (selectedFile !== activeTab) {
      openFileInTab(selectedFile);
    }
  }, [selectedFile, activeTab, isInitialized]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.ctrlKey || event.metaKey) {
        if (event.key === 's') {
          event.preventDefault();
          handleManualSave();
        } else if (event.key === 'w') {
          event.preventDefault();
          if (activeTab) {
            closeTab(activeTab);
          }
        }
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [activeTab]);

  const openFileInTab = useCallback(async (filePath) => {
    try {
      // Ensure database is initialized
      if (!fileStorage.db) {
        await fileStorage.init();
      }

      // Check if tab is already open FIRST to prevent duplicates
      const existingTab = openTabs.find(tab => tab.path === filePath);
      if (existingTab) {
        setActiveTab(filePath);
        return;
      }

      const file = await fileStorage.getFile(filePath);
      if (!file) {
        console.warn(`File not found: ${filePath}`);
        return;
      }

      const fileIsEditable = isEditableFile(file.name);
      if (!fileIsEditable) {
        console.warn(`File not editable: ${file.name}`);
        return;
      }

      const newTab = {
        path: filePath,
        name: file.name,
        language: getLanguageFromExtension(getFileExtension(file.name))
      };

      // Use functional updates to prevent race conditions
      setOpenTabs(prev => {
        // Double-check for duplicates in the functional update
        if (prev.find(tab => tab.path === filePath)) {
          return prev;
        }
        return [...prev, newTab];
      });
      
      setTabContents(prev => ({
        ...prev,
        [filePath]: file.content
      }));
      
      setActiveTab(filePath);
    } catch (error) {
      console.error("Error opening file:", error);
    }
  }, [openTabs]);

  const closeTab = useCallback(async (filePath) => {
    // Save before closing if there are unsaved changes
    if (unsavedChanges.has(filePath)) {
      await handleManualSave(filePath);
    }

    setOpenTabs(prev => prev.filter(tab => tab.path !== filePath));
    setTabContents(prev => {
      const newContents = { ...prev };
      delete newContents[filePath];
      return newContents;
    });
    setUnsavedChanges(prev => {
      const newSet = new Set(prev);
      newSet.delete(filePath);
      return newSet;
    });

    // Set new active tab
    setOpenTabs(currentTabs => {
      const remainingTabs = currentTabs.filter(tab => tab.path !== filePath);
      if (remainingTabs.length > 0) {
        const currentIndex = currentTabs.findIndex(tab => tab.path === filePath);
        const newActiveIndex = Math.min(currentIndex, remainingTabs.length - 1);
        const newActiveTab = remainingTabs[newActiveIndex].path;
        setActiveTab(newActiveTab);
        onFileSelect?.(newActiveTab);
      } else {
        setActiveTab(null);
        onFileSelect?.(null);
      }
      return remainingTabs;
    });
  }, [unsavedChanges, onFileSelect]);

  const handleContentChange = (filePath, newContent) => {
    setTabContents(prev => ({
      ...prev,
      [filePath]: newContent
    }));
    
    // Mark as unsaved
    setUnsavedChanges(prev => new Set(prev).add(filePath));
    
    // Trigger auto-save
    debouncedSave(filePath, newContent);
  };

  const handleManualSave = async (filePath = activeTab) => {
    if (!filePath || !tabContents[filePath]) return;

    try {
      await fileStorage.updateFile(filePath, tabContents[filePath]);
      setUnsavedChanges(prev => {
        const newSet = new Set(prev);
        newSet.delete(filePath);
        return newSet;
      });
    } catch (error) {
      console.error("Error saving file:", error);
    }
  };

  const handleTabChange = (tabPath) => {
    setActiveTab(tabPath);
    onFileSelect?.(tabPath);
  };

  if (!isInitialized) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <h3 className="text-lg font-semibold mb-2">Loading Editor</h3>
          <p className="text-muted-foreground">
            Initializing file storage and editor components...
          </p>
        </Card>
      </div>
    );
  }

  if (openTabs.length === 0) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Files Open</h3>
          <p className="text-muted-foreground">
            Select a file from the explorer to start editing, or create a new file.
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Supported file types: .tex, .bib, .txt, .md, .json, .js, .jsx, .ts, .tsx, .css, .html, .xml, .yaml, .yml, .py, .go, .rs, .c, .cpp, .h, .hpp, .java, .kt, .swift, .php, .rb, .sh, .bat, .ps1, .dockerfile, .gitignore, .toml, .ini, .cfg, .conf, .log
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full h-full">
        {/* Tab Headers */}
        <div className="flex items-center border-b bg-background flex-shrink-0">
          <TabsList className="h-auto bg-transparent border-none rounded-none flex-1">
            {openTabs.map((tab, index) => (
              <TabsTab
                key={`tab-${tab.path}-${index}`}
                value={tab.path}
                className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-4 py-2 flex items-center gap-2"
              >
                <span className="truncate max-w-32">
                  {tab.name}
                  {unsavedChanges.has(tab.path) && (
                    <span className="text-orange-500 ml-1">•</span>
                  )}
                </span>
                <span
                  className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 hover:bg-destructive hover:text-destructive-foreground rounded flex items-center justify-center cursor-pointer ml-auto"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeTab(tab.path);
                  }}
                >
                  <X className="h-3 w-3" />
                </span>
              </TabsTab>
            ))}
          </TabsList>
          
          {/* Save indicator */}
          {unsavedChanges.size > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualSave}
              className="mr-2 text-orange-500 hover:text-orange-600"
              title="Save current file (Ctrl+S)"
            >
              <Save className="h-4 w-4 mr-1" />
              {unsavedChanges.size}
            </Button>
          )}
        </div>

        {/* Tab Content */}
        <div className="flex-1 min-h-0">
          <TabsPanels className="h-full">
            {openTabs.map((tab, index) => (
              <TabsPanel key={`panel-${tab.path}-${index}`} value={tab.path} className="h-full">
                <div className="h-full">
                  <MonacoEditorContent
                    content={tabContents[tab.path] || ''}
                    language={tab.language}
                    onChange={(newContent) => handleContentChange(tab.path, newContent)}
                    fileName={tab.name}
                    onSave={() => handleManualSave(tab.path)}
                  />
                </div>
              </TabsPanel>
            ))}
          </TabsPanels>
        </div>
      </Tabs>
    </div>
  );
}