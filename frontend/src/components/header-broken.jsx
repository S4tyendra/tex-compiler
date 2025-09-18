import { useState, useEffect } from "react";
import {
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Server,
  Zap,
  AlertTriangle,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

export default function Header({ onCompile, selectedFile, onFileSelect, autoCompile, onAutoCompileChange, onFileChange }) {
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
        setIsOnline(false);
        setHealth(null);
      }
    };

    // Initial check
    checkHealth();

    // Set up interval
    const interval = setInterval(checkHealth, 3000);

    return () => clearInterval(interval);
  }, []);

  // Load files from storage and watch for changes
  useEffect(() => {
    const loadFiles = async () => {
      try {
        await fileStorage.init(); // Ensure database is initialized
        const allFiles = await fileStorage.getAllFiles();
        const texFiles = allFiles
          .filter(file => file.type === 'file' && file.name.endsWith('.tex'))
          .map(file => ({
            name: file.name.replace('.tex', ''),
            path: file.path
          }));
        setFiles(texFiles);
        
        // Auto-select main.tex if it exists and no file is manually selected
        const hasMain = texFiles.find(f => f.name === 'main');
        if (hasMain && !localStorage.getItem('manualFileSelection')) {
          setSelectedMainFile('main');
        }
        
        // Load saved settings
        const savedSettings = localStorage.getItem('compilerSettings');
        if (savedSettings) {
          const settings = JSON.parse(savedSettings);
          if (settings.defaultFile) {
            setSelectedMainFile(settings.defaultFile);
          }
          setSelectedCompiler(settings.compiler || 'pdflatex');
        }
      } catch (error) {
        console.error('Error loading files:', error);
      }
    };
    
    loadFiles();
    
    // Set up a periodic check for file changes (every 2 seconds)
    const interval = setInterval(loadFiles, 2000);
    
    return () => clearInterval(interval);
  }, []);

  const updateSettings = (key, value) => {
    const settings = {
      defaultFile: selectedMainFile,
      compiler: selectedCompiler,
      [key]: value
    };
    
    if (key === 'defaultFile') {
      setSelectedMainFile(value);
      localStorage.setItem('manualFileSelection', 'true'); // Mark as manually selected
    } else if (key === 'compiler') {
      setSelectedCompiler(value);
    }
    
    localStorage.setItem('compilerSettings', JSON.stringify(settings));
    
    // Notify parent of file changes for auto-compile
    if (onFileChange) {
      onFileChange(settings.defaultFile, settings.compiler);
    }
  };
  
  const handleCompile = async () => {
    if (isCompiling) return;
    
    setIsCompiling(true);
    try {
      await onCompile?.(selectedMainFile, selectedCompiler);
    } catch (error) {
      console.error('Compilation error:', error);
    } finally {
      setIsCompiling(false);
    }
  };

  const getStatusColor = () => {
    if (!isOnline) return "bg-red-500";
    if (!health) return "bg-gray-500";
    
    switch (health.status) {
      case "healthy":
        return health.running_jobs >= health.max_concurrent ? "bg-yellow-500" : "bg-green-500";
      case "degraded":
        return "bg-yellow-500";
      case "unhealthy":
      case "error":
        return "bg-red-500";
      default:
        return "bg-gray-500";
    }
  };

  const getStatusText = () => {
    if (!isOnline) return "Offline";
    if (!health) return "Checking...";
    
    switch (health.status) {
      case "healthy":
        return health.running_jobs >= health.max_concurrent ? "Busy" : "Online";
      case "degraded":
        return "Degraded";
      case "unhealthy":
      case "error":
        return "Error";
      default:
        return "Unknown";
    }
  };

  return (
    <header className="flex items-center justify-between p-2 border-b border-muted bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex items-center gap-3">
        <SidebarTrigger />
        <Separator orientation="vertical" className="h-6" />
        
        {/* Compile Button */}
        <Button 
          onClick={handleCompile} 
          disabled={isCompiling}
          size="sm" 
          className="gap-2"
        >
          <Play className="h-4 w-4" />
                    {isCompiling ? 'Compiling...' : 'Compile'}\n        </Button>\n        \n        {/* Auto-compile toggle */}\n        <Button\n          variant={autoCompile ? \"default\" : \"outline\"}\n          size=\"sm\"\n          onClick={() => onAutoCompileChange?.(!autoCompile)}\n          className=\"gap-2\"\n        >\n          {autoCompile ? <ToggleRight className=\"h-4 w-4\" /> : <ToggleLeft className=\"h-4 w-4\" />}\n          Auto\n        </Button>
        </Button>
      </div>

      {/* Compiler and File Selection */}
      <div className="flex items-center gap-3">
        {/* File Selection - only show if 2 or more files */}
        {files.length > 1 && (
          <Select 
            value={selectedMainFile} 
            onValueChange={(value) => updateSettings('defaultFile', value)}
          >
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
        
        {/* Compiler Selection */}
        <Select 
          value={selectedCompiler} 
          onValueChange={(value) => updateSettings('compiler', value)}
        >
          <SelectTrigger className="w-28">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pdflatex">PDFLaTeX</SelectItem>
            <SelectItem value="lualatex">LuaLaTeX</SelectItem>
            <SelectItem value="xelatex">XeLaTeX</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Status and Health */}
      <div className="flex items-center gap-3">
        {/* Service Health */}
        {health && isOnline && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Activity className="h-3 w-3" />
              <span>{health.running_jobs}/{health.max_concurrent}</span>
            </div>
            
            <Separator orientation="vertical" className="h-4" />
            
            <div className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              <span>{health.compilation_timeout}</span>
            </div>
          </div>
        )}

        {/* Connection Status */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="h-4 w-4 text-green-500" />
            ) : (
              <WifiOff className="h-4 w-4 text-red-500" />
            )}
            
            <div className="flex items-center gap-2">
              <div 
                className={`w-2 h-2 rounded-full animate-pulse ${getStatusColor()}`}
                title={`Service Status: ${getStatusText()}`}
              />
              <Badge 
                variant={isOnline && health?.status === "healthy" ? "default" : "destructive"}
                className="animate-in fade-in-50 duration-300"
              >
                {getStatusText()}
              </Badge>
            </div>
          </div>
        </div>

        {/* Server Overload Warning */}
        {health && health.running_jobs >= health.max_concurrent && (
          <div className="flex items-center gap-1 text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-xs font-medium">Server Busy</span>
          </div>
        )}
      </div>
    </header>
  );
}