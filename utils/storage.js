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

function loadPoints(mode = 'amo') {
  ensureDataFile(mode);
  const data = fs.readFileSync(pointsPathFor(mode), 'utf8');
  return JSON.parse(data);
}

function savePoints(mode, data) {
  ensureDataFile(mode);
  fs.writeFileSync(pointsPathFor(mode), JSON.stringify(data, null, 2));
}

function getPlayerPoints(userId, mode = 'amo') {
  const data = loadPoints(mode);
  return data.players[userId] || { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0 };
}

function addPoints(userId, points, type, mode = 'amo') {
  const data = loadPoints(mode);
  if (!data.players[userId]) {
    data.players[userId] = { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0 };
  }
  data.players[userId].totalPoints += points;
  data.players[userId].matchesPlayed += 1;
  if (type === 'win') {
    data.players[userId].wins += 1;
  } else {
    data.players[userId].losses += 1;
  }
  savePoints(mode, data);
  return data.players[userId];
}

function removePoints(userId, points, type, mode = 'amo') {
  const data = loadPoints(mode);
  if (!data.players[userId]) {
    data.players[userId] = { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0 };
  }
  const p = data.players[userId];
  p.totalPoints = Math.max(0, p.totalPoints - points);
  p.matchesPlayed = Math.max(0, p.matchesPlayed - 1);
  if (type === 'win') {
    p.wins = Math.max(0, p.wins - 1);
  } else {
    p.losses = Math.max(0, p.losses - 1);
  }
  savePoints(mode, data);
  return p;
}

function resetAllPoints(mode = 'amo') {
  savePoints(mode, { players: {} });
}

function adjustPoints(userId, delta, mode = 'amo') {
  const data = loadPoints(mode);
  if (!data.players[userId]) {
    data.players[userId] = { wins: 0, losses: 0, totalPoints: 0, matchesPlayed: 0 };
  }
  const p = data.players[userId];
  p.totalPoints = Math.max(0, p.totalPoints + delta);
  savePoints(mode, data);
  return p.totalPoints;
}

function getLeaderboard(mode = 'amo') {
  const data = loadPoints(mode);
  const sorted = Object.entries(data.players)
    .sort((a, b) => b[1].totalPoints - a[1].totalPoints)
    .slice(0, 10);
  return sorted;
}

function getPlayerRank(userId, mode = 'amo') {
  const sorted = getLeaderboard(mode);
  const idx = sorted.findIndex(([id]) => id === userId);
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

module.exports = { getPlayerPoints, addPoints, removePoints, adjustPoints, resetAllPoints, getLeaderboard, loadPoints, getPlayerRank, getRankBadge };
