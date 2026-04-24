// db.js — IndexedDB schema via Dexie.js
// Think of Dexie as a friendly wrapper around the browser's built-in filing cabinet (IndexedDB).

const db = new Dexie('WinsApp');

db.version(1).stores({
  // Each entry is one day's journal. The & prefix means "unique index".
  // date is stored as YYYY-MM-DD string for easy sorting and lookup.
  entries: '++id, &date, createdAt'
});

// Ask the browser to persist storage — prevents data loss when disk is low.
if (navigator.storage && navigator.storage.persist) {
  navigator.storage.persist();
}

// ── CRUD helpers ──

async function saveEntry({ date, rawDump, accomplishments, learnings }) {
  const existing = await db.entries.where('date').equals(date).first();
  if (existing) {
    // Append to today if an entry already exists
    return db.entries.update(existing.id, {
      rawDump: existing.rawDump + '\n\n' + rawDump,
      accomplishments: [...existing.accomplishments, ...accomplishments],
      learnings: [...existing.learnings, ...learnings],
    });
  }
  return db.entries.add({ date, rawDump, accomplishments, learnings, createdAt: Date.now() });
}

async function getTodayEntry() {
  const today = todayString();
  return db.entries.where('date').equals(today).first();
}

async function getEntriesInRange(from, to) {
  return db.entries
    .where('date')
    .between(from, to, true, true)
    .reverse()
    .sortBy('date');
}

async function getAllEntries() {
  return db.entries.orderBy('date').reverse().toArray();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}
