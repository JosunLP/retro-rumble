/**
 * useExport Composable
 *
 * Provides methods for exporting retro session results in multiple formats:
 * - JSON (structured data)
 * - CSV (spreadsheet-compatible)
 * - Markdown (human-readable)
 * - PNG/SVG image (visual snapshot via html2canvas-style rendering)
 * - PDF (printable document)
 */

import type { IRetroCard, IRetroSession, RetroColumnType } from '~/types';

/**
 * Export format type
 */
export type ExportFormat = 'json' | 'csv' | 'markdown' | 'png' | 'pdf';

/**
 * Column label helper
 */
function columnLabel(column: RetroColumnType, locale: string): string {
  const labels: Record<string, Record<RetroColumnType, string>> = {
    en: {
      'went-well': 'What went well',
      'to-improve': 'What to improve',
      'action-items': 'Action Items',
    },
    de: {
      'went-well': 'Was lief gut',
      'to-improve': 'Was verbessern',
      'action-items': 'Maßnahmen',
    },
  };
  return labels[locale]?.[column] ?? labels['en']![column];
}

/**
 * Composable for exporting retro results
 */
export function useExport() {
  const { locale } = useI18n();

  /**
   * Trigger browser download
   */
  function downloadFile(
    content: string | Blob,
    filename: string,
    mimeType: string
  ): void {
    const blob =
      content instanceof Blob
        ? content
        : new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Generates a safe filename from session name
   */
  function safeFilename(session: IRetroSession): string {
    const base = session.name
      .replace(/[^a-zA-Z0-9äöüÄÖÜß\s-]/g, '')
      .replace(/\s+/g, '_')
      .slice(0, 50);
    const date = new Date(session.createdAt).toISOString().split('T')[0];
    return `retro_${base}_${date}`;
  }

  // ============================================
  // JSON Export
  // ============================================

  function exportJSON(session: IRetroSession): void {
    const data = buildExportData(session);
    const json = JSON.stringify(data, null, 2);
    downloadFile(json, `${safeFilename(session)}.json`, 'application/json');
  }

  function buildExportData(session: IRetroSession) {
    const loc = locale.value;
    const columns: Record<RetroColumnType, string> = {
      'went-well': columnLabel('went-well', loc),
      'to-improve': columnLabel('to-improve', loc),
      'action-items': columnLabel('action-items', loc),
    };

    const cardsByColumn = (col: RetroColumnType) =>
      session.cards
        .filter((c) => c.column === col)
        .sort((a, b) => b.votes - a.votes)
        .map((c) => ({
          content: c.content,
          votes: c.votes,
          group: c.groupId
            ? (session.groups.find((g) => g.id === c.groupId)?.title ?? null)
            : null,
        }));

    return {
      session: {
        name: session.name,
        date: new Date(session.createdAt).toISOString(),
        participants: session.participants.map((p) => p.name),
        participantCount: session.participants.length,
      },
      columns: Object.entries(columns).map(([key, label]) => ({
        id: key,
        label,
        cards: cardsByColumn(key as RetroColumnType),
        groups: session.groups
          .filter((g) => g.column === key)
          .map((g) => ({
            title: g.title,
            cardCount: g.cardIds.length,
          })),
      })),
      actionItems: session.actionItems.map((a) => ({
        text: a.text,
        assignee: a.assignee,
        dueDate: a.dueDate,
        done: a.done,
      })),
      statistics: buildStatistics(session),
    };
  }

  function buildStatistics(session: IRetroSession) {
    const totalCards = session.cards.length;
    const totalVotes = session.cards.reduce((sum, c) => sum + c.votes, 0);
    const totalGroups = session.groups.length;
    const totalActions = session.actionItems.length;
    const completedActions = session.actionItems.filter((a) => a.done).length;

    const columnStats = (
      ['went-well', 'to-improve', 'action-items'] as const
    ).map((col) => {
      const cards = session.cards.filter((c) => c.column === col);
      return {
        column: col,
        cardCount: cards.length,
        totalVotes: cards.reduce((sum, c) => sum + c.votes, 0),
        topCard: cards.sort((a, b) => b.votes - a.votes)[0]?.content ?? null,
      };
    });

    return {
      totalCards,
      totalVotes,
      totalGroups,
      totalActions,
      completedActions,
      columnStats,
    };
  }

  // ============================================
  // CSV Export
  // ============================================

  function exportCSV(session: IRetroSession): void {
    const loc = locale.value;
    const rows: string[][] = [];

    // Header
    rows.push([
      loc === 'de' ? 'Spalte' : 'Column',
      loc === 'de' ? 'Inhalt' : 'Content',
      loc === 'de' ? 'Stimmen' : 'Votes',
      loc === 'de' ? 'Gruppe' : 'Group',
    ]);

    // Cards sorted by column then votes
    for (const col of ['went-well', 'to-improve', 'action-items'] as const) {
      const cards = session.cards
        .filter((c) => c.column === col)
        .sort((a, b) => b.votes - a.votes);
      for (const card of cards) {
        const group = card.groupId
          ? (session.groups.find((g) => g.id === card.groupId)?.title ?? '')
          : '';
        rows.push([
          columnLabel(col, loc),
          card.content,
          String(card.votes),
          group,
        ]);
      }
    }

    // Empty row then action items
    rows.push([]);
    rows.push([
      loc === 'de' ? 'Maßnahme' : 'Action Item',
      loc === 'de' ? 'Zuständig' : 'Assignee',
      loc === 'de' ? 'Fällig' : 'Due Date',
      loc === 'de' ? 'Erledigt' : 'Done',
    ]);
    for (const action of session.actionItems) {
      rows.push([
        action.text,
        action.assignee ?? '',
        action.dueDate ?? '',
        action.done
          ? loc === 'de'
            ? 'Ja'
            : 'Yes'
          : loc === 'de'
            ? 'Nein'
            : 'No',
      ]);
    }

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    downloadFile(csv, `${safeFilename(session)}.csv`, 'text/csv');
  }

  // ============================================
  // Markdown Export
  // ============================================

  function exportMarkdown(session: IRetroSession): void {
    const loc = locale.value;
    const lines: string[] = [];

    lines.push(`# ${session.name}`);
    lines.push('');
    lines.push(
      `**${loc === 'de' ? 'Datum' : 'Date'}:** ${new Date(session.createdAt).toLocaleDateString(loc === 'de' ? 'de-DE' : 'en-US')}`
    );
    lines.push(
      `**${loc === 'de' ? 'Teilnehmer' : 'Participants'}:** ${session.participants.map((p) => p.name).join(', ')}`
    );
    lines.push('');

    // Columns
    for (const col of ['went-well', 'to-improve', 'action-items'] as const) {
      lines.push(`## ${columnLabel(col, loc)}`);
      lines.push('');

      const groups = session.groups.filter((g) => g.column === col);
      const ungroupedCards = session.cards.filter(
        (c) => c.column === col && !c.groupId
      );

      // Groups
      for (const group of groups) {
        lines.push(`### ${group.title}`);
        const groupCards = group.cardIds
          .map((id) => session.cards.find((c) => c.id === id))
          .filter((c): c is IRetroCard => !!c)
          .sort((a, b) => b.votes - a.votes);
        for (const card of groupCards) {
          const voteBadge =
            card.votes > 0
              ? ` (${card.votes} ${card.votes === 1 ? 'vote' : 'votes'})`
              : '';
          lines.push(`- ${card.content}${voteBadge}`);
        }
        lines.push('');
      }

      // Ungrouped
      const sortedUngrouped = [...ungroupedCards].sort(
        (a, b) => b.votes - a.votes
      );
      for (const card of sortedUngrouped) {
        const voteBadge =
          card.votes > 0
            ? ` (${card.votes} ${card.votes === 1 ? 'vote' : 'votes'})`
            : '';
        lines.push(`- ${card.content}${voteBadge}`);
      }
      lines.push('');
    }

    // Action Items
    if (session.actionItems.length > 0) {
      lines.push(
        `## ${loc === 'de' ? 'Vereinbarte Maßnahmen' : 'Committed Action Items'}`
      );
      lines.push('');
      lines.push(
        `| ${loc === 'de' ? 'Maßnahme' : 'Action'} | ${loc === 'de' ? 'Zuständig' : 'Assignee'} | ${loc === 'de' ? 'Fällig' : 'Due'} | ${loc === 'de' ? 'Status' : 'Status'} |`
      );
      lines.push('| --- | --- | --- | --- |');
      for (const action of session.actionItems) {
        const status = action.done ? '✅' : '⬜';
        lines.push(
          `| ${action.text} | ${action.assignee ?? '-'} | ${action.dueDate ?? '-'} | ${status} |`
        );
      }
      lines.push('');
    }

    // Statistics
    const stats = buildStatistics(session);
    lines.push(`## ${loc === 'de' ? 'Statistik' : 'Statistics'}`);
    lines.push('');
    lines.push(
      `- **${loc === 'de' ? 'Karten insgesamt' : 'Total Cards'}:** ${stats.totalCards}`
    );
    lines.push(
      `- **${loc === 'de' ? 'Stimmen insgesamt' : 'Total Votes'}:** ${stats.totalVotes}`
    );
    lines.push(
      `- **${loc === 'de' ? 'Gruppen' : 'Groups'}:** ${stats.totalGroups}`
    );
    lines.push(
      `- **${loc === 'de' ? 'Maßnahmen' : 'Action Items'}:** ${stats.totalActions} (${stats.completedActions} ${loc === 'de' ? 'erledigt' : 'done'})`
    );
    lines.push('');
    lines.push('---');
    lines.push(
      `*${loc === 'de' ? 'Erstellt mit' : 'Generated by'} Retro Rumble*`
    );

    const md = lines.join('\n');
    downloadFile(md, `${safeFilename(session)}.md`, 'text/markdown');
  }

  // ============================================
  // PNG Image Export (Canvas-based)
  // ============================================

  async function exportPNG(session: IRetroSession): Promise<void> {
    const canvas = renderToCanvas(session);
    canvas.toBlob((blob) => {
      if (blob) {
        downloadFile(blob, `${safeFilename(session)}.png`, 'image/png');
      }
    }, 'image/png');
  }

  function renderToCanvas(session: IRetroSession): HTMLCanvasElement {
    const loc = locale.value;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    // Layout constants
    const padding = 40;
    const colWidth = 340;
    const colGap = 20;
    const cardHeight = 60;
    const cardGap = 8;
    const headerHeight = 100;
    const footerHeight = 60;
    const actionSectionHeight = computeActionSectionHeight(session);

    const columns: RetroColumnType[] = [
      'went-well',
      'to-improve',
      'action-items',
    ];
    const maxCardsInCol = Math.max(
      ...columns.map(
        (col) => session.cards.filter((c) => c.column === col).length
      ),
      1
    );
    const bodyHeight = maxCardsInCol * (cardHeight + cardGap) + 40;

    canvas.width = padding * 2 + colWidth * 3 + colGap * 2;
    canvas.height =
      headerHeight +
      bodyHeight +
      actionSectionHeight +
      footerHeight +
      padding * 2;

    // Background
    ctx.fillStyle = '#f8fafc';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Header
    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 28px system-ui, sans-serif';
    ctx.fillText(session.name, padding, padding + 32);

    ctx.fillStyle = '#64748b';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(
      `${new Date(session.createdAt).toLocaleDateString(loc === 'de' ? 'de-DE' : 'en-US')} · ${session.participants.length} ${loc === 'de' ? 'Teilnehmer' : 'Participants'}`,
      padding,
      padding + 56
    );

    // Columns
    const colColors: Record<
      RetroColumnType,
      {
        bg: string;
        headerBg: string;
        headerFg: string;
        cardBg: string;
        border: string;
      }
    > = {
      'went-well': {
        bg: '#f0fdf4',
        headerBg: '#dcfce7',
        headerFg: '#15803d',
        cardBg: '#ecfdf5',
        border: '#86efac',
      },
      'to-improve': {
        bg: '#fffbeb',
        headerBg: '#fef3c7',
        headerFg: '#a16207',
        cardBg: '#fefce8',
        border: '#fcd34d',
      },
      'action-items': {
        bg: '#f0f9ff',
        headerBg: '#e0f2fe',
        headerFg: '#0369a1',
        cardBg: '#ecfeff',
        border: '#7dd3fc',
      },
    };

    const colStartY = headerHeight + padding;

    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]!;
      const x = padding + i * (colWidth + colGap);
      const colors = colColors[col];

      // Column background
      roundRect(ctx, x, colStartY, colWidth, bodyHeight, 12, colors.bg);

      // Column header
      roundRect(ctx, x, colStartY, colWidth, 36, 12, colors.headerBg, true);
      ctx.fillStyle = colors.headerFg;
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(columnLabel(col, loc), x + 12, colStartY + 24);

      // Cards
      const cards = session.cards
        .filter((c) => c.column === col)
        .sort((a, b) => b.votes - a.votes);

      for (let j = 0; j < cards.length; j++) {
        const card = cards[j]!;
        const cy = colStartY + 44 + j * (cardHeight + cardGap);

        // Card background
        roundRect(ctx, x + 8, cy, colWidth - 16, cardHeight, 8, colors.cardBg);

        // Card border
        ctx.strokeStyle = colors.border;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Card text (truncate if too long)
        ctx.fillStyle = '#1e293b';
        ctx.font = '13px system-ui, sans-serif';
        const maxTextWidth = colWidth - 70;
        let text = card.content;
        while (ctx.measureText(text).width > maxTextWidth && text.length > 3) {
          text = text.slice(0, -4) + '...';
        }
        ctx.fillText(text, x + 16, cy + 22);

        // Vote badge
        if (card.votes > 0) {
          ctx.fillStyle = '#6366f1';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.fillText(`👍 ${card.votes}`, x + 16, cy + 44);
        }

        // Group badge
        if (card.groupId) {
          const group = session.groups.find((g) => g.id === card.groupId);
          if (group) {
            ctx.fillStyle = '#94a3b8';
            ctx.font = '11px system-ui, sans-serif';
            const groupLabel = `[${group.title}]`;
            const tw = ctx.measureText(groupLabel).width;
            ctx.fillText(groupLabel, x + colWidth - 24 - tw, cy + 44);
          }
        }
      }
    }

    // Action Items Section
    if (session.actionItems.length > 0) {
      const actY = colStartY + bodyHeight + 20;

      ctx.fillStyle = '#1e293b';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.fillText(
        loc === 'de' ? 'Vereinbarte Maßnahmen' : 'Committed Action Items',
        padding,
        actY + 20
      );

      for (let i = 0; i < session.actionItems.length; i++) {
        const action = session.actionItems[i]!;
        const ay = actY + 36 + i * 28;
        const checkbox = action.done ? '✅' : '⬜';
        ctx.fillStyle = '#334155';
        ctx.font = '14px system-ui, sans-serif';
        ctx.fillText(
          `${checkbox} ${action.text}${action.assignee ? ` → ${action.assignee}` : ''}`,
          padding + 8,
          ay
        );
      }
    }

    // Footer
    ctx.fillStyle = '#94a3b8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(
      `Retro Rumble · ${new Date().toLocaleDateString(loc === 'de' ? 'de-DE' : 'en-US')}`,
      padding,
      canvas.height - 20
    );

    return canvas;
  }

  function computeActionSectionHeight(session: IRetroSession): number {
    if (session.actionItems.length === 0) return 0;
    return 60 + session.actionItems.length * 28;
  }

  function roundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fillColor: string,
    topOnly = false
  ): void {
    ctx.beginPath();
    if (topOnly) {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.lineTo(x + w, y + h);
      ctx.lineTo(x, y + h);
      ctx.arcTo(x, y, x + r, y, r);
    } else {
      ctx.moveTo(x + r, y);
      ctx.arcTo(x + w, y, x + w, y + h, r);
      ctx.arcTo(x + w, y + h, x, y + h, r);
      ctx.arcTo(x, y + h, x, y, r);
      ctx.arcTo(x, y, x + r, y, r);
    }
    ctx.closePath();
    ctx.fillStyle = fillColor;
    ctx.fill();
  }

  // ============================================
  // PDF Export (via canvas → image in PDF structure)
  // ============================================

  async function exportPDF(session: IRetroSession): Promise<void> {
    // Generate a simple PDF by embedding the canvas as an image
    // Using a minimal PDF generator to avoid heavy dependencies
    const canvas = renderToCanvas(session);
    const imgDataUrl = canvas.toDataURL('image/png');

    // Fetch the image as a blob for embedding
    const response = await fetch(imgDataUrl);
    const imgBlob = await response.blob();
    const imgArrayBuffer = await imgBlob.arrayBuffer();
    const imgBytes = new Uint8Array(imgArrayBuffer);

    const pdf = buildMinimalPDF(
      imgBytes,
      canvas.width,
      canvas.height
    ) as BlobPart;
    downloadFile(
      new Blob([pdf], { type: 'application/pdf' }),
      `${safeFilename(session)}.pdf`,
      'application/pdf'
    );
  }

  /**
   * Builds a minimal valid PDF with a single PNG image.
   * No external libraries needed.
   */
  function buildMinimalPDF(
    pngBytes: Uint8Array,
    imgWidth: number,
    imgHeight: number
  ): Uint8Array {
    // Scale image to fit A4 landscape (842 x 595 points)
    const pageWidth = 842;
    const pageHeight = 595;
    const margin = 20;
    const availW = pageWidth - margin * 2;
    const availH = pageHeight - margin * 2;
    const scale = Math.min(availW / imgWidth, availH / imgHeight);
    const w = Math.round(imgWidth * scale);
    const h = Math.round(imgHeight * scale);
    const xOff = Math.round((pageWidth - w) / 2);
    const yOff = Math.round((pageHeight - h) / 2);

    const encoder = new TextEncoder();

    // PDF objects
    const objects: string[] = [];

    // 1: Catalog
    objects.push('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
    // 2: Pages
    objects.push(
      `2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`
    );
    // 3: Page
    objects.push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Contents 4 0 R /Resources << /XObject << /Img 5 0 R >> >> >>\nendobj\n`
    );
    // 4: Content stream
    const contentStream = `q ${w} 0 0 ${h} ${xOff} ${yOff} cm /Img Do Q`;
    objects.push(
      `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`
    );
    // 5: Image XObject
    objects.push(
      `5 0 obj\n<< /Type /XObject /Subtype /Image /Width ${imgWidth} /Height ${imgHeight} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length ${pngBytes.length} >>\nstream\n`
    );
    // Image stream is binary - handled separately

    // Build PDF byte array
    const header = '%PDF-1.4\n';
    const headerBytes = encoder.encode(header);

    // Calculate offsets for xref
    const objBytes = objects.map((o) => encoder.encode(o));
    const offsets: number[] = [];
    let pos = headerBytes.length;

    // Objects 1-4
    for (let i = 0; i < 4; i++) {
      offsets.push(pos);
      pos += objBytes[i]!.length;
    }
    // Object 5 (image - split)
    offsets.push(pos);
    pos += objBytes[4]!.length;
    pos += pngBytes.length;
    const endstreamEndobj = encoder.encode('\nendstream\nendobj\n');
    pos += endstreamEndobj.length;

    const xrefOffset = pos;

    // Build xref table
    const xrefLines = ['xref\n', `0 6\n`, '0000000000 65535 f \n'];
    for (const offset of offsets) {
      xrefLines.push(`${String(offset).padStart(10, '0')} 00000 n \n`);
    }
    const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    const xrefTrailer = encoder.encode(xrefLines.join('') + trailer);

    // Concatenate
    const totalLength =
      headerBytes.length +
      objBytes.reduce((sum, b) => sum + b.length, 0) +
      pngBytes.length +
      endstreamEndobj.length +
      xrefTrailer.length;

    const result = new Uint8Array(totalLength);
    let offset = 0;

    result.set(headerBytes, offset);
    offset += headerBytes.length;

    for (let i = 0; i < 4; i++) {
      result.set(objBytes[i]!, offset);
      offset += objBytes[i]!.length;
    }

    result.set(objBytes[4]!, offset);
    offset += objBytes[4]!.length;

    result.set(pngBytes, offset);
    offset += pngBytes.length;

    result.set(endstreamEndobj, offset);
    offset += endstreamEndobj.length;

    result.set(xrefTrailer, offset);

    return result;
  }

  return {
    exportJSON,
    exportCSV,
    exportMarkdown,
    exportPNG,
    exportPDF,
  };
}
