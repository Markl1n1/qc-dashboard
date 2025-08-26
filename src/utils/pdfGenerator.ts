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

  private addText(text: string, fontSize: number = 10, fontWeight: 'normal' | 'bold' = 'normal'): void {
    this.doc.setFontSize(fontSize);
    this.doc.setFont('helvetica', fontWeight);
    
    // Handle text encoding and line wrapping
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2);
    const lines = this.doc.splitTextToSize(text, maxWidth);
    
    lines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, this.margin, this.yPosition);
      this.yPosition += this.lineHeight;
    });
  }

  private addSpeakerUtterance(utterance: SpeakerUtterance, index: number): void {
    this.checkPageBreak(this.lineHeight * 3); // Reserve space for speaker + text
    
    // Add speaker label with color coding
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    // Use different colors for different speakers (matching web styling)
    if (utterance.speaker === 'Agent') {
      this.doc.setTextColor(59, 130, 246); // Blue for Agent
    } else {
      this.doc.setTextColor(249, 115, 22); // Orange for Customer
    }
    
    const speakerText = `[${index + 1}] ${utterance.speaker}:`;
    this.doc.text(speakerText, this.margin, this.yPosition);
    this.yPosition += this.lineHeight + 2;
    
    // Reset color and add utterance text
    this.doc.setTextColor(0, 0, 0); // Black
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10);
    
    // Handle text wrapping for utterance content
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2);
    const textLines = this.doc.splitTextToSize(utterance.text, maxWidth);
    
    textLines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, this.margin + 10, this.yPosition); // Indent utterance text
      this.yPosition += this.lineHeight;
    });
    
    this.yPosition += 5; // Add space between utterances
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
    this.addText(`Confidence: ${evaluation.confidence}%`, 10, 'normal');
    this.addText(`Model Used: ${evaluation.modelUsed}`, 10, 'normal');
    this.addText(`Processing Time: ${Math.round(evaluation.processingTime / 1000)}s`, 10, 'normal');
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

    // Summary
    if (evaluation.summary) {
      this.addText('Analysis Summary', 12, 'bold');
      this.yPosition += 3;
      this.addText(evaluation.summary, 10, 'normal');
      this.yPosition += 10;
    }

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

    // Detected Issues
    if (evaluation.mistakes && evaluation.mistakes.length > 0) {
      this.addText(`Detected Issues (${evaluation.mistakes.length})`, 12, 'bold');
      this.yPosition += 5;
      
      evaluation.mistakes.forEach((mistake, index) => {
        this.checkPageBreak(30); // Reserve space for mistake details
        
        // Mistake header with severity color
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(11);
        
        // Color coding based on severity level
        switch (mistake.level) {
          case 'critical':
            this.doc.setTextColor(220, 38, 38); // Red
            break;
          case 'major':
            this.doc.setTextColor(249, 115, 22); // Orange
            break;
          default:
            this.doc.setTextColor(101, 163, 13); // Green for minor
        }
        
        this.doc.text(`${index + 1}. ${mistake.mistakeName} [${mistake.level.toUpperCase()}]`, this.margin, this.yPosition);
        this.yPosition += this.lineHeight + 2;
        
        // Reset color for description
        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(10);
        
        this.addText(`Category: ${mistake.category} | Speaker: ${mistake.speaker} | Confidence: ${mistake.confidence}%`, 9, 'normal');
        this.addText(`Description: ${mistake.description}`, 10, 'normal');
        
        if (mistake.text) {
          this.addText(`Quote: "${mistake.text}"`, 10, 'normal');
        }
        
        if (mistake.suggestion) {
          this.addText(`Suggestion: ${mistake.suggestion}`, 10, 'normal');
        }
        
        this.yPosition += 8;
      });
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
      
      dialog.speakerTranscription.forEach((utterance, index) => {
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
    
    utterances.forEach((utterance, index) => {
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
  const filename = `${dialog.fileName.replace(/\.[^/.]+$/, '')}_Report_${new Date().toISOString().split('T')[0]}.pdf`;
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
