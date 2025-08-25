import { pipeline, Pipeline } from '@huggingface/transformers';
import { UnifiedTranscriptionProgress } from '../types';

export interface TranscriptionOptions {
  modelSize: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  language?: string;
  device?: 'wasm' | 'webgpu';
}

export interface ModelInfo {
  name: string;
  size: string;
  speed: string;
  accuracy: string;
  multilingual: boolean;
}

// Extend Navigator interface for WebGPU
declare global {
  interface Navigator {
    gpu?: {
      requestAdapter(options?: any): Promise<any>;
    };
  }
}

// Simplified Pipeline type to avoid complex union types
type SimplifiedPipeline = any;

export class TranscriptionService {
  private pipeline: SimplifiedPipeline | null = null;
  private currentModel: string | null = null;
  private progressCallback: ((progress: UnifiedTranscriptionProgress) => void) | null = null;
  private webGPUSupported: boolean | null = null;

  // Model configurations with their trade-offs
  private readonly modelConfigs: Record<TranscriptionOptions['modelSize'], ModelInfo> = {
    tiny: {
      name: 'onnx-community/whisper-tiny.en',
      size: '15MB',
      speed: 'Very Fast',
      accuracy: 'Basic',
      multilingual: false
    },
    base: {
      name: 'onnx-community/whisper-base.en',
      size: '40MB',
      speed: 'Fast',
      accuracy: 'Good',
      multilingual: false
    },
    small: {
      name: 'onnx-community/whisper-small',
      size: '120MB',
      speed: 'Medium',
      accuracy: 'Better',
      multilingual: true
    },
    medium: {
      name: 'onnx-community/whisper-medium',
      size: '350MB',
      speed: 'Slow',
      accuracy: 'High',
      multilingual: true
    },
    large: {
      name: 'onnx-community/whisper-large-v3',
      size: '1.5GB',
      speed: 'Very Slow',
      accuracy: 'Highest',
      multilingual: true
    }
  };

  setProgressCallback(callback: (progress: UnifiedTranscriptionProgress) => void) {
    this.progressCallback = callback;
  }

  private updateProgress(stage: UnifiedTranscriptionProgress['stage'], progress: number, message: string) {
    if (this.progressCallback) {
      this.progressCallback({ stage, progress, message });
    }
    console.log(`[TranscriptionService] ${stage}: ${progress}% - ${message}`);
  }

  private async checkWebGPUSupport(): Promise<boolean> {
    if (this.webGPUSupported !== null) {
      return this.webGPUSupported;
    }

    try {
      if (!navigator.gpu) {
        console.log('[TranscriptionService] WebGPU not available - navigator.gpu is undefined');
        this.webGPUSupported = false;
        return false;
      }

      console.log('[TranscriptionService] Checking WebGPU adapter availability...');
      const adapter = await navigator.gpu.requestAdapter();
      
      if (!adapter) {
        console.log('[TranscriptionService] WebGPU adapter not available');
        this.webGPUSupported = false;
        return false;
      }

      console.log('[TranscriptionService] WebGPU adapter found:', adapter);
      this.webGPUSupported = true;
      return true;
    } catch (error) {
      console.error('[TranscriptionService] WebGPU check failed:', error);
      this.webGPUSupported = false;
      return false;
    }
  }

  private validateModelLanguageCompatibility(options: TranscriptionOptions): { valid: boolean; message?: string } {
    const modelInfo = this.modelConfigs[options.modelSize];
    
    // If no language is specified or language is English, any model is fine
    if (!options.language || options.language === 'en') {
      return { valid: true };
    }

    // For non-English languages, we need a multilingual model
    if (!modelInfo.multilingual) {
      return {
        valid: false,
        message: `${options.modelSize} model is English-only and cannot transcribe ${options.language}. Please select a multilingual model (small, medium, or large).`
      };
    }

    return { valid: true };
  }

  async loadModel(options: TranscriptionOptions): Promise<void> {
    // Validate model and language compatibility
    const validation = this.validateModelLanguageCompatibility(options);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    const modelInfo = this.modelConfigs[options.modelSize];
    const modelName = modelInfo.name;
    
    if (this.pipeline && this.currentModel === modelName) {
      console.log(`[TranscriptionService] Model ${modelName} already loaded`);
      return;
    }

    console.log(`[TranscriptionService] Loading ${modelName} model...`);
    this.updateProgress('loading', 0, `Initializing ${options.modelSize} model...`);

    try {
      // Check WebGPU availability if requested
      let useWebGPU = false;
      if (options.device === 'webgpu') {
        this.updateProgress('loading', 10, 'Checking WebGPU compatibility...');
        useWebGPU = await this.checkWebGPUSupport();
        
        if (!useWebGPU) {
          this.updateProgress('loading', 15, 'WebGPU not available, falling back to WASM...');
          console.warn('[TranscriptionService] WebGPU requested but not available, falling back to WASM');
        }
      }

      this.updateProgress('downloading', 25, `Downloading ${modelInfo.size} model...`);

      // Try WebGPU first if supported, then fallback to WASM
      let pipeline = null;
      let deviceUsed = 'wasm';

      if (useWebGPU) {
        try {
          console.log('[TranscriptionService] Attempting WebGPU pipeline creation...');
          pipeline = await this.createPipeline(modelName, 'webgpu');
          deviceUsed = 'webgpu';
          console.log('[TranscriptionService] Successfully created WebGPU pipeline');
        } catch (webgpuError) {
          console.warn('[TranscriptionService] WebGPU pipeline creation failed, falling back to WASM:', webgpuError);
          this.updateProgress('loading', 50, 'WebGPU failed, switching to WASM...');
        }
      }

      // Fallback to WASM if WebGPU failed or wasn't requested
      if (!pipeline) {
        console.log('[TranscriptionService] Creating WASM pipeline...');
        pipeline = await this.createPipeline(modelName, 'wasm');
        deviceUsed = 'wasm';
        console.log('[TranscriptionService] Successfully created WASM pipeline');
      }

      this.pipeline = pipeline;
      this.currentModel = modelName;
      
      const deviceMessage = deviceUsed === 'webgpu' ? 'Model loaded with WebGPU acceleration' : 'Model loaded with WASM processing';
      this.updateProgress('complete', 100, deviceMessage);
      console.log(`[TranscriptionService] Successfully loaded ${modelName} using ${deviceUsed}`);
    } catch (error) {
      console.error('[TranscriptionService] Failed to load model:', error);
      throw new Error(`Failed to load transcription model: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async createPipeline(modelName: string, device: 'wasm' | 'webgpu'): Promise<SimplifiedPipeline> {
    // Configure pipeline options based on device
    const pipelineConfig: any = {};
    
    if (device === 'webgpu') {
      pipelineConfig.device = 'webgpu' as const;
      pipelineConfig.dtype = 'fp32'; // Specify dtype for WebGPU to avoid warnings
    }
    
    console.log(`[TranscriptionService] Creating pipeline with config:`, pipelineConfig);
    
    return await pipeline(
      'automatic-speech-recognition', 
      modelName, 
      Object.keys(pipelineConfig).length > 0 ? pipelineConfig : undefined
    );
  }

  async transcribe(audioFile: File, options: TranscriptionOptions): Promise<string> {
    // Validate model and language compatibility before transcription
    const validation = this.validateModelLanguageCompatibility(options);
    if (!validation.valid) {
      throw new Error(validation.message);
    }

    if (!this.pipeline) {
      await this.loadModel(options);
    }

    console.log(`[TranscriptionService] Starting transcription of ${audioFile.name}`);
    this.updateProgress('processing', 0, 'Preparing audio for transcription...');

    try {
      // Convert File to URL for the pipeline
      const audioUrl = URL.createObjectURL(audioFile);
      
      this.updateProgress('processing', 50, 'Transcribing audio...');
      
      // Check if model is multilingual to determine what options to pass
      const modelInfo = this.modelConfigs[options.modelSize];
      const transcriptionOptions: any = {};

      // Only add task and language options for multilingual models
      if (modelInfo.multilingual) {
        transcriptionOptions.task = 'transcribe';
        
        // Only add language option if it's not English and explicitly specified
        if (options.language && options.language !== 'en') {
          transcriptionOptions.language = options.language;
        }
      }

      console.log(`[TranscriptionService] Using transcription options:`, transcriptionOptions);
      
      const result = await this.pipeline!(audioUrl, Object.keys(transcriptionOptions).length > 0 ? transcriptionOptions : undefined);

      // Clean up the URL
      URL.revokeObjectURL(audioUrl);

      this.updateProgress('complete', 100, 'Transcription complete');
      
      const transcription = typeof result === 'string' ? result : result.text;
      console.log(`[TranscriptionService] Transcription completed: ${transcription.length} characters`);
      
      return transcription;
    } catch (error) {
      console.error('[TranscriptionService] Transcription failed:', error);
      
      // Provide more specific error messages
      let errorMessage = 'Transcription failed';
      if (error instanceof Error) {
        if (error.message.includes('task')) {
          errorMessage = 'Model configuration error. Try using a different model size.';
        } else if (error.message.includes('language')) {
          errorMessage = 'Language not supported by this model. Try using a multilingual model.';
        } else {
          errorMessage = error.message;
        }
      }
      
      throw new Error(errorMessage);
    }
  }

  getModelInfo(modelSize: TranscriptionOptions['modelSize']): ModelInfo {
    return this.modelConfigs[modelSize];
  }

  getAllModelInfo(): Record<TranscriptionOptions['modelSize'], ModelInfo> {
    return this.modelConfigs;
  }

  isModelLoaded(): boolean {
    return this.pipeline !== null;
  }

  getCurrentModel(): string | null {
    return this.currentModel;
  }

  async getWebGPUStatus(): Promise<{ supported: boolean; message: string }> {
    const supported = await this.checkWebGPUSupport();
    
    if (supported) {
      return { supported: true, message: 'WebGPU is available and working' };
    } else {
      return { 
        supported: false, 
        message: 'WebGPU not available. Using WASM processing (slower but reliable)' 
      };
    }
  }
}

export const transcriptionService = new TranscriptionService();
