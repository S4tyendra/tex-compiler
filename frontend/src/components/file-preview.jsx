import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { AlertCircle, Download, FileX } from "lucide-react";
import { fileStorage } from "@/lib/file-storage";
import { useState, useEffect } from "react";

export function FilePreview({ open, onOpenChange, file }) {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && file) {
      loadPreview();
    }
  }, [open, file]);

  const loadPreview = async () => {
    if (!file) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const data = await fileStorage.getFilePreviewData(file.path);
      setPreviewData(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async () => {
    try {
      await fileStorage.downloadFile(file.path);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (!file) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            <span className="truncate pr-4">{file.name}</span>
            <Button variant="outline" size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          </DialogTitle>
          <DialogDescription>
            {file.fileType || 'Unknown'} file • {formatFileSize(file.size)}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <Card className="p-8 text-center">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Preview Error</h3>
              <p className="text-muted-foreground">{error}</p>
            </Card>
          ) : previewData ? (
            <div className="h-full overflow-hidden">
              {previewData.type === 'image' ? (
                <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-900 rounded-lg overflow-hidden">
                  <img
                    src={previewData.url}
                    alt={file.name}
                    className="max-w-full max-h-full object-contain"
                    style={{ maxWidth: '100%', maxHeight: '100%' }}
                  />
                </div>
              ) : previewData.type === 'text' ? (
                <ScrollArea className="h-full border rounded-lg">
                  <pre className="p-4 text-sm whitespace-pre-wrap break-words">
                    <code className="break-words">{previewData.content}</code>
                  </pre>
                </ScrollArea>
              ) : (
                <Card className="p-8 text-center">
                  <FileX className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Preview Not Supported</h3>
                  <p className="text-muted-foreground break-words">{previewData.message}</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    You can download this file to view it with an appropriate application.
                  </p>
                </Card>
              )}
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}