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
const PIN_BTN = 'tour_pin';
const UNPIN_BTN = 'tour_unpin';
const CLOSE_SIGNUP_BTN = 'tour_closesignup';
const START_BTN = 'tour_startnow';
const MY_TEAM_BTN = 'tour_myteam';
const GUIDE_BTN = 'tour_guidebtn';
const TEAMS_BTN = 'tour_teamsbtn';
const SETUP_BTN = 'tour_setupvoice';
// Held here rather than in tournamentVoice so every button id lives in one place,
// but the prefix is what the router matches on. The id is suffixed with the
// tournament id so a stale button from a finished tournament is refused.
const SPIN_BTN = 'tour_draw_';
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
        `**Step 1** — type \`!tsign @friend\` here (you are added automatically).`,
        `For ${t.teamSize}v${t.teamSize}, tag **${t.teamSize - 1}** other player${t.teamSize === 2 ? '' : 's'}.`,
        'Add a name with `!tsign Team Vertex @friend`, or let the bot use your nickname.',
        `**Step 2** — upload your logo, then \`!tbanner Team Vertex\`.`,
        '**Not sure of the format? Type `!tlogin`** or press **📋 How to sign up**.',
        'A **single loss eliminates** your team — no second chances.'
      ].join('\n'), inline: false }
    )
    .setFooter({ text: BRANDING }), guild);

  const open = t.status === 'signup';
  const rows = [];

  // Row 1: the two things a player actually does.
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(REGISTER_BTN)
      .setLabel('Register Team')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📝')
      .setDisabled(!open),
    new ButtonBuilder()
      .setCustomId(MY_TEAM_BTN)
      .setLabel('My Team')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔎')
  ));

  // Row 2: reference and housekeeping. Everything here is safe for anyone to
  // press -- the guide, the team list and a refresh are all read-only -- except
  // Close Sign-ups, which is admin-only and gated in the handler.
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(GUIDE_BTN)
      .setLabel('How to sign up')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(TEAMS_BTN)
      .setLabel('Teams')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋')
      .setDisabled(!t.teams.length),
    new ButtonBuilder()
      .setCustomId(PIN_BTN)
      .setLabel('Pin')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📌'),
    new ButtonBuilder()
      .setCustomId(CLOSE_SIGNUP_BTN)
      .setLabel('Close Sign-ups')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('🔒')
      .setDisabled(!open)
  ));

  // Row 3: admin-only tools, shown but gated in the handler. The draw is here
  // because deciding the order is an organiser job, and having it as a button
  // means nobody has to remember a command.
  rows.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(SPIN_BTN + t.id)
      .setLabel('🎡 Draw')
      .setStyle(ButtonStyle.Primary)
      .setEmoji('🎰')
      .setDisabled(!open || t.teams.length < 2),
    new ButtonBuilder()
      .setCustomId(SETUP_BTN)
      .setLabel('Voice Channels')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔊')
  ));

  return { embeds: [embed], components: rows };
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

// Returns the embed itself, not a message payload. This one is built to be read
// on its own and is wrapped by whichever caller needs it in a payload, so it
// does not force every caller to remember the { embeds: [ ... ] } shape.
// ---------------------------------------------------------------------------
// !tlogin -- the copy-and-fill-in guide
//
// The template lives in a code block on purpose. Discord does not let a bot
// actually ping a user with @: an @mention authored by a bot is rendered with
// "suppress embeds" and never notifies anyone, so a template written as real
// mentions would look correct and do nothing. Inside a code block the text is
// literal, is not a real mention, and copies cleanly -- which is what the person
// signing up actually wants.
//
// Returns the embed itself rather than a message payload, so a caller can drop it
// wherever one is needed.
// ---------------------------------------------------------------------------
function buildLoginGuide(t, guild) {
  const size = t ? t.teamSize : 4;
  const partners = size - 1;
  const mode = t ? T.modeLabel(t) : null;
  const style = t ? T.styleLabel(t) : null;
  const placeholders = Array.from({ length: partners }, (_, i) => `@player${i + 2}_id`).join(' ');

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 How to sign up`)
    .setColor(COLORS.primary)
    .setDescription(
      (t
        ? `**${t.name}** is open — **${size}v${size}**, ${mode ? `**${mode}**` : 'mode not set yet'}${style ? ` · ${style}` : ''}.\n\n`
        : `No tournament is open right now, but this is the format whenever one is.\n\n`) +
      '**Step 1 — copy this line and edit it.**\n' +
      'Put your team name in, then tag yourself and your ' + (partners === 1 ? 'partner' : `${partners} partners`) + '.\n\n' +
      '```\n!tsign Your Team Name ' + placeholders + '\n```\n\n' +
      'Tag people by typing **`@`** and picking them from the list — that puts their real id in for you.\n\n' +
      '**Step 2 — add your team logo.**\n' +
      'Upload your logo as an image in this channel, then:\n\n' +
      '```\n!tbanner Your Team Name\n```\n\n' +
      'The bot picks your newest upload. You can also attach the image straight to that command.'
    )
    .addFields(
      { name: '✅ Worked example', value:
        '```\n!tsign Team Vertex ' + placeholders + '\n```\n\n' +
        '**With a logo:**\n```\n!tbanner Team Vertex\n```', inline: false },
      { name: '❌ Common mistakes', value: [
        `**Too few tags** — you need **${partners}** other ${partners === 1 ? 'player' : 'players'} besides yourself.`,
        `**Too many tags** — **${size}v${size}** is exactly **${size}** players.`,
        '**No team name** — the bot then uses your nickname.',
        '**Someone already on a team** — one team per player.',
        '**A bot** — bots cannot play, so they are refused.'
      ].join('\n'), inline: false },
      { name: '📋 All commands', value: [
        '`!tsign <name> @players` — enter your team',
        '`!tbanner <team>` — set your logo',
        '`!t` / `!tteams` — see the tournament and every roster',
        '`!tleave <team>` — withdraw before the start'
      ].join('\n'), inline: false }
    )
    .setFooter({ text: BRANDING });

  return withThumbnail(embed, guild);
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
    // With no live matchup the bracket is still doing something: either every
    // remaining team is through to a later round, or the tournament is over.
    // "No match is waiting" on its own reads like a stuck bot.
    header = p.finished
      ? '👑 Deciding the champion.'
      : `⏳ **No matchup is ready yet** — ${p.alive} team${p.alive === 1 ? '' : 's'} still in, waiting on the previous round.`;
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

  // Row 1: the decision. One button per team, so nobody has to remember a name
  // and type it exactly.
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

  // Row 2: read-only reference. Safe for anyone to press -- the guide and the
  // team list reveal nothing that is not already on the bracket post.
  parts.components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(TEAMS_BTN)
      .setLabel('Teams')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📋'),
    new ButtonBuilder()
      .setCustomId(MY_TEAM_BTN)
      .setLabel('My Team')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔎'),
    new ButtonBuilder()
      .setCustomId(GUIDE_BTN)
      .setLabel('How to sign up')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📖')
  ));

  // Row 3: housekeeping. Refresh and Pin are harmless; Unpin is admin-only and
  // gated in the handler rather than trusted from the button state.
  parts.components.push(new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(NEXT_BTN)
      .setLabel('Refresh')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🔄'),
    new ButtonBuilder()
      .setCustomId(PIN_BTN)
      .setLabel('Pin')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📌'),
    new ButtonBuilder()
      .setCustomId(UNPIN_BTN)
      .setLabel('Unpin')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('📍')
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

// The confirmation a captain sees after entering a team.
//
// Returned as an embed on its own rather than a message payload, so the caller
// can attach its own content beside it. Every caller sends this ephemerally: the
// public sign-up post already shows how many teams are in, and !tteams lists the
// rosters, so posting a card per team into the channel is noise that also lets
// anyone watch rosters being assembled one message at a time.
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
  PIN_BTN,
  UNPIN_BTN,
  CLOSE_SIGNUP_BTN,
  START_BTN,
  MY_TEAM_BTN,
  GUIDE_BTN,
  TEAMS_BTN,
  SETUP_BTN,
  SPIN_BTN,
  MODE_MENU,
  STYLE_MENU,
  clip,
  roster,
  buildSignupMessage,
  buildRegisterModal,
  buildLoginGuide,
  buildModePicker,
  buildStylePicker,
  buildModeConfirmed,
  buildTeamCard,
  buildBracketMessage,
  buildChampionMessage,
  buildRegisteredMessage,
  refusal
};
