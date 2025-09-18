import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { compilerService } from "@/lib/compiler-service";
import { AlertCircle, CheckCircle, RotateCcw } from "lucide-react";

export function ApiSettings({ onEndpointChange }) {
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState(null);

  useEffect(() => {
    // Load current API settings
    const apiSettings = localStorage.getItem('apiSettings');
    if (apiSettings) {
      try {
        const settings = JSON.parse(apiSettings);
        setApiEndpoint(settings.apiEndpoint || '');
      } catch (error) {
        console.warn('Failed to load API settings:', error);
      }
    }
  }, []);

  const validateEndpoint = async (endpoint) => {
    setIsValidating(true);
    setValidationStatus(null);
    
    try {
      // Temporarily test the endpoint
      const originalGetApiBase = compilerService.getApiBase;
      compilerService.getApiBase = () => endpoint;
      
      const health = await compilerService.getHealth();
      compilerService.getApiBase = originalGetApiBase;
      
      if (health.status === 'healthy' || health.status === 'ok') {
        setValidationStatus('success');
        return true;
      } else {
        setValidationStatus('error');
        return false;
      }
    } catch (error) {
      setValidationStatus('error');
      return false;
    } finally {
      setIsValidating(false);
    }
  };

  const handleSave = async () => {
    const endpoint = apiEndpoint.trim();
    
    if (!endpoint) {
      compilerService.resetApiBase();
      setValidationStatus('success');
      onEndpointChange?.();
      return;
    }

    // Validate URL format
    try {
      new URL(endpoint);
    } catch {
      setValidationStatus('error');
      return;
    }

    const isValid = await validateEndpoint(endpoint);
    if (isValid) {
      compilerService.setApiBase(endpoint);
      onEndpointChange?.();
    }
  };

  const handleReset = () => {
    setApiEndpoint('');
    compilerService.resetApiBase();
    setValidationStatus('success');
    onEndpointChange?.();
  };

  const getCurrentEndpoint = () => {
    return compilerService.getApiBase();
  };

  return (
    <div className="space-y-3">
      <div>
        <h4 className="font-medium text-sm">API Endpoint</h4>
        <p className="text-xs text-muted-foreground">
          Customize the LaTeX compilation service endpoint
        </p>
      </div>
      
      <div className="space-y-2">
        <div className="flex gap-2">
          <Input
            placeholder="https://your-api.example.com"
            value={apiEndpoint}
            onChange={(e) => {
              setApiEndpoint(e.target.value);
              setValidationStatus(null);
            }}
            className="flex-1 h-8"
          />
          <Button 
            onClick={handleSave}
            size="sm"
            disabled={isValidating}
            className="h-8"
          >
            {isValidating ? "Testing..." : "Save"}
          </Button>
        </div>
        
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Current: {getCurrentEndpoint()}
            </span>
            {validationStatus && (
              <Badge variant={validationStatus === 'success' ? 'default' : 'destructive'} className="h-4 text-xs">
                {validationStatus === 'success' ? (
                  <><CheckCircle className="w-2 h-2 mr-1" />Valid</>
                ) : (
                  <><AlertCircle className="w-2 h-2 mr-1" />Invalid</>
                )}
              </Badge>
            )}
          </div>
          <Button 
            onClick={handleReset}
            variant="outline" 
            size="sm"
            className="h-6 px-2"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>
    </div>
  );
}