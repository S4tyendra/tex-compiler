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
  Archive
} from "lucide-react";
import { useState } from "react";

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
  onDownloadAll
}) {
  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        {children}
      </ContextMenuTrigger>
      <ContextMenuContent className="w-64">
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
        <ContextMenuSeparator />
        {file && (
          <>
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