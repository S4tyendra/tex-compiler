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
  const [compilationProgress, setCompilationProgress] = useState({ isCompiling: false, stage: '', hasQueuedCompilation: false })
  
  const compilationSettingsRef = useRef({ mainFile: 'main', compiler: 'pdflatex' })
  const isCompilingRef = useRef(false)
  const queuedCompilationRef = useRef(null)

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

  const handleCompile = async (mainFile, compiler, isQueued = false) => {
    // If already compiling and this isn't a queued compilation, queue it
    if (isCompilingRef.current && !isQueued) {
      queuedCompilationRef.current = { mainFile, compiler }
      setCompilationProgress(prev => ({ ...prev, hasQueuedCompilation: true }))
      return
    }

    try {
      isCompilingRef.current = true
      setCompilationProgress({ isCompiling: true, stage: 'Preparing files...', hasQueuedCompilation: false })
      
      const allFiles = await fileStorage.getAllFiles()
      
      setCompilationProgress(prev => ({ ...prev, stage: 'Zipping project...' }))
      await new Promise(resolve => setTimeout(resolve, 200)) // Small delay to show progress
      
      setCompilationProgress(prev => ({ ...prev, stage: 'Uploading...' }))
      const apiResponse = await compilerService.compileProject(allFiles, mainFile, compiler)
      
      // Handle server errors
      if (apiResponse.error) {
        throw new Error(apiResponse.message || apiResponse.error)
      }
      
      if (apiResponse.job_id) {
        setCompilationProgress(prev => ({ ...prev, stage: 'Compiling...' }))
        
        // Small delay to show compiling stage
        await new Promise(resolve => setTimeout(resolve, 500))
        
        setCompilationProgress(prev => ({ ...prev, stage: apiResponse.success ? 'Fetching PDF...' : 'Fetching logs...' }))
        
        // This now fetches artifacts and saves them to IndexedDB
        const fullRecord = await compilerService.addCompilation({
          ...apiResponse,
          mainFile,
          compiler,
        })
        
        setCompilationProgress(prev => ({ ...prev, stage: 'Completing...' }))
        
        // Update state with the full record from DB
        setLastCompilation(fullRecord)
        await loadHistory() // Refresh the history list
        
        setCompilationProgress({ isCompiling: false, stage: '', hasQueuedCompilation: false })
        
        // Process queued compilation if any
        if (queuedCompilationRef.current) {
          const queued = queuedCompilationRef.current
          queuedCompilationRef.current = null
          setTimeout(() => handleCompile(queued.mainFile, queued.compiler, true), 500)
        }
        
        return fullRecord
      } else {
        throw new Error('No job ID received from server')
      }
    } catch (error) {
      console.error('Compilation failed:', error)
      setCompilationProgress({ 
        isCompiling: false, 
        stage: '', 
        hasQueuedCompilation: false,
        error: error.message || 'Compilation failed'
      })
      
      // Clear error after 5 seconds
      setTimeout(() => {
        setCompilationProgress(prev => ({ ...prev, error: null }))
      }, 5000)
      
      // Process queued compilation even if current one failed
      if (queuedCompilationRef.current) {
        const queued = queuedCompilationRef.current
        queuedCompilationRef.current = null
        setTimeout(() => handleCompile(queued.mainFile, queued.compiler, true), 1000)
      }
      
      throw error
    } finally {
      isCompilingRef.current = false
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
            compilationProgress={compilationProgress}
          />
          <div className="h-full flex flex-col">
            {/* Desktop Layout */}
            <div className="hidden md:block h-full">
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
            
            {/* Mobile Layout - Vertical Stack */}
            <div className="md:hidden h-full flex flex-col">
              <div className="flex-1 min-h-0">
                <EnhancedCodeEditor 
                  selectedFile={selectedFile} 
                  onFileSelect={setSelectedFile}
                  onSaveComplete={handleSaveComplete}
                />
              </div>
              <div className="flex-1 min-h-0 border-t">
                <PDFPreview 
                  lastCompilation={lastCompilation}
                  compilations={compilations}
                  onCompilationSelect={setLastCompilation}
                />
              </div>
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}