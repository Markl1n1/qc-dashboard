import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { ResizableScrollArea } from './ui/resizable-scroll-area';
import { Clock, Copy, User, Users, AlertTriangle, ExternalLink } from 'lucide-react';
import { SpeakerUtterance } from '../types';
import { copyToClipboard, formatDialogForCopy } from '../utils/dialogFormatting';
import { toast } from 'sonner';
import { useSpeakerMapping } from '../hooks/useSpeakerMapping';
import { useLanguageStore } from '../store/languageStore';

interface DetectedIssue {
  rule_category?: string;
  comment?: string | { original?: string; russian?: string };
  utterance?: string;
  category?: string;
  description?: string;
  mistakeName?: string;
}

interface EnhancedSpeakerDialogProps {
  utterances: SpeakerUtterance[];
  mistakes?: DetectedIssue[];
  highlightedUtterance?: string | null;
  onNavigateToAnalysis?: (issueIndex: number) => void;
  detectedLanguage?: { language: string; confidence: number };
  metadata?: { duration: number; model: string };
  analysisData?: { speaker_0?: string; speaker_1?: string; role_0?: string; role_1?: string };
}

const EnhancedSpeakerDialog: React.FC<EnhancedSpeakerDialogProps> = ({
  utterances,
  mistakes = [],
  highlightedUtterance,
  onNavigateToAnalysis,
  detectedLanguage,
  metadata,
  analysisData
}) => {
  const { commentLanguage } = useLanguageStore();
  const { mapSpeakerName } = useSpeakerMapping(analysisData);

  // ---------- 1) Нормализации ----------
  // A) отображение (убираем переносы строк и NBSP, но ПУНКТУАЦИЮ не трогаем)
  const normalizeDisplay = (t: string) =>
    (t || '')
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  // B) сопоставление (строгое равенство для всех языков)
  const normalizeForMatch = (t: string) => {
    const s = (t || '')
      .normalize('NFKC')
      // унификация кавычек и тире, разные дефисы → обычные
      .replace(/[«»„“”‟"']/g, '"')
      .replace(/[‐-‒–—−]/g, '-')
      // переносы / NBSP
      .replace(/<br\s*\/?>/gi, ' ')
      .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
      .replace(/\u00A0/g, ' ')
      // схлоп пробелы
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();

    // снять внешние кавычки/точки, которые часто присылает анализ
    const unquoted = s.replace(/^"+|"+$/g, '').replace(/^[.]+|[.]+$/g, '').trim();
    return unquoted.length ? unquoted : s;
  };

  // ---------- 2) Служебные ----------
  const getDisplayComment = (mistake: DetectedIssue): string => {
    if (!mistake.comment) return mistake.description || '';
    if (typeof mistake.comment === 'object') {
      const c = mistake.comment as any;
      if (commentLanguage === 'russian' && c?.russian) return c.russian;
      return c?.original || c?.russian || '';
    }
    return mistake.comment || mistake.description || '';
  };

  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const getSpeakerStyle = (speaker: string) => {
    const speakerColors = [
      { backgroundColor: 'hsl(210, 100%, 97%)', borderColor: 'hsl(210, 100%, 85%)', textColor: 'hsl(210, 100%, 25%)' },
      { backgroundColor: 'hsl(120, 60%, 97%)', borderColor: 'hsl(120, 60%, 85%)', textColor: 'hsl(120, 60%, 25%)' },
      { backgroundColor: 'hsl(280, 60%, 97%)', borderColor: 'hsl(280, 60%, 85%)', textColor: 'hsl(280, 60%, 25%)' },
      { backgroundColor: 'hsl(30, 100%, 97%)', borderColor: 'hsl(30, 100%, 85%)', textColor: 'hsl(30, 100%, 25%)' }
    ];
    
    // Use stable mapping based on mapped speaker names
    const uniqueSpeakers = Array.from(new Set(mergedUtterances.map(u => mapSpeakerName(u.speaker))));
    const speakerIndex = uniqueSpeakers.indexOf(mapSpeakerName(speaker));
    const colorIndex = speakerIndex >= 0 ? speakerIndex % speakerColors.length : 0;
    
    return speakerColors[colorIndex];
  };

  // ---------- 3) Склейка соседних реплик одного спикера ----------
  const mergeConsecutiveUtterances = (arr: SpeakerUtterance[]): SpeakerUtterance[] => {
    if (!arr || arr.length === 0) return [];
    const merged: SpeakerUtterance[] = [];
    let current: SpeakerUtterance = {
      ...arr[0],
      text: normalizeDisplay(arr[0].text)
    };
    for (let i = 1; i < arr.length; i++) {
      const next: SpeakerUtterance = {
        ...arr[i],
        text: normalizeDisplay(arr[i].text)
      };
      if (current.speaker === next.speaker) {
        current.text = normalizeDisplay(`${current.text} ${next.text}`);
        current.end = next.end;
        current.confidence = Math.min(current.confidence, next.confidence);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    merged.push(current);
    return merged;
  };

  const mergedUtterances = useMemo(() => mergeConsecutiveUtterances(utterances), [utterances]);

  // ---------- 4) Строгое сопоставление ошибок к репликам (много ошибок на одну реплику допускается)
const assignments = useMemo(() => {
  const map = new Map<number, DetectedIssue[]>();

  // Предварительно нормализуем все объединённые реплики
  const utNorm = mergedUtterances.map(u => normalizeForMatch(u.text));

  mistakes.forEach((m) => {
    const raw = (m.utterance || '').trim();
    if (!raw) return;

    const mNorm = normalizeForMatch(raw);

    // Находим все реплики, где фрагмент встречается как ПОДСТРОКА (строгое вхождение)
    const candidates = utNorm
      .map((u, i) => ({ i, pos: u.indexOf(mNorm), len: u.length }))
      .filter(x => x.pos !== -1);

    if (candidates.length === 0) {
      // Ничего не крепим — строгий режим без «фаззи»
      return;
    }

    // Выбираем лучшую реплику: самая короткая подходящая, затем по более ранней позиции
    candidates.sort((a, b) => (a.len - b.len) || (a.pos - b.pos));
    const targetIndex = candidates[0].i;

    // Добавляем ошибку к выбранной реплике (несколько ошибок на одну реплику — ОК)
    const list = map.get(targetIndex) ?? [];
    list.push(m);
    map.set(targetIndex, list);
  });

  return map;
}, [mistakes, mergedUtterances]);

  const handleCopyDialog = async () => {
    const formattedText = formatDialogForCopy(mergedUtterances);
    const success = await copyToClipboard(formattedText);
    success ? toast.success('Dialog copied to clipboard') : toast.error('Failed to copy dialog');
  };

  const speakerStats = useMemo(
    () =>
      mergedUtterances.reduce((acc, u) => {
        const s = u.speaker;
        if (!acc[s]) acc[s] = { count: 0, totalDuration: 0 };
        acc[s].count++;
        acc[s].totalDuration += u.end - u.start;
        return acc;
      }, {} as Record<string, { count: number; totalDuration: number }>),
    [mergedUtterances]
  );

  return (
    <div className="space-y-4">
      {/* Metadata Header */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-4 w-4" />
              Transcription Results
              <Badge variant="outline">{mergedUtterances.length} segments</Badge>
              {mistakes.length > 0 && (
                <Badge variant="destructive" className="ml-2">
                  <AlertTriangle className="h-3 w-3 mr-1" />
                  {mistakes.length} issues
                </Badge>
              )}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={handleCopyDialog}>
              <Copy className="h-4 w-4 mr-2" />
              Copy Dialog
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4 text-sm">
            {detectedLanguage && (
              <div className="flex items-center gap-2">
                <Badge variant="secondary">Language</Badge>
                <span>{detectedLanguage.language}</span>
                <span className="text-foreground/70">({Math.round(detectedLanguage.confidence * 100)}% confidence)</span>
              </div>
            )}
            {metadata && (
              <>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  <span>{formatTime(metadata.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{metadata.model}</Badge>
                </div>
              </>
            )}
          </div>

          {/* Speaker Statistics */}
          <div className="mt-4 flex flex-wrap gap-4">
            {Object.entries(speakerStats).map(([speaker, stats]) => {
              const style = getSpeakerStyle(speaker);
              return (
                <div
                  key={speaker}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border"
                  style={{ backgroundColor: style.backgroundColor, borderColor: style.borderColor, color: style.textColor }}
                >
                  <User className="h-4 w-4" />
                  <span className="font-medium">{mapSpeakerName(speaker)}</span>
                  <Badge variant="outline" className="text-xs font-bold" style={{ color: style.textColor, borderColor: style.borderColor }}>
                    {stats.count} segments
                  </Badge>
                  <span className="text-xs font-medium">{formatTime(stats.totalDuration)} talk time</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Conversation Display */}
      <Card>
        <CardContent className="p-0">
          <ResizableScrollArea storageKey="enhanced-speaker-dialog">
            <div className="p-6 space-y-4">
              {mergedUtterances.map((utterance, index) => {
                const style = getSpeakerStyle(utterance.speaker);
                const utteranceMistakes = assignments.get(index) ?? [];
                const isHighlighted = highlightedUtterance && utterance.text.includes(highlightedUtterance || '');

                return (
                  <div
                    key={index}
                    className={`flex gap-4 p-4 rounded-lg border-l-4 transition-all hover:shadow-sm ${
                      isHighlighted ? 'ring-2 ring-primary shadow-lg' : ''
                    } ${utteranceMistakes.length > 0 ? 'border-red-200 bg-red-50/50' : ''}`}
                    style={{
                      backgroundColor:
                        isHighlighted ? 'hsl(var(--primary) / 0.1)' : utteranceMistakes.length > 0 ? 'hsl(var(--destructive) / 0.05)' : style.backgroundColor,
                      borderLeftColor: utteranceMistakes.length > 0 ? 'hsl(var(--destructive))' : style.borderColor
                    }}
                  >
                    <div className="flex-shrink-0 flex items-start">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center relative" style={{ backgroundColor: style.borderColor }}>
                        <User className="h-4 w-4" style={{ color: style.textColor }} />
                        {utteranceMistakes.length > 0 && (
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full flex items-center justify-center">
                            <AlertTriangle className="h-2 w-2 text-destructive-foreground" />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-medium text-sm" style={{ color: style.textColor }}>
                          {mapSpeakerName(utterance.speaker)}
                        </span>
                        <span className="text-xs text-foreground/70">
                          {formatTime(utterance.start)} - {formatTime(utterance.end)}
                        </span>
                        <Badge variant="outline" className="text-xs font-bold" style={{ color: style.textColor, borderColor: style.borderColor }}>
                          {Math.round(utterance.confidence * 100)}%
                        </Badge>
                        {utteranceMistakes.length > 0 && (
                          <Badge variant="destructive" className="text-xs">
                            {utteranceMistakes.length} issue{utteranceMistakes.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>

                      {/* единый параграф */}
                      <div className="text-sm leading-relaxed" style={{ color: style.textColor, whiteSpace: 'normal' }}>
                        {utterance.text}
                      </div>

                      {/* issues for this utterance */}
                      {utteranceMistakes.length > 0 && onNavigateToAnalysis && (
                        <div className="mt-3 pt-3 border-t border-destructive/20">
                          <div className="space-y-2">
                            {utteranceMistakes.map((mistake, mistakeIndex) => (
                              <div key={mistakeIndex} className="text-xs bg-destructive/10 p-2 rounded border border-destructive/20">
                                <div className="font-medium">{mistake.rule_category || 'Issue'}</div>
                                <div className="text-muted-foreground">{getDisplayComment(mistake)}</div>
                                <Button
                                  variant="link"
                                  size="sm"
                                  className="h-auto p-0 text-xs text-destructive hover:underline mt-1"
                                  onClick={() => {
                                    const globalIndex = mistakes.findIndex(
                                      m =>
                                        (m.utterance || '') === (mistake.utterance || '') &&
                                        JSON.stringify(m.comment) === JSON.stringify(mistake.comment)
                                    );
                                    if (globalIndex !== -1) onNavigateToAnalysis(globalIndex);
                                  }}
                                >
                                  <ExternalLink className="h-3 w-3 mr-1" />
                                  View in Analysis Results
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </ResizableScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

export default EnhancedSpeakerDialog;
