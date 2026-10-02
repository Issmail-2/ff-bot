const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
let config;
try { config = require('./config.json'); } catch { config = {}; }
if (process.env.DISCORD_TOKEN) config.token = process.env.DISCORD_TOKEN;
if (process.env.SUPERVISOR_ROLE_ID) config.supervisorRoleId = process.env.SUPERVISOR_ROLE_ID;
if (!config.modes) config.modes = {};
if (!config.modes.amo) config.modes.amo = { name:'amo', displayName:'amo-no', command:'!play', matchChannelId: process.env.AMO_CHANNEL_ID||'1545315593450954762', ammoChannelId: process.env.AMMO_CHANNEL_ID||'1547567219167199352', voiceCategoryId: process.env.AMO_VOICE_CATEGORY||'1545316338145165332', logsCategoryId: process.env.AMO_LOGS_CATEGORY||'1545364636034138112', pointsFile:'./data/points.json' };
if (!config.modes.esport) config.modes.esport = { name:'esport', displayName:'e-sport', command:'!esport', matchChannelId: process.env.ESPORT_CHANNEL_ID||'1545388379309482037', voiceCategoryId: process.env.ESPORT_VOICE_CATEGORY||'1545386731686076476', logsCategoryId: process.env.ESPORT_LOGS_CATEGORY||'1545386732982374433', pointsFile:'./data/points_esport.json' };
// "PvP Yes" is a second custom-room queue, hosted in the second apostado channel.
// It shares the amo point file but keeps its own lobby channel, and it is the
// mode that asks which lobby style to use.
if (!config.modes.ammo) config.modes.ammo = { name:'ammo', displayName:'amo-yes', command:'!playyes', matchChannelId: (config.modes.amo && config.modes.amo.matchChannelId) || process.env.AMO_CHANNEL_ID || '1545315593450954762', voiceCategoryId: config.modes.amo ? config.modes.amo.voiceCategoryId : undefined, logsCategoryId: config.modes.amo ? config.modes.amo.logsCategoryId : undefined, pointsFile:'./data/points.json', requiresStyle:true };
if (!config.matchPoints) config.matchPoints = { winner: 80, loser: 30 };

// amo-no is only playable in its own channel. This is applied after the defaults
// above (and after amo-yes has already copied its channel from amo) so that a
// config.json on disk, or an AMO_CHANNEL_ID env var, cannot quietly point amo-no
// somewhere else. The channel check in the picker reads matchChannelId, so this
// is the single place the rule lives.
const AMO_NO_CHANNEL_ID = process.env.AMO_NO_CHANNEL_ID || '1547567219167199352';
if (config.modes.amo) {
  config.modes.amo.matchChannelId = AMO_NO_CHANNEL_ID;
  config.modes.amo.ammoChannelId = AMO_NO_CHANNEL_ID;
}

if (!config.emojis) config.emojis = { game:'<:Free_fire_logo:1466528905509736705>', team1:'<a:aHYPR_GREENDOTid:1545351146770796634>', team2:'<a:aredptid:1545350890989428829>' };

// The configured emoji values are sometimes bare shortcodes rather than full
// markup, which Discord renders as literal text. normalizeEmoji() now lives in
// utils/ui so every module shares one definition of the sticker set.
const { normalizeEmoji } = require('./utils/ui');
for (const k of ['game', 'team1', 'team2']) {
  config.emojis[k] = normalizeEmoji(config.emojis[k], k);
}
if (!config.pointsFile) config.pointsFile = './data/points.json';
if (!config.logsCategoryId) config.logsCategoryId = config.modes.amo.logsCategoryId;
if (!config.logsChannelId) config.logsChannelId = process.env.LOGS_CHANNEL_ID || '1545366915180924938';
if (!config.infoChannelId) config.infoChannelId = process.env.INFO_CHANNEL_ID || '1545379695363620874';
if (!config.storeChannelId) config.storeChannelId = process.env.STORE_CHANNEL_ID || '';
if (!config.ticketCategoryId) config.ticketCategoryId = process.env.TICKET_CATEGORY_ID || '';
if (!config.rankOneRoleId) config.rankOneRoleId = process.env.RANK_ONE_ROLE_ID || '';
if (!config.setResultRoles) {
  config.setResultRoles = process.env.SET_RESULT_ROLE_IDS ? process.env.SET_RESULT_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460', '1537318639395545139', '1506540916519731310', '1466082863115145441', '1450458684428783616', '1546807156970487838', '1459133371874807921'];
}
if (!config.matchViewerRoles) {
  config.matchViewerRoles = process.env.MATCH_VIEWER_ROLE_IDS ? process.env.MATCH_VIEWER_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1466082863115145441'];
}
if (!config.inviteBonus) config.inviteBonus = parseInt(process.env.INVITE_BONUS_POINTS) || 10;
if (!config.voiceCategoryId) config.voiceCategoryId = config.modes.amo.voiceCategoryId;
if (!config.requiredVoiceChannels) {
  config.requiredVoiceChannels = [
    process.env.REQUIRED_VOICE_CHANNEL_1 || '1423528602418286595',
    process.env.REQUIRED_VOICE_CHANNEL_2 || '1450206308367073291',
    process.env.REQUIRED_VOICE_CHANNEL_3 || '1495304938631204945',
    process.env.REQUIRED_VOICE_CHANNEL_4 || '1456313452262985758',
    process.env.REQUIRED_VOICE_CHANNEL_5 || '1495304629322518635',
    process.env.REQUIRED_VOICE_CHANNEL_6 || '1456312655412465943'
  ];
}
if (!config.pointsRoles) {
  config.pointsRoles = process.env.POINTS_ROLE_IDS ? process.env.POINTS_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460'];
}
if (!config.pointsUsers) {
  config.pointsUsers = process.env.POINTS_USER_IDS ? process.env.POINTS_USER_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1177600499298599035'];
}
if (!config.adminRoles) {
  config.adminRoles = process.env.ADMIN_ROLE_IDS ? process.env.ADMIN_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460', '1537318639395545139', '1506540916519731310'];
}
// Roles that bypass match restrictions (voice exemptions, match pings, staff pings).
// Historically these were force-overwritten from this one hardcoded array, which made
// them impossible to configure via env vars or config.json. They are now resolved as
// ENV > config.json > this default, so behaviour is unchanged unless you opt in.
const DEFAULT_MATCH_STAFF_ROLES = ['1548338723593392198', '1537318639395545139', '1506540916519731310', '1546807156970487838', '1547776062400888912', '1548350425462210570', '1549201615850971216', '1548350896428158976', '1466082863115145441'];

if (!Array.isArray(config.voiceExemptRoles) || config.voiceExemptRoles.length === 0) {
  config.voiceExemptRoles = process.env.VOICE_EXEMPT_ROLE_IDS
    ? process.env.VOICE_EXEMPT_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_MATCH_STAFF_ROLES;
}
if (!Array.isArray(config.matchPingRoles) || config.matchPingRoles.length === 0) {
  config.matchPingRoles = process.env.MATCH_PING_ROLE_IDS
    ? process.env.MATCH_PING_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_MATCH_STAFF_ROLES;
}
if (!Array.isArray(config.staffRoles) || config.staffRoles.length === 0) {
  config.staffRoles = process.env.STAFF_ROLE_IDS
    ? process.env.STAFF_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean)
    : DEFAULT_MATCH_STAFF_ROLES;
}
if (!config.matchRewards) {
  config.matchRewards = { winnerMvp: 80, winner: 50, loserMvp: 30, loser: 10 };
}
if (!config.jailRoleId) config.jailRoleId = process.env.JAIL_ROLE_ID || '1540120101792129145';
if (!config.jailRoles) {
  config.jailRoles = process.env.JAIL_ROLE_IDS ? process.env.JAIL_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460', '1537318639395545139', '1506540916519731310'];
}
if (!config.jailUsers) {
  config.jailUsers = process.env.JAIL_USER_IDS ? process.env.JAIL_USER_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1177600499298599035'];
}
const REWARDS = config.matchRewards;
const storage = require('./utils/storage');
const manager = require('./utils/matchManager');
const blacklistModule = require('./utils/blacklist');
const jailModule = require('./utils/jail');
const storeModule = require('./utils/store');
const settingsStore = require('./utils/settings');
const backfillBanner = require('./utils/backfillBanner');
const cheaterReports = require('./utils/cheaterReports');
const { COLORS, BRANDING, STICKERS, progressBar, slotStrip, divider, withThumbnail, withBanner, fetchMessage, note } = require('./utils/ui');
const maintenance = require('./utils/maintenance');
const inviteTracker = require('./utils/invites');
const slash = require('./utils/slash');
const playFlow = require('./utils/playFlow');
const tournament = require('./utils/tournament');
const tourUI = require('./utils/tournamentUI');
const { buildGuideMessage } = require('./utils/tournamentGuide');

const EXPOSE_CATEGORY_ID = process.env.EXPOSE_CATEGORY_ID || '1539831526470979646';
const CHEATER_ROLE_ID = process.env.CHEATER_ROLE_ID || '1540120101792129145';
const REPORT_CHANNEL_ID = process.env.REPORT_CHANNEL_ID || '1546846855676043264';
const CHECK_CHANNEL_ID = process.env.CHECK_CHANNEL_ID || '1546846854556286976';
const EXPOSE_CHANNEL_ID = process.env.EXPOSE_CHANNEL_ID || '1518059555622228038';
const APPLY_CATEGORY_ID = process.env.APPLY_CATEGORY_ID || '1476278897107538023';
const APPLY_QUEUE_CHANNEL_ID = process.env.APPLY_QUEUE_CHANNEL_ID || '1450844020853968896';
// The one channel a tournament is hosted in. The sign-up post and the bracket
// both live here, so a tournament always has one predictable home.
const TOURNAMENT_CHANNEL_ID = process.env.TOURNAMENT_CHANNEL_ID || config.tournamentChannelId || '1555488260376105060';

// The two roles that run tournaments. Deliberately NOT config.adminRoles: this is
// a much smaller, separate list, so giving someone the tournament does not also
// hand them !clear, !setpoints and the rest of the admin surface.
const TOURNAMENT_ADMIN_ROLE_IDS = [
  '1476325270326608083',
  '1548338723593392198'
];

// Tournament control is its own permission check, separate from hasCommandAccess.
// canSetResult is deliberately not used either: that list includes the result
// roles, and being able to settle a normal match is not the same authority as
// running a tournament.
function canManageTournament(member) {
  if (!member) return false;
  if (member.permissions && member.permissions.has('Administrator')) return true;
  return TOURNAMENT_ADMIN_ROLE_IDS.some(id => member.roles && member.roles.cache.has(id));
}
const REPORT_COST = parseInt(process.env.REPORT_COST || '', 10) || 50;
const REPORT_REWARD = parseInt(process.env.REPORT_REWARD || '', 10) || 100;

const CHANNEL_NAMES = {
  exposeCategory: '🛡️ REPORT CENTER',
  reportChannel: '🚨 𝐑𝐄𝐏𝐎𝐑𝐓 𝐀 𝐏𝐋𝐀𝐘𝐄𝐑',
  checkChannel: '🕵️ 𝐂𝐇𝐄𝐀𝐓𝐄𝐑-𝐂𝐇𝐄𝐂𝐊',
  exposeChannel: '📢 𝐂𝐇𝐄𝐀𝐓𝐄𝐑 𝐄𝐗𝐏𝐎𝐒𝐄𝐃',
  applyCategory: '📋 ROLE APPLICATION',
  applyChannel: '📝 𝐀𝐏𝐏𝐋𝐘 𝐅𝐎𝐑 𝐑𝐎𝐋𝐄',
  queueChannel: '🔒 𝐀𝐏𝐏𝐋𝐈𝐂𝐀𝐍𝐓 𝐐𝐔𝐄𝐔𝐄',
  vcWaiting: '⏳ 𝐖𝐀𝐈𝐓𝐈𝐍𝐆',
  vcChecker: '🛡️ 𝐂𝐇𝐄𝐂𝐊𝐄𝐑',
  vcStaff: '👥 𝐒𝐓𝐀𝐅𝐅'
};

const JAIL_CHANNEL_IDS = (process.env.JAIL_CHANNEL_IDS || '1540241726478753842,1545272411144982608').split(',').map(s => s.trim()).filter(Boolean);

async function renameIfDifferent(channel, name) {
  if (channel && channel.name !== name) {
    try { await channel.setName(name); } catch (e) { console.log(`[CH] rename "${channel.name}" -> "${name}" failed:`, e.message); }
  }
  return channel;
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

client.on(Events.Error, (e) => {
  maintenance.record('discordApi', e, { source: 'client-error' });
});
client.on('warn', (w) => {
  maintenance.record('warning', w, { source: 'client-warn' });
});
client.on(Events.RateLimited, (r) => {
  maintenance.record('rateLimit', new Error(`Rate limited: ${r.timeout}ms (${r.method} ${r.route})`), { source: 'rate-limited' });
  maintenance.setSuppression(Math.min(r.timeout + 5000, 120000));
});
client.on(Events.ShardDisconnect, (ev, shardId) => {
  maintenance.record('wsDisconnect', new Error(`Shard ${shardId} disconnected`), { source: 'shard-disconnect' });
  maintenance.recordEvent('wsDisconnect');
});
client.on(Events.ShardReady, (shardId) => {
  maintenance.recordEvent('wsReady');
  console.log(`[MAINT] shard ${shardId} ready`);
});
client.on(Events.ShardResume, (shardId, replayed) => {
  maintenance.recordEvent('wsReady');
  console.log(`[MAINT] shard ${shardId} resumed (${replayed} events replayed)`);
});

const WINNER_POINTS = config.matchPoints.winner;
const LOSER_POINTS = config.matchPoints.loser;

const SERVER_ID = '1423528601701187717';

function errLog(...args) {
  let msg;
  try {
    msg = args.map(a => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack || ''}`;
      if (typeof a === 'string') return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    }).join(' | ');
  } catch {
    msg = String(args);
  }
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.error(line);
  try {
    const fs = require('fs');
    const path = require('path');
    const dir = path.join(__dirname, 'data');
    fs.mkdirSync(dir, { recursive: true });
    const logPath = path.join(dir, 'error.log');
    // error.log is appended to on every uncaught error and each entry carries a
    // stack trace, so on a noisy bot it grew until the disk filled. Rotate it
    // once it gets large and keep exactly one previous copy.
    try {
      if (fs.existsSync(logPath) && fs.statSync(logPath).size > 2 * 1024 * 1024) {
        fs.renameSync(logPath, logPath + '.1');
      }
    } catch (e) { /* ignore */ }
    fs.appendFileSync(logPath, line + '\n');
  } catch { /* ignore */ }
  try {
    maintenance.record('internal', new Error(msg.slice(0, 1800)), { source: 'errlog' });
  } catch { /* ignore */ }
}

process.on('uncaughtException', (e) => {
  errLog('UNCAUGHT EXCEPTION', e);
});
process.on('unhandledRejection', (r) => {
  errLog('UNHANDLED REJECTION', r && (r.stack || r) || r);
});

function getModeByChannel(channelId) {
  if (config.modes.esport && config.modes.esport.matchChannelId === channelId) return 'esport';
  if (config.modes.amo && config.modes.amo.matchChannelId === channelId) return 'amo';
if (config.modes.ammo && config.modes.ammo.matchChannelId === channelId) return 'ammo';
  return 'amo';
}

function getModeConfig(mode) {
  return config.modes[mode] || config.modes.amo;
}

// Which modes may be hosted from this channel.
//
// Every mode is pinned to its own channel, so a channel that is not a match
// channel for any mode hosts none, and a channel that matches one hosts exactly
// that one. The picker is built from this list so a mode that the channel does
// not allow is never offered in the first place.
function modesAllowedInChannel(channelId) {
  const all = playFlow.MODES.map(m => m.value);
  const allowed = all.filter(v => {
    const ch = getModeConfig(v).matchChannelId;
    return !ch || ch === channelId;
  });
  // Every mode is pinned to a channel, so a channel can legitimately host none of
  // them -- a lobby voice channel, for instance. Falling back to the full list
  // there would offer modes that the size-step gate then refuses, which is the
  // dead end this function exists to prevent. So the command-level check decides:
  // the picker is only ever built in a channel where at least one mode is valid.
  return allowed;
}

function isInRequiredVoice(member) {
  if (!member || !member.voice) return false;
  return config.requiredVoiceChannels.includes(member.voice.channelId);
}

function voiceCheckMessage() {
  const list = config.requiredVoiceChannels.map(id => `<#${id}>`).join(', ');
  return `❌ To host or join a match you must be inside one of the lobby voice channels: ${list}`;
}

function canAddPoints(member) {
  if (hasCommandAccess(member)) return true;
  if (config.pointsRoles.some(id => id && member.roles.cache.has(id))) return true;
  if (config.pointsUsers.includes(member.id)) return true;
  return false;
}

function hasCommandAccess(member) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  if (config.adminRoles.some(id => id && member.roles.cache.has(id))) return true;
  return false;
}

function canUseJail(member) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  if (config.jailRoles.some(id => id && member.roles.cache.has(id))) return true;
  if (config.jailUsers.includes(member.id)) return true;
  return false;
}

function canSetResult(member) {
  if (!member) return false;
  return config.setResultRoles.some(id => id && member.roles.cache.has(id));
}

async function getOrCreateJailRole(guild) {
  const role = guild.roles.cache.get(config.jailRoleId) || guild.roles.cache.find(r => r.name === 'Jailed');
  if (role) return role;
  return await guild.roles.create({ name: 'Jailed', reason: 'Jail system' });
}

async function getOrCreateJailChannels(guild) {
  const pinIds = JAIL_CHANNEL_IDS.map(id => guild.channels.cache.get(id)).filter(Boolean);
  let text = pinIds.find(c => c.type === ChannelType.GuildText);
  let voice = pinIds.find(c => c.type === ChannelType.GuildVoice);
  const remaining = pinIds.filter(c => c !== text && c !== voice);

  if (!text && remaining.length) text = remaining.shift();
  if (text && text.type !== ChannelType.GuildText) text = null;
  if (!voice && remaining.length) voice = remaining.shift();
  if (voice && voice.type !== ChannelType.GuildVoice) voice = null;

  if (text) config.jailTextChannelId = text.id;
  if (voice) config.jailVoiceChannelId = voice.id;

  if (text && voice) return { category: null, text, voice };

  let category = guild.channels.cache.get(config.jailCategoryId) || guild.channels.cache.find(c => c.name === '⛓️ Jail' && c.type === ChannelType.GuildCategory);
  if (!category && (!text || !voice)) {
    category = await guild.channels.create({
      name: '⛓️ Jail',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }]
    });
    config.jailCategoryId = category.id;
  }
  if (!text) text = (category ? category.children.cache.find(c => c.type === ChannelType.GuildText) : null)
    || (config.jailTextChannelId ? guild.channels.cache.get(config.jailTextChannelId) : null)
    || (category ? category.children.cache.first(c => c.type === ChannelType.GuildText) : null);
  if (!text) {
    text = await guild.channels.create({ name: '🚪│jail', type: ChannelType.GuildText, parent: category ? category.id : undefined });
    config.jailTextChannelId = text.id;
  }
  if (!voice) voice = (category ? category.children.cache.find(c => c.type === ChannelType.GuildVoice) : null)
    || (config.jailVoiceChannelId ? guild.channels.cache.get(config.jailVoiceChannelId) : null)
    || (category ? category.children.cache.first(c => c.type === ChannelType.GuildVoice) : null);
  if (!voice) {
    voice = await guild.channels.create({ name: '🔇│jail', type: ChannelType.GuildVoice, parent: category ? category.id : undefined });
    config.jailVoiceChannelId = voice.id;
  }
  return { category: category || null, text, voice };
}

async function applyJail(guild, member) {
  const role = await getOrCreateJailRole(guild);
  const jail = await getOrCreateJailChannels(guild);

  try { await role.setPermissions([]); } catch (e) { console.log('[JAIL] role perms:', e.message); }

  if (jail.category) {
    await jail.category.permissionOverwrites.create(role.id, { allow: [PermissionsBitField.Flags.ViewChannel] }).catch(e => note('perms', e));
  }
  const jailChannelIds = new Set([...JAIL_CHANNEL_IDS, jail.text.id, jail.voice.id].filter(Boolean));
  for (const ch of [jail.text, jail.voice]) {
    if (!ch) continue;
    if (ch.type === ChannelType.GuildText) {
      await ch.permissionOverwrites.create(role.id, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(e => note('perms', e));
    } else {
      await ch.permissionOverwrites.create(role.id, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
      }).catch(e => note('perms', e));
    }
  }

  const affected = [];
  for (const channel of guild.channels.cache.values()) {
    if (channel.type === ChannelType.GuildCategory) continue;
    if (jailChannelIds.has(channel.id)) continue;
    if (!channel.permissionOverwrites) continue;
    await channel.permissionOverwrites.create(role.id, { deny: [PermissionsBitField.Flags.ViewChannel] })
      .then(() => affected.push(channel.id))
      .catch(e => note('perms', e));
    await new Promise(r => setTimeout(r, 350));
  }

  try { await member.roles.add(role); } catch (e) { console.log('[JAIL] add role:', e.message); }

  const removedRoles = [];
  const myHighest = guild.members.me ? guild.members.me.roles.highest : null;
  for (const r of member.roles.cache.values()) {
    if (r.id === role.id) continue;
    if (r.tags) continue;
    if (myHighest && myHighest.position <= r.position) continue;
    try {
      await member.roles.remove(r.id);
      removedRoles.push(r.id);
      await new Promise(res => setTimeout(res, 250));
    } catch (e) { console.log('[JAIL] remove role ' + r.id + ':', e.message); }
  }
  if (removedRoles.length) console.log(`[JAIL] removed ${removedRoles.length} role(s) from ${member.id}`);

  return { role, affected, removedRoles };
}

async function unjailMember(guild, member, role, affected, removedRoles) {
  if (member && role) await member.roles.remove(role).catch(e => note('role', e));
  if (member && removedRoles) {
    for (const rid of removedRoles) {
      const r = guild.roles.cache.get(rid);
      if (!r) continue;
      await member.roles.add(r.id).catch(e => note('role', e));
    }
  };
  if (role) {
    for (const cid of (affected || [])) {
      const ch = guild.channels.cache.get(cid);
      if (ch && ch.permissionOverwrites) {
        await ch.permissionOverwrites.delete(role.id).catch(e => note('perms', e));
      }
    }
  }
}

const COMMANDS_INFO = `🎮 **HOW TO PLAY — FREE FIRE MATCHES**
━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Join a **lobby voice channel**.
2️⃣ Type \`!play\` in the matches channel, then pick your mode and team size from the menus.
3️⃣ Click **🏠 Room Config** and enter the Room ID / Password (numbers only).
4️⃣ Players join **Team 1 / Team 2** — if the host set a join key you'll be asked for it. Once both teams are full the roster **locks**.
5️⃣ A **result box** appears — the 2 team captains vote the **MVP** for the winning and losing side.
6️⃣ Points are awarded automatically: Winner **+50**, Winner MVP **+80**, Loser **+10**, Loser MVP **+30**.
7️⃣ Want to cancel a full match? The **host** or a **staff member** can press **❌ Cancel Match (Host)** to cancel it. Lost the buttons? Type \`!cancelmatch\`.
8️⃣ Track your rank with the **Rank #** nicknames or \`!leaderboard\`.

👑 **RANK #1 PRIZE — AUTO ROLE**
The **#1 ranked player** automatically receives the Role #1 role.

━━━━━━━━━━━━━━━━━━━━━━━━
👥 **ALL MEMBERS**
\`!play\` — host a match: pick **amo-no**, **amo-yes** or **e-sport**, then 2v2/3v3/4v4, then enter your room ID
\`!esport\` — same picker, preselected to e-sport
\`!leaderboard\` — show the top players
\`!cancelmatch\` — cancel the match you opened (works in any channel)
\`!balance\` / \`!bal\` — check your points (\`!balance @user\` to check someone else)
\`!stats [@user]\` — combined stats, rank, win rate and MVP count
\`!rank [@user] [amo|esport]\` — profile card image for that mode with points, rank, W/L and MVP

🛡️ **REPORTS & ROLES**
Report a cheater in <#1546846855676043264> with the **🛡️ Report Player** button — takes **50 pts**, you get **+100 pts** + a reward role if the player is confirmed.

Apply for the team in <#1546853674167435294> with the **Apply as Checker / Staff** buttons — staff reviews you and interviews you in a voice channel.

━━━━━━━━━━━━━━━━━━━━━━━━
🔧 **SUPERVISORS / ADMINS**
\`!setpoints @user points win/loss\` — adjust a player's points
\`!giveall <points> p\` — give points to every registered player (e.g. \`!giveall 100 p\`)
\`!resetpoints\` — reset all points in all modes
\`!cancelgame @user\` — cancel a player's match
\`!endcancel\` — force-end a full match and refund points
\`!clearmatches\` / \`!cleargames\` — clear stuck matches
\`!setranks\` — refresh rank nicknames
\`!resetvote\` — reset the MVP vote and refund points
\`!remove <userID> <points>\` — remove points from a player
\`!setrole checker|cheatermark|staff <roleId>\` — configure report/apply roles
\`!blacklist <userID> <duration> <reason>\` — blacklist from matches
\`!unblacklist <userID>\` — remove a blacklist
\`!jail <userID> <duration> <reason>\` — lock a player to the jail
\`!unjail <userID>\` — release a jailed player
\`!clear <1-100>\` — bulk-delete messages
\`!announce <channelId> <message>\` — post an announcement
\`!commands\` — repost this commands list
\`!applyfix\` — re-sync the role-apply channels (staff only)
\`!cheatfix\` — re-sync the report/check channels

🛒 **STORE**
\`!storeadd <name>|<cost>|<role|gems>|<roleId>|<stock?>\` — add a store item
\`!storeremove <id>\` — remove a store item
\`!store\` / \`!refreshstore\` — re-sync the store embed

⏱️ Durations: \`30m\`, \`5h\`, \`7d\`, \`2w\`, \`perm\`
💡 All commands work with **\`!\`** or **\`&\`** (e.g. \`!balance\` = \`&balance\`).`;

function buildInfoEmbeds() {
  const MAX = 4000;
  const parts = [];
  let cur = '';
  for (const line of COMMANDS_INFO.split('\n')) {
    if ((cur + '\n' + line).length > MAX) {
      parts.push(cur);
      cur = line;
    } else {
      cur = cur ? cur + '\n' + line : line;
    }
  }
  if (cur) parts.push(cur);
  return parts.map((p, i) => new EmbedBuilder()
    .setColor(COLORS.info)
    .setTitle(i === 0 ? '🎮 HOW TO USE THE BOT - FREE FIRE MATCHES' : null)
    .setDescription(p)
    .setFooter({ text: `${i + 1}/${parts.length} • ${BRANDING}` }));
}

async function sendCommandsInfo(channel) {
  if (!channel) return null;
  const embeds = buildInfoEmbeds();
  let recent;
  try {
    recent = await channel.messages.fetch({ limit: 20 });
  } catch (e) {
    console.log(`[INFO] fetch failed in ${channel.id}: ${e.message}`);
    return null;
  }
  if (recent) {
    const mine = recent.filter(m => m.author.id === client.user.id && m.embeds && m.embeds[0] && m.embeds[0].title && m.embeds[0].title.includes('HOW TO USE THE BOT'));
    for (const m of mine.values()) {
      const same = m.embeds.length === embeds.length && embeds.every((e, i) => e.data.description === m.embeds[i].description);
      if (same) return null;
      await m.delete().catch(e => note('delete', e));
    }
  }
  try {
    const sent = await channel.send({ embeds });
    console.log(`[INFO] Commands message posted to ${channel.id}`);
    return sent;
  } catch (e) {
    console.log(`[INFO] send failed to ${channel.id}: ${e.message}`);
    return null;
  }
}

async function postCommandsInfoWithRetry() {
  const infoChannel = client.channels.cache.get(config.infoChannelId);
  if (!infoChannel) {
    console.log(`[INFO] info channel ${config.infoChannelId} not in cache yet`);
    return false;
  }
  const sent = await sendCommandsInfo(infoChannel);
  if (!sent) {
    setTimeout(async () => {
      const ch = client.channels.cache.get(config.infoChannelId);
      if (ch) await sendCommandsInfo(ch);
    }, 15000);
    return false;
  }
  return true;
}

function parseDuration(str) {
  if (!str) return null;
  const s = str.trim().toLowerCase();
  if (s === '0' || s === 'perm' || s === 'permanent') return -1;
  const m = s.match(/^(\d+)([a-z]*)$/);
  if (!m) return null;
  const n = parseInt(m[1]);
  const unit = m[2] || 'm';
  const mult = { s: 1000, m: 60000, h: 3600000, d: 86400000, w: 604800000, mo: 2629800000, y: 31536000000 }[unit];
  if (!mult) return null;
  return n * mult;
}

function blacklistMessage(entry) {
  const expiry = entry.expiresAt === -1 ? '**Permanent**' : `<t:${Math.floor(entry.expiresAt / 1000)}:R>`;
  return `❌ **You are blacklisted** from hosting or joining matches.\n📋 Reason: ${entry.reason}\n⏳ Expires: ${expiry}`;
}

async function stripRankNicknames(guild) {
  let done = 0;
  try {
    const members = await guild.members.fetch();
    for (const member of members.values()) {
      if (!member.nickname || !/^Rank\s+\d+\s+/i.test(member.nickname)) continue;
      const base = member.nickname.replace(/^Rank\s+\d+\s*/i, '');
      try {
        await member.setNickname(base).catch(e => note('nickname', e));
        done++;
        await new Promise(r => setTimeout(r, 800));
      } catch (e) {
        console.log(`[RANK] cannot strip ${member.id}: ${e.message}`);
      }
    }
  } catch (e) {
    console.log('[RANK] strip error:', e.message);
  }
  return done;
}

function computeCombinedRanking() {
  const combined = {};
  for (const mode of ['amo', 'esport']) {
    let data = null;
    try { data = storage.loadPoints(mode); } catch (e) { data = null; }
    if (!data || !data.players) continue;
    for (const [uid, p] of Object.entries(data.players)) {
      if (!combined[uid]) combined[uid] = { totalPoints: 0, wins: 0, matchesPlayed: 0 };
      combined[uid].totalPoints += (p.totalPoints || 0);
      combined[uid].wins += (p.wins || 0);
      combined[uid].matchesPlayed += (p.matchesPlayed || 0);
    }
  }
  return Object.entries(combined)
    .filter(([, p]) => p.matchesPlayed > 0 || p.totalPoints > 0)
    .sort((a, b) => b[1].totalPoints - a[1].totalPoints || b[1].wins - a[1].wins || b[1].matchesPlayed - a[1].matchesPlayed);
}

async function applyRankOneRole(guild, ranked, prefetchedMembers = null) {
  const roleId = config.rankOneRoleId;
  if (!roleId || !guild) return;
  const role = guild.roles.cache.get(roleId);
  if (!role) return;
  if (!ranked || ranked.length === 0) return;
  const top = ranked[0][0];
  // Reuse the member list when the caller already fetched it, instead of
  // issuing a second full guild member fetch.
  const members = prefetchedMembers || await guild.members.fetch().catch(() => null);
  if (!members) return;
  for (const m of members.values()) {
    if (m.id === top) continue;
    if (m.roles.cache.has(roleId)) await m.roles.remove(role).catch(e => note('role', e));
  }
  const topMember = members.get(top);
  if (topMember && !topMember.roles.cache.has(roleId)) {
    await topMember.roles.add(role).catch(e => note('role', e));
    console.log(`[RANK1] rank #1 role assigned to ${top}`);
  }
}

async function renameWithRetry(member, nick, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      await member.setNickname(nick);
      return true;
    } catch (e) {
      if (e.status === 429 && e.retryAfter) {
        await new Promise(r => setTimeout(r, Math.min(e.retryAfter * 1000 + 500, 65000)));
        continue;
      }
      throw e;
    }
  }
  return false;
}

// Only one nickname pass may run at a time. Previously it was fire-and-forget
// from every match settlement, so several passes could overlap and each one did
// its own full guild member fetch.
let rankRenameRunning = false;
let rankRenameQueued = false;

async function applyRankNicknames(guild) {
  if (rankRenameRunning) {
    rankRenameQueued = true;
    return { done: 0, failed: 0, skipped: true };
  }
  rankRenameRunning = true;
  try {
    return await runRankNicknames(guild);
  } finally {
    rankRenameRunning = false;
    if (rankRenameQueued) {
      rankRenameQueued = false;
      setTimeout(() => applyRankNicknames(guild).catch(e => note('nickname', e)), 250);
    }
  }
}

async function runRankNicknames(guild) {
  const ranked = computeCombinedRanking();

  let done = 0;
  let failed = 0;
  let changed = 0;
  const members = await guild.members.fetch().catch(() => null);
  for (let i = 0; i < ranked.length; i++) {
    const [uid] = ranked[i];
    const rank = i + 1;
    try {
      const member = guild.members.cache.get(uid) || (members && members.get(uid));
      if (!member || member.user.bot) continue;
      const currentNick = member.nickname || '';
      const isRankNick = /^Rank\s+\d+\s+/i.test(currentNick);
      const base = (isRankNick
        ? (member.user.displayName || member.user.username)
        : (member.displayName || member.user.username)
      ).replace(/^Rank\s+\d+\s*/i, '');
      const newNick = (`Rank ${rank} ${base}`).slice(0, 32);
      if (member.nickname !== newNick) {
        // The 1800ms delay used to be unconditional, so a pass over N ranked
        // players always burned N * 1.8s even when nothing needed renaming.
        // Nickname writes are the rate-limited part, so pace only those.
        if (changed > 0) await new Promise(r => setTimeout(r, 1800));
        const ok = await renameWithRetry(member, newNick);
        changed++;
        if (!ok) {
          failed++;
          console.log(`[RANK] cannot rename ${uid} (${base}) after retries`);
        }
      }
      done++;
    } catch (e) {
      failed++;
      console.log(`[RANK] rename error for ${uid}: ${e.message}`);
    }
  }
  await applyRankOneRole(guild, ranked, members);
  return { done, failed, changed };
}

async function ensureEsportChannels(guild) {
  const es = config.modes.esport;
  const botMember = guild.members.me;

  if (!es.matchChannelId) {
    const matchChannel = await guild.channels.create({
      name: '🎮│esports-matches',
      type: ChannelType.GuildText,
    });
    es.matchChannelId = matchChannel.id;
  }

  if (!es.voiceCategoryId) {
    const cat = await guild.channels.create({
      name: '🔊│esports-voice',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [],
    });
    es.voiceCategoryId = cat.id;
  }

  if (!es.logsCategoryId) {
    const cat = await guild.channels.create({
      name: '🗨️│esports-logs',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        }
      ],
    });
    es.logsCategoryId = cat.id;
  }

  return es;
}


// One line per slot. Filled slots show the player, their rank badge and their
// points, so the lobby is informative at a glance instead of a bare list of
// names. Empty slots stay visible so both teams are the same height and the
// remaining places are obvious.
function teamPanel(ids, matchMode, size, guild) {
  const slots = size || ids.length || 1;
  return Array.from({ length: slots }, (_, i) => {
    const uid = ids[i];
    if (!uid) return `\`${i + 1}.\` ‣ *waiting*`;
    const isMock = !/^\d{15,20}$/.test(uid);
    const badge = storage.getRankBadge(uid, matchMode);
    let name = isMock ? 'Mock' : 'User';
    if (guild && !isMock) {
      const member = guild.members.cache.get(uid);
      if (member) name = member.displayName || member.user.username;
    }
    const who = isMock ? `🤖 **${name}**` : `<@${uid}>`;
    const pts = isMock ? '' : (storage.getPlayerPoints(uid, matchMode).totalPoints || 0);
    const rank = badge ? ` \`${badge}\`` : '';
    const score = pts ? ` · ${fmtNum(pts)} pts` : '';
    // The captain (first slot) is who captains that team in the MVP vote.
    const cap = i === 0 ? ' 👑' : '';
    return `\`${i + 1}.\` ${who}${cap}${rank}${score}`;
  }).join('\n');
}

function buildSetupMessageParts(match, hostId) {
  const ts = Math.floor(Date.now() / 1000);
  const embed = new EmbedBuilder()
    .setTitle(`${config.emojis.game} Free Fire Custom • ${match.teamSize}v${match.teamSize}`)
    .setColor(0x2B2D31)
    .setDescription(
      `**Match host** — <@${hostId}>\n` +
      `**Status** — ⏳ *awaiting room config*\n` +
      `**Created** — <t:${ts}:R>\n\n` +
      `> Press **⚙️ Set Room Config** to enter the room ID and password.\n` +
      `> Players then use the buttons to lock their slots.`
    )
    .setFooter({ text: BRANDING });
  const buttons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_${match.id}`)
      .setEmoji('⚙️')
      .setLabel('Set Room Config')
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`cancel_${match.id}`)
      .setEmoji('❌')
      .setLabel('Cancel Match')
      .setStyle(ButtonStyle.Danger)
  );
  return { embeds: [embed], components: [buttons] };
}

// Room ID / password / join key now use Discord inline code, which is
// click-to-copy. They were in fenced blocks, which render as a full-width grey
// box and do NOT support the copy-on-click the label advertised.
function codeLine(label, value) {
  return `**${label}**  \`${value || '—'}\`   *(click to copy)*`;
}

// The host picks a style in the amo-yes flow and it is stored on the match as the
// raw value ("apostado"). This turns that into something a player can read, and
// is the single place the three names are spelled out for display.
const STYLE_LABELS = {
  apostado: 'Apostado Style',
  zelika: 'Zelika Style',
  highlight: 'Highlight Style'
};

// The host chooses one of three looks for an amo-yes lobby. The choice used to
// be stored and then printed as text while every style rendered identically,
// which made the picker a menu that does nothing -- worse than not offering it,
// because the player made a decision that had no effect.
//
// Each style now carries its own colour, and both the lobby and the match
// channel read it from here so the two can never disagree about what was picked.
const STYLE_THEMES = {
  apostado:  { color: 0xE03131, accent: '\u{1F534}', blurb: 'Classic red apuesta look' },
  zelika:    { color: 0x9C36B5, accent: '\u{1F7E8}', blurb: 'Purple Zelika theme' },
  highlight: { color: 0xF5A623, accent: '\u{1F7E1}', blurb: 'Gold highlight look' }
};

// null for amo-no and e-sport, which set no style, and for any unknown value, so
// a bad value degrades to the normal lobby colour instead of rendering wrongly.
function styleTheme(match) {
  const key = String((match && match.style) || '').toLowerCase();
  return STYLE_THEMES[key] || null;
}

// Returns null when there is no style, so callers can omit the line entirely
// rather than printing an empty field. amo-no and e-sport never set one.
function styleLabel(style) {
  if (!style) return null;
  const key = String(style).toLowerCase();
  if (STYLE_LABELS[key]) return STYLE_LABELS[key];
  // Unknown or hand-edited value: show it capitalised rather than hiding it.
  return String(style).charAt(0).toUpperCase() + String(style).slice(1);
}

// Two renderings of the same value, so the wording can never disagree.
//   styleLine    - compact, for the field row in the match channel
//   styleHeading - a large top-of-embed heading, for the lobby
//
// Both carry the style's own accent and a one-line description, so a player
// scrolling back can tell which style a lobby was without reading the name.
function styleLine(match) {
  const label = styleLabel(match && match.style);
  if (!label) return null;
  const theme = styleTheme(match);
  return `${theme ? theme.accent : '\u{1F3A8}'} **Style:** ${label}`;
}

// '##' is Discord's only font-size control: it renders as a heading, so the style
// reads as the headline of the lobby instead of another line of body text.
function styleHeading(match) {
  const label = styleLabel(match && match.style);
  if (!label) return null;
  const theme = styleTheme(match);
  const blurb = theme ? ` \u2014 _${theme.blurb}_` : '';
  return `## ${theme ? theme.accent : '\u{1F3A8}'} ${label}${blurb}`;
}

function buildMatchBoxEmbed(guild, match, creatorUser) {
  const mode = match.mode || 'amo';
  const size = match.teamSize || 2;
  const t1Field = teamPanel(match.team1, mode, size, guild);
  const t2Field = teamPanel(match.team2, mode, size, guild);
  const filled1 = (match.team1 || []).length;
  const filled2 = (match.team2 || []).length;
  const total = size * 2;
  const joined = filled1 + filled2;
  const pending = Math.max(0, total - joined);
  const ts = Math.floor(Date.now() / 1000);
  const full = pending === 0;
  const lockEmoji = match.key ? '🔒' : '🔓';

  const strip = slotStrip(filled1, filled2, size);
  // Heading, not a line: the style is the first thing a player reads.
  const styleText = styleHeading(match);
  // The style colour, except once the lobby is full: "both teams full" is green
  // on every mode, and the style overriding it would lose that signal.
  const theme = styleTheme(match);
  const lobbyColor = full ? COLORS.success : (theme ? theme.color : COLORS.primary);

  const embed = new EmbedBuilder()
    .setTitle(`${config.emojis.game} ${getModeConfig(mode).displayName} • ${size}v${size} LOBBY`)
    .setColor(lobbyColor)
    .setDescription(
      // The style leads when there is one, so it is the first thing read.
      (styleText ? `${styleText}\n` : '') +
      `${strip}  **${joined}/${total}**\n` +
      `${full ? '✅ **Both teams full — starting soon**' : `⏳ **${pending}** more player${pending === 1 ? '' : 's'} needed`}\n` +
      `👑 Host <@${match.creatorId}>   ·   🕐 Opened <t:${ts}:R>`
    )
    .addFields(
      { name: `${config.emojis.team1} TEAM 1  \`${filled1}/${size}\``, value: t1Field || '*No players yet*', inline: true },
      { name: `${config.emojis.team2} TEAM 2  \`${filled2}/${size}\``, value: t2Field || '*No players yet*', inline: true }
    )
    .addFields(
      { name: '🎮 How to join', value: [
        'Press **Join Team 1** or **Join Team 2** below.',
        'You can **Leave** at any time before the match starts.',
        full ? 'The match starts as soon as both teams are full.' : `This lobby closes in <t:${Math.floor(Date.now() / 1000) + 120}:R>.`
      ].join('\n'), inline: false },
      { name: '🔑 Access', value: [
        `${lockEmoji} ${match.key ? '**Join key required** to enter.' : '**Open to everyone** — no key needed.'}`,
        '👑 The **first player** on each team captains the MVP vote.'
      ].join('\n'), inline: false }
    )
    .setFooter({ text: BRANDING });

  return withThumbnail(embed, guild);
}


async function updateMatchChannel(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (!channel) return;
  const getName = (id) => {
    const member = guild.members.cache.get(id);
    return member ? (member.displayName || member.user.username) : 'User';
  };
  const list1 = match.team1.length > 0 ? match.team1.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `${getName(id)} \`[${badge}]\`` : getName(id);
  }).join('\n') : 'Empty';
  const list2 = match.team2.length > 0 ? match.team2.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `${getName(id)} \`[${badge}]\`` : getName(id);
  }).join('\n') : 'Empty';
  const embed = withThumbnail(new EmbedBuilder()
    .setTitle(`${config.emojis.game} Room Details`)
    .setColor(COLORS.gold)
    .setDescription(
      codeLine('🔑 Room ID', match.roomId) + '\n' +
      codeLine('🔒 Password', match.password) +
      (match.key ? '\n' + codeLine('🗝️ Join Key', match.key) : '')
    )
    .addFields(
      { name: `${config.emojis.team1} TEAM 1 — \`${(match.team1 || []).length}/${match.teamSize}\``, value: list1 || '*Empty*', inline: true },
      { name: `${config.emojis.team2} TEAM 2 — \`${(match.team2 || []).length}/${match.teamSize}\``, value: list2 || '*Empty*', inline: true }
    )
    .setFooter({ text: BRANDING }), guild);
  let infoMsg = null;
  if (match.roomInfoMessageId) {
    infoMsg = await fetchMessage(channel, match.roomInfoMessageId);
  }
  if (infoMsg) {
    await infoMsg.edit({ embeds: [embed] }).catch(e => note('edit', e));
    return;
  }
  await channel.messages.fetch({ limit: 20 }).catch(e => note('edit', e));
  const lastMsg = channel.lastMessage;
  if (lastMsg && lastMsg.author.id === client.user.id && lastMsg.embeds.length) {
    await lastMsg.edit({ embeds: [embed] }).catch(e => note('edit', e));
    match.roomInfoMessageId = lastMsg.id;
    manager.persistMatches();
  } else {
    const sent = await channel.send({ embeds: [embed] }).catch(() => null);
    if (sent) {
      match.roomInfoMessageId = sent.id;
      manager.persistMatches();
    }
  }
}

async function cancelMatch(guild, match, cancelText) {
  if (match.phase === 'CANCELLED') {
    await manager.deleteVoiceChannels(guild, match).catch(e => note('voice', e));
    await manager.deleteChannel(guild, match).catch(e => note('voice', e));
    manager.removeMatch(match.id);
    return;
  }
  match.closing = true;
  match.phase = 'CANCELLING';
  manager.persistMatches();
  const restored = await manager.returnPlayersToOriginal(guild, match).catch(() => null);
  if (restored) await manager.verifyRestore(guild, match).catch(e => note('persist', e));
  await manager.deleteVoiceChannels(guild, match).catch(e => note('persist', e));
  await manager.deleteChannel(guild, match).catch(e => note('persist', e));
  match.phase = 'CANCELLED';
  if (match.joinTimeout) { clearTimeout(match.joinTimeout); match.joinTimeout = null; }
  if (match.configTimeout) { clearTimeout(match.configTimeout); match.configTimeout = null; }
  const baseChannel = guild.channels.cache.get(match.channelId);
  if (baseChannel && match.message) {
    const msg = await fetchMessage(baseChannel, match.message);
    if (msg) await msg.edit({ content: cancelText, embeds: [], components: [] }).catch(e => note('edit', e));
  }
  await clearJoinButtons(guild, match);
  await clearVotePanel(guild, match);
  const roomChannel = guild.channels.cache.get(match.channelId2);
  if (roomChannel) {
    if (match.resultMessageId && match.resultMessageId !== match.message) {
      const rmsg = await fetchMessage(roomChannel, match.resultMessageId);
      if (rmsg) await rmsg.edit({ content: cancelText, embeds: [], components: [] }).catch(e => note('edit', e));
    }
    if (match.cancelMsgId && match.cancelMsgId !== match.resultMessageId) {
      const cmsg = await fetchMessage(roomChannel, match.cancelMsgId);
      if (cmsg) await cmsg.edit({ content: cancelText, embeds: [], components: [] }).catch(e => note('edit', e));
    }
  }
  manager.removeMatch(match.id);
  console.log(`[VOICE] match ${match.id} cancelled — players restored, team channels cleaned up`);
}

function cancelVotesNeeded(match) {
  const real = [...new Set([...(match.team1 || []), ...(match.team2 || [])])].filter(id => /^\d{15,20}$/.test(id));
  // This used to require EVERY player, which made a cancel impossible whenever
  // anyone was offline or simply never clicked. A strict majority of the roster
  // is enough to call the match off.
  return Math.max(1, Math.ceil(real.length / 2));
}

function isMatchHost(match, userId) {
  return !!match && match.creatorId === userId;
}

// ---------------------------------------------------------------------------
// Team-size picker flow, reached from a bare `!play`.
//
// Step 1: the player types !play, the bot posts a 2v2/3v3/4v4 picker.
// Step 2: they choose a size, the picker is deleted, a match is created and
//         saved, and a modal asks for the room details.
// Step 3: the modal collects the Room ID (required, numeric) plus the room
//         password and the join password (both optional).
// ---------------------------------------------------------------------------
async function handlePlaySizePick(interaction) {
  const userId = interaction.user.id;
  const draft = playFlow.getDraft(userId);
  if (!draft) {
    return interaction.reply({
      content: '❌ That request expired. Type `!play` again to start a new one.',
      flags: 64
    });
  }

  // Style dropdown: only PvP Yes uses one, so record it and continue into the
  // size step for that mode.
  if (interaction.customId === playFlow.STYLE_CUSTOM_ID) {
    const style = interaction.values[0];
    if (!playFlow.STYLES.some(s => s.value === style)) {
      return interaction.reply({ content: '⚠️ Unknown style.', flags: 64 });
    }
    const label = playFlow.STYLES.find(s => s.value === style).label;
    // If a size was already chosen before the style box appeared, carry straight
    // on into room details rather than making them pick again.
    if (draft.size) {
      playFlow.setDraft(userId, { style });
      // The raw value is stored, not the label. styleLabel() turns it into text
      // for display, so storing the label here would save "Zelika Style" where
      // every other match has "zelika".
      return continueToRoomDetails(interaction, draft.size, draft.mode || 'amo', style);
    }
    playFlow.setDraft(userId, { style });
    return interaction.update({
      embeds: [], components: [], content: `🎨 **${label}** selected. Now pick your team size.`
    }).catch(e => note('style-picker', e));
  }

  // Mode dropdown: just record the choice and re-render, so the player can then
  // pick a size. Nothing is created yet.
  if (interaction.customId === `${playFlow.CUSTOM_ID}_mode`) {
    const mode = interaction.values[0];
    if (!playFlow.MODES.some(m => m.value === mode)) {
      return interaction.reply({ content: '⚠️ Unknown mode.', flags: 64 });
    }
    const modeCfg = getModeConfig(mode);
    // The menu only offers this channel's modes, so this should not fire. It stays
    // as a guard for a stale message: a picker posted before a channel was
    // reassigned, or one that is still in the client's component cache.
    if (modeCfg.matchChannelId && modeCfg.matchChannelId !== interaction.channel.id) {
      playFlow.clearDraft(userId);
      return interaction.reply({
        content: `❌ **${modeCfg.displayName}** matches must be started in <#${modeCfg.matchChannelId}>.\nUse \`!play\` there and pick **${modeCfg.displayName}** again.`,
        flags: 64
      });
    }
    playFlow.setDraft(userId, { mode });
    const allowed = modesAllowedInChannel(interaction.channel.id);
    const parts = playFlow.buildSizePicker(userId, interaction.guild, { mode, allowedModes: allowed });
    // Exactly one response per interaction. The menu is updated in place, which is
    // all that is needed when this channel hosts a single mode -- adding a
    // "now pick a size" prompt on top of that would be noise.
    await interaction.update(parts).catch(e => note('mode-picker', e));
    if (allowed.length === 1) return;
    const where = modeCfg.matchChannelId ? `<#${modeCfg.matchChannelId}>` : 'the match channel';
    return interaction.followUp({
      content: `✅ Mode set to **${modeCfg.displayName}**. Now pick a team size.\n📍 **${modeCfg.displayName}** matches are hosted in ${where}.`,
      flags: 64
    }).catch(e => note('mode-picker', e));
  }

  const size = parseInt(interaction.values[0], 10);
  if (!playFlow.TEAM_SIZES.includes(size)) {
    return interaction.reply({ content: '⚠️ Unknown team size.', flags: 64 });
  }

  const mode = draft.mode || 'amo';
  const modeCfg = getModeConfig(mode);
  const channelId = interaction.channel.id;
  // Each mode is hosted in its own channel, so the gate is per-mode. The old
  // ammoChannelId compared against undefined here and let anything through.
  // Checked again here because the player picked from a picker that may have been
  // opened in a different channel than the one this mode requires.
  if (modeCfg.matchChannelId && channelId !== modeCfg.matchChannelId) {
    playFlow.clearDraft(userId);
    return interaction.reply({
      content: `❌ **${modeCfg.displayName}** matches must be started in <#${modeCfg.matchChannelId}>.\nUse \`!play\` there and pick **${modeCfg.displayName}** again.`,
      flags: 64
    });
  }

  // Re-check at pick time: the player may have left voice, joined another
  // match, or been blacklisted between typing the command and choosing.
  if (!isInRequiredVoice(interaction.member)) {
    playFlow.clearDraft(userId);
    return interaction.reply({ content: voiceCheckMessage(), flags: 64 });
  }
  const bl = blacklistModule.isBlacklisted(userId);
  if (bl) {
    playFlow.clearDraft(userId);
    return interaction.reply({ content: blacklistMessage(bl), flags: 64 });
  }
  if (manager.getMatchByCreator(userId, mode)) {
    playFlow.clearDraft(userId);
    return interaction.reply({ content: '❌ You already have a pending match! Cancel it first.', flags: 64 });
  }

  // "PvP Yes" asks for a lobby style before the room details. The chosen size is
  // remembered so the style box can hand control straight back.
  if (getModeConfig(mode).requiresStyle && !draft.style) {
    playFlow.setDraft(userId, { size });
    const parts = playFlow.buildStylePicker(userId, interaction.guild, size);
    // The picker message becomes the style box, rather than a second message
    // being posted for it. One message, one tracked id: it can be deleted after
    // the modal opens, and it needs no interaction token to remove. Posting an
    // ephemeral followUp instead meant the style box could only ever be deleted
    // with the very token the modal needed.
    return interaction.update(parts).catch(e => {
      console.log('[PLAY] style picker update failed:', e.message);
      return interaction.reply({
        content: '⚠️ I could not show the style picker. Please run `!play` again.',
        flags: 64
      }).catch(e => note('style-picker', e));
    });
  }

  return continueToRoomDetails(interaction, size, mode, draft.style);
}

// Creates the match, posts the setup message and opens the room-details modal.
// Shared by the normal size path and the PvP Yes style path.
async function continueToRoomDetails(interaction, size, mode, style) {
  const userId = interaction.user.id;
  const channelId = interaction.channel.id;

  // Create the match first, so if the modal fails the player can still retry
  // from the setup message rather than losing their slot.
  const match = manager.createMatch(userId, size, channelId, mode);
  if (style) match.style = style;

  // Arm the config timeout.
  if (match.configTimeout) clearTimeout(match.configTimeout);
  match.configTimeout = setTimeout(() => {
    timeoutMatch(interaction.guild, match.id, 'config');
  }, 60 * 1000);

  // The modal is the interaction's one and only response, so it goes FIRST.
  //
  // This used to be the other way round: the picker message was deleted and only
  // then was the modal opened. Deleting the message an interaction came from
  // invalidates that interaction's token, so showModal() failed and Discord
  // showed the player a bare "This interaction failed" with nothing to click and
  // no way to retry.
  // The picker's id is read here, before clearDraft() can drop it -- clearDraft
  // also forgets the tracked id, so reading it afterwards returned null and the
  // "Host a Match" box was never deleted.
  //
  // It is stored on the match rather than deleted straight away, because the form
  // has not been filled in yet. Deleting on submit means a host who closes the
  // form without submitting still has a menu to come back to; deleting on open
  // would leave them stuck behind "you already have a pending match" until the
  // 60s config timeout reaped it.
  const pickerMsg = await fetchMessage(interaction.channel, playFlow.takePickerMessageId(userId));
  if (pickerMsg) match.pickerMessageId = pickerMsg.id;

  let modalOpen = false;
  try {
    await interaction.showModal(playFlow.buildRoomModal(match));
    modalOpen = true;
    playFlow.clearDraft(userId);
  } catch (e) {
    errLog('playFlow showModal failed for match ' + match.id, e);
  }

  if (modalOpen) {
    manager.persistMatches();
    return;
  }

  // The form could not be opened. Leave a message with a button so the player can
  // retry from a fresh interaction rather than being stuck at a dead end.
  const parts = playFlow.buildSetupMessageParts(match, userId, interaction.guild);
  const setupMsg = await interaction.channel.send(parts).catch(() => null);
  if (setupMsg) {
    // Tracked as the match's active message, not just a setup marker: the
    // channel cleanup sweep deletes bot messages that are not an active match
    // message, and the modal handler reuses this id when it swaps in the real
    // lobby embed. So this message is both saved and replaceable.
    match.setupMessageId = setupMsg.id;
    match.message = setupMsg.id;
    // The picker is now redundant: the setup message carries the retry button.
    if (pickerMsg) await pickerMsg.delete().catch(() => null);
    match.pickerMessageId = null;
  }
  manager.persistMatches();

  return interaction.reply({
    content: '❌ I could not open the room details form. Use **⚙️ Enter Room Details** below to try again.',
    flags: 64
  }).catch(e => console.log('[PLAY] could not report the modal failure:', e.message));
}

function isMatchPlayer(match, userId) {
  return match.creatorId === userId || (match.team1 || []).includes(userId) || (match.team2 || []).includes(userId);
}

function buildCancelVoteEmbed(match) {
  const cancelVotes = match.cancelVotes || { 1: [], 2: [] };
  const votes1 = cancelVotes[1] || [];
  const votes2 = cancelVotes[2] || [];
  const votes = votes1.length + votes2.length;
  const needed = cancelVotesNeeded(match);
  const all = [...votes1, ...votes2];
  const done = votes >= needed;
  const status = done ? '✅ **CANCEL APPROVED** — the match will be cancelled now!' : `⏳ **Waiting for votes...** (${votes}/${needed})`;
  return new EmbedBuilder()
    .setTitle('⛔ CANCEL VOTE')
    .setColor(COLORS.danger)
    .setDescription(`**${needed} vote${needed === 1 ? '' : 's'} needed from the players in this match** to cancel (${votes}/${needed}). Each player can vote once — the match keeps running until the vote passes. The match host can cancel instantly without a vote.`)
    .addFields(
      { name: '🗳️ VOTES', value: `\`\`\`${progressBar(votes, needed, 8)}\`\`\`\n${all.length ? all.map(id => `<@${id}>`).join(' ') : '*No votes yet*'}` },
      { name: '⚡ STATUS', value: status }
    )
    .setFooter({ text: BRANDING });
}

async function openCancelVote(guild, match, interaction) {
  const isHost = isMatchHost(match, interaction.user.id);
  const isAdmin = !!(interaction.member && interaction.member.permissions.has('Administrator'));
  if (!isMatchPlayer(match, interaction.user.id) && !isAdmin) {
    return interaction.reply({ content: '❌ Only players in this match can start a cancel vote!', ephemeral: true });
  }
  const roomChannel = guild.channels.cache.get(match.channelId2) || guild.channels.cache.get(match.channelId);
  if (!roomChannel) {
    return interaction.reply({ content: '❌ Could not find the match channel.', ephemeral: true });
  }

  // The host who opened the match can always call it off, no vote required.
  if (isHost) {
    await cancelMatch(guild, match, `❌ **Match cancelled by the host** (<@${interaction.user.id}>)`);
    return interaction.reply({ content: '❌ Match cancelled.', ephemeral: true });
  }
  const embed = buildCancelVoteEmbed(match);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cancelfvote_${match.id}`).setEmoji('🗳️').setLabel('Vote for Cancel').setStyle(ButtonStyle.Danger)
  );
  let msg = null;
  if (match.cancelMsgId) {
    const existing = await fetchMessage(roomChannel, match.cancelMsgId);
    if (existing) msg = existing;
  }
  if (msg) {
    await msg.edit({ embeds: [embed], components: [row] }).catch(e => note('edit', e));
  } else {
    const sent = await roomChannel.send({ content: `⚠️ **A cancel vote has started!** Match ${match.teamSize}v${match.teamSize} — press the button to vote.`, embeds: [embed], components: [row] }).catch(() => null);
    if (sent) {
      match.cancelMsgId = sent.id;
      manager.persistMatches();
    }
  }
  const needed = cancelVotesNeeded(match);
  return interaction.reply({ content: `❌ **Cancel vote started.** Need **${needed}** vote${needed === 1 ? '' : 's'} from the match players. Press **🗳️ Vote for Cancel**.`, ephemeral: true });
}

function buildMatchMenu(match) {
  // Split into themed menus. Six unrelated options in one dropdown was a wall
  // of text with no grouping, and it read worst on mobile.
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`matchmenu_${match.id}`)
      .setPlaceholder('⚙️ Match Actions')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder().setEmoji('🗳️').setLabel('Vote for MVP').setDescription('Winner / Loser MVP voting').setValue('mvp'),
        new StringSelectMenuOptionBuilder().setEmoji('🛡️').setLabel('Request Staff').setDescription('Notify staff about this match').setValue('staffreq'),
        new StringSelectMenuOptionBuilder().setEmoji('❌').setLabel('Cancel Match').setDescription('Host cancels now; others start a vote').setValue('cancel')
      )
  );
  const modRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`matchmodmenu_${match.id}`)
      .setPlaceholder('🔧 Moderation')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(
        new StringSelectMenuOptionBuilder().setEmoji('↩️').setLabel('Cancel My Vote').setDescription('Clear your MVP vote').setValue('votecancel'),
        new StringSelectMenuOptionBuilder().setEmoji('🔄').setLabel('Reset Votes').setDescription('Reset all votes (staff only)').setValue('resetvotes'),
        new StringSelectMenuOptionBuilder().setEmoji('🚫').setLabel('Staff Cancel').setDescription('Immediate cancel (staff only)').setValue('staffcancel')
      )
  );
  const voteRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mvpwinner_${match.id}`).setEmoji('🏆').setLabel('Vote for MVP W').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mvploser_${match.id}`).setEmoji('💪').setLabel('Vote for MVP L').setStyle(ButtonStyle.Secondary)
  );
  return [row, modRow, voteRow];
}

async function handleStaffReq(interaction, match) {
  const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
  if (!allPlayers.includes(interaction.user.id)) {
    return interaction.reply({ content: '❌ Only players in this match can request staff!', ephemeral: true });
  }
  const roleMentions = (config.staffRoles || []).map(id => `<@&${id}>`).join(' ');
  await interaction.deferReply({ ephemeral: true });
  const modeDisplay = getModeConfig(match.mode).displayName;
  const staffEmbed = new EmbedBuilder()
    .setTitle('🛡️ STAFF REQUEST')
    .setColor('#F1C40F')
    .setDescription(
      `<@${interaction.user.id}> is requesting staff for the **${match.teamSize}v${match.teamSize}** match.\n\n${roleMentions}`
    )
    .addFields(
      { name: '🎮 Mode', value: modeDisplay, inline: true },
      { name: '📊 Teams', value: `🔴 ${match.team1.length}/${match.teamSize}  |  🟢 ${match.team2.length}/${match.teamSize}`, inline: true }
    )
    .setFooter({ text: BRANDING });
  try {
    await interaction.channel.send({ embeds: [staffEmbed], allowedMentions: { roles: (config.staffRoles || []), users: [] } });
    await interaction.editReply({ content: '✅ Staff has been notified!' });
  } catch (e) {
    console.log('[STAFF] send failed:', e.message);
    await interaction.editReply({ embeds: [staffEmbed] });
  }
}

function isMvpVoter(match, member) {
  if (!member) return false;
  const captains = [match.team1[0], match.team2[0]].filter(Boolean);
  return captains.includes(member.id);
}

async function handleMvpVote(interaction, match) {
  if (match.status !== 'full') {
    return interaction.reply({ content: '❌ This match is not in a votable state.', ephemeral: true });
  }
  if (!isMvpVoter(match, interaction.member)) {
    const cap1 = match.team1[0] ? `<@${match.team1[0]}>` : '—';
    const cap2 = match.team2[0] ? `<@${match.team2[0]}>` : '—';
    return interaction.reply({ content: `❌ Only the **first 2 players** in the match can vote! (${cap1} & ${cap2})`, ephemeral: true });
  }
  if (match.winnerVoteSet && match.loserVoteSet) {
    return interaction.reply({ content: '✅ MVP votes were already finalized.', ephemeral: true });
  }
  const roster = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
  if (roster.length === 0) {
    return interaction.reply({ content: '⚠️ No players found in this match.', ephemeral: true });
  }
  const typeRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`mvpwinner_${match.id}`).setEmoji('🏆').setLabel('Winner MVP').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`mvploser_${match.id}`).setEmoji('💪').setLabel('Loser MVP').setStyle(ButtonStyle.Secondary)
  );
  const embed = new EmbedBuilder()
    .setTitle('🗳️ MVP Voting')
    .setColor(COLORS.gold)
    .setDescription(
      `Choose **🏆 Winner MVP** or **💪 Loser MVP**.\n` +
      `Only the **first 2 players** of the match can vote (${match.team1[0] ? `<@${match.team1[0]}>` : '—'} 🇹1 & ${match.team2[0] ? `<@${match.team2[0]}>` : '—'} 🇹2).\n` +
      `After the winner is chosen, **Loser MVP** lists only the **losing team** members.`
    );
  await interaction.reply({ embeds: [embed], components: [typeRow], ephemeral: true });
  await syncVotePanel(interaction.guild, match);
}

async function handleVoteCancel(interaction, match) {
  const voterId = interaction.user.id;
  const changed = [];
  for (const key of ['winnerVotes', 'loserVotes']) {
    const setKey = key === 'winnerVotes' ? 'winnerVoteSet' : 'loserVoteSet';
    if (match[setKey]) continue;
    if (match[key] && match[key][voterId]) {
      delete match[key][voterId];
      changed.push(key === 'winnerVotes' ? 'winner' : 'loser');
    }
  }
  manager.persistMatches();
  await updateResultBox(interaction.guild, match);
  await syncVotePanel(interaction.guild, match);
  return interaction.reply({
    content: changed.length
      ? `✅ Your ${changed.join(' & ')} vote was cleared. Vote again with 🗳️ Vote MVP.`
      : 'ℹ️ No pending votes to clear (agreed votes are locked).',
    ephemeral: true
  });
}

async function handleCancelMatchAction(interaction, match) {
  if (match.status !== 'waiting' && match.status !== 'full') {
    return interaction.reply({ content: '⚠️ This match is not open for a cancel vote right now.', ephemeral: true });
  }
  // Only the host who opened the match, or staff, can cancel it. Discord renders
  // the button for everyone, so this is the only place the rule can be enforced.
  const isHost = isMatchHost(match, interaction.user.id);
  const isStaff = interaction.member.permissions.has('Administrator') ||
    [...(config.staffRoles || []), ...(config.adminRoles || [])]
      .some(rid => interaction.member.roles.cache.has(rid));
  if (!isHost && !isStaff) {
    return interaction.reply({
      content: `❌ Only the match host <@${match.creatorId}> can cancel this match.\nIf they are not around, ask a staff member to cancel it.`,
      flags: 64
    });
  }
  return openCancelVote(interaction.guild, match, interaction);
}

async function handleStaffCancel(interaction, match) {
  const isStaff = interaction.member.permissions.has('Administrator') ||
    [...(config.staffRoles || []), ...(config.adminRoles || [])].some(rid => interaction.member.roles.cache.has(rid));
  if (!isStaff) {
    return interaction.reply({ content: '❌ Only staff can cancel the match!', ephemeral: true });
  }
  await cancelMatch(interaction.guild, match, `🚫 **Match cancelled by staff** (<@${interaction.user.id}>)`);
  await interaction.reply({ content: '🚫 Match cancelled by staff!', ephemeral: true });
}

async function handleResetVotes(interaction, match) {
  const allowed = (config.matchPingRoles || []).some(rid => rid && interaction.member.roles.cache.has(rid));
  if (!allowed && !interaction.member.permissions.has('Administrator')) {
    return interaction.reply({ content: '❌ Only the roles mentioned in the match can reset votes!', ephemeral: true });
  }
  if (match.winnerVoteSet && match.loserVoteSet) {
    return interaction.reply({ content: '❌ MVP results are already finalized.', ephemeral: true });
  }
  match.winnerVotes = {};
  match.loserVotes = {};
  match.cancelVotes = { 1: [], 2: [] };
  match.winnerVoteSet = false;
  match.loserVoteSet = false;
  match.mvpWinnerId = null;
  match.mvpLoserId = null;
  match.winnerTeam = null;
  match.loserTeam = null;
  match.resultStatus = '🔄 Votes have been reset. Use the menu again to re-vote.';
  manager.persistMatches();
  await updateResultBox(interaction.guild, match);
  await syncVotePanel(interaction.guild, match);
  await interaction.reply({ content: '🔄 All votes have been reset!', ephemeral: true });
  const room = interaction.guild.channels.cache.get(match.channelId2);
  if (room) room.send({ content: `🔄 **Votes have been reset** by <@${interaction.user.id}>. Captains <@${match.team1[0]}> & <@${match.team2[0]}> can vote again.` }).catch(e => note('send', e));
}

function mvpPlayerOptions(guild, match, excludeId, teamFilter) {
  const pool = [...new Set([...(match.team1 || []), ...(match.team2 || [])])]
    .filter(id => id && /^\d{15,20}$/.test(id) && (!excludeId || id !== excludeId))
    .filter(id => !teamFilter || (match.team1.includes(id) ? 1 : 2) === teamFilter);
  const picks = pool;
  return picks.map(id => {
    const member = guild.members.cache.get(id);
    const name = member ? (member.displayName || member.user.username) : id;
    const team = match.team1.includes(id) ? 1 : 2;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`Team ${team} • ${name}`.slice(0, 100))
      .setValue(id);
  });
}

async function showMvpCandidatePicker(interaction, match, isWinner, mode = 'update') {
  const voterId = interaction.user.id;
  const setKey = isWinner ? 'winnerVoteSet' : 'loserVoteSet';
  const votesKey = isWinner ? 'winnerVotes' : 'loserVotes';
  if (match.status !== 'full') {
    return interaction.reply({ content: '❌ This match is not in a votable state.', ephemeral: true });
  }
  if (!isMvpVoter(match, interaction.member)) {
    return interaction.reply({ content: '❌ Only the **first 2 players** in the match can vote! (Team captains only)', ephemeral: true });
  }
  if (match[setKey]) {
    return interaction.reply({ content: `✅ ${isWinner ? 'Winner' : 'Loser'} MVP was already finalized.`, ephemeral: true });
  }
  if (match[votesKey][voterId]) {
    return interaction.reply({ content: '✅ You already voted! Use ❌ Cancel My Vote to change it.', ephemeral: true });
  }
  const teamFilter = isWinner
    ? (match.loserTeam ? (match.loserTeam === 1 ? 2 : 1) : null)
    : (match.winnerTeam ? (match.winnerTeam === 1 ? 2 : 1) : null);
  const opts = mvpPlayerOptions(interaction.guild, match, isWinner ? match.mvpLoserId : match.mvpWinnerId, teamFilter);
  if (opts.length === 0) {
    return interaction.reply({ content: '⚠️ No players found in this match.', ephemeral: true });
  }
  const embed = new EmbedBuilder()
    .setTitle(isWinner ? '🏆 SELECT WINNER MVP' : '💪 SELECT LOSER MVP')
    .setColor(isWinner ? COLORS.gold : COLORS.loser)
    .setDescription(
      (teamFilter
        ? `Only players from **Team ${teamFilter}** (the ${isWinner ? 'winning' : 'losing'} team) are listed below.`
        : `Pick a player from the match roster below.`) +
      `\nOnly the **first 2 players of each team** can vote.`
    );
  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${isWinner ? 'mvvp' : 'mvlp'}_${match.id}`)
      .setPlaceholder('Select Players')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(opts)
  );
  const payload = { embeds: [embed], components: [row] };
  if (mode === 'reply') return interaction.reply(payload);
  return interaction.update(payload);
}

function buildVotePanelEmbed(match) {
  const cap1 = match.team1[0] ? `<@${match.team1[0]}>` : '—';
  const cap2 = match.team2[0] ? `<@${match.team2[0]}>` : '—';
  const tally = (key, label) => {
    const votes = match[key] || {};
    const n = Object.keys(votes).length;
    if (match[`${key.slice(0, -5)}VoteSet`]) {
      const mvpKey = key === 'winnerVotes' ? 'mvpWinnerId' : 'mvpLoserId';
      return match[mvpKey] ? `${label} **<@${match[mvpKey]}>**` : `${label} *decided*`;
    }
    if (n === 0) return `${label} 🔻 *0/2 votes*`;
    const list = Object.entries(votes).map(([, v]) => `<@${v.player}>`).join(', ');
    return `${label} ⏳ ${n}/2 → ${list}`;
  };
  const winnerLine = tally('winnerVotes', '🏆');
  const loserLine = tally('loserVotes', '💪');
  return new EmbedBuilder()
    .setTitle('🗳️ MVP Voting')
    .setColor(COLORS.gold)
    .setDescription(
      `Only the **first 2 players** of this match can vote:\n` +
      `${cap1} (🇹1) & ${cap2} (🇹2)`
    )
    .addFields(
      { name: '🏆 Winner MVP', value: winnerLine, inline: false },
      { name: '💪 Loser MVP', value: loserLine, inline: false }
    )
    .setFooter({ text: BRANDING });
}

async function syncVotePanel(guild, match) {
  const room = guild.channels.cache.get(match.channelId2);
  if (!room) return;
  const embed = buildVotePanelEmbed(match);
  if (match.votePanelMessageId) {
    const msg = await fetchMessage(room, match.votePanelMessageId);
    if (msg) {
      await msg.edit({ embeds: [embed] }).catch(e => note('edit', e));
      return;
    }
  }
  const sent = await room.send({ embeds: [embed] }).catch(() => null);
  if (sent) {
    match.votePanelMessageId = sent.id;
    manager.persistMatches();
  }
}

async function clearVotePanel(guild, match) {
  const room = guild.channels.cache.get(match.channelId2);
  if (room && match.votePanelMessageId) {
    const msg = await fetchMessage(room, match.votePanelMessageId);
    if (msg) await msg.delete().catch(e => note('delete', e));
  }
  match.votePanelMessageId = null;
  manager.persistMatches();
}

function buildMainMatchEmbed(match, guild) {
  const display = getModeConfig(match.mode).displayName;
  const icon = guild && guild.iconURL ? guild.iconURL({ size: 128 }) : null;
  const t1Field = teamPanel(match.team1, match.mode || 'amo', match.teamSize, guild) || '*Empty*';
  const t2Field = teamPanel(match.team2, match.mode || 'amo', match.teamSize, guild) || '*Empty*';

  const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
  const mentions = allPlayers.map(id => `<@${id}>`).join(' ');
  const roleMentions = (config.matchPingRoles || []).map(id => `<@&${id}>`).join(' ');
  const pingBlock = [mentions, roleMentions].filter(Boolean).join('\n');

  // Result state gets colour-coded fields and a points breakdown, instead of
  // one flat status line that mixed both MVPs together on a single row.
  const resultFields = [];
  let status = '⏳ **Waiting for captains to vote...**';

  if (match.winnerVoteSet && match.mvpWinnerId) {
    resultFields.push({
      name: '🏆 WINNER MVP',
      value: `<@${match.mvpWinnerId}>\n**+${REWARDS.winnerMvp}** pts`,
      inline: true
    });
  }
  if (match.loserVoteSet && match.mvpLoserId) {
    resultFields.push({
      name: '💪 LOSER MVP',
      value: `<@${match.mvpLoserId}>\n**+${REWARDS.loserMvp}** pts`,
      inline: true
    });
  }
  if (resultFields.length) {
    status = resultFields.length === 2
      ? '✅ **Both MVPs decided**'
      : '⏳ **One captain vote left**';
  }
  if (match.resultStatus) status = String(match.resultStatus);

  const fields = [
    { name: `${config.emojis.team1} TEAM 1 — \`${match.team1.length}/${match.teamSize}\``, value: t1Field, inline: true },
    { name: `${config.emojis.team2} TEAM 2 — \`${match.team2.length}/${match.teamSize}\``, value: t2Field, inline: true },
    { name: '⚡ STATUS', value: status || '—' }
  ];
  // Same wording as the lobby, so the style reads identically in both places.
  const styleText = styleLine(match);
  if (styleText) fields.push({ name: '🎨 STYLE', value: styleText, inline: true });
  if (resultFields.length) fields.push(...resultFields);

  // withBanner() fills the image slot, which sits alongside the thumbnail.
  // The per-match room channels get the same artwork as the lobby, so a player
  // who jumps straight into the match channel still sees the server banner.
  return withBanner(new EmbedBuilder()
      .setTitle(`${config.emojis.game} Custom Room • ${match.teamSize}v${match.teamSize} • ${display}`)
      .setColor(resultColor(match))
      .setDescription(
        `${pingBlock ? `📣 ${pingBlock}\n\n` : ''}` +
        codeLine('🔑 Room ID', match.roomId) + '\n' +
        codeLine('🔒 Password', match.password)
      )
      .addFields(fields)
      .setFooter({ text: BRANDING })
    .setThumbnail(icon), guild);
}

// Winner side goes gold, loser side goes red, everything else blurple -- except
// an amo-yes match, which wears its chosen style's colour until there is a result
// to report. The style is set by the host, so it is applied before, never after.
function resultColor(match) {
  if (match && match.settled) return COLORS.gold;
  if (match && match.resultStatus && /fail|error|didn't match|expired/i.test(String(match.resultStatus))) return COLORS.danger;
  const theme = styleTheme(match);
  if (theme) return theme.color;
  return COLORS.primary;
}

async function updateResultBox(guild, match) {
  const roomChannel = guild.channels.cache.get(match.channelId2);
  if (!roomChannel || !match.resultMessageId) return;
  const msg = await fetchMessage(roomChannel, match.resultMessageId);
  if (!msg) return;
  await msg.edit({ embeds: [buildMainMatchEmbed(match, guild)], components: buildMatchMenu(match) }).catch(e => note('edit', e));
}

// The announcement posted once both teams are full.
//
// It replaces the lobby box as the last thing shown in the matches channel, so
// it carries the final rosters rather than the join prompts. The banner image is
// the server banner when there is one, falling back to the icon, and the Free
// Fire logo sits in the title so the message is recognisable at a glance in a
// busy channel.
function buildFullMatchBanner(guild, match) {
  const size = match.teamSize || 2;
  const mode = match.mode || 'amo';
  const t1 = teamPanel(match.team1, mode, size, guild);
  const t2 = teamPanel(match.team2, mode, size, guild);
  const strip = slotStrip(size, size, size);
  const ts = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle(`${config.emojis.game} ALL TEAMS FULL • ${getModeConfig(mode).displayName} ${size}v${size}`)
    .setColor(COLORS.gold)
    .setDescription(
      `${strip}  **${size * 2}/${size * 2}**\n` +
      `**All players have joined.** The lobby is now locked — no one can join or leave.\n` +
      `Moving everyone to their team voice channel <t:${ts}:R>.`
    )
    .addFields(
      { name: `${config.emojis.team1} TEAM 1  \`${size}/${size}\``, value: t1, inline: true },
      { name: `${config.emojis.team2} TEAM 2  \`${size}/${size}\``, value: t2, inline: true }
    )
    .addFields({
      name: '📋 What happens now',
      value: [
        'Join the **team voice channel** for your side.',
        `Host <@${match.creatorId}> starts the game in the custom room.`,
        'When it ends, the **captains** of each team vote the MVP and points are awarded.'
      ].join('\n'),
      inline: false
    })
    .setFooter({ text: BRANDING });

  // Server banner if it has one, otherwise the icon. Either way the message gets
  // a wide image, which is what makes it read as an announcement.
  try {
    const banner = guild && guild.bannerURL ? guild.bannerURL({ size: 512 }) : null;
    if (banner) return embed.setImage(banner);
  } catch (e) { /* guild may be partial */ }
  return withThumbnail(embed, guild);
}

async function startFullMatch(guild, match) {
  if (match.status === 'full') return null;
  match.status = 'full';
  manager.touchMatch(match);
  manager.persistMatches();

  // Channel creation can fail (rate limits, missing Manage Channels, deleted
  // category). These calls were previously unguarded, so a throw left the match
  // stuck at status 'full' with no voice channels and no room channel --
  // and nothing ever cleans that up, because cleanupExpired only reaps
  // 'waiting' matches. Roll back to 'waiting' so the lobby stays usable.
  let team1Channel = null;
  let team2Channel = null;
  let roomChannel = null;
  try {
    ({ team1Channel, team2Channel } = await manager.createVoiceChannels(guild, match));
    roomChannel = await manager.createChannel(guild, match);
  } catch (e) {
    console.error(`[MATCH] match ${match.id} failed to create channels:`, e.message);
    errLog('startFullMatch channel creation failed:', e);
    try {
      // Best-effort cleanup so a half-created pair is not left behind.
      if (team1Channel) await team1Channel.delete().catch(e => note('delete', e));
      if (team2Channel) await team2Channel.delete().catch(e => note('delete', e));
      if (roomChannel) await roomChannel.delete().catch(e => note('delete', e));
    } catch (e2) { /* ignore */ }
    match.voiceChannels = [];
    match.channelId2 = null;
    match.voice1Id = null;
    match.voice2Id = null;
    match.status = 'waiting';
    manager.persistMatches();
    const ch = guild.channels.cache.get(match.channelId);
    if (ch && match.message) {
      const msg = await fetchMessage(ch, match.message);
      if (msg) {
        // Pass both rows through, not just the first: the join buttons and the
        // leave/cancel actions live on separate rows now.
        await msg.edit({
          embeds: [buildMatchBoxEmbed(guild, match, null)],
          components: buildMatchButtons(match, client.user.id)
        }).catch(e => note('edit', e));
      }
    }
    await syncJoinButtons(guild, match);
    return null;
  }

  await manager.movePlayersToVoice(guild, match, team1Channel, team2Channel);

  const apostado = guild.channels.cache.get(match.channelId);
  if (apostado) {
    const msg2 = await fetchMessage(apostado, match.message);
    if (msg2) {
      await msg2.edit({
        embeds: [buildMatchBoxEmbed(guild, match, null)],
        components: []
      }).catch(e => note('edit', e));
    }

    await clearJoinButtons(guild, match);

    // The banner is the last thing posted in the matches channel, so it states
    // plainly that everyone is in and the lobby is locked.
    const readyEmbed = buildFullMatchBanner(guild, match);
    await apostado.send({ embeds: [readyEmbed] }).catch(e => note('fullmatch-banner', e));
  }

  const roomChannelId = match.channelId2;

  match.winnerVotes = {};
  match.loserVotes = {};
  match.winnerVoteSet = false;
  match.loserVoteSet = false;
  match.mvpWinnerId = null;
  match.mvpLoserId = null;
  match.winnerTeam = null;
  match.loserTeam = null;
  match.resultStatus = null;
  match.voice1Id = team1Channel.id;
  match.voice2Id = team2Channel.id;
  manager.persistMatches();

  let boxMsg;
  try {
    const roomChat = guild.channels.cache.get(roomChannelId) || roomChannel;
    boxMsg = await roomChat.send({ embeds: [buildMainMatchEmbed(match, guild)], components: buildMatchMenu(match) });
  } catch (e) {
    console.error('Failed to post match result box:', e.message);
  }
  if (boxMsg) {
    match.resultMessageId = boxMsg.id;
    manager.persistMatches();
  }

  return { team1Channel, team2Channel, roomChannel };
}

function buildMatchButtons(match, userId) {
  // A full match is locked: nobody joins, nobody leaves. startFullMatch() already
  // strips the components off the lobby message, but any other caller reaching
  // here would rebuild them, so the lock is enforced where the buttons are made
  // rather than only where they are removed.
  if (match.status === 'full' || match.status === 'done' || match.status === 'cancelled') {
    return [];
  }

  const n1 = match.team1 ? match.team1.length : 0;
  const n2 = match.team2 ? match.team2.length : 0;
  const size = match.teamSize || 2;
  const full1 = n1 >= size;
  const full2 = n2 >= size;

  // Join buttons are the primary action, so they get their own row and both stay
  // green. A full team greys out instead of letting a player click straight into
  // a rejection.
  const joinTeam1 = new ButtonBuilder()
    .setCustomId(`join1_${match.id}`)
    .setEmoji(config.emojis.team1)
    .setLabel(full1 ? `Team 1 — Full (${n1}/${size})` : `Join Team 1 (${n1}/${size})`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(full1);

  const joinTeam2 = new ButtonBuilder()
    .setCustomId(`join2_${match.id}`)
    .setEmoji(config.emojis.team2)
    .setLabel(full2 ? `Team 2 — Full (${n2}/${size})` : `Join Team 2 (${n2}/${size})`)
    .setStyle(ButtonStyle.Success)
    .setDisabled(full2);

  const joinRow = new ActionRowBuilder().addComponents(joinTeam1, joinTeam2);

  const secondary = [
    new ButtonBuilder()
      .setCustomId(`leave_${match.id}`)
      .setEmoji('🚪')
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
  ];

  if (match.status === 'waiting') {
    // Discord components render once for everyone, so this cannot be hidden from
    // non-hosts here -- it is enforced when the button is pressed. The label says
    // who it is for so nobody wastes a click.
    secondary.push(
      new ButtonBuilder()
        .setCustomId(`cancel_${match.id}`)
        .setEmoji('❌')
        .setLabel('Cancel Match (Host)')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const actionRow = new ActionRowBuilder().addComponents(secondary);
  return [joinRow, actionRow];
}

async function syncJoinButtons(guild, match) {
  const channel = guild.channels.cache.get(match.channelId);
  if (!channel) return null;
  const components = buildMatchButtons(match, client.user.id);
  let btnMsg = null;
  if (match.buttonsMessageId) {
    btnMsg = await fetchMessage(channel, match.buttonsMessageId);
  }
  if (btnMsg) {
    await btnMsg.edit({ embeds: [], components }).catch(e => note('edit', e));
    return btnMsg;
  }
  const sent = await channel.send({ embeds: [], components }).catch(() => null);
  if (sent) {
    match.buttonsMessageId = sent.id;
    manager.persistMatches();
  }
  return sent;
}

async function clearJoinButtons(guild, match, fallbackContent) {
  const channel = guild.channels.cache.get(match.channelId);
  if (!channel || !match.buttonsMessageId) return;
  const btnMsg = await fetchMessage(channel, match.buttonsMessageId);
  if (btnMsg) {
    if (fallbackContent) {
      await btnMsg.edit({ content: fallbackContent, embeds: [], components: [] }).catch(e => note('edit', e));
    } else {
      await btnMsg.delete().catch(e => note('delete', e));
    }
  }
  match.buttonsMessageId = null;
  manager.persistMatches();
}

async function ensureStoreChannel(guild) {
  if (config.storeChannelId) {
    const existing = guild.channels.cache.get(config.storeChannelId);
    if (existing) return existing;
  }
  let ch = guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === 'store');
  if (!ch) {
    try {
      ch = await guild.channels.create({ name: 'store', type: ChannelType.GuildText });
    } catch (e) {
      console.log('[STORE] create store channel failed:', e.message);
      return null;
    }
  }
  config.storeChannelId = ch.id;
  return ch;
}

function buildStoreEmbed(items) {
  // The internal numeric id and the "1. 2. 3." numbering were both removed:
  // players pick items through the Buy button and select menu, so surfacing the
  // id was noise, and the numbering did not line up with menu ordering anyway.
  const list = items.map(it => {
    const icon = it.type === 'role' ? '👑' : '💎';
    const rolePart = it.type === 'role' && it.roleId ? `\n↳ <@&${it.roleId}>` : '';
    const stockPart = it.stock !== null && it.stock !== undefined
      ? `  📦 ${storeModule.isSoldOut(it) ? '**SOLD OUT**' : `**${it.stock}** left`}`
      : '';
    return `${icon} **${it.name}**  —  **${it.cost}** pts${stockPart}${rolePart}`;
  }).join('\n') || '*No items yet. Supervisors can add items with `!storeadd`.*';
  return new EmbedBuilder()
    .setTitle('🛒 STORE')
    .setColor(COLORS.info)
    .setDescription(list)
    .addFields(
      { name: '⚙️ HOW TO BUY', value: 'Press the **🛒 Buy** button below and choose an item.\nThe price is **deducted from your balance automatically**.\nItems with a 📦 counter are limited.' }
    )
    .setFooter({ text: BRANDING });
}

function buildStoreButtons(items) {
  const noItems = !items || items.length === 0 || items.every(i => storeModule.isSoldOut(i));
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('store_buy_open')
      .setEmoji('🛒')
      .setLabel('Buy')
      .setStyle(ButtonStyle.Success)
      .setDisabled(noItems)
  )];
}

async function syncStoreEmbed(guild, channelOverride) {
  if (!guild) return;
  let channel = channelOverride;
  if (!channel) channel = await ensureStoreChannel(guild);
  if (!channel) return;
  config.storeChannelId = channel.id;
  try {
    const msgs = await channel.messages.fetch({ limit: 30 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id && m.embeds && m.embeds[0] && m.embeds[0].title && String(m.embeds[0].title).toLowerCase().includes('store')) {
        await m.delete().catch(e => note('delete', e));
      }
    }
  } catch (e) {
    console.log('[STORE] cleanup old messages failed:', e.message);
  }
  const items = storeModule.getItems();
  const embed = buildStoreEmbed(items);
  const rows = buildStoreButtons(items);
  await channel.send({ embeds: [embed], components: rows }).catch(e => console.log('[STORE] sync send failed:', e.message));
  console.log(`[STORE] store embed synced in ${channel.id}`);
}

const LIVE_LB_CHANNEL_ID = '1545413924483113040';
// Cached id of the live leaderboard post. The old implementation fetched 30
// messages, deleted the embed and re-sent it on every refresh — and it is
// refreshed from ~12 call sites, several in tight pairs. Now we edit in place.
let liveLeaderboardMsgId = null;
let liveLeaderboardSyncing = false;
let liveLeaderboardQueued = false;

function buildCombinedLeaderboardEmbed(guild) {
  const ranked = computeCombinedRanking();
  const losses = {};
  for (const mode of ['amo', 'esport']) {
    try {
      const data = storage.loadPoints(mode);
      if (data && data.players) {
        for (const [uid, p] of Object.entries(data.players)) {
          losses[uid] = (losses[uid] || 0) + (p.losses || 0);
        }
      }
    } catch { /* ignore */ }
  }
  const ts = Math.floor(Date.now() / 1000);

  const embed = new EmbedBuilder()
    .setTitle('🏆 COMBINED LEADERBOARD')
    .setColor(COLORS.gold);

  if (!ranked.length) {
    embed.setDescription('No matches played yet.\n\nRun `!play` to host the first match.')
      .addFields({ name: '🤖 BOT STATUS', value: '🟢 **ON**' })
      .setFooter({ text: `Updated <t:${ts}:R> • ${BRANDING}` });
    return withThumbnail(embed, guild);
  }

  const winPct = (id, p) => {
    const played = (p.wins || 0) + (losses[id] || 0);
    return played ? `${Math.round(((p.wins || 0) / played) * 100)}%` : '—';
  };

  // Podium gets its own field per rank so the medals get real visual weight
  // instead of three lines of identical body text.
  const podiumFields = ranked.slice(0, 3).map(([id, p], i) => {
    const medal = ['🥇', '🥈', '🥉'][i];
    return {
      name: `${medal} #${i + 1}`,
      value: `<@${id}>\n**${fmtNum(p.totalPoints)}** pts  ·  ${p.wins || 0}W/${losses[id] || 0}L  ·  ${winPct(id, p)}`,
      inline: true
    };
  });

  const rest = ranked.slice(3, 10).map(([id, p], i) => {
    return `**#${i + 4}**  <@${id}>  ·  **${fmtNum(p.totalPoints)}** pts  ·  ${p.wins || 0}W/${losses[id] || 0}L`;
  }).join('\n');

  embed.addFields(podiumFields);
  if (rest) embed.addFields({ name: '─────────────', value: rest });
  embed.addFields({ name: '🤖 BOT STATUS', value: '🟢 **ON**' });
  embed.setFooter({ text: `${ranked.length} ranked • Updated <t:${ts}:R> • ${BRANDING}` });
  // The live leaderboard is one of the notice channels, so it carries the server
  // banner above the standings. The icon stays as the thumbnail.
  return withBanner(withThumbnail(embed, guild), guild);
}

async function syncCombinedLeaderboard(guild) {
  if (!guild) return;
  // Collapse concurrent refreshes: if a sync is already running, remember that
  // another one was requested and run exactly one more pass afterwards.
  if (liveLeaderboardSyncing) {
    liveLeaderboardQueued = true;
    return;
  }
  liveLeaderboardSyncing = true;
  try {
    const channel = guild.channels.cache.get(LIVE_LB_CHANNEL_ID);
    if (!channel) return;
    const embed = buildCombinedLeaderboardEmbed(guild);
    const payload = { embeds: [embed] };

    if (liveLeaderboardMsgId) {
      const existing = await fetchMessage(channel, liveLeaderboardMsgId);
      if (existing) {
        await existing.edit(payload).catch(() => { liveLeaderboardMsgId = null; });
        if (liveLeaderboardMsgId) {
          console.log(`[LB] combined leaderboard updated in ${channel.id}`);
          return;
        }
      } else {
        liveLeaderboardMsgId = null;
      }
    }

    if (!liveLeaderboardMsgId) {
      // Recover the existing post after a restart, or post a new one.
      const msgs = await channel.messages.fetch({ limit: 30 }).catch(() => null);
      if (msgs) {
        for (const m of msgs.values()) {
          if (m.author.id === client.user.id && m.embeds && m.embeds[0] && String(m.embeds[0].title || '').includes('COMBINED LEADERBOARD')) {
            liveLeaderboardMsgId = m.id;
            await m.edit(payload).catch(() => { liveLeaderboardMsgId = null; });
            break;
          }
        }
      }
      if (!liveLeaderboardMsgId) {
        const sent = await channel.send(payload).catch(() => null);
        if (sent) liveLeaderboardMsgId = sent.id;
      }
    }
    if (liveLeaderboardMsgId) console.log(`[LB] combined leaderboard synced in ${channel.id}`);
  } catch (e) {
    console.log('[LB] sync failed:', e.message);
  } finally {
    liveLeaderboardSyncing = false;
    if (liveLeaderboardQueued) {
      liveLeaderboardQueued = false;
      setTimeout(() => syncCombinedLeaderboard(guild).catch(e => note('leaderboard', e)), 50);
    }
  }
}

function refreshCombinedLeaderboard(guild) {
  if (!guild) return;
  syncCombinedLeaderboard(guild).catch(e => note('leaderboard', e));
}

const reportDrafts = new Map();
const cheatProofPending = new Map();
const REPORT_PLATFORM_ICON = { PC: '🖥️', Android: '🤖', iOS: '🍎' };
const DEFAULT_CHECKER_ROLE_IDS = ['1537301155955216394', '1537811347813695488', '1537224612763537418'];

function getCheckerRoleIds() {
  const S = settingsStore.loadSettings();
  if (Array.isArray(S.checkerRoleIds) && S.checkerRoleIds.length) return S.checkerRoleIds.slice();
  if (S.checkerRoleId) return [S.checkerRoleId];
  if (process.env.CHECKER_ROLE_ID) return process.env.CHECKER_ROLE_ID.split(',').map(s => s.trim()).filter(Boolean);
  return DEFAULT_CHECKER_ROLE_IDS.slice();
}

function getCheckerRoleId() {
  const ids = getCheckerRoleIds();
  return ids.length ? ids[0] : null;
}

function isChecker(member) {
  if (!member) return false;
  if (member.permissions.has('Administrator')) return true;
  if (hasCommandAccess(member)) return true;
  const ids = getCheckerRoleIds();
  return ids.some(rid => member.roles.cache.has(rid));
}

async function resolveReportPlayer(guild, text) {
  const t = String(text || '').trim();
  if (/^\d{15,20}$/.test(t)) {
    const m = await guild.members.fetch(t).catch(() => null);
    if (m) return { id: m.id, name: m.displayName || m.user.username };
  }
  const mention = t.match(/<@!?(\d{15,20})>/);
  if (mention) {
    const m = await guild.members.fetch(mention[1]).catch(() => null);
    if (m) return { id: m.id, name: m.displayName || m.user.username };
  }
  const members = await guild.members.fetch().catch(() => []);
  const lower = t.toLowerCase();
  const found = members.find(mm => (mm.displayName || mm.user.username).toLowerCase() === lower)
    || members.find(mm => (mm.displayName || mm.user.username).toLowerCase().includes(lower));
  if (found) return { id: found.id, name: found.displayName || found.user.username };
  return { id: null, name: t };
}

async function ensureReportButtonMessage(guild, channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id && m.components && m.components.length) await m.delete().catch(e => note('delete', e));
    }
  } catch (e) { /* ignore */ }
  const embed = new EmbedBuilder()
    .setTitle('🛡️ REPORT A PLAYER')
    .setColor(COLORS.danger)
    .setDescription(
      `Saw a cheater in a match? Report them here and let the team check it.\n` +
      `\`\`\`${divider('═')}\`\`\``
    )
    .addFields(
      { name: '📌 How it works', value: '**1.** Tap **Report Player**\n**2.** Name the player + pick their platform\n**3.** Checkers review it and run the tests' },
      { name: '💰 Cost', value: `**-${REPORT_COST} pts** from your balance`, inline: true },
      { name: '🎁 Reward', value: `**+${REPORT_REWARD} pts** + reward role if confirmed`, inline: true },
      { name: '⚠️ Note', value: 'False reports are **not refunded**. Only report real cheaters.' }
    )
    .setFooter({ text: BRANDING })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('report_player').setEmoji('🛡️').setLabel('Report Player').setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [withBanner(embed, channel.guild)], components: [row] }).catch(e => note('send', e));
}

async function ensureCheaterChannels(guild) {
  const S = settingsStore.loadSettings();

  let category = guild.channels.cache.get(S.exposeCategoryId || EXPOSE_CATEGORY_ID)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CHANNEL_NAMES.exposeCategory.toLowerCase());
  if (!category) {
    try {
      category = await guild.channels.create({ name: CHANNEL_NAMES.exposeCategory, type: ChannelType.GuildCategory });
    } catch (e) {
      console.log('[CHEAT] create category failed:', e.message);
    }
  }
  if (category) {
    S.exposeCategoryId = category.id;
    settingsStore.saveSettings(S);
    await renameIfDifferent(category, CHANNEL_NAMES.exposeCategory);
  }

  const checkerRoleIds = getCheckerRoleIds();

  let checkChannel = guild.channels.cache.get(CHECK_CHANNEL_ID)
    || guild.channels.cache.get(S.checkChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES.checkChannel.toLowerCase());
  if (!checkChannel) {
    try {
      checkChannel = await guild.channels.create({
        name: CHANNEL_NAMES.checkChannel,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create check channel failed:', e.message);
    }
  }
  if (checkChannel) {
    await renameIfDifferent(checkChannel, CHANNEL_NAMES.checkChannel);
    checkChannel.permissionOverwrites.create(guild.id, { deny: [PermissionsBitField.Flags.ViewChannel] }).catch(e => note('perms', e));
    for (const rid of checkerRoleIds) {
      checkChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(e => note('perms', e));
    }
    S.checkChannelId = checkChannel.id;
    settingsStore.saveSettings(S);
  }

  let reportChannel = guild.channels.cache.get(REPORT_CHANNEL_ID)
    || guild.channels.cache.get(S.reportChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES.reportChannel.toLowerCase());
  if (!reportChannel) {
    try {
      reportChannel = await guild.channels.create({
        name: CHANNEL_NAMES.reportChannel,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create report channel failed:', e.message);
    }
  }
  if (reportChannel) {
    await renameIfDifferent(reportChannel, CHANNEL_NAMES.reportChannel);
    reportChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(e => note('perms', e));
    for (const rid of checkerRoleIds) {
      reportChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(e => note('perms', e));
    }
    S.reportChannelId = reportChannel.id;
    settingsStore.saveSettings(S);
    await ensureReportButtonMessage(guild, reportChannel);
  }

  let exposeChannel = guild.channels.cache.get(EXPOSE_CHANNEL_ID)
    || guild.channels.cache.get(S.exposeChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES.exposeChannel.toLowerCase());
  if (!exposeChannel) {
    try {
      exposeChannel = await guild.channels.create({
        name: CHANNEL_NAMES.exposeChannel,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create expose channel failed:', e.message);
    }
  }
  if (exposeChannel) {
    await renameIfDifferent(exposeChannel, CHANNEL_NAMES.exposeChannel);
    exposeChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(e => note('perms', e));
    for (const rid of checkerRoleIds) {
      exposeChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(e => note('perms', e));
    }
    S.exposeChannelId = exposeChannel.id;
    settingsStore.saveSettings(S);
  }

  console.log(`[CHEAT] channels ensured (report ${S.reportChannelId}, check ${S.checkChannelId}, expose ${S.exposeChannelId})`);
}

function buildReportEmbed(guild, report) {
  // The checker channel banner is applied here rather than at each send site, so
  // every render of this embed -- new report, status change, claim -- carries it.
  const _emb = buildReportEmbedBase(guild, report);
  return withBanner(_emb, guild);
}

function buildReportEmbedBase(guild, report) {
  const statusMap = {
    pending: '⏳ Pending',
    claimed: '🙋 Claimed',
    clean: '✅ Marked Clean',
    marked: '🚫 Marked Cheater',
    cancelled: '🗑️ Cancelled'
  };
  const cheater = report.cheaterId ? `<@${report.cheaterId}>` : `**${report.cheaterName}**`;
  return new EmbedBuilder()
    .setTitle(`🛡️ CHEATER REPORT ${report.id}`)
    .setColor(COLORS.danger)
    .setDescription(`\`\`\`${divider('═')}\`\`\``)
    .addFields(
      { name: '👤 Reported player', value: cheater, inline: true },
      { name: '🌐 Platform', value: `${REPORT_PLATFORM_ICON[report.platform] || '🔘'} ${report.platform}`, inline: true },
      { name: '🗡️ Reported by', value: `<@${report.reporterId}>`, inline: true },
      { name: '⚡ Status', value: statusMap[report.status] || report.status, inline: true },
      { name: '🕒 At', value: `<t:${Math.floor(report.at / 1000)}:f>`, inline: true },
      { name: '🕵️ Checked by', value: report.checkedBy ? `<@${report.checkedBy}>` : (report.claimedBy ? `<@${report.claimedBy}>` : '—'), inline: true }
    )
    .setFooter({ text: BRANDING });
}

function buildReportButtons(report) {
  return [new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`rpt_clean_${report.id}`).setEmoji('✅').setLabel('Mark Clean').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`rpt_cheat_${report.id}`).setEmoji('🚫').setLabel('Mark Cheater').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`rpt_claim_${report.id}`).setEmoji('🙋').setLabel('Claim Check').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`rpt_cancel_${report.id}`).setEmoji('🗑️').setLabel('Cancel Check').setStyle(ButtonStyle.Secondary)
  )];
}

async function renderReportMessage(guild, report) {
  const S = settingsStore.loadSettings();
  const ch = guild.channels.cache.get(report.channelId || S.checkChannelId);
  if (!ch) return;
  const msg = await fetchMessage(ch, report.messageId);
  if (!msg) return;
  const final = ['clean', 'marked', 'cancelled'].includes(report.status);
  const content = report.status === 'marked' && report.checkedBy ? `⛔ Confirmed as cheater by <@${report.checkedBy}>` : '';
  await msg.edit({
    content,
    embeds: [buildReportEmbed(guild, report)],
    components: final ? [] : buildReportButtons(report)
  }).catch(e => note('edit', e));
}

async function postExpose(guild, report, checkerId, attachments, cheatType) {
  const S = settingsStore.loadSettings();
  const channel = guild.channels.cache.get(S.exposeChannelId);
  if (!channel) return;
  const cheaterName = report.cheaterId ? (await getPlayerName(guild, report.cheaterId)) : report.cheaterName;
  const embed = new EmbedBuilder()
    .setTitle('⛔ EXPOSED CHEATER')
    .setColor(COLORS.danger)
    .setDescription(
      `**👤 Cheater**  <@${report.cheaterId || '—'}>  (${cheaterName})\n` +
      `**🆔 Cheater ID**  \`${report.cheaterId || 'unknown'}\`\n` +
      `**🚫 Type of Cheat**  ${cheatType || 'Unknown'}\n` +
      `**📸 Proofs**  (see files below)\n` +
      `**🌐 Platform**  ${REPORT_PLATFORM_ICON[report.platform] || '🔘'} ${report.platform}\n` +
      `**🗡️ Reported by**  <@${report.reporterId}>\n` +
      `**🕵️ Checked by**  <@${checkerId}>\n` +
      `**Report**  ${report.id}\n` +
      `**🕒 At**  <t:${Math.floor(report.at / 1000)}:f>`
    )
    .setFooter({ text: BRANDING });
  if (attachments && attachments[0]) embed.setImage(attachments[0]);
  const files = (attachments || []).map(u => ({ attachment: u }));
  await channel.send({ embeds: [withBanner(embed, guild)], files }).catch((e) => console.log('[CHEAT] expose send failed:', e.message));
}

async function applyCheaterAction(guild, report) {
  const member = await guild.members.fetch(report.cheaterId).catch(() => null);
  if (member) {
    const res = await applyJail(guild, member).catch(() => ({ role: null, affected: [], removedRoles: [] }));
    await member.roles.add(CHEATER_ROLE_ID).catch(e => note('role', e));
    if (res.role) {
      jailModule.jailUser(report.cheaterId, res.role.id, guild.id, null, `Cheater (${report.id})`, report.checkedBy || 'checker', res.affected, res.removedRoles);
    }
    console.log(`[CHEAT] ${report.cheaterId} jailed + cheater role ${CHEATER_ROLE_ID} applied`);
  } else {
    console.log(`[CHEAT] cheater ${report.cheaterId || report.cheaterName} could not be resolved in guild`);
  }

  storage.adjustPoints(report.reporterId, REPORT_REWARD, 'amo');
  const roleId = settingsStore.loadSettings().cheaterMarkRoleId;
  if (roleId) {
    const reporter = await guild.members.fetch(report.reporterId).catch(() => null);
    if (reporter) await reporter.roles.add(roleId).catch(e => note('role', e));
  }
  refreshCombinedLeaderboard(guild);
  try {
    const reporter = await guild.members.fetch(report.reporterId).catch(() => null);
    if (reporter) {
      const msg = `🛡️ **Report ${report.id} confirmed!** The player you reported was marked as a cheater.\nYou earned **+${REPORT_REWARD} pts**${roleId ? ' and a reward role.' : '.'}`;
      await reporter.send(msg).catch(e => note('leaderboard', e));
    }
  } catch { /* ignore */ }
}

async function handleReportStart(interaction) {
  const bal = storage.getPlayerPoints(interaction.user.id, 'amo');
  if (bal.totalPoints < REPORT_COST) {
    return interaction.reply({ content: `❌ Reporting costs **${REPORT_COST} pts** (your balance: ${bal.totalPoints} pts). Earn more in matches.`, ephemeral: true });
  }
  const token = `d${Date.now()}_${Math.floor(Math.random() * 9999)}`;
  reportDrafts.set(token, { reporterId: interaction.user.id });
  setTimeout(() => reportDrafts.delete(token), 10 * 60 * 1000);

  const modal = new ModalBuilder().setCustomId(`reportmodal_${token}`).setTitle('🛡️ Report a player');
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('rpName').setLabel('Reported player (name)').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('rpId').setLabel('Player ID or @mention (optional)').setStyle(TextInputStyle.Short).setRequired(false).setPlaceholder('Paste the ID or mention — helps the checker')
    )
  );
  return interaction.showModal(modal);
}

async function handleReportModal(interaction) {
  const token = interaction.customId.replace('reportmodal_', '');
  const draft = reportDrafts.get(token);
  if (!draft) {
    return interaction.reply({ content: '⏳ That report session expired. Press **Report Player** again.', ephemeral: true });
  }
  const playerName = interaction.fields.getTextInputValue('rpName').trim();
  const extraId = interaction.fields.getTextInputValue('rpId').trim();
  await interaction.deferReply({ ephemeral: true });
  const resolved = await resolveReportPlayer(interaction.guild, extraId || playerName);
  draft.cheaterName = (resolved.name || playerName).slice(0, 32);
  draft.cheaterId = resolved.id;

  const embed = new EmbedBuilder()
    .setTitle('🌐 SELECT PLATFORM')
    .setColor(COLORS.info)
    .setDescription(
      `\`\`\`${divider('═')}\`\`\`\n` +
      `**👤 Reported player**  ${draft.cheaterId ? `<@${draft.cheaterId}>` : `**${draft.cheaterName}**`}\n` +
      `Select the platform they play on to finalize the report.`
    )
    .setFooter({ text: BRANDING })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`reportplat_${token}_pc`).setEmoji('🖥️').setLabel('PC').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`reportplat_${token}_android`).setEmoji('🤖').setLabel('Android').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`reportplat_${token}_ios`).setEmoji('🍎').setLabel('iOS').setStyle(ButtonStyle.Secondary)
  );
  return interaction.editReply({ embeds: [embed], components: [row] });
}

async function handleReportPlatform(interaction) {
  const parts = interaction.customId.replace('reportplat_', '').split('_');
  const token = parts.slice(0, 2).join('_');
  const platform = parts[2] || 'pc';
  const draft = reportDrafts.get(token);
  if (!draft) {
    return interaction.update({ embeds: [], components: [], content: '⏳ That report session expired. Start again with **Report Player**.' });
  }
  reportDrafts.delete(token);

  const bal = storage.getPlayerPoints(interaction.user.id, 'amo');
  if (bal.totalPoints < REPORT_COST) {
    return interaction.update({ embeds: [], components: [], content: `❌ You need **${REPORT_COST} pts** (balance: ${bal.totalPoints}).` });
  }
  storage.adjustPoints(interaction.user.id, -REPORT_COST, 'amo');

  const platformLabel = platform === 'pc' ? 'PC' : platform === 'android' ? 'Android' : 'iOS';
  const report = cheaterReports.addReport({
    reporterId: interaction.user.id,
    reporterName: interaction.user.displayName || interaction.user.username,
    cheaterName: draft.cheaterName,
    cheaterId: draft.cheaterId,
    platform: platformLabel,
    guildId: interaction.guild.id
  });

  const S = settingsStore.loadSettings();
  const checkChannel = interaction.guild.channels.cache.get(S.checkChannelId);
  if (checkChannel) {
    const msg = await checkChannel.send({
      embeds: [buildReportEmbed(interaction.guild, report)],
      components: buildReportButtons(report)
    }).catch(() => null);
    if (msg) {
      cheaterReports.updateReport(report.id, { channelId: checkChannel.id, messageId: msg.id });
      const ids = getCheckerRoleIds();
      const ping = ids.map(rid => `<@&${rid}>`).join(' ');
      if (ids.length) await msg.edit({
        content: `${ping} — new report ${report.id}!`,
        embeds: [buildReportEmbed(interaction.guild, report)],
        components: buildReportButtons(report)
      }).catch(e => note('edit', e));
    }
  }

  refreshCombinedLeaderboard(interaction.guild);
  const success = new EmbedBuilder()
    .setTitle('🛡️ REPORT SUBMITTED')
    .setColor(COLORS.success)
    .setDescription(`\`\`\`${divider('═')}\`\`\``)
    .addFields(
      { name: '💸 Cost deducted', value: `**-${REPORT_COST} pts**`, inline: true },
      { name: '🎁 Potential reward', value: `**+${REPORT_REWARD} pts** + role`, inline: true }
    )
    .setFooter({ text: BRANDING })
    .setTimestamp();
  return interaction.update({ embeds: [success], components: [] });
}

async function handleReportButton(interaction) {
  const parts = interaction.customId.replace('rpt_', '').split('_');
  const action = parts[0];
  const id = parts.slice(1).join('_');
  if (!isChecker(interaction.member)) {
    return interaction.reply({ content: '❌ Only **checkers** can use these buttons!', ephemeral: true });
  }
  const report = cheaterReports.getReport(id);
  if (!report) return interaction.reply({ content: '❌ Report not found.', ephemeral: true });

  if (action === 'claim') {
    if (report.claimedBy && report.claimedBy !== interaction.user.id) {
      return interaction.reply({ content: `❌ This report is already claimed by <@${report.claimedBy}>.`, ephemeral: true });
    }
    cheaterReports.updateReport(id, { claimedBy: interaction.user.id });
    await renderReportMessage(interaction.guild, cheaterReports.getReport(id));
    return interaction.reply({ content: `🙋 You claimed **${id}**.`, ephemeral: true });
  }

  if (action === 'cancel') {
    cheaterReports.updateReport(id, { status: 'cancelled' });
    await renderReportMessage(interaction.guild, cheaterReports.getReport(id));
    return interaction.reply({ content: `🗑️ Report **${id}** cancelled. Buttons removed — the message stays as history.`, ephemeral: true });
  }

  if (action === 'clean') {
    cheaterReports.updateReport(id, { status: 'clean', checkedBy: interaction.user.id });
    await renderReportMessage(interaction.guild, cheaterReports.getReport(id));
    return interaction.reply({ content: `✅ Report **${id}** marked as **clean**. No refund for the reporter.`, ephemeral: true });
  }

  if (action === 'cheat') {
    const cheatModal = new ModalBuilder()
      .setCustomId(`cheatmodal_${id}`)
      .setTitle(`🚫 Mark Cheater — ${report.id}`);

    const cheatTypeInput = new TextInputBuilder()
      .setCustomId('cheatTypeInput')
      .setLabel('Type of Cheat')
      .setPlaceholder('e.g. Aimbot, Wallhack, ESP, Speed Hack...')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    cheatModal.addComponents(new ActionRowBuilder().addComponents(cheatTypeInput));
    return interaction.showModal(cheatModal);
  }

  return interaction.reply({ content: '⚠️ Unknown report action.', ephemeral: true });
}

async function handleCheatModal(interaction) {
  if (!isChecker(interaction.member)) {
    return interaction.reply({ content: '❌ Only **checkers** can do this!', ephemeral: true });
  }
  const id = interaction.customId.replace('cheatmodal_', '');
  const report = cheaterReports.getReport(id);
  if (!report) return interaction.reply({ content: '❌ Report not found.', ephemeral: true });

  const cheatType = interaction.fields.getTextInputValue('cheatTypeInput').trim().slice(0, 80);
  if (!cheatType) return interaction.reply({ content: '❌ Please fill the **Type of Cheat** field.', ephemeral: true });

  cheaterReports.updateReport(id, { status: 'marked', checkedBy: interaction.user.id, claimedBy: interaction.user.id, cheatType });
  const updated = cheaterReports.getReport(id);
  await renderReportMessage(interaction.guild, updated);

  cheatProofPending.set(interaction.user.id, { reportId: id, cheatType });
  setTimeout(() => { if (cheatProofPending.get(interaction.user.id) && cheatProofPending.get(interaction.user.id).reportId === id) cheatProofPending.delete(interaction.user.id); }, 30 * 60 * 1000);

  return interaction.reply({ content: `🚫 **${report.id}** marked as cheater — type: **${cheatType}**.\n📸 Now **send the proof picture** in this channel. Once received, the exposé will be posted automatically.`, ephemeral: true });
}

async function handleProofDone(interaction) {
  if (!isChecker(interaction.member)) {
    return interaction.reply({ content: '❌ Only **checkers** can do this!', ephemeral: true });
  }
  const id = interaction.customId.replace('rpt_done_', '');
  const report = cheaterReports.getReport(id);
  if (!report) return interaction.reply({ content: '❌ Report not found.', ephemeral: true });

  let attachments = [];
  const thread = interaction.channel;
  if (thread && thread.isThread()) {
    try {
      const msgs = await thread.messages.fetch({ limit: 100 });
      for (const m of msgs.values()) {
        if (m.attachments) for (const a of m.attachments.values()) attachments.push(a.url);
      }
    } catch (e) { console.log('[CHEAT] fetch proof msgs failed:', e.message); }
  }
  attachments = attachments.slice(0, 10);

  await postExpose(interaction.guild, report, interaction.user.id, attachments, report.cheatType);
  if (report.cheaterId) {
    await applyCheaterAction(interaction.guild, report);
  } else {
    console.log(`[CHEAT] report ${id} marked cheater but no resolvable id — skipped jail/reward`);
  }

  const updated = cheaterReports.getReport(id);
  await renderReportMessage(interaction.guild, updated);

  await interaction.reply({ content: `⛔ **Exposé posted** for ${id}${report.cheaterId ? '' : ' — but the reported player had no resolvable ID (no jail/reward applied).'}`, ephemeral: true });
  try { if (thread && thread.isThread()) await thread.setArchived(true).catch(e => note('thread', e)); } catch { /* ignore */ }
}

const applyApps = new Map();
const APPLY_TYPE_LABEL = { checker: '🛡️ Checker', staff: '👥 Staff' };

function getStaffRoleIds() {
  const S = settingsStore.loadSettings();
  const set = new Set();
  for (const id of getCheckerRoleIds()) if (id) set.add(id);
  for (const id of (config.adminRoles || [])) if (id) set.add(id);
  if (S.applyCheckerRoleId) set.add(S.applyCheckerRoleId);
  if (S.applyStaffRoleId) set.add(S.applyStaffRoleId);
  return [...set];
}

function isStaff(member) {
  if (!member) return false;
  return member.permissions.has('Administrator') || hasCommandAccess(member) || isChecker(member);
}

async function getApplyRole(guild, roleType) {
  const S = settingsStore.loadSettings();
  if (roleType === 'checker') {
    if (S.applyCheckerRoleId && guild.roles.cache.get(S.applyCheckerRoleId)) return guild.roles.cache.get(S.applyCheckerRoleId);
    const firstExisting = getCheckerRoleIds().map(id => guild.roles.cache.get(id)).find(Boolean);
    if (firstExisting) return firstExisting;
    return guild.roles.cache.find(r => r.name.toLowerCase() === 'checker') || null;
  }
  if (S.applyStaffRoleId && guild.roles.cache.get(S.applyStaffRoleId)) return guild.roles.cache.get(S.applyStaffRoleId);
  const named = guild.roles.cache.find(r => r.name.toLowerCase() === 'staff');
  if (named) return named;
  const firstAdmin = (config.adminRoles || []).map(id => guild.roles.cache.get(id)).find(Boolean);
  return firstAdmin || null;
}

async function ensureApplyButtonMessage(guild, channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 20 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id && m.components && m.components.length) await m.delete().catch(e => note('delete', e));
    }
  } catch (e) { /* ignore */ }
  const embed = new EmbedBuilder()
    .setTitle('📋 ROLE APPLICATION')
    .setColor(COLORS.primary)
    .setDescription(
      `Want to join the team? Choose the role you are applying for below.\n` +
      `\`\`\`${divider('═')}\`\`\``
    )
    .addFields(
      { name: '🛡️ Checker', value: 'Keep matches clean — review reports, run tests and handle the proof checks.', inline: true },
      { name: '👥 Staff', value: 'Manage the server, events and help the community.', inline: true },
      { name: '📌 How it works', value: '**1.** Tap the role you want\n**2.** Fill in the quick form\n**3.** Staff interviews you in a voice channel' }
    )
    .setFooter({ text: BRANDING })
    .setTimestamp();
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('apply_start_checker').setEmoji('🛡️').setLabel('Apply as Checker').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('apply_start_staff').setEmoji('👥').setLabel('Apply as Staff').setStyle(ButtonStyle.Success)
  );
  await channel.send({ embeds: [withBanner(embed, channel.guild)], components: [row] }).catch(e => note('send', e));
}

async function ensureApplyChannels(guild) {
  const S = settingsStore.loadSettings();

  let category = guild.channels.cache.get(S.applyCategoryId || APPLY_CATEGORY_ID)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === CHANNEL_NAMES.applyCategory.toLowerCase());
  if (!category) {
    try {
      category = await guild.channels.create({ name: CHANNEL_NAMES.applyCategory, type: ChannelType.GuildCategory });
    } catch (e) {
      console.log('[APPLY] create category failed:', e.message);
    }
  }
  if (category) {
    S.applyCategoryId = category.id;
    settingsStore.saveSettings(S);
    await renameIfDifferent(category, CHANNEL_NAMES.applyCategory);
  }

  let applyChannel = guild.channels.cache.get(S.applyChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES.applyChannel.toLowerCase());
  if (!applyChannel) {
    try {
      applyChannel = await guild.channels.create({
        name: CHANNEL_NAMES.applyChannel,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[APPLY] create apply channel failed:', e.message);
    }
  }
  if (applyChannel) {
    await renameIfDifferent(applyChannel, CHANNEL_NAMES.applyChannel);
    applyChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(e => note('perms', e));
    S.applyChannelId = applyChannel.id;
    settingsStore.saveSettings(S);
    await ensureApplyButtonMessage(guild, applyChannel);
  }

  let queueChannel = guild.channels.cache.get(APPLY_QUEUE_CHANNEL_ID)
    || guild.channels.cache.get(S.applyQueueChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name.toLowerCase() === CHANNEL_NAMES.queueChannel.toLowerCase());
  if (!queueChannel) {
    try {
      queueChannel = await guild.channels.create({
        name: CHANNEL_NAMES.queueChannel,
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[APPLY] create queue channel failed:', e.message);
    }
  }
  if (queueChannel) {
    await renameIfDifferent(queueChannel, CHANNEL_NAMES.queueChannel);
    queueChannel.permissionOverwrites.create(guild.id, { deny: [PermissionsBitField.Flags.ViewChannel] }).catch(e => note('perms', e));
    for (const rid of getStaffRoleIds()) {
      queueChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(e => note('perms', e));
    }
    S.applyQueueChannelId = queueChannel.id;
    settingsStore.saveSettings(S);
  }

  const vcNames = [CHANNEL_NAMES.vcWaiting, CHANNEL_NAMES.vcChecker, CHANNEL_NAMES.vcStaff];
  for (const vcName of vcNames) {
    let vc = category ? category.children.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName) : guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName);
    if (!vc) {
      try {
        vc = await guild.channels.create({ name: vcName, type: ChannelType.GuildVoice, parent: category ? category.id : undefined });
      } catch (e) {
        console.log('[APPLY] create voice failed:', e.message);
      }
    }
    await renameIfDifferent(vc, vcName);
  }

  console.log(`[APPLY] channels ensured (apply ${S.applyChannelId}, queue ${S.applyQueueChannelId}, cat ${S.applyCategoryId})`);
}

function buildApplyEmbed(guild, app) {
  const statusMap = { pending: '⏳ Pending', accepted: '✅ Accepted', declined: '❌ Declined' };
  const colorMap = { pending: COLORS.info, accepted: COLORS.success, declined: COLORS.danger };
  const why = app.why.length > 500 ? app.why.slice(0, 500) + '…' : app.why;
  const rank = guild ? storage.getRankBadge(app.userId, 'amo') || '' : '';
  const embed = new EmbedBuilder()
    .setTitle(`${APPLY_TYPE_LABEL[app.roleType] || app.roleType} — ${app.id}`)
    .setColor(colorMap[app.status] || COLORS.info)
    .setDescription(`\`\`\`${divider('═')}\`\`\``)
    .addFields(
      { name: '🧑 Applicant', value: `<@${app.userId}>${rank ? ` ${rank}` : ''}`, inline: true },
      { name: '🎮 In-game name', value: app.ign, inline: true },
      { name: '📝 Why / experience', value: why },
      { name: '⚡ Status', value: statusMap[app.status] || app.status, inline: true },
      { name: '🕒 Submitted', value: `<t:${Math.floor(app.at / 1000)}:f>`, inline: true }
    )
    .setFooter({ text: BRANDING });
  // Banner lives in the builder so the queue message keeps it through every
  // status change (waiting VC, accepted, declined) rather than only on creation.
  return withBanner(embed, guild);
}

function buildApplyButtons(appId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_wait_${appId}`).setEmoji('⏳').setLabel('Waiting VC').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`app_checkervc_${appId}`).setEmoji('🛡️').setLabel('Checker VC').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`app_staffvc_${appId}`).setEmoji('👥').setLabel('Staff VC').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_accept_${appId}`).setEmoji('✅').setLabel('Accept & Grant Role').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`app_decline_${appId}`).setEmoji('❌').setLabel('Decline').setStyle(ButtonStyle.Danger)
    )
  ];
}

async function handleApplyStart(interaction, roleType) {
  if (isStaff(interaction.member)) {
    return interaction.reply({ content: 'ℹ️ You already have staff roles — no application needed.', ephemeral: true });
  }
  const modal = new ModalBuilder().setCustomId(`applymodal_${roleType}_${Date.now()}_${Math.floor(Math.random() * 9999)}`).setTitle(`${APPLY_TYPE_LABEL[roleType]} — ROLE APPLICATION`);
  modal.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('applyIgn').setLabel('In-game name').setStyle(TextInputStyle.Short).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('applyAge').setLabel('Age').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('minimum 13')
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('applyWhy').setLabel('Why trust you? (experience / activity)').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Tell us about your experience, schedule and why you deserve the role.')
    )
  );
  return interaction.showModal(modal);
}

async function handleApplyModal(interaction) {
  const parts = interaction.customId.replace('applymodal_', '').split('_');
  const roleType = ['checker', 'staff'].includes(parts[0]) ? parts[0] : 'checker';
  const ign = interaction.fields.getTextInputValue('applyIgn').trim().slice(0, 32) || 'unknown';
  const age = interaction.fields.getTextInputValue('applyAge').trim().slice(0, 8) || '?';
  const why = (interaction.fields.getTextInputValue('applyWhy') || '').trim().slice(0, 1000) || 'No details provided';

  const app = {
    id: `A${Date.now()}${Math.floor(Math.random() * 90 + 10)}`,
    userId: interaction.user.id,
    ign: `${ign} (${age})`,
    why,
    roleType,
    status: 'pending',
    at: Date.now()
  };
  applyApps.set(app.id, app);

  const S = settingsStore.loadSettings();
  const queueChannel = interaction.guild.channels.cache.get(S.applyQueueChannelId);
  let posted = false;
  if (queueChannel) {
    const msg = await queueChannel.send({
      embeds: [buildApplyEmbed(interaction.guild, app)],
      components: buildApplyButtons(app.id)
    }).catch(() => null);
    if (msg) {
      app.messageId = msg.id;
      app.channelId = queueChannel.id;
      posted = true;
    }
  }

  const reply = posted
    ? { embeds: [new EmbedBuilder()
        .setTitle('✅ APPLICATION SUBMITTED')
        .setColor(COLORS.success)
        .setDescription(`\`\`\`${divider('═')}\`\`\``)
        .addFields(
          { name: '📄 Application', value: app.id, inline: true },
          { name: '🛡️ Role', value: APPLY_TYPE_LABEL[roleType], inline: true }
        )], ephemeral: true, content: 'Staff will review it and interview you in a voice channel. Keep an eye on your DMs.' }
    : { content: '❌ Could not post your application — try again later.', ephemeral: true };
  return interaction.reply(reply);
}

async function handleApplyStaffButton(interaction) {
  if (!isStaff(interaction.member)) {
    return interaction.reply({ content: '❌ Only staff can use these buttons!', ephemeral: true });
  }
  const parts = interaction.customId.replace('app_', '').split('_');
  const action = parts[0];
  const id = parts.slice(1).join('_');
  const app = applyApps.get(id);
  if (!app) return interaction.reply({ content: '❌ Application not found. (Restarts clear the in-memory store.)', ephemeral: true });

  const member = await interaction.guild.members.fetch(app.userId).catch(() => null);

  if (action === 'wait' || action === 'checkervc' || action === 'staffvc') {
    const vcName = action === 'wait' ? CHANNEL_NAMES.vcWaiting : action === 'checkervc' ? CHANNEL_NAMES.vcChecker : CHANNEL_NAMES.vcStaff;
    let vc = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName);
    if (!vc) {
      const cat = interaction.guild.channels.cache.get(settingsStore.loadSettings().applyCategoryId || APPLY_CATEGORY_ID);
      vc = cat ? cat.children.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName) : null;
    }
    if (!vc) return interaction.reply({ content: '⚠️ Voice channel not found.', ephemeral: true });
    if (!member || !member.voice || !member.voice.channel) {
      return interaction.reply({ content: `ℹ️ <@${app.userId}> is not in any voice channel. Ask them to join one first, or mention them.`, ephemeral: true });
    }
    await member.voice.setChannel(vc.id).catch(e => note('voice', e));
    return interaction.reply({ content: `🎙️ Moved <@${app.userId}> to **${vcName}**.`, ephemeral: true });
  }

  if (action === 'accept') {
    const role = await getApplyRole(interaction.guild, app.roleType);
    if (!role) {
      return interaction.reply({ content: '❌ No role found to grant for **' + APPLY_TYPE_LABEL[app.roleType] + '**. Assign `&setrole ' + app.roleType + ' <role>`.' });
    }
    if (member) {
      await member.roles.add(role).catch(e => note('role', e));
    }
    app.status = 'accepted';
    app.decidedBy = interaction.user.id;
    await renderApplyMessage(interaction.guild, app);
    try {
      const dm = await interaction.user.client.users.fetch(app.userId).catch(() => null);
      if (dm) await dm.send(`🎉 **Congratulations!** Your **${APPLY_TYPE_LABEL[app.roleType]}** application (${app.id}) was **accepted**! You now have the <@&${role.id}> role.`);
    } catch { /* ignore */ }
    return interaction.reply({ content: `✅ **${app.id}** accepted — <@${app.userId}> got <@&${role.id}>.`, ephemeral: true });
  }

  if (action === 'decline') {
    app.status = 'declined';
    app.decidedBy = interaction.user.id;
    await renderApplyMessage(interaction.guild, app);
    try {
      const dm = await interaction.user.client.users.fetch(app.userId).catch(() => null);
      if (dm) await dm.send(`❌ **Application ${app.id}** was declined. You can try again later.`);
    } catch { /* ignore */ }
    return interaction.reply({ content: `❌ **${app.id}** declined.`, ephemeral: true });
  }

  return interaction.reply({ content: '⚠️ Unknown apply action.', ephemeral: true });
}

async function renderApplyMessage(guild, app) {
  const ch = guild.channels.cache.get(app.channelId || settingsStore.loadSettings().applyQueueChannelId);
  if (!ch) return;
  const msg = await fetchMessage(ch, app.messageId);
  if (!msg) return;
  await msg.edit({
    embeds: [buildApplyEmbed(guild, app)],
    components: app.status === 'pending' ? buildApplyButtons(app.id) : []
  }).catch(e => note('edit', e));
}

async function handleBuy(interaction, itemId) {
  const item = storeModule.getItems().find(i => i.id === String(itemId).trim());
  if (!item) {
    return interaction.reply({ content: '❌ That item no longer exists. Ask a supervisor to refresh the store.', ephemeral: true });
  }
  if (storeModule.isSoldOut(item)) {
    return interaction.reply({ content: '❌ This item is **SOLD OUT**!', ephemeral: true });
  }
  if (item.type !== 'role' && item.type !== 'gems' && item.type !== 'diamond') {
    return interaction.reply({ content: '❌ Unknown item type.', ephemeral: true });
  }

  const member = interaction.member;
  if (item.type === 'role') {
    const role = interaction.guild.roles.cache.get(item.roleId);
    if (!role) {
      return interaction.reply({ content: '❌ The role for this item no longer exists. Ask a supervisor. (No points deducted)', ephemeral: true });
    }
    if (member.roles.cache.has(role.id)) {
      return interaction.reply({ content: '❌ You already own this role! (No points deducted)', ephemeral: true });
    }
  }

  const balance = storage.getPlayerPoints(member.id, 'amo').totalPoints;
  if (balance < item.cost) {
    return interaction.reply({ content: `❌ Not enough points! You have **${balance} pts**, this item costs **${item.cost} pts**.`, ephemeral: true });
  }

  const consumed = storeModule.consumeStock(item.id);
  if (!consumed.ok) {
    return interaction.reply({ content: consumed.reason === 'sold_out' ? '❌ This item was just **SOLD OUT**!' : '❌ That item no longer exists.', ephemeral: true });
  }

  if (item.type === 'role') {
    const granted = await member.roles.add(item.roleId).then(() => true).catch(() => false);
    if (!granted) {
      return interaction.reply({ content: '❌ Could not grant the role. **No points were deducted.** Ask a supervisor.', ephemeral: true });
    }
  }

  storage.adjustPoints(member.id, -item.cost, 'amo');
  storeModule.logPurchase({
    id: `${Date.now()}_${interaction.user.id}`, userId: interaction.user.id, itemId: item.id,
    itemName: item.name, cost: item.cost, type: item.type, roleId: item.type === 'role' ? item.roleId : null,
    mode: 'amo', claimed: true, at: Date.now()
  });

  if (item.type === 'role') {
    applyRankOneRole(interaction.guild, computeCombinedRanking()).catch(e => note('applications', e));
  } else {
    const logsChannel = interaction.guild.channels.cache.get(config.logsChannelId);
    const staffMention = config.staffRoles.length ? config.staffRoles.map(id => `<@&${id}>`).join(' ') : '';
    if (logsChannel) {
      await logsChannel.send({
        content: `💎 **Diamond/Gems purchase!**\nBuyer: <@${member.id}>\nItem: **${item.name}** (${item.cost} pts deducted)\nStaff, please deliver the diamonds.${staffMention ? `\n${staffMention}` : ''}`
      }).catch(e => note('send', e));
    } else {
      await interaction.channel.send({ content: `💎 <@${member.id}> bought **${item.name}** (${item.cost} pts deducted). ${staffMention || 'Staff'}, please deliver the diamonds.` }).catch(e => note('send', e));
    }
  }

  if (syncStoreEmbed) syncStoreEmbed(interaction.guild).catch(e => note('send', e));
  refreshCombinedLeaderboard(interaction.guild);
  const suffix = item.type === 'role' ? `Role <@&${item.roleId}> granted.` : `Staff has been notified to deliver your diamonds 💎.`;
  return interaction.reply({ content: `✅ Purchased **${item.name}**! Spent **${item.cost} pts** from your balance. ${suffix}`, ephemeral: true });
}

client.invitesCache = new Map();

async function syncInviteCache(guild) {
  const map = client.invitesCache.get(guild.id) || new Map();
  try {
    const invites = await guild.invites.fetch().catch(() => null);
    if (invites) {
      for (const inv of invites.values()) {
        map.set(inv.code, { uses: inv.uses || 0, inviterId: inv.inviter ? inv.inviter.id : null });
      }
      client.invitesCache.set(guild.id, map);
    }
  } catch (e) {}
  return map;
}

async function cleanupOrphanTeamChannels(guild) {
  if (!guild) return;
  const cat = config.roomCategoryId || '1545316338145165332';
  const teamChannels = guild.channels.cache.filter(c =>
    c.parentId === cat &&
    c.type === ChannelType.GuildVoice &&
    /^[🟢🔴]\s*Team\s*[12]\s*-\s*\d/.test(c.name)
  );
  for (const ch of teamChannels.values()) {
    if (manager.findMatchByVoiceChannel(ch.id)) continue;
    if (ch.members.size > 0) {
      console.log(`[VOICE] orphan team channel ${ch.id} (${ch.name}) still has ${ch.members.size} member(s) — kept and logged`);
      maintenance.record('stuckInVoice', new Error(`Orphan team voice ${ch.name} (${ch.id}) still has ${ch.members.size} member(s) after cancel/finish`), { source: 'voice-sweep' });
      continue;
    }
    try {
      await ch.delete('Orphaned team voice channel (match cancelled/finished)');
      console.log(`[VOICE] deleted orphan team channel ${ch.id} (${ch.name})`);
      maintenance.log({ ts: new Date().toISOString(), level: 'info', component: 'voice', severity: 'low', type: 'cleanup', problem: 'Orphaned team voice channel found after match cancel/finish.', cause: null, affectedSystem: 'Temporary voice channels', recommendedFix: null, risk: 'low', actionTaken: `Deleted empty orphan team channel ${ch.id} (${ch.name})`, result: 'ok', autoFixed: true, needsApproval: false });
    } catch (e) {
      console.log(`[VOICE] could not delete orphan ${ch.id}: ${e.message}`);
    }
  }
}

async function resumeInterruptedTeardowns(guild) {
  for (const m of manager.getAllMatches()) {
    try {
      if (m.phase === 'CANCELLING' || m.phase === 'CANCELLED') {
        console.log(`[RESTART] resuming cancelled-match cleanup for ${m.id} (phase=${m.phase})`);
        await cancelMatch(guild, m, `🧹 **Match cleanup resumed after a bot restart.**`).catch(e => note('restart-cleanup', e));
      } else if (m.phase === 'FINISHING' || m.phase === 'FINISHED') {
        console.log(`[RESTART] resuming finished-match cleanup for ${m.id} (phase=${m.phase})`);
        await manager.finishMatch(guild, m).catch(e => note('match-lifecycle', e));
      }
    } catch (e) {
      console.log(`[RESTART] cleanup resume error for ${m.id}: ${e.message}`);
    }
  }
}

async function detectStuckVoicePlayers(guild) {
  const cat = config.roomCategoryId || '1545316338145165332';
  const owners = [];
  for (const m of manager.getAllMatches()) {
    for (const chId of (m.voiceChannels || [])) owners.push(chId);
  }
  const teamChannels = guild.channels.cache.filter(c => c.parentId === cat && c.type === ChannelType.GuildVoice && /^[🟢🔴]\s*Team\s*[12]\s*/.test(c.name));
  for (const ch of teamChannels.values()) {
    if (ch.members.size === 0) continue;
    if (owners.includes(ch.id)) continue;
    maintenance.record('stuckInVoice', new Error(`Players remain in unowned team voice ${ch.id} (${ch.name}): ${[...ch.members.keys()].join(',')}`), { source: 'voice-sweep' });
  }
}

client.once(Events.ClientReady, async (c) => {
  console.log(`✅ Logged in as ${c.user.tag}!`);
  for (const mode of ['amo', 'esport']) {
    try {
      const data = storage.loadPoints(mode);
      const n = Object.keys(data.players || {}).length;
      if (n > 0) console.log(`[DATA] ${mode}: ${n} players with points loaded`);
    } catch (e) {
      console.log(`[DATA] ${mode}: load failed:`, e.message);
    }
  }
  c.user.setActivity('Free Fire | !play', { type: 3 });
  // An earlier version registered a /play slash command. It has been removed,
  // so clear the global command set once -- otherwise Discord keeps showing a
  // command the bot no longer answers. A failure here is not fatal.
  slash.clearGlobal(c).then(r => {
    if (r && r.ok) console.log('[SLASH] global command set cleared');
    else if (r && r.error) console.log('[SLASH] clear failed (harmless):', r.error);
  }).catch(e => console.log('[SLASH] clear error (harmless):', e.message));
  postCommandsInfoWithRetry();
  const runEnsure = async (g) => {
    try { await ensureCheaterChannels(g); } catch (e) { console.log(`[CHEAT] ensure error: ${e.message}`); }
    try { await ensureApplyChannels(g); } catch (e) { console.log(`[APPLY] ensure error: ${e.message}`); }
  };
  for (const g of c.guilds.cache.values()) {
    runEnsure(g);
  }
  // The standing help post in the tournament channel. Recorded in settings, so it
  // is posted once and then kept up to date rather than piling up duplicates on
  // every restart.
  for (const g of c.guilds.cache.values()) {
    ensureGuidePosted(g)
      .catch(e => console.log('[GUIDE] post error (harmless):', e.message));
  }

  // One-time: add the server banner to messages posted before withBanner()
  // existed. Runs after the channel ensure above so the ids are populated, and
  // it records itself in settings so it never runs twice.
  for (const g of c.guilds.cache.values()) {
    backfillBanner.run(g, c.user.id)
      .then(r => {
        if (r.ran) {
          console.log(`[BANNER] backfill edited ${r.edited} message(s)`, r.channels || {}, r.errors || '');
        }
      })
      .catch(e => console.log('[BANNER] backfill error (harmless):', e.message));
  }
  // Deliberate retry: the first pass can race with channel cache warming.
  setTimeout(() => {
    for (const g of c.guilds.cache.values()) runEnsure(g);
  }, 45000);
  const guild = c.guilds.cache.first();
  const ranked = computeCombinedRanking();
  if (guild && ranked.length) applyRankOneRole(guild, ranked).catch(e => note('applications', e));
  for (const g of c.guilds.cache.values()) {
    syncInviteCache(g);
  }
  const selfHealed = manager.validateAllMatches();
  if (selfHealed.length) {
    console.log(`[SELF-HEAL] startup sweep repaired ${selfHealed.length} match(es):`, selfHealed);
  }
  // getAllMatches() is not guild-scoped, so hoisting it out of the guild loop
  // avoids rescanning every match once per guild -- and stops a match from one
  // guild getting a timeout closure that points at a different guild.
  const liveMatches = manager.getAllMatches();
  for (const rm of liveMatches) {
    if (rm.status === 'waiting' && !rm.joinTimeout) {
      rm.configTimeout = rm.configTimeout || null;
      const g = c.guilds.cache.get(rm.guildId) || c.guilds.cache.first();
      if (!g) continue;
      rm.joinTimeout = setTimeout(() => timeoutMatch(g, rm.id), 2 * 60 * 1000);
      console.log(`[RESTORE] re-armed join timeout for ${rm.id}`);
    }
  }
  for (const g of c.guilds.cache.values()) {
    syncStoreEmbed(g).catch(e => console.log('[STORE] ready sync failed:', e.message));
    refreshCombinedLeaderboard(g);
  }

  if (guild && manager.getVoicePoolSize && manager.getVoicePoolSize() > 0) {
    for (const mode of ['amo', 'esport']) {
      try {
        await manager.ensureVoicePool(guild, mode);
      } catch (e) { console.log(`[POOL] ${mode} init error:`, e.message); }
    }
  }

  for (const g of c.guilds.cache.values()) {
    try { await resumeInterruptedTeardowns(g); } catch (e) { console.log('[RESTART] resume error:', e.message); }
  }

  setTimeout(() => {
    for (const g of c.guilds.cache.values()) {
      try { cleanupOrphanTeamChannels(g); } catch (e) { console.log('[VOICE] orphan cleanup error:', e.message); }
    }
  }, 8000);
});

setInterval(async () => {
  try {
    for (const g of client.guilds.cache.values()) {
      try { await resumeInterruptedTeardowns(g); } catch (e) { /* handled */ }
      try { await detectStuckVoicePlayers(g); } catch (e) { /* handled */ }
      try { await cleanupOrphanTeamChannels(g); } catch (e) { /* handled */ }
    }
  } catch (e) {
    console.log('[VOICE] sweep error:', e.message);
  }
}, 5 * 60 * 1000);

setInterval(async () => {
  const now = Date.now();
  const expired = jailModule.loadJails().filter(j => j.expiresAt !== -1 && j.expiresAt <= now);
  if (expired.length === 0) return;
  for (const j of expired) {
    const guild = client.guilds.cache.get(j.guildId) || client.guilds.cache.first();
    if (!guild) continue;
    const role = guild.roles.cache.get(j.roleId);
    const member = await guild.members.fetch(j.userId).catch(() => null);
    await unjailMember(guild, member, role, j.affectedChannels, j.removedRoles);
    console.log(`[JAIL] released ${j.userId} (expired)`);
    jailModule.unjailUser(j.userId);
  }
}, 60000);

setInterval(() => {
  try {
    const repaired = manager.validateAllMatches();
    if (repaired.length) {
      console.log(`[SELF-HEAL] sweep repaired ${repaired.length} match(es)`, repaired.map(r => `${r.id}:${r.issues.join(',')}`));
    }
  } catch (e) {
    console.log('[SELF-HEAL] sweep error:', e.message);
  }
  // Drop abandoned !play drafts so a host who closed the picker cannot leave an
  // entry behind.
  try {
    const n = playFlow.draftCount();
    if (n) console.log(`[PLAY] ${n} pending !play draft(s) still open`);
  } catch (e) { /* ignore */ }
}, 5 * 60 * 1000);

client.on(Events.MessageCreate, async (message) => {
  try {
  if (message.author.bot) return;

  if (cheatProofPending.has(message.author.id) && message.attachments.size > 0) {
    const pend = cheatProofPending.get(message.author.id);
    cheatProofPending.delete(message.author.id);
    const report = cheaterReports.getReport(pend.reportId);
    if (report) {
      const urls = [...message.attachments.values()].map(a => a.url).slice(0, 10);
      await postExpose(message.guild, report, message.author.id, urls, pend.cheatType);
      if (report.cheaterId) {
        await applyCheaterAction(message.guild, report);
      }
      await renderReportMessage(message.guild, cheaterReports.getReport(pend.reportId));
      console.log(`[CHEAT] exposé auto-posted for ${pend.reportId} (type: ${pend.cheatType})`);
    }
    return;
  }

  const content = message.content.trim();
  const lowercase = content.toLowerCase();

  if (lowercase.startsWith('!play') || lowercase.startsWith('!esport')) {
    const isEsport = lowercase.startsWith('!esport');
    const mode = isEsport ? 'esport' : 'amo';

    if (isEsport) {
      await ensureEsportChannels(message.guild);
    }

    // Each mode has its own channel and !play opens a picker offering all of
    // them, so the command is accepted in ANY mode channel. The per-mode rule
    // is applied when a mode is actually chosen. Gating here on the mode that
    // "!play" defaults to (amo-no) would lock players out of hosting amo-yes
    // and e-sport in their own channels entirely.
    const hostable = [...new Set(
      Object.values(config.modes).map(m => m && m.matchChannelId).filter(Boolean)
    )];
    if (hostable.length && !hostable.includes(message.channel.id)) {
      return message.reply(`⚠️ Host a match in ${hostable.map(id => `<#${id}>`).join(', ')}.`);
    }

    const existing = manager.getMatchByCreator(message.author.id, mode);
    if (existing) {
      return message.reply('❌ You already have a pending match! Cancel it first.');
    }

    // "!play" and "!esport" both open the mode + size picker. The old direct
    // form ("!play 3v3") is gone: one way to host, so nobody has to remember
    // syntax or get it wrong.
    if (!isInRequiredVoice(message.member)) {
      return message.reply(voiceCheckMessage());
    }

    const bl = blacklistModule.isBlacklisted(message.author.id);
    if (bl) {
      return message.reply(blacklistMessage(bl));
    }

    // Only the modes this channel actually hosts. The picker used to offer all
    // three everywhere, so a player could pick a mode the channel does not
    // allow and only be told at the size step, one click too late to be useful.
    const allowedModes = modesAllowedInChannel(message.channel.id);
    const preselected = allowedModes.includes(mode) ? mode : allowedModes[0];
    playFlow.setDraft(message.author.id, { mode: preselected });

    // A size typed after the command is ignored, but say so rather than
    // silently doing something different from what they asked for.
    const typed = content.split(/\s+/)[1];
    const note = /^\d\s*v\s*\d$/i.test(String(typed || '').trim())
      ? `\n\n*You typed \`${typed}\` — pick the size from the menu below instead.*`
      : '';

    // Public, because the picker needs to persist for the host to click it
    // after the message is sent (ephemeral replies cannot host follow-ups).
    const picker = playFlow.buildSizePicker(message.author.id, message.guild, {
      mode: preselected,
      allowedModes
    });
    const msg = await message.channel.send(picker).catch(() => null);
    if (msg) {
      // Remembered so the picker can be replaced/cleaned up later.
      playFlow.pickMessageIds.set(message.author.id, msg.id);
    }
    if (note) {
      return message.reply(note).catch(e => note('picker', e));
    }
    return;
  }

  if (lowercase.startsWith('!forcefull') || lowercase.startsWith('&forcefull')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors can use this!');
    }
    const mode = getModeByChannel(message.channel.id);
    const match = manager.getPendingOrFullMatch(mode === 'esport' ? 'esport' : undefined);
    if (!match) {
      const candidates = manager.getAllMatches().filter(m =>
        (mode === 'esport' ? m.mode === 'esport' : true) && m.status === 'waiting'
      );
      const waitingNoRoom = candidates.filter(m => !m.roomId);
      if (candidates.length && waitingNoRoom.length) {
        return message.reply('❌ **No forceable match found.** There is a pending match, but the host has not set its room config yet.');
      }
      return message.reply('❌ **No pending match found.** Start one with `!play XvX` first.');
    }
    const dummy = message.author.id;
    while (match.team1.length < match.teamSize) match.team1.push(dummy);
    while (match.team2.length < match.teamSize) match.team2.push(dummy);
    match.team1 = [...new Set(match.team1)];
    match.team2 = [...new Set(match.team2)];
    for (let i = 0; match.team1.length < match.teamSize; i++) match.team1.push(`mockT1_${i}`);
    for (let i = 0; match.team2.length < match.teamSize; i++) match.team2.push(`mockT2_${i}`);
    manager.persistMatches();
    try {
      const started = await startFullMatch(message.guild, match);
      if (!started) {
        const failEmbed = new EmbedBuilder()
          .setTitle('❌ FORCE-FULL FAILED')
          .setColor(COLORS.danger)
          .setDescription(`Could not create the match channels, so the match was left open for players to join.\n\nCheck that I can **Manage Channels** and that the room category still exists.`)
          .setFooter({ text: BRANDING });
        return message.reply({ embeds: [failEmbed] });
      }
      const doneEmbed = new EmbedBuilder()
        .setTitle('✅ FORCE-FULL COMPLETE')
        .setColor(COLORS.success)
        .setDescription(`Match **${match.teamSize}v${match.teamSize}** forced full.\nVoice channels created, players moved, **<@${match.creatorId}>** notified.`)
        .setFooter({ text: BRANDING });
      await message.reply({ embeds: [doneEmbed] });
    } catch (e) {
      console.error('Force-full error:', e);
      const failEmbed = new EmbedBuilder()
        .setTitle('⛔ FORCE-FULL FAILED')
        .setColor(COLORS.danger)
        .setDescription(`**${e.message}**\nMake sure the bot can manage channels in this server.`)
        .setFooter({ text: BRANDING });
      await message.reply({ embeds: [failEmbed] });
    }
    return;
  }
  } catch (e) {
    errLog(`MessageCreate error (${message.content}):`, e);
  }
});

async function cleanupOldMessages(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    const activeMsgs = manager.getAllMatches().map(mm => mm.message).filter(Boolean);
    // Pickers that are still live must survive the sweep, or a host would have
    // their menu deleted out from under them.
    const livePickers = [...playFlow.pickMessageIds.values()];
    const toDelete = msgs.filter(m =>
      (m.author.id === client.user.id && !activeMsgs.includes(m.id) && !livePickers.includes(m.id)) ||
      m.content.trim().toLowerCase().startsWith('!play')
    );
    if (toDelete.size > 0) {
      await channel.bulkDelete(toDelete).catch(async () => {
        for (const m of toDelete.values()) {
          await m.delete().catch(e => note('bulk-delete', e));
        }
      });
    }
  } catch (e) {
    console.log('Cleanup error:', e.message);
  }
}

async function getPlayerName(guild, userId) {
  const m = await guild.members.fetch(userId).catch(() => null);
  return m ? (m.displayName || m.user.username) : userId;
}

async function dumpMatchChat(guild, match) {
  const logChannel = guild.channels.cache.get(config.logsChannelId);
  const room = guild.channels.cache.get(match.channelId2);
  if (!logChannel || !room) {
    console.log('[DUMP] no log channel or room channel');
    return;
  }

  let prevBatch = undefined;
  let all = [];
  for (let i = 0; i < 15; i++) {
    const batch = await room.messages.fetch(prevBatch ? { limit: 100, before: prevBatch.last().id } : { limit: 100 }).catch(() => null);
    if (!batch || batch.size === 0) break;
    all.push(...batch.values());
    prevBatch = batch;
    if (batch.size < 100) break;
  }
  all.reverse();

  const ts = Date.now();
  const dateStr = new Date(ts).toLocaleString('en-GB', { timeZone: 'UTC' });

  let text = '';
  text += `Free Fire Match Log\n`;
  text += `Match: ${match.teamSize}v${match.teamSize}${match.mode ? ' (' + getModeConfig(match.mode).displayName + ')' : ''}\n`;
  text += `Finished at: ${dateStr} (UTC)\n`;
  text += `Team 1: ${(match.team1 || []).map(id => `<@${id}>`).join(' ') || '—'}\n`;
  text += `Team 2: ${(match.team2 || []).map(id => `<@${id}>`).join(' ') || '—'}\n`;
  text += `Winner Team: ${match.winnerTeam ? 'Team ' + match.winnerTeam : '—'} | MVP Winner: <@${match.mvpWinnerId || '—'}>\n`;
  text += `Loser Team: ${match.loserTeam ? 'Team ' + match.loserTeam : '—'} | MVP Loser: <@${match.mvpLoserId || '—'}>\n`;
  text += `\n===== CHAT LOG =====\n`;

  for (const m of all) {
    if (m.type === 7) continue;
    const author = m.author;
    const name = author ? (author.username || author.tag || 'unknown') : 'unknown';
    const mt = m.member ? (m.member.displayName || author.username) : name;
    const t = new Date(m.createdTimestamp).toLocaleString('en-GB', { timeZone: 'UTC' });
    let content = m.content;
    if (!content && m.embeds && m.embeds.length) {
      const e = m.embeds[0];
      content = `[embed] ${e.title || ''} ${e.description || ''}`.trim();
    }
    if (!content && m.attachments && m.attachments.size) {
      content = '[attachment]';
    }
    if (!content) content = '';
    text += `[${t}] ${mt} (${name}): ${content}\n`;
  }

  const buffer = Buffer.from(text, 'utf8');
  const chatFile = { attachment: buffer, name: `match-${match.id.slice(-5)}-chat.txt` };

  const embed = new EmbedBuilder()
    .setTitle(`📜 Match Log • ${match.teamSize}v${match.teamSize}`)
    .setColor(COLORS.green)
    .setDescription(
      `Match finished **<t:${Math.floor(ts / 1000)}:F>**\n` +
      `🏆 Winner Team: ${match.winnerTeam ? `Team ${match.winnerTeam}` : '—'} | MVP Winner: <@${match.mvpWinnerId || '—'}>\n` +
      `💪 Loser Team: ${match.loserTeam ? `Team ${match.loserTeam}` : '—'} | MVP Loser: <@${match.mvpLoserId || '—'}>\n` +
      `💬 Full chat log below ⬇️`
    )
    .setFooter({ text: BRANDING });

  await logChannel.send({ embeds: [embed], files: [chatFile] }).catch(e => console.log('[DUMP] send failed:', e.message));
}

async function settleMatchResult(guild, match) {
  const mode = match.mode || 'amo';
  const winnerTeam = match.winnerTeam;
  const loserTeam = match.loserTeam;
  if (!winnerTeam || !loserTeam) return;

  // Idempotency guard. Discord keeps message components clickable for ~15
  // minutes after a match is torn down, so without this a late click could
  // re-enter this function and pay the same players a second time.
  if (match.settled) {
    console.log(`[SETTLE] match ${match.id} already settled — ignoring duplicate settle`);
    return;
  }
  match.settled = true;
  match.settledAt = Date.now();
  manager.touchMatch(match);
  manager.persistMatches();

  const winIds = winnerTeam === 1 ? match.team1 : match.team2;
  const loseIds = loserTeam === 1 ? match.team1 : match.team2;

  const lines = [];
  for (const uid of winIds) {
    if (!/^\d{15,20}$/.test(uid)) continue;
    const pts = uid === match.mvpWinnerId ? REWARDS.winnerMvp : REWARDS.winner;
    storage.addPoints(uid, pts, 'win', mode);
    lines.push(`🏆 <@${uid}> **+${pts}**`);
  }
  for (const uid of loseIds) {
    if (!/^\d{15,20}$/.test(uid)) continue;
    const pts = uid === match.mvpLoserId ? REWARDS.loserMvp : REWARDS.loser;
    storage.addPoints(uid, pts, 'loss', mode);
    lines.push(`💪 <@${uid}> +${pts}`);
  }

  // Points are the one thing that must not be lost to an early restart.
  try { storage.flushPoints(mode); } catch (e) { console.log('[SETTLE] flush failed:', e.message); }

  manager.logMatch({
    id: match.id,
    timestamp: Date.now(),
    teamSize: match.teamSize,
    roomId: match.roomId,
    password: match.password,
    team1: match.team1,
    team2: match.team2,
    winnerTeam,
    loserTeam,
    mvpWinnerId: match.mvpWinnerId,
    mvpLoserId: match.mvpLoserId
  });

  const channel = guild.channels.cache.get(match.channelId2);
  if (channel && match.resultMessageId) {
    const msg = await fetchMessage(channel, match.resultMessageId);
    if (msg) {
      const resultEmbed = new EmbedBuilder()
        .setTitle('✅ Match Finished!')
        .setColor(COLORS.green)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Winner MVP <@${match.mvpWinnerId}> vs Loser MVP <@${match.mvpLoserId}>` });
      await msg.edit({ embeds: [resultEmbed], components: [] }).catch(e => note('edit', e));
    }
  }

  await dumpMatchChat(guild, match);
  await clearVotePanel(guild, match);

  await manager.finishMatch(guild, match);
  applyRankNicknames(guild).catch(e => note('nickname', e));
  refreshCombinedLeaderboard(guild);
}

async function timeoutMatch(guild, matchId, phase = 'lobby') {
  const match = manager.getMatch(matchId);
  if (!match || match.status !== 'waiting') return;
  const channel = guild.channels.cache.get(match.channelId);
  if (channel) {
    const msg = await fetchMessage(channel, match.message);
    if (msg) await msg.delete().catch(e => note('delete', e));
  }
  await clearJoinButtons(guild, match);
  if (channel) {
    if (phase === 'config') {
      await channel.send('⏰ **Room config timed out!** The host didn\'t set up the room within 30 seconds. Match cancelled.').catch(e => note('delete', e));
    } else {
      await channel.send('⏰ **Match timed out!** The lobby didn\'t fill up within 2 minutes.').catch(e => note('send', e));
    }
  }
  manager.removeMatch(matchId);
}

async function performJoin(interaction, match, team) {
  const bl = blacklistModule.isBlacklisted(interaction.user.id);
  if (bl) {
    return interaction.reply({ content: blacklistMessage(bl), ephemeral: true });
  }
  const result = manager.joinTeam(match.id, interaction.user.id, team);
  if (!result.success) {
    return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
  }
  if (match.joinTimeout) {
    clearTimeout(match.joinTimeout);
    match.joinTimeout = null;
  }

  const msg = await fetchMessage(interaction.channel, match.message);
  if (msg) {
    await msg.edit({ embeds: [buildMatchBoxEmbed(interaction.guild, match, interaction.user)] });
  }
  if (!manager.isTeamsFull(match.id)) {
    await syncJoinButtons(interaction.guild, match);
  }
  await interaction.reply({ content: `✅ Joined Team ${team}!`, ephemeral: true });
  await updateMatchChannel(interaction.guild, match);

  if (manager.isTeamsFull(match.id)) {
    try {
      const started = await startFullMatch(interaction.guild, match);
      if (!started) {
        await interaction.channel.send({
          content: `❌ I could not create the match voice channels, so the match was **not** started and the lobby is still open. Check that I have **Manage Channels**.`
        }).catch(e => note('send', e));
      }
    } catch (e) {
      console.error('Error starting match:', e);
      await interaction.channel.send({ content: `❌ Error starting match: ${e.message}. Make sure the bot can manage channels.` }).catch(e => note('send', e));
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  // No slash commands are registered, but if one is ever invoked anyway, answer
  // cleanly instead of falling through to the button/modal routing below.
  if (interaction.isChatInputCommand()) {
    return interaction.reply({ content: '⚠️ Unknown command.', flags: 64 }).catch(e => note('slash-command', e));
  }

  try {
    console.log(`[IN] ${new Date().toISOString()} type=${interaction.type} cid=${interaction.isCommand() ? interaction.commandName : (interaction.customId || '')} user=${interaction.user ? interaction.user.id : ''} ch=${interaction.channelId}`);
    if (interaction.isButton() && interaction.customId === 'apply_start_checker') {
    return handleApplyStart(interaction, 'checker');
  }
  if (interaction.isButton() && interaction.customId === 'apply_start_staff') {
    return handleApplyStart(interaction, 'staff');
  }
  if (interaction.isButton() && interaction.customId.startsWith('app_')) {
    return handleApplyStaffButton(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('applymodal_')) {
    return handleApplyModal(interaction);
  }
  if (interaction.isButton() && interaction.customId === 'report_player') {
    return handleReportStart(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('reportplat_')) {
    return await handleReportPlatform(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rpt_claim_')) {
    return handleReportButton(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rpt_cancel_')) {
    return handleReportButton(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rpt_clean_')) {
    return handleReportButton(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rpt_cheat_')) {
    return handleReportButton(interaction);
  }
  if (interaction.isButton() && interaction.customId.startsWith('rpt_done_')) {
    return await handleProofDone(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('reportmodal_')) {
    return await handleReportModal(interaction);
  }
  if (interaction.isModalSubmit() && interaction.customId.startsWith('cheatmodal_')) {
    return await handleCheatModal(interaction);
  }
  // --- Tournament ---------------------------------------------------------
  // Registered before the match routing so a tournament id can never be read as
  // a match id by a handler that shares the same shape of custom id.
  if (interaction.isButton() && interaction.customId === tourUI.REGISTER_BTN) {
    const t = tournament.getActive();
    if (!t) {
      return interaction.reply({ content: '❌ There is no tournament running right now.', flags: 64 });
    }
    if (t.status !== 'signup') {
      return interaction.reply({ content: '❌ Sign-ups for this tournament are closed.', flags: 64 });
    }
    const onTeam = tournament.teamOfUser(t, interaction.user.id);
    if (onTeam) {
      return interaction.reply({ content: `❌ You are already registered with **${onTeam.name}**. One team per player.`, flags: 64 });
    }
    return interaction.showModal(tourUI.buildRegisterModal(t));
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('tourmodal_')) {
    return await handleTournamentRegisterModal(interaction);
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(tourUI.MODE_MENU)) {
    return await handleTournamentModeMenu(interaction);
  }

  if (interaction.isStringSelectMenu() && interaction.customId.startsWith(tourUI.STYLE_MENU)) {
    return await handleTournamentStyleMenu(interaction);
  }

  if (interaction.isButton() && (interaction.customId.startsWith(tourUI.PICK_A) || interaction.customId.startsWith(tourUI.PICK_B))) {
    return await handleTournamentPick(interaction);
  }

  if (interaction.isButton() && interaction.customId === tourUI.NEXT_BTN) {
    const t = tournament.getActive();
    if (!t) return interaction.reply({ content: '❌ There is no tournament running.', flags: 64 });
    if (!canManageTournament(interaction.member)) {
      return interaction.reply({ content: '❌ Only tournament admins can refresh the bracket.', flags: 64 });
    }
    await renderTournament(t, interaction.guild);
    return interaction.reply({ content: '🔄 Bracket refreshed.', flags: 64 });
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('roommodal_')) {
    const matchId = interaction.customId.replace('roommodal_', '');
    console.log(`[MODAL] submit received for match ${matchId}`);
    const match = manager.getMatch(matchId);

    if (!match) {
      console.log('[MODAL] match not found for', matchId);
      return interaction.reply({ content: '⚠️ Match not found.', flags: 64 });
    }
    if (match.creatorId !== interaction.user.id) {
      console.log('[MODAL] wrong user tried to configure match', interaction.user.id);
      return interaction.reply({ content: '❌ Only the match host can set room details.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });
    console.log('[MODAL] deferred reply OK');

    const roomId = interaction.fields.getTextInputValue('roomIdInput').trim();
    // The room password and the join password are both genuinely optional --
    // a custom room may have neither. Empty is a valid answer, not a failure,
    // so they are only format-checked when the player actually typed one.
    const passwordRaw = interaction.fields.getTextInputValue('passwordInput').trim();
    const keyRaw = interaction.fields.getTextInputValue('keyInput').trim();
    const password = passwordRaw || '';
    const matchKey = keyRaw || '';

    if (![2, 3, 4].includes(match.teamSize)) {
      console.log('[MODAL] invalid team size on match', match.teamSize);
      return interaction.editReply({ content: '❌ Invalid team size. Start the match with `!play` and pick from the menu!' });
    }

    const invalidFields = [];
    if (!/^\d+$/.test(roomId)) invalidFields.push('Room ID');
    if (password && !/^\d+$/.test(password)) invalidFields.push('Room Password');
    if (matchKey && !/^\d+$/.test(matchKey)) invalidFields.push('Join Password');
    if (invalidFields.length) {
      console.log(`[MODAL] non-numeric input rejected: ${invalidFields.join(', ')}`);
      return interaction.editReply({ content: `❌ **Only numbers!** ${invalidFields.join(', ')} must contain numbers only.` });
    }

    match.roomId = roomId;
    match.password = password;
    match.key = matchKey;
    if (!(match.team1 || []).includes(interaction.user.id)) {
      match.team1.push(interaction.user.id);
    }
    playFlow.clearDraft(interaction.user.id);
    console.log(`[MODAL] teamSize=${match.teamSize} roomId=${roomId} pass=${password || '(none)'} key=${matchKey || '(none)'} creator auto-joined T1`);

    try {
      const matchEmbed = buildMatchBoxEmbed(interaction.guild, match, interaction.user);

      const channel = interaction.guild.channels.cache.get(match.channelId);
      console.log('[MODAL] apostado channel found:', !!channel);
      if (!channel) throw new Error('match channel is not cached');

      // The "Host a Match" box goes now that the form is filled in -- this is the
      // moment the host is done with it. It was kept alive while the form was open
      // so closing the form without submitting left them a way back in.
      const pickerMsg = await fetchMessage(channel, match.pickerMessageId);
      if (pickerMsg) await pickerMsg.delete().catch(e => note('picker', e));
      match.pickerMessageId = null;

      // match.message is null for a match whose setup message was never posted,
      // which is the normal path since the form is opened directly. fetchMessage
      // returns null for that rather than handing back the last 50 messages.
      const oldMsg = await fetchMessage(channel, match.message);
      if (oldMsg) await oldMsg.delete().catch(e => note('picker', e));

      const newMsg = await channel.send({ embeds: [matchEmbed] });
      match.message = newMsg.id;
      match.setupMessageId = null;
      manager.persistMatches();
      await syncJoinButtons(interaction.guild, match);
      console.log('[MODAL] match box sent successfully, new msg id:', newMsg.id);

      const saved = [
        `🔑 **Room ID**  \`${roomId}\``,
        password ? `🔒 **Room Password**  \`${password}\`` : '🔓 **No room password**',
        matchKey ? `🗝️ **Join Password**  \`${matchKey}\`` : '🔓 **Open to everyone**'
      ].join('\n');
      await interaction.editReply({
        embeds: [withThumbnail(new EmbedBuilder()
          .setTitle('✅ Room details saved')
          .setColor(COLORS.success)
          .setDescription(`${saved}\n\nYour lobby is live — players can now join their teams.`)
          .setFooter({ text: BRANDING }), interaction.guild)]
      }).catch(e => note('deferred-reply', e));
      if (match.configTimeout) {
        clearTimeout(match.configTimeout);
        match.configTimeout = null;
      }
      if (match.joinTimeout) clearTimeout(match.joinTimeout);
      match.joinTimeout = setTimeout(() => {
        timeoutMatch(interaction.guild, match.id);
      }, 2 * 60 * 1000);
    } catch (e) {
      console.error('Error creating match:', e);
      await interaction.editReply({ content: `❌ Error creating match: ${e.message}.` }).catch(e => note('match-lifecycle', e));
    }
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('joinkey_')) {
    const team = parseInt(interaction.customId.slice(interaction.customId.lastIndexOf('_') + 1));
    const matchId = interaction.customId.slice('joinkey_'.length, interaction.customId.lastIndexOf('_'));
    const match = manager.getMatch(matchId);
    if (!match) return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });

    if (!isInRequiredVoice(interaction.member)) {
      return interaction.reply({ content: voiceCheckMessage(), ephemeral: true });
    }

    const key = interaction.fields.getTextInputValue('matchKeyInput').trim();
    if (match.key && key !== match.key) {
      return interaction.reply({ content: '❌ Wrong join key! You can\'t join this match.', ephemeral: true });
    }

    await performJoin(interaction, match, team);
  }

  if (interaction.isStringSelectMenu()) {
    if (interaction.customId === 'store_menu') {
      return handleBuy(interaction, interaction.values[0]);
    }
    const cid = interaction.customId;
    let kind = null;
    let matchId = null;

    // The moderation submenu shares this handler; both prefixes resolve the
    // same match and then dispatch on the selected value.
    // The style menu has to be routed here too. handlePlaySizePick() handles all
    // three picker dropdowns, but only the mode and size ids were reaching it --
    // the amo-yes style menu fell through to 'Unknown selection'.
    if (cid === playFlow.STYLE_CUSTOM_ID ||
        cid === `${playFlow.CUSTOM_ID}_mode` ||
        cid === `${playFlow.CUSTOM_ID}_size`) {
      return handlePlaySizePick(interaction);
    }

    if (cid.startsWith('matchmenu_') || cid.startsWith('matchmodmenu_')) {
      const prefix = cid.startsWith('matchmodmenu_') ? 'matchmodmenu_' : 'matchmenu_';
      const mId = cid.slice(prefix.length);
      if (!mId) return interaction.reply({ content: '⚠️ Unknown selection.', ephemeral: true });
      const match = manager.getMatch(mId);
      if (!match) return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });
      const value = interaction.values[0];
      if (value === 'staffreq') return handleStaffReq(interaction, match);
      if (value === 'mvp') return handleMvpVote(interaction, match);
      if (value === 'votecancel') return handleVoteCancel(interaction, match);
      if (value === 'cancel') return handleCancelMatchAction(interaction, match);
      if (value === 'staffcancel') return handleStaffCancel(interaction, match);
      if (value === 'resetvotes') return handleResetVotes(interaction, match);
      return interaction.reply({ content: '⚠️ Unknown action.', ephemeral: true });
    }

    if (cid.startsWith('mvptype_')) {
      kind = 'type';
      matchId = cid.slice('mvptype_'.length);
    } else if (cid.startsWith('mvvp_')) {
      kind = 'winner';
      matchId = cid.slice('mvvp_'.length);
    } else if (cid.startsWith('mvlp_')) {
      kind = 'loser';
      matchId = cid.slice('mvlp_'.length);
    }
    if (!kind || !matchId) {
      return interaction.reply({ content: '⚠️ Unknown selection.', ephemeral: true });
    }

    const match = manager.getMatch(matchId);
    if (!match) {
      return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });
    }
    if (match.status !== 'full') {
      return interaction.reply({ content: '❌ This match is not in a votable state.', ephemeral: true });
    }

    const voterId = interaction.user.id;
    const captains = [match.team1[0], match.team2[0]].filter(Boolean);
    if (!isMvpVoter(match, interaction.member)) {
      return interaction.reply({ content: '❌ Only the **first 2 players** in the match can vote! (Team captains only)', ephemeral: true });
    }
    const isCaptainVote = captains.includes(voterId);
    const otherId = isCaptainVote ? (voterId === match.team1[0] ? match.team2[0] : match.team1[0]) : null;

    if (kind === 'type') {
      return showMvpCandidatePicker(interaction, match, interaction.values[0] === 'winner');
    }

    const isWinner = kind === 'winner';
    const selected = interaction.values[0];
    if (!(match.team1 || []).includes(selected) && !(match.team2 || []).includes(selected)) {
      return interaction.reply({ content: '❌ That player is not part of this match.', ephemeral: true });
    }
    const otherMvp = isWinner ? match.mvpLoserId : match.mvpWinnerId;
    if (otherMvp && otherMvp === selected) {
      return interaction.reply({ content: `❌ <@${selected}> is already the other MVP — a player can't be both 🏆 Winner and 💪 Loser MVP!`, ephemeral: true });
    }

    const votesKey = isWinner ? 'winnerVotes' : 'loserVotes';
    const setKey = isWinner ? 'winnerVoteSet' : 'loserVoteSet';
    if (match[setKey]) {
      return interaction.reply({ content: `✅ ${isWinner ? 'Winner' : 'Loser'} MVP was already finalized.`, ephemeral: true });
    }
    if (match[votesKey][voterId]) {
      return interaction.reply({ content: '✅ You already voted! Use ❌ Cancel My Vote to change it.', ephemeral: true });
    }

    const teamOf = id => match.team1.includes(id) ? 1 : 2;
    match[votesKey][voterId] = { team: teamOf(selected), player: selected };
    manager.touchMatch(match);
    manager.persistMatches();
    await syncVotePanel(interaction.guild, match);

    const other = otherId ? match[votesKey][otherId] : null;
    let msg;
    const announce = (text) => {
      const roomChannel = interaction.guild.channels.cache.get(match.channelId2);
      if (roomChannel) roomChannel.send({ content: text }).catch(e => note('send', e));
    };
    const voteLabel = isWinner ? '🏆 Winner MVP' : '💪 Loser MVP';
    if (!isCaptainVote) {
      if (isWinner) {
        match.winnerTeam = match[votesKey][voterId].team;
        match.mvpWinnerId = selected;
      } else {
        match.loserTeam = match[votesKey][voterId].team;
        match.mvpLoserId = selected;
      }
      match[setKey] = true;
      match.resultStatus = null;
      manager.persistMatches();
      await updateResultBox(interaction.guild, match);
      announce(`✅ **Vote complete!** ${voteLabel} set by <@${voterId}> (match role): <@${selected}>.`);
      msg = `✅ Vote accepted! ${voteLabel}: <@${selected}>`;
      if (match.winnerVoteSet && match.loserVoteSet) {
        await interaction.update({ embeds: [], components: [], content: msg });
        await settleMatchResult(interaction.guild, match);
        return;
      }
      return interaction.update({ embeds: [], components: [], content: msg });
    }
    if (other && other.team === teamOf(selected) && other.player === selected) {
      if (isWinner) {
        match.winnerTeam = match[votesKey][voterId].team;
        match.mvpWinnerId = selected;
      } else {
        match.loserTeam = match[votesKey][voterId].team;
        match.mvpLoserId = selected;
      }
      match[setKey] = true;
      match.resultStatus = null;
      manager.persistMatches();
      await updateResultBox(interaction.guild, match);
      announce(`✅ **Vote complete!** ${voteLabel} is <@${selected}> — both captains agree.`);
      msg = `✅ Both captains agree! ${voteLabel}: <@${selected}>`;
      if (match.winnerVoteSet && match.loserVoteSet) {
        await interaction.update({ embeds: [], components: [], content: msg });
        await settleMatchResult(interaction.guild, match);
        return;
      }
    } else if (other) {
      match[votesKey] = {};
      match.resultStatus = `❌ ${isWinner ? 'Winner' : 'Loser'} votes didn't match! Please vote again.`;
      manager.persistMatches();
      await updateResultBox(interaction.guild, match);
      announce(`❌ **${isWinner ? 'Winner' : 'Loser'} votes didn't match, please vote again!** (captains <@${match.team1[0]}> & <@${match.team2[0]}>)`);
      msg = `❌ Votes aren't the same, please try again!`;
    } else {
      const otherName = otherId ? await getPlayerName(interaction.guild, otherId) : 'the other captain';
      announce(`✅ <@${voterId}> voted for **${voteLabel}** — waiting for <@${otherId}> (${otherName}).`);
      msg = `✅ Vote saved! Waiting for **${otherName}** to vote.`;
    }
    return interaction.update({ embeds: [], components: [], content: msg });
  }

  if (interaction.isButton()) {
    const separator = interaction.customId.indexOf('_');
    if (separator === -1) return interaction.reply({ content: '⚠️ Invalid interaction.', ephemeral: true });
    const action = interaction.customId.slice(0, separator);
    const matchId = interaction.customId.slice(separator + 1);

    if (interaction.customId === 'store_buy_open') {
      const items = storeModule.getItems().filter(it => !storeModule.isSoldOut(it));
      if (items.length === 0) {
        return interaction.reply({ content: '🛒 The store is empty or everything is SOLD OUT.', ephemeral: true });
      }
      const opts = items.slice(0, 25).map(it =>
        new StringSelectMenuOptionBuilder()
          .setEmoji(it.type === 'role' ? '👑' : '💎')
          .setLabel(it.name.slice(0, 100))
          .setDescription(`${it.type === 'role' ? 'Role' : 'Gems'} - ${it.cost} pts${it.stock !== null && it.stock !== undefined ? ` (${it.stock} left)` : ''}`)
          .setValue(it.id)
      );
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId('store_menu')
          .setPlaceholder('🛒 Choose an item to buy')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(opts)
      );
      const buyEmbed = new EmbedBuilder()
        .setTitle('🛒 Buy an item')
        .setColor(COLORS.info)
        .setDescription('Select an item below — the price is **deducted from your balance automatically**.');
      return interaction.reply({ embeds: [buyEmbed], components: [row], ephemeral: true });
    }

    if (action === 'buyitem') {
      return handleBuy(interaction, matchId);
    }

    const match = manager.getMatch(matchId);
    if (!match) {
      console.log(`[BTN] match not found for action=${action} matchId=${matchId}`);
      return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });
    }

    if (action === 'setup' || action === 'room') {
      if (match.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only the match host can set room details.', ephemeral: true });
      }

      const roomModal = new ModalBuilder()
        .setCustomId(`roommodal_${match.id}`)
        .setTitle(`🏠 ${match.teamSize}v${match.teamSize} Room Config`);

      const roomIdInput = new TextInputBuilder()
        .setCustomId('roomIdInput')
        .setLabel('Room ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const passwordInput = new TextInputBuilder()
        .setCustomId('passwordInput')
        .setLabel('Room Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(roomIdInput);
      const row2 = new ActionRowBuilder().addComponents(passwordInput);

      const keyInput = new TextInputBuilder()
        .setCustomId('keyInput')
        .setLabel('Join Key (Optional)')
        .setPlaceholder('Optional - leave empty to let anyone join')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const row3 = new ActionRowBuilder().addComponents(keyInput);

      roomModal.addComponents(row1, row2, row3);

      if (match.configTimeout) clearTimeout(match.configTimeout);
      match.configTimeout = setTimeout(() => {
        timeoutMatch(interaction.guild, match.id, 'config');
      }, 30 * 1000);

      try {
        await interaction.showModal(roomModal);
        console.log(`[MODAL] room modal presented for match ${match.id} by ${interaction.user.id}`);
      } catch (e) {
        errLog('showModal(room) failed for match ' + match.id, e);
        try { await interaction.reply({ content: '❌ Could not open the room config modal. Please try again.', ephemeral: true }); } catch {}
      }
      return;
    }

    if (action === 'join1' || action === 'join2') {
      const team = action === 'join1' ? 1 : 2;

      if (!isInRequiredVoice(interaction.member)) {
        return interaction.reply({ content: voiceCheckMessage(), ephemeral: true });
      }

      if (!match.key) {
        return performJoin(interaction, match, team);
      }

      const keyModal = new ModalBuilder()
        .setCustomId(`joinkey_${match.id}_${team}`)
        .setTitle(`🔑 Join Team ${team}`);

      const keyInputModal = new TextInputBuilder()
        .setCustomId('matchKeyInput')
        .setLabel('Match Key')
        .setPlaceholder('Enter the key given by the match host')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const keyRow = new ActionRowBuilder().addComponents(keyInputModal);

      keyModal.addComponents(keyRow);

      try {
        await interaction.showModal(keyModal);
      } catch (e) {
        errLog('showModal(key) failed for match ' + match.id, e);
        try { await interaction.reply({ content: '❌ Could not open the key modal. Please try again.', ephemeral: true }); } catch {}
      }
      return;
    }

    if (action === 'mvpwinner') {
      return showMvpCandidatePicker(interaction, match, true, 'reply');
    }

    if (action === 'mvploser') {
      return showMvpCandidatePicker(interaction, match, false, 'reply');
    }

    if (action === 'mvpvote') {
      return handleMvpVote(interaction, match);
    }

    if (action === 'votecancel') {
      return handleVoteCancel(interaction, match);
    }

    if (action === 'staffreq') {
      return handleStaffReq(interaction, match);
    }

    if (action === 'leave') {
      if (match.status === 'full') {
        const teamSizeNow = match.team1.length + match.team2.length;
        if (teamSizeNow <= 2) {
          return interaction.reply({ content: '❌ You are one of the last players in the match — use the cancel option instead of leaving.', ephemeral: true });
        }
        const restored = await manager.restorePlayerVoice(interaction.guild, match, interaction.user.id);
        const result = manager.leaveMatch(matchId, interaction.user.id, { force: true });
        manager.endRestoreUser(match, interaction.user.id);
        if (!result.success) {
          return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
        }
        manager.clearOriginalChannel(match, interaction.user.id);

        const msg = await fetchMessage(interaction.channel, match.message);
        if (msg) {
          await msg.edit({ embeds: [buildMatchBoxEmbed(interaction.guild, match, interaction.user)] });
        }
        await updateMatchChannel(interaction.guild, match);
        return interaction.reply({
          content: (restored && restored.ok)
            ? '🚪 You left the match and were moved back to your original voice channel!'
            : '🚪 You left the match!',
          ephemeral: true
        });
      }
      if (match.creatorId === interaction.user.id) {
        return interaction.reply({ content: '❌ The match host cannot leave! Use **Cancel Match** to close the room.', ephemeral: true });
      }
      const result = manager.leaveMatch(matchId, interaction.user.id);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      }
      if (match.originalChannels && match.originalChannels[interaction.user.id]) {
        await manager.restorePlayerVoice(interaction.guild, match, interaction.user.id);
        manager.clearOriginalChannel(match, interaction.user.id);
      }
      manager.endRestoreUser(match, interaction.user.id);

      const msg = await fetchMessage(interaction.channel, match.message);
      if (msg) {
        await msg.edit({ embeds: [buildMatchBoxEmbed(interaction.guild, match, interaction.user)] });
      }
      await syncJoinButtons(interaction.guild, match);

      await interaction.reply({ content: '🚪 You left the match!', ephemeral: true });
      await updateMatchChannel(interaction.guild, match);
    }

    if (action === 'cancel') {
      return handleCancelMatchAction(interaction, match);
    }

    if (action === 'cancelfvote') {
      if (match.status !== 'waiting' && match.status !== 'full') {
        return interaction.reply({ content: '❌ This match is not cancellable by vote right now.', ephemeral: true });
      }
      if (!isMatchPlayer(match, interaction.user.id)) {
        return interaction.reply({ content: '❌ Only players in this match can vote to cancel!', ephemeral: true });
      }
      const team = manager.getPlayerTeam(match, interaction.user.id) || 1;
      match.cancelVotes = match.cancelVotes || { 1: [], 2: [] };
      if ((match.cancelVotes[team] || []).includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ You already voted to cancel!', ephemeral: true });
      }
      match.cancelVotes[team].push(interaction.user.id);
      manager.persistMatches();

      const needed = cancelVotesNeeded(match);
      const votes = (match.cancelVotes[1] || []).length + (match.cancelVotes[2] || []).length;
      const roomChannel = interaction.guild.channels.cache.get(match.channelId2) || interaction.channel;

      if (match.cancelMsgId && roomChannel) {
        const cmsg = await fetchMessage(roomChannel, match.cancelMsgId);
        if (cmsg) await cmsg.edit({
          embeds: [buildCancelVoteEmbed(match)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cancelfvote_${match.id}`).setLabel('🗳️ Vote for Cancel').setStyle(ButtonStyle.Danger)
          )]
        }).catch(e => note('edit', e));
      }

      if (votes >= needed) {
        await cancelMatch(interaction.guild, match, `❌ **Match cancelled by player vote** (<@${interaction.user.id}>)`);
        return interaction.reply({ content: '❌ **The cancel vote passed — match cancelled!**', ephemeral: true });
      }
      return interaction.reply({ content: `✅ Vote recorded! (**${votes}/${needed}**). Need **${needed}** vote${needed === 1 ? '' : 's'} from the match players to cancel.`, ephemeral: true });
    }

    if (action === 'staffcancel') {
      return handleStaffCancel(interaction, match);
    }
  }
  } catch (e) {
    errLog(`InteractionCreate error (${interaction.customId}):`, e);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Something went wrong. Please try again.' }).catch(e => note('deferred-reply', e));
      } else {
        await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true }).catch(e => note('deferred-reply', e));
      }
    } catch { /* ignore */ }
  }
});

const adminCommands = {
  leaderboard: async (message, mode = 'amo') => {
    const sorted = storage.getLeaderboard(mode);
    const rankedCount = storage.countRanked(mode);
    if (sorted.length === 0) {
      return message.reply('📊 No matches played yet!');
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${getModeConfig(mode).displayName} LEADERBOARD`)
      .setColor(COLORS.gold)
      .setDescription(
        sorted.slice(0, 3).map(([id, data], i) => {
          const medal = ['🥇', '🥈', '🥉'][i];
          return `${medal} <@${id}> — **${data.totalPoints} pts**  (${data.wins}W / ${data.losses}L)`;
        }).join('\n')
      )
      .setFooter({ text: `${rankedCount} player${rankedCount === 1 ? '' : 's'} ranked • ${BRANDING}` });

    const rest = sorted.slice(3).map(([id, data], i) => {
      return `**#${i + 4}** <@${id}> — ${data.totalPoints} pts  (${data.wins}W / ${data.losses}L)`;
    }).join('\n');

    if (rest) embed.addFields({ name: `─────────────`, value: rest });

    await message.reply({ embeds: [embed] });
  },
  resetpoints: async (message) => {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Only admins can reset points!');
    }
    for (const mode of ['amo', 'esport']) storage.resetAllPoints(mode);
    await message.reply('🔄 **All points have been reset for all modes!** Rank nicknames cleared.');
    stripRankNicknames(message.guild).catch(e => note('nickname', e));
    refreshCombinedLeaderboard(message.guild);
  },
  setpoints: async (message, mode = 'amo') => {
    if (!canAddPoints(message.member)) {
      return message.reply('❌ You don\'t have permission to adjust points!');
    }
    const args = message.content.split(/\s+/);
    if (args.length < 4) return message.reply('Usage: `!setpoints @user|userId points type (win/loss)`');

    const mentionUser = message.mentions.users.first();
    const m = (args[1] || '').match(/\d{15,20}/);
    const userId = (mentionUser && mentionUser.id) || (m ? m[0] : null);
    if (!/^\d{15,20}$/.test(userId || '')) return message.reply('❌ Mention a user or provide a valid user ID!');

    const points = parseInt(args[2]);
    if (isNaN(points)) return message.reply('❌ Invalid points value!');

    const type = (args[3] || 'win').toLowerCase() === 'loss' ? 'loss' : 'win';
    const result = storage.addPoints(userId, points, type, mode);
    await message.reply(`✅ Added **${points}** points to <@${userId}>. Total: **${result.totalPoints}**`);
    applyRankNicknames(message.guild).catch(e => note('nickname', e));
    refreshCombinedLeaderboard(message.guild);
  }
};

// ---- Rank card image generation ----
let canvasLib = null;
try { canvasLib = require('@napi-rs/canvas'); } catch (e) { canvasLib = null; }

function registerRankCardFonts() {
  if (!canvasLib) return;
  try {
    const paths = [];
    if (process.platform === 'win32') {
      paths.push('C:\\Windows\\Fonts\\arialbd.ttf', 'C:\\Windows\\Fonts\\arial.ttf');
    } else {
      paths.push(
        '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf',
        '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf'
      );
    }
    for (const p of paths) {
      try { canvasLib.GlobalFonts.registerFromPath(p, p.includes('Bold') ? 'CardBold' : 'CardReg'); } catch (e) {}
    }
  } catch (e) { console.log('[RANK] font registration error:', e.message); }
}
registerRankCardFonts();

function rankCardFontFamily() {
  if (!canvasLib) return null;
  try {
    const fams = (canvasLib.GlobalFonts.families || []).map(f => f.family);
    if (fams.includes('CardBold')) return 'CardBold';
    if (fams.includes('Arial')) return 'Arial';
    if (fams.includes('DejaVu Sans')) return 'DejaVu Sans';
    if (fams.length) return fams[0];
  } catch (e) {}
  return null;
}

function httpsGetBufferImg(url) {
  return new Promise((resolve) => {
    const lib = /^https:/.test(url) ? require('https') : require('http');
    lib.get(url, (res) => {
      if (res.statusCode !== 200) { res.resume(); return resolve(null); }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', () => resolve(null));
  });
}

async function fetchAvatarBuffer(user) {
  let url = null;
  try { url = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true }); } catch (e) {}
  if (!url) return null;
  try {
    if (typeof fetch === 'function') {
      const res = await fetch(url);
      if (res.ok) return Buffer.from(await res.arrayBuffer());
      return null;
    }
  } catch (e) {}
  return httpsGetBufferImg(url);
}

function fmtNum(n) { return Number(n || 0).toLocaleString('en-US'); }

async function renderRankCard(member, uid, primary, primaryName, primaryRank, secondary, secondaryName, secondaryRank) {
  const { createCanvas, loadImage } = canvasLib;
  const W = 900, H = 500;
  const cv = createCanvas(W, H);
  const ctx = cv.getContext('2d');

  // Derived from COLORS so the card and the embeds can never drift apart again.
  const hex = (n) => `#${n.toString(16).padStart(6, '0')}`;
  const ff = rankCardFontFamily() || 'sans-serif';
  const accent = hex(COLORS.gold);
  const accent2 = hex(COLORS.primary);
  const white = '#ffffff';
  const dim = '#9aa7bd';

  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0b0f17');
  bg.addColorStop(0.55, '#161e2c');
  bg.addColorStop(1, '#0d1420');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  const pts = primary.totalPoints || 0;
  const wins = primary.wins || 0;
  const losses = primary.losses || 0;
  const matchesTotal = wins + losses;
  const winRate = matchesTotal ? Math.round((wins / matchesTotal) * 100) : 0;
  const mvpCount = primary.mvpCount || 0;
  const secPts = secondary.totalPoints || 0;
  const secWins = secondary.wins || 0;
  const secLosses = secondary.losses || 0;

  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.beginPath(); ctx.arc(0, 0, 220, 0, Math.PI * 2); ctx.fillStyle = accent2; ctx.fill();
  ctx.beginPath(); ctx.arc(W, H, 260, 0, Math.PI * 2); ctx.fillStyle = accent; ctx.fill();
  ctx.globalAlpha = 0.08;
  ctx.fillStyle = white;
  ctx.font = `900 130px ${ff}`;
  ctx.textBaseline = 'top';
  ctx.fillText(fmtNum(pts), W - 330, 40);
  ctx.restore();

  ctx.save();
  ctx.beginPath(); ctx.arc(140, H / 2, 125, 0, Math.PI * 2); ctx.fillStyle = 'rgba(88,101,242,0.20)'; ctx.fill();
  ctx.beginPath(); ctx.arc(140, H / 2, 92, 0, Math.PI * 2); ctx.fillStyle = '#1b2430'; ctx.fill();
  let avatar = null;
  if (member && member.user) avatar = await fetchAvatarBuffer(member.user);
  if (avatar) {
    try {
      const img = await loadImage(avatar);
      ctx.beginPath(); ctx.arc(140, H / 2, 92, 0, Math.PI * 2); ctx.closePath(); ctx.clip();
      ctx.drawImage(img, 140 - 92, H / 2 - 92, 184, 184);
    } catch (e) { console.log('[RANK] avatar draw error:', e.message); }
  } else {
    ctx.font = `700 60px ${ff}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = accent;
    ctx.fillText('?', 140, H / 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
  }
  ctx.restore();

  ctx.beginPath(); ctx.arc(140, H / 2, 92, 0, Math.PI * 2);
  ctx.strokeStyle = accent2; ctx.lineWidth = 4; ctx.stroke();

  const X = 285;
  const name = member ? (member.displayName || member.user.username) : uid;

  ctx.fillStyle = accent;
  ctx.font = `bold 20px ${ff}`;
  ctx.textBaseline = 'top';
  ctx.fillText((primaryName || '').toUpperCase(), X, 44);

  ctx.fillStyle = white;
  ctx.font = `bold 38px ${ff}`;
  ctx.fillText(name.slice(0, 22), X, 78);

  ctx.fillStyle = accent;
  ctx.font = `bold 24px ${ff}`;
  ctx.fillText('RANK', X, 132);
  ctx.fillStyle = white;
  ctx.font = `bold 48px ${ff}`;
  ctx.fillText(primaryRank === null ? 'UNRANKED' : `#${primaryRank}`, X + 100, 122);

  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(X, 190); ctx.lineTo(W - 60, 190); ctx.stroke();

  const ptsStr = fmtNum(pts);
  ctx.fillStyle = white;
  ctx.font = `bold 58px ${ff}`;
  const ptsW = ctx.measureText(ptsStr).width;
  ctx.fillText(ptsStr, X, 215);
  ctx.fillStyle = accent;
  ctx.font = `bold 22px ${ff}`;
  ctx.fillText('PTS', X + ptsW + 14, 243);

  ctx.fillStyle = accent2;
  ctx.font = `bold 22px ${ff}`;
  ctx.fillText('W', X, 302);
  ctx.fillStyle = white;
  ctx.font = `bold 34px ${ff}`;
  ctx.fillText(String(wins), X + 32, 294);
  ctx.fillStyle = '#ff6b6b';
  ctx.font = `bold 22px ${ff}`;
  ctx.fillText('L', X + 110, 302);
  ctx.fillStyle = white;
  ctx.font = `bold 34px ${ff}`;
  ctx.fillText(String(losses), X + 142, 294);
  ctx.fillStyle = dim;
  ctx.font = `600 20px ${ff}`;
  ctx.fillText(`${matchesTotal} MATCHES`, X + 230, 304);

  ctx.fillStyle = accent;
  ctx.font = `bold 20px ${ff}`;
  ctx.fillText('WIN RATE', X, 362);
  ctx.fillStyle = white;
  ctx.font = `bold 32px ${ff}`;
  ctx.fillText(`${winRate}%`, X + 130, 356);
  ctx.fillStyle = accent2;
  ctx.font = `bold 20px ${ff}`;
  ctx.fillText('MVP', X, 412);
  ctx.fillStyle = white;
  ctx.font = `bold 32px ${ff}`;
  ctx.fillText(String(mvpCount), X + 60, 406);

  const footY = 452;
  ctx.fillStyle = dim;
  ctx.font = `bold 18px ${ff}`;
  ctx.fillText((secondaryName || '').toUpperCase(), X + 30, footY);
  ctx.font = `600 16px ${ff}`;
  ctx.fillText(`${fmtNum(secPts)} pts · ${secWins}W / ${secLosses}L · ${secondaryRank === null ? 'UNRANKED' : `#${secondaryRank}`}`, X + 30, footY + 28);

  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.font = `600 16px ${ff}`;
  ctx.textAlign = 'right';
  ctx.fillText('AVENGERS GAME BOT', W - 60, H - 42);
  ctx.textAlign = 'left';

  return Buffer.from(cv.toBuffer('image/png'));
}

function getModeRank(userId, mode) {
  let data = null;
  try { data = storage.loadPoints(mode); } catch (e) { data = null; }
  if (!data || !data.players) return null;
  const entries = Object.entries(data.players)
    .filter(([, p]) => (p.totalPoints || 0) > 0 || (p.matchesPlayed || 0) > 0)
    .sort((a, b) => (b[1].totalPoints || 0) - (a[1].totalPoints || 0) || (b[1].wins || 0) - (a[1].wins || 0) || (b[1].matchesPlayed || 0) - (a[1].matchesPlayed || 0));
  const idx = entries.findIndex(([id]) => id === userId);
  return idx === -1 ? null : idx + 1;
}

async function buildRankResponse(message, targetId, mode) {
  const otherMode = mode === 'amo' ? 'esport' : 'amo';
  const st = storage.getPlayerPoints(targetId, mode);
  const stOther = storage.getPlayerPoints(targetId, otherMode);
  const rank = getModeRank(targetId, mode);
  const rankOther = getModeRank(targetId, otherMode);
  const member = (message.guild && (message.guild.members.cache.get(targetId) || await message.guild.members.fetch(targetId).catch(() => null))) || null;

  if (canvasLib) {
    try {
      const buf = await renderRankCard(member, targetId, st, getModeConfig(mode).displayName, rank, stOther, getModeConfig(otherMode).displayName, rankOther);
      return message.reply({ files: [{ attachment: buf, name: 'rank.png' }] });
    } catch (e) {
      console.log('[RANK] image render failed:', e.message);
    }
  }
  const label = targetId === message.author.id ? 'Your' : `${member ? member.displayName : targetId}`;
  const cfg = getModeConfig(mode);
  const matchesTotal = (st.wins || 0) + (st.losses || 0);
  const winRate = matchesTotal ? Math.round(((st.wins || 0) / matchesTotal) * 100) : 0;
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${label}'s PROFILE — ${cfg.displayName}`)
    .setColor(COLORS.info)
    .setDescription(
      `**💰 Points**  ${st.totalPoints || 0} pts\n` +
      `${rank !== null ? `**🏅 Rank**  **#${rank}**\n` : ''}` +
      `**🏆 Matches**  ${matchesTotal}  (${st.wins || 0}W / ${st.losses || 0}L)\n` +
      `**🔢 Win rate**  ${winRate}%\n` +
      `**⭐ MVP count**  ${st.mvpCount || 0}`
    )
    .setFooter({ text: BRANDING });
  return message.reply({ embeds: [embed] });
}

// ---------------------------------------------------------------------------
// Tournament
//
// Bracket-only: a tournament matchup does not open a Free Fire room, so none of
// this needs the room modal, the voice requirement or the join timeout that
// !play uses. Teams register, an admin starts the bracket, and an admin declares
// the winner of each matchup. One loss eliminates a team.
// ---------------------------------------------------------------------------

// Keeps the standing help post in the tournament channel current. Posts it the
// first time, and edits it in place afterwards, so restarting the bot never fills
// the channel with copies of the same guide.
//
// Returns what it did rather than logging, so the caller decides how loud to be
// about it.
async function ensureGuidePosted(guild, { force = false } = {}) {
  if (!TOURNAMENT_CHANNEL_ID) return { ran: false, reason: 'no channel configured' };

  const channel = guild.channels.cache.get(TOURNAMENT_CHANNEL_ID);
  if (!channel || !channel.isTextBased()) {
    return { ran: false, reason: 'channel not available' };
  }

  const settings = settingsStore.loadSettings();
  // Only touch a post that is in the channel this is configured for. If the
  // configured channel changes, the old id belongs somewhere else and editing it
  // would put a tournament guide in an unrelated channel.
  const sameChannel = settings.tournamentGuideChannelId === channel.id;

  // Built once and reused. It quotes the live format, so it is rebuilt every
  // call -- but only once per call, not once per comparison.
  const payload = buildGuideMessage(guild, tournament.getActive());
  const existingId = sameChannel ? settings.tournamentGuideMessageId : null;
  const existing = (!force && existingId && /^\d{17,20}$/.test(String(existingId)))
    ? await fetchMessage(channel, existingId)
    : null;

  if (existing) {
    // Compared before editing, so a restart that changed nothing does not issue a
    // needless API write and re-trigger edit history on a pinned post.
    const before = existing.embeds && existing.embeds[0]
      && typeof existing.embeds[0].toJSON === 'function'
      ? JSON.stringify(existing.embeds[0].toJSON())
      : '';
    const after = JSON.stringify(payload.embeds[0].toJSON());
    if (before === after) return { ran: true, unchanged: existing.id };
    await existing.edit(payload).catch(e => note('guide-edit', e));
    return { ran: true, edited: existing.id };
  }

  // Either nothing was posted yet, the post was deleted by hand, or the
  // configured channel changed. fetchMessage returns null for a missing or
  // malformed id, so one path covers all three.
  const sent = await channel.send(payload).catch(e => {
    note('guide-send', e);
    return null;
  });
  if (!sent) return { ran: false, reason: 'send failed' };

  settings.tournamentGuideMessageId = sent.id;
  settings.tournamentGuideChannelId = channel.id;
  settings.tournamentGuidePostedAt = new Date().toISOString();
  settingsStore.saveSettings(settings);
  return { ran: true, posted: sent.id };
}

// The bracket is one post that is edited as results land, rather than a new
// message per result. A reposted bracket scrolls the earlier rounds out of
// reach and leaves a channel full of near-identical messages.
async function renderTournament(t, guild, channelOverride) {
  const channel = channelOverride
    || (t && t.channelId ? guild.channels.cache.get(t.channelId) : null);
  if (!channel || !channel.isTextBased()) return null;

  const payload = tourUI.buildBracketMessage(t, guild);
  const existing = await fetchMessage(channel, t.messageId);

  if (existing) {
    await existing.edit(payload).catch(e => note('tour-edit', e));
    return existing;
  }

  // No usable message id -- either this bracket has never been posted or the
  // post was deleted. Either way the tournament still needs somewhere to show
  // results, so post a new one and re-point the state at it.
  const msg = await channel.send(payload).catch(e => note('tour-send', e));
  if (msg) tournament.setMessageId(t, msg.id);
  return msg;
}

// Same idea for the sign-up post, which is a separate message from the bracket.
async function renderSignup(t, guild, channelOverride) {
  const channel = channelOverride
    || (t && t.channelId ? guild.channels.cache.get(t.channelId) : null);
  if (!channel || !channel.isTextBased()) return null;

  const payload = tourUI.buildSignupMessage(t, guild);
  const existing = await fetchMessage(channel, t.signupMessageId);

  if (existing) {
    await existing.edit(payload).catch(e => note('tour-signup-edit', e));
    return existing;
  }

  const msg = await channel.send(payload).catch(e => note('tour-signup-send', e));
  if (msg) tournament.setSignupMessageId(t, msg.id);
  return msg;
}

// Finds the most recent image posted in the channel so a team can attach its
// banner by simply uploading it and running !tbanner. Only the requester's own
// upload is accepted, otherwise any member could slap their picture onto
// somebody else's team.
async function newestOwnImage(channel, authorId, limit = 25) {
  const msgs = await channel.messages.fetch({ limit }).catch(e => {
    note('tour-fetch', e);
    return null;
  });
  if (!msgs) return null;

  const ordered = [...msgs.values()]
    .sort((a, b) => (b.createdTimestamp || 0) - (a.createdTimestamp || 0));

  for (const m of ordered) {
    if (!m.attachments || !m.author || m.author.id !== authorId) continue;
    for (const a of m.attachments.values()) {
      if (a.contentType && String(a.contentType).startsWith('image/')) return a;
    }
  }
  return null;
}

// Applies a decision to a matchup and repaints the bracket. Shared by the buttons
// and by !twin so both paths behave identically. It only mutates and renders --
// the caller owns the reply, so a result is always reported exactly once.
async function settleTournamentMatch(t, matchId, winnerId, decidedBy, guild) {
  const res = tournament.decide(t, matchId, winnerId, decidedBy);
  if (res.ok) await renderTournament(t, guild);
  return res;
}

// Turns a decision into the lines shown to whoever made it.
function tournamentOutcomeText(t, res) {
  if (!res || !res.ok) {
    const text = {
      no_match: '❌ That matchup no longer exists.',
      already_decided: '❌ That matchup already has a result.',
      match_not_live: '❌ That matchup is not ready to be decided.',
      winner_not_in_match: '❌ That team is not in this matchup.',
      team_missing: '❌ One of the teams is missing from the state.',
      not_running: '❌ The tournament has not started yet.'
    }[res.reason] || '❌ That did not work.';
    return text;
  }
  const lines = [
    `🏆 **${res.winner.name}** beat **${res.loser.name}**.`,
    `❌ **${res.loser.name}** is eliminated from **${t.name}**.`
  ];
  if (res.champion) lines.push('', `👑 **${res.champion.name} wins ${t.name}!**`);
  return lines.join('\n');
}

// Reads a modal field without throwing when the id is absent. The number of
// partner inputs is derived from the tournament's team size, so a modal built
// for one tournament must not blow up if it is somehow submitted after the state
// moved on.
function safeField(interaction, customId) {
  try {
    if (typeof interaction.fields.hasTextInputValue === 'function'
      && !interaction.fields.hasTextInputValue(customId)) return '';
    return String(interaction.fields.getTextInputValue(customId) || '').trim();
  } catch (e) {
    note('tour-field', e);
    return '';
  }
}

// Checks a whole roster against the sign-up rules. The captain is included,
// because the answer has to be "is this roster allowed in" whichever way the
// team was entered -- otherwise a captain could enter a partner who is jailed or
// blacklisted and pull them into the tournament.
function checkRoster(t, rosterIds) {
  for (const id of rosterIds) {
    if (!/^\d{15,20}$/.test(id)) {
      return { ok: false, text: tourUI.refusal('bad_member') };
    }
    if (blacklistModule.isBlacklisted(id)) {
      return { ok: false, text: `❌ <@${id}> is blacklisted and cannot enter a tournament.` };
    }
    if (jailModule.getJail(id)) {
      return { ok: false, text: `❌ <@${id}> is jailed and cannot enter a tournament.` };
    }
    const on = tournament.teamOfUser(t, id);
    if (on) {
      return { ok: false, text: tourUI.refusal('player_taken', { playerId: id, teamName: on.name }) };
    }
  }
  return { ok: true };
}

// Announces a new team in the tournament channel and repaints the sign-up post.
// Shared by the button form and !tsign, so both paths look identical to everyone
// else in the channel.
async function announceTournamentTeam(t, team, guild) {
  await renderSignup(t, guild);
  const announce = t.channelId ? guild.channels.cache.get(t.channelId) : null;
  if (announce && announce.isTextBased()) {
    await announce.send(tourUI.buildRegisteredMessage(t, team, guild)).catch(e => note('tour-announce', e));
  }
}

// Turns a captain's nickname into a team name, so `!tsign @friend` works without
// anyone having to invent a name first. Falls back to the username, then to a
// generic label, because a blank name is not something registerTeam accepts.
function defaultTeamName(member) {
  const raw = (member && member.displayName) || (member && member.user && member.user.username) || '';
  const base = String(raw).trim().slice(0, 18);
  return base ? `${base} FC` : 'New Team';
}

// !tsign -- the fast way to enter a team.
//
//	!tsign @friend                  -> you and one partner, name from your nick
//	!tsign Team Vertex @a @b        -> named, with two partners
//
// You count as the first player, so there is no need to tag yourself. This is
// open to everyone: it is a sign-up, not an admin action.
async function handleTournamentSign(message) {
  const guild = message.guild;
  const member = message.member;
  const t = tournament.getActive();

  if (!t) return message.reply('❌ There is no tournament running.');

  if (t.status !== 'signup') {
    return message.reply(`❌ Sign-ups for **${t.name}** are closed.`);
  }

  // Bots cannot play, so registering one would create a team that can never take
  // part. Checked before anything is written.
  const tagged = [...message.mentions.users.values()];
  const bot = tagged.find(u => u.bot);
  if (bot) return message.reply(`❌ <@${bot.id}> is a bot and cannot be on a team.`);
  if (tagged.some(u => u.id === message.client.user.id)) {
    return message.reply('❌ I cannot join a team.');
  }

  const parsed = tournament.parseSignCommand(
    message.content,
    message.author.id,
    tagged.map(u => u.id),
    t.teamSize
  );

  if (!parsed.ok) {
    if (parsed.reason === 'too_few') {
      return message.reply(
        `❌ **${t.teamSize}v${t.teamSize}** needs **${t.teamSize}** players — tag **${parsed.need}** more.\n` +
        'Example: `!tsign @friend`'
      );
    }
    return message.reply(`❌ You tagged **${parsed.got}** players but this tournament is **${t.teamSize}v${t.teamSize}**.`);
  }

  const eligible = checkRoster(t, parsed.roster);
  if (!eligible.ok) return message.reply(eligible.text);

  // An empty !tsign falls back to the captain's nickname, so the common case
  // needs no name at all.
  const res = tournament.registerTeam(t, {
    name: parsed.name || defaultTeamName(member),
    captainId: parsed.captainId,
    members: parsed.members
  });
  if (!res.ok) return message.reply(tourUI.refusal(res.reason, res));

  await announceTournamentTeam(t, res.team, guild);
  return message.reply(
    `✅ **${res.team.name}** is registered for **${t.name}**!\n` +
    `Roster: ${tourUI.roster(guild, res.team, 300)}\n` +
    `Add a banner any time with \`!tbanner ${res.team.name}\`.`
  );
}

async function handleTournamentRegisterModal(interaction) {
  const guild = interaction.guild;
  const t = tournament.getActive();

  if (!t) {
    return interaction.reply({ content: '❌ There is no tournament running right now.', flags: 64 });
  }
  if (t.status !== 'signup') {
    return interaction.reply({ content: '❌ Sign-ups for this tournament are closed.', flags: 64 });
  }

  const name = safeField(interaction, 'teamNameInput');
  const partners = [];
  for (let i = 0; i < Math.max(1, t.teamSize - 1); i++) {
    const v = safeField(interaction, `partner${i}Input`);
    if (v) partners.push(v);
  }

  await interaction.deferReply({ flags: 64 });

  const rosterIds = [interaction.user.id, ...partners.filter(p => p !== interaction.user.id)];
  const eligible = checkRoster(t, rosterIds);
  if (!eligible.ok) return interaction.editReply({ content: eligible.text });

  const res = tournament.registerTeam(t, { name, captainId: interaction.user.id, members: partners });
  if (!res.ok) {
    return interaction.editReply({ content: tourUI.refusal(res.reason, res) });
  }

  await announceTournamentTeam(t, res.team, guild);

  return interaction.editReply({
    content: `✅ **${res.team.name}** is registered for **${t.name}**!\nAdd a banner any time with \`!tbanner ${res.team.name}\`.`
  });
}

// The mode menu from !tcreate. Only amo-yes asks for a style, so the other two
// finish here; amo-yes gets a second, equally ephemeral menu.
async function handleTournamentModeMenu(interaction) {
  const guild = interaction.guild;
  const t = tournament.getActive();

  if (!canManageTournament(interaction.member)) {
    return interaction.reply({ content: '❌ Only tournament admins can set the mode.', flags: 64 });
  }
  if (!t) return interaction.reply({ content: '❌ There is no tournament running.', flags: 64 });
  if (interaction.customId !== tourUI.MODE_MENU + t.id) {
    return interaction.reply({ content: '⚠️ That menu is for a tournament that has ended. Run `!tcreate` again.', flags: 64 });
  }
  if (t.status !== 'signup') {
    return interaction.reply({ content: '❌ Sign-ups are closed, so the mode can no longer change.', flags: 64 });
  }

  const mode = interaction.values[0];
  const res = tournament.setMode(t, mode, null);
  if (!res.ok) {
    return interaction.reply({ content: '❌ That mode could not be set.', flags: 64 });
  }

  // amo-yes is the mode that carries a visual style, so it is the one that asks.
  if (mode === 'ammo') {
    return interaction.reply(tourUI.buildStylePicker(t));
  }

  await renderSignup(t, guild);
  return interaction.reply(tourUI.buildModeConfirmed(t, tournament.modeLabel(t), null, guild));
}

async function handleTournamentStyleMenu(interaction) {
  const guild = interaction.guild;
  const t = tournament.getActive();

  if (!canManageTournament(interaction.member)) {
    return interaction.reply({ content: '❌ Only tournament admins can set the style.', flags: 64 });
  }
  if (!t) return interaction.reply({ content: '❌ There is no tournament running.', flags: 64 });
  if (interaction.customId !== tourUI.STYLE_MENU + t.id) {
    return interaction.reply({ content: '⚠️ That menu is for a tournament that has ended. Run `!tcreate` again.', flags: 64 });
  }
  if (t.status !== 'signup') {
    return interaction.reply({ content: '❌ Sign-ups are closed, so the style can no longer change.', flags: 64 });
  }

  const style = interaction.values[0];
  const res = tournament.setMode(t, 'ammo', style);
  if (!res.ok) {
    return interaction.reply({ content: '❌ That style could not be set.', flags: 64 });
  }

  await renderSignup(t, guild);
  return interaction.reply(tourUI.buildModeConfirmed(t, tournament.modeLabel(t), tournament.styleLabel(t), guild));
}

async function handleTournamentPick(interaction) {
  const guild = interaction.guild;
  if (!canManageTournament(interaction.member)) {
    return interaction.reply({ content: '❌ Only tournament admins can decide a result.', flags: 64 });
  }
  const t = tournament.getActive();
  if (!t) return interaction.reply({ content: '❌ There is no tournament running.', flags: 64 });

  const isA = interaction.customId.startsWith(tourUI.PICK_A);
  const matchId = interaction.customId.slice(isA ? tourUI.PICK_A.length : tourUI.PICK_B.length);

  const found = tournament.findMatch(t, matchId);
  if (!found) {
    return interaction.reply({ content: '❌ That matchup no longer exists — the bracket may have moved on.', flags: 64 });
  }

  // Repainting the bracket is a channel edit, which can outrun the three second
  // interaction window, so the reply is deferred before the work is done.
  await interaction.deferReply({ flags: 64 });
  const res = await settleTournamentMatch(
    t,
    matchId,
    isA ? found.match.a : found.match.b,
    interaction.user.id,
    guild
  );
  return interaction.editReply({ content: tournamentOutcomeText(t, res) });
}

async function handleTournamentCommand(message, content) {
  const guild = message.guild;
  const raw = message.content.trim();
  const member = message.member;

  if (content === '!tournament' || content === '!tour' || content === '!t') {
    const t = tournament.getActive();
    if (!t) {
      return message.reply('🏆 No tournament is running right now. An admin can start one with `!tcreate <name> [2v2|3v3|4v4]`.');
    }
    const p = tournament.getProgress(t);
    const champ = p.championId ? tournament.getTeam(t, p.championId) : null;
    if (champ) return message.reply(tourUI.buildChampionMessage(t, champ, guild));

    const live = tournament.getLiveMatch(t);
    const a = live ? tournament.getTeam(t, live.match.a) : null;
    const b = live ? tournament.getTeam(t, live.match.b) : null;
    const embed = new EmbedBuilder()
      .setTitle(`${STICKERS.game} 🏆 ${t.name}`)
      .setColor(COLORS.gold)
      .setDescription(
        `**Status**  ${t.status === 'signup' ? '📝 Sign-ups open' : t.status === 'ready' ? '🔒 Sign-ups closed' : '⚔️ In progress'}\n` +
        `**Format**  ${t.teamSize}v${t.teamSize}\n` +
        `**Teams**  ${p.alive} alive of ${p.total}\n` +
        `**Round**  ${p.roundNumber} of ${p.totalRounds}` +
        (live ? `\n\n▶️ **Next**  ${a ? a.name : 'TBD'} vs ${b ? b.name : 'TBD'}` : '')
      )
      .setFooter({ text: BRANDING });
    return message.reply(withThumbnail(embed, guild));
  }

  // Both entry points share one gate, so the ordering rule lives in one place.
  // !tsign is matched first so a sign-up is never read as a tournament-admin
  // action, and !tlogin before both so the guide is never mistaken for a sign-up.
  // Exact match only. Without this, "!tlogin" would be swallowed by the
  // startsWith checks further down and answered as a tournament command that
  // does not exist.
  if (content === '!tlogin' || content === '!tguide') {
    return message.reply({ embeds: [tourUI.buildLoginGuide(tournament.getActive(), guild)] });
  }

  if (content.startsWith('!tsign')) {
    return await handleTournamentSign(message);
  }

  if (content.startsWith('!tcreate')) {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can create one.');
    const already = tournament.getActive();
    if (already) {
      return message.reply(`⚠️ **${already.name}** is already running. Finish or cancel it with \`!tcancel\` first.`);
    }

    // The size is an optional trailing token so the name can be several words.
    let name = raw.replace(/^&?!tcreate\s*/i, '').trim();
    let size = null;
    const sizeMatch = name.match(/\s*(\d)\s*v\s*(\d)\s*$/i);
    if (sizeMatch) {
      size = Number(sizeMatch[1]);
      name = name.slice(0, sizeMatch.index).trim();
    }
    if (!name) return message.reply('Usage: `!tcreate <name> [2v2|3v3|4v4]`');
    if (size !== null && Number(sizeMatch[2]) !== size) {
      return message.reply('❌ Use an even format: `2v2`, `3v3` or `4v4`.');
    }
    if (size !== null && !tournament.TEAM_SIZES.includes(size)) {
      return message.reply('❌ Team size must be `2v2`, `3v3` or `4v4`.');
    }

    // The sign-up post goes to the configured tournament channel, not
    // necessarily the channel the admin typed the command in.
    const hostId = TOURNAMENT_CHANNEL_ID || message.channel.id;
    const host = guild.channels.cache.get(hostId);
    if (!host || !host.isTextBased()) {
      return message.reply(`❌ I could not find the tournament channel \`${hostId}\`. Check the id or the \`TOURNAMENT_CHANNEL_ID\` env var.`);
    }

    const res = tournament.createTournament({
      name,
      teamSize: size || 4,
      channelId: hostId,
      createdBy: member.id
    });
    if (!res.ok) return message.reply('❌ Could not create the tournament.');

    await renderSignup(res.tournament, guild, host);

    // Refresh the standing guide so it advertises the format now open rather
    // than the generic list it was built with.
    const guide = await ensureGuidePosted(guild);
    if (guide.ran) console.log(`[GUIDE] refreshed for ${res.tournament.name}`);

    // The mode is asked as a follow-up rather than in the command, so the
    // organiser picks from a menu instead of having to remember the exact
    // names. Ephemeral: the choice is for them, and the public sign-up post
    // already shows it once made.
    const picker = await message.reply({ ...tourUI.buildModePicker(res.tournament), ephemeral: true })
      .catch(e => note('tour-mode-picker', e));

    return message.reply(`🏆 **${res.tournament.name}** created! Format **${res.tournament.teamSize}v${res.tournament.teamSize}**. Teams can register below.${picker ? '' : '\n⚠️ I could not show the mode picker — set it with `!tmode <mode> [style]`.'}`);
  }

  if (content.startsWith('!tstart')) {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can start a tournament.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    const res = tournament.startTournament(t);
    if (!res.ok) {
      const msg = {
        already_started: '❌ This tournament has already started.',
        too_few_teams: `❌ Only **${t.teams.length}** team(s) registered — you need at least **${tournament.MIN_TEAMS}**.`
      }[res.reason] || '❌ Could not start the tournament.';
      return message.reply(msg);
    }
    // The sign-up post has done its job; the bracket takes over the channel.
    const signup = await fetchMessage(message.channel, t.signupMessageId);
    if (signup) await signup.delete().catch(e => note('tour-signup-delete', e));
    await renderTournament(t, guild);
    return message.reply(`⚔️ **${t.name}** has started — ${res.rounds} rounds. Staff decide each matchup with the buttons on the bracket.`);
  }

  if (content.startsWith('!twin')) {
    // Tournament control is its own role list rather than setResultRoles: being
    // able to settle a normal match is not the same authority as running a
    // tournament and deciding who is knocked out of one.
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can decide a result.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    const live = tournament.getLiveMatch(t);
    if (!live) return message.reply('⚠️ There is no matchup waiting for a result.');

    const team = tournament.findTeam(t, raw.replace(/^&?!twin\s*/i, '').trim());
    if (!team) return message.reply('❌ No team matched that name. Check `!tteams`.');
    if (team.id !== live.match.a && team.id !== live.match.b) {
      return message.reply(`❌ **${team.name}** is not in the current matchup.`);
    }
    const res = await settleTournamentMatch(t, live.match.id, team.id, member.id, guild);
    if (!res.ok) return message.reply(tournamentOutcomeText(t, res));
    return message.reply(`🏆 Round **${live.round.number}** decided — the bracket has been updated.`);
  }

  if (content.startsWith('!tbanner')) {
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    const team = tournament.findTeam(t, raw.replace(/^&?!tbanner\s*/i, '').trim());
    if (!team) return message.reply('❌ No team matched that name. Check `!tteams`.');

    const isCaptain = team.captainId === member.id;
    if (!isCaptain && !canManageTournament(member)) {
      return message.reply(`❌ Only **${team.name}**'s captain or a tournament admin can set its banner.`);
    }
    if (t.status === 'finished') return message.reply('❌ This tournament is over.');

    // An attachment on the command itself wins; otherwise the newest image this
    // member posted in the channel is used.
    let url = null;
    const own = message.attachments && message.attachments.first();
    if (own && String(own.contentType || '').startsWith('image/')) {
      url = own.url;
    } else {
      const found = await newestOwnImage(message.channel, member.id);
      if (found) url = found.url;
    }
    if (!url) {
      return message.reply('❌ I could not find an image. Upload your banner in this channel then run `!tbanner <team>` again, or attach it straight to the command.');
    }

    tournament.setBanner(t, team.id, url);
    if (t.status === 'signup' || t.status === 'ready') await renderSignup(t, guild);
    return message.reply({ embeds: [tourUI.buildTeamCard(t, team, guild)] });
  }

  if (content === '!tteams') {
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    if (!t.teams.length) return message.reply('📭 No teams have registered yet.');
    const lines = t.teams.map(team => {
      const mark = team.status === 'eliminated' ? '❌' : team.status === 'champion' ? '🏆' : '⚔️';
      return `${mark} **${tourUI.clip(team.name, 24)}** — ${tourUI.roster(guild, team, 180)}`;
    });
    const embed = new EmbedBuilder()
      .setTitle(`${STICKERS.game} 🏆 ${t.name} — Teams (${t.teams.length})`)
      .setColor(COLORS.primary)
      .setDescription(tourUI.clip(lines.join('\n'), 4000))
      .setFooter({ text: BRANDING });
    return message.reply(withThumbnail(embed, guild));
  }

  if (content.startsWith('!tleave')) {
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    const team = tournament.findTeam(t, raw.replace(/^&?!tleave\s*/i, '').trim());
    if (!team) return message.reply('❌ No team matched that name.');
    const isCaptain = team.captainId === member.id;
    if (!isCaptain && !canManageTournament(member)) {
      return message.reply(`❌ Only **${team.name}**'s captain or a tournament admin can withdraw it.`);
    }
    const res = tournament.removeTeam(t, team.id);
    if (!res.ok) return message.reply('❌ Sign-ups are closed, so teams can no longer withdraw.');
    if (t.status === 'signup') await renderSignup(t, guild);
    return message.reply(`🚪 **${team.name}** withdrew from **${t.name}**.`);
  }

  if (content.startsWith('!tmode')) {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can set the mode.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');

    const rest = raw.replace(/^&?!tmode\s*/i, '').trim();
    if (!rest) {
      const mode = tournament.modeLabel(t);
      const style = tournament.styleLabel(t);
      return message.reply(`🎮 Current mode: **${mode || 'not set'}**${style ? ` · ${style}` : ''}\n` +
        'Usage: `!tmode <amo|ammo|esport> [apostado|zelika|highlight]`');
    }

    const parts = rest.split(/\s+/);
    const res = tournament.setMode(t, parts[0].toLowerCase(), parts[1] ? parts[1].toLowerCase() : null);
    if (!res.ok) {
      return message.reply(res.reason === 'bad_mode'
        ? '❌ Unknown mode. Use `amo`, `ammo` or `esport`.'
        : '❌ Sign-ups are closed, so the mode can no longer change.');
    }
    await renderSignup(t, guild);
    return message.reply(`🎮 Mode set to **${tournament.modeLabel(t)}**${res.style ? ` · ${tournament.styleLabel(t)}` : ''}.`);
  }

  if (content === '!tclose') {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can close sign-ups.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    if (t.status !== 'signup') return message.reply('❌ Sign-ups are already closed.');
    t.status = 'ready';
    tournament.persist();
    const signup = await fetchMessage(message.channel, t.signupMessageId);
    if (signup) await signup.delete().catch(e => note('tour-signup-delete', e));
    return message.reply(`🔒 Sign-ups for **${t.name}** are closed — **${t.teams.length}** team(s) registered. Start it with \`!tstart\`.`);
  }

  if (content === '!tcancel') {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can cancel a tournament.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    const res = tournament.cancel(t, member.id);
    if (!res.ok) return message.reply('❌ Could not cancel the tournament.');
    return message.reply(`🗑️ **${t.name}** was cancelled and archived.`);
  }

  if (content === '!tarchive') {
    if (!canManageTournament(member)) return message.reply('❌ Only tournament admins can archive a tournament.');
    const t = tournament.getActive();
    if (!t) return message.reply('❌ There is no tournament running.');
    if (t.status !== 'finished') return message.reply('❌ That tournament has not finished yet.');
    const res = tournament.archive(t, member.id);
    if (!res.ok) return message.reply('❌ Could not archive the tournament.');
    return message.reply(`📦 **${t.name}** was archived. Start a new one with \`!tcreate\`.`);
  }

  return false;
}

client.on(Events.MessageCreate, async (message) => {
  try {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase().replace(/^&/, '!');

  // Tournament commands live on their own prefix so they cannot be shadowed by
  // a match command, and they are matched before the match routing below.
  if (content.startsWith('!t') && !content.startsWith('!tact') && !content.startsWith('!test')) {
    const handled = await handleTournamentCommand(message, content);
    if (handled !== false) return;
  }
  const mode = getModeByChannel(message.channel.id);

  if (content.startsWith('!clear')) {
    const target = message.member;
    if (!hasCommandAccess(target)) {
      return message.reply('❌ Only supervisors/admins can use this!');
    }
    const args = message.content.trim().split(/\s+/);
    const count = parseInt(args[1]);
    if (!count || isNaN(count) || count < 1 || count > 100) {
      return message.reply('Usage: `&clear <number>` (1-100)');
    }
    try {
      // Fetch one extra so the command message can be excluded below. It used to
      // be deleted separately and then handed to bulkDelete anyway, which always
      // failed for that one message and made the reported count wrong.
      const fetched = await message.channel.messages.fetch({ limit: Math.min(count + 1, 100) });
      const targets = [...fetched.values()].filter(m => m.id !== message.id).slice(0, count);
      const delCount = targets.length;
      await message.delete().catch(e => note('bulk-delete', e));
      if (delCount > 0) {
        const ok = await message.channel.bulkDelete(targets, true).then(() => true).catch(() => false);
        if (!ok) {
          for (const m of targets) {
            if (m.id === message.id) continue;
            await m.delete().catch(e => note('bulk-delete', e));
          }
        }
      }
      const conf = await message.channel.send(`✅ Successfully cleared **${delCount}** message(s)!`).catch(() => null);
      if (conf) setTimeout(() => conf.delete().catch(e => note('delete', e)), 4000);
    } catch (e) {
      console.log('Clear error:', e.message);
    }
    return;
  }

  if (content === '!store') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can refresh the store!');
    }
    await message.delete().catch(e => note('delete', e));
    await syncStoreEmbed(message.guild, message.channel);
    return;
  }
  if (content === '!refreshstore') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can refresh the store!');
    }
    await syncStoreEmbed(message.guild, message.channel);
    return message.reply(`✅ Store updated here (<#${message.channel.id}>) - old message replaced.`);
  }

if (content === '&applyfix' || content === '!applyfix') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can fix the apply system!');
    }
    await ensureApplyChannels(message.guild);
    const S = settingsStore.loadSettings();
    const applyCh = message.guild.channels.cache.get(S.applyChannelId);
    const queueCh = message.guild.channels.cache.get(S.applyQueueChannelId);
    const cat = message.guild.channels.cache.get(S.applyCategoryId);
    const vcs = cat ? cat.children.cache.filter(c => c.type === ChannelType.GuildVoice).map(c => c.name) : [];
    await message.reply(
      `🔧 **Apply system re-synced**\n` +
      `📂 Category: ${cat ? cat.name : 'missing'}\n` +
      `🛡️ Apply: ${applyCh ? `<#${applyCh.id}>` : 'missing'}\n` +
      `👥 Queue: ${queueCh ? `<#${queueCh.id}>` : 'missing'}\n` +
      `🎙️ Voices: ${vcs.length ? vcs.join(', ') : 'none'}`
    );
    return;
  }

  if (content === '&cheatfix' || content === '!cheatfix') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can fix the report system!');
    }
    await ensureCheaterChannels(message.guild);
    const S = settingsStore.loadSettings();
    await message.reply(
      `🔧 **Report system re-synced**\n` +
      `🛡️ Report: ${message.guild.channels.cache.get(S.reportChannelId) ? `<#${S.reportChannelId}>` : 'missing'}\n` +
      `🔍 Check: ${message.guild.channels.cache.get(S.checkChannelId) ? `<#${S.checkChannelId}>` : 'missing'}\n` +
      `⛔ Expose: ${message.guild.channels.cache.get(S.exposeChannelId) ? `<#${S.exposeChannelId}>` : 'missing'}`
    );
    return;
  }

  if (content.startsWith('!remove')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can remove points!');
    }
    const args = message.content.trim().split(/\s+/);
    const mentionUser = message.mentions.users.first();
    const m = (args[1] || '').match(/\d{15,20}/);
    const userId = (mentionUser && mentionUser.id) || (m ? m[0] : null);
    const points = parseInt(args[2]);
    if (!/^\d{15,20}$/.test(userId || '')) {
      return message.reply('Usage: `&remove <userID|@user> <points>`');
    }
    if (isNaN(points) || points <= 0) {
      return message.reply('❌ Invalid points amount. Usage: `&remove <userID> <points>`');
    }
    const mode = getModeByChannel(message.channel.id);
    const total = storage.adjustPoints(userId, -points, mode);
    applyRankNicknames(message.guild).catch(e => note('nickname', e));
    refreshCombinedLeaderboard(message.guild);
    return message.reply(`❌ Removed **${points} pts** from <@${userId}> (${mode}). New total: **${total} pts**.`);
  }

  if (content === '!giveall' || content.startsWith('!giveall ')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can use this!');
    }
    const args = message.content.trim().split(/\s+/);
    const amt = parseInt(args[1]);
    if (isNaN(amt) || amt <= 0) {
      return message.reply('Usage: `!giveall <point> p`\nExample: `!giveall 100 p` gives **100 pts** to every registered player.');
    }
    const gm = getModeByChannel(message.channel.id);
    let data = null;
    try { data = storage.loadPoints(gm); } catch (e) { data = null; }
    const ids = Object.keys((data && data.players) || {});
    if (!ids.length) return message.reply(`ℹ️ No players are registered yet in **${getModeConfig(gm).displayName}** points.`);
    for (const id of ids) storage.adjustPoints(id, amt, gm);
    applyRankNicknames(message.guild).catch(e => note('nickname', e));
    refreshCombinedLeaderboard(message.guild);
    return message.reply(`✅ Gave **${fmtNum(amt)} pts** to **${ids.length}** player(s) in **${getModeConfig(gm).displayName}**!`);
  }

  if (content.startsWith('!storeadd')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can add store items!');
    }
    const args = message.content.slice('&storeadd'.length).trim().split('|').map(s => s.trim());
    const name = args[0];
    const cost = parseInt(args[1]);
    let type = (args[2] || '').toLowerCase();
    const roleInput = args[3];
    const stockInput = args[4];
    if (type === 'diamond') type = 'gems';
    const stock = stockInput === undefined || stockInput === '' ? null : parseInt(stockInput);
    if (!name || isNaN(cost) || cost <= 0 || !['role', 'gems'].includes(type)) {
      return message.reply('Usage: `&storeadd <name>|<cost>|<role|gems>|<roleId (role only)>|<stock (optional)>`\nExamples:\n`&storeadd VIP Role|200|role|<roleId>`\n`&storeadd 500 Gems|300|gems`\n`&storeadd Limited Role|500|role|<roleId>|5` (5 total, sells out when 0)');
    }
    if (stock !== null && (isNaN(stock) || stock <= 0)) {
      return message.reply('❌ Stock must be a positive number, or leave it empty for unlimited.');
    }
    let roleId = null;
    if (type === 'role') {
      const role = message.guild.roles.cache.get(roleInput || '') || (message.mentions.roles.size ? message.mentions.roles.first() : null);
      if (!role) return message.reply('❌ Role items need a valid role ID or mention.');
      roleId = role.id;
    }
    const item = storeModule.addItem({ name, cost, type, roleId, stock });
    await syncStoreEmbed(message.guild);
    return message.reply(`✅ Store item added: **${item.name}** (${item.cost} pts, ${item.type}${item.roleId ? ` - <@&${item.roleId}>` : ''}${item.stock !== null ? `, **${item.stock}** in stock` : ''}). ID: \`${item.id}\`. The store was updated.`);
  }

  if (content.startsWith('!storeremove')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can remove store items!');
    }
    const id = content.replace('!storeremove', '').trim();
    if (!id) return message.reply('Usage: `&storeremove <itemId>` (or `!storeremove`)');
    const ok = storeModule.removeItem(id);
    if (ok) await syncStoreEmbed(message.guild);
    return message.reply(ok ? `🚮 Store item \`${id}\` removed. The store was updated.` : '❌ Item not found.');
  }

  if (content === '!commands') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can post the commands list!');
    }
    const target = message.guild.channels.cache.get(config.infoChannelId) || message.channel;
    const sent = await sendCommandsInfo(target);
    if (sent) return message.reply(`✅ Commands list posted in <#${target.id}>.`);
    return message.reply(`ℹ️ Commands list already exists in <#${target.id}>.`);
  }

  if (content.startsWith('!announce')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can announce!');
    }
    const raw = message.content.trim();
    const parts = raw.split(/\s+/);
    const channelId = parts[1];
    if (!channelId || !/^\d+$/.test(channelId) || parts.length < 3) {
      return message.reply('Usage: `&announce <channelId> <message>`');
    }
    const target = message.guild.channels.cache.get(channelId);
    if (!target) {
      return message.reply(`❌ Channel <#${channelId}> not found in this server.`);
    }
    const text = raw.replace(/^[!&]announce\s+/i, '').replace(channelId, '').trim();
    // Wrapped in an embed so staff announcements carry the same server banner as
    // every other automated message, instead of posting as bare wall of text.
    const announceEmbed = withBanner(new EmbedBuilder()
      .setTitle('📢 ANNOUNCEMENT')
      .setColor(COLORS.primary)
      .setDescription(text)
      .setFooter({ text: BRANDING })
      .setTimestamp(), message.guild);
    const sent = await target.send({ embeds: [announceEmbed] }).catch((e) => {
      message.reply(`❌ Could not send: ${e.message}`);
      return null;
    });
    if (sent) return message.reply(`✅ Announcement posted in <#${channelId}>.`);
    return;
  }

  if (content === '!balance' || content === '!bal') {
    let targetId = message.author.id;
    const rest = content.replace(/!balance|!bal/, '').trim();
    const mention = message.mentions.users.first();
    if (rest) {
      const m = rest.match(/\d{15,20}/);
      if (mention) targetId = mention.id;
      else if (m) targetId = m[0];
    }
    const amo = storage.getPlayerPoints(targetId, 'amo');
    const esp = storage.getPlayerPoints(targetId, 'esport');
    const member = message.guild.members.cache.get(targetId);
    const label = targetId === message.author.id ? '**Your**' : `**${member ? member.displayName : targetId}**'s`;
    const embed = new EmbedBuilder()
      .setTitle(`💰 ${label} BALANCE`)
      .setColor(COLORS.success)
      .setDescription(`Your match account across both modes.`)
      .addFields(
        { name: `🏆 ${getModeConfig('amo').displayName}`, value: `**${amo.totalPoints} pts**\n${amo.wins}W / ${amo.losses}L`, inline: true },
        { name: `⚔️ ${getModeConfig('esport').displayName}`, value: `**${esp.totalPoints} pts**\n${esp.wins}W / ${esp.losses}L`, inline: true }
      )
      .setFooter({ text: BRANDING });
    const affordable = storeModule.getItems().filter(it => !storeModule.isSoldOut(it) && amo.totalPoints >= it.cost);
    if (affordable.length) {
      embed.addFields({ name: '🛒 You can afford', value: affordable.slice(0, 10).map(it => `- **${it.name}** (${it.cost} pts)${it.stock !== null ? ` — ${it.stock} left` : ''}`).join('\n') });
    }
    return message.reply({ embeds: [embed] });
  } else if (content === '!stats' || content.startsWith('!stats ')) {
    let targetId = message.author.id;
    const rest = content.replace(/^!stats\s*/, '').trim();
    const mention = message.mentions.users.first();
    if (rest) {
      const m = rest.match(/\d{15,20}/);
      if (mention) targetId = mention.id;
      else if (m) targetId = m[0];
    }
    const amo = storage.getPlayerPoints(targetId, 'amo');
    const esp = storage.getPlayerPoints(targetId, 'esport');
    const ranked = computeCombinedRanking();
    const combinedIdx = ranked.findIndex(([id]) => id === targetId);
    const combinedPts = (amo.totalPoints || 0) + (esp.totalPoints || 0);
    const combinedWins = (amo.wins || 0) + (esp.wins || 0);
    const combinedMatches = (amo.matchesPlayed || 0) + (esp.matchesPlayed || 0);
    const mvpCount = (amo.mvpCount || 0) + (esp.mvpCount || 0);
    const winRate = combinedMatches ? Math.round((combinedWins / combinedMatches) * 100) : 0;
    const members = message.guild.members.cache.get(targetId);
    const label = targetId === message.author.id ? 'Your' : `${members ? members.displayName : targetId}`;
    const rankEmoji = combinedIdx === 0 ? '🥇' : combinedIdx === 1 ? '🥈' : combinedIdx === 2 ? '🥉' : '🏅';
    const embed = new EmbedBuilder()
      .setTitle(`📊 ${label}'s STATS`)
      .setColor(COLORS.info)
      .setDescription(
        `**💰 Total points**  ${combinedPts} pts\n` +
        `${combinedIdx !== -1 ? `**🥇 Combined rank**  ${rankEmoji} **#${combinedIdx + 1}**\n` : ''}` +
        `**🏆 Matches**  ${combinedMatches}  (${combinedWins}W / ${combinedMatches - combinedWins}L)\n` +
        `**🔢 Win rate**  ${winRate}%\n` +
        `**⭐ MVP count**  ${mvpCount}`
      )
      .addFields(
        { name: `🏆 ${getModeConfig('amo').displayName}`, value: `**${amo.totalPoints || 0} pts**\n${amo.wins || 0}W / ${amo.losses || 0}L\n${storage.getRankBadge(targetId, 'amo') || 'Unranked'}`, inline: true },
        { name: `⚔️ ${getModeConfig('esport').displayName}`, value: `**${esp.totalPoints || 0} pts**\n${esp.wins || 0}W / ${esp.losses || 0}L\n${storage.getRankBadge(targetId, 'esport') || 'Unranked'}`, inline: true }
      )
      .setFooter({ text: BRANDING });
    return message.reply({ embeds: [embed] });
  } else if (content === '!rank' || content.startsWith('!rank ')) {
    let targetId = message.author.id;
    const rest = content.replace(/^!rank\s*/, '').trim();
    const mention = message.mentions.users.first();
    if (mention) targetId = mention.id;
    else {
      const m = rest.match(/\d{15,20}/);
      if (m) targetId = m[0];
    }
    let rmode = getModeByChannel(message.channel.id);
    const modeArg = rest.replace(/<@\d+>/g, '').trim().toLowerCase();
    if (modeArg === 'amo' || modeArg === 'esport') rmode = modeArg;
    return buildRankResponse(message, targetId, rmode);
  } else if (content === '!leaderboard') {
    await adminCommands.leaderboard(message, mode);
  } else if (content === '!resetpoints') {
    await adminCommands.resetpoints(message, mode);
  } else if (content.startsWith('!setpoints')) {
    await adminCommands.setpoints(message, mode);
  } else if (content === '!clearmatches' || content === '!cleargames') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can clear stuck matches!');
    }
    const cleared = await manager.clearAllMatches(message.guild);
    await message.reply(`🧹 Cleared **${cleared}** stuck match(es)!`);
  } else if (content === '!cancelmatch' || content.startsWith('!cancelmatch ')) {
    // Host-initiated cancel. Works from any channel and needs no buttons, so a
    // host is never stuck if the match menu is gone or unclickable.
    const all = manager.getAllMatches();
    const argId = (message.content.match(/\d{15,20}/) || [])[0];
    const mentioned = message.mentions.users.first();
    const targetId = (mentioned && mentioned.id) || argId || message.author.id;

    let target = all.find(mt => isMatchHost(mt, targetId));
    if (!target && argId) {
      target = all.find(mt => (mt.team1 || []).includes(argId) || (mt.team2 || []).includes(argId));
    }
    if (!target) return message.reply('❌ No active match found for that user.');

    const isSelf = targetId === message.author.id;
    if (!isSelf && !hasCommandAccess(message.member)) {
      return message.reply('❌ You can only cancel a match you opened yourself. Use **Cancel Match** in the match menu to ask the other players to vote.');
    }
    const label = isSelf ? 'you' : `<@${targetId}>`;
    await cancelMatch(message.guild, target, `❌ **Match cancelled by the host** (<@${message.author.id}>)`);
    return message.reply(`❌ **Match cancelled** — ${label}'s ${target.teamSize}v${target.teamSize} match was called off.`);
  } else if (content.startsWith('!cancelgame')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can cancel a match!');
    }
    const m = (message.content.match(/\d{15,20}/) || [])[0];
    const target = message.mentions.users.first();
    const targetId = (target && target.id) || m;
    if (!targetId) return message.reply('Usage: `!cancelgame @user|userId`');
    const existing = manager.getAllMatches().find(mt => mt.creatorId === targetId && mt.mode === mode);
    if (!existing) return message.reply('❌ No active match found for that user.');
    await cancelMatch(message.guild, existing, `❌ **Match cancelled by admin** (<@${message.author.id}>)`);
    await message.reply(`❌ **Match cancelled by admin!** <@${targetId}>'s match has been cancelled.`);
  } else if (content.startsWith('!close')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can close a game!');
    }
    const target = message.mentions.users.first();
    const rest = message.content.replace(/^!close/i, '').replace(/^game\s+/i, '').trim();
    const restId = (rest.match(/\d{15,20}/) || [])[0];
    const targetId = (target && target.id) || restId;
    if (!targetId) return message.reply('Usage: `!close game <userId>` (or mention the user)');
    const existing = manager.getAllMatches().find(mt =>
      mt.mode === mode &&
      (mt.creatorId === targetId || (mt.team1 || []).includes(targetId) || (mt.team2 || []).includes(targetId))
    );
    if (!existing) return message.reply('❌ No active match found for that user.');
    await cancelMatch(message.guild, existing, `🚫 **Game closed by admin** (<@${message.author.id}>)`);
    await message.reply(`🚫 **Game closed!** <@${targetId}>'s game has been closed.`);
  } else if (content.startsWith('!blacklist')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can blacklist users!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 4) {
      return message.reply('Usage: `&blacklist <userId> <duration> <reason>`\nDurations: `30m`, `5h`, `7d`, `2w`, `perm`');
    }
    const rawId = args[1];
    const m = rawId.match(/\d{15,20}/);
    const userId = (message.mentions.users.first() && message.mentions.users.first().id) || (m ? m[0] : rawId);
    if (!/^\d{15,20}$/.test(userId)) {
      return message.reply('❌ Invalid user ID or mention.');
    }
    const durationMs = parseDuration(args[2]);
    if (durationMs === null) {
      return message.reply('❌ Invalid duration. Use e.g. `30m`, `5h`, `7d`, `2w`, or `perm`.');
    }
    const reason = args.slice(3).join(' ');
    const entry = blacklistModule.blacklistUser(userId, durationMs === -1 ? null : durationMs, reason, message.author.id);
    const expiry = entry.expiresAt === -1 ? '**Permanent**' : `<t:${Math.floor(entry.expiresAt / 1000)}:R>`;
    await message.reply(`✅ <@${userId}> has been blacklisted!\n📋 Reason: ${reason}\n⏳ Expires: ${expiry}`);
  } else if (content.startsWith('!unblacklist')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can unblacklist users!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 2) {
      return message.reply('Usage: `&unblacklist <userId>`');
    }
    const rawId = args[1];
    const m = rawId.match(/\d{15,20}/);
    const userId = (message.mentions.users.first() && message.mentions.users.first().id) || (m ? m[0] : rawId);
    if (!/^\d{15,20}$/.test(userId)) {
      return message.reply('❌ Invalid user ID or mention. Usage: `&unblacklist <userId>`');
    }
    const removed = blacklistModule.unblacklistUser(userId);
    await message.reply(removed ? `✅ <@${userId}> removed from the blacklist.` : 'ℹ️ That user is not blacklisted.');
  } else if (content.startsWith('!setrole')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can set roles!');
    }
    const args = message.content.trim().split(/\s+/);
    const key = (args[1] || '').toLowerCase();
    if (!['checker', 'cheatermark', 'staff'].includes(key)) {
      return message.reply('Usage: `&setrole <checker|cheatermark|staff> <roleId|@role>`');
    }
    const roleMention = message.mentions.roles.first();
    const roleInput = args[2] || '';
    const roleId = roleMention ? roleMention.id : (roleInput.match(/\d{15,20}/) ? roleInput.match(/\d{15,20}/)[0] : null);
    if (!roleId) {
      return message.reply('❌ Provide a valid role ID or @role.');
    }
    const role = message.guild.roles.cache.get(roleId);
    if (!role) return message.reply('❌ Role not found in this server.');
    const S = settingsStore.loadSettings();
    if (key === 'checker') {
      const list = getCheckerRoleIds();
      if (!list.includes(roleId)) list.push(roleId);
      S.checkerRoleIds = list;
      S.checkerRoleId = list[0];
    } else if (key === 'staff') {
      S.applyStaffRoleId = roleId;
    } else {
      S.cheaterMarkRoleId = roleId;
    }
    settingsStore.saveSettings(S);
    await message.reply(`✅ **${key}** role set to <@&${roleId}>.`);
    if (key === 'checker' || key === 'staff') {
      for (const g of message.client.guilds.cache.values()) {
        ensureCheaterChannels(g).catch(e => note('persist', e));
        ensureApplyChannels(g).catch(e => note('persist', e));
      }
    }
  } else if (content.startsWith('!jail')) {
    if (!canUseJail(message.member)) {
      return message.reply('❌ Only admins can jail players!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 4) {
      return message.reply('Usage: `&jail <userId|@user> <duration> <reason>`\nDurations: `30m`, `5h`, `7d`, `2w`, `perm`');
    }
    const mentionUser = message.mentions.users.first();
    const m = (args[1] || '').match(/\d{15,20}/);
    const userId = (mentionUser && mentionUser.id) || (m ? m[0] : null);
    if (!/^\d{15,20}$/.test(userId || '')) {
      return message.reply('❌ Invalid user ID or mention. Usage: `&jail <userId|@user>`');
    }
    const durationMs = parseDuration(args[2]);
    if (durationMs === null) {
      return message.reply('❌ Invalid duration. Use e.g. `30m`, `5h`, `7d`, `2w`, or `perm`.');
    }
    const reason = args.slice(3).join(' ');
    const member = await message.guild.members.fetch(userId).catch(() => null);
    if (!member) return message.reply('❌ User not found in this server.');
    const res = await applyJail(message.guild, member);
    const entry = jailModule.jailUser(userId, res.role.id, message.guild.id, durationMs === -1 ? null : durationMs, reason, message.author.id, res.affected, res.removedRoles);
    const expiry = entry.expiresAt === -1 ? '**Permanent**' : `<t:${Math.floor(entry.expiresAt / 1000)}:R>`;
    await message.reply(`⛓️ <@${userId}> has been jailed!${res.removedRoles && res.removedRoles.length ? `\n🗂️ Removed **${res.removedRoles.length}** role(s) (restored on release).` : ''}\n📋 Reason: ${reason}\n⏳ Release: ${expiry}`);
  } else if (content.startsWith('!unjail')) {
    if (!canUseJail(message.member)) {
      return message.reply('❌ Only admins can unjail players!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 2) {
      return message.reply('Usage: `&unjail <userId|@user>`');
    }
    const mentionUser = message.mentions.users.first();
    const m = (args[1] || '').match(/\d{15,20}/);
    const userId = (mentionUser && mentionUser.id) || (m ? m[0] : null);
    if (!/^\d{15,20}$/.test(userId || '')) {
      return message.reply('❌ Invalid user ID or mention. Usage: `&unjail <userId|@user>`');
    }
    const entry = jailModule.unjailUser(userId);
    if (!entry) return message.reply('ℹ️ That user is not jailed.');
    const role = message.guild.roles.cache.get(entry.roleId);
    const member = await message.guild.members.fetch(userId).catch(() => null);
    await unjailMember(message.guild, member, role, entry.affectedChannels, entry.removedRoles);
    await message.reply(`✅ <@${userId}> has been released from jail.`);
  } else if (content.startsWith('!setranks')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can set rank nicknames!');
    }
    await message.reply('⏳ Updating rank nicknames...');
    const res = await applyRankNicknames(message.guild);
    await message.channel.send(`✅ Rank nicknames updated: **${res.done}** set (${res.failed} skipped).`).catch(e => note('nickname', e));
  } else if (content === '!resetvote') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can reset votes!');
    }
    const match = manager.getAllMatches().find(m =>
      m.creatorId === message.author.id &&
      (m.status === 'full' || m.status === 'waiting')
    );
    if (!match) return message.reply('❌ No active match found.');
    const resetMode = match.mode || mode;

    let refunded = [];
    if (match.winnerId) {
      storage.removePoints(match.winnerId, WINNER_POINTS, 'win', resetMode);
      refunded.push(`🏆 <@${match.winnerId}> (${WINNER_POINTS} pts refunded)`);
    }
    if (match.loserId) {
      storage.removePoints(match.loserId, LOSER_POINTS, 'loss', resetMode);
      refunded.push(`💪 <@${match.loserId}> (${LOSER_POINTS} pts refunded)`);
    }
    match.winnerId = null;
    match.loserId = null;
    manager.persistMatches();
    refreshCombinedLeaderboard(message.guild);

    if (refunded.length === 0) {
      await message.reply('✅ Votes were already clear. Re-vote with `!w @player` / `!l @player`.');
    } else {
      await message.reply(`♻️ **Votes reset & points refunded!**\n${refunded.join('\n')}\n\nRe-vote with \`!w @player\` / \`!l @player\`.`);
    }
  } else if (content.startsWith('!endcancel')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can force-end a match!');
    }
    const target = message.mentions.users.first();
    const m = (message.content.match(/\d{15,20}/) || [])[0];
    const targetId = (target && target.id) || m;
    let match = null;
    if (targetId) {
      match = manager.getAllMatches().find(mt =>
        mt.status === 'full' &&
        ((mt.team1 || []).includes(targetId) || (mt.team2 || []).includes(targetId))
      ) || manager.getAllMatches().find(mt => mt.creatorId === targetId);
    } else {
      match = manager.getAllMatches().find(m => m.creatorId === message.author.id && m.status === 'full')
        || manager.getAllMatches().find(m => m.status === 'full');
    }
    if (!match) return message.reply('❌ No active full match found to end.');
    const endMode = match.mode || mode;

    const refunded = [];
    if (match.winnerId) {
      storage.removePoints(match.winnerId, WINNER_POINTS, 'win', endMode);
      refunded.push(`🏆 <@${match.winnerId}> (${WINNER_POINTS} pts refunded)`);
    }
    if (match.loserId) {
      storage.removePoints(match.loserId, LOSER_POINTS, 'loss', endMode);
      refunded.push(`💪 <@${match.loserId}> (${LOSER_POINTS} pts refunded)`);
    }

    await cancelMatch(message.guild, match, `🛑 **Match force-ended by staff** (<@${message.author.id}>)`);
    refreshCombinedLeaderboard(message.guild);

    await message.reply(
      `🛑 **Match force-ended.** No points were awarded.` +
      (refunded.length ? `\nRefunds:\n${refunded.join('\n')}` : '')
    );
  } else if (content === '!maint' || content.startsWith('!maint ')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can use the bot maintenance assistant!');
    }
    const st = maintenance.getStatus();
    const mins = Math.floor(st.uptimeMs / 60000);
    const uptimeStr = mins < 60 ? `${mins}m` : `${(mins / 60).toFixed(1)}h`;
    const sev = Object.entries(st.bySeverity || {}).map(([k, v]) => `${k}: ${v}`).join(' | ') || 'none';
    const cats = Object.entries(st.byCategory || {}).map(([k, v]) => `${k}: ${v}`).join(' | ') || 'none';
    const pending = st.pendingApprovals || [];
    const incidentLines = (st.incidents || []).slice(0, 5).map(i =>
      `\`${i.id.slice(-8)}\` **${i.severity.toUpperCase()}** ${i.problem}${i.actionTaken ? ` — ${i.actionTaken}` : ''}`
    ).join('\n') || 'No recent incidents.';
    const embed = new EmbedBuilder()
      .setColor(COLORS.info)
      .setTitle('🛠️ Bot Maintenance Assistant')
      .setFooter({ text: BRANDING })
      .setDescription(
        `**Uptime:** ${uptimeStr}\n` +
        `**Total errors recorded:** ${st.totalErrors}\n` +
        `**Severity:** ${sev}\n` +
        `**Categories:** ${cats}\n` +
        `**Gateway:** ${st.rateLimitCooling ? '⚠️ cooling down from rate limit' : '✅ connected'}\n` +
        `**Last snapshot:** ${st.lastBackupAt ? new Date(st.lastBackupAt).toISOString().slice(0, 19).replace('T', ' ') : 'never'}`
      )
      .addFields(
        { name: '🕵️ Recent incidents', value: incidentLines },
        {
          name: '🛂 Pending approval (high-risk fixes)',
          value: pending.length
            ? pending.map(a => `\`${a.id}\` ${a.problem} (${a.severity}) — approve with \`!maintapprove ${a.id}\``).join('\n')
            : 'None.'
        }
      );
    return message.reply({ embeds: [embed] });
  } else if (content.startsWith('!maintfix ')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can run maintenance fixes!');
    }
    const id = content.split(' ')[1];
    const res = await maintenance.fixIncident(id, message.author.tag);
    if (res.ok) {
      return message.reply(`✅ **Fix applied.** Verification: ${res.verification}`);
    }
    if (res.needsApproval) {
      return message.reply(`🛂 **High-risk fix — approval required.**${res.approvalId ? ` Approval ID: \`${res.approvalId}\` (approve with \`!maintapprove ${res.approvalId}\`)` : ''}`);
    }
    return message.reply(`❌ ${res.reason || 'Nothing to fix.'}`);
  } else if (content.startsWith('!maintapprove ')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can approve maintenance fixes!');
    }
    const id = content.split(' ')[1];
    const res = await maintenance.approve(id, message.author.tag);
    return message.reply(res.ok ? `✅ **Fix executed.** Verification: ${res.verification}` : `❌ ${res.reason || 'Approval failed.'}`);
  } else if (content.startsWith('!maintreject ')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can reject maintenance fixes!');
    }
    const id = content.split(' ')[1];
    const res = await maintenance.reject(id, message.author.tag);
    return message.reply(res.ok ? `🛑 Approval \`${id}\` rejected — no change applied.` : `❌ ${res.reason || 'Reject failed.'}`);
  } else if (content.startsWith('!maintlog')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can view the maintenance log!');
    }
    const n = Math.min(parseInt((content.split(' ')[1] || ''), 10) || 10, 25);
    const entries = maintenance.getLog(n);
    if (!entries.length) return message.reply('📭 No maintenance log entries yet.');
    const text = entries.map(e =>
      `\`${(e.severity || 'info').toUpperCase()}\` [${e.type}] ${e.problem || '(informational)'}${e.cause ? ` — ${e.cause}` : ''}${e.actionTaken ? ` | ${e.actionTaken}` : ''}${e.verification ? ` | ✅ ${e.verification}` : ''}`
    ).join('\n');
    return message.reply({
      embeds: [
        new EmbedBuilder()
          .setColor(COLORS.info)
          .setTitle('🧾 Maintenance Log')
          .setDescription(text.slice(0, 4000))
          .setFooter({ text: BRANDING })
      ]
    });
  } else if (content.startsWith('!w') || content.startsWith('!l')) {
    const isWin = content.startsWith('!w');
    if (!canSetResult(message.member)) {
      return message.reply('⚙️ **`!w` / `!l` is staff-only.**\nPlayers vote for the MVPs using the **🗳️ Vote MVP** buttons in the match room.');
    }
    const target = message.mentions.users.first();
    const m = (message.content.match(/\d{15,20}/) || [])[0];
    const targetId = (target && target.id) || m;
    if (!targetId) {
      return message.reply(`Usage: \`${isWin ? '!w' : '!l'} @player|userId\``);
    }
    console.log(`[VOTE] ${message.author.id} used ${isWin ? '!w' : '!l'} target=${targetId}; roles=[${message.member ? [...message.member.roles.cache.keys()].join(', ') : 'NULL MEMBER'}]`);

    if (canSetResult(message.member)) {
      console.log(`[VOTE] allowed: ${message.author.id} canSetResult=true, matches=[${manager.getAllMatches().map(mm => `${mm.id}:${mm.status}`).join(', ')}]`);
      const adminMatch = manager.getAllMatches().find(mt =>
        mt.status === 'full' &&
        ((mt.team1 || []).includes(targetId) || (mt.team2 || []).includes(targetId))
      ) || manager.getAllMatches().find(mt => mt.status === 'full');
      if (!adminMatch) {
        return message.reply('❌ No active match found for that player.');
      }
      const team = adminMatch.team1.includes(targetId) ? 1 : 2;
      if (isWin) {
        if (adminMatch.winnerTeam) {
          return message.reply('✅ Winner is already set. Use `!l @player` to set the loser.');
        }
        if (adminMatch.loserId === targetId) {
          return message.reply('❌ <@' + targetId + '> is already the Loser MVP — a player can\'t be both!');
        }
        adminMatch.winnerTeam = team;
        adminMatch.mvpWinnerId = targetId;
        adminMatch.winnerId = targetId;
        adminMatch.winnerVoteSet = true;
      } else {
        if (adminMatch.loserTeam) {
          return message.reply('✅ Loser is already set. Use `!w @player` to set the winner.');
        }
        if (adminMatch.winnerId === targetId) {
          return message.reply('❌ <@' + targetId + '> is already the Winner MVP — a player can\'t be both!');
        }
        adminMatch.loserTeam = team;
        adminMatch.mvpLoserId = targetId;
        adminMatch.loserId = targetId;
        adminMatch.loserVoteSet = true;
      }
      manager.persistMatches();
      await message.reply(`✅ ${isWin ? '🏆 Winner' : '💪 Loser'} set by <@${message.author.id}>: <@${targetId}> (Team ${team}).`);
      if (adminMatch.winnerTeam && adminMatch.loserTeam) {
        await settleMatchResult(message.guild, adminMatch);
      } else {
        const pending = isWin ? '💪 **!l** loser' : '🏆 **!w** winner';
        await message.channel.send({ content: `⏳ Waiting for the ${pending} before finishing the match.` }).catch(e => note('send', e));
      }
      return;
    }
  }
  } catch (e) {
    errLog(`MessageCreate error (${message.content}):`, e);
  }
});

client.on(Events.GuildMemberAdd, async (member) => {
  try {
  if (member.user.bot) return;
  const guild = member.guild;
  const points = config.inviteBonus || 10;

  // Guard against farming: the bonus is once per account, and the account must
  // be old enough that a freshly made alt cannot collect it.
  if (inviteTracker.hasJoinedBefore(member.id)) return;
  const eligible = inviteTracker.isEligible(member.user);
  if (!eligible.ok) {
    console.log(`[INVITE] skipped ${member.id}: ${eligible.reason}`);
    return;
  }

  const cachedMap = client.invitesCache.get(guild.id);
  // A full guild.invites.fetch() on every single join is expensive and easy to
  // rate limit on a busy server. Only refresh when the snapshot is stale.
  if (inviteTracker.fetchAllowed() || !cachedMap) {
    await syncInviteCache(guild);
  } else {
    inviteTracker.markFetched();
  }
  const newMap = client.invitesCache.get(guild.id);
  if (!newMap || !cachedMap) return;

  // Credit the invite that gained the most uses. Picking the first match in map
  // order could credit the wrong inviter when two links were used at once.
  let usedInvite = null;
  let bestDelta = 0;
  for (const [code, inv] of newMap) {
    const prev = cachedMap.get(code);
    if (prev && inv.uses > prev.uses) {
      const delta = inv.uses - prev.uses;
      if (delta > bestDelta) {
        bestDelta = delta;
        usedInvite = inv;
      }
    }
  }
  if (!usedInvite || !usedInvite.inviterId || usedInvite.inviterId === member.id) return;

  inviteTracker.recordJoin(member.id);
  storage.adjustPoints(usedInvite.inviterId, points, 'amo');
  try { storage.flushPoints('amo'); } catch (e) { /* non-fatal */ }
  console.log(`[INVITE] ${member.id} joined via invite of ${usedInvite.inviterId}; +${points} pts`);
  refreshCombinedLeaderboard(guild);
  const inviter = guild.members.cache.get(usedInvite.inviterId);
  if (inviter) {
    inviter.send(`🎉 **New member via your invite!**\n<@${member.id}> joined your server using your invite link. You earned **${points} points**!`).catch(e => note('leaderboard', e));
  }
  } catch (e) {
    errLog('GuildMemberAdd error:', e);
  }
});

client.on(Events.InviteCreate, (invite) => {
  const map = client.invitesCache.get(invite.guild.id);
  if (!map) return;
  map.set(invite.code, { uses: invite.uses || 0, inviterId: invite.inviter ? invite.inviter.id : null });
});

client.on(Events.InviteDelete, (invite) => {
  const map = client.invitesCache.get(invite.guild.id);
  if (!map) return;
  map.delete(invite.code);
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  try {
  const member = oldState.member || newState.member;
  if (!member || member.user.bot) return;
  const voiceExemptRoles = config.voiceExemptRoles || [];
  if (voiceExemptRoles.some(rid => member.roles.cache.has(rid))) return;
  if (manager.isSuppressed(member.id)) return;
  if (manager.isRestoring(member.id)) return;
  const match = manager.getActiveMatchForPlayer(member.id);
  if (!match || match.closing) return;
  if (match.phase === 'CANCELLING' || match.phase === 'CANCELLED' || match.phase === 'FINISHING' || match.phase === 'FINISHED') return;

  const teamIdx = (match.team1 || []).includes(member.id) ? 0 : 1;
  const targetVoice = match.voiceChannels && match.voiceChannels[teamIdx];
  if (!targetVoice) return;

  const leftVoice = oldState.channelId && !newState.channelId;
  const switchedChannel = newState.channelId && newState.channelId !== targetVoice;

  if (!leftVoice && !switchedChannel) return;
  if (leftVoice && !match.voiceChannels.includes(oldState.channelId)) return;

  if (switchedChannel) {
    const fresh = await newState.guild.members.fetch(member.id).catch(() => null);
    const target = newState.guild.channels.cache.get(targetVoice);
    if (fresh && target && fresh.voice.channelId !== target.id) {
      await fresh.voice.setChannel(targetVoice).catch(e => note('voice', e));
      console.log(`[VOICE] pulled ${member.id} back to match voice (from ${newState.channelId})`);
    }
  }

  match.voiceViolations = match.voiceViolations || {};
  match.voiceViolations[member.id] = (match.voiceViolations[member.id] || 0) + 1;
  const count = match.voiceViolations[member.id];
  manager.persistMatches();

  const action = leftVoice ? 'left the match voice' : `switched to another voice channel (pulled back to <#${targetVoice}>)`;
  console.log(`[VOICE] ${member.id} ${action} -> violation ${count}/3`);
  const room = member.guild.channels.cache.get(match.channelId2);
  if (room) room.send(`⚠️ <@${member.id}> ${action} (**${count}/3**).`).catch(e => note('persist', e));
  if (count >= 3) {
    blacklistModule.blacklistUser(member.id, 30 * 60 * 1000, 'Abandoned the match voice 3 times', client.user.id);
    await member.send('⛔ **You have been blacklisted for 30 minutes** for abandoning the match voice 3 times.').catch(e => note('send', e));
    if (room) room.send(`⛔ <@${member.id}> has been **blacklisted for 30 minutes** for abandoning the match voice 3 times.`).catch(e => note('send', e));
  }
  } catch (e) {
    errLog('VoiceStateUpdate error:', e);
  }
});

maintenance.init({
  client,
  config,
  configProvider: () => config,
  adminCheck: (member) => hasCommandAccess(member),
  dataDir: require('path').join(__dirname, 'data'),
  healers: {
    'repost-commands': async () => {
      await postCommandsInfoWithRetry();
      return { ok: true, result: 'Fresh commands message posted to the info channel.' };
    },
    're-ensure-channels': async () => {
      let ensured = 0;
      for (const g of client.guilds.cache.values()) {
        try { await ensureCheaterChannels(g); ensured++; } catch (e) { /* channel ensure is best-effort */ }
        try { await ensureApplyChannels(g); ensured++; } catch (e) { /* channel ensure is best-effort */ }
      }
      return { ok: true, result: `Channel ensure ran in ${ensured} guild(s).` };
    },
    're-banner-backfill': async () => {
      // Clears the one-time flag, then re-runs. Use if the first attempt failed
      // part-way (rate limited, channel ids not saved yet, missing permissions).
      const s = settingsStore.loadSettings();
      delete s.bannerBackfillAt;
      settingsStore.saveSettings(s);
      let total = 0, detail = [];
      for (const g of client.guilds.cache.values()) {
        const r = await backfillBanner.run(g, client.user.id);
        if (r.ran) { total += r.edited; detail.push(`${g.name}: ${r.edited}`); }
      }
      return { ok: true, result: `Banner backfill edited ${total} message(s). ${detail.join(', ')}` };
    },
    'revalidate-matches': async () => {
      const repaired = manager.validateAllMatches();
      const all = manager.getAllMatches();
      const balanced = all.every(m => (m.team1 || []).length === (m.team2 || []).length);
      return { ok: true, result: `Validated ${all.length} match(es); repaired ${repaired.length}. Balanced: ${balanced}` };
    },
    'rate-limit-pause': async () => {
      maintenance.setSuppression(60000);
      return { ok: true, result: 'Paused heavy periodic syncs for 60s while Discord cools down.' };
    },
    'resume-pending-teardowns': async () => {
      let resumed = 0;
      for (const g of client.guilds.cache.values()) {
        const before = manager.getAllMatches().filter(m => m.phase === 'CANCELLING' || m.phase === 'CANCELLED' || m.phase === 'FINISHING' || m.phase === 'FINISHED').length;
        try { await resumeInterruptedTeardowns(g); } catch (e) { /* best-effort */ }
        const after = manager.getAllMatches().filter(m => m.phase === 'CANCELLING' || m.phase === 'CANCELLED' || m.phase === 'FINISHING' || m.phase === 'FINISHED').length;
        resumed += (before - after);
        try { await cleanupOrphanTeamChannels(g); } catch (e) { /* best-effort */ }
      }
      return { ok: true, result: `Resumed ${resumed} interrupted teardown(s) and cleaned orphaned team channels.` };
    },
    'recover-stuck-players': async () => {
      let recovered = 0;
      for (const g of client.guilds.cache.values()) {
        for (const m of manager.getAllMatches()) {
          if (m.phase !== 'CANCELLING' && m.phase !== 'CANCELLED' && m.phase !== 'FINISHING' && m.phase !== 'FINISHED') continue;
          const r = await manager.returnPlayersToOriginal(g, m).catch(() => null);
          if (r) recovered += r.restored;
        }
      }
      return { ok: true, result: `Recovery pass finished; restored ${recovered} player(s) from cancelled/ended matches.` };
    }
  },
  verifiers: {
    'repost-commands': async () => 'Commands message posted successfully.',
    're-ensure-channels': async () => 'Channel structures verified.',
    'revalidate-matches': async (r) => (r && r.ok) ? true : 'State still inconsistent.',
    'rate-limit-pause': async () => true,
    'resume-pending-teardowns': async () => 'No pending teardown matches remain; orphan channels cleaned.',
    'recover-stuck-players': async () => 'Stuck players restored or safely skipped.'
  }
});
maintenance.start();

client.login(config.token);

