
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Badge } from './ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from './ui/alert-dialog';
import { Separator } from './ui/separator';
import { 
  Plus, 
  Key, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  XCircle,
  Globe
} from 'lucide-react';
import { AssemblyAIKeyManager } from '../services/assemblyaiKeyManager';
import { AssemblyAIApiKey, AssemblyAIRegion } from '../types/assemblyai';
import { toast } from 'sonner';

const ApiKeyManager: React.FC = () => {
  const [keys, setKeys] = useState<AssemblyAIApiKey[]>([]);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newKeyData, setNewKeyData] = useState({
    key: '',
    name: '',
    region: 'us' as AssemblyAIRegion
  });

  useEffect(() => {
    loadKeys();
  }, []);

  const loadKeys = () => {
    const loadedKeys = AssemblyAIKeyManager.getAllKeys();
    setKeys(loadedKeys);
  };

  const handleAddKey = () => {
    if (!newKeyData.key.trim() || !newKeyData.name.trim()) {
      toast.error('Please fill in all fields');
      return;
    }

    try {
      AssemblyAIKeyManager.addKey(newKeyData.key, newKeyData.name, newKeyData.region);
      toast.success('API key added successfully');
      setNewKeyData({ key: '', name: '', region: 'us' });
      setIsAddDialogOpen(false);
      loadKeys();
    } catch (error) {
      toast.error('Failed to add API key');
    }
  };

  const handleRemoveKey = (keyId: string) => {
    try {
      AssemblyAIKeyManager.removeKey(keyId);
      toast.success('API key removed');
      loadKeys();
    } catch (error) {
      toast.error('Failed to remove API key');
    }
  };

  const handleResetKey = (keyId: string) => {
    try {
      AssemblyAIKeyManager.resetKeyStatus(keyId);
      toast.success('API key status reset');
      loadKeys();
    } catch (error) {
      toast.error('Failed to reset API key');
    }
  };

  const getKeyStatusBadge = (key: AssemblyAIApiKey) => {
    if (!key.isActive) {
      return <Badge variant="destructive">Disabled</Badge>;
    }
    if (key.quotaExceeded) {
      return <Badge variant="secondary">Quota Exceeded</Badge>;
    }
    if (key.errorCount >= 3) {
      return <Badge variant="outline">High Errors</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const getRegionBadge = (region: AssemblyAIRegion) => {
    return (
      <Badge variant="outline" className="flex items-center gap-1">
        <Globe className="h-3 w-3" />
        {region.toUpperCase()}
      </Badge>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Key className="h-5 w-5" />
            AssemblyAI API Keys
          </CardTitle>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="flex items-center gap-2">
                <Plus className="h-4 w-4" />
                Add Key
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add AssemblyAI API Key</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="keyName">Key Name</Label>
                  <Input
                    id="keyName"
                    value={newKeyData.name}
                    onChange={(e) => setNewKeyData({ ...newKeyData, name: e.target.value })}
                    placeholder="My AssemblyAI Key"
                  />
                </div>
                <div>
                  <Label htmlFor="region">Region</Label>
                  <Select
                    value={newKeyData.region}
                    onValueChange={(value) => setNewKeyData({ ...newKeyData, region: value as AssemblyAIRegion })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="us">United States</SelectItem>
                      <SelectItem value="eu">European Union</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={newKeyData.key}
                    onChange={(e) => setNewKeyData({ ...newKeyData, key: e.target.value })}
                    placeholder="Enter your AssemblyAI API key"
                  />
                </div>
                <Button onClick={handleAddKey} className="w-full">
                  Add API Key
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {keys.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Key className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>No API keys configured</p>
            <p className="text-sm">Add an AssemblyAI API key to get started</p>
          </div>
        ) : (
          <div className="space-y-4">
            {keys.map((key) => (
              <div key={key.id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium">{key.name}</h4>
                      {getRegionBadge(key.region)}
                      {getKeyStatusBadge(key)}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Key: {key.key.substring(0, 8)}...{key.key.substring(key.key.length - 4)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {(!key.isActive || key.quotaExceeded || key.errorCount >= 3) && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleResetKey(key.id)}
                        className="flex items-center gap-1"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Reset
                      </Button>
                    )}
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="outline" size="sm" className="text-destructive">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove API Key</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to remove "{key.name}"? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleRemoveKey(key.id)}>
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Usage Count</p>
                    <p className="font-medium">{key.usageCount}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Error Count</p>
                    <p className="font-medium flex items-center gap-1">
                      {key.errorCount}
                      {key.errorCount >= 5 && <AlertTriangle className="h-3 w-3 text-red-500" />}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Last Used</p>
                    <p className="font-medium">
                      {key.lastUsed ? new Date(key.lastUsed).toLocaleDateString() : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Status</p>
                    <div className="flex items-center gap-1">
                      {key.isActive ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <XCircle className="h-3 w-3 text-red-500" />
                      )}
                      <span className="font-medium">
                        {key.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ApiKeyManager;
