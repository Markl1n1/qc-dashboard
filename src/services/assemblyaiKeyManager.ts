
import { AssemblyAIApiKey, AssemblyAIRegion } from '../types/assemblyai';

export class AssemblyAIKeyManager {
  private static readonly STORAGE_KEY = 'assemblyai_api_keys';
  private static keys: AssemblyAIApiKey[] = [];

  static loadKeys(): AssemblyAIApiKey[] {
    if (this.keys.length === 0) {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        try {
          this.keys = JSON.parse(stored).map((key: any) => ({
            ...key,
            lastUsed: key.lastUsed ? new Date(key.lastUsed) : undefined
          }));
        } catch (error) {
          console.error('Failed to load API keys:', error);
          this.keys = [];
        }
      }
    }
    return this.keys;
  }

  static saveKeys(): void {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.keys));
  }

  static addKey(key: string, name: string, region: AssemblyAIRegion): AssemblyAIApiKey {
    const newKey: AssemblyAIApiKey = {
      id: crypto.randomUUID(),
      key,
      name,
      region,
      isActive: true,
      usageCount: 0,
      errorCount: 0,
      quotaExceeded: false
    };

    this.keys.push(newKey);
    this.saveKeys();
    console.log(`Added new AssemblyAI API key: ${name} (${region})`);
    return newKey;
  }

  static getActiveKey(region: AssemblyAIRegion): AssemblyAIApiKey | null {
    this.loadKeys();
    
    // Find an active key for the specified region that hasn't exceeded quota
    const availableKeys = this.keys.filter(key => 
      key.region === region && 
      key.isActive && 
      !key.quotaExceeded &&
      key.errorCount < 5
    );

    if (availableKeys.length === 0) {
      console.warn(`No available API keys for region: ${region}`);
      return null;
    }

    // Return the least used key
    return availableKeys.sort((a, b) => a.usageCount - b.usageCount)[0];
  }

  static markKeyUsed(keyId: string): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.usageCount++;
      key.lastUsed = new Date();
      this.saveKeys();
    }
  }

  static markKeyError(keyId: string, isQuotaError: boolean = false): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.errorCount++;
      if (isQuotaError) {
        key.quotaExceeded = true;
        console.warn(`API key ${key.name} has exceeded quota`);
      }
      if (key.errorCount >= 5) {
        key.isActive = false;
        console.warn(`API key ${key.name} disabled due to repeated errors`);
      }
      this.saveKeys();
    }
  }

  static resetKeyStatus(keyId: string): void {
    const key = this.keys.find(k => k.id === keyId);
    if (key) {
      key.errorCount = 0;
      key.quotaExceeded = false;
      key.isActive = true;
      this.saveKeys();
      console.log(`Reset status for API key: ${key.name}`);
    }
  }

  static removeKey(keyId: string): void {
    this.keys = this.keys.filter(k => k.id !== keyId);
    this.saveKeys();
  }

  static getAllKeys(): AssemblyAIApiKey[] {
    return this.loadKeys();
  }
}
