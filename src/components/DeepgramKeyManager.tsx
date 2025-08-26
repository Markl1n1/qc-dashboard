
import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Trash2, Plus, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '../integrations/supabase/client';
import { toast } from 'sonner';
import { Alert, AlertDescription } from './ui/alert';

interface DeepgramKey {
  id: string;
  key_name: string;
  api_key: string;
  is_active: boolean;
  failure_count: number;
  consecutive_failures: number;
  success_count: number;
  last_used_at: string | null;
  last_failure_at: string | null;
  deactivated_at: string | null;
  created_at: string;
}

export const DeepgramKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<DeepgramKey[]>([]);
  const [loading, setLoading] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newApiKey, setNewApiKey] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchKeys = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('deepgram_api_keys')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setKeys(data || []);
    } catch (error: any) {
      toast.error(`Failed to fetch API keys: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const addKey = async () => {
    if (!newKeyName.trim() || !newApiKey.trim()) {
      toast.error('Please fill in both key name and API key');
      return;
    }

    try {
      const { error } = await supabase
        .from('deepgram_api_keys')
        .insert([{
          key_name: newKeyName.trim(),
          api_key: newApiKey.trim()
        }]);

      if (error) throw error;
      
      toast.success('API key added successfully');
      setNewKeyName('');
      setNewApiKey('');
      setShowAddForm(false);
      fetchKeys();
    } catch (error: any) {
      toast.error(`Failed to add API key: ${error.message}`);
    }
  };

  const deleteKey = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return;

    try {
      const { error } = await supabase
        .from('deepgram_api_keys')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast.success('API key deleted successfully');
      fetchKeys();
    } catch (error: any) {
      toast.error(`Failed to delete API key: ${error.message}`);
    }
  };

  const reactivateKey = async (id: string) => {
    try {
      const { error } = await supabase
        .from('deepgram_api_keys')
        .update({
          is_active: true,
          consecutive_failures: 0,
          deactivated_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      
      toast.success('API key reactivated successfully');
      fetchKeys();
    } catch (error: any) {
      toast.error(`Failed to reactivate API key: ${error.message}`);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleString();
  };

  const getSuccessRate = (key: DeepgramKey) => {
    const total = key.success_count + key.failure_count;
    if (total === 0) return 'N/A';
    return `${Math.round((key.success_count / total) * 100)}%`;
  };

  const activeKeys = keys.filter(k => k.is_active);
  const inactiveKeys = keys.filter(k => !k.is_active);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Deepgram API Keys</h3>
          <p className="text-sm text-muted-foreground">
            Manage your Deepgram API key pool. Keys are automatically rotated and deactivated after 5 consecutive failures.
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchKeys} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={() => setShowAddForm(!showAddForm)} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Add Key
          </Button>
        </div>
      </div>

      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Active Keys: {activeKeys.length} | Inactive Keys: {inactiveKeys.length} | Total: {keys.length}
        </AlertDescription>
      </Alert>

      {showAddForm && (
        <Card>
          <CardHeader>
            <CardTitle>Add New API Key</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="keyName">Key Name</Label>
              <Input
                id="keyName"
                value={newKeyName}
                onChange={(e) => setNewKeyName(e.target.value)}
                placeholder="e.g., Primary Key, Backup Key 1"
              />
            </div>
            <div>
              <Label htmlFor="apiKey">API Key</Label>
              <Input
                id="apiKey"
                type="password"
                value={newApiKey}
                onChange={(e) => setNewApiKey(e.target.value)}
                placeholder="Your Deepgram API key"
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={addKey}>Add Key</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="text-center py-4">Loading API keys...</div>
      ) : (
        <div className="grid gap-4">
          {keys.map((key) => (
            <Card key={key.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium">{key.key_name}</h4>
                      <Badge variant={key.is_active ? 'default' : 'destructive'}>
                        {key.is_active ? (
                          <>
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="h-3 w-3 mr-1" />
                            Inactive
                          </>
                        )}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground">
                      API Key: ••••••••{key.api_key.slice(-8)}
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="font-medium">Success Rate:</span>
                        <div className="text-green-600">{getSuccessRate(key)}</div>
                      </div>
                      <div>
                        <span className="font-medium">Failures:</span>
                        <div className="text-red-600">{key.failure_count}</div>
                      </div>
                      <div>
                        <span className="font-medium">Consecutive Failures:</span>
                        <div className="text-orange-600">{key.consecutive_failures}/5</div>
                      </div>
                      <div>
                        <span className="font-medium">Last Used:</span>
                        <div>{formatDate(key.last_used_at)}</div>
                      </div>
                    </div>

                    {!key.is_active && key.deactivated_at && (
                      <div className="text-sm text-red-600">
                        Deactivated: {formatDate(key.deactivated_at)}
                      </div>
                    )}
                  </div>

                  <div className="flex gap-2 ml-4">
                    {!key.is_active && (
                      <Button
                        onClick={() => reactivateKey(key.id)}
                        variant="outline"
                        size="sm"
                      >
                        Reactivate
                      </Button>
                    )}
                    <Button
                      onClick={() => deleteKey(key.id)}
                      variant="destructive"
                      size="sm"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {keys.length === 0 && (
            <Card>
              <CardContent className="pt-6 text-center py-8">
                <p className="text-muted-foreground">
                  No API keys found. Add your first Deepgram API key to get started.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
};
