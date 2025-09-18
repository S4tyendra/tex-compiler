import {
  TreeExpander,
  TreeIcon,
  TreeLabel,
  TreeNode,
  TreeNodeContent,
  TreeNodeTrigger,
  TreeProvider,
  TreeView,
} from "@/components/ui/kibo-ui/tree";
import { FileCode, FileJson, FileText, FileType, FolderOpen, Folder, Image, FileX } from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useState, useEffect, useRef } from "react";
import { fileStorage, getFileExtension, getFileType, isEditableFile } from "@/lib/file-storage";
import { FileContextMenu } from "@/components/file-context-menu";
import { FileDialog } from "@/components/file-dialog";
import { FilePreview } from "@/components/file-preview";

export function FilesNavigation({ onFileSelect, ...props }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [dialogState, setDialogState] = useState({
    open: false,
    type: null,
    file: null,
    targetPath: '/',
    title: "",
    description: "",
    placeholder: ""
  });
  const [previewState, setPreviewState] = useState({
    open: false,
    file: null
  });
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const zipInputRef = useRef(null);

  useEffect(() => {
    initializeStorage();
  }, []);

  const initializeStorage = async () => {
    try {
      await fileStorage.init();
      await loadFiles();
    } catch (error) {
      console.error("Error initializing storage:", error);
    }
  };

  const loadFiles = async () => {
    try {
      const allFiles = await fileStorage.getAllFiles();
      setFiles(allFiles);
    } catch (error) {
      console.error("Error loading files:", error);
    }
  };

  const handleFileSelect = (fileIds) => {
    setSelectedIds(fileIds);
    if (fileIds.length === 1) {
      const selectedFile = files.find(f => f.id === fileIds[0]);
      if (selectedFile && selectedFile.type === 'file') {
        // Only allow editable files to open in the editor
        if (isEditableFile(selectedFile.name)) {
          onFileSelect?.(selectedFile.path);
        } else {
          // For non-editable files, show preview instead
          setPreviewState({ open: true, file: selectedFile });
        }
      }
    }
  };

  const openDialog = (type, targetPath = '/', file = null) => {
    const configs = {
      createFile: {
        title: "Create New File",
        description: "Enter the name for the new file (e.g., chapter1.tex, references.bib)",
        placeholder: "filename.tex"
      },
      createFolder: {
        title: "Create New Folder", 
        description: "Enter the name for the new folder",
        placeholder: "folder-name"
      },
      rename: {
        title: "Rename " + (file?.type === 'folder' ? 'Folder' : 'File'),
        description: `Enter the new name for "${file?.name}"`,
        placeholder: file?.name || ""
      },
      copy: {
        title: "Copy " + (file?.type === 'folder' ? 'Folder' : 'File'),
        description: `Enter the new name for the copy of "${file?.name}"`,
        placeholder: `Copy of ${file?.name || ""}`
      }
    };

    setDialogState({
      open: true,
      type,
      file,
      targetPath,
      ...configs[type]
    });
  };

  const handleDialogConfirm = async (value) => {
    try {
      switch (dialogState.type) {
        case 'createFile':
          await fileStorage.createFile(value, getDefaultContent(value), dialogState.targetPath);
          break;
        case 'createFolder':
          await fileStorage.createFolder(value, dialogState.targetPath);
          break;
        case 'rename':
          await fileStorage.renameFile(dialogState.file.path, value);
          break;
        case 'copy':
          await fileStorage.copyFile(dialogState.file.path, value);
          break;
      }
      await loadFiles();
    } catch (error) {
      console.error(`Error ${dialogState.type}:`, error);
      alert(`Error: ${error.message}`);
    }
  };

  const getDefaultContent = (filename) => {
    const extension = getFileExtension(filename);
    switch (extension) {
      case 'tex':
        return `\\documentclass{article}
\\usepackage[utf8]{inputenc}

\\title{${filename.replace('.tex', '').replace(/[_-]/g, ' ')}}
\\author{Author Name}
\\date{\\today}

\\begin{document}

\\maketitle

\\section{Introduction}

Content goes here.

\\end{document}`;
      case 'bib':
        return `@article{example2024,
  author = {Author, First},
  title = {Example Article Title},
  journal = {Journal Name},
  year = {2024},
  volume = {1},
  number = {1},
  pages = {1--10}
}`;
      default:
        return '';
    }
  };

  const handleDelete = async (file) => {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      try {
        await fileStorage.deleteFile(file.path);
        await loadFiles();
        // Clear selection if deleted file was selected
        if (selectedIds.includes(file.id)) {
          setSelectedIds([]);
          onFileSelect?.(null);
        }
      } catch (error) {
        console.error("Error deleting file:", error);
      }
    }
  };

  const handleDownload = async (file) => {
    try {
      await fileStorage.downloadFile(file.path);
    } catch (error) {
      console.error("Error downloading file:", error);
    }
  };

  const handleUpload = (targetPath = '/') => {
    fileInputRef.current?.setAttribute('data-target-path', targetPath);
    fileInputRef.current?.click();
  };

  const handleUploadZip = (targetPath = '/') => {
    zipInputRef.current?.setAttribute('data-target-path', targetPath);
    zipInputRef.current?.click();
  };

  const handleFileUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    const targetPath = event.target.getAttribute('data-target-path') || '/';

    try {
      await fileStorage.uploadFiles(selectedFiles, targetPath);
      await loadFiles();
    } catch (error) {
      alert(error.message);
      console.error("Error uploading files:", error);
    }
    
    // Reset file input
    event.target.value = '';
    event.target.removeAttribute('data-target-path');
  };

  const handleZipUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    try {
      for (const file of selectedFiles) {
        if (file.name.endsWith('.zip')) {
          await fileStorage.importZipFile(file);
        }
      }
      await loadFiles();
    } catch (error) {
      alert(error.message);
      console.error("Error importing ZIP:", error);
    }
    
    // Reset file input
    event.target.value = '';
    event.target.removeAttribute('data-target-path');
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (event) => {
    event.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = async (event) => {
    event.preventDefault();
    setIsDragOver(false);
    
    const droppedFiles = Array.from(event.dataTransfer.files);
    if (droppedFiles.length === 0) return;

    try {
      // Check if any files are ZIP files
      const zipFiles = droppedFiles.filter(f => f.name.endsWith('.zip'));
      const regularFiles = droppedFiles.filter(f => !f.name.endsWith('.zip'));

      // Import ZIP files
      for (const zipFile of zipFiles) {
        await fileStorage.importZipFile(zipFile);
      }

      // Upload regular files
      if (regularFiles.length > 0) {
        await fileStorage.uploadFiles(regularFiles, '/');
      }

      await loadFiles();
    } catch (error) {
      alert(error.message);
      console.error("Error handling dropped files:", error);
    }
  };

  const handlePreview = (file) => {
    setPreviewState({ open: true, file });
  };

  const handleDownloadAll = async () => {
    try {
      await fileStorage.downloadAllFiles();
    } catch (error) {
      console.error("Error downloading all files:", error);
    }
  };

  const getFileIcon = (file) => {
    if (file.type === 'folder') {
      return <Folder className="h-4 w-4" />;
    }
    
    const fileType = getFileType(file.name);
    const extension = getFileExtension(file.name);
    
    if (fileType === 'image') {
      return <Image className="h-4 w-4" />;
    }
    
    switch (extension) {
      case 'tex':
        return <FileText className="h-4 w-4" />;
      case 'bib':
        return <FileJson className="h-4 w-4" />;
      case 'pdf':
        return <FileType className="h-4 w-4" />;
      case 'js':
      case 'jsx':
      case 'ts':
      case 'tsx':
      case 'py':
      case 'go':
      case 'rs':
      case 'c':
      case 'cpp':
      case 'java':
        return <FileCode className="h-4 w-4" />;
      default:
        if (fileType === 'text') {
          return <FileText className="h-4 w-4" />;
        }
        return <FileX className="h-4 w-4" />;
    }
  };

  const renderFileTree = (fileList, level = 0) => {
    // Group files by folders
    const folders = fileList.filter(f => f.type === 'folder');
    const regularFiles = fileList.filter(f => f.type === 'file');

    return (
      <>
        {folders.map((folder, index) => {
          const isLast = index === folders.length - 1 && regularFiles.length === 0;
          const childFiles = files.filter(f => {
            const folderPathParts = folder.path.split('/').filter(Boolean);
            const filePathParts = f.path.split('/').filter(Boolean);
            
            // Check if file is direct child of this folder
            if (filePathParts.length !== folderPathParts.length + 1) return false;
            
            // Check if file path starts with folder path
            for (let i = 0; i < folderPathParts.length; i++) {
              if (folderPathParts[i] !== filePathParts[i]) return false;
            }
            
            return true;
          });
          
          return (
            <FileContextMenu
              key={folder.id}
              file={folder}
              onRename={() => openDialog('rename', '/', folder)}
              onCopy={() => openDialog('copy', '/', folder)}
              onDelete={() => handleDelete(folder)}
              onDownload={() => handleDownload(folder)}
              onCreateFile={() => openDialog('createFile', folder.path)}
              onCreateFolder={() => openDialog('createFolder', folder.path)}
              onUpload={() => handleUpload(folder.path)}
              onUploadZip={() => handleUploadZip(folder.path)}
              onDownloadAll={handleDownloadAll}
              onPreview={handlePreview}
            >
              <TreeNode nodeId={folder.id} isLast={isLast} level={level}>
                <TreeNodeTrigger>
                  <TreeExpander hasChildren={childFiles.length > 0} />
                  <TreeIcon icon={getFileIcon(folder)} hasChildren={childFiles.length > 0} />
                  <TreeLabel>{folder.name}</TreeLabel>
                </TreeNodeTrigger>
                {childFiles.length > 0 && (
                  <TreeNodeContent hasChildren>
                    {renderFileTree(childFiles, level + 1)}
                  </TreeNodeContent>
                )}
              </TreeNode>
            </FileContextMenu>
          );
        })}
        {regularFiles.map((file, index) => {
          const isLast = index === regularFiles.length - 1;
          const fileType = getFileType(file.name);
          const isEditable = isEditableFile(file.name);
          
          return (
            <FileContextMenu
              key={file.id}
              file={file}
              onRename={() => openDialog('rename', '/', file)}
              onCopy={() => openDialog('copy', '/', file)}
              onDelete={() => handleDelete(file)}
              onDownload={() => handleDownload(file)}
              onCreateFile={() => openDialog('createFile', '/')}
              onCreateFolder={() => openDialog('createFolder', '/')}
              onUpload={() => handleUpload('/')}
              onUploadZip={() => handleUploadZip('/')}
              onDownloadAll={handleDownloadAll}
              onPreview={handlePreview}
            >
              <TreeNode 
                nodeId={file.id} 
                isLast={isLast} 
                level={level}
                className={!isEditable ? 'opacity-75' : ''}
              >
                <TreeNodeTrigger>
                  <TreeExpander />
                  <TreeIcon icon={getFileIcon(file)} />
                  <TreeLabel className={!isEditable ? 'text-muted-foreground' : ''}>
                    {file.name}
                    {!isEditable && fileType !== 'image' && (
                      <span className="text-xs ml-1 text-muted-foreground">(preview only)</span>
                    )}
                  </TreeLabel>
                </TreeNodeTrigger>
              </TreeNode>
            </FileContextMenu>
          );
        })}
      </>
    );
  };

  return (
    <>
      <Sidebar {...props}>
        <SidebarContent 
          className={isDragOver ? 'bg-primary/10 border-primary border-2 border-dashed' : ''}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <SidebarGroup>
            <SidebarGroupLabel>
              Files
              {isDragOver && (
                <span className="text-xs text-primary ml-2">Drop files here</span>
              )}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <FileContextMenu
                  onCreateFile={() => openDialog('createFile', '/')}
                  onCreateFolder={() => openDialog('createFolder', '/')}
                  onUpload={() => handleUpload('/')}
                  onUploadZip={() => handleUploadZip('/')}
                  onDownloadAll={handleDownloadAll}
                >
                  <TreeProvider
                    defaultExpandedIds={['/']}
                    onSelectionChange={handleFileSelect}
                    multiSelect={false}
                    selectedIds={selectedIds}
                  >
                    <TreeView>
                      {renderFileTree(files.filter(f => {
                        const pathParts = f.path.split('/').filter(Boolean);
                        return pathParts.length === 1; // Only top-level files and folders
                      }))}
                    </TreeView>
                  </TreeProvider>
                </FileContextMenu>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarRail />
      </Sidebar>

      <FileDialog
        open={dialogState.open}
        onOpenChange={(open) => setDialogState(prev => ({ ...prev, open }))}
        title={dialogState.title}
        description={dialogState.description}
        placeholder={dialogState.placeholder}
        defaultValue={dialogState.type === 'rename' ? dialogState.file?.name : ''}
        onConfirm={handleDialogConfirm}
      />

      <FilePreview
        open={previewState.open}
        onOpenChange={(open) => setPreviewState(prev => ({ ...prev, open }))}
        file={previewState.file}
      />

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
        accept=".tex,.bib,.txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.py,.go,.rs,.c,.cpp,.h,.hpp,.java,.kt,.swift,.php,.rb,.sh,.bat,.ps1,.dockerfile,.gitignore,.png,.jpg,.jpeg,.gif,.svg,.bmp,.ico,.webp,.pdf"
      />

      <input
        ref={zipInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleZipUpload}
        accept=".zip"
      />
    </>
  );
}