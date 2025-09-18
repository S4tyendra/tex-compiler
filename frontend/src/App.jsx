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
import { useState } from 'react'
import { compilerService } from './lib/compiler-service'
import { fileStorage } from './lib/file-storage'

export default function App() {
  const [selectedFile, setSelectedFile] = useState('/main.tex')
  const [lastCompilation, setLastCompilation] = useState(null)
  
  const handleCompile = async (mainFile, compiler) => {
    try {
      const allFiles = await fileStorage.getAllFiles();
      const result = await compilerService.compileProject(allFiles, mainFile, compiler);
      console.log('Compilation result:', result);
      
      // Save compilation to storage and update state
      if (result.success) {
        const compilation = {
          ...result,
          mainFile,
          compiler,
          timestamp: new Date().toISOString()
        };
        await fileStorage.saveCompilation(compilation);
        setLastCompilation(compilation);
      }
      
      return result;
    } catch (error) {
      console.error('Compilation failed:', error);
      throw error;
    }
  };
  
  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation onFileSelect={setSelectedFile} />
        <SidebarInset className="h-screen">
          <Header 
            onCompile={handleCompile} 
            selectedFile={selectedFile}
            onFileSelect={setSelectedFile}
          />
          <div className="h-full flex flex-col">
            <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <EnhancedCodeEditor selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <PDFPreview lastCompilation={lastCompilation} />
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}