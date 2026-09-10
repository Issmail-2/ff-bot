const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
let config;
try { config = require('./config.json'); } catch { config = {}; }
if (process.env.DISCORD_TOKEN) config.token = process.env.DISCORD_TOKEN;
if (process.env.SUPERVISOR_ROLE_ID) config.supervisorRoleId = process.env.SUPERVISOR_ROLE_ID;
if (!config.modes) config.modes = {};
if (!config.modes.amo) config.modes.amo = { name:'amo', displayName:'Custom Room', command:'!play', matchChannelId: process.env.AMO_CHANNEL_ID||'1545315593450954762', ammoChannelId: process.env.AMMO_CHANNEL_ID||'1547567219167199352', voiceCategoryId: process.env.AMO_VOICE_CATEGORY||'1545316338145165332', logsCategoryId: process.env.AMO_LOGS_CATEGORY||'1545364636034138112', pointsFile:'./data/points.json' };
if (!config.modes.esport) config.modes.esport = { name:'esport', displayName:'Esport', command:'!esport', matchChannelId: process.env.ESPORT_CHANNEL_ID||'1545388379309482037', voiceCategoryId: process.env.ESPORT_VOICE_CATEGORY||'1545386731686076476', logsCategoryId: process.env.ESPORT_LOGS_CATEGORY||'1545386732982374433', pointsFile:'./data/points_esport.json' };
if (!config.matchPoints) config.matchPoints = { winner: 80, loser: 30 };
if (!config.emojis) config.emojis = { game:'<:Free_fire_logo:1466528905509736705>', team1:'<a:aHYPR_GREENDOTid:1545351146770796634>', team2:'<a:aredptid:1545350890989428829>' };
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
if (!config.matchPingRoles) {
  config.matchPingRoles = process.env.MATCH_PING_ROLE_IDS ? process.env.MATCH_PING_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460', '1537318639395545139', '1450458684428783616', '1546807156970487838', '1466082863115145441', '1459133371874807921'];
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
if (!config.staffRoles) {
  config.staffRoles = process.env.STAFF_ROLE_IDS ? process.env.STAFF_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1537318639395545139', '1506540916519731310', '1459133371874807921', '1466082863115145441'];
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
const cheaterReports = require('./utils/cheaterReports');
const { COLORS, BRANDING, progressBar } = require('./utils/ui');

const EXPOSE_CATEGORY_ID = process.env.EXPOSE_CATEGORY_ID || '1539831526470979646';
const CHEATER_ROLE_ID = process.env.CHEATER_ROLE_ID || '1540120101792129145';
const APPLY_CATEGORY_ID = process.env.APPLY_CATEGORY_ID || '1476278897107538023';
const REPORT_COST = parseInt(process.env.REPORT_COST || '', 10) || 50;
const REPORT_REWARD = parseInt(process.env.REPORT_REWARD || '', 10) || 100;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
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
    const dir = require('path').join(__dirname, 'data');
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(require('path').join(dir, 'error.log'), line + '\n');
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
  if (config.modes.amo && (config.modes.amo.matchChannelId === channelId || config.modes.amo.ammoChannelId === channelId)) return 'amo';
  return 'amo';
}

function getModeConfig(mode) {
  return config.modes[mode] || config.modes.amo;
}

function parseTeamSize(arg) {
  if (!arg) return null;
  const m = arg.toLowerCase().match(/^(\d+)[vx](\d+)$/);
  if (m) {
    const a = parseInt(m[1]);
    const b = parseInt(m[2]);
    if (a === b && [2, 3, 4].includes(a)) return a;
    return null;
  }
  if (/^[234]$/.test(arg.trim())) return parseInt(arg.trim());
  return null;
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
  const category = guild.channels.cache.get(config.jailCategoryId) || guild.channels.cache.find(c => c.name === '⛓️ Jail' && c.type === ChannelType.GuildCategory);
  let cat;
  if (category) {
    cat = category;
  } else {
    cat = await guild.channels.create({
      name: '⛓️ Jail',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{ id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] }]
    });
    config.jailCategoryId = cat.id;
  }
  let text = config.jailTextChannelId ? guild.channels.cache.get(config.jailTextChannelId) : null;
  if (!text) text = cat.children.cache.find(c => c.type === ChannelType.GuildText);
  if (!text) {
    text = await guild.channels.create({ name: '🚪│jail', type: ChannelType.GuildText, parent: cat.id });
    config.jailTextChannelId = text.id;
  }
  let voice = config.jailVoiceChannelId ? guild.channels.cache.get(config.jailVoiceChannelId) : null;
  if (!voice) voice = cat.children.cache.find(c => c.type === ChannelType.GuildVoice);
  if (!voice) {
    voice = await guild.channels.create({ name: '🔇│jail', type: ChannelType.GuildVoice, parent: cat.id });
    config.jailVoiceChannelId = voice.id;
  }
  return { category: cat, text, voice };
}

async function applyJail(guild, member) {
  const role = await getOrCreateJailRole(guild);
  const jail = await getOrCreateJailChannels(guild);

  try { await role.setPermissions([]); } catch (e) { console.log('[JAIL] role perms:', e.message); }

  await jail.category.permissionOverwrites.create(role.id, { allow: [PermissionsBitField.Flags.ViewChannel] }).catch(() => {});
  await jail.text.permissionOverwrites.create(role.id, {
    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
  }).catch(() => {});
  await jail.voice.permissionOverwrites.create(role.id, {
    allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.Connect]
  }).catch(() => {});

  const affected = [];
  for (const channel of guild.channels.cache.values()) {
    if (channel.id === jail.category.id || channel.id === jail.text.id || channel.id === jail.voice.id) continue;
    if (channel.type === ChannelType.GuildCategory) continue;
    if (!channel.permissionOverwrites) continue;
    await channel.permissionOverwrites.create(role.id, { deny: [PermissionsBitField.Flags.ViewChannel] })
      .then(() => affected.push(channel.id))
      .catch(() => {});
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
  if (member && role) await member.roles.remove(role).catch(() => {});
  if (member && removedRoles) {
    for (const rid of removedRoles) {
      const r = guild.roles.cache.get(rid);
      if (!r) continue;
      await member.roles.add(r.id).catch(() => {});
    }
  };
  if (role) {
    for (const cid of (affected || [])) {
      const ch = guild.channels.cache.get(cid);
      if (ch && ch.permissionOverwrites) {
        await ch.permissionOverwrites.delete(role.id).catch(() => {});
      }
    }
  }
}

const COMMANDS_INFO = `🎮 **HOW TO USE THE BOT - FREE FIRE MATCHES**
━━━━━━━━━━━━━━━━━━━━━━━━
1️⃣ Join one of the **lobby voice channels**.
2️⃣ Host a match: type \`!play 2v2\`, \`!play 3v3\` or \`!play 4v4\` (in the matches channel), or \`!esport 2v2/3v3/4v4\` in the esport channel.
3️⃣ Click **🏠 Room Config**, enter the Room ID / Password (and an optional room name).
4️⃣ Players join Team 1 / Team 2 with the join buttons (key required if the host set one). When the room is full the roster is **locked** - nobody can leave or join.
5️⃣ When both teams are full, a **result box** appears - the 2 team captains vote the **MVP** for winner and loser (top 2 players per team only).
6️⃣ Points are added automatically: Winner +50, Winner MVP +80, Loser +10, Loser MVP +30.
7️⃣ To cancel a **full** match, players press **❌ Cancel Match** - each team needs 2 votes to auto-cancel (you can also revoke your vote with **❌ Cancel My Vote**).
8️⃣ Check ranks with the **Rank #** nicknames or \`!leaderboard\`.

👑 **RANK #1 PRIZE - AUTO ROLE**
The **#1 ranked player** automatically receives the Rank #1 role!

🛒 **STORE** (in the **\`store\`** channel)
The store is a dedicated channel with a fixed **STORE / Available Items** embed and a single **🛒 Buy** button. Press it, pick an item from the dropdown, and the **price is deducted from your balance automatically**. Role items are granted instantly, diamonds notify staff to deliver to you.
Supervisors add items: \`&storeadd <name>|<cost>|<role|gems>|<roleId (role only)>\`
Remove items: \`&storeremove <itemId>\`
Refresh: \`&refreshstore\`

━━━━━━━━━━━━━━━━━━━━━━━━
👥 **ALL MEMBERS**
\`!play 2v2 | 3v3 | 4v4\` - host a match
\`!esport 2v2 | 3v3 | 4v4\` - host an esport match
\`!leaderboard\` - show the top players
\`!balance\` (or \`!bal\`) - check your points (also \`!balance @user\`)

🔧 **SUPERVISORS / ADMINS** (<@&1450212500581646460> <@&1537318639395545139> <@&1506540916519731310>)
\`!setpoints @user points win/loss\` - adjust a player's points (also: <@&1450212500581646460> and <@1177600499298599035>)
\`!resetpoints\` - reset all points in all modes
\`!cancelgame @user\` - cancel a player's match
\`!clearmatches\` / \`!cleargames\` - clear stuck matches
\`!setranks\` - refresh rank nicknames
\`!resetvote\` - reset the vote and refund points
\`&remove <userID> <points>\` - remove points from a player
\`&clear <n>\` - delete up to 100 messages (1-100)
\`&commands\` - repost this commands list
\`&storeadd <name>|<cost>|<role|gems>|<roleId>\` - add a store item
\`&storeremove <id>\` - remove a store item
\`&refreshstore\` - re-sync the store channel embed
\`&blacklist <userID> <duration> <reason>\` - blacklist a player from matches
\`&unblacklist <userID>\` - unblacklist a player

⛓️ **JAIL** (ONLY <@&1450212500581646460> <@&1537318639395545139> <@&1506540916519731310> and <@1177600499298599035>)
\`&jail <userID> <duration> <reason>\` - lock a player to the jail channels
\`&unjail <userID>\` - release a jailed player

⏱️ Durations: \`30m\`, \`5h\`, \`7d\`, \`2w\`, \`perm\`
💠 Store: \`role\` items auto-grant the role instantly, \`gems\`/diamonds deduct points immediately and staff delivers them.`;

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
      await m.delete().catch(() => {});
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
        await member.setNickname(base).catch(() => {});
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

async function applyRankOneRole(guild, ranked) {
  const roleId = config.rankOneRoleId;
  if (!roleId || !guild) return;
  const role = guild.roles.cache.get(roleId);
  if (!role) return;
  if (!ranked || ranked.length === 0) return;
  const top = ranked[0][0];
  const members = await guild.members.fetch().catch(() => null);
  if (!members) return;
  for (const m of members.values()) {
    if (m.id === top) continue;
    if (m.roles.cache.has(roleId)) await m.roles.remove(role).catch(() => {});
  }
  const topMember = members.get(top);
  if (topMember && !topMember.roles.cache.has(roleId)) {
    await topMember.roles.add(role).catch(() => {});
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

async function applyRankNicknames(guild) {
  const ranked = computeCombinedRanking();

  let done = 0;
  let failed = 0;
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
        const ok = await renameWithRetry(member, newNick);
        if (!ok) {
          failed++;
          console.log(`[RANK] cannot rename ${uid} (${base}) after retries`);
        }
      }
      done++;
      await new Promise(r => setTimeout(r, 1800));
    } catch (e) {
      failed++;
      console.log(`[RANK] rename error for ${uid}: ${e.message}`);
    }
  }
  await applyRankOneRole(guild, ranked);
  return { done, failed };
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


function teamPanel(ids, matchMode, size, guild) {
  return Array.from({ length: size || ids.length }, (_, i) => {
    const uid = ids[i];
    if (!uid) return '▫️ ─ *Empty slot*';
    const badge = storage.getRankBadge(uid, matchMode);
    const crown = i === 0 ? '👑' : '▫️';
    let name = 'User';
    if (guild) {
      const member = guild.members.cache.get(uid);
      if (member) name = member.displayName || member.user.username;
    }
    return `${crown} ${name}${badge ? ` \`[${badge}]\`` : ''}`;
  }).join('\n');
}

function buildMatchBoxEmbed(guild, match, creatorUser) {
  const list = (ids) => {
    if (!ids || ids.length === 0) return '`Empty`';
    return ids.map(id => `<@${id}>`).join('\n');
  };
  const t1 = list(match.team1);
  const t2 = list(match.team2);

  const embed = new EmbedBuilder()
    .setTitle(`👾 __Free Fire ${match.teamSize}v${match.teamSize} Match__`)
    .setColor('#2F3136')
    .setDescription(`Match started by <@${match.creatorId}>`)
    .addFields(
      { name: `🔴 Team 1 (${match.team1.length}/${match.teamSize})`, value: t1, inline: false },
      { name: `🟢 Team 2 (${match.team2.length}/${match.teamSize})`, value: t2, inline: false }
    )
    .setFooter({ text: BRANDING });

  return embed;
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
  const embed = new EmbedBuilder()
    .setTitle(`🏠 ROOM INFO`)
    .setColor(COLORS.primary)
    .setDescription(
      `**▫️ Room ID** _(hover to copy)_\n\`\`\`${match.roomId}\`\`\`\n` +
      `**▫️ Password** _(hover to copy)_\n\`\`\`${match.password || '—'}\`\`\`\n` +
      `**▫️ Match Key** _(hover to copy)_\n\`\`\`${match.key || '—'}\`\`\``
    )
    .addFields(
      { name: `${config.emojis.team1} TEAM 1 — \`${match.team1.length}/${match.teamSize}\``, value: list1 || '*Empty*', inline: true },
      { name: `${config.emojis.team2} TEAM 2 — \`${match.team2.length}/${match.teamSize}\``, value: list2 || '*Empty*', inline: true }
    )
    .setFooter({ text: BRANDING });
  await channel.messages.fetch({ limit: 20 }).catch(() => {});
  const lastMsg = channel.lastMessage;
  if (lastMsg && lastMsg.author.id === client.user.id && lastMsg.embeds.length) {
    await lastMsg.edit({ embeds: [embed] }).catch(() => {});
  } else {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
}

async function cancelMatch(guild, match, cancelText) {
  await manager.returnPlayersToOriginal(guild, match).catch(() => {});
  await manager.deleteVoiceChannels(guild, match).catch(() => {});
  await manager.deleteChannel(guild, match).catch(() => {});
  if (match.joinTimeout) { clearTimeout(match.joinTimeout); match.joinTimeout = null; }
  if (match.configTimeout) { clearTimeout(match.configTimeout); match.configTimeout = null; }
  const baseChannel = guild.channels.cache.get(match.channelId);
  if (baseChannel && match.message) {
    const msg = await baseChannel.messages.fetch(match.message).catch(() => null);
    if (msg) await msg.edit({ content: cancelText, embeds: [], components: [] }).catch(() => {});
  }
  const roomChannel = guild.channels.cache.get(match.channelId2);
  if (roomChannel) {
    if (match.resultMessageId && match.resultMessageId !== match.message) {
      const rmsg = await roomChannel.messages.fetch(match.resultMessageId).catch(() => null);
      if (rmsg) await rmsg.edit({ content: cancelText, embeds: [], components: [] }).catch(() => {});
    }
    if (match.cancelMsgId && match.cancelMsgId !== match.resultMessageId) {
      const cmsg = await roomChannel.messages.fetch(match.cancelMsgId).catch(() => null);
      if (cmsg) await cmsg.edit({ content: cancelText, embeds: [], components: [] }).catch(() => {});
    }
  }
  manager.removeMatch(match.id);
}

const CANCEL_NEEDED = 2;

function buildCancelVoteEmbed(match) {
  const cancelVotes = match.cancelVotes || { 1: [], 2: [] };
  const votes1 = cancelVotes[1] || [];
  const votes2 = cancelVotes[2] || [];
  const list = (team) => {
    const votes = cancelVotes[team] || [];
    if (votes.length === 0) return '*No votes yet*';
    return votes.map(id => `<@${id}>`).join(' ');
  };
  const t1Done = votes1.length >= CANCEL_NEEDED;
  const t2Done = votes2.length >= CANCEL_NEEDED;
  const status = (t1Done && t2Done) ? '✅ **CANCEL APPROVED** — the match will be cancelled now!' : '⏳ **Waiting for votes...**';
  return new EmbedBuilder()
    .setTitle('⛔ CANCEL VOTE')
    .setColor(COLORS.danger)
    .setDescription(`**${CANCEL_NEEDED} votes needed from every team** to cancel. Each player can vote once — the match keeps running until the vote passes.`)
    .addFields(
      { name: `${config.emojis.team1} TEAM 1 — \`${votes1.length}/${CANCEL_NEEDED}\``, value: `\`\`\`${progressBar(votes1.length, CANCEL_NEEDED, 8)}\`\`\`\n${list(1)}`, inline: true },
      { name: `${config.emojis.team2} TEAM 2 — \`${votes2.length}/${CANCEL_NEEDED}\``, value: `\`\`\`${progressBar(votes2.length, CANCEL_NEEDED, 8)}\`\`\`\n${list(2)}`, inline: true },
      { name: '⚡ STATUS', value: status }
    )
    .setFooter({ text: BRANDING });
}

async function openCancelVote(guild, match, interaction) {
  const roomChannel = guild.channels.cache.get(match.channelId2) || guild.channels.cache.get(match.channelId);
  if (!roomChannel) {
    return interaction.reply({ content: '❌ Could not find the match channel.', ephemeral: true });
  }
  const embed = buildCancelVoteEmbed(match);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cancelfvote_${match.id}`).setEmoji('🗳️').setLabel('Vote for Cancel').setStyle(ButtonStyle.Danger)
  );
  let msg = null;
  if (match.cancelMsgId) {
    const existing = await roomChannel.messages.fetch(match.cancelMsgId).catch(() => null);
    if (existing) msg = existing;
  }
  if (msg) {
    await msg.edit({ embeds: [embed], components: [row] }).catch(() => {});
  } else {
    const sent = await roomChannel.send({ content: `⚠️ **A cancel vote has started!** Match ${match.teamSize}v${match.teamSize} — press the button to vote.`, embeds: [embed], components: [row] }).catch(() => null);
    if (sent) {
      match.cancelMsgId = sent.id;
      manager.persistMatches();
    }
  }
  return interaction.reply({ content: '❌ **Move to cancel started.** Need 2 votes from each team. Press **🗳️ Vote for Cancel** in the match room.', ephemeral: true });
}

function buildResultButtons(match) {
  const row1 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`staffreq_${match.id}`).setEmoji('🛡️').setLabel('Staff Request').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId(`mvpvote_${match.id}`).setEmoji('🗳️').setLabel('Vote for MVP').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`cancel_${match.id}`).setEmoji('❌').setLabel('Cancel Match').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId(`staffcancel_${match.id}`).setEmoji('🚫').setLabel('Staff Cancel').setStyle(ButtonStyle.Danger)
  );
  const row2 = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`votecancel_${match.id}`).setEmoji('↩️').setLabel('Cancel My Vote').setStyle(ButtonStyle.Danger)
  );
  return [row1, row2];
}

function mvpPlayerOptions(guild, match, excludeId) {
  const picks = [...(match.team1 || []).slice(0, 2), ...(match.team2 || []).slice(0, 2)]
    .filter(id => !excludeId || id !== excludeId);
  return picks.map(id => {
    const member = guild.members.cache.get(id);
    const name = member ? (member.displayName || member.user.username) : id;
    const team = match.team1.includes(id) ? 1 : 2;
    return new StringSelectMenuOptionBuilder()
      .setLabel(`Team ${team} • ${name}`.slice(0, 100))
      .setValue(id);
  });
}

function buildMainMatchEmbed(match, guild) {
  const display = getModeConfig(match.mode).displayName;
  const t1Field = teamPanel(match.team1, match.mode || 'amo', match.teamSize, guild) || '*Empty*';
  const t2Field = teamPanel(match.team2, match.mode || 'amo', match.teamSize, guild) || '*Empty*';

  let status = '⏳ **Waiting for captains to vote...**';
  const votes = [];
  if (match.winnerVoteSet && match.mvpWinnerId) votes.push(`🏆 **Winner MVP:** <@${match.mvpWinnerId}>`);
  if (match.loserVoteSet && match.mvpLoserId) votes.push(`💪 **Loser MVP:** <@${match.mvpLoserId}>`);
  if (votes.length) status = votes.join('       ');
  if (match.resultStatus) status = String(match.resultStatus);

  return new EmbedBuilder()
    .setTitle(`${config.emojis.game} CUSTOM ROOM`)
    .setColor(COLORS.gold)
    .setDescription(
      `🔑 **Room ID** _(hover to copy)_\n\`\`\`${match.roomId}\`\`\`\n` +
      `🔒 **Password** _(hover to copy)_\n\`\`\`${match.password}\`\`\``
    )
    .addFields(
      { name: `${config.emojis.team1} TEAM 1 — \`${match.team1.length}/${match.teamSize}\``, value: t1Field, inline: true },
      { name: `${config.emojis.team2} TEAM 2 — \`${match.team2.length}/${match.teamSize}\``, value: t2Field, inline: true },
      { name: '⚡ STATUS', value: status || '—' }
    )
    .setFooter({ text: BRANDING });
}

async function updateResultBox(guild, match) {
  const roomChannel = guild.channels.cache.get(match.channelId2);
  if (!roomChannel || !match.resultMessageId) return;
  const msg = await roomChannel.messages.fetch(match.resultMessageId).catch(() => null);
  if (!msg) return;
  await msg.edit({ embeds: [buildMainMatchEmbed(match, guild)], components: buildResultButtons(match) }).catch(() => {});
}

async function startFullMatch(guild, match) {
  match.status = 'full';
  manager.persistMatches();

  const { team1Channel, team2Channel } = await manager.createVoiceChannels(guild, match);
  const roomChannel = await manager.createChannel(guild, match);
  await manager.movePlayersToVoice(guild, match, team1Channel, team2Channel);

  const apostado = guild.channels.cache.get(match.channelId);
  if (apostado) {
    const msg2 = await apostado.messages.fetch(match.message).catch(() => null);
    if (msg2) {
      await msg2.edit({
        embeds: [buildMatchBoxEmbed(guild, match, null)],
        components: []
      }).catch(() => {});
    }

    const ts = Math.floor(Date.now() / 1000);
    const readyEmbed = new EmbedBuilder()
      .setTitle(`⚔️ MATCH READY • ${match.teamSize}v${match.teamSize}`)
      .setColor(COLORS.success)
      .setDescription(`**Teams are full** — moving players to the voice channels.\n<t:${ts}:f>`)
      .setFooter({ text: BRANDING });
    await apostado.send({ embeds: [readyEmbed] }).catch(() => {});
  }

  const roomChannelId = match.channelId2;
  const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];

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
    const mentions = allPlayers.map(id => `<@${id}>`).join(' ');
    const roleMentions = (config.matchPingRoles || []).map(id => `<@&${id}>`).join(' ');
    boxMsg = await roomChat.send({ content: `${mentions}\n${roleMentions}`, embeds: [buildMainMatchEmbed(match, guild)], components: buildResultButtons(match) });
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
  const joinTeam1 = new ButtonBuilder()
    .setCustomId(`join1_${match.id}`)
    .setLabel('Join Team 1')
    .setStyle(ButtonStyle.Danger);

  const joinTeam2 = new ButtonBuilder()
    .setCustomId(`join2_${match.id}`)
    .setLabel('Join Team 2')
    .setStyle(ButtonStyle.Success);

  const buttons = [joinTeam1, joinTeam2];

  buttons.push(
    new ButtonBuilder()
      .setCustomId(`leave_${match.id}`)
      .setLabel('Leave')
      .setStyle(ButtonStyle.Secondary)
  );

  if (match.status === 'waiting') {
    buttons.push(
      new ButtonBuilder()
        .setCustomId(`cancel_${match.id}`)
        .setLabel('Cancel Game')
        .setStyle(ButtonStyle.Danger)
    );
  }

  const row = new ActionRowBuilder().addComponents(buttons);
  return [row];
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
  const list = items.map((it, i) => {
    const icon = it.type === 'role' ? '👑' : '💎';
    const rolePart = it.type === 'role' && it.roleId ? ` → <@&${it.roleId}>` : '';
    const stockPart = it.stock !== null && it.stock !== undefined ? ` • 📦 ${storeModule.isSoldOut(it) ? '**SOLD OUT**' : `**${it.stock}** left`}` : '';
    return `${i + 1}. ${icon} **${it.name}** — **${it.cost} pts** \`${it.id}\`${rolePart}${stockPart}`;
  }).join('\n') || '*No items yet. Supervisors can add items with `&storeadd`.*';
  return new EmbedBuilder()
    .setTitle('🛒 FREE FIRE STORE')
    .setColor(COLORS.info)
    .setDescription(`${list}`)
    .addFields(
      { name: '⚙️ HOW TO BUY', value: 'Press the **🛒 Buy** button below and choose an item. The price is **deducted from your balance automatically**. Items with a 📦 counter are limited and sell out at zero.' }
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
        await m.delete().catch(() => {});
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

function buildCombinedLeaderboardEmbed() {
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
    embed.setDescription('No matches played yet.');
    embed.setFooter({ text: `Updated <t:${ts}:R> • ${BRANDING}` });
    return embed;
  }

  const podium = ranked.slice(0, 3).map(([id, p], i) => {
    const medal = ['🥇', '🥈', '🥉'][i];
    return `${medal} <@${id}> — **${p.totalPoints} pts**  (${p.wins}W / ${losses[id] || 0}L)`;
  }).join('\n');
  const rest = ranked.slice(3, 10).map(([id, p], i) => {
    return `**#${i + 4}** <@${id}> — ${p.totalPoints} pts  (${p.wins}W / ${losses[id] || 0}L)`;
  }).join('\n');

  embed.setDescription(`${podium}`);
  if (rest) embed.addFields({ name: `─────────────`, value: rest });
  embed.setFooter({ text: `${ranked.length} ranked • Updated <t:${ts}:R> • ${BRANDING}` });
  return embed;
}

async function syncCombinedLeaderboard(guild) {
  if (!guild) return;
  const channel = guild.channels.cache.get(LIVE_LB_CHANNEL_ID);
  if (!channel) return;
  try {
    const msgs = await channel.messages.fetch({ limit: 30 });
    for (const m of msgs.values()) {
      if (m.author.id === client.user.id && m.embeds && m.embeds[0] && String(m.embeds[0].title || '').includes('COMBINED LEADERBOARD')) {
        await m.delete().catch(() => {});
      }
    }
  } catch (e) {
    console.log('[LB] cleanup failed:', e.message);
  }
  const embed = buildCombinedLeaderboardEmbed();
  await channel.send({ embeds: [embed] }).catch(e => console.log('[LB] send failed:', e.message));
  console.log(`[LB] combined leaderboard synced in ${channel.id}`);
}

function refreshCombinedLeaderboard(guild) {
  if (!guild) return;
  syncCombinedLeaderboard(guild).catch(() => {});
}

const reportDrafts = new Map();
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
      if (m.author.id === client.user.id && m.components && m.components.length) await m.delete().catch(() => {});
    }
  } catch (e) { /* ignore */ }
  const embed = new EmbedBuilder()
    .setTitle('🛡️ REPORT A PLAYER')
    .setColor(COLORS.danger)
    .setDescription(
      `Facing a cheater? Report them here.\n` +
      `**Report cost:** ${REPORT_COST} pts (deducted from your balance)\n` +
      `**Reward:** if the player is confirmed as a cheater you earn **+${REPORT_REWARD} pts** and a reward role.\n` +
      `False reports are **not refunded**.`
    )
    .setFooter({ text: BRANDING });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('report_player').setEmoji('🛡️').setLabel('Report Player').setStyle(ButtonStyle.Danger)
  );
  await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
}

async function ensureCheaterChannels(guild) {
  const S = settingsStore.loadSettings();

  let category = guild.channels.cache.get(S.exposeCategoryId || EXPOSE_CATEGORY_ID)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'expose');
  if (!category) {
    try {
      category = await guild.channels.create({ name: 'expose', type: ChannelType.GuildCategory });
    } catch (e) {
      console.log('[CHEAT] create category failed:', e.message);
    }
  }
  if (category) {
    S.exposeCategoryId = category.id;
    settingsStore.saveSettings(S);
  }

  const checkerRoleIds = getCheckerRoleIds();

  let checkChannel = guild.channels.cache.get(S.checkChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'cheater-reports');
  if (!checkChannel) {
    try {
      checkChannel = await guild.channels.create({
        name: 'cheater-reports',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create check channel failed:', e.message);
    }
  }
  if (checkChannel) {
    checkChannel.permissionOverwrites.create(guild.id, { deny: [PermissionsBitField.Flags.ViewChannel] }).catch(() => {});
    for (const rid of checkerRoleIds) {
      checkChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(() => {});
    }
    S.checkChannelId = checkChannel.id;
    settingsStore.saveSettings(S);
  }

  let reportChannel = guild.channels.cache.get(S.reportChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'report-player');
  if (!reportChannel) {
    try {
      reportChannel = await guild.channels.create({
        name: 'report-player',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create report channel failed:', e.message);
    }
  }
  if (reportChannel) {
    reportChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(() => {});
    for (const rid of checkerRoleIds) {
      reportChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(() => {});
    }
    S.reportChannelId = reportChannel.id;
    settingsStore.saveSettings(S);
    await ensureReportButtonMessage(guild, reportChannel);
  }

  let exposeChannel = guild.channels.cache.get(S.exposeChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'expose');
  if (!exposeChannel) {
    try {
      exposeChannel = await guild.channels.create({
        name: 'expose',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[CHEAT] create expose channel failed:', e.message);
    }
  }
  if (exposeChannel) {
    exposeChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(() => {});
    for (const rid of checkerRoleIds) {
      exposeChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(() => {});
    }
    S.exposeChannelId = exposeChannel.id;
    settingsStore.saveSettings(S);
  }

  console.log(`[CHEAT] channels ensured (report ${S.reportChannelId}, check ${S.checkChannelId}, expose ${S.exposeChannelId})`);
}

function buildReportEmbed(guild, report) {
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
    .setDescription(
      `**👤 Reported player**  ${cheater}\n` +
      `**🌐 Platform**  ${REPORT_PLATFORM_ICON[report.platform] || '🔘'} ${report.platform}\n` +
      `**🗡️ Reported by**  <@${report.reporterId}>\n` +
      `**🕒 At**  <t:${Math.floor(report.at / 1000)}:f>\n` +
      `**⚡ Status**  ${statusMap[report.status] || report.status}\n` +
      `${report.claimedBy ? `**🙋 Claimed by**  <@${report.claimedBy}>\n` : ''}` +
      `${report.status === 'marked' && report.checkedBy ? `**🕵️ Checked by**  <@${report.checkedBy}>` : ''}`
    )
    .setFooter({ text: `${report.guildId ? '' : ''}${BRANDING}` });
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
  const msg = await ch.messages.fetch(report.messageId).catch(() => null);
  if (!msg) return;
  const final = ['clean', 'marked', 'cancelled'].includes(report.status);
  const content = report.status === 'marked' && report.checkedBy ? `⛔ Confirmed as cheater by <@${report.checkedBy}>` : '';
  await msg.edit({
    content,
    embeds: [buildReportEmbed(guild, report)],
    components: final ? [] : buildReportButtons(report)
  }).catch(() => {});
}

async function postExpose(guild, report, checkerId, attachments) {
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
      `**🌐 Platform**  ${REPORT_PLATFORM_ICON[report.platform] || '🔘'} ${report.platform}\n` +
      `**🗡️ Reported by**  <@${report.reporterId}>\n` +
      `**🕵️ Checked by**  <@${checkerId}>\n` +
      `**Report**  ${report.id}\n` +
      `**🕒 At**  <t:${Math.floor(report.at / 1000)}:f>`
    )
    .setFooter({ text: BRANDING });
  const files = (attachments || []).map(u => ({ attachment: u }));
  await channel.send({ embeds: [embed], files }).catch(() => {});
}

async function applyCheaterAction(guild, report) {
  const member = await guild.members.fetch(report.cheaterId).catch(() => null);
  if (member) {
    const res = await applyJail(guild, member).catch(() => ({ role: null, affected: [], removedRoles: [] }));
    await member.roles.add(CHEATER_ROLE_ID).catch(() => {});
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
    if (reporter) await reporter.roles.add(roleId).catch(() => {});
  }
  refreshCombinedLeaderboard(guild);
  try {
    const reporter = await guild.members.fetch(report.reporterId).catch(() => null);
    if (reporter) {
      const msg = `🛡️ **Report ${report.id} confirmed!** The player you reported was marked as a cheater.\nYou earned **+${REPORT_REWARD} pts**${roleId ? ' and a reward role.' : '.'}`;
      await reporter.send(msg).catch(() => {});
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
      `Reported player: ${draft.cheaterId ? `<@${draft.cheaterId}>` : `**${draft.cheaterName}**`}\n` +
      `Select the platform they play on to finalize the report.`
    )
    .setFooter({ text: BRANDING });
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
      }).catch(() => {});
    }
  }

  refreshCombinedLeaderboard(interaction.guild);
  const success = new EmbedBuilder()
    .setTitle('🛡️ REPORT SUBMITTED')
    .setColor(COLORS.success)
    .setDescription(
      `**${REPORT_COST} pts** were deducted.\n` +
      `If **${draft.cheaterName}** is confirmed as a cheater you will receive **+${REPORT_REWARD} pts** and a reward role.`
    )
    .setFooter({ text: BRANDING });
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
    cheaterReports.updateReport(id, { status: 'marked', checkedBy: interaction.user.id, claimedBy: interaction.user.id });
    const updated = cheaterReports.getReport(id);
    await renderReportMessage(interaction.guild, updated);

    let thread = null;
    try {
      thread = await interaction.message.startThread({
        name: `check-${report.id}`,
        autoArchiveDuration: 1440,
        reason: 'Cheater proof collection'
      });
    } catch (e) {
      console.log('[CHEAT] startThread failed:', e.message);
    }
    if (!thread) {
      return interaction.reply({ content: '⚠️ Could not create the proof thread. Try again.', ephemeral: true });
    }
    for (const tid of getCheckerRoleIds()) {
      thread.permissionOverwrites.create(tid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(() => {});
    }
    const embed = new EmbedBuilder()
      .setTitle(`🔍 PROOF COLLECTION — ${report.id}`)
      .setColor(COLORS.info)
      .setDescription(
        `Upload **screenshots / videos** as messages in this thread.\n` +
        `When everything is attached, press **✅ Done** to post the exposé.\n\n` +
        `Cheater: ${report.cheaterId ? `<@${report.cheaterId}>` : report.cheaterName}`
      )
      .setFooter({ text: BRANDING });
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`rpt_done_${report.id}`).setEmoji('✅').setLabel('Done — Post Exposé').setStyle(ButtonStyle.Success)
    );
    await thread.send({ embeds: [embed], components: [row] }).catch(() => {});
    return interaction.reply({ content: `🔍 Proof collection started in a private thread. Upload the proofs, then press **Done**.`, ephemeral: true });
  }

  return interaction.reply({ content: '⚠️ Unknown report action.', ephemeral: true });
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

  await postExpose(interaction.guild, report, interaction.user.id, attachments);
  if (report.cheaterId) {
    await applyCheaterAction(interaction.guild, report);
  } else {
    console.log(`[CHEAT] report ${id} marked cheater but no resolvable id — skipped jail/reward`);
  }

  const updated = cheaterReports.getReport(id);
  await renderReportMessage(interaction.guild, updated);

  await interaction.reply({ content: `⛔ **Exposé posted** for ${id}${report.cheaterId ? '' : ' — but the reported player had no resolvable ID (no jail/reward applied).'}`, ephemeral: true });
  try { await thread.setArchived(true).catch(() => {}); } catch { /* ignore */ }
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
      if (m.author.id === client.user.id && m.components && m.components.length) await m.delete().catch(() => {});
    }
  } catch (e) { /* ignore */ }
  const embed = new EmbedBuilder()
    .setTitle('📋 ROLE APPLICATION')
    .setColor(COLORS.info)
    .setDescription(
      `Want to join the team? Pick the role you are applying for.\n` +
      `**🛡️ Checker**  — review reports, run tests and keep matches clean.\n` +
      `**👥 Staff**  — help manage the server and events.\n` +
      `After you apply, staff will interview you in a voice channel to decide.`
    )
    .setFooter({ text: BRANDING });
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('apply_start_checker').setEmoji('🛡️').setLabel('Checker Apply').setStyle(ButtonStyle.Secondary),
    new ButtonBuilder().setCustomId('apply_start_staff').setEmoji('👥').setLabel('Staff Apply').setStyle(ButtonStyle.Primary)
  );
  await channel.send({ embeds: [embed], components: [row] }).catch(() => {});
}

async function ensureApplyChannels(guild) {
  const S = settingsStore.loadSettings();

  let category = guild.channels.cache.get(S.applyCategoryId || APPLY_CATEGORY_ID)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === 'role apply');
  if (!category) {
    try {
      category = await guild.channels.create({ name: 'Role Apply', type: ChannelType.GuildCategory });
    } catch (e) {
      console.log('[APPLY] create category failed:', e.message);
    }
  }
  if (category) {
    S.applyCategoryId = category.id;
    settingsStore.saveSettings(S);
  }

  let applyChannel = guild.channels.cache.get(S.applyChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'role-apply');
  if (!applyChannel) {
    try {
      applyChannel = await guild.channels.create({
        name: 'role-apply',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[APPLY] create apply channel failed:', e.message);
    }
  }
  if (applyChannel) {
    applyChannel.permissionOverwrites.create(guild.id, {
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory],
      deny: [PermissionsBitField.Flags.SendMessages]
    }).catch(() => {});
    S.applyChannelId = applyChannel.id;
    settingsStore.saveSettings(S);
    await ensureApplyButtonMessage(guild, applyChannel);
  }

  let queueChannel = guild.channels.cache.get(S.applyQueueChannelId)
    || guild.channels.cache.find(c => c.type === ChannelType.GuildText && c.name === 'role-applications');
  if (!queueChannel) {
    try {
      queueChannel = await guild.channels.create({
        name: 'role-applications',
        type: ChannelType.GuildText,
        parent: category ? category.id : undefined
      });
    } catch (e) {
      console.log('[APPLY] create queue channel failed:', e.message);
    }
  }
  if (queueChannel) {
    queueChannel.permissionOverwrites.create(guild.id, { deny: [PermissionsBitField.Flags.ViewChannel] }).catch(() => {});
    for (const rid of getStaffRoleIds()) {
      queueChannel.permissionOverwrites.create(rid, {
        allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages]
      }).catch(() => {});
    }
    S.applyQueueChannelId = queueChannel.id;
    settingsStore.saveSettings(S);
  }

  const vcNames = ['⏳ Waiting for Apply', '🛡️ Checker Role', '👥 Staff Role'];
  for (const vcName of vcNames) {
    let vc = category ? category.children.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName) : guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName);
    if (!vc) {
      try {
        vc = await guild.channels.create({ name: vcName, type: ChannelType.GuildVoice, parent: category ? category.id : undefined });
      } catch (e) {
        console.log('[APPLY] create voice failed:', e.message);
      }
    }
  }

  console.log(`[APPLY] channels ensured (apply ${S.applyChannelId}, queue ${S.applyQueueChannelId}, cat ${S.applyCategoryId})`);
}

function buildApplyEmbed(guild, app) {
  const statusMap = { pending: '⏳ Pending', accepted: '✅ Accepted', declined: '❌ Declined' };
  return new EmbedBuilder()
    .setTitle(`📋 ROLE APPLICATION ${app.id}`)
    .setColor(COLORS.info)
    .setDescription(
      `**🛡️ Role**  ${APPLY_TYPE_LABEL[app.roleType] || app.roleType}\n` +
      `**🧑 Applicant**  <@${app.userId}>\n` +
      `**🎮 In-game name**  ${app.ign}\n` +
      `**💬 Why / experience**  ${app.why.length > 900 ? app.why.slice(0, 900) + '…' : app.why}\n` +
      `**🕒 Submitted**  <t:${Math.floor(app.at / 1000)}:f>\n` +
      `**⚡ Status**  ${statusMap[app.status] || app.status}`
    )
    .setFooter({ text: BRANDING });
}

function buildApplyButtons(appId) {
  return [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_wait_${appId}`).setEmoji('⏳').setLabel('Waiting VC').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`app_checkervc_${appId}`).setEmoji('🛡️').setLabel('Checker VC').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`app_staffvc_${appId}`).setEmoji('👥').setLabel('Staff VC').setStyle(ButtonStyle.Secondary)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`app_accept_${appId}`).setEmoji('✅').setLabel('Accept').setStyle(ButtonStyle.Success),
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
      new TextInputBuilder().setCustomId('applyWhy').setLabel('Why should we trust you? (experience / activity)').setStyle(TextInputStyle.Paragraph).setRequired(true).setPlaceholder('Tell us about your experience, schedule and why you deserve the role.')
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
    ? { content: `✅ **Application submitted!** (${app.id})\nStaff will review it and interview you in a voice channel. Keep an eye on your DMs.`, ephemeral: true }
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
    const vcName = action === 'wait' ? '⏳ Waiting for Apply' : action === 'checkervc' ? '🛡️ Checker Role' : '👥 Staff Role';
    let vc = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName);
    if (!vc) {
      const cat = interaction.guild.channels.cache.get(settingsStore.loadSettings().applyCategoryId || APPLY_CATEGORY_ID);
      vc = cat ? cat.children.cache.find(c => c.type === ChannelType.GuildVoice && c.name === vcName) : null;
    }
    if (!vc) return interaction.reply({ content: '⚠️ Voice channel not found.', ephemeral: true });
    if (!member || !member.voice || !member.voice.channel) {
      return interaction.reply({ content: `ℹ️ <@${app.userId}> is not in any voice channel. Ask them to join one first, or mention them.`, ephemeral: true });
    }
    await member.voice.setChannel(vc.id).catch(() => {});
    return interaction.reply({ content: `🎙️ Moved <@${app.userId}> to **${vcName}**.`, ephemeral: true });
  }

  if (action === 'accept') {
    const role = await getApplyRole(interaction.guild, app.roleType);
    if (!role) {
      return interaction.reply({ content: '❌ No role found to grant for **' + APPLY_TYPE_LABEL[app.roleType] + '**. Assign `&setrole ' + app.roleType + ' <role>`.' });
    }
    if (member) {
      await member.roles.add(role).catch(() => {});
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
  const msg = await ch.messages.fetch(app.messageId).catch(() => null);
  if (!msg) return;
  await msg.edit({
    embeds: [buildApplyEmbed(guild, app)],
    components: app.status === 'pending' ? buildApplyButtons(app.id) : []
  }).catch(() => {});
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
    applyRankOneRole(interaction.guild, computeCombinedRanking()).catch(() => {});
  } else {
    const logsChannel = interaction.guild.channels.cache.get(config.logsChannelId);
    const staffMention = config.staffRoles.length ? config.staffRoles.map(id => `<@&${id}>`).join(' ') : '';
    if (logsChannel) {
      await logsChannel.send({
        content: `💎 **Diamond/Gems purchase!**\nBuyer: <@${member.id}>\nItem: **${item.name}** (${item.cost} pts deducted)\nStaff, please deliver the diamonds.${staffMention ? `\n${staffMention}` : ''}`
      }).catch(() => {});
    } else {
      await interaction.channel.send({ content: `💎 <@${member.id}> bought **${item.name}** (${item.cost} pts deducted). ${staffMention || 'Staff'}, please deliver the diamonds.` }).catch(() => {});
    }
  }

  if (syncStoreEmbed) syncStoreEmbed(interaction.guild).catch(() => {});
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
  c.user.setActivity('Free Fire | !play 2v2/3v3/4v4', { type: 3 });
  postCommandsInfoWithRetry();
  for (const g of c.guilds.cache.values()) {
    ensureCheaterChannels(g).catch(() => {});
    ensureApplyChannels(g).catch(() => {});
  }
  const guild = c.guilds.cache.first();
  const ranked = computeCombinedRanking();
  if (guild && ranked.length) applyRankOneRole(guild, ranked).catch(() => {});
  for (const g of c.guilds.cache.values()) {
    syncInviteCache(g);
  }
  const selfHealed = manager.validateAllMatches();
  if (selfHealed.length) {
    console.log(`[SELF-HEAL] startup sweep repaired ${selfHealed.length} match(es):`, selfHealed);
  }
  for (const g of c.guilds.cache.values()) {
    const restored = manager.getAllMatches();
    for (const rm of restored) {
      if (rm.status === 'waiting' && !rm.joinTimeout) {
        rm.configTimeout = rm.configTimeout || null;
        rm.joinTimeout = setTimeout(() => timeoutMatch(g, rm.id), 2 * 60 * 1000);
        console.log(`[RESTORE] re-armed join timeout for ${rm.id}`);
      }
    }
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
});

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
}, 5 * 60 * 1000);

client.on(Events.MessageCreate, async (message) => {
  try {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lowercase = content.toLowerCase();

  if (lowercase.startsWith('!play') || lowercase.startsWith('!esport')) {
    const isEsport = lowercase.startsWith('!esport');
    const mode = isEsport ? 'esport' : 'amo';
    const modeCfg = getModeConfig(mode);

    if (isEsport) {
      await ensureEsportChannels(message.guild);
    }

    const matchChannelId = getModeConfig(mode).matchChannelId;
    const ammoChannelId = getModeConfig(mode).ammoChannelId;
    if (message.channel.id !== matchChannelId && message.channel.id !== ammoChannelId) {
      return message.reply(`❌ Please use \`${modeCfg.command}\` in the ${modeCfg.displayName} channel <#${matchChannelId}> or <#${ammoChannelId}>.`);
    }

    const existing = manager.getMatchByCreator(message.author.id, mode);
    if (existing) {
      return message.reply('❌ You already have a pending match! Cancel it first.');
    }

    const args = content.split(/\s+/);
    const teamSize = parseTeamSize(args[1]);
    if (!teamSize) {
      return message.reply(`❌ Please specify a team size: \`${modeCfg.command} 2v2\`, \`${modeCfg.command} 3v3\`, or \`${modeCfg.command} 4v4\`.`);
    }

    if (!isInRequiredVoice(message.member)) {
      return message.reply(voiceCheckMessage());
    }

    const bl = blacklistModule.isBlacklisted(message.author.id);
    if (bl) {
      return message.reply(blacklistMessage(bl));
    }

    const match = manager.createMatch(message.author.id, teamSize, message.channel.id, mode);

    const setupEmbed = new EmbedBuilder()
      .setTitle(`👾 __Free Fire ${teamSize}v${teamSize} Match__`)
      .setDescription(
        `Match started by <@${message.author.id}>\n\n` +
        `Press **Set Room Config** below to enter your room details, then players use the buttons to lock their slots.`
      )
      .setColor('#2F3136')
      .setFooter({ text: BRANDING });

    const setupButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_${match.id}`)
        .setEmoji('⚙️')
        .setLabel('Set Room Config')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`cancel_${match.id}`)
        .setEmoji('❌')
        .setLabel('Cancel Game')
        .setStyle(ButtonStyle.Danger)
    );

    const msg = await message.reply({ embeds: [setupEmbed], components: [setupButton] });
    match.message = msg.id;
    return;
  }

  if (lowercase.startsWith('!forcefull')) {
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
      await startFullMatch(message.guild, match);
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
    const toDelete = msgs.filter(m =>
      (m.author.id === client.user.id && !activeMsgs.includes(m.id)) ||
      m.content.trim().toLowerCase().startsWith('!play')
    );
    if (toDelete.size > 0) {
      await channel.bulkDelete(toDelete).catch(async () => {
        for (const m of toDelete.values()) {
          await m.delete().catch(() => {});
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

  const winIds = winnerTeam === 1 ? match.team1 : match.team2;
  const loseIds = loserTeam === 1 ? match.team1 : match.team2;

  const lines = [];
  for (const uid of winIds) {
    const pts = uid === match.mvpWinnerId ? REWARDS.winnerMvp : REWARDS.winner;
    storage.addPoints(uid, pts, 'win', mode);
    lines.push(`🏆 <@${uid}> **+${pts}**`);
  }
  for (const uid of loseIds) {
    const pts = uid === match.mvpLoserId ? REWARDS.loserMvp : REWARDS.loser;
    storage.addPoints(uid, pts, 'loss', mode);
    lines.push(`💪 <@${uid}> +${pts}`);
  }

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
    const msg = await channel.messages.fetch(match.resultMessageId).catch(() => null);
    if (msg) {
      const resultEmbed = new EmbedBuilder()
        .setTitle('✅ Match Finished!')
        .setColor(COLORS.green)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Winner MVP <@${match.mvpWinnerId}> vs Loser MVP <@${match.mvpLoserId}>` });
      await msg.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
    }
  }

  await dumpMatchChat(guild, match);

  await manager.finishMatch(guild, match);
  applyRankNicknames(guild).catch(() => {});
  refreshCombinedLeaderboard(guild);
}

async function timeoutMatch(guild, matchId, phase = 'lobby') {
  const match = manager.getMatch(matchId);
  if (!match || match.status !== 'waiting') return;
  const channel = guild.channels.cache.get(match.channelId);
  if (channel) {
    const msg = await channel.messages.fetch(match.message).catch(() => null);
    if (msg) await msg.delete().catch(() => {});
    if (phase === 'config') {
      await channel.send('⏰ **Room config timed out!** The host didn\'t set up the room within 30 seconds. Match cancelled.').catch(() => {});
    } else {
      await channel.send('⏰ **Match timed out!** The lobby didn\'t fill up within 2 minutes.').catch(() => {});
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

  const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
  if (msg) {
    await msg.edit({
      embeds: [buildMatchBoxEmbed(interaction.guild, match, interaction.user)],
      components: buildMatchButtons(match, interaction.user.id)
    });
  }

  await interaction.reply({ content: `✅ Joined Team ${team}!`, ephemeral: true });
  await updateMatchChannel(interaction.guild, match);

  if (manager.isTeamsFull(match.id)) {
    try {
      await startFullMatch(interaction.guild, match);
    } catch (e) {
      console.error('Error starting match:', e);
      await interaction.channel.send({ content: `❌ Error starting match: ${e.message}. Make sure the bot can manage channels.` }).catch(() => {});
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  try {
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
    const password = interaction.fields.getTextInputValue('passwordInput').trim();
    const matchKey = interaction.fields.getTextInputValue('keyInput').trim();
    const roomName = interaction.fields.getTextInputValue('roomNameInput').trim();

    if (![2, 3, 4].includes(match.teamSize)) {
      console.log('[MODAL] invalid team size on match', match.teamSize);
      return interaction.editReply({ content: '❌ Invalid team size. Start the match with `!play 2v2/3v3/4v4`!' });
    }

    match.roomId = roomId;
    match.password = password;
    match.key = matchKey;
    match.roomName = roomName;
    match.team1.push(interaction.user.id);
    console.log(`[MODAL] teamSize=${match.teamSize} roomId=${roomId} pass=${password} key=${matchKey} roomName=${roomName} creator auto-joined T1`);

    try {
      const matchEmbed = buildMatchBoxEmbed(interaction.guild, match, interaction.user);
      const components = buildMatchButtons(match, interaction.user.id);

      const channel = interaction.guild.channels.cache.get(match.channelId);
      console.log('[MODAL] apostado channel found:', !!channel);
      const oldMsg = await channel.messages.fetch(match.message).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});

      const newMsg = await channel.send({ embeds: [matchEmbed], components });
      match.message = newMsg.id;
      manager.persistMatches();
      console.log('[MODAL] match box sent successfully, new msg id:', newMsg.id);

      await interaction.editReply({ content: `✅ Match created! You are on 🔴 Team 1.` }).catch(() => {});
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
      await interaction.editReply({ content: `❌ Error creating match: ${e.message}.` }).catch(() => {});
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
    if (!captains.includes(voterId)) {
      return interaction.reply({ content: '❌ Only the **first player of each team** can vote!', ephemeral: true });
    }
    const otherId = voterId === match.team1[0] ? match.team2[0] : match.team1[0];

    if (kind === 'type') {
      const isWinner = interaction.values[0] === 'winner';
      const setKey = isWinner ? 'winnerVoteSet' : 'loserVoteSet';
      const votesKey = isWinner ? 'winnerVotes' : 'loserVotes';
      if (match[setKey]) {
        return interaction.reply({ content: `✅ ${isWinner ? 'Winner' : 'Loser'} MVP was already finalized.`, ephemeral: true });
      }
      if (match[votesKey][voterId]) {
        return interaction.reply({ content: '✅ You already voted! Use ❌ Cancel My Vote to change it.', ephemeral: true });
      }
      const opts = mvpPlayerOptions(interaction.guild, match, isWinner ? match.mvpLoserId : match.mvpWinnerId);
      if (opts.length === 0) {
        return interaction.reply({ content: '⚠️ No players found in this match.', ephemeral: true });
      }
      const embed = new EmbedBuilder()
        .setTitle(isWinner ? '🏆 SELECT WINNER MVP' : '💪 SELECT LOSER MVP')
        .setColor(isWinner ? COLORS.gold : COLORS.loser)
        .setDescription(`Pick a player from the match roster below (first **2 players of each team** in registration order).`);
      const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`${isWinner ? 'mvvp' : 'mvlp'}_${match.id}`)
          .setPlaceholder('Select Players')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(opts)
      );
      return interaction.update({ embeds: [embed], components: [row] });
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
    manager.persistMatches();

    const other = otherId ? match[votesKey][otherId] : null;
    let msg;
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
      msg = `✅ Both captains agree! ${isWinner ? '🏆 Winner MVP' : '💪 Loser MVP'}: <@${selected}>`;
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
      msg = `❌ Votes aren't the same, please try again!`;
      interaction.channel.send({ content: `❌ **${isWinner ? 'Winner' : 'Loser'} votes didn't match, please vote again!** (captains <@${match.team1[0]}> & <@${match.team2[0]}>)` }).catch(() => {});
    } else {
      const otherName = otherId ? await getPlayerName(interaction.guild, otherId) : 'the other captain';
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

      const roomNameInput = new TextInputBuilder()
        .setCustomId('roomNameInput')
        .setLabel('Room Name (Optional)')
        .setPlaceholder('Optional - e.g. FF Match Room')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);

      const row4 = new ActionRowBuilder().addComponents(roomNameInput);

      roomModal.addComponents(row1, row2, row3, row4);

      if (match.configTimeout) clearTimeout(match.configTimeout);
      match.configTimeout = setTimeout(() => {
        timeoutMatch(interaction.guild, match.id, 'config');
      }, 30 * 1000);

      return interaction.showModal(roomModal);
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

      return interaction.showModal(keyModal);
    }

    if (action === 'mvpvote' || action === 'mvpwinner' || action === 'mvploser') {
      if (match.status !== 'full') {
        return interaction.reply({ content: '❌ This match is not in a votable state.', ephemeral: true });
      }
      const captains = [match.team1[0], match.team2[0]].filter(Boolean);
      const isVoteStaff = (config.matchViewerRoles || []).some(rid => rid && interaction.member.roles.cache.has(rid));
      if (!captains.includes(interaction.user.id) && !isVoteStaff) {
        return interaction.reply({ content: '❌ Only the **first player of each team** (or match staff) can vote!', ephemeral: true });
      }
      if (match.winnerVoteSet && match.loserVoteSet) {
        return interaction.reply({ content: '✅ MVP votes were already finalized.', ephemeral: true });
      }
      const roster = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
      if (roster.length === 0) {
        return interaction.reply({ content: '⚠️ No players found in this match.', ephemeral: true });
      }
      const typeRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
          .setCustomId(`mvptype_${match.id}`)
          .setPlaceholder('Select the vote type')
          .setMinValues(1)
          .setMaxValues(1)
          .addOptions(
            new StringSelectMenuOptionBuilder().setLabel('🏆 Winner MVP').setValue('winner'),
            new StringSelectMenuOptionBuilder().setLabel('💪 Loser MVP').setValue('loser')
          )
      );
      const embed = new EmbedBuilder()
        .setTitle('🗳️ MVP Voting')
        .setColor(COLORS.gold)
        .setDescription('Select **Winner MVP** or **Loser MVP**, then pick the player.\nOnly the **first 2 players of each team** are listed.');
      return interaction.reply({ embeds: [embed], components: [typeRow], ephemeral: true });
    }

    if (action === 'votecancel') {
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
      return interaction.reply({
        content: changed.length
          ? `✅ Your ${changed.join(' & ')} vote was cleared. Vote again with 🗳️ Vote MVP.`
          : 'ℹ️ No pending votes to clear (agreed votes are locked).',
        ephemeral: true
      });
    }

    if (action === 'staffreq') {
      const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
      if (!allPlayers.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Only players in this match can request staff!', ephemeral: true });
      }
      const roleMentions = (config.staffRoles || []).map(id => `<@&${id}>`).join(' ');
      await interaction.deferReply({ ephemeral: true });
      const staffMsg = `🛡️ **Staff Request** from <@${interaction.user.id}> for Match ${match.teamSize}v${match.teamSize}.\n${roleMentions}`;
      try {
        await interaction.channel.send({ content: staffMsg, allowedMentions: { roles: (config.staffRoles || []), users: [] } });
        await interaction.editReply({ content: '✅ Staff has been notified!' });
      } catch (e) {
        console.log('[STAFF] send failed:', e.message);
        await interaction.editReply({ content: staffMsg });
      }
      return;
    }

    if (action === 'leave') {
      if (match.status === 'full') {
        return interaction.reply({ content: '❌ The match has started! You can only leave by using **Cancel Match** or an admin action.', ephemeral: true });
      }
      if (match.creatorId === interaction.user.id) {
        return interaction.reply({ content: '❌ The match host cannot leave! Use **Cancel Game** to close the room.', ephemeral: true });
      }
      const result = manager.leaveMatch(matchId, interaction.user.id);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        await msg.edit({
          embeds: [buildMatchBoxEmbed(interaction.guild, match, interaction.user)],
          components: buildMatchButtons(match, interaction.user.id)
        });
      }

      await interaction.reply({ content: '🚪 You left the match!', ephemeral: true });
      await updateMatchChannel(interaction.guild, match);
    }

    if (action === 'cancel') {
      if (match.status === 'full') {
        if (interaction.channel && interaction.channel.id === match.channelId2) {
          return openCancelVote(interaction.guild, match, interaction);
        }
        return interaction.reply({ content: '⚠️ Use the **❌ Cancel Match** button inside the match room to start a cancel vote.', ephemeral: true });
      }
      if (match.creatorId !== interaction.user.id && !hasCommandAccess(interaction.member)) {
        return interaction.reply({ content: '❌ Only the match host can cancel the match!', ephemeral: true });
      }
      await cancelMatch(interaction.guild, match, `❌ **Match cancelled by** <@${interaction.user.id}>`);
      await interaction.reply({ content: '❌ Match cancelled!', ephemeral: true });
      return;
    }

    if (action === 'cancelfvote') {
      if (match.status !== 'full') {
        return interaction.reply({ content: '❌ This match is not cancellable by vote right now.', ephemeral: true });
      }
      const team = manager.getPlayerTeam(match, interaction.user.id);
      if (!team) {
        return interaction.reply({ content: '❌ Only players in this match can vote to cancel!', ephemeral: true });
      }
      match.cancelVotes = match.cancelVotes || { 1: [], 2: [] };
      if ((match.cancelVotes[team] || []).includes(interaction.user.id)) {
        return interaction.reply({ content: '✅ You already voted to cancel!', ephemeral: true });
      }
      match.cancelVotes[team].push(interaction.user.id);
      manager.persistMatches();

      const roomChannel = interaction.guild.channels.cache.get(match.channelId2) || interaction.channel;
      const ok = (match.cancelVotes[1] || []).length >= CANCEL_NEEDED && (match.cancelVotes[2] || []).length >= CANCEL_NEEDED;

      if (match.cancelMsgId && roomChannel) {
        const cmsg = await roomChannel.messages.fetch(match.cancelMsgId).catch(() => null);
        if (cmsg) await cmsg.edit({
          embeds: [buildCancelVoteEmbed(match)],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`cancelfvote_${match.id}`).setLabel('🗳️ Vote for Cancel').setStyle(ButtonStyle.Danger)
          )]
        }).catch(() => {});
      }

      if (ok) {
        await cancelMatch(interaction.guild, match, `❌ **Match cancelled by player vote** (<@${interaction.user.id}>)`);
        return interaction.reply({ content: '❌ **The cancel vote passed — match cancelled!**', ephemeral: true });
      }
      return interaction.reply({ content: `✅ Vote recorded! Team ${team} now has ${(match.cancelVotes[team] || []).length}/${CANCEL_NEEDED}. Need ${CANCEL_NEEDED} from **each** team to cancel.`, ephemeral: true });
    }

    if (action === 'staffcancel') {
      const isStaff = interaction.member.permissions.has('Administrator') ||
        [...(config.staffRoles || []), ...(config.adminRoles || [])].some(rid => interaction.member.roles.cache.has(rid));
      if (!isStaff) {
        return interaction.reply({ content: '❌ Only staff can cancel the match!', ephemeral: true });
      }
      await cancelMatch(interaction.guild, match, `🚫 **Match cancelled by staff** (<@${interaction.user.id}>)`);
      await interaction.reply({ content: '🚫 Match cancelled by staff!', ephemeral: true });
      return;
    }
  }
  } catch (e) {
    errLog(`InteractionCreate error (${interaction.customId}):`, e);
    try {
      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ content: '❌ Something went wrong. Please try again.' }).catch(() => {});
      } else {
        await interaction.reply({ content: '❌ Something went wrong. Please try again.', ephemeral: true }).catch(() => {});
      }
    } catch { /* ignore */ }
  }
});

const adminCommands = {
  leaderboard: async (message, mode = 'amo') => {
    const sorted = storage.getLeaderboard(mode);
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
      .setFooter({ text: `${sorted.length} player${sorted.length === 1 ? '' : 's'} ranked • ${BRANDING}` });

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
    stripRankNicknames(message.guild).catch(() => {});
    refreshCombinedLeaderboard(message.guild);
  },
  setpoints: async (message, mode = 'amo') => {
    if (!canAddPoints(message.member)) {
      return message.reply('❌ You don\'t have permission to adjust points!');
    }
    const args = message.content.split(/\s+/);
    if (args.length < 4) return message.reply('Usage: `!setpoints @user points type (win/loss)`');

    const user = message.mentions.users.first();
    if (!user) return message.reply('❌ Please mention a user!');

    const points = parseInt(args[2]);
    if (isNaN(points)) return message.reply('❌ Invalid points value!');

    const type = (args[3] || 'win').toLowerCase() === 'loss' ? 'loss' : 'win';
    const result = storage.addPoints(user.id, points, type, mode);
    await message.reply(`✅ Added **${points}** points to <@${user.id}>. Total: **${result.totalPoints}**`);
    applyRankNicknames(message.guild).catch(() => {});
    refreshCombinedLeaderboard(message.guild);
  }
};

client.on(Events.MessageCreate, async (message) => {
  try {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();
  const mode = getModeByChannel(message.channel.id);

  if (content.startsWith('&clear')) {
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
      const fetched = await message.channel.messages.fetch({ limit: count });
      const delCount = fetched.size;
      await message.delete().catch(() => {});
      await message.channel.bulkDelete(fetched).catch(async () => {
        for (const m of fetched.values()) {
          await m.delete().catch(() => {});
        }
      });
      const conf = await message.channel.send(`✅ Successfully cleared **${delCount}** message(s)!`).catch(() => null);
      if (conf) setTimeout(() => conf.delete().catch(() => {}), 4000);
    } catch (e) {
      console.log('Clear error:', e.message);
    }
    return;
  }

  if (content === '&store') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can refresh the store!');
    }
    await message.delete().catch(() => {});
    await syncStoreEmbed(message.guild, message.channel);
    return;
  }
  if (content === '&refreshstore') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can refresh the store!');
    }
    await syncStoreEmbed(message.guild, message.channel);
    return message.reply(`✅ Store updated here (<#${message.channel.id}>) - old message replaced.`);
  }

  if (content.startsWith('&remove')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can remove points!');
    }
    const args = content.split(/\s+/);
    const userId = args[1];
    const points = parseInt(args[2]);
    if (!/^\d{15,20}$/.test(userId || '')) {
      return message.reply('Usage: `&remove <userID> <points>`');
    }
    if (isNaN(points) || points <= 0) {
      return message.reply('❌ Invalid points amount. Usage: `&remove <userID> <points>`');
    }
    const mode = getModeByChannel(message.channel.id);
    const total = storage.adjustPoints(userId, -points, mode);
    applyRankNicknames(message.guild).catch(() => {});
    refreshCombinedLeaderboard(message.guild);
    return message.reply(`❌ Removed **${points} pts** from <@${userId}> (${mode}). New total: **${total} pts**.`);
  }

  if (content.startsWith('&storeadd')) {
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

  if (content.startsWith('&storeremove')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can remove store items!');
    }
    const id = content.replace('&storeremove', '').trim();
    if (!id) return message.reply('Usage: `&storeremove <itemId>`');
    const ok = storeModule.removeItem(id);
    if (ok) await syncStoreEmbed(message.guild);
    return message.reply(ok ? `🚮 Store item \`${id}\` removed. The store was updated.` : '❌ Item not found.');
  }

  if (content === '&commands') {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can post the commands list!');
    }
    const target = message.guild.channels.cache.get(config.infoChannelId) || message.channel;
    const sent = await sendCommandsInfo(target);
    if (sent) return message.reply(`✅ Commands list posted in <#${target.id}>.`);
    return message.reply(`ℹ️ Commands list already exists in <#${target.id}>.`);
  }

  if (content.startsWith('&announce')) {
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
    const text = raw.replace(/^&announce\s+/i, '').replace(channelId, '').trim();
    const sent = await target.send(text).catch((e) => {
      message.reply(`❌ Could not send: ${e.message}`);
      return null;
    });
    if (sent) return message.reply(`✅ Announcement posted in <#${channelId}>.`);
    return;
  }

  if (content === '!balance' || content === '!bal') {
    let targetId = message.author.id;
    const rest = message.content.replace(/!balance|!bal/i, '').trim();
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
    const rest = message.content.replace(/^!stats\s*/i, '').trim();
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
    const cleared = manager.clearAllMatches();
    await message.reply(`🧹 Cleared **${cleared}** stuck match(es)!`);
  } else if (content.startsWith('!cancelgame')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can cancel a match!');
    }
    const target = message.mentions.users.first();
    if (!target) return message.reply('Usage: `!cancelgame @user`');
    const existing = manager.getAllMatches().find(m => m.creatorId === target.id && m.mode === mode);
    if (!existing) return message.reply('❌ No active match found for that user.');
    await cancelMatch(message.guild, existing, `❌ **Match cancelled by admin** (<@${message.author.id}>)`);
    await message.reply(`❌ **Match cancelled by admin!** <@${target.id}>'s match has been cancelled.`);
  } else if (content.startsWith('&blacklist')) {
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
  } else if (content.startsWith('&unblacklist')) {
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
  } else if (content.startsWith('&setrole')) {
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
        ensureCheaterChannels(g).catch(() => {});
        ensureApplyChannels(g).catch(() => {});
      }
    }
  } else if (content.startsWith('&jail')) {
    if (!canUseJail(message.member)) {
      return message.reply('❌ Only admins can jail players!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 4) {
      return message.reply('Usage: `&jail <userId> <duration> <reason>`\nDurations: `30m`, `5h`, `7d`, `2w`, `perm`');
    }
    const userId = args[1];
    if (!/^\d{15,20}$/.test(userId)) {
      return message.reply('❌ Invalid user ID.');
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
  } else if (content.startsWith('&unjail')) {
    if (!canUseJail(message.member)) {
      return message.reply('❌ Only admins can unjail players!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 2) {
      return message.reply('Usage: `&unjail <userId>`');
    }
    const entry = jailModule.unjailUser(args[1]);
    if (!entry) return message.reply('ℹ️ That user is not jailed.');
    const role = message.guild.roles.cache.get(entry.roleId);
    const member = await message.guild.members.fetch(args[1]).catch(() => null);
    await unjailMember(message.guild, member, role, entry.affectedChannels, entry.removedRoles);
    await message.reply(`✅ <@${args[1]}> has been released from jail.`);
  } else if (content.startsWith('!setranks')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can set rank nicknames!');
    }
    await message.reply('⏳ Updating rank nicknames...');
    const res = await applyRankNicknames(message.guild);
    await message.channel.send(`✅ Rank nicknames updated: **${res.done}** set (${res.failed} skipped).`).catch(() => {});
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
    let match = null;
    if (target) {
      match = manager.getAllMatches().find(m =>
        m.status === 'full' &&
        ((m.team1 || []).includes(target.id) || (m.team2 || []).includes(target.id))
      ) || manager.getAllMatches().find(m => m.creatorId === target.id);
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
  } else if (content.startsWith('!w') || content.startsWith('!l')) {
    const isWin = content.startsWith('!w');
    if (!canSetResult(message.member)) {
      return message.reply('⚙️ **`!w` / `!l` is staff-only.**\nPlayers vote for the MVPs using the **🗳️ Vote MVP** buttons in the match room.');
    }
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(`Usage: \`${isWin ? '!w' : '!l'} @player\``);
    }
    console.log(`[VOTE] ${message.author.id} used ${isWin ? '!w' : '!l'} target=${target.id}; roles=[${message.member ? [...message.member.roles.cache.keys()].join(', ') : 'NULL MEMBER'}]`);

    if (canSetResult(message.member)) {
      console.log(`[VOTE] allowed: ${message.author.id} canSetResult=true, matches=[${manager.getAllMatches().map(mm => `${mm.id}:${mm.status}`).join(', ')}]`);
      const adminMatch = manager.getAllMatches().find(m =>
        m.status === 'full' &&
        ((m.team1 || []).includes(target.id) || (m.team2 || []).includes(target.id))
      ) || manager.getAllMatches().find(m => m.status === 'full');
      if (!adminMatch) {
        return message.reply('❌ No active match found for that player.');
      }
      const team = adminMatch.team1.includes(target.id) ? 1 : 2;
      if (isWin) {
        if (adminMatch.winnerTeam) {
          return message.reply('✅ Winner is already set. Use `!l @player` to set the loser.');
        }
        if (adminMatch.loserId === target.id) {
          return message.reply('❌ <@' + target.id + '> is already the Loser MVP — a player can\'t be both!');
        }
        adminMatch.winnerTeam = team;
        adminMatch.mvpWinnerId = target.id;
        adminMatch.winnerId = target.id;
        adminMatch.winnerVoteSet = true;
      } else {
        if (adminMatch.loserTeam) {
          return message.reply('✅ Loser is already set. Use `!w @player` to set the winner.');
        }
        if (adminMatch.winnerId === target.id) {
          return message.reply('❌ <@' + target.id + '> is already the Winner MVP — a player can\'t be both!');
        }
        adminMatch.loserTeam = team;
        adminMatch.mvpLoserId = target.id;
        adminMatch.loserId = target.id;
        adminMatch.loserVoteSet = true;
      }
      manager.persistMatches();
      await message.reply(`✅ ${isWin ? '🏆 Winner' : '💪 Loser'} set by <@${message.author.id}>: <@${target.id}> (Team ${team}).`);
      if (adminMatch.winnerTeam && adminMatch.loserTeam) {
        await settleMatchResult(message.guild, adminMatch);
      } else {
        const pending = isWin ? '💪 **!l** loser' : '🏆 **!w** winner';
        await message.channel.send({ content: `⏳ Waiting for the ${pending} before finishing the match.` }).catch(() => {});
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
  const cachedMap = client.invitesCache.get(guild.id);
  await syncInviteCache(guild);
  const newMap = client.invitesCache.get(guild.id);
  if (!newMap || !cachedMap) return;

  let usedInvite = null;
  for (const [code, inv] of newMap) {
    const prev = cachedMap.get(code);
    if (prev && inv.uses > prev.uses) {
      usedInvite = inv;
      break;
    }
  }
  if (!usedInvite || !usedInvite.inviterId || usedInvite.inviterId === member.id) return;

  const points = config.inviteBonus || 10;
  storage.adjustPoints(usedInvite.inviterId, points, 'amo');
  console.log(`[INVITE] ${member.id} joined via invite of ${usedInvite.inviterId}; +${points} pts`);
  refreshCombinedLeaderboard(guild);
  const inviter = guild.members.cache.get(usedInvite.inviterId);
  if (inviter) {
    inviter.send(`🎉 **New member via your invite!**\n<@${member.id}> joined your server using your invite link. You earned **${points} points**!`).catch(() => {});
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
  if (member.roles.cache.has('1546807156970487838')) return;
  if (manager.isSuppressed(member.id)) return;
  const match = manager.getActiveMatchForPlayer(member.id);
  if (!match || match.closing) return;

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
      await fresh.voice.setChannel(targetVoice).catch(() => {});
      console.log(`[VOICE] pulled ${member.id} back to match voice (from ${newState.channelId})`);
    }
  }

  match.voiceViolations = match.voiceViolations || {};
  match.voiceViolations[member.id] = (match.voiceViolations[member.id] || 0) + 1;
  const count = match.voiceViolations[member.id];
  const leftOf = 3 - count;
  manager.persistMatches();

  const action = leftVoice ? 'left the match voice' : `switched to another voice channel (pulled back to <#${targetVoice}>)`;
  console.log(`[VOICE] ${member.id} ${action} -> violation ${count}/3`);
  await member.send(`⚠️ **Voice Warning (${count}/3)** — you ${action} during an active match!${leftOf > 0 ? ` ${leftOf} more time(s) and you will be **blacklisted for 30 minutes**.` : ''}`).catch(() => {});
  const room = member.guild.channels.cache.get(match.channelId2);
  if (room) room.send(`⚠️ <@${member.id}> ${action} (**${count}/3**).`).catch(() => {});
  if (count >= 3) {
    blacklistModule.blacklistUser(member.id, 30 * 60 * 1000, 'Abandoned the match voice 3 times', client.user.id);
    await member.send('⛔ **You have been blacklisted for 30 minutes** for abandoning the match voice 3 times.').catch(() => {});
    if (room) room.send(`⛔ <@${member.id}> has been **blacklisted for 30 minutes** for abandoning the match voice 3 times.`).catch(() => {});
  }
  } catch (e) {
    errLog('VoiceStateUpdate error:', e);
  }
});

client.login(config.token);

