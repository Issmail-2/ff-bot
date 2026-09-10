const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'reports.json');

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify([]));
}

function loadReports() {
  ensureFile();
  try {
    const data = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function saveReports(list) {
  ensureFile();
  fs.writeFileSync(FILE, JSON.stringify(list, null, 2));
}

function addReport({ reporterId, reporterName, cheaterName, cheaterId, platform, guildId }) {
  const list = loadReports();
  const report = {
    id: `R${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
    reporterId,
    reporterName,
    cheaterName: String(cheaterName || '?').slice(0, 32),
    cheaterId: cheaterId || null,
    platform: platform || 'PC',
    guildId,
    status: 'pending',
    claimedBy: null,
    checkedBy: null,
    at: Date.now()
  };
  list.push(report);
  saveReports(list);
  return report;
}

function getReport(id) {
  return loadReports().find(r => r.id === id) || null;
}

function updateReport(id, patch) {
  const list = loadReports();
  const idx = list.findIndex(r => r.id === id);
  if (idx === -1) return null;
  list[idx] = Object.assign({}, list[idx], patch);
  saveReports(list);
  return list[idx];
}

module.exports = { addReport, getReport, updateReport, loadReports };