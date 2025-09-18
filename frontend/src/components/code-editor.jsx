import { MonacoEditorContent } from "@/components/ui/shadcn-io/code-tabs";
import { fileStorage, getFileExtension, getLanguageFromExtension, isEditableFile } from "@/lib/file-storage";
import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { AlertCircle, FileX } from "lucide-react";

export default function CodeEditor({ selectedFile }) {
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("latex");
  const [isEditable, setIsEditable] = useState(true);
  const [error, setError] = useState(null);

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
        setIsEditable(true);
        setError(null);
      }
    };
    
    initEditor();
  }, [selectedFile]);

  const loadFile = async (filePath) => {
    try {
      const file = await fileStorage.getFile(filePath);
      if (file) {
        const fileIsEditable = isEditableFile(file.name);
        setIsEditable(fileIsEditable);
        
        if (fileIsEditable) {
          setContent(file.content);
          const extension = getFileExtension(file.name);
          setLanguage(getLanguageFromExtension(extension));
          setError(null);
        } else {
          setContent("");
          setError({
            type: 'unsupported',
            message: 'This file type cannot be edited in the text editor. Use the preview option from the file explorer.'
          });
        }
      }
    } catch (error) {
      console.error("Error loading file:", error);
      setContent("");
      setIsEditable(false);
      setError({
        type: 'error',
        message: `Error loading file: ${error.message}`
      });
    }
  };

  const handleContentChange = async (newContent) => {
    if (!isEditable) return;
    
    setContent(newContent);
    if (selectedFile) {
      try {
        await fileStorage.updateFile(selectedFile, newContent);
      } catch (error) {
        console.error("Error saving file:", error);
      }
    }
  };

  if (error) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          {error.type === 'unsupported' ? (
            <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          ) : (
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          )}
          <h3 className="text-lg font-semibold mb-2">
            {error.type === 'unsupported' ? 'File Not Editable' : 'Error'}
          </h3>
          <p className="text-muted-foreground">{error.message}</p>
          {error.type === 'unsupported' && (
            <p className="text-sm text-muted-foreground mt-2">
              Supported file types: .tex, .bib, .txt, .md, .json, .js, .jsx, .ts, .tsx, .css, .html, .xml, .yaml, .yml, .py, .go, .rs, .c, .cpp, .h, .hpp, .java, .kt, .swift, .php, .rb, .sh, .bat, .ps1, .dockerfile, .gitignore, .toml, .ini, .cfg, .conf, .log
            </p>
          )}
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full" style={{ height: '100%', width: '100%' }}>
      <MonacoEditorContent
        content={content}
        language={language}
        onChange={handleContentChange}
        fileName={selectedFile}
        readOnly={!isEditable}
      />
    </div>
  );
}