import { fileStorage } from './file-storage';
import JSZip from 'jszip';

const API_BASE = 'https://tex-compiler.devh.in';

class CompilerService {
  constructor() {
    // We'll use IndexedDB through fileStorage instead of localStorage
  }

  async compileProject(allFiles, mainFile, compiler = 'pdflatex') {
    try {
      const formData = new FormData();
      
      // Create ZIP file with all project files
      const zip = new JSZip();
      
      // Add all files to ZIP
      allFiles.forEach(file => {
        if (file.type === 'file') {
          const relativePath = file.path.startsWith('/') ? file.path.slice(1) : file.path;
          if (file.isBase64) {
            // Convert base64 back to binary for ZIP
            const binaryString = atob(file.content);
            const bytes = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
              bytes[i] = binaryString.charCodeAt(i);
            }
            zip.file(relativePath, bytes);
          } else {
            zip.file(relativePath, file.content);
          }
        }
      });
      
      // Generate ZIP blob
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      
      // Prepare form data
      formData.append('file', zipBlob, 'project.zip');
      formData.append('main', mainFile);
      formData.append('compiler', compiler);
      
      // Send request
      const response = await fetch(`${API_BASE}/compile`, {
        method: 'POST',
        body: formData,
      });
      
      const result = await response.json();
      
      // Handle HTTP errors
      if (!response.ok) {
        throw new Error(result.message || result.error || `HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Handle server errors in response
      if (result.error) {
        throw new Error(result.message || result.error);
      }
      
      // Return the result directly - we'll fetch PDF/logs later if needed
      return result;
    } catch (error) {
      console.error('Compilation error:', error);
      // Re-throw with better error message
      if (error.message.includes('Server overloaded') || error.message.includes('Maximum')) {
        throw new Error('Server is busy - please try again in a moment');
      } else if (error.message.includes('Failed to fetch')) {
        throw new Error('Network error - check your connection');
      } else {
        throw error;
      }
    }
  }
  
  async compileSingleFile(content, filename, compiler = 'pdflatex') {
    const formData = new FormData();
    const blob = new Blob([content], { type: 'text/plain' });
    formData.append('file', blob, filename);
    formData.append('compiler', compiler);
    
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    
    if (result.success || result.job_id) {
      const compilation = {
        id: result.job_id,
        timestamp: new Date().toISOString(),
        mainFile: filename.replace('.tex', ''),
        compiler,
        success: result.success,
        logsUrl: result.logs_url,
        pdfUrl: result.pdf_url,
        message: result.message
      };
      
      await this.addCompilation(compilation);
    }
    
    return result;
  }
  
  async getHealth() {
    try {
      const response = await fetch(`${API_BASE}/health`);
      return await response.json();
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        running_jobs: 0,
        max_concurrent: 3
      };
    }
  }
  
  async downloadPDF(jobId) {
    const response = await fetch(`${API_BASE}/files/${jobId}.pdf`);
    if (!response.ok) {
      throw new Error('PDF not found');
    }
    return response.blob();
  }
  
  async getLogs(jobId) {
    const response = await fetch(`${API_BASE}/logs/${jobId}.log`);
    if (!response.ok) {
      throw new Error('Logs not found');
    }
    return response.text();
  }
  
  // MODIFIED: This function now fetches artifacts and saves them locally.
  async addCompilation(compilationData) {
    let pdfBlob = null;
    let logsText = "";

    try {
      // Fetch PDF and logs immediately from the server's temporary URLs
      if (compilationData.success && compilationData.pdf_url) {
        try {
          const pdfResponse = await fetch(`${API_BASE}${compilationData.pdf_url}`);
          if (pdfResponse.ok) {
            pdfBlob = await pdfResponse.blob();
          }
        } catch (error) {
          console.warn('Failed to fetch PDF:', error);
        }
      }
      if (compilationData.logs_url) {
        try {
          const logsResponse = await fetch(`${API_BASE}${compilationData.logs_url}`);
          if (logsResponse.ok) {
            logsText = await logsResponse.text();
          }
        } catch (error) {
          console.warn('Failed to fetch logs:', error);
        }
      }
    } catch (error) {
      console.error("Error fetching compilation artifacts:", error);
    }

    const fullCompilationRecord = {
      ...compilationData,
      id: compilationData.job_id,
      pdfBlob, // Store the actual PDF Blob
      logsText, // Store the actual log text
    };
    
    await fileStorage.saveCompilation(fullCompilationRecord);
    await fileStorage.deleteOldCompilations(); // Keep only 20 most recent
    return fullCompilationRecord;
  }
  
  async getCompilations() {
    return await fileStorage.getCompilations();
  }
  
  async getLatestCompilation() {
    const compilations = await this.getCompilations();
    return compilations[0] || null;
  }
}

export const compilerService = new CompilerService();