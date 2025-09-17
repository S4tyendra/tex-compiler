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


// export default () => {
//   return <div className="flex-wrap lg:flex-nowrap flex gap-2 not-prose">
//     <ResizablePanelGroup direction="horizontal">
//       <ResizablePanel>
//         <AspectRatio ratio={16 / 9} className="bg-muted rounded-lg">
//           <Card ripple>
//             ...
//           </Card>
//         </AspectRatio>
//       </ResizablePanel>
//       <ResizableHandle  withHandle/>
//       <ResizablePanel>

//         <Card variant="filled" ripple>
//           ...
//         </Card>
//       </ResizablePanel>
//       <ResizableHandle withHandle/>
//       <ResizablePanel>
//         <Card variant="outlined" ripple>
//           ...
//         </Card>
//       </ResizablePanel>
//     </ResizablePanelGroup>
//   </div>
// }

export default function App() {
  return (
        <ThemeProvider attribute="class">
    <SidebarProvider>
      <FilesNavigation />
      <SidebarInset>
        <SidebarTrigger className="absolute top-4 left-4 z-50" />
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
    </SidebarProvider>
    </ThemeProvider>
  )
}