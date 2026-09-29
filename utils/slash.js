const fs = require('fs');
const path = require('path');
const { Routes } = require('discord.js');

const FILE = path.resolve(__dirname, '..', 'data', 'slash_commands.json');
const CACHE_MS = 15 * 60 * 1000;

// Discord caps a guild at 100 registered commands and returns 429 once the
// per-application hourly "bulk overwrite" budget is spent. Caching the
// registered set keeps the bot from re-registering on every restart and
// burning that budget into a rate limit.
let lastRegisteredAt = 0;
let lastSignature = null;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (d && typeof d === 'object') return d;
  } catch (e) { /* first run */ }
  return { commands: [], guilds: {} };
}

function save(d) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch (e) {
    console.log('[SLASH] could not persist command cache:', e.message);
  }
}

// A stable fingerprint of the command payload. If nothing changed, skip the
// API call entirely.
function signature(commands) {
  return JSON.stringify(commands.map(c => ({
    name: c.name,
    description: c.description,
    options: c.options || []
  })).sort((a, b) => a.name.localeCompare(b.name)));
}

async function registerGlobal(client, commands, { force = false } = {}) {
  const data = load();
  const sig = signature(commands);
  const fresh = Date.now() - lastRegisteredAt < CACHE_MS;

  if (!force && fresh && lastSignature === sig) {
    console.log('[SLASH] commands unchanged, skipping registration');
    return { ok: true, skipped: true };
  }
  if (!force && fresh && data.commands && data.signature === sig) {
    console.log('[SLASH] commands unchanged since last boot, skipping registration');
    lastRegisteredAt = Date.now();
    lastSignature = sig;
    return { ok: true, skipped: true };
  }

  const body = JSON.stringify(commands);
  try {
    const res = await client.rest.put(
      Routes.applicationCommands(client.user.id),
      { body }
    );
    data.commands = res;
    data.signature = sig;
    data.registeredAt = Date.now();
    save(data);
    lastRegisteredAt = Date.now();
    lastSignature = sig;
    console.log(`[SLASH] registered ${res.length} global command(s)`);
    return { ok: true, count: res.length };
  } catch (e) {
    console.log(`[SLASH] global registration failed: ${e.status || ''} ${e.message}`);
    return { ok: false, error: e.message };
  }
}

module.exports = { registerGlobal, load, save, signature, FILE };
