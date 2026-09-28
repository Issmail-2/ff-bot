const fs = require('fs');
const path = require('path');

const FILE = path.resolve(__dirname, '..', 'data', 'joins.json');
// Invite use counts only tell us that an invite's counter went up. Without a
// record of who has joined before, anyone could leave, rejoin through their own
// invite and collect the invite bonus again — indefinitely. This file makes
// each account earn the bonus at most once.
const MIN_ACCOUNT_AGE_DAYS = parseInt(process.env.INVITE_MIN_ACCOUNT_DAYS || '', 10) || 7;
const INVITE_FETCH_TTL_MS = parseInt(process.env.INVITE_FETCH_TTL_MS || '', 10) || 30000;

let cache = null;
let cacheLoadedAt = 0;

function ensureFile() {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(FILE)) fs.writeFileSync(FILE, JSON.stringify({ joined: {} }));
}

function load() {
  ensureFile();
  if (cache) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    cache = null;
  }
  if (!cache || typeof cache !== 'object') cache = { joined: {} };
  if (!cache.joined || typeof cache.joined !== 'object') cache.joined = {};
  cacheLoadedAt = Date.now();
  return cache;
}

function save() {
  ensureFile();
  try {
    fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  } catch (e) {
    console.log('[INVITES] could not persist join record:', e.message);
  }
}

function accountAgeDays(user) {
  if (!user || !user.createdTimestamp) return null;
  return (Date.now() - user.createdTimestamp) / 86400000;
}

function isEligible(user) {
  const age = accountAgeDays(user);
  if (age === null) return { ok: false, reason: 'unknown account age' };
  if (age < MIN_ACCOUNT_AGE_DAYS) {
    return { ok: false, reason: `account is only ${age.toFixed(1)} day(s) old (needs ${MIN_ACCOUNT_AGE_DAYS})` };
  }
  return { ok: true, age };
}

function hasJoinedBefore(userId) {
  const data = load();
  return !!data.joined[userId];
}

function recordJoin(userId) {
  const data = load();
  if (data.joined[userId]) return false;
  data.joined[userId] = Date.now();
  save();
  return true;
}

function fetchAllowed() {
  return Date.now() - cacheLoadedAt > INVITE_FETCH_TTL_MS;
}

function markFetched() {
  cacheLoadedAt = Date.now();
}

function reset() {
  cache = null;
  cacheLoadedAt = 0;
}

module.exports = {
  hasJoinedBefore,
  recordJoin,
  isEligible,
  fetchAllowed,
  markFetched,
  reset,
  MIN_ACCOUNT_AGE_DAYS
};
