const fs = require('fs');
const path = require('path');
const { Routes } = require('discord.js');

const FILE = path.resolve(__dirname, '..', 'data', 'slash_commands.json');
const CACHE_MS = 15 * 60 * 1000;

let lastRegisteredAt = 0;
let lastSignature = null;

function load() {
  try {
    const d = JSON.parse(fs.readFileSync(FILE, 'utf8'));
    if (d && typeof d === 'object') return d;
  } catch (e) { /* first run */ }
  return { commands: [] };
}

function save(d) {
  try {
    fs.mkdirSync(path.dirname(FILE), { recursive: true });
    fs.writeFileSync(FILE, JSON.stringify(d, null, 2));
  } catch (e) {
    console.log('[SLASH] could not persist command cache:', e.message);
  }
}

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

  if (!force && fresh && (lastSignature === sig || (data.commands && data.signature === sig))) {
    console.log('[SLASH] commands unchanged, skipping registration');
    lastRegisteredAt = Date.now();
    lastSignature = sig;
    return { ok: true, skipped: true };
  }

  try {
    const res = await client.rest.put(
      Routes.applicationCommands(client.user.id),
      { body: JSON.stringify(commands) }
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

// Sends an empty command set, which is how you delete every globally
// registered slash command. Discord keeps showing a command until the
// application explicitly clears it.
async function clearGlobal(client, { force = false } = {}) {
  const data = load();
  if (!force && Array.isArray(data.commands) && data.commands.length === 0) {
    console.log('[SLASH] already cleared, skipping');
    return { ok: true, skipped: true };
  }
  try {
    await client.rest.put(
      Routes.applicationCommands(client.user.id),
      { body: '[]' }
    );
    data.commands = [];
    data.signature = signature([]);
    data.registeredAt = Date.now();
    save(data);
    return { ok: true, cleared: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

module.exports = { registerGlobal, clearGlobal, load, save, signature, FILE };
