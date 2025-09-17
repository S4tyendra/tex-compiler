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

export default function App() {
  return (
    <ThemeProvider attribute="class">
      <SidebarProvider>
        <FilesNavigation />
        <SidebarInset>
          <div className="flex-wrap lg:flex-nowrap flex gap-2 not-prose p-4">
            <ResizablePanelGroup direction="horizontal">
              <ResizablePanel>
                <CodeEditor />
              </ResizablePanel>
              <ResizableHandle withHandle />
              <ResizablePanel>

              </ResizablePanel>
            </ResizablePanelGroup>
          </div>
        </SidebarInset>
        <SidebarTrigger className="absolute bottom-4 left-4 z-50" />

      </SidebarProvider>
    </ThemeProvider>
  )
}