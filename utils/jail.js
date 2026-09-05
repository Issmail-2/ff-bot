const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'jail.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]));
}

function loadJails() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveJails(list) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function getJail(userId) {
  const list = loadJails();
  return list.find(e => e.userId === userId) || null;
}

function jailUser(userId, roleId, guildId, durationMs, reason, byId, affectedChannels) {
  const list = loadJails();
  const entry = {
    userId,
    roleId,
    guildId,
    reason: reason || 'No reason provided',
    byId: byId || 'unknown',
    createdAt: Date.now(),
    expiresAt: durationMs === null ? -1 : Date.now() + durationMs,
    affectedChannels: affectedChannels || []
  };
  const idx = list.findIndex(e => e.userId === userId);
  if (idx !== -1) list[idx] = entry;
  else list.push(entry);
  saveJails(list);
  return entry;
}

function unjailUser(userId) {
  const list = loadJails();
  const idx = list.findIndex(e => e.userId === userId);
  if (idx === -1) return null;
  const [entry] = list.splice(idx, 1);
  saveJails(list);
  return entry;
}

module.exports = { loadJails, getJail, jailUser, unjailUser };