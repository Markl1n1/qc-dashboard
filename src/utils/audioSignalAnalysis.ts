/**
 * Audio signal analysis using Web Audio API
 * Analyzes audio quality metrics: SNR, clipping, silence ratio, RMS/peak levels
 */

export interface AudioSignalMetrics {
  rmsLevel: number;        // RMS amplitude (0-1)
  rmsDb: number;           // RMS in dB
  peakLevel: number;       // Peak amplitude (0-1)
  peakDb: number;          // Peak in dB
  clippingPercent: number; // % of samples near max (>0.99)
  silencePercent: number;  // % of analysis windows that are silent
  snrEstimate: number;     // Estimated SNR in dB
  dynamicRange: number;    // Dynamic range in dB
  duration: number;        // Duration in seconds
  sampleRate: number;
  channels: number;
  overallScore: number;    // 0-100 composite score
  issues: AudioIssue[];
}

export interface AudioIssue {
  type: 'clipping' | 'low_volume' | 'high_noise' | 'too_much_silence' | 'low_dynamic_range';
  severity: 'low' | 'medium' | 'high';
  message: string;
}

const SILENCE_THRESHOLD_DB = -40; // dB below which a window is considered silent
const WINDOW_SIZE = 2048;         // samples per analysis window
const CLIPPING_THRESHOLD = 0.99;

/**
 * Analyze audio file signal quality using Web Audio API
 */
export async function analyzeAudioSignal(file: File): Promise<AudioSignalMetrics | null> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    let audioBuffer: AudioBuffer;
    try {
      audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    } catch (e) {
      console.warn('Failed to decode audio:', e);
      audioContext.close();
      return null;
    }

    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    const duration = audioBuffer.duration;

    // Mix down to mono for analysis
    const length = audioBuffer.length;
    const monoData = new Float32Array(length);
    
    for (let ch = 0; ch < channels; ch++) {
      const channelData = audioBuffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        monoData[i] += channelData[i] / channels;
      }
    }

    audioContext.close();

    // Calculate metrics
    let sumSquares = 0;
    let peakLevel = 0;
    let clippedSamples = 0;

    for (let i = 0; i < length; i++) {
      const abs = Math.abs(monoData[i]);
      sumSquares += monoData[i] * monoData[i];
      if (abs > peakLevel) peakLevel = abs;
      if (abs >= CLIPPING_THRESHOLD) clippedSamples++;
    }

    const rmsLevel = Math.sqrt(sumSquares / length);
    const rmsDb = rmsLevel > 0 ? 20 * Math.log10(rmsLevel) : -100;
    const peakDb = peakLevel > 0 ? 20 * Math.log10(peakLevel) : -100;
    const clippingPercent = (clippedSamples / length) * 100;

    // Window-based analysis for silence and SNR
    const numWindows = Math.floor(length / WINDOW_SIZE);
    const windowRmsValues: number[] = [];
    let silentWindows = 0;
    const silenceThresholdLinear = Math.pow(10, SILENCE_THRESHOLD_DB / 20);

    for (let w = 0; w < numWindows; w++) {
      const start = w * WINDOW_SIZE;
      let windowSum = 0;
      for (let i = start; i < start + WINDOW_SIZE; i++) {
        windowSum += monoData[i] * monoData[i];
      }
      const windowRms = Math.sqrt(windowSum / WINDOW_SIZE);
      windowRmsValues.push(windowRms);
      if (windowRms < silenceThresholdLinear) silentWindows++;
    }

    const silencePercent = numWindows > 0 ? (silentWindows / numWindows) * 100 : 0;

    // SNR estimation: compare loud windows (speech) vs quiet windows (noise)
    const sortedRms = [...windowRmsValues].sort((a, b) => a - b);
    const noiseFloor = sortedRms.length > 10 
      ? sortedRms[Math.floor(sortedRms.length * 0.1)] // 10th percentile = noise
      : sortedRms[0] || 0.0001;
    const signalLevel = sortedRms.length > 10
      ? sortedRms[Math.floor(sortedRms.length * 0.9)] // 90th percentile = signal
      : sortedRms[sortedRms.length - 1] || 0.001;
    
    const snrEstimate = noiseFloor > 0 
      ? 20 * Math.log10(signalLevel / noiseFloor) 
      : 60;

    const dynamicRange = peakDb - (noiseFloor > 0 ? 20 * Math.log10(noiseFloor) : -60);

    // Identify issues
    const issues: AudioIssue[] = [];

    if (clippingPercent > 1) {
      issues.push({
        type: 'clipping',
        severity: clippingPercent > 5 ? 'high' : 'medium',
        message: `${clippingPercent.toFixed(1)}% сэмплов на максимуме — искажения звука`
      });
    }

    if (rmsDb < -35) {
      issues.push({
        type: 'low_volume',
        severity: rmsDb < -45 ? 'high' : 'medium',
        message: `Низкая громкость записи (${rmsDb.toFixed(1)} dB RMS)`
      });
    }

    if (snrEstimate < 15) {
      issues.push({
        type: 'high_noise',
        severity: snrEstimate < 8 ? 'high' : 'medium',
        message: `Высокий уровень шума (SNR ≈ ${snrEstimate.toFixed(0)} dB)`
      });
    }

    if (silencePercent > 50) {
      issues.push({
        type: 'too_much_silence',
        severity: silencePercent > 70 ? 'high' : 'medium',
        message: `${silencePercent.toFixed(0)}% записи — тишина`
      });
    }

    if (dynamicRange < 10) {
      issues.push({
        type: 'low_dynamic_range',
        severity: 'low',
        message: `Низкий динамический диапазон (${dynamicRange.toFixed(0)} dB)`
      });
    }

    // Composite score (0-100)
    let score = 100;
    // Penalize clipping
    score -= Math.min(30, clippingPercent * 6);
    // Penalize low SNR
    if (snrEstimate < 30) score -= Math.min(30, (30 - snrEstimate) * 1.5);
    // Penalize low volume
    if (rmsDb < -30) score -= Math.min(15, (-30 - rmsDb));
    // Penalize excessive silence
    if (silencePercent > 40) score -= Math.min(15, (silencePercent - 40) * 0.5);
    // Penalize low dynamic range
    if (dynamicRange < 15) score -= Math.min(10, (15 - dynamicRange));
    
    score = Math.max(0, Math.min(100, Math.round(score)));

    return {
      rmsLevel,
      rmsDb,
      peakLevel,
      peakDb,
      clippingPercent,
      silencePercent,
      snrEstimate,
      dynamicRange,
      duration,
      sampleRate,
      channels,
      overallScore: score,
      issues
    };
  } catch (error) {
    console.error('Audio signal analysis failed:', error);
    return null;
  }
}

/**
 * Get score color class based on value
 */
export function getScoreColor(score: number): string {
  if (score >= 80) return 'text-green-500';
  if (score >= 60) return 'text-yellow-500';
  if (score >= 40) return 'text-orange-500';
  return 'text-red-500';
}

export function getScoreLabel(score: number): string {
  if (score >= 80) return 'Отлично';
  if (score >= 60) return 'Хорошо';
  if (score >= 40) return 'Удовлетворительно';
  return 'Плохо';
}
