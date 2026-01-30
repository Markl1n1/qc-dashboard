import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to verify JWT and get user
async function verifyAuth(req: Request, supabase: any): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Security Event: Missing or invalid authorization header');
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const token = authHeader.replace('Bearer ', '');
  const { data, error } = await supabase.auth.getUser(token);

  if (error || !data?.user) {
    console.error('Security Event: Invalid token or user not found:', error?.message);
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { user: data.user, error: null };
}

// Helper function to verify admin role
async function verifyAdminRole(supabase: any, userId: string): Promise<{ isAdmin: boolean; error: Response | null }> {
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single();

  if (profileError || !profile) {
    console.error('Security Event: Failed to fetch user profile:', profileError?.message);
    return {
      isAdmin: false,
      error: new Response(
        JSON.stringify({ error: 'Failed to verify user role' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  if (profile.role !== 'admin') {
    console.error('Security Event: Non-admin user attempted cleanup operation:', userId);
    return {
      isAdmin: false,
      error: new Response(
        JSON.stringify({ error: 'Forbidden - Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { isAdmin: true, error: null };
}

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

    // Verify JWT authentication
    const { user, error: authError } = await verifyAuth(req, supabase);
    if (authError) {
      return authError;
    }

    // Verify admin role - only admins can trigger cleanup
    const { isAdmin, error: roleError } = await verifyAdminRole(supabase, user.id);
    if (roleError) {
      return roleError;
    }

    console.log('Security Event: Dialog cleanup authorized for admin user:', user.id);

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

  } catch (error: unknown) {
    console.error('Dialog cleanup error:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});