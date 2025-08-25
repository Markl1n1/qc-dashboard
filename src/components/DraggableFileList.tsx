
import React, { useState, useEffect } from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Button } from './ui/button';
import { FileAudio, GripVertical, X } from 'lucide-react';
import { SortableItem } from './SortableItem';
import AudioQualityIndicator from './AudioQualityIndicator';
import { analyzeAudioFile, AudioMetadata } from '../utils/audioMetadataUtils';

interface DraggableFileListProps {
  files: File[];
  onReorder: (files: File[]) => void;
  onRemove: (index: number) => void;
}

const DraggableFileList: React.FC<DraggableFileListProps> = ({ files, onReorder, onRemove }) => {
  const [audioMetadata, setAudioMetadata] = useState<Record<string, AudioMetadata>>({});

  // Load audio metadata for each file
  useEffect(() => {
    const loadMetadata = async () => {
      const metadataMap: Record<string, AudioMetadata> = {};
      
      for (const file of files) {
        const metadata = await analyzeAudioFile(file);
        if (metadata) {
          metadataMap[file.name] = metadata;
        }
      }
      
      setAudioMetadata(metadataMap);
    };

    if (files.length > 0) {
      loadMetadata();
    }
  }, [files]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      const oldIndex = parseInt(active.id as string);
      const newIndex = parseInt(over?.id as string);

      onReorder(arrayMove(files, oldIndex, newIndex));
    }
  };

  if (files.length === 0) {
    return null;
  }

  return (
    <div className="mt-4">
      <h3 className="text-sm font-medium mb-3">Selected Files ({files.length})</h3>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={files.map((_, index) => index.toString())} strategy={verticalListSortingStrategy}>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => {
              const metadata = audioMetadata[file.name];
              return (
                <SortableItem key={index} id={index.toString()}>
                  <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
                    <div className="flex items-center space-x-3 flex-1 min-w-0">
                      <GripVertical className="h-4 w-4 text-muted-foreground cursor-grab" />
                      <FileAudio className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{file.name}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {(file.size / 1024 / 1024).toFixed(1)} MB
                          </p>
                          {metadata && (
                            <AudioQualityIndicator metadata={metadata} />
                          )}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemove(index)}
                      className="text-muted-foreground hover:text-destructive flex-shrink-0"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </SortableItem>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
};

export default DraggableFileList;
