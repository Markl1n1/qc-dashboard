// pdfGenerator.ts
import jsPDF from 'jspdf';
import { SpeakerUtterance, Dialog } from '../types';

// ===== JS PDF FONTS (side-effect импорт из src/fonts; они сами регистрируют VFS+addFont) =====
import '../fonts/NotoSans-Regular-normal';
import '../fonts/NotoSans-Italic-italic';
import '../fonts/NotoSans-Bold-bold';
import '../fonts/NotoSans-BoldItalic-bolditalic';

// ===== PDFMAKE (фолбэк, если jsPDF шрифты сломались) =====
import pdfMake from 'pdfmake/build/pdfmake';
import pdfFonts from 'pdfmake/build/vfs_fonts';
(pdfMake as any).vfs = (pdfFonts as any).pdfMake.vfs;
// Roboto в pdfmake покрывает латиницу, кириллицу и диакритику (PL/CZ/RO/TR и т.д.)

type FontWeight = 'normal' | 'bold' | 'italic' | 'bolditalic';

const SPEAKER_COLORS: Record<string, [number, number, number]> = {
  'Speaker 0': [0, 64, 128],
  'Speaker 1': [25, 102, 25],
  'default': [76, 25, 102],
};

function preprocessText(text: string): string {
  return (text ?? '')
    .normalize('NFC')
    .replace(/\u00A0/g, ' ')
    .replace(/[\r\n\u0085\u2028\u2029]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanSpeakerLabel(speaker: string): string {
  return speaker
    .replace(/^Speaker\s+Speaker\s*/, 'Speaker ')
    .replace(/^Speaker\s+/, 'Speaker ');
}

function mergeConsecutiveUtterances(utterances: SpeakerUtterance[]): SpeakerUtterance[] {
  if (!utterances || utterances.length === 0) return [];
  const merged: SpeakerUtterance[] = [];
  let current = { ...utterances[0], speaker: cleanSpeakerLabel(utterances[0].speaker) };
  for (let i = 1; i < utterances.length; i++) {
    const next = { ...utterances[i], speaker: cleanSpeakerLabel(utterances[i].speaker) };
    if (current.speaker === next.speaker) {
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

/* ------------------------------------------------------------------------------------------------
 * JS PDF GENERATOR (основной путь)
 * ------------------------------------------------------------------------------------------------ */
class PDFGeneratorJS {
  private doc: jsPDF;
  private yPosition = 20;
  private pageHeight: number;
  private margin = 20;
  private lineHeight = 7;
  private languagePreference: 'original' | 'russian' = 'original';

  constructor() {
    this.doc = new jsPDF();
    // после side-effect импортов можно просто выбрать шрифт
    this.doc.setFont('NotoSans', 'normal');
    this.pageHeight = this.doc.internal.pageSize.height;
  }

  setLanguagePreference(pref: 'original' | 'russian') {
    this.languagePreference = pref;
  }

  private getCommentText(comment: any): string {
    if (!comment) return '';
    if (typeof comment === 'object' && comment) {
      if (this.languagePreference === 'russian' && comment.russian) return comment.russian;
      return comment.original || comment.russian || '';
    }
    return String(comment) || '';
  }

  private checkPageBreak(additionalHeight = 0) {
    if (this.yPosition + additionalHeight > this.pageHeight - this.margin) {
      this.doc.addPage();
      this.doc.setFont('NotoSans', 'normal');
      this.yPosition = this.margin;
    }
  }

  private addText(text: string, fontSize: number = 10, fontWeight: FontWeight = 'normal', isQuote = false) {
    this.doc.setFontSize(fontSize);
    if (isQuote) {
      this.doc.setFont('NotoSans', 'italic');
      this.doc.setTextColor(60, 60, 60);
    } else {
      this.doc.setFont('NotoSans', fontWeight);
      this.doc.setTextColor(0, 0, 0);
    }

    const processed = preprocessText(text);
    const maxWidth = this.doc.internal.pageSize.width - this.margin * 2 - (isQuote ? 20 : 0);
    const left = this.margin + (isQuote ? 20 : 0);

    const lines = this.doc.splitTextToSize(processed, maxWidth);
    lines.forEach((line: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(line, left, this.yPosition);
      this.yPosition += this.lineHeight;
    });

    if (isQuote) this.doc.setTextColor(0, 0, 0);
  }

  private addSpeakerUtterance(utterance: SpeakerUtterance, index: number) {
    this.checkPageBreak(this.lineHeight * 3);
    this.doc.setFontSize(12);
    this.doc.setFont('NotoSans', 'bold');

    const rgb = SPEAKER_COLORS[utterance.speaker] || SPEAKER_COLORS.default;
    this.doc.setTextColor(...rgb);

    const speakerText = `[${index + 1}] ${utterance.speaker}:`;
    this.doc.text(speakerText, this.margin, this.yPosition);
    this.yPosition += this.lineHeight + 2;

    this.doc.setTextColor(0, 0, 0);
    this.doc.setFont('NotoSans', 'normal');
    this.doc.setFontSize(10);

    const processed = preprocessText(utterance.text);
    const maxWidth = this.doc.internal.pageSize.width - (this.margin * 2) - 10;
    const lines = this.doc.splitTextToSize(processed, maxWidth);

    lines.forEach((l: string) => {
      this.checkPageBreak(this.lineHeight);
      this.doc.text(l, this.margin + 10, this.yPosition);
      this.yPosition += this.lineHeight;
    });

    this.yPosition += 5;
  }

  private addSectionTitle(title: string) {
    this.checkPageBreak(15);
    this.yPosition += 5;

    this.doc.setLineWidth(0.5);
    this.doc.setDrawColor(200, 200, 200);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 8;

    this.doc.setFontSize(16);
    this.doc.setFont('NotoSans', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text(title, this.margin, this.yPosition);
    this.yPosition += 10;
  }

  private addAnalysisResults(dialog: Dialog) {
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

      evaluation.recommendations.forEach((rec, idx) => {
        this.addText(`${idx + 1}. ${rec}`, 10, 'normal');
        this.yPosition += 2;
      });
      this.yPosition += 10;
    }

    if (evaluation.mistakes && evaluation.mistakes.length > 0) {
      this.addText(`Detected Issues (${evaluation.mistakes.length})`, 12, 'bold');
      this.yPosition += 5;

      evaluation.mistakes.forEach((mistake: any, i: number) => {
        this.checkPageBreak(30);

        this.doc.setFont('NotoSans', 'bold');
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

        this.doc.text(`${i + 1}. ${(mistake.rule_category || 'GENERAL').toUpperCase()}`, this.margin, this.yPosition);
        this.yPosition += this.lineHeight + 2;

        this.doc.setTextColor(0, 0, 0);
        this.doc.setFont('NotoSans', 'normal');
        this.doc.setFontSize(10);

        if (mistake.comment) {
          const commentText = this.getCommentText(mistake.comment);
          if (commentText) this.addText(`Description: ${commentText}`, 10, 'normal');
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
        if (speakerInfo.speaker_0) this.addText(`Speaker 0: ${speakerInfo.speaker_0}${speakerInfo.role_0 ? ` (${speakerInfo.role_0})` : ''}`, 10, 'normal');
        if (speakerInfo.speaker_1) this.addText(`Speaker 1: ${speakerInfo.speaker_1}${speakerInfo.role_1 ? ` (${speakerInfo.role_1})` : ''}`, 10, 'normal');
      });
      this.yPosition += 10;
    }
  }

  generateComprehensivePDF(dialog: Dialog): jsPDF {
    this.yPosition = 20;

    this.doc.setFontSize(18);
    this.doc.setFont('NotoSans', 'bold');
    this.doc.setTextColor(0, 0, 0);
    this.doc.text('Dialog Transcription & Analysis Report', this.margin, this.yPosition);
    this.yPosition += 15;

    this.addText(`File: ${dialog.fileName}`, 12, 'bold');
    this.addText(`Supervisor: ${dialog.assignedSupervisor}`, 10, 'normal');
    this.addText(`Upload Date: ${new Date(dialog.uploadDate).toLocaleDateString()}`, 10, 'normal');
    if (dialog.qualityScore) this.addText(`Quality Score: ${dialog.qualityScore}%`, 10, 'normal');
    this.addText(`Status: ${dialog.status}`, 10, 'normal');

    if (dialog.speakerTranscription?.length) {
      this.addSectionTitle('Speaker Dialog');
      const merged = mergeConsecutiveUtterances(dialog.speakerTranscription);
      merged.forEach((u, idx) => this.addSpeakerUtterance(u, idx));
    }

    this.addSectionTitle('Analysis Results');
    this.addAnalysisResults(dialog);

    const pageCount = this.doc.getNumberOfPages();
    const generatedAt = new Date().toLocaleString();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('NotoSans', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(`Page ${i} of ${pageCount}`, this.doc.internal.pageSize.width / 2, this.doc.internal.pageSize.height - 10, { align: 'center' });
      this.doc.text(`Generated: ${generatedAt}`, this.margin, this.doc.internal.pageSize.height - 10);
    }

    return this.doc;
  }

  generateTranscriptionPDF(utterances: SpeakerUtterance[], title = 'Conversation Transcription', additionalInfo?: Record<string, any>): jsPDF {
    this.yPosition = 20;

    this.addText(title, 16, 'bold');
    this.yPosition += 5;

    if (additionalInfo) {
      this.addText('Transcription Details:', 12, 'bold');
      Object.entries(additionalInfo).forEach(([k, v]) => this.addText(`${k}: ${v}`, 10));
      this.yPosition += 5;
    }

    this.checkPageBreak(10);
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.yPosition, this.doc.internal.pageSize.width - this.margin, this.yPosition);
    this.yPosition += 10;

    this.addText('Conversation:', 14, 'bold');
    this.yPosition += 5;

    const merged = mergeConsecutiveUtterances(utterances);
    merged.forEach((u, idx) => this.addSpeakerUtterance(u, idx));

    const pageCount = this.doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('NotoSans', 'normal');
      this.doc.setTextColor(100, 100, 100);
      this.doc.text(`Page ${i} of ${pageCount}`, this.doc.internal.pageSize.width / 2, this.doc.internal.pageSize.height - 10, { align: 'center' });
    }

    return this.doc;
  }

  save(filename: string) {
    this.doc.save(filename);
  }
}

/* ------------------------------------------------------------------------------------------------
 * PDFMAKE FALLBACK (когда шрифт jsPDF не завёлся)
 * ------------------------------------------------------------------------------------------------ */
class PDFGeneratorMake {
  private languagePreference: 'original' | 'russian' = 'original';

  setLanguagePreference(pref: 'original' | 'russian') {
    this.languagePreference = pref;
  }

  private getCommentText(comment: any): string {
    if (!comment) return '';
    if (typeof comment === 'object' && comment) {
      if (this.languagePreference === 'russian' && comment.russian) return comment.russian;
      return comment.original || comment.russian || '';
    }
    return String(comment) || '';
  }

  private speakerHeader(index: number, speaker: string) {
    const color = SPEAKER_COLORS[speaker] || SPEAKER_COLORS.default;
    const hex = `#${color.map(c => c.toString(16).padStart(2, '0')).join('')}`;
    return { text: `[${index + 1}] ${speaker}:`, style: 'speakerHeader', color: hex, margin: [0, 8, 0, 3] };
  }

  private buildSpeakerDialog(utterances: SpeakerUtterance[]) {
    const merged = mergeConsecutiveUtterances(utterances);
    const body: any[] = [];
    merged.forEach((u, idx) => {
      body.push(this.speakerHeader(idx, u.speaker));
      body.push({ text: preprocessText(u.text), margin: [10, 0, 0, 8] });
    });
    return body;
  }

  private buildAnalysis(dialog: Dialog) {
    const evaln = dialog.openaiEvaluation;
    if (!evaln) return [{ text: 'No AI analysis results available.', margin: [0, 0, 0, 10] }];

    const parts: any[] = [
      { text: 'Overall Analysis Results', style: 'h2' },
      { text: `Overall Score: ${evaln.overallScore}%`, style: 'h3', margin: [0, 5, 0, 0] },
      { text: `Confidence: ${Math.round((evaln.confidence || 0) * 100)}%`, margin: [0, 2, 0, 10] }
    ];

    if (evaln.categoryScores && Object.keys(evaln.categoryScores).length > 0) {
      parts.push({ text: 'Category Scores', style: 'h3', margin: [0, 0, 0, 4] });
      Object.entries(evaln.categoryScores).forEach(([cat, score]) => {
        const name = cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
        parts.push({ text: `• ${name}: ${String(score)}%`, margin: [0, 0, 0, 2] });
      });
      parts.push({ text: '', margin: [0, 0, 0, 8] });
    }

    if (evaln.recommendations?.length) {
      parts.push({ text: 'Recommendations', style: 'h3', margin: [0, 0, 0, 4] });
      evaln.recommendations.forEach((r: string, i: number) => parts.push({ text: `${i + 1}. ${r}`, margin: [0, 0, 0, 2] }));
      parts.push({ text: '', margin: [0, 0, 0, 8] });
    }

    if (evaln.mistakes?.length) {
      parts.push({ text: `Detected Issues (${evaln.mistakes.length})`, style: 'h3', margin: [0, 0, 0, 6] });
      evaln.mistakes.forEach((m: any, i: number) => {
        let color = '#22c55e';
        if (m.rule_category === 'Banned') color = '#dc2626';
        else if (m.rule_category === 'Mistake') color = '#f97316';
        else if (m.rule_category === 'Not Recommended') color = '#eab308';

        parts.push({ text: `${i + 1}. ${(m.rule_category || 'GENERAL').toUpperCase()}`, color, bold: true, margin: [0, 4, 0, 2] });
        const comment = this.getCommentText(m.comment);
        if (comment) parts.push({ text: `Description: ${comment}` });
        if (m.utterance) parts.push({ text: `“${m.utterance}”`, italics: true, color: '#444', margin: [10, 2, 0, 6] });
      });
    }

    if (evaln.speakers?.length) {
      parts.push({ text: 'Speaker Information', style: 'h3', margin: [0, 6, 0, 4] });
      evaln.speakers.forEach((s: any) => {
        if (s.speaker_0) parts.push({ text: `Speaker 0: ${s.speaker_0}${s.role_0 ? ` (${s.role_0})` : ''}` });
        if (s.speaker_1) parts.push({ text: `Speaker 1: ${s.speaker_1}${s.role_1 ? ` (${s.role_1})` : ''}` });
      });
      parts.push({ text: '', margin: [0, 0, 0, 8] });
    }

    return parts;
  }

  generateComprehensivePDF(dialog: Dialog, filename: string) {
    const content: any[] = [
      { text: 'Dialog Transcription & Analysis Report', style: 'h1' },
      { text: `File: ${dialog.fileName}`, style: 'h3', margin: [0, 6, 0, 0] },
      { text: `Supervisor: ${dialog.assignedSupervisor}` },
      { text: `Upload Date: ${new Date(dialog.uploadDate).toLocaleDateString()}` },
    ];
    if (dialog.qualityScore) content.push({ text: `Quality Score: ${dialog.qualityScore}%` });
    content.push({ text: `Status: ${dialog.status}`, margin: [0, 0, 0, 10] });

    if (dialog.speakerTranscription?.length) {
      content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 10, 0, 8] });
      content.push({ text: 'Speaker Dialog', style: 'h2' });
      content.push(...this.buildSpeakerDialog(dialog.speakerTranscription));
    }

    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 10, 0, 8] });
    content.push({ text: 'Analysis Results', style: 'h2' });
    content.push(...this.buildAnalysis(dialog));

    const generatedAt = new Date().toLocaleString();

    const docDef: any = {
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#000' },
      styles: {
        h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        h2: { fontSize: 14, bold: true, margin: [0, 0, 0, 6] },
        h3: { fontSize: 12, bold: true },
        speakerHeader: { bold: true, fontSize: 12 },
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Generated: ${generatedAt}`, alignment: 'left', margin: [40, 0, 0, 0], color: '#666', fontSize: 8 },
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', color: '#666', fontSize: 8 },
          { text: '', margin: [0, 0, 40, 0] },
        ],
        margin: [0, 0, 0, 20],
      }),
      content,
    };

    pdfMake.createPdf(docDef).download(filename);
  }

  generateTranscriptionPDF(utterances: SpeakerUtterance[], filename: string, title?: string, additionalInfo?: Record<string, any>) {
    const content: any[] = [{ text: title || 'Conversation Transcription', style: 'h1' }];

    if (additionalInfo) {
      content.push({ text: 'Transcription Details:', style: 'h2', margin: [0, 4, 0, 4] });
      Object.entries(additionalInfo).forEach(([k, v]) => content.push({ text: `${k}: ${v}` }));
      content.push({ text: '', margin: [0, 0, 0, 6] });
    }

    content.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 515, y2: 0, lineWidth: 0.5, lineColor: '#ddd' }], margin: [0, 10, 0, 8] });
    content.push({ text: 'Conversation:', style: 'h2' });
    content.push(...this.buildSpeakerDialog(utterances));

    const docDef: any = {
      pageMargins: [40, 40, 40, 40],
      defaultStyle: { font: 'Roboto', fontSize: 10, color: '#000' },
      styles: {
        h1: { fontSize: 18, bold: true, margin: [0, 0, 0, 10] },
        h2: { fontSize: 14, bold: true, margin: [0, 0, 0, 6] },
        speakerHeader: { bold: true, fontSize: 12 },
      },
      footer: (currentPage: number, pageCount: number) => ({
        columns: [
          { text: `Page ${currentPage} of ${pageCount}`, alignment: 'center', color: '#666', fontSize: 8 },
        ],
        margin: [0, 0, 0, 20],
      }),
      content,
    };

    pdfMake.createPdf(docDef).download(filename);
  }
}

/* ------------------------------------------------------------------------------------------------
 * PUBLIC API: сначала пробуем jsPDF; если падаем по шрифтам — используем pdfmake
 * ------------------------------------------------------------------------------------------------ */

export const generateDialogPDF = (dialog: Dialog, languagePreference: 'original' | 'russian' = 'original'): void => {
  try {
    const gen = new PDFGeneratorJS();
    gen.setLanguagePreference(languagePreference);
    gen.generateComprehensivePDF(dialog);
    const filename = `${dialog.fileName.replace(/\.[^/.]+$/, '')}_Report.pdf`;
    gen.save(filename);
  } catch (err: any) {
    // Фолбэк на pdfmake (надёжный Unicode)
    const filename = `${dialog.fileName.replace(/\.[^/.]+$/, '')}_Report.pdf`;
    const gen2 = new PDFGeneratorMake();
    gen2.setLanguagePreference(languagePreference);
    gen2.generateComprehensivePDF(dialog, filename);
  }
};

export const generateTranscriptionPDF = (
  utterances: SpeakerUtterance[],
  filename: string,
  title?: string,
  additionalInfo?: Record<string, any>
): void => {
  try {
    const gen = new PDFGeneratorJS();
    gen.generateTranscriptionPDF(utterances, title, additionalInfo);
    gen.save(filename);
  } catch (err: any) {
    const gen2 = new PDFGeneratorMake();
    gen2.generateTranscriptionPDF(utterances, filename, title, additionalInfo);
  }
};
