import { supabase } from '../integrations/supabase/client';

export interface InstructionFile {
  name: string;
  created_at: string;
  updated_at: string;
  size: number;
}

class AIInstructionsService {
  private bucketName = 'ai-instructions';
  private maxFiles = 10;

  async uploadInstructionFile(file: File, type: 'system' | 'evaluation' | 'analysis'): Promise<void> {
    // Validate file type
    if (!file.name.endsWith('.txt')) {
      throw new Error('Only .txt files are allowed');
    }

    // Validate file size (max 1MB)
    if (file.size > 1024 * 1024) {
      throw new Error('File size must be less than 1MB');
    }

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `${type}_${timestamp}.txt`;

    // Upload file
    const { error: uploadError } = await supabase.storage
      .from(this.bucketName)
      .upload(fileName, file, {
        contentType: 'text/plain',
        upsert: false
      });

    if (uploadError) {
      throw new Error(`Upload failed: ${uploadError.message}`);
    }

    // Rotate files to keep only the latest 10 per type
    await this.rotateFiles(type);
  }

  async getLatestInstructions(type: 'system' | 'evaluation' | 'analysis'): Promise<string | null> {
    try {
      const files = await this.listInstructionFiles(type);
      
      if (files.length === 0) {
        return null;
      }

      // Get the most recent file
      const latestFile = files[0]; // Already sorted by created_at desc
      
      const { data: content, error } = await supabase.storage
        .from(this.bucketName)
        .download(latestFile.name);

      if (error) {
        console.warn(`Failed to download ${latestFile.name}:`, error);
        return null;
      }

      return await content.text();
    } catch (error) {
      console.error('Error fetching latest instructions:', error);
      return null;
    }
  }

  async listInstructionFiles(type: 'system' | 'evaluation' | 'analysis'): Promise<InstructionFile[]> {
    const { data: files, error } = await supabase.storage
      .from(this.bucketName)
      .list('', {
        limit: 100,
        offset: 0
      });

    if (error) {
      throw new Error(`Failed to list files: ${error.message}`);
    }

    // Filter files by type and sort by creation date (newest first)
    return (files || [])
      .filter(file => file.name.startsWith(`${type}_`) && file.name.endsWith('.txt'))
      .map(file => ({
        name: file.name,
        created_at: file.created_at || new Date().toISOString(),
        updated_at: file.updated_at || new Date().toISOString(),
        size: file.metadata?.size || 0
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  private async rotateFiles(type: 'system' | 'evaluation' | 'analysis'): Promise<void> {
    try {
      const files = await this.listInstructionFiles(type);
      
      // If we have more than maxFiles, delete the oldest ones
      if (files.length > this.maxFiles) {
        const filesToDelete = files.slice(this.maxFiles);
        
        for (const file of filesToDelete) {
          const { error } = await supabase.storage
            .from(this.bucketName)
            .remove([file.name]);
          
          if (error) {
            console.warn(`Failed to delete ${file.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error rotating files:', error);
    }
  }

  async deleteInstructionFile(fileName: string): Promise<void> {
    const { error } = await supabase.storage
      .from(this.bucketName)
      .remove([fileName]);

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`);
    }
  }

  async getFileStats(type: 'system' | 'evaluation' | 'analysis'): Promise<{ count: number; latestUpdate: string | null }> {
    const files = await this.listInstructionFiles(type);
    
    return {
      count: files.length,
      latestUpdate: files.length > 0 ? files[0].created_at : null
    };
  }
}

export const aiInstructionsService = new AIInstructionsService();
