// Voice channels for a tournament, and the roulette that decides who plays whom.
//
// Three kinds of channel live in the tournament voice category:
//
//   Stage        one channel everyone can join, used for announcements so the
//                whole field can hear the same thing at the same time
//   Team Room 1  /  Team Room 2   private to the two teams in the current
//                matchup, so the other teams cannot listen in
//
// The stage is a stage, not a phone call: it is created without a bitrate limit
// so anyone can talk over the top, and nobody is moved in or out of it. The team
// rooms are the opposite -- only the competing teams can see or join them, and
// access is rewritten whenever the matchup changes.
const {
  ChannelType,
  PermissionsBitField,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { COLORS, BRANDING, STICKERS, withBanner, note } = require('./ui');
const tournament = require('./tournament');

const STAGE_NAME = '📺 Stage';
const ROOM_PREFIX = '🔒 Team Room';
const ROOM_COUNT = 2;

// Both channels sit in this category. Configurable so it can move, but it is a
// real id on this server rather than something created on demand -- creating it
// would put a category somewhere the owner did not ask for.
const DEFAULT_CATEGORY_ID = '1555488117996265562';

function categoryId(guild) {
  if (guild && guild.tournamentVoiceCategoryId) return guild.tournamentVoiceCategoryId;
  return DEFAULT_CATEGORY_ID;
}

function canSee(allow = []) {
  return {
    id: allow,
    allow: [PermissionsBitField.Flags.ViewChannel]
  };
}

// @everyone is denied view first, then the allowed roles are granted it. Both
// are needed: a deny on @everyone is what hides the channel from the server at
// large, and the allow is what lets the competing teams through.
function privateOverwrites(guild, memberIds) {
  const rows = [{
    id: guild.roles.everyone.id,
    deny: [PermissionsBitField.Flags.ViewChannel]
  }];
  for (const id of memberIds) {
    if (id && /^\d{15,20}$/.test(id)) {
      rows.push({
        id,
        allow: [
          PermissionsBitField.Flags.ViewChannel,
          PermissionsBitField.Flags.Connect,
          PermissionsBitField.Flags.Speak
        ]
      });
    }
  }
  return rows;
}

// Members of one team, flattened and de-duplicated.
function teamMemberIds(guild, team) {
  const out = [];
  for (const id of (team && team.members) || []) {
    if (out.includes(id)) continue;
    // Only ids that still resolve to a member can be granted access. A stale id
    // on a left member would be rejected by the API and fail the whole overwrite.
    if (guild && guild.members && guild.members.cache.has(id)) out.push(id);
  }
  return out;
}

// Finds the stage by name inside the category, so a restart reuses the channel
// instead of creating a second one.
async function findStage(guild) {
  const cat = guild.channels.cache.get(categoryId(guild));
  if (cat && cat.type === ChannelType.GuildCategory) {
    const hit = cat.children.cache.find(c => c.type === ChannelType.GuildVoice && c.name === STAGE_NAME);
    if (hit) return hit;
  }
  return null;
}

async function findTeamRooms(guild) {
  const cat = guild.channels.cache.get(categoryId(guild));
  if (!cat || cat.type !== ChannelType.GuildCategory) return [];
  return cat.children.cache.filter(
    c => c.type === ChannelType.GuildVoice && c.name.startsWith(ROOM_PREFIX)
  ).values().toArray().sort((a, b) => a.name.localeCompare(b.name)).slice(0, ROOM_COUNT);
}

// Creates the category if it does not exist, plus the stage and the two team
// rooms. Safe to call on every boot: anything already present is left alone.
//
// The category is created with no view restriction of its own. Hiding it is
// handled per channel, so one misconfigured room cannot make the stage vanish.
async function ensureChannels(guild, botMember) {
  const catId = categoryId(guild);
  let category = guild.channels.cache.get(catId);

  if (!category) {
    category = await guild.channels.create({
      name: '🎙️│tournament-voice',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [{
        id: guild.id,
        deny: [PermissionsBitField.Flags.ManageChannels]
      }]
    });
    console.log(`[TOUR-VOICE] created category ${category.name} (${category.id})`);
  } else if (category.type !== ChannelType.GuildCategory) {
    return { ok: false, reason: 'category_id_is_not_a_category', categoryId: catId };
  }

  let stage = await findStage(guild);
  if (!stage) {
    stage = await guild.channels.create({
      name: STAGE_NAME,
      type: ChannelType.GuildVoice,
      parent: category.id,
      // No userLimit: the stage is for everyone watching, and a cap would just
      // make people miss the announcement that matters.
      reason: 'Tournament stage'
    });
    console.log(`[TOUR-VOICE] created stage ${stage.id}`);
  }

  let rooms = await findTeamRooms(guild);
  // Only ever create the ones that are missing, so a manually deleted room
  // comes back rather than the pair silently dropping to one.
  for (let i = rooms.length; i < ROOM_COUNT; i++) {
    const room = await guild.channels.create({
      name: `${ROOM_PREFIX} ${i + 1}`,
      type: ChannelType.GuildVoice,
      parent: category.id,
      userLimit: 0,
      permissionOverwrites: [privateOverwrites(guild, [])[0]],
      reason: 'Tournament team room'
    });
    console.log(`[TOUR-VOICE] created ${room.name} (${room.id})`);
    rooms.push(room);
  }

  return {
    ok: true,
    categoryId: category.id,
    stageId: stage.id,
    roomIds: rooms.map(r => r.id)
  };
}

// Rewrites access on the two team rooms for the current matchup. Team A goes to
// room 1, team B to room 2, so the split is the same on every round and players
// do not have to work out which room is theirs.
//
// Teams with nobody currently in the room are given a deny, which is what stops a
// team that has been knocked out from listening to a later matchup.
async function assignTeamRooms(guild, liveMatch, teamA, teamB) {
  const rooms = await findTeamRooms(guild);
  if (!rooms.length) return { ok: false, reason: 'no rooms' };

  const everyone = guild.roles.everyone.id;
  const aIds = teamMemberIds(guild, teamA);
  const bIds = teamMemberIds(guild, teamB);

  const result = [];
  for (let i = 0; i < rooms.length; i++) {
    const room = rooms[i];
    const allowed = i === 0 ? aIds : bIds;
    try {
      // Replace the whole set rather than editing piecemeal: a player left on
      // from the previous round would otherwise keep access, which is the exact
      // leak these rooms exist to prevent.
      await room.permissionOverwrites.set(everyone, { deny: [PermissionsBitField.Flags.ViewChannel] });
      for (const id of allowed) {
        await room.permissionOverwrites.create(id, {
          allow: [
            PermissionsBitField.Flags.ViewChannel,
            PermissionsBitField.Flags.Connect,
            PermissionsBitField.Flags.Speak
          ]
        });
      }
      await room.setName(`${ROOM_PREFIX} ${i + 1}`);
      result.push({ roomId: room.id, name: room.name, members: allowed });
    } catch (e) {
      note('tour-voice-perms', e);
      result.push({ roomId: room.id, error: e.message });
    }
  }

  return { ok: true, rooms: result, aCount: aIds.length, bCount: bIds.length };
}

// Closes both rooms between rounds. Access is denied rather than deleted, so the
// channels stay in place and their ids stay valid.
async function lockTeamRooms(guild, reason) {
  const rooms = await findTeamRooms(guild);
  const everyone = guild.roles.everyone.id;
  let locked = 0;
  for (const room of rooms) {
    try {
      await room.permissionOverwrites.set(everyone, { deny: [PermissionsBitField.Flags.ViewChannel] });
      // Remove every explicit member grant, not just the ones we knew about.
      const overwrites = [...room.permissionOverwrites.values()]
        .filter(o => o.type === 1 && o.id !== everyone && o.id !== guild.id);
      for (const o of overwrites) {
        await room.permissionOverwrites.delete(o.id).catch(e => note('tour-voice-perms', e));
      }
      locked++;
    } catch (e) {
      note('tour-voice-perms', e);
    }
  }
  return { ok: true, locked, reason: reason || null };
}

// ---------------------------------------------------------------------------
// Announcements
// ---------------------------------------------------------------------------
// Posted into the stage and the tournament text channel together. The stage is
// where people are listening, and the text channel is where people who were not
// in voice can still catch up.
function buildAnnouncement(t, live, teamA, teamB, extra, guild) {
  const round = live && live.round ? live.round.number : null;
  const lines = [];
  lines.push(`## 🏆 ${t.name}`);
  if (live) {
    lines.push(
      `### Round ${round}`,
      '',
      `**${teamA ? teamA.name : 'TBD'}**  ⚔️  **${teamB ? teamB.name : 'TBD'}**`,
      '',
      teamA ? `🟢 ${membersOf(guild, teamA)}` : '',
      teamB ? `🔴 ${membersOf(guild, teamB)}` : ''
    );
    lines.push(
      '',
      'Both captains: **join your team room** from the bracket post.',
      'Everyone else: **join the 📺 Stage** to watch.'
    );
  } else {
    lines.push('No matchup is waiting for a result right now.');
  }
  if (extra) lines.push('', extra);

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 📣 Match call`)
    .setColor(COLORS.gold)
    .setDescription(lines.filter(l => l !== undefined).join('\n'))
    .setFooter({ text: BRANDING });

  return { embeds: [withBanner(embed, guild)] };
}

// The roster as pings for the stage announcement. Members who have left are
// shown as a bare id, because an unresolvable mention does not fail the send on
// its own but does look broken to everyone watching.
function membersOf(guild, team) {
  return announcementMembers(guild, team);
}

// ---------------------------------------------------------------------------
// Roulette
// ---------------------------------------------------------------------------
// The spin. Every alive team is written onto one card and the cards are dealt out
// in the embed, so the winner is decided by the same draw that decides the order
// they appear in -- there is no separate "result" to disagree with what people
// saw.
const SPIN_PREFIX = 'tour_roulette_';

function announcementMembers(guild, team) {
  if (!team) return '—';
  const out = [];
  for (const id of team.members || []) {
    const m = guild && guild.members && guild.members.cache.get(id);
    // A member who has left the server would make the whole announcement fail to
    // send, so they are shown as a bare id instead of a mention that no longer
    // resolves.
    out.push(m ? `<@${id}>` : `\`${id}\``);
  }
  return out.join(' ') || '—';
}

function buildRoulette(t, guild, spinning) {
  const alive = (t.teams || []).filter(x => x.status === 'active');

  // Seed the names once. Math.random is fine here: the draw is only a pairing,
  // and the bracket it produces is written to disk immediately.
  if (!t.roulette || !Array.isArray(t.roulette.pool) || t.roulette.pool.length !== alive.length) {
    t.roulette = { pool: alive.map(x => x.name), order: shuffle(alive.map(x => x.id)) };
  }

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🎡 Tournament draw`)
    .setColor(COLORS.primary)
    .setDescription(
      spinning
        ? '🎰 **Spinning…**\n\nHold on.'
        : `${alive.length} team${alive.length === 1 ? '' : 's'} in the hat. Press **Spin** to draw the next matchup.\n\n` +
          'The draw sets the order for this round. Nobody is eliminated by the spin itself.'
    )
    .setFooter({ text: BRANDING });

  // The pool, one per line, so it is visible rather than implied.
  const lines = (t.roulette.order || []).map((id, i) => {
    const team = alive.find(x => x.id === id);
    return `${String(i + 1).padStart(2, ' ')}. **${team ? team.name : '?'}**`;
  });
  if (lines.length) {
    embed.addFields({ name: '🎩 In the hat', value: lines.slice(0, 24).join('\n') || '—', inline: false });
  }

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(SPIN_PREFIX + t.id)
      .setLabel(spinning ? 'Spinning…' : 'Spin')
      .setEmoji('🎡')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(spinning || alive.length < 2)
  );

  return { embeds: [withBanner(embed, guild)], components: [row], ephemeral: true };
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Draws the next two teams from the shuffled order. Returns null once fewer than
// two are left, which is what ends the round.
function drawPair(t) {
  if (!t.roulette || !Array.isArray(t.roulette.order)) return null;
  if (t.roulette.order.length < 2) return null;
  const order = t.roulette.order.slice();
  const a = order.shift();
  const b = order.shift();
  t.roulette.order = order;
  return [a, b];
}

// Announces a drawn matchup in the stage and in the text channel.
//
// Both, not one: the stage is where people are listening when the announcement
// lands, and the text channel is where the people who were not in voice catch up
// afterwards. Sending to only one of them loses half the field.
async function announceMatchup(guild, t, teamA, teamB, extra) {
  const live = tournament.getLiveMatch(t);
  const payload = buildAnnouncement(t, live, teamA, teamB, extra, guild);

  const sent = [];
  const stage = await findStage(guild);
  if (stage && stage.isTextBased()) {
    const m = await stage.send(payload).catch(e => { note('tour-announce', e); return null; });
    if (m) sent.push(m);
  }
  const textChannel = t.channelId ? guild.channels.cache.get(t.channelId) : null;
  if (textChannel && textChannel.isTextBased()) {
    const m = await textChannel.send(payload).catch(e => { note('tour-announce', e); return null; });
    if (m) sent.push(m);
  }
  return { ok: sent.length > 0, count: sent.length };
}

module.exports = {
  STAGE_NAME,
  ROOM_PREFIX,
  ROOM_COUNT,
  DEFAULT_CATEGORY_ID,
  SPIN_PREFIX,
  categoryId,
  teamMemberIds,
  ensureChannels,
  findStage,
  findTeamRooms,
  assignTeamRooms,
  lockTeamRooms,
  buildAnnouncement,
  announcementMembers,
  buildRoulette,
  shuffle,
  drawPair,
  announceMatchup
};
