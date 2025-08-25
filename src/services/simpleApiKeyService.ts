
// Simple API key service for AssemblyAI only
class SimpleApiKeyService {
  private readonly storageKey = 'assemblyai_api_key';
  private readonly hardcodedKey = '8e4af890380c42d2ab058010d9481861'; // Your API key for testing

  getAPIKey(provider: 'assemblyai'): string | null {
    if (provider === 'assemblyai') {
      return this.hardcodedKey;
    }
    return null;
  }

  setAPIKey(provider: 'assemblyai', apiKey: string): void {
    if (provider === 'assemblyai') {
      localStorage.setItem(this.storageKey, apiKey);
    }
  }

  validateAPIKey(provider: 'assemblyai', apiKey: string): boolean {
    return apiKey && apiKey.length > 20;
  }
}

export const simpleApiKeyService = new SimpleApiKeyService();
