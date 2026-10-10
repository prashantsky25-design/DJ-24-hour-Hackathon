import React, { useState } from 'react';
import { ResearchReport } from '../../types/research';
import { generateResearchReportPDF } from '../../services/pdfGenerator';
import {
  Download,
  Copy,
  Check,
  FileText,
  ExternalLink,
  BookOpen,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ResearchReportViewerProps {
  report: ResearchReport;
}

export const ResearchReportViewer: React.FC<ResearchReportViewerProps> = ({ report }) => {
  const [downloading, setDownloading] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleDownloadPDF = () => {
    setDownloading(true);
    try {
      generateResearchReportPDF(report);
    } catch (e) {
      console.error('PDF export failed:', e);
    } finally {
      setTimeout(() => setDownloading(false), 800);
    }
  };

  const handleCopyMarkdown = () => {
    const md = `# ${report.title}
*Generated on ${new Date(report.generatedAt).toLocaleString()} by PS3 Autonomous Research Environment*

## Research Query
> ${report.query}

## 1. Executive Summary
${report.executiveSummary}

## 2. Methodology & Multi-Agent Protocol
${report.methodology}

## 3. Empirical Findings & Observations
${report.findings.map((f, i) => `${i + 1}. ${f}`).join('\n')}

${report.comparisons.length > 0 ? `## 4. Quantitative Comparisons
| Baseline | Proposed | Observed Delta |
| --- | --- | --- |
${report.comparisons.map((c) => `| ${c.baseline} | ${c.proposed} | ${c.delta} |`).join('\n')}

` : ''}
## 5. Limitations
${report.limitations}

## 6. References & Formal Citations
${report.citations.map((c) => `[${c.id}] ${c.authors} (${c.year}). "${c.title}". In *${c.venue}*. ${c.doi ? `DOI: ${c.doi}` : ''}`).join('\n')}
`;
    navigator.clipboard.writeText(md);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="max-w-4xl mx-auto rounded-2xl border p-6 sm:p-10 shadow-xl transition-colors font-sans"
      style={{
        backgroundColor: 'var(--surface)',
        borderColor: 'var(--border)',
        color: 'var(--text-primary)',
      }}
    >
      {/* Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center font-bold text-white shadow-xs"
            style={{ backgroundColor: '#10B981' }}
          >
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[11px] font-mono uppercase font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Autonomous Technical Research Report
            </span>
            <span className="text-[10px] font-mono ml-2 px-1.5 py-0.5 rounded border text-emerald-600 dark:text-emerald-400" style={{ borderColor: 'var(--border)' }}>
              Verified & Grounded
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Copy Markdown button */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium hover:opacity-100 opacity-80 transition-all"
            style={{
              backgroundColor: 'var(--surface-secondary)',
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
            }}
            title="Copy formatted markdown report"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-emerald-500">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy Markdown</span>
              </>
            )}
          </button>

          {/* Download genuine PDF button */}
          <button
            type="button"
            onClick={handleDownloadPDF}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-xl text-xs font-semibold text-white shadow-md transition-all hover:scale-102 active:scale-98 disabled:opacity-50"
            style={{ backgroundColor: '#10B981' }}
            title="Download genuine formatted research PDF"
          >
            <Download className={`w-3.5 h-3.5 ${downloading ? 'animate-bounce' : ''}`} />
            <span>{downloading ? 'Generating PDF...' : 'Download PDF'}</span>
          </button>
        </div>
      </div>

      {/* Document Title Header */}
      <div className="pt-6 pb-4">
        <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight leading-snug" style={{ color: 'var(--text-primary)' }}>
          {report.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 mt-3 text-xs font-mono" style={{ color: 'var(--text-secondary)' }}>
          <span className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {new Date(report.generatedAt).toLocaleDateString(undefined, { dateStyle: 'long' })}
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-400" />
            PS3 Dynamic Multi-Agent Cluster
          </span>
          <span>•</span>
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
            {report.citations.length} Verified References
          </span>
        </div>
      </div>

      {/* Inquired Query Callout Box */}
      <div
        className="my-4 p-4 rounded-xl border text-xs leading-relaxed"
        style={{
          backgroundColor: 'var(--surface-secondary)',
          borderColor: 'var(--border)',
        }}
      >
        <span className="font-mono text-[10px] uppercase font-bold tracking-wider text-indigo-500 block mb-1">
          Initiating Research Query:
        </span>
        <p className="italic font-medium" style={{ color: 'var(--text-primary)' }}>
          "{report.query}"
        </p>
      </div>

      {/* Section 1: Executive Summary */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500">
          1. Executive Summary & Abstract
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {report.executiveSummary}
        </p>
      </div>

      {/* Section 2: Methodology */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500">
          2. Multi-Agent Protocol & Methodology
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {report.methodology}
        </p>
      </div>

      {/* Section 3: Empirical Findings */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500">
          3. Empirical Findings & Observations
        </h2>
        <ul className="space-y-2 text-sm">
          {report.findings.map((finding, idx) => (
            <li
              key={idx}
              className="flex items-start gap-2.5 p-2.5 rounded-lg border leading-relaxed"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                borderColor: 'var(--border)',
                color: 'var(--text-primary)',
              }}
            >
              <span className="font-mono font-bold text-indigo-500 shrink-0 text-xs mt-0.5">
                [{idx + 1}]
              </span>
              <span>{finding}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Section 4: Quantitative Comparisons Table */}
      {report.comparisons && report.comparisons.length > 0 && (
        <div className="mt-6 space-y-2">
          <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500">
            4. Comparative Performance Metrics
          </h2>
          <div
            className="overflow-x-auto rounded-xl border"
            style={{
              borderColor: 'var(--border)',
            }}
          >
            <table className="w-full text-xs text-left">
              <thead
                className="font-mono text-[11px] uppercase tracking-wider border-b"
                style={{
                  backgroundColor: 'var(--surface-secondary)',
                  borderColor: 'var(--border)',
                  color: 'var(--text-secondary)',
                }}
              >
                <tr>
                  <th className="py-2.5 px-4">Metric / Parameter</th>
                  <th className="py-2.5 px-4">Baseline Target</th>
                  <th className="py-2.5 px-4">Proposed Result</th>
                  <th className="py-2.5 px-4">Observed Delta</th>
                </tr>
              </thead>
              <tbody className="divide-y font-mono" style={{ borderColor: 'var(--border)' }}>
                {report.comparisons.map((comp, idx) => (
                  <tr key={idx} className="hover:opacity-90">
                    <td className="py-2.5 px-4 font-sans font-medium" style={{ color: 'var(--text-primary)' }}>
                      {comp.baseline.split(':')[0]}
                    </td>
                    <td className="py-2.5 px-4" style={{ color: 'var(--text-secondary)' }}>
                      {comp.baseline.split(':')[1]?.trim() || comp.baseline}
                    </td>
                    <td className="py-2.5 px-4 font-semibold" style={{ color: 'var(--text-primary)' }}>
                      {comp.proposed.split(':')[1]?.trim() || comp.proposed}
                    </td>
                    <td className="py-2.5 px-4 font-bold text-emerald-500">
                      {comp.delta}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Section 5: Limitations */}
      <div className="mt-6 space-y-2">
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500">
          5. Limitations & Future Scope
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-primary)' }}>
          {report.limitations}
        </p>
      </div>

      {/* Section 6: Formal Citations & References */}
      <div className="mt-8 pt-6 border-t space-y-3" style={{ borderColor: 'var(--border)' }}>
        <h2 className="text-sm font-bold uppercase tracking-wider font-mono text-indigo-500 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          <span>6. Formal References & Academic Citations</span>
        </h2>

        <div className="space-y-3">
          {report.citations.map((citation) => (
            <div
              key={citation.id}
              className="p-3 rounded-xl border text-xs leading-relaxed space-y-1 transition-colors"
              style={{
                backgroundColor: 'var(--surface-secondary)',
                borderColor: 'var(--border)',
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono font-bold text-indigo-500 shrink-0">
                  [{citation.id}]
                </span>
                <span className="flex-1 font-semibold" style={{ color: 'var(--text-primary)' }}>
                  "{citation.title}"
                </span>
                {citation.url && (
                  <a
                    href={citation.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-[11px] text-indigo-500 hover:underline shrink-0"
                  >
                    <span>Link</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
              <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                {citation.authors} ({citation.year}). In <em>{citation.venue}</em>.
                {citation.doi && <span className="ml-1 font-mono text-[10px]">DOI: {citation.doi}</span>}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
