/*
  Node serverless audio-merge function (Vercel / Serverless compatible)
  - Downloads files from Supabase Storage (signed URLs)
  - Transcodes each input to PCM16 WAV mono @ 8000Hz using fluent-ffmpeg + ffmpeg-static
  - Concatenates them with ffmpeg concat demuxer and re-encodes to PCM16 WAV
  - Uploads merged file back to Supabase Storage and returns path + public URL

  Environment variables required:
  - SUPABASE_URL
  - SUPABASE_SERVICE_ROLE_KEY
  - SUPABASE_BUCKET (optional, defaults to 'audio-files')

  Install dependencies:
    npm install fluent-ffmpeg ffmpeg-static @supabase/supabase-js

  This file exports a handler(req, res) suitable for Vercel (exported as default) or for use in Express.
*/

const fs = require('fs');
const os = require('os');
const path = require('path');
const { promisify } = require('util');
const stream = require('stream');
const pipeline = promisify(stream.pipeline);
const fetch = globalThis.fetch || require('node-fetch');

const ffmpegStatic = require('ffmpeg-static');
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegStatic || 'ffmpeg');

const { createClient } = require('@supabase/supabase-js');

const DEFAULT_BUCKET = process.env.SUPABASE_BUCKET || 'audio-files';

function tmpName(prefix = 'am') {
  return path.join(os.tmpdir(), `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

async function downloadToFile(url, destPath) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const fileStream = fs.createWriteStream(destPath);
  await pipeline(res.body, fileStream);
}

async function transcodeToWav(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioChannels(1)
      .audioFrequency(8000)
      .audioCodec('pcm_s16le')
      .format('wav')
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function concatWavs(listFilePath, outputPath) {
  return new Promise((resolve, reject) => {
    // Use concat demuxer and re-encode to ensure consistent format
    ffmpeg()
      .input(listFilePath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-acodec', 'pcm_s16le', '-ar', '8000', '-ac', '1'])
      .on('end', () => resolve())
      .on('error', (err) => reject(err))
      .save(outputPath);
  });
}

async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return res.status(200).json({ ok: true, version: 'audio-merge-node-2025-09-12' });
    }
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body || {};
    const paths = Array.isArray(body.paths) ? body.paths : undefined;
    if (!paths || paths.length < 2) return res.status(400).json({ error: 'At least 2 files required' });

    const bucket = DEFAULT_BUCKET;

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      // Explicitly use global fetch
      global: { fetch: fetch }
    });

    // sanity limits
    if (paths.length > 64) return res.status(400).json({ error: 'Too many files' });

    const tmpInputs = [];
    const tmpWavs = [];

    // Download each file via signed URL and transcode
    for (let i = 0; i < paths.length; i++) {
      const p = paths[i];
      // create signed url valid for 120 seconds
      const { data: signed, error: signedErr } = await supabase.storage.from(bucket).createSignedUrl(p, 120);
      if (signedErr || !signed?.signedURL) throw new Error(`Failed to create signed URL for ${p}: ${signedErr?.message}`);
      const url = signed.signedURL;

      const inTmp = tmpName('in') + path.extname(p);
      await downloadToFile(url, inTmp);
      tmpInputs.push(inTmp);

      const outTmp = tmpName('wav') + '.wav';
      await transcodeToWav(inTmp, outTmp);
      tmpWavs.push(outTmp);

      // clean input file to save disk
      try { fs.unlinkSync(inTmp); } catch (e) {}
    }

    // Create concat list file
    const listFile = tmpName('list') + '.txt';
    const listContent = tmpWavs.map(f => `file '${f.replace(/'/g, "'\\''")}'`).join('\n');
    fs.writeFileSync(listFile, listContent);

    const mergedOut = tmpName('merged') + '.wav';
    await concatWavs(listFile, mergedOut);

    // Read merged file buffer
    const mergedBuf = fs.readFileSync(mergedOut);

    // Upload merged file
    const namePrefix = body.namePrefix || 'merged_audio';
    const destKey = `${namePrefix}_${Date.now()}.wav`;
    const { data: uploadRes, error: uploadErr } = await supabase.storage.from(bucket).upload(destKey, mergedBuf, {
      contentType: 'audio/wav',
      upsert: false,
    });
    if (uploadErr) throw new Error(`Failed to upload merged file: ${uploadErr.message}`);

    // Optionally delete sources
    if (body.deleteSources ?? true) {
      try { await supabase.storage.from(bucket).remove(paths); } catch (e) { /* ignore */ }
    }

    // Get public URL (if bucket public) or create signed url
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(destKey);
    let publicUrl = pub?.publicUrl ?? null;
    if (!publicUrl) {
      const { data: signed2 } = await supabase.storage.from(bucket).createSignedUrl(destKey, 60 * 60);
      publicUrl = signed2?.signedURL ?? null;
    }

    // cleanup temp files
    try { fs.unlinkSync(listFile); } catch (e) {}
    try { fs.unlinkSync(mergedOut); } catch (e) {}
    for (const w of tmpWavs) { try { fs.unlinkSync(w); } catch (e) {} }

    return res.status(200).json({ success: true, mergedFile: { bucket, path: destKey, url: publicUrl, contentType: 'audio/wav', size: mergedBuf.length, format: 'wav' } });

  } catch (err) {
    console.error('audio-merge-node error:', err);
    return res.status(500).json({ error: err instanceof Error ? err.message : String(err) });
  }
}

// Export for Vercel / serverless (default export) and for Express (module.exports)
module.exports = handler;
exports.default = handler;
