// Embeds and the registration modal for the tournament bracket.
//
// Everything here is read-only with respect to state: the functions take a
// tournament and render it. The bracket post is edited in place as results come
// in, so the same builders produce both the first message and every later
// revision, and there is only ever one definition of what the bracket looks
// like.
const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const { COLORS, BRANDING, STICKERS, MODES, STYLES, withThumbnail, withBanner } = require('./ui');
const T = require('./tournament');

// Discord rejects a field value over 1024 characters and an embed description
// over 4096, so every list is clipped rather than left to throw at send time.
const MAX_LIST = 22;

function clip(text, max = 1000, suffix = '…') {
  const s = String(text == null ? '' : text);
  if (s.length <= max) return s;
  return s.slice(0, Math.max(0, max - suffix.length)) + suffix;
}

// Mentions for a roster, skipping anyone who left the server.
function roster(guild, team) {
  const ids = team && Array.isArray(team.members) ? team.members : [];
  return ids
    .map(id => {
      const m = guild && guild.members && guild.members.cache ? guild.members.cache.get(id) : null;
      return m ? `<@${id}>` : `\`${id}\``;
    })
    .join(' ');
}

function teamLabel(team, size = 22) {
  if (!team) return 'TBD';
  const n = String(team.name || '?');
  return n.length > size ? n.slice(0, size - 1) + '…' : n;
}

function mentionLine(guild, team, max = 950) {
  const names = (team && team.members ? team.members : [])
    .map(id => `<@${id}>`)
    .join(' ');
  return clip(names || '—', max);
}

// ---------------------------------------------------------------------------
// Sign-up post
// ---------------------------------------------------------------------------
const REGISTER_BTN = 'tour_register';
const NEXT_BTN = 'tour_next';
const PICK_A = 'tour_win_a_';
const PICK_B = 'tour_win_b_';
const MODE_MENU = 'tour_mode_';
const STYLE_MENU = 'tour_style_';

function buildSignupMessage(t, guild) {
  const mode = T.modeLabel(t);
  const style = T.styleLabel(t);

  const embed = withThumbnail(new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 ${t.name}`)
    .setColor(COLORS.gold)
    .setDescription(
      `Sign your team up below. Once enough teams are in, an admin starts the bracket.\n\n` +
      `**📏 Format**  ${t.teamSize}v${t.teamSize} — **${t.teamSize} players per team**\n` +
      (mode ? `**🎮 Mode**  **${mode}**${style ? ` · ${style}` : ''}\n` : '') +
      `**👥 Registered**  **${t.teams.length}** team${t.teams.length === 1 ? '' : 's'}\n` +
      `**🚪 Sign-ups**  ${t.status === 'signup' ? '**OPEN**' : '**CLOSED**'}`
    )
    .addFields(
      { name: '📋 How it works', value: [
        'Press **Register Team** and fill in the form.',
        'You enter **yourself** plus your duo partners.',
        'Each team can add a **banner** after registering.',
        'A **single loss eliminates** your team — no second chances.',
        'Winners advance down the bracket until one team is left.'
      ].join('\n'), inline: false }
    )
    .setFooter({ text: BRANDING }), guild);

  // Discord needs at least one component on the message or it refuses it, so a
  // closed sign-up still renders the button in a disabled state.
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(REGISTER_BTN)
      .setLabel('Register Team')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
      .setDisabled(t.status !== 'signup')
  );

  return { embeds: [embed], components: [row] };
}

// ---------------------------------------------------------------------------
// Mode / style picker -- admin only, ephemeral
//
// Shown as a follow-up to !tcreate so the organiser does not have to remember
// the mode names or their exact spelling. amo-yes asks for a style on top, which
// is why this is two steps rather than one longer menu.
// ---------------------------------------------------------------------------
function buildModePicker(t) {
  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 ${t.name} — pick a mode`)
    .setColor(COLORS.primary)
    .setDescription(
      `**Format**  ${t.teamSize}v${t.teamSize}\n\n` +
      `Choose which mode this tournament is played in. Only you can see this.`
    )
    .setFooter({ text: BRANDING });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(MODE_MENU + t.id)
      .setPlaceholder('🎮 Choose a mode…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(MODES.map(m =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.label)
          .setDescription(m.desc)
          .setValue(m.value)
          .setEmoji(m.emoji)
      ))
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

function buildStylePicker(t) {
  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 ${t.name} — pick a style`)
    .setColor(COLORS.primary)
    .setDescription(
      `**Mode**  **amo-yes**\n\n` +
      `Pick the lobby style for this tournament. Only you can see this.`
    )
    .setFooter({ text: BRANDING });

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(STYLE_MENU + t.id)
      .setPlaceholder('🎨 Choose a style…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(STYLES.map(s =>
        new StringSelectMenuOptionBuilder()
          .setLabel(s.label)
          .setDescription(s.desc)
          .setValue(s.value)
          .setEmoji(s.emoji)
      ))
  );

  return { embeds: [embed], components: [row], ephemeral: true };
}

// Confirmation after a choice is made. Ephemeral, because the choice is already
// written on the public sign-up post and repeating it there adds nothing.
function buildModeConfirmed(t, mode, style, guild) {
  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 Mode set`)
    .setColor(COLORS.success)
    .setDescription(
      `**${t.name}** is now **${mode}**` +
      (style ? ` with **${style}**` : '') +
      `.\n\nThe sign-up post has been updated.`
    )
    .setFooter({ text: BRANDING });
  return { embeds: [withThumbnail(embed, guild)], ephemeral: true };
}

// ---------------------------------------------------------------------------
// Registration modal
// ---------------------------------------------------------------------------
// Discord modals have no mention autocomplete, so partners are entered as raw
// user ids. That is the same convention !stats and !rank already use, so it is
// not a new thing to learn for this server.
function buildRegisterModal(t) {
  const partnerCount = Math.max(1, t.teamSize - 1);
  const modal = new ModalBuilder()
    .setCustomId(`tourmodal_${t.id}`)
    .setTitle(`${STICKERS.game} Register — ${t.teamSize}v${t.teamSize}`);

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('teamNameInput')
      .setLabel('Team Name')
      .setPlaceholder('e.g. Team Vertex')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(2)
      .setMaxLength(T.MAX_TEAM_NAME)
  ));

  for (let i = 0; i < partnerCount; i++) {
    modal.addComponents(new ActionRowBuilder().addComponents(
      new TextInputBuilder()
        .setCustomId(`partner${i}Input`)
        .setLabel(partnerCount === 1 ? 'Duo Partner ID' : `Player ${i + 2} ID`)
        .setPlaceholder('Right-click them → Copy ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMinLength(17)
        .setMaxLength(20)
    ));
  }

  return modal;
}

// ---------------------------------------------------------------------------
// Team card
// ---------------------------------------------------------------------------
function buildTeamCard(t, team, guild) {
  const status = team.status === 'champion' ? '🏆 Champion'
    : team.status === 'eliminated' ? '❌ Eliminated'
    : '⚔️ Active';
  const mode = T.modeLabel(t);
  const style = T.styleLabel(t);

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} ${team.name}`)
    .setColor(team.status === 'champion' ? COLORS.gold
      : team.status === 'eliminated' ? COLORS.danger : COLORS.team1)
    .setDescription(
      `**Status**  ${status}\n` +
      `**Format**  ${t.teamSize}v${t.teamSize}\n` +
      (mode ? `**🎮 Mode**  ${mode}${style ? ` · ${style}` : ''}\n` : '') +
      `**Record**  ${team.wins || 0}W / ${team.losses || 0}L\n` +
      `**Seed**  #${team.seed}`
    )
    .addFields({ name: '👥 Roster', value: mentionLine(guild, team), inline: false });

  // setImage before withBanner, which deliberately leaves an embed that already
  // has artwork alone so a team's own banner is never replaced by the server's.
  if (team.banner) embed.setImage(team.banner);
  return withBanner(withThumbnail(embed, guild), guild);
}

// ---------------------------------------------------------------------------
// Bracket post
// ---------------------------------------------------------------------------
function buildBracketMessage(t, guild) {
  const p = T.getProgress(t);
  const champ = p.championId ? T.getTeam(t, p.championId) : null;

  if (p.finished && champ) return buildChampionMessage(t, champ, guild);

  const live = T.getLiveMatch(t);
  const alive = T.aliveTeams(t);
  const qualified = T.qualifiedLine(t);

  let header;
  if (live) {
    const a = T.getTeam(t, live.match.a);
    const b = T.getTeam(t, live.match.b);
    // Guarded on both sides: a matchup can name a team id that the state no
    // longer holds, and one missing team must not blank the whole bracket.
    const captains = (a && b)
      ? `<@${a.captainId}> vs <@${b.captainId}>`
      : (a || b ? '<@roster unavailable>' : '');
    header =
      `▶️ **NEXT MATCH**  ·  Round **${live.round.number}** of **${p.totalRounds}**\n` +
      `\`\`\`\n${STICKERS.team1} ${pad(teamLabel(a, 18))}\n${STICKERS.team2} ${pad(teamLabel(b, 18))}\n\`\`\`\n` +
      captains;
  } else {
    header = `⏳ **No match is waiting for a result.** An admin decides each matchup with the buttons below.`;
  }

  const mode = T.modeLabel(t);
  const style = T.styleLabel(t);

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 ${t.name}`)
    .setColor(COLORS.primary)
    .setDescription(clip(
      `${header}\n` +
      `${'─'.repeat(24)}\n` +
      `**👥 Teams**  ${alive.length} alive of ${p.total}\n` +
      `**🎯 Format**  ${t.teamSize}v${t.teamSize}` +
      (mode ? `\n**🎮 Mode**  ${mode}${style ? ` · ${style}` : ''}` : ''),
      4000
    ));

  // The qualified line: teams through so far, strongest first, which is what
  // shows who is through and who is about to be played out.
  if (qualified.length) {
    const lines = qualified.slice(0, MAX_LIST).map((team, i) => {
      const n = i + 1;
      const num = n <= 3 ? ['🥇', '🥈', '🥉'][n - 1] : `${n}.`;
      return `${num} **${clip(team.name, 24)}** — ${team.wins || 0} win${team.wins === 1 ? '' : 's'}`;
    });
    embed.addFields({
      name: '✅ QUALIFIED — through to the next round',
      value: clip(lines.join('\n')),
      inline: false
    });
  }

  // Still to come in this tournament, so the bracket reads as a whole rather
  // than only as far as the current matchup.
  const waiting = alive.filter(x => !live || (x.id !== live.match.a && x.id !== live.match.b));
  if (waiting.length) {
    const lines = waiting.slice(0, MAX_LIST).map((team, i) => {
      const n = qualified.length + i + 1;
      const num = n <= 3 ? ['🥇', '🥈', '🥉'][n - 1] : `${n}.`;
      return `${num} **${clip(team.name, 24)}**${team.wins ? ` — ${team.wins} win${team.wins === 1 ? '' : 's'}` : ' — not played yet'}`;
    });
    embed.addFields({
      name: '⏳ STILL IN',
      value: clip(lines.join('\n')),
      inline: false
    });
  }

  const eliminated = T.eliminatedTeams(t);
  if (eliminated.length) {
    const lines = eliminated.slice(0, MAX_LIST).map(team => {
      const by = team.eliminatedBy ? T.getTeam(t, team.eliminatedBy) : null;
      return `**${clip(team.name, 22)}**${by ? ` — knocked out by ${clip(by.name, 20)}` : ''}`;
    });
    embed.addFields({
      name: '❌ ELIMINATED',
      value: clip(lines.join('\n')),
      inline: false
    });
  }

  embed.setFooter({ text: BRANDING });

  const parts = { embeds: [withBanner(embed, guild)], components: [] };
  if (live) {
    const a = T.getTeam(t, live.match.a);
    const b = T.getTeam(t, live.match.b);
    parts.components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(PICK_A + live.match.id)
        .setLabel(`${STICKERS.team1} ${clip(teamLabel(a, 18), 80)}`)
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(PICK_B + live.match.id)
        .setLabel(`${STICKERS.team2} ${clip(teamLabel(b, 18), 80)}`)
        .setStyle(ButtonStyle.Danger)
    ));
  }

  parts.components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(NEXT_BTN)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄')
  ));

  return parts;
}

function pad(s) {
  const str = String(s || '');
  return str + ' '.repeat(Math.max(0, 18 - str.length));
}

function buildChampionMessage(t, champ, guild) {
  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 ${t.name} — CHAMPION`)
    .setColor(COLORS.gold)
    .setDescription(
      `## 🏆 ${champ.name}\n` +
      `**Record**  ${champ.wins || 0}W / ${champ.losses || 0}L\n` +
      `**Roster**  ${roster(guild, champ)}\n` +
      `**Format**  ${t.teamSize}v${t.teamSize}`
    )
    .setFooter({ text: BRANDING });
  if (champ.banner) embed.setImage(champ.banner);
  return { embeds: [withBanner(embed, guild)] };
}

// A registration confirmation, sent in-channel so the whole server sees who is
// in and can check the roster.
function buildRegisteredMessage(t, team, guild) {
  return { embeds: [buildTeamCard(t, team, guild)] };
}

// Refusal text for a registration that did not go through. Kept next to the
// modal so the reason codes in tournament.js have exactly one wording.
const REFUSALS = {
  no_active_tournament: '❌ There is no tournament running right now.',
  signups_closed: '❌ Sign-ups for this tournament are already closed.',
  bad_name: '❌ Give your team a name of at least 2 characters.',
  name_taken: '❌ Another team already uses that name. Pick a different one.',
  full: '❌ This tournament has reached the maximum number of teams.',
  no_team: '❌ No team matched that name.',
  player_taken: (id, name) => `❌ <@${id}> is already registered with **${name}**. One team per player.`,
  wrong_size: (got, need) => `❌ You entered **${got}** player${got === 1 ? '' : 's'} but this tournament is **${need}v${need}** — you need exactly **${need}**.`,
  bad_member: '❌ One of the player IDs is not a valid Discord ID.'
};

function refusal(reason, extra) {
  const msg = REFUSALS[reason];
  if (typeof msg === 'function') return msg(extra && extra.playerId, extra && extra.teamName);
  if (reason === 'wrong_size') return REFUSALS.wrong_size(extra && extra.got, extra && extra.need);
  return msg || '❌ That did not work.';
}

module.exports = {
  REGISTER_BTN,
  NEXT_BTN,
  PICK_A,
  PICK_B,
  MODE_MENU,
  STYLE_MENU,
  clip,
  roster,
  buildSignupMessage,
  buildRegisterModal,
  buildModePicker,
  buildStylePicker,
  buildModeConfirmed,
  buildTeamCard,
  buildBracketMessage,
  buildChampionMessage,
  buildRegisteredMessage,
  refusal
};
