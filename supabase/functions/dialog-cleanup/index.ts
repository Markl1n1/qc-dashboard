import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for cleanup operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get retention settings from system_config
    const { data: retentionConfig, error: configError } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'data_retention_days')
      .single();

    if (configError) {
      console.error('Error fetching retention config:', configError);
      throw new Error('Failed to get retention configuration');
    }

    const retentionDays = parseInt(retentionConfig?.value || '30');
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    console.log(`Starting cleanup of dialogs older than ${retentionDays} days (before ${cutoffDate.toISOString()})`);

    // Find dialogs to delete
    const { data: dialogsToDelete, error: findError } = await supabase
      .from('dialogs')
      .select('id, file_name, created_at')
      .lt('created_at', cutoffDate.toISOString());

    if (findError) {
      console.error('Error finding dialogs to delete:', findError);
      throw findError;
    }

    if (!dialogsToDelete || dialogsToDelete.length === 0) {
      console.log('No dialogs found for cleanup');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No dialogs found for cleanup',
          deletedCount: 0 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`Found ${dialogsToDelete.length} dialogs to delete`);

    // Delete related data first (cascade delete should handle this, but being explicit)
    const dialogIds = dialogsToDelete.map(d => d.id);

    // Delete dialog analysis
    const { error: analysisError } = await supabase
      .from('dialog_analysis')
      .delete()
      .in('dialog_id', dialogIds);

    if (analysisError) {
      console.error('Error deleting dialog analysis:', analysisError);
    }

    // Delete dialog transcriptions and utterances (will cascade)
    const { error: transcriptionError } = await supabase
      .from('dialog_transcriptions')
      .delete()
      .in('dialog_id', dialogIds);

    if (transcriptionError) {
      console.error('Error deleting transcriptions:', transcriptionError);
    }

    // Finally delete the dialogs
    const { error: deleteError } = await supabase
      .from('dialogs')
      .delete()
      .in('id', dialogIds);

    if (deleteError) {
      console.error('Error deleting dialogs:', deleteError);
      throw deleteError;
    }

    // Log the cleanup operation
    const { error: logError } = await supabase
      .from('audit_logs')
      .insert({
        action: 'dialog_cleanup',
        details: {
          deletedCount: dialogsToDelete.length,
          retentionDays,
          cutoffDate: cutoffDate.toISOString(),
          deletedDialogs: dialogsToDelete.map(d => ({ id: d.id, file_name: d.file_name, created_at: d.created_at }))
        },
        created_at: new Date().toISOString()
      });

    if (logError) {
      console.error('Error logging cleanup operation:', logError);
    }

    console.log(`Successfully deleted ${dialogsToDelete.length} dialogs`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        deletedCount: dialogsToDelete.length,
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Dialog cleanup error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});