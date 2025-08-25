
import { AssemblyAIRegion, AssemblyAIRegionalConfig } from '../types/assemblyai';

export class AssemblyAIRegionService {
  private static readonly REGIONAL_CONFIGS: Record<AssemblyAIRegion, AssemblyAIRegionalConfig> = {
    us: {
      region: 'us',
      endpoint: 'https://api.assemblyai.com/v2/',
      name: 'United States',
      description: 'US-based servers for North American users'
    },
    eu: {
      region: 'eu', 
      endpoint: 'https://api.eu.assemblyai.com/v2/',
      name: 'European Union',
      description: 'EU-based servers for European users (GDPR compliant)'
    }
  };

  static getRegionalConfig(region: AssemblyAIRegion): AssemblyAIRegionalConfig {
    return this.REGIONAL_CONFIGS[region];
  }

  static getAllRegions(): AssemblyAIRegionalConfig[] {
    return Object.values(this.REGIONAL_CONFIGS);
  }

  static getEndpoint(region: AssemblyAIRegion): string {
    return this.getRegionalConfig(region).endpoint;
  }

  static detectOptimalRegion(): AssemblyAIRegion {
    // Simple timezone-based detection
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    
    if (timezone.includes('Europe') || timezone.includes('Africa') || 
        timezone.includes('Asia/Istanbul') || timezone.includes('Asia/Dubai')) {
      return 'eu';
    }
    
    return 'us'; // Default to US
  }

  static getUserRegionPreference(): AssemblyAIRegion {
    const stored = localStorage.getItem('assemblyai_region');
    if (stored && (stored === 'us' || stored === 'eu')) {
      return stored as AssemblyAIRegion;
    }
    
    const detected = this.detectOptimalRegion();
    this.setUserRegionPreference(detected);
    return detected;
  }

  static setUserRegionPreference(region: AssemblyAIRegion): void {
    localStorage.setItem('assemblyai_region', region);
    console.log(`AssemblyAI region preference set to: ${region}`);
  }
}
