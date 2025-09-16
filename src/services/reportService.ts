import { databaseService } from './databaseService';
import { Dialog } from '../types';
import { PDFGenerator } from '../utils/pdfGenerator';
import { format } from 'date-fns';
import jsPDF from 'jspdf';

export interface ReportData {
  type: string;
  dateFrom: Date;
  dateTo: Date;
  totalDialogs: number;
  averageQualityScore: number;
  agentStats: AgentStats[];
  generatedAt: Date;
}

export interface AgentStats {
  agentName: string;
  dialogCount: number;
  averageQualityScore: number;
  totalMinutes: number;
  successRate: number; // % of completed dialogs
}

class ReportService {
  async generateAverageQualityByAgentReport(dateFrom: Date, dateTo: Date): Promise<Blob> {
    try {
      // Get dialogs for the date range
      const dialogs = await this.getDialogsByDateRange(dateFrom, dateTo);
      
      // Calculate agent statistics
      const agentStats = this.calculateAgentStats(dialogs);
      
      // Generate report data
      const reportData: ReportData = {
        type: 'Average Quality Score by Agent',
        dateFrom,
        dateTo,
        totalDialogs: dialogs.length,
        averageQualityScore: this.calculateOverallAverageQuality(dialogs),
        agentStats,
        generatedAt: new Date()
      };
      
      // Generate PDF
      return await this.generateReportPDF(reportData);
    } catch (error) {
      console.error('Error generating report:', error);
      throw new Error('Failed to generate report');
    }
  }

  private async getDialogsByDateRange(dateFrom: Date, dateTo: Date): Promise<Dialog[]> {
    try {
      // Get all dialogs from database
      const dbDialogs = await databaseService.getDialogs();
      
      // Filter by date range and convert to Dialog format
      const dialogs: Dialog[] = [];
      
      for (const dbDialog of dbDialogs) {
        const uploadDate = new Date(dbDialog.upload_date);
        
        if (uploadDate >= dateFrom && uploadDate <= dateTo) {
          const dialog = databaseService.convertToDialogFormat(dbDialog);
          dialogs.push(dialog);
        }
      }
      
      return dialogs;
    } catch (error) {
      console.error('Error getting dialogs by date range:', error);
      throw error;
    }
  }

  private calculateAgentStats(dialogs: Dialog[]): AgentStats[] {
    const agentMap = new Map<string, {
      dialogs: Dialog[];
      totalMinutes: number;
      completedCount: number;
    }>();

    // Group dialogs by agent
    dialogs.forEach(dialog => {
      const agentName = dialog.assignedAgent || 'Unassigned';
      
      if (!agentMap.has(agentName)) {
        agentMap.set(agentName, {
          dialogs: [],
          totalMinutes: 0,
          completedCount: 0
        });
      }
      
      const agentData = agentMap.get(agentName)!;
      agentData.dialogs.push(dialog);
      agentData.totalMinutes += dialog.tokenEstimation?.audioLengthMinutes || 0;
      
      if (dialog.status === 'completed') {
        agentData.completedCount++;
      }
    });

    // Calculate statistics for each agent
    const agentStats: AgentStats[] = [];
    
    agentMap.forEach((data, agentName) => {
      const qualityScores = data.dialogs
        .filter(d => d.qualityScore !== null && d.qualityScore !== undefined)
        .map(d => d.qualityScore!);
      
      const averageQualityScore = qualityScores.length > 0 
        ? Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length)
        : 0;
      
      const successRate = data.dialogs.length > 0 
        ? Math.round((data.completedCount / data.dialogs.length) * 100)
        : 0;

      agentStats.push({
        agentName,
        dialogCount: data.dialogs.length,
        averageQualityScore,
        totalMinutes: Math.round(data.totalMinutes * 10) / 10, // Round to 1 decimal
        successRate
      });
    });

    // Sort by average quality score descending
    return agentStats.sort((a, b) => b.averageQualityScore - a.averageQualityScore);
  }

  private calculateOverallAverageQuality(dialogs: Dialog[]): number {
    const qualityScores = dialogs
      .filter(d => d.qualityScore !== null && d.qualityScore !== undefined)
      .map(d => d.qualityScore!);
    
    if (qualityScores.length === 0) return 0;
    
    return Math.round(qualityScores.reduce((sum, score) => sum + score, 0) / qualityScores.length);
  }

  private async generateReportPDF(reportData: ReportData): Promise<Blob> {
    try {
      // Create a simple PDF using jsPDF
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const margin = 20;
      let y = 30;
      
      // Title
      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text(reportData.type, margin, y);
      y += 20;
      
      // Report details
      doc.setFontSize(12);
      doc.setFont('helvetica', 'normal');
      doc.text(`Report Period: ${format(reportData.dateFrom, 'PPP')} - ${format(reportData.dateTo, 'PPP')}`, margin, y);
      y += 10;
      doc.text(`Generated: ${format(reportData.generatedAt, 'PPPp')}`, margin, y);
      y += 20;
      
      // Summary
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Summary', margin, y);
      y += 15;
      
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Total Dialogs: ${reportData.totalDialogs}`, margin, y);
      y += 10;
      doc.text(`Overall Average Quality Score: ${reportData.averageQualityScore}/100`, margin, y);
      y += 20;
      
      // Agent Performance
      if (reportData.agentStats.length > 0) {
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text('Agent Performance', margin, y);
        y += 15;
        
        // Table headers
        doc.setFontSize(10);
        doc.setFont('helvetica', 'bold');
        doc.text('Agent', margin, y);
        doc.text('Dialogs', margin + 60, y);
        doc.text('Avg Score', margin + 100, y);
        y += 10;
        
        // Table data
        doc.setFont('helvetica', 'normal');
        reportData.agentStats.forEach(stats => {
          if (y > 250) {
            doc.addPage();
            y = 30;
          }
          doc.text(stats.agentName || 'Unassigned', margin, y);
          doc.text(stats.dialogCount.toString(), margin + 60, y);
          doc.text(`${stats.averageQualityScore}/100`, margin + 100, y);
          doc.text(stats.totalMinutes.toString(), margin + 140, y);
          doc.text(`${stats.successRate}%`, margin + 180, y);
          y += 8;
        });
      }
      
      // Convert to blob
      const pdfBlob = doc.output('blob');
      return pdfBlob;
    } catch (error) {
      console.error('Error generating PDF:', error);
      throw new Error('Failed to generate PDF report');
    }
  }

  private formatReportContent(reportData: ReportData): string {
    const { type, dateFrom, dateTo, totalDialogs, averageQualityScore, agentStats, generatedAt } = reportData;
    
    let content = `# ${type}\n\n`;
    content += `**Report Period:** ${format(dateFrom, 'PPP')} - ${format(dateTo, 'PPP')}\n`;
    content += `**Generated:** ${format(generatedAt, 'PPPp')}\n\n`;
    content += `## Summary\n\n`;
    content += `- **Total Dialogs:** ${totalDialogs}\n`;
    content += `- **Overall Average Quality Score:** ${averageQualityScore}/100\n\n`;
    
    if (agentStats.length > 0) {
      content += `## Agent Performance\n\n`;
      content += `| Agent | Dialogs | Avg Quality Score |\n`;
      content += `|-------|---------|-------------------|\n`;
      
      agentStats.forEach(stats => {
        content += `| ${stats.agentName} | ${stats.dialogCount} | ${stats.averageQualityScore}/100 |\n`;
      });
    } else {
      content += `No agent data available for the selected period.\n`;
    }
    
    return content;
  }
}

export const reportService = new ReportService();