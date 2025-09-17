import { MonacoEditorContent } from "@/components/ui/shadcn-io/code-tabs";
import { fileStorage, getFileExtension, getLanguageFromExtension } from "@/lib/file-storage";
import { useState, useEffect } from "react";

export default function CodeEditor({ selectedFile }) {
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("latex");

  useEffect(() => {
    // Initialize file storage and load default file
    const initEditor = async () => {
      try {
        await fileStorage.init();
        if (selectedFile) {
          await loadFile(selectedFile);
        } else {
          // Load main.tex by default
          await loadFile('/main.tex');
        }
      } catch (error) {
        console.error("Error initializing editor:", error);
        // Set default content if no file exists
        setContent(`\\documentclass{article}
\\usepackage[utf8]{inputenc}
\\usepackage{amsmath}
\\usepackage{amsfonts}
\\usepackage{amssymb}
\\usepackage{graphicx}

\\title{My Document}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Write your content here.

\\end{document}`);
      }
    };
    
    initEditor();
  }, [selectedFile]);

  const loadFile = async (filePath) => {
    try {
      const file = await fileStorage.getFile(filePath);
      if (file) {
        setContent(file.content);
        const extension = getFileExtension(file.name);
        setLanguage(getLanguageFromExtension(extension));
      }
    } catch (error) {
      console.error("Error loading file:", error);
      setContent("");
    }
  };

  const handleContentChange = async (newContent) => {
    setContent(newContent);
    if (selectedFile) {
      try {
        await fileStorage.updateFile(selectedFile, newContent);
      } catch (error) {
        console.error("Error saving file:", error);
      }
    }
  };

  return (
    <div className="h-full w-full" style={{ height: '100%', width: '100%' }}>
      <MonacoEditorContent
        content={content}
        language={language}
        onChange={handleContentChange}
        fileName={selectedFile}
      />
    </div>
  );
}