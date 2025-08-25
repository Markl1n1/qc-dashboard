
// Simple API key service - now uses Supabase secrets
class SimpleApiKeyService {
  private readonly storageKey = 'assemblyai_api_key';

  getAPIKey(provider: 'assemblyai'): string | null {
    // API keys are now handled by Supabase secrets through edge functions
    return null;
  }

  setAPIKey(provider: 'assemblyai', apiKey: string): void {
    // API keys are now stored in Supabase secrets
    console.log('API keys are now managed through Supabase secrets');
  }

  validateAPIKey(provider: 'assemblyai', apiKey: string): boolean {
    // Validation is now handled by edge functions
    return true;
  }
}

export const simpleApiKeyService = new SimpleApiKeyService();
