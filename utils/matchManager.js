const { ChannelType, PermissionsBitField } = require('discord.js');
const fs = require('fs');
const path = require('path');
let config;
try { config = require('../config.json'); } catch { config = {}; }
if (!config.modes) config.modes = {};
if (!config.modes.amo) config.modes.amo = {};
if (!config.modes.esport) config.modes.esport = {};
if (process.env.ROOM_CATEGORY_ID) config.roomCategoryId = process.env.ROOM_CATEGORY_ID;
if (!config.roomCategoryId) config.roomCategoryId = '1545316338145165332';

const activeMatches = new Map();
const MATCHES_FILE = path.resolve(__dirname, '..', 'data', 'matches.json');
const LOGS_FILE = path.resolve(__dirname, '..', 'data', 'matches_log.json');
const suppressedUsers = new Set();

function ensureLogsFile() {
  const dir = path.dirname(LOGS_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(LOGS_FILE)) fs.writeFileSync(LOGS_FILE, JSON.stringify([]));
}

function logMatch(entry) {
  ensureLogsFile();
  let logs = [];
  try {
    logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    if (!Array.isArray(logs)) logs = [];
  } catch (e) {
    logs = [];
  }
  logs.push(entry);
  fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
}

function getMatchLogs() {
  ensureLogsFile();
  try {
    const logs = JSON.parse(fs.readFileSync(LOGS_FILE, 'utf8'));
    return Array.isArray(logs) ? logs : [];
  } catch (e) {
    return [];
  }
}

function suppressUsers(userIds) {
  for (const id of userIds) {
    if (id) suppressedUsers.add(id);
  }
}

function isSuppressed(userId) {
  if (suppressedUsers.has(userId)) {
    suppressedUsers.delete(userId);
    return true;
  }
  return false;
}

function ensureMatchesFile() {
  const dir = path.dirname(MATCHES_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(MATCHES_FILE)) fs.writeFileSync(MATCHES_FILE, JSON.stringify([]));
}

function loadMatches() {
  ensureMatchesFile();
  try {
    const data = JSON.parse(fs.readFileSync(MATCHES_FILE, 'utf8'));
    if (Array.isArray(data)) {
      data.forEach(m => activeMatches.set(m.id, m));
    }
  } catch (e) {
    console.log('Could not load matches:', e.message);
  }
}

function persistMatches() {
  ensureMatchesFile();
  const arr = Array.from(activeMatches.values()).filter(m => m.status === 'waiting' || m.status === 'full');
  fs.writeFileSync(MATCHES_FILE, JSON.stringify(arr, null, 2));
}

loadMatches();

function createMatch(creatorId, teamSize, channelId, mode = 'amo') {
  cleanupExpired();
  const matchId = `${Date.now()}_${creatorId}`;
  const match = {
    id: matchId,
    creatorId,
    mode,
    teamSize,
    channelId,
    channelId2: null,
    matchChannelId: null,
    createdAt: Date.now(),
    team1: [],
    team2: [],
    roomId: null,
    password: null,
    status: 'waiting',
    voiceChannels: [],
    originalChannels: {},
    winnerId: null,
    loserId: null,
    message: null,
    joinTimeout: null
  };
  activeMatches.set(matchId, match);
  persistMatches();
  return match;
}

function cleanupExpired() {
  const MAX_AGE = 10 * 60 * 1000;
  const now = Date.now();
  let changed = false;
  for (const [id, match] of activeMatches) {
    if (match.status === 'waiting' && now - match.createdAt > MAX_AGE) {
      activeMatches.delete(id);
      changed = true;
    }
  }
  if (changed) persistMatches();
}

function getMatch(matchId) {
  cleanupExpired();
  return activeMatches.get(matchId);
}

function getMatchByChannel(channelId) {
  cleanupExpired();
  for (const [id, match] of activeMatches) {
    if (match.channelId === channelId && match.status === 'waiting') {
      return match;
    }
  }
  return null;
}

function getMatchByCreator(creatorId, mode) {
  cleanupExpired();
  for (const [id, match] of activeMatches) {
    if (match.creatorId === creatorId && match.status === 'waiting' &&
        (mode ? match.mode === mode : true)) {
      return match;
    }
  }
  return null;
}

function joinTeam(matchId, userId, team) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'Match not found' };
  if (match.status !== 'waiting') return { success: false, error: 'Match already started' };

  for (const [id, m] of activeMatches) {
    if (id === matchId) continue;
    if (m.status !== 'waiting' && m.status !== 'full') continue;
    if (m.team1.includes(userId) || m.team2.includes(userId)) {
      return { success: false, error: 'You are already in another match!' };
    }
  }

  const otherTeam = team === 1 ? match.team2 : match.team1;
  if (otherTeam.includes(userId)) {
    return { success: false, error: 'You are already in the other team!' };
  }

  const currentTeam = team === 1 ? match.team1 : match.team2;
  if (currentTeam.includes(userId)) {
    return { success: false, error: 'You are already in this team!' };
  }

  if (currentTeam.length >= match.teamSize) {
    return { success: false, error: `Team ${team} is full!` };
  }

  currentTeam.push(userId);
  persistMatches();
  return { success: true, team1: match.team1, team2: match.team2 };
}

function leaveMatch(matchId, userId) {
  const match = activeMatches.get(matchId);
  if (!match) return { success: false, error: 'Match not found' };

  const idx1 = match.team1.indexOf(userId);
  const idx2 = match.team2.indexOf(userId);

  if (idx1 !== -1) {
    match.team1.splice(idx1, 1);
    persistMatches();
    return { success: true, team1: match.team1, team2: match.team2 };
  }
  if (idx2 !== -1) {
    match.team2.splice(idx2, 1);
    persistMatches();
    return { success: true, team1: match.team1, team2: match.team2 };
  }

  return { success: false, error: 'You are not in this match!' };
}

function isTeamsFull(matchId) {
  const match = activeMatches.get(matchId);
  if (!match) return false;
  return match.team1.length === match.teamSize && match.team2.length === match.teamSize;
}

async function createVoiceChannels(guild, match) {
  const category = guild.channels.cache.get(config.roomCategoryId);
  const botMember = guild.members.me;

  const team1Overwrites = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.Connect],
      allow: [PermissionsBitField.Flags.ViewChannel],
    }
  ];
  for (const userId of match.team1) {
    team1Overwrites.push({
      id: userId,
      allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
    });
  }
  if (botMember) {
    team1Overwrites.push({
      id: botMember.id,
      allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.MoveMembers],
    });
  }

  const team2Overwrites = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.Connect],
      allow: [PermissionsBitField.Flags.ViewChannel],
    }
  ];
  for (const userId of match.team2) {
    team2Overwrites.push({
      id: userId,
      allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel],
    });
  }
  if (botMember) {
    team2Overwrites.push({
      id: botMember.id,
      allow: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.MoveMembers],
    });
  }

  const team1Channel = await guild.channels.create({
    name: `🟢 Team 1 - ${match.teamSize}v${match.teamSize}`,
    type: ChannelType.GuildVoice,
    parent: category ? category.id : null,
    permissionOverwrites: team1Overwrites,
  });

  const team2Channel = await guild.channels.create({
    name: `🔴 Team 2 - ${match.teamSize}v${match.teamSize}`,
    type: ChannelType.GuildVoice,
    parent: category ? category.id : null,
    permissionOverwrites: team2Overwrites,
  });

  match.voiceChannels = [team1Channel.id, team2Channel.id];
  return { team1Channel, team2Channel };
}

async function createChannel(guild, match) {
  const category = guild.channels.cache.get(config.roomCategoryId);
  const botMember = guild.members.me;
  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    }
  ];
  const allPlayers = [...new Set([...match.team1, ...match.team2])];
  for (const userId of allPlayers) {
    overwrites.push({
      id: userId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory],
    });
  }
  if (botMember) {
    overwrites.push({
      id: botMember.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
    });
  }
  const channel = await guild.channels.create({
    name: `🎮 room-${match.id.slice(-4)}`,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    permissionOverwrites: overwrites,
  });
  match.channelId2 = channel.id;
  return channel;
}

async function updateChannelInfo(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (!channel) return null;
  const roomInfo = `**🎮 Match: ${match.teamSize}v${match.teamSize}\n🏠 Room ID:** \`${match.roomId}\`\n**🔑 Password:** \`${match.password}\``;
  await channel.messages.fetch({ limit: 50 }).catch(() => {});
  return roomInfo;
}

async function deleteChannel(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (channel) {
    await channel.delete().catch(() => {});
  }
}

async function archiveChannel(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (!channel) return;
  const mode = config.modes[match.mode] || config.modes.amo;
  const category = guild.channels.cache.get(mode.logsCategoryId);
  const botMember = guild.members.me;

  const overwrites = [
    {
      id: guild.id,
      deny: [PermissionsBitField.Flags.ViewChannel],
    }
  ];
  if (config.supervisorRoleId) {
    overwrites.push({
      id: config.supervisorRoleId,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.SendMessages],
    });
  }
  if (botMember) {
    overwrites.push({
      id: botMember.id,
      allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory, PermissionsBitField.Flags.ManageChannels],
    });
  }

  await channel.setParent(category ? category.id : null, { lockPermissions: false }).catch(() => {});
  await channel.setName(`match-${match.id.slice(-5)}`).catch(() => {});
  await channel.permissionOverwrites.set(overwrites).catch(() => {});
}

async function movePlayersToVoice(guild, match, team1Channel, team2Channel) {
  match.originalChannels = {};
  for (const userId of match.team1) {
    try {
      const member = await guild.members.fetch(userId);
      if (member.voice.channel && match.originalChannels[userId] === undefined) {
        match.originalChannels[userId] = member.voice.channel.id;
      }
      await member.voice.setChannel(team1Channel);
    } catch (e) {
      console.log(`Could not move user ${userId}: ${e.message}`);
    }
  }
  for (const userId of match.team2) {
    try {
      const member = await guild.members.fetch(userId);
      if (member.voice.channel && match.originalChannels[userId] === undefined) {
        match.originalChannels[userId] = member.voice.channel.id;
      }
      await member.voice.setChannel(team2Channel);
    } catch (e) {
      console.log(`Could not move user ${userId}: ${e.message}`);
    }
  }
}

async function returnPlayersToOriginal(guild, match) {
  console.log(`[RETURN] match ${match.id} originalChannels=`, JSON.stringify(match.originalChannels));
  if (!match.originalChannels || Object.keys(match.originalChannels).length === 0) {
    console.log('[RETURN] no originalChannels recorded, skipping teleport-back');
    return;
  }
  for (const userId of Object.keys(match.originalChannels)) {
    const channelId = match.originalChannels[userId];
    try {
      const member = await guild.members.fetch(userId);
      const target = guild.channels.cache.get(channelId);
      if (target && member.voice.channel) {
        await member.voice.setChannel(target);
      }
    } catch (e) {
      console.log(`Could not return user ${userId}: ${e.message}`);
    }
  }
}

async function finishMatch(guild, match) {
  match.closing = true;
  await returnPlayersToOriginal(guild, match);
  await deleteVoiceChannels(guild, match);
  await deleteChannel(guild, match);
  removeMatch(match.id);
}

async function deleteVoiceChannels(guild, match) {
  const allPlayers = [...new Set([...(match.team1 || []), ...(match.team2 || [])])];
  match.closing = true;
  suppressUsers(allPlayers);
  for (const channelId of match.voiceChannels) {
    try {
      const channel = guild.channels.cache.get(channelId);
      if (channel) await channel.delete();
    } catch (e) {
      console.log(`Could not delete voice channel ${channelId}: ${e.message}`);
    }
  }
  match.voiceChannels = [];
}

function removeMatch(matchId) {
  activeMatches.delete(matchId);
  persistMatches();
}

function getAllMatches() {
  cleanupExpired();
  return Array.from(activeMatches.values()).filter(m => m.status === 'waiting' || m.status === 'full');
}

function getActiveMatchForPlayer(userId) {
  cleanupExpired();
  return Array.from(activeMatches.values()).find(m =>
    (m.status === 'full') &&
    (m.team1.includes(userId) || m.team2.includes(userId))
  ) || null;
}

function getPendingOrFullMatch(mode) {
  cleanupExpired();
  const candidates = Array.from(activeMatches.values())
    .filter(m =>
      m.status === 'waiting' && m.roomId !== null && !isTeamsFull(m.id) &&
      (mode ? m.mode === mode : true)
    )
    .sort((a, b) => b.createdAt - a.createdAt);
  return candidates[0] || null;
}

function clearAllMatches() {
  const count = getAllMatches().length;
  activeMatches.clear();
  persistMatches();
  return count;
}

function endMatch(matchId) {
  const match = activeMatches.get(matchId);
  if (match) {
    match.status = 'ended';
  }
}

module.exports = {
  createMatch,
  persistMatches,
  getMatch,
  getMatchByChannel,
  getMatchByCreator,
  joinTeam,
  leaveMatch,
  isTeamsFull,
  createVoiceChannels,
  createChannel,
  updateChannelInfo,
  deleteChannel,
  archiveChannel,
  movePlayersToVoice,
  returnPlayersToOriginal,
  finishMatch,
  deleteVoiceChannels,
  removeMatch,
  getAllMatches,
  getPendingOrFullMatch,
  getActiveMatchForPlayer,
  isSuppressed,
  logMatch,
  getMatchLogs,
  clearAllMatches,
  endMatch
};
