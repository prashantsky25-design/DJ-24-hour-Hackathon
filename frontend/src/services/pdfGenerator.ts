import { jsPDF } from 'jspdf';
import { ResearchReport } from '../types/research';

interface NormalizedComparison {
  metric: string;
  baseline: string;
  proposed: string;
  delta: string;
}

function parseComparison(comp: any): NormalizedComparison {
  if (typeof comp === 'string') {
    const parts = comp.split('|').map((s) => s.trim());
    if (parts.length >= 3) {
      return {
        metric: parts[0].includes(':') ? parts[0].split(':')[0].trim() : 'Metric',
        baseline: parts[0].includes(':') ? parts[0].split(':')[1].trim() : parts[0],
        proposed: parts[1].includes(':') ? parts[1].split(':')[1].trim() : parts[1],
        delta: parts[2].includes(':') ? parts[2].split(':')[1].trim() : parts[2],
      };
    }
    return {
      metric: 'Observation',
      baseline: comp,
      proposed: '—',
      delta: '—',
    };
  }
  if (comp && typeof comp === 'object') {
    const rawBaseline = String(comp.baseline || comp.target || 'N/A');
    const metric = rawBaseline.includes(':') ? rawBaseline.split(':')[0].trim() : (comp.metric || 'Metric');
    const baselineVal = rawBaseline.includes(':') ? rawBaseline.split(':')[1].trim() : rawBaseline;
    const rawProposed = String(comp.proposed || comp.result || 'N/A');
    const proposedVal = rawProposed.includes(':') ? rawProposed.split(':')[1].trim() : rawProposed;
    const deltaVal = String(comp.delta || comp.difference || '—');
    return {
      metric,
      baseline: baselineVal,
      proposed: proposedVal,
      delta: deltaVal,
    };
  }
  return { metric: 'Metric', baseline: 'N/A', proposed: 'N/A', delta: '—' };
}

export function generateResearchReportPDF(report: ResearchReport): void {
  if (!report) return;

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin) {
      doc.addPage();
      y = margin;
      renderPageHeader();
    }
  };

  const renderPageHeader = () => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(115, 115, 115);
    doc.text('PS3 — AN EVOLVING AI RESEARCH ENVIRONMENT | TECHNICAL REPORT', margin, y);
    const dateStr = report.generatedAt ? new Date(report.generatedAt).toLocaleDateString() : new Date().toLocaleDateString();
    doc.text(dateStr, pageWidth - margin, y, { align: 'right' });
    y += 4;
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.3);
    doc.line(margin, y, pageWidth - margin, y);
    y += 8;
  };

  // Initial Page Header
  renderPageHeader();

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(24, 24, 27);
  const titleText = report.title || 'Technical Research Synthesis';
  const titleLines = doc.splitTextToSize(titleText, contentWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 7 + 2;

  // Metadata Box
  doc.setFillColor(248, 249, 250);
  doc.setDrawColor(229, 231, 235);
  doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'FD');

  doc.setFontSize(8.5);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(79, 70, 229);
  doc.text('RESEARCH QUERY:', margin + 4, y + 6);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(55, 65, 81);
  const queryText = report.query || 'Research query';
  const queryLines = doc.splitTextToSize(queryText, contentWidth - 40);
  doc.text(queryLines[0] || '', margin + 35, y + 6);

  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(
    `Synthesized by Dynamic Agent Cluster (Literature Scout, Hypothesis Engine, Experiment Critic, Drafter) • ID: ${report.id || 'ares-rep'}`,
    margin + 4,
    y + 14
  );
  y += 26;

  const renderSectionHeader = (title: string) => {
    checkPageBreak(12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(24, 24, 27);
    doc.text(title.toUpperCase(), margin, y);
    y += 2;
    doc.setDrawColor(229, 231, 235);
    doc.setLineWidth(0.2);
    doc.line(margin, y, pageWidth - margin, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(55, 65, 81);
  };

  // Section 1: Executive Summary
  renderSectionHeader('1. Executive Summary');
  const execLines = doc.splitTextToSize(report.executiveSummary || 'No summary available.', contentWidth);
  checkPageBreak(execLines.length * 4.8);
  doc.text(execLines, margin, y);
  y += execLines.length * 4.8 + 6;

  // Section 2: Methodology & Agent Handoffs
  renderSectionHeader('2. Methodology & Multi-Agent Protocol');
  const methodLines = doc.splitTextToSize(report.methodology || 'Multi-agent workflow protocol.', contentWidth);
  checkPageBreak(methodLines.length * 4.8);
  doc.text(methodLines, margin, y);
  y += methodLines.length * 4.8 + 6;

  // Section 3: Empirical Findings
  renderSectionHeader('3. Empirical Findings & Observations');
  const findings = Array.isArray(report.findings)
    ? report.findings
    : typeof report.findings === 'string'
    ? [report.findings]
    : [];

  findings.forEach((finding, idx) => {
    const bulletText = `${idx + 1}. ${finding}`;
    const findingLines = doc.splitTextToSize(bulletText, contentWidth - 4);
    checkPageBreak(findingLines.length * 4.8 + 2);
    doc.text(findingLines, margin + 2, y);
    y += findingLines.length * 4.8 + 3;
  });
  y += 4;

  // Visual Representation
  if (report.visualData && Array.isArray(report.visualData.data) && report.visualData.data.length > 0) {
    renderSectionHeader(`Visual Representation: ${report.visualData.title || 'Data Distribution'}`);
    const data = report.visualData.data;
    const maxVal = Math.max(...data.map((d) => Number(d.value) || 0), 1);

    checkPageBreak(data.length * 8 + 15);

    let chartY = y + 5;
    const chartX = margin + 5;
    const maxBarWidth = contentWidth - 60;

    doc.setFontSize(8);
    data.forEach((item) => {
      doc.setTextColor(30, 41, 59);
      doc.setFont('helvetica', 'normal');
      const label = String(item.name || '').length > 20 ? String(item.name).slice(0, 17) + '...' : String(item.name || '');
      doc.text(label, chartX, chartY + 4);

      const val = Number(item.value) || 0;
      const barWidth = maxVal > 0 ? (val / maxVal) * maxBarWidth : 0;
      doc.setFillColor(79, 70, 229);
      doc.rect(chartX + 35, chartY, Math.max(1, barWidth), 5, 'F');

      doc.setTextColor(100, 116, 139);
      doc.text(val.toString(), chartX + 37 + barWidth, chartY + 4);

      chartY += 8;
    });
    y = chartY + 10;
  }

  // Section 4: Quantitative Comparisons
  const rawComparisons = Array.isArray(report.comparisons) ? report.comparisons : [];
  const comparisons = rawComparisons.map(parseComparison);

  if (comparisons.length > 0) {
    renderSectionHeader('4. Comparative Performance Metrics');
    checkPageBreak(25);

    // Table Header
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, y, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('Metric / Parameter', margin + 3, y + 5);
    doc.text('Baseline Target', margin + 65, y + 5);
    doc.text('Proposed Result', margin + 110, y + 5);
    doc.text('Observed Delta', margin + 145, y + 5);
    y += 7;

    doc.setFont('helvetica', 'normal');
    comparisons.forEach((comp, idx) => {
      checkPageBreak(7);
      if (idx % 2 === 1) {
        doc.setFillColor(248, 250, 252);
        doc.rect(margin, y, contentWidth, 6.5, 'F');
      }
      doc.text(comp.metric, margin + 3, y + 4.5);
      doc.text(comp.baseline, margin + 65, y + 4.5);
      doc.text(comp.proposed, margin + 110, y + 4.5);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(16, 185, 129);
      doc.text(comp.delta, margin + 145, y + 4.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(51, 65, 85);
      y += 6.5;
    });
    y += 6;
  }

  // Section 5: Limitations & Future Scope
  renderSectionHeader('5. Limitations & Future Scope');
  const limLines = doc.splitTextToSize(report.limitations || 'None documented.', contentWidth);
  checkPageBreak(limLines.length * 4.8);
  doc.text(limLines, margin, y);
  y += limLines.length * 4.8 + 6;

  // Section 6: Citations & References
  const citations = Array.isArray(report.citations) ? report.citations : [];
  if (citations.length > 0) {
    renderSectionHeader('6. References & Formal Citations');
    doc.setFontSize(8.5);
    citations.forEach((citation) => {
      const citationHeader = `[${citation.id}] ${citation.authors} (${citation.year}). "${citation.title}".`;
      const venueText = `    In ${citation.venue}.${citation.doi ? ` DOI: ${citation.doi}` : ''}`;
      const headerLines = doc.splitTextToSize(citationHeader, contentWidth);
      const venueLines = doc.splitTextToSize(venueText, contentWidth);

      checkPageBreak((headerLines.length + venueLines.length) * 4.2 + 3);

      doc.setFont('helvetica', 'bold');
      doc.setTextColor(30, 41, 59);
      doc.text(headerLines, margin, y);
      y += headerLines.length * 4.2;

      doc.setFont('helvetica', 'italic');
      doc.setTextColor(100, 116, 139);
      doc.text(venueLines, margin, y);
      y += venueLines.length * 4.2 + 2;
    });
  }

  // Footer: Add page numbering on all pages
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(156, 163, 175);
    doc.text(
      `PS3 Autonomous AI Research Workspace • Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 8,
      { align: 'center' }
    );
  }

  // Sanitize filename and trigger browser download
  const sanitizedTitle = (report.title || 'PS3_Research').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  doc.save(`${sanitizedTitle || 'PS3_Research'}_Report.pdf`);
}
