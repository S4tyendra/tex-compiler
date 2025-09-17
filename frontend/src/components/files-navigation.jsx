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
import { FileCode, FileJson, FileText, FileType, FolderOpen, Folder } from "lucide-react";
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
import { fileStorage, getFileExtension } from "@/lib/file-storage";
import { FileContextMenu } from "@/components/file-context-menu";
import { FileDialog } from "@/components/file-dialog";

export function FilesNavigation({ onFileSelect, ...props }) {
  const [selectedIds, setSelectedIds] = useState([]);
  const [files, setFiles] = useState([]);
  const [dialogState, setDialogState] = useState({
    open: false,
    type: null,
    file: null,
    title: "",
    description: "",
    placeholder: ""
  });
  const fileInputRef = useRef(null);

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
        onFileSelect?.(selectedFile.path);
      }
    }
  };

  const openDialog = (type, file = null) => {
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
      ...configs[type]
    });
  };

  const handleDialogConfirm = async (value) => {
    try {
      switch (dialogState.type) {
        case 'createFile':
          await fileStorage.createFile(value, getDefaultContent(value));
          break;
        case 'createFolder':
          await fileStorage.createFolder(value);
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

  const handleUpload = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (event) => {
    const selectedFiles = Array.from(event.target.files);
    if (selectedFiles.length === 0) return;

    try {
      await fileStorage.uploadFiles(selectedFiles);
      await loadFiles();
    } catch (error) {
      alert(error.message);
      console.error("Error uploading files:", error);
    }
    
    // Reset file input
    event.target.value = '';
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
    
    const extension = getFileExtension(file.name);
    switch (extension) {
      case 'tex':
        return <FileText className="h-4 w-4" />;
      case 'bib':
        return <FileJson className="h-4 w-4" />;
      case 'pdf':
        return <FileType className="h-4 w-4" />;
      default:
        return <FileCode className="h-4 w-4" />;
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
          const childFiles = fileList.filter(f => 
            f.path.startsWith(folder.path + '/') && 
            f.path.split('/').length === folder.path.split('/').length + 1
          );
          
          return (
            <FileContextMenu
              key={folder.id}
              file={folder}
              onRename={() => openDialog('rename', folder)}
              onCopy={() => openDialog('copy', folder)}
              onDelete={() => handleDelete(folder)}
              onDownload={() => handleDownload(folder)}
              onCreateFile={() => openDialog('createFile')}
              onCreateFolder={() => openDialog('createFolder')}
              onUpload={handleUpload}
              onDownloadAll={handleDownloadAll}
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
          
          return (
            <FileContextMenu
              key={file.id}
              file={file}
              onRename={() => openDialog('rename', file)}
              onCopy={() => openDialog('copy', file)}
              onDelete={() => handleDelete(file)}
              onDownload={() => handleDownload(file)}
              onCreateFile={() => openDialog('createFile')}
              onCreateFolder={() => openDialog('createFolder')}
              onUpload={handleUpload}
              onDownloadAll={handleDownloadAll}
            >
              <TreeNode nodeId={file.id} isLast={isLast} level={level}>
                <TreeNodeTrigger>
                  <TreeExpander />
                  <TreeIcon icon={getFileIcon(file)} />
                  <TreeLabel>{file.name}</TreeLabel>
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
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Files</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <FileContextMenu
                  onCreateFile={() => openDialog('createFile')}
                  onCreateFolder={() => openDialog('createFolder')}
                  onUpload={handleUpload}
                  onDownloadAll={handleDownloadAll}
                >
                  <TreeProvider
                    defaultExpandedIds={[]}
                    onSelectionChange={handleFileSelect}
                    multiSelect={false}
                    selectedIds={selectedIds}
                  >
                    <TreeView>
                      {renderFileTree(files.filter(f => !f.path.includes('/', 1)))}
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

      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileUpload}
        accept=".tex,.bib,.txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.xml,.yaml,.yml,.toml,.ini,.cfg,.conf,.log,.py,.go,.rs,.c,.cpp,.h,.hpp,.java,.kt,.swift,.php,.rb,.sh,.bat,.ps1,.dockerfile,.gitignore,.png,.jpg,.jpeg,.gif,.svg,.bmp,.ico,.webp"
      />
    </>
  );
}