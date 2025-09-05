import jsPDF from 'jspdf';
import { SpeakerUtterance, Dialog } from '../types';

export class PDFGenerator {
  private doc: jsPDF;
  private yPosition: number = 20;
  private pageHeight: number;
  private margin: number = 20;
  private lineHeight: number = 7;
  private languagePreference: 'original' | 'russian' = 'original';

  constructor() {
    this.doc = new jsPDF();
    this.pageHeight = this.doc.internal.pageSize.height;
  }

  setLanguagePreference(preference: 'original' | 'russian'): void {
    this.languagePreference = preference;
  }

  private getCommentText(comment: any): string {
    if (!comment) return '';
    
    if (typeof comment === 'object' && comment) {
      if (this.languagePreference === 'russian' && comment.russian) {
        return comment.russian;
      }
      return comment.original || comment.russian || '';
    }
    
    return String(comment) || '';
  }

  private checkPageBreak(additionalHeight: number = 0): void {
    if (this.yPosition + additionalHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.yPosition = this.margin;
    }
  }

  private preprocessText(text: string): string {
    const processed = text
      .normalize('NFC')
      .replace(/\u00A0/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/[ąĄ]/g, 'a')
      .replace(/[ćĆ]/g, 'c')
      .replace(/[ęĘ]/g, 'e')
      .replace(/[łŁ]/g, 'l')
      .replace(/[ńŃ]/g, 'n')
      .replace(/[óÓ]/g, 'o')
      .replace(/[śŚ]/g, 's')
      .replace(/[źŹ]/g, 'z')
      .replace(/[żŻ]/g, 'z')
      .trim();

    return processed;
  }

  private addText(
    text: string,
    fontSize: number = 10,
    fontWeight: 'normal' | 'bold' = 'normal',
    isQuote: boolean = false
  ): void {
    this.doc.setFontSize(fontSize);
    
    if (isQuote) {
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(60, 60, 60);
    } else {
      this.doc.setFont('helvetica', fontWeight);
      this.doc.setTextColor(0, 0, 0);
    }
    
    const processedText = this.preprocessText(text);
    
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2) - (isQuote ? 20 : 0);
    const leftMargin = this.margin + (isQuote ? 20 : 0);
    
    const lines = this.doc.splitTextToSize(processedText, maxWidth);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, leftMargin, this.yPosition);
      this.yPosition += this.lineHeight;
    });
    
    if (isQuote) {
      this.doc.setTextColor(0, 0, 0);
    }
  }

  private cleanSpeakerLabel(speaker: string): string {
    return speaker
      .replace(/^Speaker\s+Speaker\s*/, 'Speaker ')
      .replace(/^Speaker\s+/, 'Speaker ');
  }

  private mergeConsecutiveUtterances(utterances: SpeakerUtterance[]): SpeakerUtterance[] {
    if (!utterances || utterances.length === 0) return [];

    const merged: SpeakerUtterance[] = [];
    let current = { 
      ...utterances[0], 
      speaker: this.cleanSpeakerLabel(utterances[0].speaker)
    };

    for (let i = 1; i < utterances.length; i++) {
      const next = { 
        ...utterances[i], 
        speaker: this.cleanSpeakerLabel(utterances[i].speaker)
      };
      
      if (current.speaker === next.speaker) {
        // merge into one continuous text block
        current.text = `${current.text} ${next.text}`.trim();
        current.end = next.end;
        current.confidence = Math.min(current.confidence, next.confidence);
      } else {
        merged.push(current);
        current = { ...next };
      }
    }
    
    merged.push(current);
    return merged;
  }

  private addSpeakerUtterance(utterance: SpeakerUtterance, index: number): void {
    this.checkPageBreak(this.lineHeight * 3);
    
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    if (utterance.speaker === 'Speaker 0') {
      this.doc.setTextColor(0, 64, 128);
    } else if (utterance.speaker === 'Speaker 1') {
      this.doc.setTextColor(25, 102, 25);
    } else {
      this.doc.setTextColor(76, 25, 102);
    }
    
    const speakerText = `[${index + 1}] ${utterance.speaker}:`;
    this.doc.text(speakerText, this.margin, this.yPosition);
    this.yPosition += this.lineHeight + 2;
    
    this.doc.setTextColor(0, 0, 0); 
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);

    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2) - 10;
    const processedText = this.preprocessText(utterance.text);
    const textLines = this.doc.splitTextToSize(processedText, maxWidth);
    
    textLines.forEach((textLine: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(textLine, this.margin + 10, this.yPosition);
      this.yPosition += this.lineHeight;
    });
    
    this.yPosition += 5;
  }

  private addSectionTitle(title: string): void {
    this.checkPageBreak(15);
    this.yPosition += 5;
    
    this.doc.setLineWidth(0.5);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 8;
    
    this.doc.setFontSize(16);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 10;
  }

  private addAnalysisResults(dialog: Dialog): void {
    if (!dialog.openaiEvaluation) {
      this.addText('No AI analysis results available.', 10, 'normal');
      return;
    }

    const evaluation = dialog.openaiEvaluation;

    this.addText('Overall Analysis Results', 14, 'bold');
    this.yPosition += 5;
    
    this.addText(`Overall Score: ${evaluation.overallScore}%`, 12, 'bold');
    this.addText(`Confidence: ${Math.round((evaluation.confidence || 0) * 100)}%`, 10, 'normal');
    this.yPosition += 10;

    if (evaluation.categoryScores && Object.keys(evaluation.categoryScores).length > 0) {
      this.addText('Category Scores', 12, 'bold');
      this.yPosition += 3;
      
      Object.entries(evaluation.categoryScores).forEach(([category, score]) => {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        this.addText(`• ${categoryName}: ${String(score)}%`, 10, 'normal');
      });
      this.yPosition += 10;
    }

    if (evaluation.recommendations && evaluation.recommendations.length > 0) {
      this.addText('Recommendations', 12, 'bold');
      this.yPosition += 3;
      
      evaluation.recommendations.forEach((rec, index) => {
        this.addText(`${index + 1}. ${rec}`, 10, 'normal');
        this.yPosition += 2;
      });
      this.yPosition += 10;
    }

    if (evaluation.mistakes && evaluation.mistakes.length > 0) {
      this.addText(`Detected Issues (${evaluation.mistakes.length})`, 12, 'bold');
      this.yPosition += 5;
      
      evaluation.mistakes.forEach((mistake: any, index: number) => {
        this.checkPageBreak(30);
        
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(11);
        
        switch (mistake.rule_category) {
          case 'Banned':
            this.doc.setTextColor(220, 38, 38);
            break;
          case 'Mistake':
            this.doc.setTextColor(249, 115, 22);
            break;
          case 'Not Recommended':
            this.doc.setTextColor(234, 179, 8);
            break;
          default:
            this.doc.setTextColor(34, 197, 94);
        }
        
        this.doc.text(`${index + 1}. ${(mistake.rule_category || 'GENERAL').toUpperCase()}`, this.margin, this.yPosition);
        this.yPosition += this.lineHeight + 2;
        
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        
        if (mistake.comment) {
          const commentText = this.getCommentText(mistake.comment);
          if (commentText) {
            this.addText(`Description: ${commentText}`, 10, 'normal');
          }
        }
        
        if (mistake.utterance) {
          this.addText(`Quote: "${mistake.utterance}"`, 10, 'normal', true);
        }
        
        this.yPosition += 5;
      });
    }

    if (evaluation.speakers && evaluation.speakers.length > 0) {
      this.addText('Speaker Information', 12, 'bold');
      this.yPosition += 3;
      
      evaluation.speakers.forEach((speakerInfo: any) => {
        if (speakerInfo.speaker_0) {
          this.addText(`Speaker 0: ${speakerInfo.speaker_0}${speakerInfo.role_0 ? ` (${speakerInfo.role_0})` : ''}`, 10, 'normal');
        }
        if (speakerInfo.speaker_1) {
          this.addText(`Speaker 1: ${speakerInfo.speaker_1}${speakerInfo.role_1 ? ` (${speakerInfo.role_1})` : ''}`, 10, 'normal');
        }
      });
      this.yPosition += 10;
    }
  }

  generateComprehensivePDF(dialog: Dialog): jsPDF {
    this.yPosition = 20;
    
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Dialog Transcription & Analysis Report', this.margin, this.yPosition);
    this.yPosition += 15;
    
    this.addText(`File: ${dialog.fileName}`, 12, 'bold');
    this.addText(`Supervisor: ${dialog.assignedSupervisor}`, 10, 'normal');
    this.addText(`Upload Date: ${new Date(dialog.uploadDate).toLocaleDateString()}`, 10, 'normal');
    if (dialog.qualityScore) {
      this.addText(`Quality Score: ${dialog.qualityScore}%`, 10, 'normal');
    }
    this.addText(`Status: ${dialog.status}`, 10, 'normal');
    
    if (dialog.speakerTranscription && dialog.speakerTranscription.length > 0) {
      this.addSectionTitle('Speaker Dialog');
      const mergedUtterances = this.mergeConsecutiveUtterances(dialog.speakerTranscription);
      mergedUtterances.forEach((utterance, index) => {
        this.addSpeakerUtterance(utterance, index);
      });
    }
    
    this.addSectionTitle('Analysis Results');
    this.addAnalysisResults(dialog);
    
    const pageCount = this.doc.getNumberOfPages();
    const generatedAt = new Date().toLocaleString();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.width / 2,
        this.doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
      
      this.doc.text(
        `Generated: ${generatedAt}`,
        this.margin,
        this.doc.internal.pageSize.height - 10
      );
    }
    
    return this.doc;
  }

  generateTranscriptionPDF(
    utterances: SpeakerUtterance[],
    title: string = 'Conversation Transcription',
    additionalInfo?: Record<string, any>
  ): jsPDF {
    this.yPosition = 20;
    
    this.addText(title, 16, 'bold');
    this.yPosition += 5;
    
    if (additionalInfo) {
      this.addText('Transcription Details:', 12, 'bold');
      Object.entries(additionalInfo).forEach(([key, value]) => {
        this.addText(`${key}: ${value}`, 10);
      });
      this.yPosition += 5;
    }
    
    this.checkPageBreak(10);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 10;
    
    this.addText('Conversation:', 14, 'bold');
    this.yPosition += 5;
    
    const mergedUtterances = this.mergeConsecutiveUtterances(utterances);
    mergedUtterances.forEach((utterance, index) => {
      this.addSpeakerUtterance(utterance, index);
    });
    
    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.width / 2,
        this.doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
    }
    
    return this.doc;
  }

  save(filename: string): void {
    this.doc.save(filename);
  }
}

export const generateDialogPDF = (
  dialog: Dialog,
  languagePreference?: 'original' | 'russian'
): void => {
  const generator = new PDFGenerator();
  generator.setLanguagePreference(languagePreference || 'original');
  const doc = generator.generateComprehensivePDF(dialog);
  const filename = `${dialog.fileName.replace(/\.[^/.]+$/, '')}_Report.pdf`;
  generator.save(filename);
};

export const generateTranscriptionPDF = (
  utterances: SpeakerUtterance[],
  filename: string,
  title?: string,
  additionalInfo?: Record<string, any>
): void => {
  const generator = new PDFGenerator();
  const doc = generator.generateTranscriptionPDF(utterances, title, additionalInfo);
  generator.save(filename);
};
