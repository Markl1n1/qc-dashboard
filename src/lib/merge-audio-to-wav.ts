// frontend/src/lib/merge-audio-to-wav.ts
// Merge N audio files (mp3/m4a/flac/ogg/wav) → one 8k mono WAV Blob (speech-optimized).
// Works in modern browsers without SharedArrayBuffer.
//
// Notes:
// - Uses Web Audio API to decode, resample to 8000 Hz mono, and concatenate sequentially.
// - For long recordings, memory grows with total duration (Float32 arrays). Consider warning users if inputs are hours long.

export type MergeResult = {
  blob: Blob;           // final 8 kHz mono WAV (audio/wav)
  durationSec: number;  // total duration (seconds)
  sampleRate: number;   // 8000
  channels: number;     // 1
  samples: number;      // total mono PCM samples
};

type Options = {
  onProgress?: (stage: "decoding" | "resampling" | "concatenating" | "encoding", i?: number, n?: number) => void;
  // If true, normalizes to -1..1 peak before 16-bit encoding (rarely needed for clean speech)
  normalizePeak?: boolean;
};

export async function mergeAudioFilesTo8kWav(
  files: File[],
  opts: Options = {}
): Promise<MergeResult> {
  if (!files || files.length < 2) throw new Error("Provide at least 2 files to merge.");

  const TARGET_SR = 8000;
  const TARGET_CH = 1;

  const AC: typeof AudioContext =
    (window as any).AudioContext || (window as any).webkitAudioContext;

  // 1) Decode all files to AudioBuffer
  opts.onProgress?.("decoding", 0, files.length);
  const decoded: AudioBuffer[] = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    const ab = await f.arrayBuffer();

    // short-lived context per decode (Safari-friendly)
    const ctx = new AC();
    const buf = await new Promise<AudioBuffer>((resolve, reject) => {
      // Safari sometimes requires a copy of the ArrayBuffer
      ctx.decodeAudioData(ab.slice(0), resolve, reject);
    }).finally(() => ctx.close());

    decoded.push(buf);
    opts.onProgress?.("decoding", i + 1, files.length);
  }

  // 2) Resample + downmix each to 8 kHz mono
  //    We use a simple nearest-neighbor resample; for ASR this is sufficient.
  opts.onProgress?.("resampling", 0, decoded.length);
  const monoChunks: Float32Array[] = [];
  let totalFrames = 0;

  for (let i = 0; i < decoded.length; i++) {
    const src = decoded[i];
    const srcSR = src.sampleRate;
    const channels = src.numberOfChannels;
    const srcLen = src.length;

    // Pre-get channel data
    const chData: Float32Array[] = [];
    for (let ch = 0; ch < channels; ch++) chData.push(src.getChannelData(ch));

    // Number of frames in target sample rate
    const framesAtTarget = Math.ceil((srcLen / srcSR) * TARGET_SR);
    const mono = new Float32Array(framesAtTarget);

    // Nearest neighbor resample + average for mono
    const ratio = srcSR / TARGET_SR;
    for (let t = 0; t < framesAtTarget; t++) {
      const srcIdx = Math.min(srcLen - 1, Math.floor(t * ratio));
      let sum = 0;
      for (let ch = 0; ch < channels; ch++) sum += chData[ch][srcIdx] || 0;
      mono[t] = sum / channels;
    }

    monoChunks.push(mono);
    totalFrames += mono.length;
    opts.onProgress?.("resampling", i + 1, decoded.length);
  }

  // 3) Concatenate sequentially (no gaps)
  opts.onProgress?.("concatenating");
  const joined = new Float32Array(totalFrames);
  {
    let cursor = 0;
    for (const chunk of monoChunks) {
      joined.set(chunk, cursor);
      cursor += chunk.length;
    }
  }

  // Optional normalization (peak normalize to avoid clipping after 16-bit quantization)
  if (opts.normalizePeak) {
    let peak = 0;
    for (let i = 0; i < joined.length; i++) {
      const v = Math.abs(joined[i]);
      if (v > peak) peak = v;
    }
    if (peak > 1e-6 && peak > 1.0) {
      const g = 1.0 / peak;
      for (let i = 0; i < joined.length; i++) joined[i] *= g;
    }
  }

  // 4) Encode 16-bit PCM WAV @ 8k mono
  opts.onProgress?.("encoding");
  const blob = float32ToWav16Mono(joined, TARGET_SR);

  return {
    blob,
    durationSec: totalFrames / TARGET_SR,
    sampleRate: TARGET_SR,
    channels: TARGET_CH,
    samples: totalFrames,
  };
}

// ---- WAV encode helper (PCM 16-bit, mono) ----
function float32ToWav16Mono(samples: Float32Array, sampleRate: number): Blob {
  const numChannels = 1;
  const bytesPerSample = 2; // 16-bit
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = samples.length * bytesPerSample;

  const header = new ArrayBuffer(44);
  const dv = new DataView(header);
  let o = 0;

  writeStr(dv, o, "RIFF"); o += 4;
  dv.setUint32(o, 36 + dataSize, true); o += 4;
  writeStr(dv, o, "WAVE"); o += 4;

  writeStr(dv, o, "fmt "); o += 4;
  dv.setUint32(o, 16, true); o += 4;          // PCM chunk size
  dv.setUint16(o, 1, true); o += 2;           // format = PCM
  dv.setUint16(o, numChannels, true); o += 2; // channels
  dv.setUint32(o, sampleRate, true); o += 4;  // sample rate
  dv.setUint32(o, byteRate, true); o += 4;    // byte rate
  dv.setUint16(o, blockAlign, true); o += 2;  // block align
  dv.setUint16(o, 16, true); o += 2;          // bits per sample

  writeStr(dv, o, "data"); o += 4;
  dv.setUint32(o, dataSize, true); o += 4;

  const pcm = new DataView(new ArrayBuffer(dataSize));
  for (let i = 0, off = 0; i < samples.length; i++, off += 2) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    pcm.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  return new Blob([header, pcm.buffer], { type: "audio/wav" });
}

function writeStr(dv: DataView, offset: number, s: string) {
  for (let i = 0; i < s.length; i++) dv.setUint8(offset + i, s.charCodeAt(i));
}
