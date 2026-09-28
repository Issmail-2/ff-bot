const fs = require('fs');
const path = require('path');
let config;
try { config = require('../config.json'); } catch { config = {}; }
if (!config.modes) config.modes = {};
if (!config.modes.amo) config.modes.amo = { pointsFile: './data/points.json' };
if (!config.modes.esport) config.modes.esport = { pointsFile: './data/points_esport.json' };
if (!config.pointsFile) config.pointsFile = './data/points.json';

function pointsPathFor(mode) {
  const file = config.modes[mode] ? config.modes[mode].pointsFile : config.pointsFile;
  return path.resolve(__dirname, '..', file);
}

function ensureDataFile(mode = 'amo') {
  const p = pointsPathFor(mode);
  const dir = path.dirname(p);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, JSON.stringify({ players: {} }, null, 2));
  }
}

// ---------------------------------------------------------------------------
// In-memory cache with write coalescing.
//
// Every read used to be a blocking readFileSync + JSON.parse, and every write a
// blocking writeFileSync. Because callers update players in loops (match payout
// touches one file read+write per player; !giveall does it per registered
// player) that turned a single match settlement into dozens of full-file
// round trips on the main thread, which is what caused the event loop to stall.
//
// Reads now come from the cache. Writes are marked dirty and coalesced onto a
// setImmediate, so a whole synchronous burst of updates (a loop) results in one
// disk write instead of one per player. flushPoints() forces it to disk
// immediately, and flushAllPoints() is wired to process exit.
// ---------------------------------------------------------------------------
const cache = new Map();
const dirty = new Set();
let scheduled = false;

function scheduleFlush() {
  if (scheduled) return;
  scheduled = true;
  setImmediate(() => {
    scheduled = false;
    flushAllPoints();
  });
}

function flushPoints(mode) {
  if (!dirty.has(mode)) return;
  const data = cache.get(mode);
  if (!data) return;
  try {
    fs.writeFileSync(pointsPathFor(mode), JSON.stringify(data, null, 2));
    dirty.delete(mode);
  } catch (e) {
    console.log(`[STORAGE] flush failed for ${mode}:`, e.message);
  }
}

function flushAllPoints() {
  for (const mode of Array.from(dirty)) flushPoints(mode);
}

function loadPoints(mode = 'amo') {
  if (cache.has(mode)) return cache.get(mode);
  ensureDataFile(mode);
  let data;
  try {
    data = JSON.parse(fs.readFileSync(pointsPathFor(mode), 'utf8'));
  } catch (e) {
    data = null;
  }
  if (!data || typeof data !== 'object') data = { players: {} };
  if (!data.players || typeof data.players !== 'object') data.players = {};
  cache.set(mode, data);
  return data;
}

function savePoints(mode, data) {
  cache.set(mode, data);
  dirty.add(mode);
  scheduleFlush();
}

function getPlayerRecord(userId, mode = 'amo') {
  const data = loadPoints(mode);
  if (!data.players[userId]) {
    data.players[userId] = { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0, mvpCount: 0 };
  }
  const p = data.players[userId];
  if (typeof p.wins !== 'number') p.wins = 0;
  if (typeof p.losses !== 'number') p.losses = 0;
  if (typeof p.totalPoints !== 'number') p.totalPoints = 0;
  if (typeof p.matchesPlayed !== 'number') p.matchesPlayed = 0;
  if (typeof p.mvpCount !== 'number') p.mvpCount = 0;
  return p;
}

function getPlayerPoints(userId, mode = 'amo') {
  const p = loadPoints(mode).players[userId];
  return p || { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0, mvpCount: 0 };
}

function addPoints(userId, points, type, mode = 'amo', isMvp) {
  const p = getPlayerRecord(userId, mode);
  p.totalPoints += points;
  p.matchesPlayed += 1;
  if (isMvp) p.mvpCount += 1;
  if (type === 'win') {
    p.wins += 1;
  } else {
    p.losses += 1;
  }
  savePoints(mode, loadPoints(mode));
  return p;
}

function removePoints(userId, points, type, mode = 'amo') {
  const p = getPlayerRecord(userId, mode);
  p.totalPoints = Math.max(0, p.totalPoints - points);
  p.matchesPlayed = Math.max(0, p.matchesPlayed - 1);
  if (type === 'win') {
    p.wins = Math.max(0, p.wins - 1);
  } else {
    p.losses = Math.max(0, p.losses - 1);
  }
  savePoints(mode, loadPoints(mode));
  return p;
}

function resetAllPoints(mode = 'amo') {
  const data = loadPoints(mode);
  data.players = {};
  savePoints(mode, data);
}

function adjustPoints(userId, delta, mode = 'amo') {
  const p = getPlayerRecord(userId, mode);
  p.totalPoints = Math.max(0, p.totalPoints + delta);
  savePoints(mode, loadPoints(mode));
  return p.totalPoints;
}

// Full sorted list. Kept untruncated so ranks below the top N stay correct.
function sortedPlayers(mode = 'amo') {
  const data = loadPoints(mode);
  return Object.entries(data.players)
    .filter(([, p]) => p && ((p.totalPoints || 0) > 0 || (p.matchesPlayed || 0) > 0))
    .sort((a, b) =>
      (b[1].totalPoints || 0) - (a[1].totalPoints || 0) ||
      (b[1].wins || 0) - (a[1].wins || 0) ||
      (b[1].matchesPlayed || 0) - (a[1].matchesPlayed || 0)
    );
}

function getLeaderboard(mode = 'amo') {
  return sortedPlayers(mode).slice(0, 10);
}

function countRanked(mode = 'amo') {
  return sortedPlayers(mode).length;
}

// Rank is computed over the FULL sorted list. This used to delegate to
// getLeaderboard(), which is sliced to the top 10, so it could never return a
// rank above 10 — every player below 10th was reported as "Unranked".
function getPlayerRank(userId, mode = 'amo') {
  const idx = sortedPlayers(mode).findIndex(([id]) => id === userId);
  return idx === -1 ? null : idx + 1;
}

function getRankBadge(userId, mode = 'amo') {
  const rank = getPlayerRank(userId, mode);
  if (!rank) return '';
  if (rank === 1) return '🥇 #1';
  if (rank === 2) return '🥈 #2';
  if (rank === 3) return '🥉 #3';
  return `#${rank}`;
}

let exitHooked = false;
function hookExit() {
  if (exitHooked) return;
  exitHooked = true;
  const handler = () => { flushAllPoints(); };
  process.on('exit', handler);
  for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
    process.on(sig, () => { flushAllPoints(); process.exit(0); });
  }
}
hookExit();

module.exports = {
  getPlayerPoints,
  addPoints,
  removePoints,
  adjustPoints,
  resetAllPoints,
  getLeaderboard,
  countRanked,
  loadPoints,
  getPlayerRank,
  getRankBadge,
  flushPoints,
  flushAllPoints
};
