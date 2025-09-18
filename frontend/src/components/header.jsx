import { useState, useEffect } from "react";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fileStorage } from "@/lib/file-storage";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { compilerService } from "@/lib/compiler-service";
import { 
  Play,
  Wifi, 
  WifiOff, 
  Activity,
  Clock,
  AlertTriangle,
  ToggleLeft,
  ToggleRight,
  Info,
  Calendar,
  Settings,
  Loader2,
  XCircle
} from "lucide-react";

export default function Header({ onCompile, autoCompile, onAutoCompileChange, onFileChange, compilationProgress }) {
  const [health, setHealth] = useState(null);
  const [isOnline, setIsOnline] = useState(true);
  const [files, setFiles] = useState([]);
  const [selectedMainFile, setSelectedMainFile] = useState('main');
  const [selectedCompiler, setSelectedCompiler] = useState('pdflatex');
  const [isCompiling, setIsCompiling] = useState(false);

  // Health check every 3 seconds
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const healthData = await compilerService.getHealth();
        setHealth(healthData);
        setIsOnline(true);
      } catch (error) {
        console.error('Health check failed:', error);
        setIsOnline(false);
        setHealth(null);
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 3000);
    return () => clearInterval(interval);
  }, []);

  // Load files and auto-select main file
  useEffect(() => {
    const loadFiles = async () => {
      try {
        if (!fileStorage.db) {
          await fileStorage.init();
        }
        
        const allFiles = await fileStorage.getAllFiles();
        const texFiles = allFiles
          .filter(file => file.type === 'file' && file.name.endsWith('.tex'))
          .map(file => ({
            name: file.name.replace('.tex', ''),
            path: file.path
          }));
        
        setFiles(texFiles);
        
        // Auto-select main file (prioritize main.tex if it exists)
        const hasManualSelection = localStorage.getItem('manualFileSelection') === 'true';
        if (!hasManualSelection) {
          const mainFile = texFiles.find(f => f.name === 'main');
          if (mainFile) {
            setSelectedMainFile('main');
          } else if (texFiles.length > 0) {
            setSelectedMainFile(texFiles[0].name);
          }
        }
        
        // Load saved settings
        const savedSettings = localStorage.getItem('compilerSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          setSelectedCompiler(settings.compiler || 'pdflatex');
          if (hasManualSelection) {
            setSelectedMainFile(settings.defaultFile || 'main');
          }
        }
      } catch (error) {
        console.error('Error loading files:', error);
      }
    };

    loadFiles();
    
    // Listen for file changes
    const handleStorageChange = () => {
      loadFiles();
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const updateSettings = (key, value) => {
    const newSettings = {
      defaultFile: key === 'defaultFile' ? value : selectedMainFile,
      compiler: key === 'compiler' ? value : selectedCompiler,
    };
    
    if (key === 'defaultFile') setSelectedMainFile(value);
    if (key === 'compiler') setSelectedCompiler(value);
    
    localStorage.setItem('compilerSettings', JSON.stringify(newSettings));
  };

  const handleCompile = async () => {
    if (compilationProgress?.isCompiling || !selectedMainFile) return;
    
    // Check if server is busy before attempting compilation
    if (health?.running_jobs >= health?.max_concurrent) {
      return; // Don't attempt compilation if server is busy
    }
    
    setIsCompiling(true);
    try {
      await onCompile?.(selectedMainFile, selectedCompiler);
    } catch (error) {
      console.error('Compilation error in header:', error);
    } finally {
      setIsCompiling(false);
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return "bg-red-500";
    if (!health) return "bg-gray-500";
    if (health.status !== "healthy") return "bg-red-500";
    return (health.running_jobs >= health.max_concurrent) ? "bg-yellow-500" : "bg-green-500";
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    if (!health) return "Checking...";
    if (health.status !== "healthy") return "Error";
    return (health.running_jobs >= health.max_concurrent) ? "Busy" : "Online";
  };

  return (
    <header className="flex items-center justify-between p-2 border-b border-muted bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        
        <Button 
          onClick={handleCompile} 
          disabled={compilationProgress?.isCompiling || !selectedMainFile || (health?.running_jobs >= health?.max_concurrent)}
          size="sm" 
          className="gap-2"
          variant={compilationProgress?.error ? "destructive" : "default"}
        >
          {compilationProgress?.isCompiling ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="hidden sm:inline">{compilationProgress.stage}</span>
              <span className="sm:hidden">Compiling...</span>
            </>
          ) : compilationProgress?.error ? (
            <>
              <XCircle className="h-4 w-4" />
              <span className="hidden sm:inline">Error</span>
              <span className="sm:hidden">Error</span>
            </>
          ) : (health?.running_jobs >= health?.max_concurrent) ? (
            <>
              <AlertTriangle className="h-4 w-4" />
              <span className="hidden sm:inline">Server Busy</span>
              <span className="sm:hidden">Busy</span>
            </>
          ) : (
            <>
              <Play className="h-4 w-4" />
              Compile
            </>
          )}
        </Button>
        
        <Button
          variant={autoCompile ? "default" : "outline"}
          size="sm"
          onClick={() => onAutoCompileChange?.(!autoCompile)}
          className="gap-2"
          title="Toggle auto-compilation on file change"
        >
          {autoCompile ? <ToggleRight className="h-4 w-4 text-green-400" /> : <ToggleLeft className="h-4 w-4" />}
          <span className="hidden sm:inline">Auto</span>
        </Button>

        {/* Error/Status messages */}
        {compilationProgress?.error && (
          <div className="flex items-center gap-1 text-sm text-red-500 bg-red-50 dark:bg-red-950 px-2 py-1 rounded">
            <XCircle className="h-3 w-3" />
            <span className="hidden sm:inline truncate max-w-40">{compilationProgress.error}</span>
            <span className="sm:hidden">Error</span>
          </div>
        )}

        {/* Queue indicator */}
        {compilationProgress?.hasQueuedCompilation && (
          <div className="flex items-center gap-1 text-sm text-orange-500">
            <Clock className="h-3 w-3" />
            <span className="hidden sm:inline">Queued</span>
          </div>
        )}
      </div>

      {/* Compiler and File Selection - Hide on small screens */}
      <div className="hidden sm:flex items-center gap-3">
        {files.length > 1 && (
          <Select value={selectedMainFile} onValueChange={(value) => updateSettings('defaultFile', value)}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Select file" />
            </SelectTrigger>
            <SelectContent>
              {files.map((file) => (
                <SelectItem key={file.name} value={file.name}>
                  {file.name}.tex
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        
        <Select value={selectedCompiler} onValueChange={(value) => updateSettings('compiler', value)}>
          <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pdflatex">PDFLaTeX</SelectItem>
            <SelectItem value="lualatex">LuaLaTeX</SelectItem>
            <SelectItem value="xelatex">XeLaTeX</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center gap-3">
        {health && isOnline && (
          <div className="hidden lg:flex items-center gap-2 text-sm text-muted-foreground">
            <Activity className="h-3 w-3" />
            <span>{health.running_jobs || 0}/{health.max_concurrent || 0}</span>
            <Separator orientation="vertical" className="h-4" />
            <Clock className="h-3 w-3" />
            <span>{health.compilation_timeout || '60s'}</span>
          </div>
        )}

        <div className="flex items-center gap-2">
          {isOnline ? <Wifi className="h-4 w-4 text-green-500" /> : <WifiOff className="h-4 w-4 text-red-500" />}
          <div className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor()}`} title={`Service Status: ${getStatusText()}`} />
          <Badge variant={getStatusText() === "Online" ? "default" : "destructive"}>
            {getStatusText()}
          </Badge>
        </div>

        {health?.running_jobs >= health?.max_concurrent && (
          <div className="hidden sm:flex items-center gap-1 text-yellow-500">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Server Busy</span>
          </div>
        )}
      </div>
    </header>
  );
}