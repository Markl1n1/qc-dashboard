import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const { storagePath, bucket = 'audio-files' } = await req.json();

    if (!storagePath) {
      return new Response(
        JSON.stringify({ success: false, error: 'storagePath is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`🔇 [DENOISE] Starting denoising for: ${storagePath}`);

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Download audio from storage
    console.log(`📥 [DENOISE] Downloading from ${bucket}/${storagePath}...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from(bucket)
      .download(storagePath);

    if (downloadError || !fileData) {
      console.error('❌ [DENOISE] Download failed:', downloadError);
      return new Response(
        JSON.stringify({ success: false, error: `Download failed: ${downloadError?.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const fileSizeMB = fileData.size / (1024 * 1024);
    console.log(`📦 [DENOISE] File size: ${fileSizeMB.toFixed(2)} MB`);

    // Convert Blob to Uint8Array
    const audioBuffer = new Uint8Array(await fileData.arrayBuffer());

    // Try FFmpeg WASM denoising
    let denoisedBuffer: Uint8Array;
    let denoiseMethod = 'none';

    try {
      // Dynamic import of FFmpeg WASM for Deno
      const { FFmpeg } = await import("https://esm.sh/@ffmpeg/ffmpeg@0.12.10");
      const { fetchFile } = await import("https://esm.sh/@ffmpeg/util@0.12.1");

      console.log('🔧 [DENOISE] Initializing FFmpeg WASM...');
      const ffmpeg = new FFmpeg();

      // Load FFmpeg with core from CDN
      await ffmpeg.load({
        coreURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.js",
        wasmURL: "https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm/ffmpeg-core.wasm",
      });

      console.log('✅ [DENOISE] FFmpeg loaded');

      // Determine input format from file extension
      const ext = storagePath.split('.').pop()?.toLowerCase() || 'wav';
      const inputFile = `input.${ext}`;
      const outputFile = `output.${ext}`;

      // Write input file
      await ffmpeg.writeFile(inputFile, audioBuffer);

      // Apply RNNoise via arnndn filter
      // The arnndn filter uses built-in RNNoise model when no model file is specified
      // Alternative filters: anlmdn (non-local means), afftdn (FFT-based)
      console.log('🔇 [DENOISE] Applying noise reduction (afftdn + highpass)...');
      
      // Use afftdn (FFT-based denoiser) which is built into FFmpeg
      // Combined with highpass to remove low-frequency hum
      // nr: noise reduction in dB (default 12, we use 15 for call center)
      // nf: noise floor in dB
      // tn: enable noise tracking
      await ffmpeg.exec([
        '-i', inputFile,
        '-af', 'highpass=f=80,afftdn=nf=-25:nr=15:tn=1',
        '-y', outputFile
      ]);

      console.log('✅ [DENOISE] FFmpeg processing complete');

      // Read output
      const outputData = await ffmpeg.readFile(outputFile);
      denoisedBuffer = outputData instanceof Uint8Array ? outputData : new Uint8Array(outputData as ArrayBuffer);
      denoiseMethod = 'ffmpeg-afftdn';

      console.log(`📦 [DENOISE] Output size: ${(denoisedBuffer.length / 1024 / 1024).toFixed(2)} MB`);

    } catch (ffmpegError) {
      // FFmpeg WASM failed - this is expected in some Deno environments
      console.warn('⚠️ [DENOISE] FFmpeg WASM not available, falling back to passthrough:', 
        ffmpegError instanceof Error ? ffmpegError.message : String(ffmpegError));
      
      // Passthrough: use original audio without denoising
      denoisedBuffer = audioBuffer;
      denoiseMethod = 'passthrough';
    }

    // Upload denoised file
    const denoisedPath = `denoised_${storagePath}`;
    console.log(`📤 [DENOISE] Uploading denoised file: ${denoisedPath}`);

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(denoisedPath, new Blob([denoisedBuffer]), {
        contentType: 'audio/wav',
        upsert: true
      });

    if (uploadError) {
      console.error('❌ [DENOISE] Upload failed:', uploadError);
      return new Response(
        JSON.stringify({ success: false, error: `Upload failed: ${uploadError.message}` }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Delete original file to save storage
    console.log(`🗑️ [DENOISE] Deleting original file: ${storagePath}`);
    const { error: deleteError } = await supabase.storage
      .from(bucket)
      .remove([storagePath]);

    if (deleteError) {
      console.warn('⚠️ [DENOISE] Failed to delete original (non-critical):', deleteError.message);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ [DENOISE] Complete in ${processingTime}ms. Method: ${denoiseMethod}. Output: ${denoisedPath}`);

    return new Response(
      JSON.stringify({
        success: true,
        denoisedPath,
        originalPath: storagePath,
        method: denoiseMethod,
        processingTimeMs: processingTime,
        originalSizeMB: fileSizeMB,
        denoisedSizeMB: denoisedBuffer.length / (1024 * 1024)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ [DENOISE] Fatal error:', errorMessage);
    
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
