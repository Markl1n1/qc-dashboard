// Emergency logging utility that bypasses normal console clearing
class EmergencyLogger {
  private static logCount = 0;
  private static maxLogs = 50;

  static log(message: string, data?: any) {
    this.logCount++;
    
    // Use multiple logging methods to ensure visibility
    console.warn(`🚨 EMERGENCY LOG ${this.logCount}: ${message}`, data || '');
    console.error(`🚨 EMERGENCY LOG ${this.logCount}: ${message}`, data || '');
    
    // Store in localStorage as backup
    try {
      const logs = JSON.parse(localStorage.getItem('emergencyLogs') || '[]');
      logs.push({
        timestamp: new Date().toISOString(),
        count: this.logCount,
        message,
        data: data ? JSON.stringify(data) : null
      });
      
      // Keep only last 50 logs
      if (logs.length > this.maxLogs) {
        logs.splice(0, logs.length - this.maxLogs);
      }
      
      localStorage.setItem('emergencyLogs', JSON.stringify(logs));
    } catch (e) {
      // Ignore localStorage errors
    }

    // If too many logs, something is wrong
    if (this.logCount > 100) {
      alert(`EMERGENCY: Too many logs (${this.logCount}). Possible infinite loop detected!`);
      throw new Error('Emergency stop: Too many log entries detected');
    }
  }

  static clear() {
    this.logCount = 0;
    localStorage.removeItem('emergencyLogs');
    console.warn('🚨 Emergency logs cleared');
  }

  static getLogs() {
    try {
      return JSON.parse(localStorage.getItem('emergencyLogs') || '[]');
    } catch {
      return [];
    }
  }
}

export { EmergencyLogger };
