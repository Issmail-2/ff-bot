const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField, StringSelectMenuBuilder, StringSelectMenuOptionBuilder } = require('discord.js');
let config;
try { config = require('./config.json'); } catch { config = {}; }
if (process.env.DISCORD_TOKEN) config.token = process.env.DISCORD_TOKEN;
if (process.env.SUPERVISOR_ROLE_ID) config.supervisorRoleId = process.env.SUPERVISOR_ROLE_ID;
if (!config.modes) config.modes = {};
if (!config.modes.amo) config.modes.amo = { name:'amo', displayName:'Custom Room', command:'!play', matchChannelId: process.env.AMO_CHANNEL_ID||'1545315593450954762', voiceCategoryId: process.env.AMO_VOICE_CATEGORY||'1545316338145165332', logsCategoryId: process.env.AMO_LOGS_CATEGORY||'1545364636034138112', pointsFile:'./data/points.json' };
if (!config.modes.esport) config.modes.esport = { name:'esport', displayName:'Esport', command:'!esport', matchChannelId: process.env.ESPORT_CHANNEL_ID||'1545388379309482037', voiceCategoryId: process.env.ESPORT_VOICE_CATEGORY||'1545386731686076476', logsCategoryId: process.env.ESPORT_LOGS_CATEGORY||'1545386732982374433', pointsFile:'./data/points_esport.json' };
if (!config.matchPoints) config.matchPoints = { winner: 80, loser: 30 };
if (!config.emojis) config.emojis = { game:'<:Free_fire_logo:1466528905509736705>', team1:'<a:aHYPR_GREENDOTid:1545351146770796634>', team2:'<a:aredptid:1545350890989428829>' };
if (!config.pointsFile) config.pointsFile = './data/points.json';
if (!config.logsCategoryId) config.logsCategoryId = config.modes.amo.logsCategoryId;
if (!config.logsChannelId) config.logsChannelId = process.env.LOGS_CHANNEL_ID || '1545366915180924938';
if (!config.infoChannelId) config.infoChannelId = process.env.INFO_CHANNEL_ID || '1545379695363620874';
if (!config.rankOneRoleId) config.rankOneRoleId = process.env.RANK_ONE_ROLE_ID || '';
if (!config.setResultRoles) {
  config.setResultRoles = process.env.SET_RESULT_ROLE_IDS ? process.env.SET_RESULT_ROLE_IDS.split(',').map(s => s.trim()).filter(Boolean) : ['1450212500581646460', '1537318639395545139', '1506540916519731310', '1466082863115145441'];
}
if (!config.voiceCategoryId) config.voiceCategoryId = config.modes.amo.voiceCategoryId;
if (!config.requiredVoiceChannels) {
  config.requiredVoiceChannels = [
    process.env.REQUIRED_VOICE_CHANNEL_1 || '1423528602418286595',
    process.env.REQUIRED_VOICE_CHANNEL_2 || '1450206308367073291',
    process.env.REQUIRED_VOICE_CHANNEL_3 || '1495304938631204945',
    process.env.REQUIRED_VOICE_CHANNEL_4 || '1495304629322518635'
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

function getModeByChannel(channelId) {
  if (config.modes.esport && config.modes.esport.matchChannelId === channelId) return 'esport';
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
  return { role, affected };
}

async function unjailMember(guild, member, role, affected) {
  if (member && role) await member.roles.remove(role).catch(() => {});
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
3️⃣ Click **🏠 Room Config**, enter the Room ID / Password (and an optional join key).
4️⃣ Players join Team 1 / Team 2 with the join buttons (key required if the host set one).
5️⃣ When both teams are full, a **result box** appears - the 2 team captains vote the **MVP** for winner and loser.
6️⃣ Points are added automatically: Winner +50, Winner MVP +80, Loser +10, Loser MVP +30.
7️⃣ Check ranks with the **Rank #** nicknames or \`!leaderboard\`.

👑 **RANK #1 PRIZE - AUTO ROLE**
The **#1 ranked player** automatically receives the Rank #1 role!

🛒 **STORE**
\`&store\` - open the store and exchange your **points** for roles or Free Fire diamonds if you buy them, staff will deliver them to you.
Supervisors add items: \`&storeadd <name>|<cost>|<role|diamond>|<roleId (role only)>\`
Remove items: \`&storeremove <itemId>\`

━━━━━━━━━━━━━━━━━━━━━━━━
👥 **ALL MEMBERS**
\`!play 2v2 | 3v3 | 4v4\` - host a match
\`!esport 2v2 | 3v3 | 4v4\` - host an esport match
\`!leaderboard\` - show the top players
\`&store\` - open the reward store

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
\`&storeadd <name>|<cost>|<role|diamond>|<roleId>\` - add a store item
\`&storeremove <id>\` - remove a store item
\`&blacklist <userID> <duration> <reason>\` - blacklist a player from matches
\`&unblacklist <userID>\` - unblacklist a player

⛓️ **JAIL** (ONLY <@&1450212500581646460> <@&1537318639395545139> <@&1506540916519731310> and <@1177600499298599035>)
\`&jail <userID> <duration> <reason>\` - lock a player to the jail channels
\`&unjail <userID>\` - release a jailed player

⏱️ Durations: \`30m\`, \`5h\`, \`7d\`, \`2w\`, \`perm\`
💠 Store: \`role\` items auto-grant the role, \`diamond\` items notify staff to deliver.`;

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
    .setColor(0xFFA500)
    .setTitle(i === 0 ? '🎮 HOW TO USE THE BOT - FREE FIRE MATCHES' : null)
    .setDescription(p));
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


async function buildMatchBox(guild, match, creatorUser) {
  const progress1 = `${match.team1.length}/${match.teamSize}`;
  const progress2 = `${match.team2.length}/${match.teamSize}`;

  const t1 = match.team1.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') || '*Empty*';
  const t2 = match.team2.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') || '*Empty*';
  const display = getModeConfig(match.mode).displayName;

  let box = '';
  box += `### __${config.emojis.game} ${display} ${match.teamSize}v${match.teamSize} Match__\n`;
  box += '\n';
  box += `> Match started by <@${match.creatorId}>\n`;
  box += '\n';
  box += `${config.emojis.team1} Team 1 (${progress1})\n`;
  box += t1 + '\n';
  box += '\n';
  box += `${config.emojis.team2} Team 2 (${progress2})\n`;
  box += t2;

  return box;
}

async function buildMatchEmbed(guild, match, creatorUser) {
  const box = await buildMatchBox(guild, match, creatorUser);
  const embed = new EmbedBuilder()
    .setDescription(box)
    .setColor(0xFF6600);
  return embed;
}

async function updateMatchChannel(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (!channel) return;
  const list1 = match.team1.length > 0 ? match.team1.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') : 'Empty';
  const list2 = match.team2.length > 0 ? match.team2.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') : 'Empty';
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${match.teamSize}v${match.teamSize} Match Room`)
    .setColor(0xFF6600)
    .setDescription(`**🏠 Room ID:** \`${match.roomId}\`\n**🔑 Password:** \`${match.password}\`\n**🔐 Match Key:** \`${match.key || '—'}\``)
    .addFields(
      { name: `🟢 Team 1 (${match.team1.length}/${match.teamSize})`, value: list1, inline: true },
      { name: `🔴 Team 2 (${match.team2.length}/${match.teamSize})`, value: list2, inline: true }
    );
  await channel.messages.fetch({ limit: 20 }).catch(() => {});
  const lastMsg = channel.lastMessage;
  if (lastMsg && lastMsg.author.id === client.user.id && lastMsg.embeds.length) {
    await lastMsg.edit({ embeds: [embed] }).catch(() => {});
  } else {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
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
        content: await buildMatchBox(guild, match, null),
        components: []
      }).catch(() => {});
    }

    const ts = Math.floor(Date.now() / 1000);
    await apostado.send({
      content: `${config.emojis.team1} **Match Ready!**\nMoving players to voice channels...\n<t:${ts}:f>`
    }).catch(() => {});
  }

  const privateEmbed = new EmbedBuilder()
    .setTitle(`🎮 Match Room - ${match.teamSize}v${match.teamSize}`)
    .setColor(0x00FF00)
    .setDescription(`**Room ID:** \`${match.roomId}\`\n**Password:** \`${match.password}\`\n**Match Key:** \`${match.key || '—'}\`\n\n**Voice channels:**\n🟢 Team 1: <#${team1Channel.id}>\n🔴 Team 2: <#${team2Channel.id}>`)
    .setFooter({ text: 'This room is only visible to match players.' });

  await roomChannel.send({ embeds: [privateEmbed] }).catch(e => console.error('Failed to post room info:', e.message));

  const roomChannelId = match.channelId2;
  const roomChat = guild.channels.cache.get(roomChannelId) || roomChannel;
  if (roomChat) {
    try {
      const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
      match.winnerVotes = {};
      match.loserVotes = {};
      match.winnerVoteSet = false;
      match.loserVoteSet = false;
      match.mvpWinnerId = null;
      match.mvpLoserId = null;
      match.winnerTeam = null;
      match.loserTeam = null;
      manager.persistMatches();

      const mentions = allPlayers.map(id => `<@${id}>`).join(' ');
      const roleMentions = (config.staffRoles || []).map(id => `<@&${id}>`).join(' ');

      const resultEmbed = new EmbedBuilder()
        .setTitle(`🏆 Match Live - ${match.teamSize}v${match.teamSize}`)
        .setColor(0xFFD700)
        .setDescription('Captains (**first player of each team**) can vote the result below.\n\n**Awards:** Winner team `50` | Winner MVP `80` | Loser team `10` | Loser MVP `30`');

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`mvpwinner_${match.id}`).setLabel('🏆 MVP Winner').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`mvploser_${match.id}`).setLabel('💪 MVP Loser').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`staffreq_${match.id}`).setLabel('🛡️ Staff Request').setStyle(ButtonStyle.Secondary)
      );

      const boxMsg = await roomChat.send({ content: `${mentions}\n${roleMentions}`, embeds: [resultEmbed], components: [row] });
      match.resultMessageId = boxMsg.id;
      manager.persistMatches();
    } catch (e) {
      console.error('Failed to post match result box:', e.message);
    }
  }

  return { team1Channel, team2Channel, roomChannel };
}

function buildMatchButtons(match, userId) {
  const joinTeam1 = new ButtonBuilder()
    .setCustomId(`join1_${match.id}`)
    .setLabel('🟢 Join Team 1')
    .setStyle(ButtonStyle.Success);

  const joinTeam2 = new ButtonBuilder()
    .setCustomId(`join2_${match.id}`)
    .setLabel('🔴 Join Team 2')
    .setStyle(ButtonStyle.Primary);

  const leave = new ButtonBuilder()
    .setCustomId(`leave_${match.id}`)
    .setLabel('🚪 Leave')
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId(`cancel_${match.id}`)
    .setLabel('❌ Cancel Match')
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(joinTeam1, joinTeam2, leave);

  const components = [row1];

  if (match.creatorId === userId) {
    const cancelRow = new ActionRowBuilder().addComponents(cancel);
    components.push(cancelRow);
  }

  return components;
}

client.once(Events.ClientReady, (c) => {
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
  const guild = c.guilds.cache.first();
  const ranked = computeCombinedRanking();
  if (guild && ranked.length) applyRankOneRole(guild, ranked).catch(() => {});
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
    await unjailMember(guild, member, role, j.affectedChannels);
    console.log(`[JAIL] released ${j.userId} (expired)`);
    jailModule.unjailUser(j.userId);
  }
}, 60000);

client.on(Events.MessageCreate, async (message) => {
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
    if (message.channel.id !== matchChannelId) {
      return message.reply(`❌ Please use \`${modeCfg.command}\` in the ${modeCfg.displayName} channel <#${matchChannelId}>.`);
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

    await cleanupOldMessages(message.channel);

    const match = manager.createMatch(message.author.id, teamSize, message.channel.id, mode);

    const setupEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${modeCfg.displayName} Match Setup (${teamSize}v${teamSize})`)
      .setDescription(`<@${message.author.id}>, click **Set Room Config** to enter your **${teamSize}v${teamSize}** match room details.`)
      .setColor(0xFF6600)
      .setFooter({ text: 'This message will be replaced once configured.' });

    const setupButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_${match.id}`)
        .setLabel('⚙️ Set Room Config')
        .setStyle(ButtonStyle.Primary)
    );

    await message.delete().catch(() => {});
    const msg = await message.channel.send({ embeds: [setupEmbed], components: [setupButton] });
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
      return message.reply('❌ No pending match found.');
    }
    const dummy = message.author.id;
    while (match.team1.length < match.teamSize) match.team1.push(dummy);
    while (match.team2.length < match.teamSize) match.team2.push(dummy);
    manager.persistMatches();
    try {
      await startFullMatch(message.guild, match);
      await message.reply('🔧 **Force-full complete!** Voice channels created and ready message posted.');
    } catch (e) {
      console.error('Force-full error:', e);
      await message.reply(`❌ Force-full failed: ${e.message}`);
    }
    return;
  }
});

async function cleanupOldMessages(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    const toDelete = msgs.filter(m =>
      m.author.id === client.user.id || m.content.trim().toLowerCase().startsWith('!play')
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

async function teamPlayerSelectOptions(guild, teamIds) {
  const options = [];
  for (const uid of teamIds) {
    const member = await guild.members.fetch(uid).catch(() => null);
    const name = member ? (member.displayName || member.user.username) : uid;
    options.push(new StringSelectMenuOptionBuilder().setLabel(name.slice(0, 90)).setValue(uid));
  }
  return options;
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
    .setTitle(`📜 Match Log - ${match.teamSize}v${match.teamSize}`)
    .setColor(0x00FF00)
    .setDescription(
      `Match finished **<t:${Math.floor(ts / 1000)}:F>**\n` +
      `🏆 Winner Team: ${match.winnerTeam ? `Team ${match.winnerTeam}` : '—'} | MVP Winner: <@${match.mvpWinnerId || '—'}>\n` +
      `💪 Loser Team: ${match.loserTeam ? `Team ${match.loserTeam}` : '—'} | MVP Loser: <@${match.mvpLoserId || '—'}>\n` +
      `💬 Full chat log below ⬇️`
    );

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
        .setColor(0x00FF00)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Winner MVP <@${match.mvpWinnerId}> vs Loser MVP <@${match.mvpLoserId}>` });
      await msg.edit({ embeds: [resultEmbed], components: [] }).catch(() => {});
    }
  }

  await dumpMatchChat(guild, match);

  await manager.finishMatch(guild, match);
  applyRankNicknames(guild).catch(() => {});
}

async function timeoutMatch(guild, matchId) {
  const match = manager.getMatch(matchId);
  if (!match || match.status !== 'waiting') return;
  const channel = guild.channels.cache.get(match.channelId);
  if (channel) {
    const msg = await channel.messages.fetch(match.message).catch(() => null);
    if (msg) await msg.delete().catch(() => {});
    await channel.send('⏰ **Match timed out!** No one joined within 30 seconds.').catch(() => {});
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
      content: await buildMatchBox(interaction.guild, match, interaction.user),
      components: buildMatchButtons(match, interaction.user.id)
    });
  }

  await interaction.reply({ content: `✅ Joined Team ${team}!`, ephemeral: true });
  await updateMatchChannel(interaction.guild, match);

  if (manager.isTeamsFull(match.id)) {
    try {
      await startFullMatch(interaction.guild, match);
      await interaction.channel.send({ content: `🎮 **Match ready!** Players moved to voice channels.` }).catch(() => {});
    } catch (e) {
      console.error('Error starting match:', e);
      await interaction.channel.send({ content: `❌ Error starting match: ${e.message}. Make sure the bot can manage channels.` }).catch(() => {});
    }
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isStringSelectMenu() && interaction.customId === 'store_menu') {
    const mode = getModeByChannel(interaction.channel.id);
    const item = storeModule.getItems().find(i => i.id === interaction.values[0]);
    if (!item) {
      return interaction.reply({ content: '❌ That item no longer exists.', ephemeral: true });
    }
    const balance = storage.getPlayerPoints(interaction.user.id, mode).totalPoints;
    if (balance < item.cost) {
      return interaction.reply({ content: `❌ Not enough points! You have **${balance} pts**, this item costs **${item.cost} pts**.`, ephemeral: true });
    }
    if (item.type === 'role') {
      const role = interaction.guild.roles.cache.get(item.roleId);
      if (!role) {
        return interaction.reply({ content: '❌ The role for this item no longer exists. Ask a supervisor.', ephemeral: true });
      }
      storage.adjustPoints(interaction.user.id, -item.cost, mode);
      const granted = await interaction.member.roles.add(role).then(() => true).catch(() => false);
      if (!granted) {
        storage.adjustPoints(interaction.user.id, item.cost, mode);
        return interaction.reply({ content: '❌ Could not grant the role. Points refunded.', ephemeral: true });
      }
      storeModule.logPurchase({ id: `${Date.now()}_${interaction.user.id}`, userId: interaction.user.id, itemId: item.id, itemName: item.name, cost: item.cost, type: item.type, roleId: item.roleId, mode, claimed: true, at: Date.now() });
      applyRankOneRole(interaction.guild, computeCombinedRanking()).catch(() => {});
      return interaction.reply({ content: `✅ Purchased **${item.name}**! Spent **${item.cost} pts**. Role <@&${item.roleId}> granted.`, ephemeral: true });
    }
    storage.adjustPoints(interaction.user.id, -item.cost, mode);
    storeModule.logPurchase({ id: `${Date.now()}_${interaction.user.id}`, userId: interaction.user.id, itemId: item.id, itemName: item.name, cost: item.cost, type: item.type, mode, claimed: false, at: Date.now() });
    const staffChannel = interaction.guild.channels.cache.get(config.logsChannelId);
    if (staffChannel) {
      const staffMention = config.staffRoles.length ? config.staffRoles.map(id => `<@&${id}>`).join(' ') : '';
      await staffChannel.send({
        content: `🛒 **Diamond purchase requested!**\nBuyer: <@${interaction.user.id}>\nItem: **${item.name}** (${item.cost} pts, ${mode} mode)\nPlease deliver the reward.${staffMention ? `\n${staffMention}` : ''}`
      }).catch(() => {});
    }
    return interaction.reply({ content: `✅ Purchase received for **${item.name}**: **${item.cost} pts** deducted (${mode}). Staff has been notified to deliver your diamonds 💎.`, ephemeral: true });
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

    if (![2, 3, 4].includes(match.teamSize)) {
      console.log('[MODAL] invalid team size on match', match.teamSize);
      return interaction.editReply({ content: '❌ Invalid team size. Start the match with `!play 2v2/3v3/4v4`!' });
    }

    match.roomId = roomId;
    match.password = password;
    match.key = matchKey;
    match.team1.push(interaction.user.id);
    console.log(`[MODAL] teamSize=${match.teamSize} roomId=${roomId} pass=${password} key=${matchKey} creator auto-joined T1`);

    try {
      const matchBox = await buildMatchBox(interaction.guild, match, interaction.user);
      const components = buildMatchButtons(match, interaction.user.id);

      const channel = interaction.guild.channels.cache.get(match.channelId);
      console.log('[MODAL] apostado channel found:', !!channel);
      const oldMsg = await channel.messages.fetch(match.message).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});

      const newMsg = await channel.send({ content: matchBox, components });
      match.message = newMsg.id;
      manager.persistMatches();
      console.log('[MODAL] match box sent successfully, new msg id:', newMsg.id);

      await interaction.editReply({ content: `✅ Match created! You are on 🔴 Team 1.` }).catch(() => {});
      if (match.joinTimeout) clearTimeout(match.joinTimeout);
      match.joinTimeout = setTimeout(() => {
        timeoutMatch(interaction.guild, match.id);
      }, 30000);
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
    const cid = interaction.customId;
    let isWinner = null;
    let matchId = null;
    let team = null;

    if (cid.startsWith('mvwteam_')) { isWinner = true; matchId = cid.slice('mvwteam_'.length); }
    else if (cid.startsWith('mvlteam_')) { isWinner = false; matchId = cid.slice('mvlteam_'.length); }
    else if (cid.startsWith('mvwplayer_')) {
      isWinner = true;
      const rest = cid.slice('mvwplayer_'.length);
      const idx = rest.lastIndexOf('_');
      matchId = rest.slice(0, idx);
      team = rest.slice(idx + 1);
    } else if (cid.startsWith('mvlplayer_')) {
      isWinner = false;
      const rest = cid.slice('mvlplayer_'.length);
      const idx = rest.lastIndexOf('_');
      matchId = rest.slice(0, idx);
      team = rest.slice(idx + 1);
    }
    if (matchId === null) return;

    const match = manager.getMatch(matchId);
    if (!match) {
      console.log(`[SEL] match not found for customId=${cid}`);
      return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });
    }

    const selected = interaction.values[0];

    if (team === null) {
      const list = selected === '1' ? match.team1 : match.team2;
      const opts = await teamPlayerSelectOptions(interaction.guild, list);
      if (opts.length === 0) return interaction.update({ content: '⚠️ No players found on that team.', components: [] });
      const playerSelect = new StringSelectMenuBuilder()
        .setCustomId(`${isWinner ? 'mvwplayer' : 'mvlplayer'}_${match.id}_${selected}`)
        .setPlaceholder(`Select the ${isWinner ? 'WINNER' : 'LOSER'} MVP`)
        .addOptions(opts);
      return interaction.update({
        content: `${isWinner ? '🏆' : '💪'} Which player is the ${isWinner ? 'winner' : 'loser'} MVP on Team ${selected}?`,
        components: [new ActionRowBuilder().addComponents(playerSelect)]
      });
    }

    const voterId = interaction.user.id;
    const captains = [match.team1[0], match.team2[0]].filter(Boolean);
    if (!captains.includes(voterId)) {
      return interaction.update({ content: '❌ Only the first player of each team can vote!', components: [] });
    }
    const otherId = voterId === match.team1[0] ? match.team2[0] : match.team1[0];

    const votesKey = isWinner ? 'winnerVotes' : 'loserVotes';
    match[votesKey][voterId] = { team: parseInt(team), player: selected };
    manager.persistMatches();

    const myVote = match[votesKey][voterId];
    const otherVote = otherId ? match[votesKey][otherId] : null;

    if (otherVote && otherVote.team === myVote.team && otherVote.player === myVote.player) {
      if (isWinner) {
        match.winnerTeam = myVote.team;
        match.mvpWinnerId = myVote.player;
        match.winnerVoteSet = true;
      } else {
        match.loserTeam = myVote.team;
        match.mvpLoserId = myVote.player;
        match.loserVoteSet = true;
      }
      manager.persistMatches();
      await interaction.update({ content: `✅ Both captains agree! ${isWinner ? '🏆 Winner' : '💪 Loser'} MVP: <@${myVote.player}>`, components: [] });
      if (match.winnerVoteSet && match.loserVoteSet) {
        await settleMatchResult(interaction.guild, match);
      }
    } else if (otherVote) {
      match[votesKey] = {};
      manager.persistMatches();
      await interaction.update({ content: `❌ Votes aren't the same, please try again!`, components: [] });
      interaction.channel.send({ content: `❌ **${isWinner ? 'Winner' : 'Loser'} votes aren't the same, please try again!** (captains <@${match.team1[0]}> & <@${match.team2[0]}>)` }).catch(() => {});
    } else {
      const otherName = otherId ? await getPlayerName(interaction.guild, otherId) : 'the other captain';
      await interaction.update({ content: `✅ Vote saved! Waiting for **${otherName}** to vote.`, components: [] });
    }
  }

  if (interaction.isButton()) {
    const separator = interaction.customId.indexOf('_');
    if (separator === -1) return interaction.reply({ content: '⚠️ Invalid interaction.', ephemeral: true });
    const action = interaction.customId.slice(0, separator);
    const matchId = interaction.customId.slice(separator + 1);
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

    if (action === 'mvpwinner' || action === 'mvploser') {
      const isWinner = action === 'mvpwinner';
      const captains = [match.team1[0], match.team2[0]].filter(Boolean);
      if (!captains.includes(interaction.user.id)) {
        return interaction.reply({ content: '❌ Only the **first player of each team** can vote!', ephemeral: true });
      }
      if (isWinner ? match.winnerVoteSet : match.loserVoteSet) {
        return interaction.reply({ content: `✅ ${isWinner ? 'Winner' : 'Loser'} MVP was already finalized.`, ephemeral: true });
      }
      const votesKey = isWinner ? 'winnerVotes' : 'loserVotes';
      if ((match[votesKey] || {})[interaction.user.id]) {
        return interaction.reply({ content: '✅ You already voted! Waiting for the other captain to vote.', ephemeral: true });
      }
      const teamSelect = new StringSelectMenuBuilder()
        .setCustomId(`${isWinner ? 'mvwteam' : 'mvlteam'}_${match.id}`)
        .setPlaceholder(`Select the ${isWinner ? 'WINNING' : 'LOSING'} team`)
        .addOptions(
          new StringSelectMenuOptionBuilder().setLabel('🔴 Team 1').setDescription(`Players: ${match.team1.length}`).setValue('1'),
          new StringSelectMenuOptionBuilder().setLabel('🔴 Team 2').setDescription(`Players: ${match.team2.length}`).setValue('2')
        );
      return interaction.reply({
        content: `${isWinner ? '🏆' : '💪'} Select the ${isWinner ? 'winning' : 'losing'} team:`,
        components: [new ActionRowBuilder().addComponents(teamSelect)],
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
      const result = manager.leaveMatch(matchId, interaction.user.id);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        await msg.edit({
          content: await buildMatchBox(interaction.guild, match, interaction.user),
          components: buildMatchButtons(match, interaction.user.id)
        });
      }

      await interaction.reply({ content: '🚪 You left the match!', ephemeral: true });
      await updateMatchChannel(interaction.guild, match);
    }

    if (action === 'cancel') {
      if (match.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only the match host can cancel the match!', ephemeral: true });
      }

      await manager.deleteVoiceChannels(interaction.guild, match);
      await manager.deleteChannel(interaction.guild, match);
      if (match.joinTimeout) {
        clearTimeout(match.joinTimeout);
        match.joinTimeout = null;
      }
      manager.removeMatch(matchId);

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        const cancelledEmbed = new EmbedBuilder()
          .setTitle('❌ Match Cancelled')
          .setColor(0xFF0000)
          .setDescription(`Match by <@${match.creatorId}> has been cancelled.`);
        await msg.edit({ embeds: [cancelledEmbed], components: [] });
      }

      await interaction.reply({ content: '❌ Match cancelled!', ephemeral: true });
    }
  }
});

const adminCommands = {
  leaderboard: async (message, mode = 'amo') => {
    const sorted = storage.getLeaderboard(mode);
    if (sorted.length === 0) {
      return message.reply('📊 No matches played yet!');
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${getModeConfig(mode).displayName} Leaderboard`)
      .setColor(0xFFD700)
      .setDescription(sorted.map(([id, data], i) => {
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        return `${medal} <@${id}> - **${data.totalPoints} pts** (${data.wins}W/${data.losses}L)`;
      }).join('\n'));

    await message.reply({ embeds: [embed] });
  },
  resetpoints: async (message) => {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Only admins can reset points!');
    }
    for (const mode of ['amo', 'esport']) storage.resetAllPoints(mode);
    await message.reply('🔄 **All points have been reset for all modes!** Rank nicknames cleared.');
    stripRankNicknames(message.guild).catch(() => {});
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
  }
};

client.on(Events.MessageCreate, async (message) => {
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
    const items = storeModule.getItems();
    const mode = getModeByChannel(message.channel.id);
    if (items.length === 0) {
      return message.reply('🛒 The store is empty. Supervisors can add items with `&storeadd`.');
    }
    const balance = storage.getPlayerPoints(message.author.id, mode).totalPoints;
    const embed = new EmbedBuilder()
      .setTitle('🛒 FF STORE')
      .setDescription(`Exchange your **${mode.toUpperCase()} points** for rewards!\n${config.emojis.game || ''} Your balance: **${balance} pts**\n\nSelect an item below to buy it. Role items are granted instantly, diamond items are delivered by staff.`)
      .setColor(0xFFA500);
    const fields = items.map(it => ({
      name: `${it.type === 'role' ? '👑' : '💎'} ${it.name}`,
      value: `Cost: **${it.cost} pts**\nID: \`${it.id}\`${it.type === 'role' && it.roleId ? ` -> <@&${it.roleId}>` : ''}`,
      inline: false
    }));
    embed.addFields(fields);
    const opts = items.slice(0, 25).map(it =>
      new StringSelectMenuOptionBuilder()
        .setLabel(it.name)
        .setDescription(`${it.type === 'role' ? 'Role' : 'Diamonds'} - ${it.cost} pts`)
        .setValue(it.id)
    );
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId('store_menu')
        .setPlaceholder('🛒 Choose an item to buy')
        .addOptions(opts)
    );
    return message.reply({ embeds: [embed], components: [row] });
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
    return message.reply(`❌ Removed **${points} pts** from <@${userId}> (${mode}). New total: **${total} pts**.`);
  }

  if (content.startsWith('&storeadd')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can add store items!');
    }
    const args = message.content.slice('&storeadd'.length).trim().split('|').map(s => s.trim());
    const name = args[0];
    const cost = parseInt(args[1]);
    const type = (args[2] || '').toLowerCase();
    const roleInput = args[3];
    if (!name || isNaN(cost) || cost <= 0 || !['role', 'diamond'].includes(type)) {
      return message.reply('Usage: `&storeadd <name>|<cost>|<role|diamond>|<roleId (role only)>`\nExamples:\n`&storeadd VIP Role|200|role|<roleId>`\n`&storeadd 500 Diamonds|300|diamond`');
    }
    let roleId = null;
    if (type === 'role') {
      const role = message.guild.roles.cache.get(roleInput || '') || (message.mentions.roles.size ? message.mentions.roles.first() : null);
      if (!role) return message.reply('❌ Role items need a valid role ID or mention.');
      roleId = role.id;
    }
    const item = storeModule.addItem({ name, cost, type, roleId });
    return message.reply(`✅ Store item added: **${item.name}** (${item.cost} pts, ${item.type}${item.roleId ? ` - <@&${item.roleId}>` : ''}). ID: \`${item.id}\``);
  }

  if (content.startsWith('&storeremove')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can remove store items!');
    }
    const id = content.replace('&storeremove', '').trim();
    if (!id) return message.reply('Usage: `&storeremove <itemId>`');
    const ok = storeModule.removeItem(id);
    return message.reply(ok ? `🚮 Store item \`${id}\` removed.` : '❌ Item not found.');
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

  if (content === '!leaderboard') {
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
    await manager.deleteVoiceChannels(message.guild, existing);
    await manager.deleteChannel(message.guild, existing);
    manager.removeMatch(existing.id);
    await message.reply(`❌ Cancelled <@${target.id}>'s match!`);
  } else if (content.startsWith('&blacklist')) {
    if (!hasCommandAccess(message.member)) {
      return message.reply('❌ Only supervisors/admins can blacklist users!');
    }
    const args = message.content.trim().split(/\s+/);
    if (args.length < 4) {
      return message.reply('Usage: `&blacklist <userId> <duration> <reason>`\nDurations: `30m`, `5h`, `7d`, `2w`, `perm`');
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
    const removed = blacklistModule.unblacklistUser(args[1]);
    await message.reply(removed ? `✅ <@${args[1]}> removed from the blacklist.` : 'ℹ️ That user is not blacklisted.');
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
    const entry = jailModule.jailUser(userId, res.role.id, message.guild.id, durationMs === -1 ? null : durationMs, reason, message.author.id, res.affected);
    const expiry = entry.expiresAt === -1 ? '**Permanent**' : `<t:${Math.floor(entry.expiresAt / 1000)}:R>`;
    await message.reply(`⛓️ <@${userId}> has been jailed!\n📋 Reason: ${reason}\n⏳ Release: ${expiry}`);
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
    await unjailMember(message.guild, member, role, entry.affectedChannels);
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

    if (refunded.length === 0) {
      await message.reply('✅ Votes were already clear. Re-vote with `!w @player` / `!l @player`.');
    } else {
      await message.reply(`♻️ **Votes reset & points refunded!**\n${refunded.join('\n')}\n\nRe-vote with \`!w @player\` / \`!l @player\`.`);
    }
  } else if (content.startsWith('!w') || content.startsWith('!l')) {
    const isWin = content.startsWith('!w');
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(`Usage: \`${isWin ? '!w' : '!l'} @player\``);
    }

    if (canSetResult(message.member)) {
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
        adminMatch.winnerTeam = team;
        adminMatch.mvpWinnerId = target.id;
        adminMatch.winnerId = target.id;
        adminMatch.winnerVoteSet = true;
      } else {
        if (adminMatch.loserTeam) {
          return message.reply('✅ Loser is already set. Use `!w @player` to set the winner.');
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

    const doneMatch = manager.getAllMatches().find(m =>
      m.creatorId === message.author.id &&
      (m.status === 'full' || m.status === 'waiting')
    );
    if (!doneMatch) {
      const available = manager.getAllMatches().map(mm => ({
        id: mm.id, mode: mm.mode, status: mm.status, creator: mm.creatorId
      }));
      console.log('[VOTE] no matching doneMatch. available=', JSON.stringify(available));
      return;
    }
    const voteMode = doneMatch.mode || mode;
    console.log('[VOTE] found doneMatch', doneMatch.id, 'status', doneMatch.status, 'mode', doneMatch.mode);

    const points = isWin ? WINNER_POINTS : LOSER_POINTS;
    const result = storage.addPoints(target.id, points, isWin ? 'win' : 'loss', voteMode);

    const embed = new EmbedBuilder()
      .setTitle(isWin ? '🏆 MVP Winner!' : '💪 MVP Loser!')
      .setColor(isWin ? 0xFFD700 : 0xFF6600)
      .setDescription(`<@${target.id}> earned **${points} points**!`)
      .setFooter({ text: `Total: ${result.totalPoints} pts | ${result.wins}W/${result.losses}L` });

    await message.channel.send({ embeds: [embed] });

    if (isWin) doneMatch.winnerId = target.id;
    else doneMatch.loserId = target.id;
    manager.persistMatches();

    if (doneMatch.winnerId && doneMatch.loserId) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`📜 Match Log - ${doneMatch.teamSize}v${doneMatch.teamSize}`)
        .setColor(0x00FF00)
        .setDescription(`**Match finished** — MVP votes submitted.`)
        .addFields(
          { name: '🏆 Winner', value: `<@${doneMatch.winnerId}>`, inline: true },
          { name: '💪 Loser', value: `<@${doneMatch.loserId}>`, inline: true }
        )
        .setFooter({ text: 'Players returned to their channels. Match cleaned up.' });
      await message.channel.send({ embeds: [logEmbed] }).catch(() => {});

      manager.logMatch({
        id: doneMatch.id,
        timestamp: Date.now(),
        teamSize: doneMatch.teamSize,
        roomId: doneMatch.roomId,
        password: doneMatch.password,
        team1: doneMatch.team1,
        team2: doneMatch.team2,
        winnerId: doneMatch.winnerId,
        loserId: doneMatch.loserId
      });

      await dumpMatchChat(message.guild, doneMatch);

      await manager.finishMatch(message.guild, doneMatch);
      applyRankNicknames(message.guild).catch(() => {});
    } else {
      const pending = isWin ? '💪 **!l** loser' : '🏆 **!w** winner';
      await message.channel.send({ content: `⏳ Waiting for the ${pending} vote before finishing the match.`, }).catch(() => {});
    }
  }
});

client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
  const member = oldState.member || newState.member;
  if (!member || member.user.bot) return;
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
});

client.login(config.token);

