const fs = require('fs');
const path = require('path');

const DATA_DIR = path.resolve(__dirname, '..', 'data');
const LOG_FILE = path.join(DATA_DIR, 'maintenance.log.json');
const INCIDENTS_FILE = path.join(DATA_DIR, 'maintenance_incidents.json');
const APPROVALS_FILE = path.join(DATA_DIR, 'maintenance_approvals.json');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');

const SECRET_RE = /((?:token|password|passwd|secret|api[_-]?key|authorization|bearer|client[_-]?secret|connection[_-]?string)\s*[=:]\s*["']?[^\s"',;]+)/gi;
const INCIDENT_WINDOW = 60 * 1000;
const SAME_SNIPPET_THRESHOLD = 3;
const MAX_INCIDENTS = 100;
const MAX_LOG_ENTRIES = 2000;
const DEDUPE_MS = 30 * 1000;

const state = {
  client: null,
  config: null,
  configProvider: () => null,
  adminCheck: () => false,
  healers: {},
  verifiers: {},
  dataDir: DATA_DIR,
  started: false,
  incidents: [],
  approvals: [],
  counters: { totalErrors: 0, byCategory: {} },
  recentSignals: [],
  ws: { disconnected: 0, lastDisconnectAt: 0, readyAt: 0 },
  rateLimitedUntil: 0,
  lastBackupAt: 0,
  lastBackupPath: null,
  processStart: Date.now(),
  suppressionUntil: 0,
  logReadCache: null,
  logReadAt: 0
};

function ensureDir(dir) {
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* ignore */ }
}

function readJson(file, fallback) {
  try {
    if (!fs.existsSync(file)) return fallback;
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    return data;
  } catch (e) {
    return fallback;
  }
}

function writeJson(file, data) {
  try {
    ensureDir(path.dirname(file));
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
    return true;
  } catch (e) {
    return false;
  }
}

function now() { return Date.now(); }
function stamp() { return new Date().toISOString(); }

function redact(text) {
  try {
    return String(text || '').replace(SECRET_RE, (m, k) => {
      const key = (k.split('=')[0] || k.replace(/[:]/, '=').split('=')[0] || 'secret').trim();
      return `${key}=***REDACTED***`;
    });
  } catch (e) {
    return String(text || '');
  }
}

function errToRecord(err) {
  if (err instanceof Error) {
    return { message: err.message || err.name || String(err), stack: err.stack || '' };
  }
  if (typeof err === 'string') return { message: err, stack: '' };
  try { return { message: JSON.stringify(err), stack: '' }; } catch (e) { return { message: String(err), stack: '' }; }
}

function snippetOf(record) {
  const lines = (record.stack || record.message || '').split('\n').filter(l => l && !l.includes('node:'));
  const useful = lines.slice(0, 2).join(' | ');
  return (record.message || '').slice(0, 220) + (useful ? ' :: ' + useful.slice(0, 180) : '');
}

function detectCategory(record) {
  const m = (record.message || '') + ' ' + (record.stack || '');
  const low = m.toLowerCase();
  if (/429\b|rate.?limit/i.test(m)) return 'rate-limit';
  if (/unknown interaction|this interaction failed|interaction has already been deferred/i.test(m)) return 'stale-interaction';
  if (/unknown message/i.test(m)) return 'stale-message';
  if (/unknown (channel|guild|role|user\/|member|webhook)/i.test(m)) return 'stale-reference';
  if (/missing (permissions|access)|forbidden|403/i.test(m)) return 'permissions';
  if (/invalid form body|\[400\]/i.test(m)) return 'api-invalid-body';
  if (/econnreset|eai_again|enetunreach|enotfound|fetch failed|request failed|socket hang up|timeout|took too long to respond/i.test(m)) return 'network';
  if (/jail|blacklist|matchmanager|cheaterreports|settings|store|storage/i.test(record.stack || '')) return 'internal-state';
  if (/disconnect|shard.*(close|resume|ready)/i.test(low)) return 'ws-disconnect';
  if (low.includes('token') && /invalid token/i.test(m)) return 'auth-config';
  return 'unclassified';
}

const DIAGNOSIS = {
  'rate-limit': { problem: 'Discord API rate limit hit (HTTP 429).', cause: 'Too many API calls in a short window.', affectedSystem: 'Discord API / message flow', severity: 'medium', recommendedFix: 'Back off: pause heavy periodic syncs for ~60s and let requests cool down.', risk: 'low', autoFixKey: 'rate-limit-pause' },
  'stale-interaction': { problem: 'A button/menu/modal interaction no longer responds.', cause: 'The component belongs to an old or removed message (bot restart, message deleted, or timeout).', affectedSystem: 'Interactions (buttons/menus/modals)', severity: 'low', recommendedFix: 'Ignore gracefully; consider reposting the info/commands embed so components are fresh.', risk: 'low', autoFixKey: 'repost-commands' },
  'stale-message': { problem: 'Bot tried to edit/delete a message that no longer exists.', cause: 'Message removed or channel purged.', affectedSystem: 'Message flow', severity: 'low', recommendedFix: 'Ignore gracefully; nothing to fix.', risk: 'low' },
  'stale-reference': { problem: 'A referenced channel/role/member no longer exists.', cause: 'Resource deleted or ID outdated.', affectedSystem: 'Channels/Roles', severity: 'medium', recommendedFix: 'Verify IDs; re-ensure known channels.', risk: 'low', autoFixKey: 're-ensure-channels' },
  'permissions': { problem: 'Bot lacks required permissions or access is denied.', cause: 'Role/permission configuration changed for bot.', affectedSystem: 'Permissions system', severity: 'high', recommendedFix: 'Review channel/role permission overwrites and bot role position.', risk: 'medium', needsApproval: true },
  'api-invalid-body': { problem: 'Discord rejected a request payload.', cause: 'Invalid field values (e.g. label>45 chars, embed limits).', affectedSystem: 'Discord API / embeds', severity: 'medium', recommendedFix: 'Validate input before sending; check command parameters.', risk: 'low' },
  'network': { problem: 'Network/connection failure to Discord.', cause: 'Transient network issue or socket timeout.', affectedSystem: 'Gateway / HTTP', severity: 'medium', recommendedFix: 'Retry with exponential backoff; rely on gateway auto-reconnect.', risk: 'low' },
  'ws-disconnect': { problem: 'Gateway/shard disconnected.', cause: 'Network instability or Discord reconnect.', affectedSystem: 'Gateway', severity: 'high', recommendedFix: 'Verify bot reconnected; if not ready soon, request a safe reconnect.', risk: 'high', needsApproval: true, autoFixKey: 'reconnect-bot' },
  'auth-config': { problem: 'Invalid bot token detected.', cause: 'Wrong or expired token in configuration.', affectedSystem: 'Authentication', severity: 'critical', recommendedFix: 'Rotate/update DISCORD_TOKEN (never expose it).', risk: 'high', needsApproval: true },
  'internal-state': { problem: 'Internal state (matches/jails/points/settings) reported an error.', cause: 'Corrupted or inconsistent state file or in-memory data.', affectedSystem: 'Match / state system', severity: 'medium', recommendedFix: 'Validate and repair match state from the last good backup.', risk: 'low', autoFixKey: 'revalidate-matches' },
  'unclassified': { problem: 'Unexpected bot error.', cause: 'Unknown — requires analysis.', affectedSystem: 'Unknown', severity: 'medium', recommendedFix: 'Inspect the maintenance log; do not auto-rewrite code.', risk: 'low' }
};

const FIX_RISK = {
  'repost-commands': 'low',
  're-ensure-channels': 'low',
  'revalidate-matches': 'low',
  'auto-backup': 'low',
  'rate-limit-pause': 'low',
  'reconnect-bot': 'high'
};

function logEntry(entry) {
  try {
    ensureDir(DATA_DIR);
    let arr = [];
    try { arr = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8')); } catch (e) { arr = []; }
    if (!Array.isArray(arr)) arr = [];
    arr.push(entry);
    if (arr.length > MAX_LOG_ENTRIES) arr = arr.slice(-MAX_LOG_ENTRIES);
    fs.writeFileSync(LOG_FILE, JSON.stringify(arr, null, 2));
    state.logReadCache = null;
  } catch (e) { /* maintenance must never crash the bot */ }
}

function readLog() {
  try {
    if (!fs.existsSync(LOG_FILE)) return [];
    const data = JSON.parse(fs.readFileSync(LOG_FILE, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function persistIncidents() {
  const copy = state.incidents.slice(-MAX_INCIDENTS).map(i => ({ ...i }));
  writeJson(INCIDENTS_FILE, copy);
}

function persistApprovals() {
  writeJson(APPROVALS_FILE, state.approvals);
}

function backupNow(explain) {
  try {
    const ts = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = path.join(BACKUP_DIR, ts);
    ensureDir(dest);
    if (!fs.existsSync(DATA_DIR)) return null;
    const files = fs.readdirSync(DATA_DIR).filter(f => !['maintenance.log.json', 'error.log', 'backups'].includes(f));
    let copied = 0;
    for (const f of files) {
      const src = path.join(DATA_DIR, f);
      if (!fs.statSync(src).isFile()) continue;
      fs.copyFileSync(src, path.join(dest, f));
      copied++;
    }
    logEntry({
      ts: stamp(), level: 'info', component: 'maintenance', severity: 'low',
      type: 'backup', problem: 'Scheduled/safety backup.', cause: null, affectedSystem: 'Data files',
      recommendedFix: null, risk: 'low', actionTaken: `Created snapshot with ${copied} file(s)`, result: 'ok', autoFixed: true, needsApproval: false
    });
    state.lastBackupAt = now();
    state.lastBackupPath = dest;
    return dest;
  } catch (e) {
    logEntry({ ts: stamp(), level: 'error', component: 'maintenance', severity: 'medium', type: 'backup', problem: 'Backup failed.', cause: e.message, affectedSystem: 'Data files', recommendedFix: null, risk: 'low', actionTaken: 'Attempted snapshot', result: 'failed', autoFixed: false, needsApproval: false });
    return null;
  }
}

function findApprovalFor(incidentId) {
  return state.approvals.find(a => a.incidentId === incidentId && a.status === 'pending');
}

function createApproval(incident) {
  if (findApprovalFor(incident.id)) return;
  const approval = {
    id: `${now()}_${Math.floor(Math.random() * 1000)}`,
    incidentId: incident.id,
    createdAt: stamp(),
    status: 'pending',
    problem: incident.problem,
    cause: incident.cause,
    affectedSystem: incident.affectedSystem,
    severity: incident.severity,
    recommendedFix: incident.recommendedFix,
    risk: incident.risk,
    actionKey: incident.actionKey,
    requestedBy: incident.source
  };
  state.approvals.push(approval);
  persistApprovals();
  return approval;
}

async function runFix(actionKey, incident, opts = {}) {
  const healer = state.healers[actionKey];
  const risk = opts.risk || FIX_RISK[actionKey] || 'low';
  const needsApproval = opts.needsApproval || incident.needsApproval === true || risk === 'high' || risk === 'critical';
  const verify = state.verifiers[actionKey];

  if (!healer) {
    return { ok: false, needsApproval: true, reason: `No healer registered for "${actionKey}"` };
  }
  if (needsApproval && !opts.approvedBy) {
    const created = createApproval(incident);
    incident.actionTaken = `Waiting for admin approval (${created ? created.id : 'approval queue'}).`;
    incident.needsApproval = true;
    incident.verificationResult = 'Pending human approval — no change applied.';
    return { ok: false, needsApproval: true, approvalId: created ? created.id : null };
  }

  backupNow(`Pre-fix safety snapshot (${actionKey})`);
  incident.actionTaken = `Applying "${actionKey}" fix${opts.approvedBy ? ` (approved by ${opts.approvedBy})` : ''}.`;
  let result;
  try {
    result = await healer(incident);
  } catch (e) {
    result = { ok: false, result: e.message };
  }

  let verified = 'Verification failed (no verifier).';
  if (verify) {
    try {
      const v = await verify(result);
      verified = v === true ? 'Automated check passed.' : (typeof v === 'string' ? v : 'Automated check failed.');
    } catch (e) {
      verified = 'Automated check errored: ' + e.message;
    }
  }
  incident.verificationResult = verified;
  incident.resultOk = !!result.ok;
  incident.actionResult = result.result || null;

  logEntry({
    ts: stamp(), level: result.ok ? 'info' : 'error', component: 'maintenance', severity: incident.severity,
    type: 'fix', problem: incident.problem, cause: incident.cause, affectedSystem: incident.affectedSystem,
    recommendedFix: incident.recommendedFix, risk, actionTaken: incident.actionTaken,
    result: result.ok ? 'fixed' : 'failed', verification: verified, autoFixed: !needsApproval,
    needsApproval, approvedBy: opts.approvedBy || null
  });
  return { ok: result.ok, needsApproval: false, verification: verified };
}

function dedupeKeyFor(record) {
  const cat = detectCategory(record);
  const msg = (redact(record.message) || '').slice(0, 120);
  return `${cat}::${msg}`;
}

function record(type, rawErr, ctx) {
  try {
    const recordData = errToRecord(rawErr);
    const message = redact(recordData.message);
    const stack = redact(recordData.stack);
    const category = detectCategory({ message, stack });
    const key = dedupeKeyFor({ message, stack });

    const recent = state.incidents.filter(i => i.ts >= now() - INCIDENT_WINDOW && i.key === key);
    if (recent.length) {
      recent.forEach(i => { i.count = (i.count || 1) + 1; });
      persistIncidents();
      return recent[recent.length - 1];
    }
    if (state.incidents.some(i => i.key === key && now() - i.ts < DEDUPE_MS)) {
      const found = state.incidents.filter(i => i.key === key && now() - i.ts < DEDUPE_MS).pop();
      found.count = (found.count || 1) + 1;
      persistIncidents();
      return found;
    }

    const diag = Object.assign({}, DIAGNOSIS[category] || DIAGNOSIS.unclassified);

    const incident = {
      id: `${now()}_${state.counters.totalErrors}_${Math.floor(Math.random() * 1e4)}`,
      ts: now(), key, category, type,
      problem: diag.problem,
      cause: diag.cause,
      affectedSystem: diag.affectedSystem,
      severity: diag.severity,
      recommendedFix: diag.recommendedFix,
      risk: diag.risk,
      actionKey: diag.autoFixKey || null,
      needsApproval: diag.needsApproval === true,
      actionTaken: null,
      actionResult: null,
      verificationResult: null,
      resultOk: null,
      count: 1,
      snippet: snippetOf({ message, stack }),
      stack: stack.split('\n').slice(0, 6).join('\n'),
      source: ctx && ctx.source ? ctx.source : (type || 'unknown')
    };

    state.counters.totalErrors++;
    state.counters.byCategory[category] = (state.counters.byCategory[category] || 0) + 1;
    state.incidents.push(incident);
    persistIncidents();

    const autoFixed = !incident.needsApproval && incident.actionKey;
    if (autoFixed) {
      runFix(incident.actionKey, incident, { risk: incident.risk }).catch(() => {});
    } else if (incident.needsApproval) {
      createApproval(incident);
      incident.actionTaken = 'High-risk issue — approval requested.';
    }

    logEntry({
      ts: stamp(), level: diag.severity === 'critical' ? 'critical' : diag.severity === 'high' ? 'error' : 'warn',
      component: 'maintenance', severity: incident.severity, type: 'detected',
      problem: incident.problem, cause: incident.cause, affectedSystem: incident.affectedSystem,
      recommendedFix: incident.recommendedFix, risk: incident.risk, actionTaken: incident.actionTaken,
      result: autoFixed ? 'auto-fix attempted' : incident.needsApproval ? 'pending approval' : 'logged',
      autoFixed, needsApproval: incident.needsApproval
    });

    return incident;
  } catch (e) {
    try { console.log('[MAINT] record error:', e.message); } catch (e2) { /* ignore */ }
    return null;
  }
}

function recordEvent(name, data) {
  try {
    if (name === 'wsDisconnect') {
      state.ws.disconnected++;
      state.ws.lastDisconnectAt = now();
    } else if (name === 'wsReady') {
      state.ws.disconnected = 0;
      state.ws.readyAt = now();
    }
  } catch (e) { /* ignore */ }
}

async function sweep() {
  const diag = [];
  try {
    if (state.client && state.client.isReady && !state.client.isReady()) {
      diag.push({ key: 'ws-not-ready', severity: 'high' });
    }

    const repeated = state.incidents
      .filter(i => now() - i.ts <= 2 * INCIDENT_WINDOW && (i.count || 1) >= SAME_SNIPPET_THRESHOLD && !i.actionKey)
      .slice(0, 5);
    for (const r of repeated) {
      diag.push({ key: 'repeated-error', severity: 'medium', incident: r });
    }

    if (!state.lastBackupAt || now() - state.lastBackupAt > 24 * 3600 * 1000) {
      backupNow('Routine daily safety snapshot');
    }

    const mem = process.memoryUsage();
    const heapRatio = mem.heapUsed / Math.max(1, mem.heapTotal);
    if (heapRatio > 0.85 || mem.heapUsed > 400 * 1024 * 1024) {
      handleSweepDiagnosis({
        id: `mem_${now()}`, ts: now(), category: 'resources', problem: 'High memory usage detected.',
        cause: `heapUsed=${Math.round(mem.heapUsed / 1024 / 1024)}MB / heapTotal=${Math.round(mem.heapTotal / 1024 / 1024)}MB`,
        affectedSystem: 'Runtime', severity: 'high', recommendedFix: 'Schedule a safe restart during low activity.',
        risk: 'high', actionKey: null, needsApproval: true, source: 'sweep'
      });
    }

    if (state.rateLimitedUntil > now()) {
      diag.push({ key: 'rate-limit-cooldown', severity: 'low', until: state.rateLimitedUntil - now() });
    }

    for (const d of diag.slice(0, 5)) {
      if ((d.incident || {}).actionKey) {
        runFix(d.incident.actionKey, d.incident, { risk: d.incident.risk }).catch(() => {});
      }
    }
  } catch (e) {
    console.log('[MAINT] sweep error:', e.message);
  }
}

async function handleSweepDiagnosis(incident) {
  try {
    state.incidents.push(incident);
    persistIncidents();
    if (incident.needsApproval) createApproval(incident);
    logEntry({
      ts: stamp(), level: 'warn', component: 'maintenance', severity: incident.severity, type: 'sweep',
      problem: incident.problem, cause: incident.cause, affectedSystem: incident.affectedSystem,
      recommendedFix: incident.recommendedFix, risk: incident.risk,
      actionTaken: incident.needsApproval ? 'Approval requested.' : 'Logged.',
      result: 'monitored', autoFixed: false, needsApproval: !!incident.needsApproval
    });
  } catch (e) { /* ignore */ }
}

function approvalsList() {
  return state.approvals.filter(a => a.status === 'pending');
}

async function approve(id, by) {
  const approval = state.approvals.find(a => a.id === id && a.status === 'pending');
  if (!approval) return { ok: false, reason: 'No pending approval with that ID.' };
  const incident = state.incidents.find(i => i.id === approval.incidentId) || { id: approval.incidentId, ...approval };
  const res = await runFix(approval.actionKey, incident, { approvedBy: by, risk: approval.risk, needsApproval: false });
  approval.status = res.ok ? 'approved' : 'failed';
  approval.resolvedAt = stamp();
  approval.result = res.verification || null;
  persistApprovals();
  return { ok: res.ok, verification: res.verification || 'n/a' };
}

async function reject(id, by) {
  const approval = state.approvals.find(a => a.id === id && a.status === 'pending');
  if (!approval) return { ok: false, reason: 'No pending approval with that ID.' };
  approval.status = 'rejected';
  approval.resolvedAt = stamp();
  approval.by = by;
  persistApprovals();
  logEntry({ ts: stamp(), level: 'info', component: 'maintenance', severity: 'medium', type: 'approval', problem: approval.problem, cause: 'Rejected by admin.', affectedSystem: approval.affectedSystem, recommendedFix: approval.recommendedFix, risk: approval.risk, actionTaken: `Approval ${id} rejected by ${by}.`, result: 'rejected', autoFixed: false, needsApproval: true });
  return { ok: true };
}

async function fixIncident(id, by) {
  const incident = state.incidents.find(i => i.id === id);
  if (!incident) return { ok: false, reason: 'No incident with that ID.' };
  if (!incident.actionKey) {
    createApproval(Object.assign({}, incident, { actionKey: 'manual' }));
    return { ok: false, reason: 'No safe auto-fix defined for this incident; logged for review. Use the maintenance log.' };
  }
  const risk = FIX_RISK[incident.actionKey] || incident.risk || 'low';
  const res = await runFix(incident.actionKey, incident, { risk, approvedBy: by });
  return res;
}

function start(opts) {
  Object.assign(state, opts);
  state.processStart = Date.now();
  if (state.started) return state;
  state.started = true;

  state.incidents = readJson(INCIDENTS_FILE, []).filter(i => i && i.ts > now() - 6 * 3600 * 1000).slice(-MAX_INCIDENTS);
  if (!Array.isArray(state.incidents)) state.incidents = [];
  state.approvals = readJson(APPROVALS_FILE, []).filter(a => a && a.status === 'pending');
  if (!Array.isArray(state.approvals)) state.approvals = [];

  const sweepInterval = setInterval(() => { sweep().catch(() => {}); }, 45000);
  if (sweepInterval.unref) sweepInterval.unref();

  logEntry({ ts: stamp(), level: 'info', component: 'maintenance', severity: 'low', type: 'startup', problem: null, cause: null, affectedSystem: 'maintenance', recommendedFix: null, risk: 'low', actionTaken: 'Maintenance assistant started.', result: 'ok', autoFixed: false, needsApproval: false });
  return state;
}

function getStatus() {
  const bySeverity = {};
  for (const i of state.incidents) {
    bySeverity[i.severity] = (bySeverity[i.severity] || 0) + 1;
  }
  return {
    uptimeMs: now() - state.processStart,
    totalErrors: state.counters.totalErrors,
    byCategory: state.counters.byCategory,
    bySeverity,
    incidents: state.incidents.slice(-10).reverse(),
    pendingApprovals: approvalsList(),
    ws: state.ws,
    rateLimitedUntil: state.rateLimitedUntil,
    rateLimitCooling: state.rateLimitedUntil > now(),
    lastBackupAt: state.lastBackupAt,
    lastBackupPath: state.lastBackupPath
  };
}

function getLog(n) {
  const arr = readLog();
  return arr.slice(-(n || 20)).reverse();
}

function suppressUntil() { return state.suppressionUntil; }
function setSuppression(ms) { state.suppressionUntil = now() + ms; }

module.exports = {
  init: start,
  start,
  record,
  recordEvent,
  backupNow,
  getStatus,
  getLog,
  approvalsList,
  approve,
  reject,
  fixIncident,
  suppressUntil,
  setSuppression,
  runFix,
  _redact: redact,
  _state: state
};