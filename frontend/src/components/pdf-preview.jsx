import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTab, TabsPanels, TabsPanel } from "@/components/animate-ui/components/base/tabs";
import { compilerService } from "@/lib/compiler-service";
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Play,
  History,
  Loader2,
  AlertCircle,
  Maximize2,
  Eye,
  Terminal,
  FileDown
} from "lucide-react";

export default function PDFPreview({ lastCompilation: propLastCompilation }) {
  const [activeTab, setActiveTab] = useState("output");
  const [pdfUrl, setPdfUrl] = useState(null);
  const [logs, setLogs] = useState("");
  const [lastCompilation, setLastCompilation] = useState(null);
  const [compilations, setCompilations] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [loading, setLoading] = useState({ pdf: false, logs: false });
  const [error, setError] = useState({ pdf: null, logs: null });
  const iframeRef = useRef();

    // Update last compilation when prop changes\n  useEffect(() => {\n    if (propLastCompilation) {\n      setLastCompilation(propLastCompilation);\n      \n      // If PDF and logs are already included, use them directly\n      if (propLastCompilation.pdfUrl) {\n        setPdfUrl(propLastCompilation.pdfUrl);\n      } else {\n        setPdfUrl(null);\n      }\n      \n      if (propLastCompilation.logs) {\n        setLogs(propLastCompilation.logs);\n      } else {\n        setLogs(\"\");\n      }\n      \n      setError({ pdf: null, logs: null });\n    }\n  }, [propLastCompilation]);

  useEffect(() => {
    loadCompilationData();
  }, []);

  // Load PDF when output tab is active and we have a successful compilation
  useEffect(() => {
    if (activeTab === "output" && lastCompilation?.success && lastCompilation?.job_id) {
      // If PDF URL is already available, use it; otherwise load from API
      if (lastCompilation.pdfUrl && !pdfUrl) {
        setPdfUrl(lastCompilation.pdfUrl);
      } else if (!pdfUrl && !loading.pdf) {
        loadPDF(lastCompilation.job_id);
      }
    }
  }, [activeTab, lastCompilation, pdfUrl]);

  // Load logs when log tab is active
  useEffect(() => {
    if (activeTab === "log" && lastCompilation?.job_id) {
      // If logs are already available, use them; otherwise load from API
      if (lastCompilation.logs && !logs) {
        setLogs(lastCompilation.logs);
      } else if (!logs && !loading.logs) {
        loadLogs(lastCompilation.job_id);
      }
    }
  }, [activeTab, lastCompilation, logs]);

  const loadCompilationData = async () => {
    try {
      const history = await compilerService.getCompilations();
      setCompilations(history);
      const latest = await compilerService.getLatestCompilation();
      if (latest) {
        setLastCompilation(latest);
      }
    } catch (error) {
      console.error("Failed to load compilation history:", error);
    }
  };

  const loadPDF = async (jobId) => {
    if (!jobId) return;
    
    setLoading(prev => ({ ...prev, pdf: true }));
    setError(prev => ({ ...prev, pdf: null }));
    
    try {
      const pdfBlob = await compilerService.downloadPDF(jobId);
      const url = URL.createObjectURL(pdfBlob);
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl); // Clean up previous URL
      }
      setPdfUrl(url);
    } catch (err) {
      setError(prev => ({ ...prev, pdf: `Failed to load PDF: ${err.message}` }));
    } finally {
      setLoading(prev => ({ ...prev, pdf: false }));
    }
  };

  const loadLogs = async (jobId) => {
    if (!jobId) return;
    
    setLoading(prev => ({ ...prev, logs: true }));
    setError(prev => ({ ...prev, logs: null }));
    
    try {
      const logsText = await compilerService.getLogs(jobId);
      setLogs(logsText);
    } catch (err) {
      setError(prev => ({ ...prev, logs: `Failed to load logs: ${err.message}` }));
      setLogs("");
    } finally {
      setLoading(prev => ({ ...prev, logs: false }));
    }
  };

  const loadCompilation = async (compilation) => {
    setLastCompilation(compilation);
    setShowHistory(false);
    
    // Reset states
    setPdfUrl(null);
    setLogs("");
    setError({ pdf: null, logs: null, compile: null });
    
    if (compilation.success) {
      setActiveTab("output");
      await loadPDF(compilation.id);
    } else {
      setActiveTab("log");
      await loadLogs(compilation.id);
    }
  };

  const downloadPDF = () => {
    if (pdfUrl && lastCompilation) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = `${lastCompilation.mainFile || 'document'}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const downloadLogs = () => {
    if (logs && lastCompilation) {
      const blob = new Blob([logs], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${lastCompilation.mainFile || 'document'}-compilation.log`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  if (!lastCompilation) {
    return (
      <div className="h-full w-full flex items-center justify-center p-8">
        <Card className="p-8 text-center max-w-md">
          <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Compilations Yet</h3>
          <p className="text-muted-foreground">
            Use the compile button in the header to compile your LaTeX project and see the PDF output and logs here.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
        {/* Tab Headers */}
        <div className="flex items-center justify-between border-b bg-background flex-shrink-0">
          <TabsList className="h-auto bg-transparent border-none rounded-none">
            <TabsTab
              value="output"
              className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-4 py-2 flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              PDF Output
              {loading.pdf && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
            </TabsTab>
            <TabsTab
              value="log"
              className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-4 py-2 flex items-center gap-2"
            >
              <Terminal className="h-4 w-4" />
              Compilation Log
              {loading.logs && <Loader2 className="h-3 w-3 ml-1 animate-spin" />}
            </TabsTab>
            <TabsTab
              value="history"
              className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-4 py-2 flex items-center gap-2"
            >
              <History className="h-4 w-4" />
              History ({compilations.length})
            </TabsTab>
          </TabsList>

          {/* Actions */}
          <div className="flex items-center gap-2 p-2">
            {lastCompilation && (
              <>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  {lastCompilation.success ? (
                    <CheckCircle className="h-4 w-4 text-green-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <span>{formatTimestamp(lastCompilation.timestamp)}</span>
                  <Badge variant="outline">{lastCompilation.compiler || 'pdflatex'}</Badge>
                </div>
                
                {activeTab === "output" && lastCompilation.success && pdfUrl && (
                  <>
                    <Button variant="outline" size="sm" onClick={downloadPDF}>
                      <FileDown className="h-4 w-4 mr-1" />
                      Download PDF
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, '_blank')}>
                      <Maximize2 className="h-4 w-4 mr-1" />
                      Fullscreen
                    </Button>
                  </>
                )}
                
                {activeTab === "log" && logs && (
                  <Button variant="outline" size="sm" onClick={downloadLogs}>
                    <Download className="h-4 w-4 mr-1" />
                    Download Logs
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Error Display */}
        {(error.compile || error.pdf || error.logs) && (
          <div className="p-3 bg-destructive/10 border-b">
            <div className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">
                {error.compile || error.pdf || error.logs}
              </span>
            </div>
          </div>
        )}

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          <TabsPanels className="h-full">
            {/* PDF Output Tab */}
            <TabsPanel value="output" className="h-full">
              <div className="h-full w-full">
                {loading.pdf ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading PDF...</span>
                    </div>
                  </div>
                ) : error.pdf ? (
                  <div className="h-full flex items-center justify-center p-8">
                    <Card className="p-8 text-center max-w-md">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">PDF Load Error</h3>
                      <p className="text-muted-foreground mb-4">{error.pdf}</p>
                      <Button onClick={() => loadPDF(lastCompilation.job_id)}>Try Again</Button>
                    </Card>
                  </div>
                ) : !lastCompilation.success ? (
                  <div className="h-full flex items-center justify-center p-8">
                    <Card className="p-8 text-center max-w-md">
                      <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Compilation Failed</h3>
                      <p className="text-muted-foreground mb-4">
                        {lastCompilation.message || "The compilation was not successful. Check the logs for details."}
                      </p>
                      <Button onClick={() => setActiveTab("log")} variant="outline">
                        View Logs
                      </Button>
                    </Card>
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    ref={iframeRef}
                    src={pdfUrl}
                    className="w-full h-full border-0"
                    title="PDF Preview"
                  />
                ) : (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-muted-foreground" />
                      <span className="text-muted-foreground">PDF not loaded yet</span>
                    </div>
                  </div>
                )}
              </div>
            </TabsPanel>

            {/* Logs Tab */}
            <TabsPanel value="log" className="h-full">
              <div className="h-full w-full">
                {loading.logs ? (
                  <div className="h-full flex items-center justify-center">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin" />
                      <span>Loading logs...</span>
                    </div>
                  </div>
                ) : error.logs ? (
                  <div className="h-full flex items-center justify-center p-8">
                    <Card className="p-8 text-center max-w-md">
                      <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">Logs Load Error</h3>
                      <p className="text-muted-foreground mb-4">{error.logs}</p>
                      <Button onClick={() => loadLogs(lastCompilation.job_id)}>Try Again</Button>
                    </Card>
                  </div>
                ) : (
                  <ScrollArea className="h-full p-4">
                    <pre className="w-full text-sm font-mono whitespace-pre-wrap">
                      {logs || "No logs available"}
                    </pre>
                  </ScrollArea>
                )}
              </div>
            </TabsPanel>

            {/* History Tab */}
            <TabsPanel value="history" className="h-full">
              <div className="h-full w-full overflow-auto">
                {compilations.length === 0 ? (
                  <div className="h-full flex items-center justify-center p-8">
                    <Card className="p-8 text-center max-w-md">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No History</h3>
                      <p className="text-muted-foreground">
                        Compilation history will appear here after you compile projects.
                      </p>
                    </Card>
                  </div>
                ) : (
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-2">
                      {compilations.map((compilation) => (
                        <Card
                          key={compilation.id}
                          className={`p-4 cursor-pointer transition-colors hover:bg-muted/50 ${
                            lastCompilation?.id === compilation.id ? 'ring-2 ring-primary' : ''
                          }`}
                          onClick={() => loadCompilation(compilation)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {compilation.success ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <div>
                                <div className="font-medium">{compilation.mainFile}.tex</div>
                                <div className="text-sm text-muted-foreground">
                                  {formatTimestamp(compilation.timestamp)}
                                </div>
                              </div>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{compilation.compiler || 'pdflatex'}</Badge>
                              <Badge variant={compilation.success ? "default" : "destructive"}>
                                {compilation.success ? "Success" : "Failed"}
                              </Badge>
                            </div>
                          </div>
                          
                          {compilation.message && (
                            <div className="mt-2 text-sm text-muted-foreground">
                              {compilation.message}
                            </div>
                          )}
                        </Card>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </div>
            </TabsPanel>
          </TabsPanels>
        </div>
      </Tabs>
    </div>
  );
}