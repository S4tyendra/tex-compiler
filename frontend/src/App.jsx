import { FilesNavigation } from "@/components/files-navigation"
import { ThemeProvider } from "next-themes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import EnhancedCodeEditor from './components/enhanced-code-editor'
import Header from './components/header'
import PDFPreview from './components/pdf-preview'
import { useState, useEffect, useCallback, useRef } from 'react'
import { compilerService } from './lib/compiler-service'
import { fileStorage } from './lib/file-storage'

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

export default function App() {
  const [selectedFile, setSelectedFile] = useState('/main.tex')
  const [lastCompilation, setLastCompilation] = useState(null)
  const [compilations, setCompilations] = useState([])
  const [autoCompile, setAutoCompile] = useState(true) // Default to on
  
  const compilationSettingsRef = useRef({ mainFile: 'main', compiler: 'pdflatex' });

  // Load history and request persistent storage on mount
  useEffect(() => {
    const initializeApp = async () => {
      if (navigator.storage && navigator.storage.persist) {
        const isPersisted = await navigator.storage.persisted();
        if (!isPersisted) {
          await navigator.storage.persist();
        }
      }
      await fileStorage.init();
      await loadHistory();
    };
    initializeApp();
  }, []);
  
  const loadHistory = async () => {
    try {
      const history = await compilerService.getCompilations();
      setCompilations(history);
      if (history.length > 0) {
        setLastCompilation(history[0]);
      }
    } catch (error) {
      console.error('Error loading compilation history:', error);
    }
  };

  const handleCompile = async (mainFile, compiler) => {
    try {
      const allFiles = await fileStorage.getAllFiles();
      const apiResponse = await compilerService.compileProject(allFiles, mainFile, compiler);
      
      if (apiResponse.job_id) {
        // This now fetches artifacts and saves them to IndexedDB
        const fullRecord = await compilerService.addCompilation({
          ...apiResponse,
          mainFile,
          compiler,
        });
        
        // Update state with the full record from DB
        setLastCompilation(fullRecord);
        await loadHistory(); // Refresh the history list
        return fullRecord;
      }
    } catch (error) {
      console.error('Compilation failed:', error);
      throw error;
    }
  };
  
  const handleSettingsChange = useCallback((mainFile, compiler) => {
    compilationSettingsRef.current = { mainFile, compiler };
  }, []);

  const debouncedAutoCompile = useDebounce(() => {
    if (autoCompile) {
      const { mainFile, compiler } = compilationSettingsRef.current;
      handleCompile(mainFile, compiler);
    }
  }, 1500); // 1.5s delay after save

  const handleSaveComplete = useCallback(() => {
    debouncedAutoCompile();
  }, [debouncedAutoCompile]);  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation onFileSelect={setSelectedFile} />
        <SidebarInset className="h-screen">
          <Header 
            onCompile={handleCompile} 
            autoCompile={autoCompile}
            onAutoCompileChange={setAutoCompile}
            onFileChange={handleSettingsChange}
          />
          <div className="h-full flex flex-col">
            <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <EnhancedCodeEditor 
                    selectedFile={selectedFile} 
                    onFileSelect={setSelectedFile}
                    onSaveComplete={handleSaveComplete}
                  />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <PDFPreview 
                    lastCompilation={lastCompilation}
                    compilations={compilations}
                    onCompilationSelect={setLastCompilation}
                  />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}