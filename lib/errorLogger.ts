export interface ErrorLog {
  timestamp: string;
  message: string;
  stack?: string;
  componentStack?: string;
  userAgent: string;
  url: string;
}

const ERROR_LOG_KEY = 'bon_error_logs';

export const logError = (error: Error, componentStack?: string) => {
  try {
    const logsString = localStorage.getItem(ERROR_LOG_KEY);
    const logs: ErrorLog[] = logsString ? JSON.parse(logsString) : [];
    
    const newLog: ErrorLog = {
      timestamp: new Date().toISOString(),
      message: error.message || String(error),
      stack: error.stack,
      componentStack,
      userAgent: navigator.userAgent,
      url: window.location.href,
    };
    
    // Keep last 50 errors
    logs.unshift(newLog);
    if (logs.length > 50) logs.pop();
    
    localStorage.setItem(ERROR_LOG_KEY, JSON.stringify(logs));
  } catch (e) {
    console.error('Failed to save error log', e);
  }
};

export const getErrorLogs = (): ErrorLog[] => {
  try {
    const logsString = localStorage.getItem(ERROR_LOG_KEY);
    return logsString ? JSON.parse(logsString) : [];
  } catch (e) {
    return [];
  }
};

export const clearErrorLogs = () => {
  localStorage.removeItem(ERROR_LOG_KEY);
};

export const downloadErrorLogs = () => {
  const logs = getErrorLogs();
  if (logs.length === 0) {
    alert('No hay logs de error para descargar.');
    return;
  }
  
  const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bon-error-logs-${new Date().toISOString().split('T')[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
