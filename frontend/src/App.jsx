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
import { useState } from 'react'

export default function App() {
  const [selectedFile, setSelectedFile] = useState('/main.tex')
  
  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation onFileSelect={setSelectedFile} />
        <SidebarInset className="h-screen">
          <Header/>
          <div className="h-full flex flex-col">
            <ResizablePanelGroup direction="horizontal" className="h-full flex-1">
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <EnhancedCodeEditor selectedFile={selectedFile} onFileSelect={setSelectedFile} />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-muted-foreground">
                  PDF Preview (Coming Soon)
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ThemeProvider>
  )
}