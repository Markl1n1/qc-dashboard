import jsPDF from 'jspdf';
import { SpeakerUtterance, Dialog } from '../types';

export class PDFGenerator {
  private doc: jsPDF;
  private yPosition: number = 20;
  private pageHeight: number;
  private margin: number = 20;
  private lineHeight: number = 7;

  constructor() {
    this.doc = new jsPDF();
    this.pageHeight = this.doc.internal.pageSize.height;
  }

  private checkPageBreak(additionalHeight: number = 0): void {
    if (this.yPosition + additionalHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.yPosition = this.margin;
    }
  }

  private preprocessText(text: string): string {
    // Log original text for debugging encoding issues
    console.log('📝 PDF Text Processing:', {
      originalLength: text.length,
      firstChars: text.substring(0, 50),
      encoding: text.split('').map(char => ({ char, code: char.charCodeAt(0) })).slice(0, 10),
      hasPolishChars: /[ąćęłńóśźżĄĆĘŁŃÓŚŹŻ]/.test(text)
    });

    // Enhanced Unicode normalization for Polish characters - preserve diacritics
    const processed = text
      .normalize('NFC') // Use standard form without decomposing
      .replace(/\u00A0/g, ' ') // Replace non-breaking spaces
      .replace(/\s+/g, ' ') // Normalize multiple spaces
      .replace(/[ąĄ]/g, 'a') // Replace Polish chars that jsPDF can't handle
      .replace(/[ćĆ]/g, 'c')
      .replace(/[ęĘ]/g, 'e')
      .replace(/[łŁ]/g, 'l')
      .replace(/[ńŃ]/g, 'n')
      .replace(/[óÓ]/g, 'o')
      .replace(/[śŚ]/g, 's')
      .replace(/[źŹ]/g, 'z')
      .replace(/[żŻ]/g, 'z')
      .trim();

    // Log processed text for comparison
    console.log('✅ PDF Text Processed:', {
      processedLength: processed.length,
      firstProcessedChars: processed.substring(0, 50),
      changed: text !== processed
    });

    return processed;
  }

  private addText(text: string, fontSize: number = 10, fontWeight: 'normal' | 'bold' = 'normal', isQuote: boolean = false): void {
    this.doc.setFontSize(fontSize);
    
    // Enhanced font handling for Polish characters
    if (isQuote) {
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(60, 60, 60); // Slightly grayed for quotes
    } else {
      this.doc.setFont('helvetica', fontWeight);
      this.doc.setTextColor(0, 0, 0);
    }
    
    // Enhanced text preprocessing for Polish characters
    const processedText = this.preprocessText(text);
    
    // Handle text encoding and line wrapping
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2) - (isQuote ? 20 : 0);
    const leftMargin = this.margin + (isQuote ? 20 : 0);
    
    const lines = this.doc.splitTextToSize(processedText, maxWidth);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, leftMargin, this.yPosition);
      this.yPosition += this.lineHeight;
    });
    
    // Reset text color after quotes
    if (isQuote) {
      this.doc.setTextColor(0, 0, 0);
    }
  }

  private cleanSpeakerLabel(speaker: string): string {
    // Clean "Speaker Speaker 0" -> "Speaker 0"
    return speaker
      .replace(/^Speaker\s+Speaker\s*/, 'Speaker ') // Remove duplicate "Speaker"
      .replace(/^Speaker\s+/, 'Speaker '); // Ensure consistent "Speaker " prefix
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
        // Merge with current utterance - format each utterance on a new line
        current.text = `${current.text}\n${next.text}`;
        current.end = next.end; // Update end time to the latest
        current.confidence = Math.min(current.confidence, next.confidence); // Use lower confidence
      } else {
        // Different speaker, add current to merged and start new one
        merged.push(current);
        current = { ...next };
      }
    }
    
    // Add the last utterance
    merged.push(current);
    return merged;
  }

  private addSpeakerUtterance(utterance: SpeakerUtterance, index: number): void {
    this.checkPageBreak(this.lineHeight * 3); // Reserve space for speaker + text
    
    // Add speaker label with color coding
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    if (utterance.speaker === 'Speaker 0') {
      this.doc.setTextColor(0, 64, 128); // Blue for Speaker 0
    } else if (utterance.speaker === 'Speaker 1') {
      this.doc.setTextColor(25, 102, 25); // Green for Speaker 1
    } else {
      this.doc.setTextColor(76, 25, 102); // Purple (#4C1966) for Speaker 2, 3, etc.
    }
    
    const speakerText = `[${index + 1}] ${utterance.speaker}:`;
    this.doc.text(speakerText, this.margin, this.yPosition);
    this.yPosition += this.lineHeight + 2;
    
    // Reset color and add utterance text
    this.doc.setTextColor(0, 0, 0); 
    this.doc.setFont('helvetica', 'normal'); // Use helvetica instead of Roboto
    this.doc.setFontSize(10);

    // Handle line breaks for merged utterances and ensure proper wrapping
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2) - 10; // account for indent
    const lines = utterance.text.split('\n');
    
    lines.forEach((line, lineIndex) => {
      if (line.trim()) { // Only process non-empty lines
        const processedText = this.preprocessText(line); // Use preprocessing for Polish characters
        const textLines = this.doc.splitTextToSize(processedText, maxWidth);
        
        textLines.forEach((textLine: string) => {
          this.checkPageBreak(this.lineHeight);
          this.doc.text(textLine, this.margin + 10, this.yPosition);
          this.yPosition += this.lineHeight;
        });
        
        // Small spacing between merged lines within same utterance
        if (lineIndex < lines.length - 1) {
          this.yPosition += 2;
        }
      }
    });
    
    this.yPosition += 5; // spacing between utterances
  }


  private addSectionTitle(title: string): void {
    this.checkPageBreak(15);
    this.yPosition += 5;
    
    // Add separator line
    this.doc.setLineWidth(0.5);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 8;
    
    // Add section title
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

    // Overall Score Section
    this.addText('Overall Analysis Results', 14, 'bold');
    this.yPosition += 5;
    
    this.addText(`Overall Score: ${evaluation.overallScore}%`, 12, 'bold');
    this.addText(`Confidence: ${Math.round((evaluation.confidence || 0) * 100)}%`, 10, 'normal');
    
    // Only show model and processing time if they have valid values
    if (evaluation.modelUsed && evaluation.modelUsed !== 'undefined') {
      this.addText(`Model Used: ${evaluation.modelUsed}`, 10, 'normal');
    }
    if (evaluation.processingTime && !isNaN(evaluation.processingTime) && evaluation.processingTime > 0) {
      this.addText(`Processing Time: ${Math.round(evaluation.processingTime / 1000)}s`, 10, 'normal');
    }
    this.yPosition += 10;

    // Category Scores
    if (evaluation.categoryScores && Object.keys(evaluation.categoryScores).length > 0) {
      this.addText('Category Scores', 12, 'bold');
      this.yPosition += 3;
      
      Object.entries(evaluation.categoryScores).forEach(([category, score]) => {
        const categoryName = category.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        this.addText(`• ${categoryName}: ${String(score)}%`, 10, 'normal');
      });
      this.yPosition += 10;
    }

    // Remove summary section completely

    // Recommendations
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
        this.checkPageBreak(30); // Reserve space for mistake details
        
        // Mistake header with category-based color
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(11);
        
        // Color coding based on rule category
        switch (mistake.rule_category) {
          case 'Banned':
            this.doc.setTextColor(220, 38, 38); // Red
            break;
          case 'Mistake':
            this.doc.setTextColor(249, 115, 22); // Orange
            break;
          case 'Not Recommended':
            this.doc.setTextColor(234, 179, 8); // Yellow
            break;
          default:
            this.doc.setTextColor(34, 197, 94); // Green for Correct/Acceptable
        }
        
        this.doc.text(`${index + 1}. ${(mistake.rule_category || 'GENERAL').toUpperCase()}`, this.margin, this.yPosition);
        this.yPosition += this.lineHeight + 2;
        
        // Reset color for description
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        
        // Add comment/description
        if (mistake.comment) {
          this.addText(`Description: ${mistake.comment.russian}`, 10, 'normal');
        }
        
        // Add utterance quote with enhanced styling
        if (mistake.utterance) {
          this.addText(`Quote: "${mistake.utterance}"`, 10, 'normal', true);
        }
        
        this.yPosition += 5;
      });
    }

    // Speaker Information - Added section
    if (evaluation.speakers && evaluation.speakers.length > 0) {
      this.addText('Speaker Information', 12, 'bold');
      this.yPosition += 3;
      
      evaluation.speakers.forEach((speakerInfo: any, index: number) => {
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
    // Reset position
    this.yPosition = 20;
    
    // Header with dialog metadata
    this.doc.setFontSize(18);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Dialog Transcription & Analysis Report', this.margin, this.yPosition);
    this.yPosition += 15;
    
    // Dialog metadata
    this.addText(`File: ${dialog.fileName}`, 12, 'bold');
    this.addText(`Supervisor: ${dialog.assignedSupervisor}`, 10, 'normal');
    this.addText(`Upload Date: ${new Date(dialog.uploadDate).toLocaleDateString()}`, 10, 'normal');
    if (dialog.qualityScore) {
      this.addText(`Quality Score: ${dialog.qualityScore}%`, 10, 'normal');
    }
    this.addText(`Status: ${dialog.status}`, 10, 'normal');
    
    // Speaker Dialog Section
    if (dialog.speakerTranscription && dialog.speakerTranscription.length > 0) {
      this.addSectionTitle('Speaker Dialog');
      
      // Merge consecutive utterances and clean speaker labels before adding to PDF
      const mergedUtterances = this.mergeConsecutiveUtterances(dialog.speakerTranscription);
      
      mergedUtterances.forEach((utterance, index) => {
        this.addSpeakerUtterance(utterance, index);
      });
    }
    
    // Analysis Results Section
    this.addSectionTitle('Analysis Results');
    this.addAnalysisResults(dialog);
    
    // Add footer with page numbers and generation timestamp
    const pageCount = this.doc.getNumberOfPages();
    const generatedAt = new Date().toLocaleString();
    
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(100, 100, 100);
      
      // Page number
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.doc.internal.pageSize.width / 2,
        this.doc.internal.pageSize.height - 10,
        { align: 'center' }
      );
      
      // Generation timestamp
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
    // Reset position
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
    
    // Merge consecutive utterances and clean speaker labels before adding to PDF
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

export const generateDialogPDF = (dialog: Dialog): void => {
  const generator = new PDFGenerator();
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
