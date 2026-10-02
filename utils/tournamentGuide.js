// The standing help post for the tournament channel.
//
// This is separate from tournamentUI.js on purpose: that module renders the
// bracket and the sign-up post, which change as a tournament runs. This is the
// thing that stays put and explains how the whole thing works, so it is built
// once here and posted by post-guide.js (by hand) or ensureGuidePosted() (on
// startup).
//
// The banner is applied with withBanner, which is the same artwork every other
// bot message in this server uses -- the guild banner, falling back to the icon.
// It is deliberately not the server icon only: withBanner already handles the
// fallback, so there is one definition of "the banner" rather than two.
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { COLORS, BRANDING, STICKERS, MODES, withBanner } = require('./ui');
const { REGISTER_BTN, TEAMS_BTN, MY_TEAM_BTN } = require('./tournamentUI');

const FLEXIBLE = [
  '`!tsign Team Vertex @friend` — enter a named team',
  '`!tsign @friend` — name taken from your nickname',
  '`!tsign @a @b @c` — for a larger format'
];

// The full command reference, grouped so it is readable rather than one wall.
const PLAYER_COMMANDS = [
  '`!tlogin` — print this guide with a line you can copy',
  '`!tsign <name> @players` — enter your team',
  '`!tbanner <team>` — set your team logo',
  '`!t` — current tournament status',
  '`!tteams` — every team and its roster'
];

const ADMIN_COMMANDS = [
  '`!tcreate <name> [2v2|3v3|4v4]` — open a tournament, then pick a mode',
  '`!tmode <mode> [style]` — change the mode without the menu',
  '`!tclose` — stop sign-ups early',
  '`!tstart` — build the bracket and begin',
  '`!twin <team>` — declare the winner of a matchup',
  '`!tsetup` — create the stage and the two team rooms',
  '`!tcancel` — cancel and archive',
  '`!tarchive` — archive a finished tournament'
];

const VOICE_COMMANDS = [
  '**📺 Stage** — open to everyone, where announcements are posted',
  '**🔒 Team Room 1 / 2** — only the two teams in the current matchup',
  'Access is rewritten after every result',
  'Both captains join their team room; everyone else joins the stage'
];

function buildGuideMessage(guild, activeTournament) {
  const t = activeTournament || null;
  const size = t ? t.teamSize : null;

  // Only advertise a specific format when there is a tournament to advertise.
  const formatLine = t
    ? `**${t.name}** is open — **${size}v${size}**, you need **${size - 1}** other player${size === 2 ? '' : 's'} besides yourself.`
    : `No tournament is open right now. Formats are **2v2**, **3v3** and **4v4** — you tag everyone except yourself.`;

  const modeLine = t && t.mode
    ? `Mode: **${labelOf(t)}**`
    : `Modes available: ${MODES.map(m => `**${m.label}**`).join(' · ')}`;

  const embed = new EmbedBuilder()
    .setTitle(`${STICKERS.game} 🏆 Tournament — how to take part`)
    .setColor(COLORS.primary)
    .setDescription(
      `Sign your team up, then play a knockout bracket. **A single loss ends your run.**\n\n` +
      `${formatLine}\n${modeLine}\n\n` +
      `**Two steps and you are in:**\n` +
      `**1.** Enter your team — \`!tsign\`\n` +
      `**2.** Add your logo — \`!tbanner\`\n\n` +
      `Not sure of the format? Type \`!tlogin\` and copy the line it prints.`
    )
    .addFields(
      {
        name: '📝 Entering your team',
        value: [
          'Type `@` and pick people from the list — that puts their real id in for you.',
          '**You count as the first player**, so do not tag yourself.',
          ...(size ? [] : FLEXIBLE),
          size ? `For **${size}v${size}** tag **${size - 1}** other player${size === 2 ? '' : 's'}:` : '**Examples:**'
        ].join('\n'),
        inline: false
      },
      {
        name: '🎨 Adding your team logo',
        value: [
          'Upload your logo as an **image** in this channel.',
          'Then run `!tbanner <your team name>`.',
          'The bot picks your newest upload.',
          'You can also attach the image straight to the command.'
        ].join('\n'),
        inline: false
      },
      {
        name: '⚔️ How the tournament works',
        value: [
          'Teams are seeded into a knockout bracket.',
          'An admin declares the winner of each matchup.',
          '**The losing team is knocked out** — there is no second chance.',
          'Winners advance until one team is left.',
          'The bracket post updates itself after every result.'
        ].join('\n'),
        inline: false
      },
      { name: '👥 Player commands', value: PLAYER_COMMANDS.join('\n'), inline: false },
      { name: '🛡️ Admin commands', value: ADMIN_COMMANDS.join('\n'), inline: false },
      { name: '🔊 Voice during a tournament', value: VOICE_COMMANDS.join('\n'), inline: false },
      {
        name: '❌ Common mistakes',
        value: [
          '**Too few or too many tags** — the count must match the format exactly.',
          '**No team name** — not an error, the bot uses your nickname.',
          '**Someone already on a team** — one team per player.',
          '**A bot** — bots cannot play, so they are refused.',
          '**Copying ids by hand** — type `@` and pick from the list instead.'
        ].join('\n'),
        inline: false
      }
    )
    .setFooter({ text: BRANDING });

  // The same pair of rows the sign-up post uses, so the two do not drift apart.
  // Register is the only thing here a player needs, so it leads; the guide is
  // there for anyone who scrolled past the tournament channel's own post.
  const open = !!t && t.status === 'signup';
  const rows = [
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(REGISTER_BTN)
        .setLabel('Register Team')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📝')
        .setDisabled(!open)
    ),
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(TEAMS_BTN)
        .setLabel('Teams')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋')
        .setDisabled(!t || !t.teams.length),
      new ButtonBuilder()
        .setCustomId(MY_TEAM_BTN)
        .setLabel('My Team')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔎')
    )
  ];

  // withBanner leaves an embed that already has artwork alone and otherwise adds
  // the guild banner, which is the same treatment every other message here gets.
  return { embeds: [withBanner(embed, guild)], components: rows };
}

// The mode label is resolved lazily so this module does not need the tournament
// state module, which would be a circular import.
function labelOf(t) {
  const names = { amo: 'amo-no', ammo: 'amo-yes', esport: 'e-sport' };
  const base = names[t.mode] || t.mode;
  const styles = { apostado: 'Apostado', zelika: 'Zelika', highlight: 'Highlight' };
  return t.style ? `${base} · ${styles[t.style] || t.style}` : base;
}

module.exports = { buildGuideMessage, PLAYER_COMMANDS, ADMIN_COMMANDS, VOICE_COMMANDS };
