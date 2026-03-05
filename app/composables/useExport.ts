/**
 * useExport Composable
 *
 * Provides methods for exporting retro session results in multiple formats:
 * - JSON (structured data)
 * - Markdown (human-readable)
 * - PNG image (high-quality HiDPI Canvas rendering with groups, votes, stats)
 *
 * Fully i18n-aware: all user-facing strings come from the i18n system.
 */

import type { IRetroCard, IRetroSession, RetroColumnType } from '~/types';
import { COLUMN_META, ORDERED_COLUMNS } from '~/utils/columnConfig';

/**
 * Export format type
 */
export type ExportFormat = 'json' | 'markdown' | 'png';

/**
 * Column emoji helper (language-independent) — uses shared column config
 */
function columnEmoji(column: RetroColumnType): string {
  return COLUMN_META[column].emoji;
}

/**
 * Escapes special markdown characters in user-generated content
 * to prevent formatting injection in exported files.
 */
function escapeMd(text: string): string {
  return text.replace(/([\\`*_{}[\]()#+\-.!|>~])/g, '\\$1');
}

/**
 * Composable for exporting retro results
 */
export function useExport() {
  const { locale, t } = useI18n();

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
    const columns: Record<RetroColumnType, string> = {
      'went-well': t('column.went-well'),
      'to-improve': t('column.to-improve'),
      'action-items': t('column.action-items'),
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
  // Markdown Export
  // ============================================

  /**
   * Formats a vote count as a markdown badge using i18n pluralization
   */
  function formatVoteBadge(votes: number): string {
    if (votes === 0) return '';
    const label = votes === 1 ? t('export.markdown.vote') : t('export.markdown.votePlural');
    return ` (${votes} ${label})`;
  }

  function exportMarkdown(session: IRetroSession): void {
    const lines: string[] = [];

    lines.push(`# ${escapeMd(session.name)}`);
    lines.push('');
    lines.push(
      `**${t('export.markdown.date')}:** ${new Date(session.createdAt).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' })}`
    );
    lines.push(
      `**${t('export.markdown.participants')}:** ${session.participants.map((p) => escapeMd(p.name)).join(', ')}`
    );
    lines.push('');

    for (const col of ORDERED_COLUMNS) {
      lines.push(`## ${t(`column.${col}`)}`);
      lines.push('');

      const groups = session.groups.filter((g) => g.column === col);
      const ungroupedCards = session.cards.filter(
        (c) => c.column === col && !c.groupId
      );

      for (const group of groups) {
        lines.push(`### ${escapeMd(group.title)}`);
        const groupCards = group.cardIds
          .map((id) => session.cards.find((c) => c.id === id))
          .filter((c): c is IRetroCard => !!c)
          .sort((a, b) => b.votes - a.votes);
        for (const card of groupCards) {
          const voteBadge = formatVoteBadge(card.votes);
          lines.push(`- ${escapeMd(card.content)}${voteBadge}`);
        }
        lines.push('');
      }

      const sortedUngrouped = [...ungroupedCards].sort(
        (a, b) => b.votes - a.votes
      );
      for (const card of sortedUngrouped) {
        const voteBadge = formatVoteBadge(card.votes);
        lines.push(`- ${escapeMd(card.content)}${voteBadge}`);
      }
      lines.push('');
    }

    if (session.actionItems.length > 0) {
      lines.push(`## ${t('export.markdown.committedActions')}`);
      lines.push('');
      lines.push(
        `| ${t('export.markdown.action')} | ${t('export.markdown.assignee')} | ${t('export.markdown.due')} | ${t('export.markdown.status')} |`
      );
      lines.push('| --- | --- | --- | --- |');
      for (const action of session.actionItems) {
        const status = action.done ? '✅' : '⬜';
        lines.push(
          `| ${escapeMd(action.text)} | ${escapeMd(action.assignee ?? '-')} | ${action.dueDate ?? '-'} | ${status} |`
        );
      }
      lines.push('');
    }

    const stats = buildStatistics(session);
    lines.push(`## ${t('export.markdown.statistics')}`);
    lines.push('');
    lines.push(`- **${t('export.markdown.totalCards')}:** ${stats.totalCards}`);
    lines.push(`- **${t('export.markdown.totalVotes')}:** ${stats.totalVotes}`);
    lines.push(`- **${t('summary.totalGroups')}:** ${stats.totalGroups}`);
    lines.push(
      `- **${t('summary.actionItems')}:** ${stats.totalActions} (${stats.completedActions} ${t('export.markdown.done')})`
    );
    lines.push('');
    lines.push('---');
    lines.push(`*${t('export.markdown.generatedBy')} Retro Rumble*`);

    const md = lines.join('\n');
    downloadFile(md, `${safeFilename(session)}.md`, 'text/markdown');
  }

  // ============================================
  // PNG Image Export (high-quality HiDPI Canvas)
  // ============================================

  async function exportPNG(session: IRetroSession): Promise<void> {
    const canvas = renderToCanvas(session);
    return new Promise<void>((resolve) => {
      canvas.toBlob(
        (blob) => {
          if (blob) {
            downloadFile(blob, `${safeFilename(session)}.png`, 'image/png');
          }
          resolve();
        },
        'image/png',
        1.0
      );
    });
  }

  // ---- Canvas Rendering Engine ----

  /** Pixel ratio for crisp HiDPI output */
  const DPR =
    typeof window !== 'undefined'
      ? Math.min(window.devicePixelRatio ?? 1, 3)
      : 2;

  /** Design tokens matching the Tailwind palette */
  const COLORS = {
    bg: '#f1f5f9',
    headerBg: '#0f172a',
    headerFg: '#ffffff',
    headerSub: '#94a3b8',
    cardText: '#1e293b',
    cardTextMuted: '#64748b',
    badgeBg: '#6366f1',
    badgeFg: '#ffffff',
    groupLabelBg: '#e2e8f0',
    groupLabelFg: '#475569',
    actionDone: '#16a34a',
    actionOpen: '#94a3b8',
    footerFg: '#94a3b8',
    divider: '#cbd5e1',
    statBg: '#ffffff',
    statValue: '#4f46e5',
    statLabel: '#64748b',
    columns: {
      'went-well': {
        bg: '#f0fdf4',
        headerBg: '#15803d',
        headerFg: '#ffffff',
        cardBg: '#ffffff',
        cardBorder: '#bbf7d0',
        accent: '#22c55e',
      },
      'to-improve': {
        bg: '#fffbeb',
        headerBg: '#a16207',
        headerFg: '#ffffff',
        cardBg: '#ffffff',
        cardBorder: '#fde68a',
        accent: '#eab308',
      },
      'action-items': {
        bg: '#eff6ff',
        headerBg: '#1d4ed8',
        headerFg: '#ffffff',
        cardBg: '#ffffff',
        cardBorder: '#bfdbfe',
        accent: '#3b82f6',
      },
    } as Record<
      RetroColumnType,
      {
        bg: string;
        headerBg: string;
        headerFg: string;
        cardBg: string;
        cardBorder: string;
        accent: string;
      }
    >,
  };

  /** Fonts */
  const FONT = {
    title: 'bold 26px "Inter", "Segoe UI", system-ui, sans-serif',
    subtitle: '15px "Inter", "Segoe UI", system-ui, sans-serif',
    colHeader: 'bold 14px "Inter", "Segoe UI", system-ui, sans-serif',
    colCount: '12px "Inter", "Segoe UI", system-ui, sans-serif',
    groupLabel: 'bold 12px "Inter", "Segoe UI", system-ui, sans-serif',
    cardText: '14px "Inter", "Segoe UI", system-ui, sans-serif',
    voteBadge: 'bold 11px "Inter", "Segoe UI", system-ui, sans-serif',
    groupTag: '11px "Inter", "Segoe UI", system-ui, sans-serif',
    actionTitle: 'bold 16px "Inter", "Segoe UI", system-ui, sans-serif',
    actionText: '14px "Inter", "Segoe UI", system-ui, sans-serif',
    actionAssignee: 'bold 12px "Inter", "Segoe UI", system-ui, sans-serif',
    statValue: 'bold 22px "Inter", "Segoe UI", system-ui, sans-serif',
    statLabel: '11px "Inter", "Segoe UI", system-ui, sans-serif',
    footer: '12px "Inter", "Segoe UI", system-ui, sans-serif',
  };

  /** Layout constants (logical pixels) */
  const L = {
    padding: 48,
    colGap: 24,
    colWidth: 360,
    colHeaderH: 44,
    colRadius: 14,
    cardPadX: 14,
    cardPadY: 10,
    cardGap: 6,
    cardRadius: 10,
    cardMinH: 46,
    cardLineH: 20,
    headerH: 90,
    statBarH: 70,
    footerH: 50,
    groupHeaderH: 28,
    groupGap: 12,
    actionRowH: 36,
  };

  /** Word-wrap helper: returns lines that fit within maxWidth */
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number
  ): string[] {
    const words = text.split(/\s+/);
    const lines: string[] = [];
    let line = '';
    for (const word of words) {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines.length ? lines : [''];
  }

  /** Measure the height of a single card (with text wrapping). */
  function measureCardHeight(
    ctx: CanvasRenderingContext2D,
    card: IRetroCard,
    textWidth: number
  ): number {
    ctx.font = FONT.cardText;
    const lines = wrapText(ctx, card.content, textWidth);
    const textH = lines.length * L.cardLineH;
    const metaH = card.votes > 0 || card.groupId ? 20 : 0;
    return Math.max(L.cardMinH, L.cardPadY * 2 + textH + metaH);
  }

  /** Measure the total height of a column (header + groups + cards). */
  function measureColumnHeight(
    ctx: CanvasRenderingContext2D,
    session: IRetroSession,
    col: RetroColumnType,
    textWidth: number
  ): number {
    let h = L.colHeaderH + 12;

    const groups = session.groups.filter((g) => g.column === col);
    const ungroupedCards = session.cards.filter(
      (c) => c.column === col && !c.groupId
    );

    for (const group of groups) {
      h += L.groupHeaderH;
      const cards = group.cardIds
        .map((id) => session.cards.find((c) => c.id === id))
        .filter((c): c is IRetroCard => !!c);
      for (const card of cards) {
        h += measureCardHeight(ctx, card, textWidth - 16) + L.cardGap;
      }
      h += L.groupGap;
    }

    for (const card of ungroupedCards) {
      h += measureCardHeight(ctx, card, textWidth) + L.cardGap;
    }

    return h + 12;
  }

  /** Compute action items section height. */
  function computeActionSectionHeight(session: IRetroSession): number {
    if (session.actionItems.length === 0) return 0;
    return 52 + session.actionItems.length * L.actionRowH + 16;
  }

  /** Draw a filled rounded rectangle. */
  function fillRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = color;
    ctx.fill();
  }

  /** Draw a stroked rounded rectangle. */
  function strokeRoundRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    color: string,
    lineWidth = 1
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  /** Draw a pill-shaped badge. Returns badge width. */
  function drawBadge(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    bgColor: string,
    fgColor: string,
    font: string
  ): number {
    ctx.font = font;
    const tw = ctx.measureText(text).width;
    const pw = tw + 14;
    const ph = 20;
    fillRoundRect(ctx, x, y - ph / 2, pw, ph, ph / 2, bgColor);
    ctx.fillStyle = fgColor;
    ctx.fillText(text, x + 7, y + 4);
    return pw;
  }

  /**
   * Draw a single card and return the new Y position below it.
   */
  function drawCard(
    ctx: CanvasRenderingContext2D,
    card: IRetroCard,
    session: IRetroSession,
    x: number,
    y: number,
    w: number,
    textWidth: number,
    cc: {
      cardBg: string;
      cardBorder: string;
      accent: string;
    }
  ): number {
    const h = measureCardHeight(ctx, card, textWidth);

    // Card shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.06)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    fillRoundRect(ctx, x, y, w, h, L.cardRadius, cc.cardBg);
    ctx.restore();

    // Card border
    strokeRoundRect(ctx, x, y, w, h, L.cardRadius, cc.cardBorder);

    // Left accent bar
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, 4, h, [L.cardRadius, 0, 0, L.cardRadius]);
    ctx.clip();
    fillRoundRect(ctx, x, y, 4, h, 0, cc.accent);
    ctx.restore();

    // Card text (wrapped)
    ctx.font = FONT.cardText;
    ctx.fillStyle = COLORS.cardText;
    const lines = wrapText(ctx, card.content, textWidth);
    for (let li = 0; li < lines.length; li++) {
      ctx.fillText(
        lines[li]!,
        x + L.cardPadX + 4,
        y + L.cardPadY + 14 + li * L.cardLineH
      );
    }

    // Meta row: votes + group tag
    const metaY = y + L.cardPadY + lines.length * L.cardLineH + 4;

    if (card.votes > 0) {
      drawBadge(
        ctx,
        `👍 ${card.votes}`,
        x + L.cardPadX + 4,
        metaY + 6,
        COLORS.badgeBg,
        COLORS.badgeFg,
        FONT.voteBadge
      );
    }

    if (card.groupId) {
      const group = session.groups.find((g) => g.id === card.groupId);
      if (group) {
        ctx.font = FONT.groupTag;
        ctx.fillStyle = COLORS.groupLabelFg;
        const tag = `[${group.title}]`;
        const tw = ctx.measureText(tag).width;
        ctx.fillText(tag, x + w - L.cardPadX - tw, metaY + 10);
      }
    }

    return y + h + L.cardGap;
  }

  /**
   * Main canvas renderer — high-quality retro board snapshot.
   */
  function renderToCanvas(session: IRetroSession): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;

    const columns: RetroColumnType[] = [
      'went-well',
      'to-improve',
      'action-items',
    ];
    const textWidth = L.colWidth - L.cardPadX * 2 - 16;

    // Pre-measure column heights
    const colHeights = columns.map((col) =>
      measureColumnHeight(ctx, session, col, textWidth)
    );
    const maxColH = Math.max(...colHeights, 120);

    const actionH = computeActionSectionHeight(session);
    const stats = buildStatistics(session);

    // Canvas dimensions (logical)
    const logicalW = L.padding * 2 + L.colWidth * 3 + L.colGap * 2;
    const logicalH =
      L.headerH +
      L.statBarH +
      16 +
      maxColH +
      (actionH > 0 ? 24 + actionH : 0) +
      L.footerH +
      L.padding;

    // Apply DPR for crisp HiDPI rendering
    canvas.width = Math.round(logicalW * DPR);
    canvas.height = Math.round(logicalH * DPR);
    canvas.style.width = `${logicalW}px`;
    canvas.style.height = `${logicalH}px`;
    ctx.scale(DPR, DPR);

    // ---- Background ----
    fillRoundRect(ctx, 0, 0, logicalW, logicalH, 0, COLORS.bg);

    // ---- Header bar ----
    fillRoundRect(ctx, 0, 0, logicalW, L.headerH, 0, COLORS.headerBg);

    ctx.fillStyle = COLORS.headerFg;
    ctx.font = FONT.title;
    ctx.fillText(session.name, L.padding, 38);

    ctx.fillStyle = COLORS.headerSub;
    ctx.font = FONT.subtitle;
    const dateStr = new Date(session.createdAt).toLocaleDateString(
      locale.value,
      { year: 'numeric', month: 'long', day: 'numeric' }
    );
    const participantNames = session.participants.map((p) => p.name).join(', ');
    ctx.fillText(
      `${dateStr}  ·  ${session.participants.length} ${t('export.canvas.participants')}: ${participantNames}`,
      L.padding,
      62
    );

    // ---- Stats bar ----
    const statY = L.headerH + 12;
    const statW = (logicalW - L.padding * 2 - L.colGap * 3) / 4;
    const statItems = [
      { value: String(stats.totalCards), label: t('export.canvas.cards') },
      { value: String(stats.totalVotes), label: t('export.canvas.votes') },
      { value: String(stats.totalGroups), label: t('export.canvas.groups') },
      {
        value: `${stats.completedActions}/${stats.totalActions}`,
        label: t('export.canvas.actions'),
      },
    ];
    for (let i = 0; i < statItems.length; i++) {
      const sx = L.padding + i * (statW + L.colGap);
      fillRoundRect(ctx, sx, statY, statW, L.statBarH, 10, COLORS.statBg);
      ctx.fillStyle = COLORS.statValue;
      ctx.font = FONT.statValue;
      ctx.textAlign = 'center';
      ctx.fillText(statItems[i]!.value, sx + statW / 2, statY + 30);
      ctx.fillStyle = COLORS.statLabel;
      ctx.font = FONT.statLabel;
      ctx.fillText(statItems[i]!.label, sx + statW / 2, statY + 50);
    }
    ctx.textAlign = 'left';

    // ---- Columns ----
    const colStartY = statY + L.statBarH + 16;

    for (let ci = 0; ci < columns.length; ci++) {
      const col = columns[ci]!;
      const cc = COLORS.columns[col];
      const cx = L.padding + ci * (L.colWidth + L.colGap);

      // Column container
      fillRoundRect(
        ctx,
        cx,
        colStartY,
        L.colWidth,
        maxColH,
        L.colRadius,
        cc.bg
      );
      strokeRoundRect(
        ctx,
        cx,
        colStartY,
        L.colWidth,
        maxColH,
        L.colRadius,
        cc.cardBorder
      );

      // Column header (clipped top corners)
      ctx.save();
      ctx.beginPath();
      ctx.roundRect(cx, colStartY, L.colWidth, L.colHeaderH, [
        L.colRadius,
        L.colRadius,
        0,
        0,
      ]);
      ctx.clip();
      fillRoundRect(
        ctx,
        cx,
        colStartY,
        L.colWidth,
        L.colHeaderH,
        0,
        cc.headerBg
      );
      ctx.restore();

      // Column title with emoji
      ctx.fillStyle = cc.headerFg;
      ctx.font = FONT.colHeader;
      const emoji = columnEmoji(col);
      ctx.fillText(
        `${emoji}  ${t(`column.${col}`)}`,
        cx + 14,
        colStartY + 28
      );

      // Column card count (right-aligned in header)
      const colCards = session.cards.filter((c) => c.column === col);
      ctx.font = FONT.colCount;
      ctx.fillStyle = cc.headerFg;
      ctx.globalAlpha = 0.7;
      const countText = `${colCards.length}`;
      const countW = ctx.measureText(countText).width;
      ctx.fillText(countText, cx + L.colWidth - 14 - countW, colStartY + 28);
      ctx.globalAlpha = 1;

      // ---- Render cards ----
      let curY = colStartY + L.colHeaderH + 10;

      // Grouped cards
      const groups = session.groups.filter((g) => g.column === col);
      for (const group of groups) {
        // Group label bar
        fillRoundRect(
          ctx,
          cx + 10,
          curY,
          L.colWidth - 20,
          L.groupHeaderH,
          6,
          COLORS.groupLabelBg
        );
        ctx.fillStyle = COLORS.groupLabelFg;
        ctx.font = FONT.groupLabel;
        ctx.fillText(`📁  ${group.title}`, cx + 18, curY + 18);
        curY += L.groupHeaderH + 4;

        const groupCards = group.cardIds
          .map((id) => session.cards.find((c) => c.id === id))
          .filter((c): c is IRetroCard => !!c)
          .sort((a, b) => b.votes - a.votes);

        for (const card of groupCards) {
          curY = drawCard(
            ctx,
            card,
            session,
            cx + 18,
            curY,
            L.colWidth - 36,
            textWidth - 16,
            cc
          );
        }
        curY += L.groupGap;
      }

      // Ungrouped cards
      const ungrouped = colCards
        .filter((c) => !c.groupId)
        .sort((a, b) => b.votes - a.votes);

      for (const card of ungrouped) {
        curY = drawCard(
          ctx,
          card,
          session,
          cx + 10,
          curY,
          L.colWidth - 20,
          textWidth,
          cc
        );
      }
    }

    // ---- Action Items ----
    if (session.actionItems.length > 0) {
      const actY = colStartY + maxColH + 24;
      const actW = logicalW - L.padding * 2;

      fillRoundRect(
        ctx,
        L.padding,
        actY,
        actW,
        actionH,
        L.colRadius,
        '#ffffff'
      );
      strokeRoundRect(
        ctx,
        L.padding,
        actY,
        actW,
        actionH,
        L.colRadius,
        COLORS.divider
      );

      ctx.fillStyle = COLORS.cardText;
      ctx.font = FONT.actionTitle;
      ctx.fillText(
        `📋  ${t('export.markdown.committedActions')}`,
        L.padding + 16,
        actY + 28
      );

      // Divider line
      ctx.beginPath();
      ctx.moveTo(L.padding + 16, actY + 40);
      ctx.lineTo(logicalW - L.padding - 16, actY + 40);
      ctx.strokeStyle = COLORS.divider;
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < session.actionItems.length; i++) {
        const action = session.actionItems[i]!;
        const ay = actY + 52 + i * L.actionRowH;

        const checkIcon = action.done ? '✅' : '⬜';
        const actionTextColor = action.done
          ? COLORS.cardTextMuted
          : COLORS.cardText;

        ctx.font = FONT.actionText;
        ctx.fillStyle = actionTextColor;
        ctx.fillText(`${checkIcon}  ${action.text}`, L.padding + 20, ay + 14);

        // Assignee badge
        if (action.assignee) {
          const checkColor = action.done
            ? COLORS.actionDone
            : COLORS.actionOpen;
          ctx.font = FONT.actionAssignee;
          const assigneeW = ctx.measureText(action.assignee).width;
          drawBadge(
            ctx,
            action.assignee,
            logicalW - L.padding - 16 - assigneeW - 20,
            ay + 10,
            checkColor + '20',
            checkColor,
            FONT.actionAssignee
          );
        }
      }
    }

    // ---- Footer ----
    const footerY = logicalH - L.footerH;

    ctx.beginPath();
    ctx.moveTo(L.padding, footerY);
    ctx.lineTo(logicalW - L.padding, footerY);
    ctx.strokeStyle = COLORS.divider;
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = COLORS.footerFg;
    ctx.font = FONT.footer;
    ctx.fillText(
      `Retro Rumble  ·  ${new Date().toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' })}`,
      L.padding,
      footerY + 24
    );

    const footerRight = `${session.participants.length} ${t('export.canvas.participants')}  ·  ${session.cards.length} ${t('export.canvas.cards')}`;
    const frW = ctx.measureText(footerRight).width;
    ctx.fillText(footerRight, logicalW - L.padding - frW, footerY + 24);

    return canvas;
  }

  return {
    exportJSON,
    exportMarkdown,
    exportPNG,
  };
}
