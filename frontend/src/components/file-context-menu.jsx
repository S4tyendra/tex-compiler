import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import {
  FileText,
  FolderPlus,
  FilePlus,
  Edit,
  Copy,
  Trash2,
  Download,
  Upload,
  Archive,
  FileArchive,
  Eye
} from "lucide-react";

export function FileContextMenu({ 
  children, 
  file, 
  onRename, 
  onCopy, 
  onDelete, 
  onDownload, 
  onCreateFile, 
  onCreateFolder,
  onUpload,
  onUploadZip,
  onDownloadAll,
  onPreview
}) {
  const isFolder = file?.type === 'folder';
  const showFolderOperations = !file || isFolder;

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
        {showFolderOperations && (
          <>
            <ContextMenuItem onClick={() => onCreateFile?.()}>
              <FilePlus className="h-4 w-4 mr-2" />
              New File
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCreateFolder?.()}>
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem onClick={() => onUpload?.()}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Files
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onUploadZip?.()}>
              <FileArchive className="h-4 w-4 mr-2" />
              Import ZIP
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        {file && (
          <>
            {!isFolder && (
              <ContextMenuItem onClick={() => onPreview?.(file)}>
                <Eye className="h-4 w-4 mr-2" />
                Preview
              </ContextMenuItem>
            )}
            <ContextMenuItem onClick={() => onRename?.(file)}>
              <Edit className="h-4 w-4 mr-2" />
              Rename
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onCopy?.(file)}>
              <Copy className="h-4 w-4 mr-2" />
              Copy
            </ContextMenuItem>
            <ContextMenuItem onClick={() => onDownload?.(file)}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </ContextMenuItem>
            <ContextMenuSeparator />
            <ContextMenuItem 
              onClick={() => onDelete?.(file)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete
            </ContextMenuItem>
            <ContextMenuSeparator />
          </>
        )}
        <ContextMenuItem onClick={() => onDownloadAll?.()}>
          <Archive className="h-4 w-4 mr-2" />
          Download All (ZIP)
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}