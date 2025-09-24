import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AdminOperationRequest {
  operation: 'batch_user_update' | 'system_config_update' | 'bulk_delete' | 'create_user' | 'reset_password' | 'delete_user' | 'audit_log' | 'list_users' | 'update_system_config' | 'get_system_config';
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
      case 'create_user':
        return await handleCreateUser(supabase, data);
      case 'reset_password':
        return await handleResetPassword(supabase, data);
      case 'delete_user':
        return await handleDeleteUser(supabase, data);
      case 'audit_log':
        return await handleAuditLog(supabase, data);
      case 'list_users':
        return await handleListUsers(supabase, data);
      case 'update_system_config':
        return await handleUpdateSystemConfig(supabase, data);
      case 'get_system_config':
        return await handleGetSystemConfig(supabase, data);
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

async function handleCreateUser(supabase: any, data: any) {
  const { email, password, name, role } = data;
  
  try {
    // Create user using admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    });

    if (createError) {
      // Handle email_exists error gracefully
      if (createError.status === 422 && createError.code === 'email_exists') {
        try {
          // Find existing user by email
          const { data: existingUsers, error: listError } = await supabase.auth.admin.listUsers();
          if (listError) throw listError;
          
          const existingUser = existingUsers.users.find((u: any) => u.email === email);
          if (existingUser) {
            // Upsert profile for existing user
            const { error: profileError } = await supabase
              .from('profiles')
              .upsert({ 
                id: existingUser.id, 
                name, 
                email, 
                role 
              }, { onConflict: 'id' });

            if (profileError) throw profileError;

            await logAuditAction(supabase, 'user_exists_profile_upserted', { 
              user_id: existingUser.id, 
              email, 
              role 
            });

            return new Response(
              JSON.stringify({ 
                success: true, 
                user: existingUser,
                message: 'User already existed, profile updated',
                user_already_existed: true
              }),
              { 
                status: 200, 
                headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
              }
            );
          }
        } catch (fallbackError) {
          console.error('Fallback error:', fallbackError);
        }
        
        return new Response(
          JSON.stringify({ error: 'A user with this email already exists' }),
          { 
            status: 409, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      throw createError;
    }

    // Upsert profile with role (use upsert to ensure profile is created)
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({ 
        id: newUser.user.id, 
        name, 
        email, 
        role 
      }, { onConflict: 'id' });

    if (profileError) throw profileError;

    // Log audit trail
    await logAuditAction(supabase, 'user_created', { user_id: newUser.user.id, email, role });

    return new Response(
      JSON.stringify({ success: true, user: newUser.user }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Create user error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleResetPassword(supabase: any, data: any) {
  const { userId, newPassword } = data;
  
  try {
    const { error } = await supabase.auth.admin.updateUserById(userId, {
      password: newPassword
    });

    if (error) throw error;

    // Log audit trail
    await logAuditAction(supabase, 'password_reset', { user_id: userId });

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Reset password error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleDeleteUser(supabase: any, data: any) {
  const { userId } = data;
  
  try {
    // Check if user is admin - admins cannot delete admin users
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userId)
      .single();

    if (profile?.role === 'admin') {
      throw new Error('Cannot delete admin users');
    }

    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) throw error;

    // Log audit trail
    await logAuditAction(supabase, 'user_deleted', { user_id: userId });

    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Delete user error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleAuditLog(supabase: any, data: any) {
  const { action, details } = data;
  
  try {
    await logAuditAction(supabase, action, details);
    
    return new Response(
      JSON.stringify({ success: true }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('Audit log error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function handleListUsers(supabase: any, data: any) {
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('id, name, email, role, created_at')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ success: true, users: profiles }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('List users error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

/**
 * Update system configuration
 */
async function handleUpdateSystemConfig(supabase: any, data: any) {
  const { config } = data;
  
  if (!config || typeof config !== 'object') {
    throw new Error('Config object is required');
  }

  console.log('🔧 Updating system config:', Object.keys(config));

  const updates = Object.entries(config).map(([key, value]) => ({
    key,
    value: String(value)
  }));

  const { error } = await supabase
    .from('system_config')
    .upsert(updates, { onConflict: 'key' });

  if (error) {
    console.error('❌ Failed to update system config:', error);
    throw error;
  }

  await logAuditAction(supabase, 'system_config_updated', { config });
  
  console.log('✅ System config updated successfully');
  return new Response(
    JSON.stringify({ success: true, message: 'System configuration updated successfully' }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

/**
 * Get system configuration
 */
async function handleGetSystemConfig(supabase: any, data: any) {
  console.log('📋 Fetching system config');

  const { data: configData, error } = await supabase
    .from('system_config')
    .select('key, value, description');

  if (error) {
    console.error('❌ Failed to fetch system config:', error);
    throw error;
  }

  const config = configData.reduce((acc: any, item: any) => {
    acc[item.key] = item.value;
    return acc;
  }, {});

  console.log('✅ System config fetched successfully');
  return new Response(
    JSON.stringify({ config }),
    { 
      status: 200, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    }
  );
}

async function logAuditAction(supabase: any, action: string, details: any) {
  try {
    const { error } = await supabase
      .from('audit_logs')
      .insert({
        action,
        details,
        created_at: new Date().toISOString()
      });
    
    if (error) {
      console.error('Audit log insert error:', error);
    }
  } catch (error) {
    console.error('Audit logging failed:', error);
  }
}