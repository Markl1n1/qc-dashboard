
import jsPDF from 'jspdf';
import { SpeakerUtterance } from '../types';

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
    
    // Add speaker label
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    
    // Use different colors for different speakers
    if (utterance.speaker === 'Agent') {
      this.doc.setTextColor(0, 100, 0); // Green for Agent
    } else {
      this.doc.setTextColor(0, 0, 150); // Blue for Customer
    }
    
    const speakerText = `[${index + 1}] ${utterance.speaker}:`;
    this.doc.text(speakerText, this.margin, this.yPosition);
    this.yPosition += this.lineHeight;
    
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
    
    this.yPosition += 3; // Add space between utterances
  }

  generateTranscriptionPDF(
    utterances: SpeakerUtterance[],
    title: string = 'Conversation Transcription',
    additionalInfo?: Record<string, any>
  ): jsPDF {
    // Reset position
    this.yPosition = 20;
    
    // Add title
    this.addText(title, 16, 'bold');
    this.yPosition += 5;
    
    // Add metadata if provided
    if (additionalInfo) {
      this.addText('Transcription Details:', 12, 'bold');
      Object.entries(additionalInfo).forEach(([key, value]) => {
        this.addText(`${key}: ${value}`, 10);
      });
      this.yPosition += 5;
    }
    
    // Add separator line
    this.checkPageBreak(10);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 10;
    
    // Add conversation title
    this.addText('Conversation:', 14, 'bold');
    this.yPosition += 5;
    
    // Add each utterance
    utterances.forEach((utterance, index) => {
      this.addSpeakerUtterance(utterance, index);
    });
    
    // Add footer with page numbers
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
