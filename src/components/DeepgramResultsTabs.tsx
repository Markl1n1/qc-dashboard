
import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Users, Clock } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import DeepgramSpeakerDialog from './DeepgramSpeakerDialog';
import SpeakerTimelineView from './SpeakerTimelineView';

interface DeepgramResultsTabsProps {
  transcription: string;
  speakerUtterances: SpeakerUtterance[];
  detectedLanguage?: {
    language: string;
    confidence: number;
  };
  metadata?: {
    duration: number;
    model: string;
  };
}

const DeepgramResultsTabs: React.FC<DeepgramResultsTabsProps> = ({
  transcription,
  speakerUtterances,
  detectedLanguage,
  metadata
}) => {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Transcription Results
          {detectedLanguage && (
            <Badge variant="secondary">
              {detectedLanguage.language} ({Math.round(detectedLanguage.confidence * 100)}%)
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="dialog" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="dialog" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Speaker Dialog
            </TabsTrigger>
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline View
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dialog" className="mt-4">
            <DeepgramSpeakerDialog
              utterances={speakerUtterances}
              detectedLanguage={detectedLanguage}
              metadata={metadata}
            />
          </TabsContent>

          <TabsContent value="timeline" className="mt-4">
            <SpeakerTimelineView utterances={speakerUtterances} />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default DeepgramResultsTabs;
