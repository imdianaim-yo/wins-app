// export.js — Generates Markdown and CSV exports from IndexedDB entries.

function formatDateLong(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

async function exportMarkdown(from, to) {
  const entries = await getEntriesInRange(from, to);
  if (!entries.length) return alert('No entries found in that date range.');

  const lines = ['# Wins Journal\n'];

  for (const entry of entries) {
    lines.push(`## ${formatDateLong(entry.date)}\n`);

    if (entry.accomplishments?.length) {
      lines.push('### Accomplishments\n');
      entry.accomplishments.forEach(a => lines.push(`- ${a}`));
      lines.push('');
    }

    if (entry.learnings?.length) {
      lines.push('### Learnings\n');
      entry.learnings.forEach(l => lines.push(`- ${l}`));
      lines.push('');
    }
  }

  downloadFile(lines.join('\n'), 'wins-journal.md', 'text/markdown');
}

async function exportCSV(from, to) {
  const entries = await getEntriesInRange(from, to);
  if (!entries.length) return alert('No entries found in that date range.');

  const rows = [['Date', 'Type', 'Item']];

  for (const entry of entries) {
    (entry.accomplishments || []).forEach(a => rows.push([entry.date, 'Accomplishment', a]));
    (entry.learnings || []).forEach(l => rows.push([entry.date, 'Learning', l]));
  }

  const csv = rows.map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
  downloadFile(csv, 'wins-journal.csv', 'text/csv');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
