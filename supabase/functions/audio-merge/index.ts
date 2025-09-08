import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.56.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface MergeRequest {
  files: { data: string; name: string; type: string }[];
  outputFormat?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const { files, outputFormat = 'mp3' }: MergeRequest = await req.json();

    if (!files || files.length < 2) {
      return new Response(
        JSON.stringify({ error: 'At least 2 files required for merging' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`[AudioMerge] Starting merge of ${files.length} files`);

    // For now, we'll use a simple concatenation approach
    // In a production environment, you might use a more sophisticated audio processing library
    const audioBuffers: ArrayBuffer[] = [];

    for (const file of files) {
      try {
        // Decode base64 data
        const binaryString = atob(file.data.split(',')[1]);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        audioBuffers.push(bytes.buffer);
      } catch (error) {
        console.error(`[AudioMerge] Failed to process file ${file.name}:`, error);
        return new Response(
          JSON.stringify({ error: `Failed to process file: ${file.name}` }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Simple concatenation for demonstration
    // Note: This is a basic implementation. For production use, consider using:
    // 1. Web Audio API for client-side processing
    // 2. External service like Cloudinary or AWS Transcribe
    // 3. More sophisticated audio processing library

    const totalLength = audioBuffers.reduce((sum, buffer) => sum + buffer.byteLength, 0);
    const mergedBuffer = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of audioBuffers) {
      mergedBuffer.set(new Uint8Array(buffer), offset);
      offset += buffer.byteLength;
    }

    // Convert back to base64
    const base64Data = btoa(String.fromCharCode(...mergedBuffer));
    const dataUrl = `data:audio/${outputFormat};base64,${base64Data}`;

    const response = {
      success: true,
      mergedFile: {
        data: dataUrl,
        name: `merged_audio_${Date.now()}.${outputFormat}`,
        type: `audio/${outputFormat}`,
        size: mergedBuffer.length
      },
      processingTime: Date.now()
    };

    console.log(`[AudioMerge] Successfully merged ${files.length} files into ${response.mergedFile.name}`);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('[AudioMerge] Merge failed:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Audio merge failed', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});