const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'blacklist.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]));
}

function loadBlacklist() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveBlacklist(list) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function isBlacklisted(userId) {
  const now = Date.now();
  const list = loadBlacklist();
  let changed = false;
  const active = list.filter(e => {
    if (e.userId === userId && e.expiresAt !== -1 && e.expiresAt <= now) {
      changed = true;
      return false;
    }
    return true;
  });
  if (changed) saveBlacklist(active);
  const entry = list.find(e => e.userId === userId);
  if (!entry) return null;
  if (entry.expiresAt !== -1 && entry.expiresAt <= now) return null;
  return entry;
}

function blacklistUser(userId, durationMs, reason, byId) {
  const list = loadBlacklist();
  const entry = {
    userId,
    reason: reason || 'No reason provided',
    byId: byId || 'unknown',
    createdAt: Date.now(),
    expiresAt: durationMs === null ? -1 : Date.now() + durationMs
  };
  const idx = list.findIndex(e => e.userId === userId);
  if (idx !== -1) list[idx] = entry;
  else list.push(entry);
  saveBlacklist(list);
  return entry;
}

function unblacklistUser(userId) {
  const list = loadBlacklist();
  const next = list.filter(e => e.userId !== userId);
  saveBlacklist(next);
  return next.length !== list.length;
}

module.exports = { isBlacklisted, blacklistUser, unblacklistUser, loadBlacklist };