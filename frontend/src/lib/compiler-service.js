import { fileStorage } from './file-storage';

const API_BASE = 'https://tex-compiler.devh.in';

class CompilerService {
  constructor() {
    // We'll use IndexedDB through fileStorage instead of localStorage
  }

  async compileProject(allFiles, mainFile, compiler = 'pdflatex') {
    const formData = new FormData();
    
    // Create a ZIP file from all files
    const zip = new JSZip();
    
    allFiles.forEach(file => {
      if (file.type === 'file') {
        const path = file.path.startsWith('/') ? file.path.slice(1) : file.path;
        
        if (file.isBase64) {
          // Convert base64 back to binary for ZIP
          const binaryString = atob(file.content);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }
          zip.file(path, bytes);
        } else {
          zip.file(path, file.content);
        }
      }
    });
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    formData.append('file', zipBlob, 'project.zip');
    formData.append('main', mainFile.replace('.tex', ''));
    formData.append('compiler', compiler);
    
    const response = await fetch(`${API_BASE}/compile`, {
      method: 'POST',
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Compilation failed');
    }
    
    const result = await response.json();
    
    // Add compilation data with metadata for storage
    const compilationData = {
      job_id: result.job_id,
      success: result.success,
      message: result.message,
      logs_url: result.logs_url,
      pdf_url: result.pdf_url,
      mainFile,
      compiler
    };
    
    // Save to storage
    await this.addCompilation(compilationData);
    
    // If successful, also fetch the actual PDF and logs
    if (result.success) {
      try {
        // Fetch PDF
        const pdfResponse = await fetch(`${API_BASE}${result.pdf_url}`);
        if (pdfResponse.ok) {
          compilationData.pdfBlob = await pdfResponse.blob();
          compilationData.pdfUrl = URL.createObjectURL(compilationData.pdfBlob);
        }
        
        // Fetch logs
        const logsResponse = await fetch(`${API_BASE}${result.logs_url}`);
        if (logsResponse.ok) {
          compilationData.logs = await logsResponse.text();
        }
      } catch (error) {
        console.warn('Failed to fetch PDF or logs:', error);
      }
    } else {
      // For failed compilations, still try to get logs
      try {
        const logsResponse = await fetch(`${API_BASE}${result.logs_url}`);
        if (logsResponse.ok) {
          compilationData.logs = await logsResponse.text();
        }
      } catch (error) {
        console.warn('Failed to fetch error logs:', error);
      }
    }
    
    return compilationData;
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
  
  async addCompilation(compilation) {
    await fileStorage.saveCompilation(compilation);
    await fileStorage.deleteOldCompilations(); // Keep only 20 most recent
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