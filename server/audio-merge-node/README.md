Node audio-merge server function

Overview

This is a Node/ffmpeg based server function to merge multiple audio files of different formats (mp3, wav, flac, m4a, ogg) into a single WAV file (PCM16 mono @ 8000Hz). It downloads files from Supabase Storage, transcodes each to a canonical WAV, concatenates them with ffmpeg concat demuxer, uploads the merged file back to Supabase Storage, and returns metadata including a URL.

Files
- index.js - the server function handler (suitable for Vercel or Express)

Environment variables
- SUPABASE_URL
- SUPABASE_SERVICE_ROLE_KEY
- SUPABASE_BUCKET (optional, default: audio-files)

Dependencies
- fluent-ffmpeg
- ffmpeg-static
- @supabase/supabase-js
- node-fetch (if Node < 18)

Install
npm install fluent-ffmpeg ffmpeg-static @supabase/supabase-js node-fetch

Usage (Vercel)
- Place this directory under your project (e.g., /server/audio-merge-node)
- Add a Vercel Serverless function wrapper (or use this file directly if your routing supports it)
- Ensure environment variables are set in the Vercel dashboard
- Deploy and call via POST with JSON body:
  {
    "paths": ["temp-merge/<id>/file1.mp3", "temp-merge/<id>/file2.flac"],
    "namePrefix": "merged_123",
    "deleteSources": true
  }

Notes and caveats
- This function runs native ffmpeg (ffmpeg-static). It uses disk space for temporary files in the system tmp directory. Monitor disk and memory limits in your serverless environment.
- For high volume/large files prefer a dedicated worker VM with ffmpeg installed.

