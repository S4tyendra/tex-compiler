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
  const [autoCompile, setAutoCompile] = useState(false)
  const lastMainFileRef = useRef(null)
  const lastCompilerRef = useRef(null)
  
  // Request persistent storage permission
  useEffect(() => {
    const requestPersistentStorage = async () => {
      if ('storage' in navigator && 'persist' in navigator.storage) {
        try {
          const granted = await navigator.storage.persist();
          console.log('Persistent storage:', granted ? 'granted' : 'denied');
        } catch (error) {
          console.error('Error requesting persistent storage:', error);
        }
      }
    };
    
    requestPersistentStorage();
  }, []);
  
  // Load compilation history on mount
  useEffect(() => {
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
    
    loadHistory();
  }, []);
  
  const handleCompile = async (mainFile, compiler) => {
    try {
      const allFiles = await fileStorage.getAllFiles();
      const result = await compilerService.compileProject(allFiles, mainFile, compiler);
      console.log('Compilation result:', result);
      
      // Save compilation to storage and update state
      if (result) {
        const compilationData = {
          job_id: result.job_id,
          success: result.success,
          message: result.message,
          logs_url: result.logs_url,
          pdf_url: result.pdf_url,
          mainFile,
          compiler,
          timestamp: new Date().toISOString()
        };
        
        await compilerService.addCompilation(compilationData);
        setLastCompilation(compilationData);
        
        // Reload compilation history to update the list
        const updatedHistory = await compilerService.getCompilations();
        setCompilations(updatedHistory);
      }
      
      return result;
    } catch (error) {
      console.error('Compilation failed:', error);
      throw error;
    }
  };
  
  const handleCompilationUpdate = (compilation) => {
    // Additional handling when compilation updates
    console.log('Compilation updated:', compilation);
  };
  
  // Auto-compile with debouncing
  const debouncedAutoCompile = useDebounce(async (mainFile, compiler) => {
    if (autoCompile && mainFile && compiler) {
      try {
        await handleCompile(mainFile, compiler);
      } catch (error) {
        console.error('Auto-compile failed:', error);
      }
    }
  }, 2000); // 2 second delay
  
  // Trigger auto-compile when files change
  const handleFileChange = useCallback((mainFile, compiler) => {
    lastMainFileRef.current = mainFile;
    lastCompilerRef.current = compiler;
    
    if (autoCompile) {
      debouncedAutoCompile(mainFile, compiler);
    }
  }, [autoCompile, debouncedAutoCompile]);  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation onFileSelect={setSelectedFile} />
        <SidebarInset className="h-screen">
          <Header 
            onCompile={handleCompile} 
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
            autoCompile={autoCompile}
            onAutoCompileChange={setAutoCompile}
            onFileChange={handleFileChange}
          />
          <div className="h-full flex flex-col">
            <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <EnhancedCodeEditor 
                    selectedFile={selectedFile} 
                    onFileSelect={setSelectedFile}
                    onFileChange={handleFileChange}
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
                    onCompilationUpdate={handleCompilationUpdate}
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