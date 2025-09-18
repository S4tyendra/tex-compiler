import { Card } from 'actify'
import { AspectRatio } from "@/components/ui/aspect-ratio"
import { FilesNavigation } from "@/components/files-navigation"
import { ThemeProvider, useTheme } from "next-themes";
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
import CodeEditor from './components/code-editor'
import { useState } from 'react'

export default function App() {
  const [selectedFile, setSelectedFile] = useState('/main.tex')
  
  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation onFileSelect={setSelectedFile} />
        <SidebarInset className="h-screen">
          <div>
            <div className="p-4 border-b">
              <h1 className="text-2xl font-bold">TexCompiler</h1>
              <p className="text-sm text-muted-foreground">Online LaTeX Editor and Compiler</p>
            </div>
          </div>
          <div className="h-full flex flex-col">
            <ResizablePanelGroup direction="horizontal" className="h-full">
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full">
                  <CodeEditor selectedFile={selectedFile} />
                </div>
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={50} minSize={20}>
                <div className="h-full w-full bg-gray-50 dark:bg-gray-900 flex items-center justify-center text-muted-foreground">
                  ... Preview Panel ...
                  
                </div>
              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
        <SidebarTrigger className="absolute bottom-4 left-4 z-50" />
      </SidebarProvider>
    </ThemeProvider>
  )
}