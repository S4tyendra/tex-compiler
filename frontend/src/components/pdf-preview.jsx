import { useState, useEffect, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsList, TabsTab, TabsPanels, TabsPanel } from "@/components/animate-ui/components/base/tabs";
import { 
  FileText, Download, Clock, CheckCircle, XCircle, History, Loader2,
  AlertCircle, Maximize2, Eye, Terminal, FileDown, Info, Calendar, Settings
} from "lucide-react";
import { saveAs } from 'file-saver';

export default function PDFPreview({ lastCompilation, compilations, onCompilationSelect }) {
  const [activeTab, setActiveTab] = useState("output");
  const [pdfUrl, setPdfUrl] = useState(null);
  const iframeRef = useRef(null);

  // Effect to handle new compilation data
  useEffect(() => {
    if (pdfUrl) {
      URL.revokeObjectURL(pdfUrl);
      setPdfUrl(null);
    }
    
    if (lastCompilation?.success && lastCompilation.pdfBlob) {
      const url = URL.createObjectURL(lastCompilation.pdfBlob);
      setPdfUrl(url);
    }
    
    // Auto-switch tabs based on compilation result
    if (lastCompilation) {
      setActiveTab(lastCompilation.success ? 'output' : 'log');
    }

    return () => {
      if (pdfUrl) {
        URL.revokeObjectURL(pdfUrl);
      }
    };
  }, [lastCompilation]);

  const downloadPDF = () => {
    if (lastCompilation?.pdfBlob) {
      saveAs(lastCompilation.pdfBlob, `${lastCompilation.mainFile || 'document'}.pdf`);
    }
  };

  const downloadLogs = () => {
    if (lastCompilation?.logsText) {
      const blob = new Blob([lastCompilation.logsText], { type: 'text/plain' });
      saveAs(blob, `${lastCompilation.mainFile || 'document'}-compilation.log`);
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
            Compile your project to see the PDF output and logs. Enable auto-compile for automatic updates.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col flex-1">
        <div className="flex items-center justify-between border-b bg-background flex-shrink-0">
          <TabsList className="h-auto bg-transparent border-none rounded-none overflow-x-auto">
            <TabsTab value="output" disabled={!lastCompilation.success} className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-3 md:px-4 py-2 flex items-center gap-2 flex-shrink-0">
              <Eye className="h-4 w-4" /> 
              <span className="hidden sm:inline">PDF Output</span>
              <span className="sm:hidden">PDF</span>
            </TabsTab>
            <TabsTab value="log" className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-3 md:px-4 py-2 flex items-center gap-2 flex-shrink-0">
              <Terminal className="h-4 w-4" /> 
              <span className="hidden sm:inline">Log</span>
              <span className="sm:hidden">Log</span>
            </TabsTab>
            <TabsTab value="history" className="relative group data-[selected]:bg-background data-[selected]:border-b-2 data-[selected]:border-primary rounded-none border-b-2 border-transparent hover:bg-muted/50 px-3 md:px-4 py-2 flex items-center gap-2 flex-shrink-0">
              <History className="h-4 w-4" /> 
              <span className="hidden sm:inline">History ({compilations.length})</span>
              <span className="sm:hidden">({compilations.length})</span>
            </TabsTab>
          </TabsList>

          <div className="flex items-center gap-2 p-2">
            {lastCompilation && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="sm" className="gap-2 px-2 md:px-3">
                    {lastCompilation.success ? <CheckCircle className="h-4 w-4 text-green-500" /> : <XCircle className="h-4 w-4 text-red-500" />}
                    <span className="hidden md:inline">Info</span>
                    <Info className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Compilation Details</h4>
                      <p className="text-sm text-muted-foreground">{lastCompilation.message}</p>
                    </div>
                    <div className="grid gap-2 text-sm">
                      <div className="flex items-center"><Calendar className="h-4 w-4 mr-2" /> <strong>Time:</strong> <span className="ml-auto">{formatTimestamp(lastCompilation.timestamp)}</span></div>
                      <div className="flex items-center"><Settings className="h-4 w-4 mr-2" /> <strong>Compiler:</strong> <span className="ml-auto">{lastCompilation.compiler}</span></div>
                    </div>
                    <div className="flex gap-2">
                      {lastCompilation.success && pdfUrl && (
                        <>
                          <Button variant="outline" size="sm" onClick={downloadPDF} className="flex-1"><FileDown className="h-4 w-4 mr-1" /> Download PDF</Button>
                          <Button variant="outline" size="sm" onClick={() => window.open(pdfUrl, '_blank')} className="flex-1"><Maximize2 className="h-4 w-4 mr-1" /> Fullscreen</Button>
                        </>
                      )}
                      {lastCompilation.logsText && <Button variant="outline" size="sm" onClick={downloadLogs} className="flex-1"><Download className="h-4 w-4 mr-1" /> Logs</Button>}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden">
          <TabsPanels className="h-full">
            <TabsPanel value="output" className="h-full">
              {!lastCompilation.success ? (
                <div className="h-full flex items-center justify-center p-8">
                  <Card className="p-8 text-center max-w-md">
                    <XCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">Compilation Failed</h3>
                    <p className="text-muted-foreground mb-4">{lastCompilation.message}</p>
                    <Button onClick={() => setActiveTab("log")} variant="outline">View Logs</Button>
                  </Card>
                </div>
              ) : pdfUrl ? (
                <iframe ref={iframeRef} src={pdfUrl} style={{ height: '100vh' }} className="w-full h-full border-0" title="PDF Preview" />
              ) : (
                <div className="h-full flex items-center justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div>
              )}
            </TabsPanel>

            <TabsPanel value="log" className="h-full">
              <div className="h-full flex flex-col">
                {/* Log Header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <Terminal className="h-4 w-4" />
                    <span className="font-medium">Compilation Log</span>
                    {lastCompilation.success ? (
                      <Badge variant="default" className="bg-green-500">Success</Badge>
                    ) : (
                      <Badge variant="destructive">Error</Badge>
                    )}
                  </div>
                  {lastCompilation.logsText && (
                    <Button variant="outline" size="sm" onClick={downloadLogs} className="gap-2">
                      <Download className="h-4 w-4" />
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  )}
                </div>

                {/* Log Content */}
                <ScrollArea className="flex-1">
                  <div className="p-4">
                    {lastCompilation.logsText ? (
                      <div className="space-y-2">
                        {/* Error Summary */}
                        {!lastCompilation.success && (
                          <Card className="p-3 border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-red-500 mt-0.5 flex-shrink-0" />
                              <div>
                                <div className="font-medium text-red-700 dark:text-red-300">Compilation Failed</div>
                                <div className="text-sm text-red-600 dark:text-red-400 mt-1">
                                  {lastCompilation.message || "Check the logs below for details"}
                                </div>
                              </div>
                            </div>
                          </Card>
                        )}

                        {/* Raw Logs */}
                        <Card className="overflow-hidden">
                          <div className="bg-muted/50 px-3 py-2 border-b">
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <FileText className="h-3 w-3" />
                              Raw Logs
                            </div>
                          </div>
                          <ScrollArea className="h-[400px] w-full">
                            <pre className="p-4 text-xs font-mono whitespace-pre-wrap leading-relaxed text-foreground/90 bg-background">
                              {lastCompilation.logsText}
                            </pre>
                          </ScrollArea>
                        </Card>

                        {/* Expandable Error Details */}
                        {!lastCompilation.success && (
                          <Card className="overflow-hidden">
                            <div className="bg-muted/50 px-3 py-2 border-b">
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <AlertCircle className="h-3 w-3" />
                                Common Solutions
                              </div>
                            </div>
                            <div className="p-4 text-sm space-y-2">
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                <span>Check for missing packages in your LaTeX document</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                <span>Verify file paths and references are correct</span>
                              </div>
                              <div className="flex items-start gap-2">
                                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-2 flex-shrink-0"></div>
                                <span>Look for syntax errors in LaTeX commands</span>
                              </div>
                            </div>
                          </Card>
                        )}
                      </div>
                    ) : (
                      <Card className="p-8 text-center">
                        <Terminal className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-semibold mb-2">No Logs Available</h3>
                        <p className="text-muted-foreground">
                          No compilation logs found for this session.
                        </p>
                      </Card>
                    )}
                  </div>
                </ScrollArea>
              </div>
            </TabsPanel>

            <TabsPanel value="history" className="h-full">
              <div className="h-full flex flex-col">
                {/* History Header */}
                <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4" />
                    <span className="font-medium">Compilation History</span>
                    <Badge variant="outline" className="bg-background">
                      {compilations.length} {compilations.length === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                </div>

                {/* History Content */}
                {compilations.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center p-8">
                    <Card className="p-8 text-center max-w-md">
                      <History className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-lg font-semibold mb-2">No History</h3>
                      <p className="text-muted-foreground">
                        Your compilation history will appear here after you run your first compilation.
                      </p>
                    </Card>
                  </div>
                ) : (
                  <ScrollArea className="flex-1">
                    <div className="p-4 space-y-3">
                      {compilations.map((comp, index) => (
                        <Card 
                          key={comp.id} 
                          className={`p-4 cursor-pointer transition-all hover:shadow-md hover:bg-muted/50 ${
                            lastCompilation?.id === comp.id ? 'ring-2 ring-primary bg-primary/5' : ''
                          }`} 
                          onClick={() => onCompilationSelect(comp)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              {comp.success ? (
                                <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className="font-medium truncate">{comp.mainFile}.tex</div>
                                  {index === 0 && (
                                    <Badge variant="secondary" className="text-xs">Latest</Badge>
                                  )}
                                </div>
                                <div className="text-sm text-muted-foreground">
                                  {formatTimestamp(comp.timestamp)}
                                </div>
                                {comp.message && (
                                  <div className="text-xs text-muted-foreground mt-1 truncate">
                                    {comp.message}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-4">
                              <Badge variant="outline" className="text-xs">
                                {comp.compiler}
                              </Badge>
                              <Badge 
                                variant={comp.success ? "default" : "destructive"} 
                                className="text-xs"
                              >
                                {comp.success ? "Success" : "Failed"}
                              </Badge>
                            </div>
                          </div>
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