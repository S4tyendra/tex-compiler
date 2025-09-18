import { useState, useCallback, useEffect } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import EnhancedCodeEditor from "@/components/enhanced-code-editor";
import PDFPreview from "@/components/pdf-preview";
import { compilerService } from "@/lib/compiler-service";
import { fileStorage } from "@/lib/file-storage";

export default function EditorLayout({ selectedFile, onFileSelect }) {
  const [compilationData, setCompilationData] = useState(null);
  const [files, setFiles] = useState([]);

  useEffect(() => {
    const loadFiles = async () => {
      try {
        await fileStorage.init();
        const allFiles = await fileStorage.getAllFiles();
        setFiles(allFiles);
      } catch (error) {
        console.error("Error loading files:", error);
      }
    };

    loadFiles();
    
    // Refresh files periodically to sync with editor changes
    const interval = setInterval(loadFiles, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCompile = useCallback(async (compilationFiles, mainFileName) => {
    try {
      const result = await compilerService.compileProject(compilationFiles, mainFileName);
      setCompilationData({ result, files: compilationFiles, mainFileName });
      return result;
    } catch (error) {
      console.error("Compilation failed:", error);
      throw error;
    }
  }, []);

  return (
    <div className="h-full w-full">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Code Editor Panel */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <EnhancedCodeEditor
            selectedFile={selectedFile}
            onFileSelect={onFileSelect}
            onCompile={handleCompile}
          />
        </ResizablePanel>
        
        <ResizableHandle withHandle />
        
        {/* PDF Preview Panel */}
        <ResizablePanel defaultSize={40} minSize={30}>
          <PDFPreview
            selectedFile={selectedFile}
            files={files}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}