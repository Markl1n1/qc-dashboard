
import React, { useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Upload, FileText, BarChart3, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Dialog } from '../types';
import { useDatabaseDialogs } from '../hooks/useDatabaseDialogs';

const Index = () => {
  const { dialogs, isLoading, error, loadDialogs } = useDatabaseDialogs();

  useEffect(() => {
    loadDialogs();
  }, [loadDialogs]);

  const getStatusColor = (status: Dialog['status']) => {
    switch (status) {
      case 'completed':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'processing':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'failed':
        return 'text-red-600 bg-red-50 border-red-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const recentDialogs = dialogs.slice(0, 5);
  const completedDialogs = dialogs.filter(d => d.status === 'completed').length;
  const processingDialogs = dialogs.filter(d => d.status === 'processing').length;

  if (isLoading && dialogs.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center space-x-2">
          <RefreshCw className="h-6 w-6 animate-spin" />
          <span>Loading dashboard...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">VoiceQC Dashboard</h1>
        <p className="text-muted-foreground">
          Manage and analyze your voice recordings with AI-powered quality control
        </p>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-600">Error: {error}</p>
            <Button 
              onClick={loadDialogs} 
              variant="outline" 
              size="sm" 
              className="mt-2"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Dialogs</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{dialogs.length}</div>
            <p className="text-xs text-muted-foreground">
              All uploaded recordings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{completedDialogs}</div>
            <p className="text-xs text-muted-foreground">
              Fully analyzed recordings
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Processing</CardTitle>
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{processingDialogs}</div>
            <p className="text-xs text-muted-foreground">
              Currently being analyzed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Upload className="h-5 w-5" />
              <span>Upload New Recording</span>
            </CardTitle>
            <CardDescription>
              Upload and analyze a new voice recording
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/upload">
              <Button className="w-full">
                <Upload className="h-4 w-4 mr-2" />
                Start Upload
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="h-5 w-5" />
              <span>View All Dialogs</span>
            </CardTitle>
            <CardDescription>
              Browse and manage all your recordings
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" asChild>
              <Link to="/dialogs">
                <FileText className="h-4 w-4 mr-2" />
                Browse Dialogs
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Dialogs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Dialogs</CardTitle>
          <CardDescription>
            Your most recently uploaded recordings
          </CardDescription>
        </CardHeader>
        <CardContent>
          {recentDialogs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No dialogs uploaded yet</p>
              <p className="text-sm">Upload your first recording to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentDialogs.map((dialog) => (
                <div key={dialog.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex-1">
                    <h3 className="font-medium">{dialog.fileName}</h3>
                    <div className="flex items-center space-x-4 text-sm text-muted-foreground">
                      <span>Agent: {dialog.assignedAgent}</span>
                      <span>•</span>
                      <span>{new Date(dialog.uploadDate).toLocaleDateString()}</span>
                      {dialog.qualityScore && (
                        <>
                          <span>•</span>
                          <span>Quality: {dialog.qualityScore}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(dialog.status)}`}>
                      {dialog.status}
                    </span>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to={`/dialog/${dialog.id}`}>View</Link>
                    </Button>
                  </div>
                </div>
              ))}
              
              {dialogs.length > 5 && (
                <div className="text-center pt-4">
                  <Button variant="outline" asChild>
                    <Link to="/dialogs">View All Dialogs</Link>
                  </Button>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Index;
