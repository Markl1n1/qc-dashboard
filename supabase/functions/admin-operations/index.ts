import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminOperationRequest {
  operation: 'batch_user_update' | 'system_config_update' | 'bulk_delete';
  data: any;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client with service role for admin operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { operation, data }: AdminOperationRequest = await req.json();

    switch (operation) {
      case 'batch_user_update':
        return await handleBatchUserUpdate(supabase, data);
      case 'system_config_update':
        return await handleSystemConfigUpdate(supabase, data);
      case 'bulk_delete':
        return await handleBulkDelete(supabase, data);
      default:
        return new Response(
          JSON.stringify({ error: 'Invalid operation' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
    }
  } catch (error) {
    console.error('Admin operation error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleBatchUserUpdate(supabase: any, data: any) {
  const { updates } = data;
  
  try {
    // Use transaction for batch updates
    const results = [];
    
    for (const update of updates) {
      const { userId, role, name } = update;
      
      const { data: result, error } = await supabase
        .from('profiles')
        .update({ role, name })
        .eq('id', userId)
        .select();
        
      if (error) throw error;
      results.push(result);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Batch user update error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleSystemConfigUpdate(supabase: any, data: any) {
  const { configs } = data;
  
  try {
    const results = [];
    
    for (const config of configs) {
      const { key, value } = config;
      
      const { data: result, error } = await supabase
        .from('system_config')
        .upsert({ key, value }, { onConflict: 'key' })
        .select();
        
      if (error) throw error;
      results.push(result);
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('System config update error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleBulkDelete(supabase: any, data: any) {
  const { table, ids } = data;
  
  try {
    const { data: result, error } = await supabase
      .from(table)
      .delete()
      .in('id', ids)
      .select();
      
    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, deleted: result.length }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Bulk delete error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}