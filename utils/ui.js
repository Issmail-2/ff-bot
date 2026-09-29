const { EmbedBuilder } = require('discord.js');

// The old palette had three near-identical oranges (FF6600 / FFA500 / FF8C00)
// for primary, info and loser, so unrelated embeds rendered the same colour, and
// a harsh 00FF00 green for the rest. This palette is keyed to meaning and
// matches the rank card's blurple-on-navy so the whole bot reads as one brand.
const COLORS = {
  primary: 0x5865F2,   // blurple - the brand colour, matches the rank card
  gold:    0xF5A623,   // rank / #1 / MVP
  success: 0x57F287,   // accepted, success
  danger:  0xED4245,   // declined, destructive
  info:    0x5E6AD2,   // neutral informational
  warning: 0xF5A623,   // pending, needs attention
  neutral: 0x2B2D31,   // dark grey, muted states

  // Team identity - these deliberately match the 🟢 / 🔴 team emojis in config
  team1:   0x57F287,   // green
  team2:   0xED4245,   // red

  // Kept as aliases so existing call sites keep working. loser/gold previously
  // sat a shade apart for no visible reason; they are now the same amber.
  loser:   0xF5A623,
  green:   0x57F287,
  dark:    0x2B2D31
};

// ---------------------------------------------------------------------------
// Server stickers.
//
// The configured emoji values are sometimes bare shortcodes ("Free_fire_logo")
// rather than full markup ("<:Free_fire_logo:1466528905509736705>"). Discord does
// not parse shortcodes in bot messages, so the bot was posting the literal text
// ":Free_fire_logo:" instead of the sticker.
//
// The canonical map stores the exact casing because Discord emoji names are
// case-sensitive: rebuilding markup from a lower-cased input produces
// ":free_fire_logo:", which resolves to nothing.
// ---------------------------------------------------------------------------
const EMOJI_IDS = {
  free_fire_logo: { name: 'Free_fire_logo', id: '1466528905509736705' },
  ahypr_greendotid: { name: 'aHYPR_GREENDOTid', id: '1545351146770796634', animated: true },
  aredptid: { name: 'aredptid', id: '1545350890989428829' },
  freefire: { name: 'Free_fire_logo', id: '1466528905509736705' },
  fire: { name: 'Free_fire_logo', id: '1466528905509736705' }
};
const EMOJI_FALLBACK = { game: '🎮', team1: '🟢', team2: '🔴' };

function normalizeEmoji(value, key) {
  const v = String(value == null ? '' : value).trim();
  if (v.startsWith('<')) return v;
  if (v) {
    const hit = EMOJI_IDS[v.toLowerCase()];
    if (hit) return `<${hit.animated ? 'a' : ''}:${hit.name}:${hit.id}>`;
    // A bare unicode emoji is fine as-is.
    if (!/^[\w-]+$/.test(v)) return v;
  }
  return EMOJI_FALLBACK[key] || '';
}

// Reads config.json the same way the rest of the bot does and returns a
// ready-to-use sticker set, so every module can render the same artwork.
function loadStickers() {
  let config = {};
  try { config = require('../config.json'); } catch { config = {}; }
  const raw = config.emojis || {};
  return {
    game: normalizeEmoji(raw.game, 'game'),
    team1: normalizeEmoji(raw.team1, 'team1'),
    team2: normalizeEmoji(raw.team2, 'team2')
  };
}

const STICKERS = loadStickers();

const BRANDING = '© Avengers Server • All Rights Reserved';

function progressBar(current, total, size = 8) {
  const filled = Math.max(0, Math.min(size, Math.round((current / Math.max(1, total)) * size)));
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
}

// A slot strip that shows which side each claimed place belongs to, instead of an
// abstract bar. Reads far better than "███░░░░░░░" because the colour tells you
// the shape of the lobby, not just how full it is.
function slotStrip(team1Count, team2Count, teamSize) {
  const size = teamSize || 2;
  const cells = [];
  for (let i = 0; i < size; i++) {
    cells.push(i < team1Count ? '🟩' : '⬜');
  }
  cells.push('·');
  for (let i = 0; i < size; i++) {
    cells.push(i < team2Count ? '🟥' : '⬜');
  }
  return cells.join('');
}

function divider(char = '═', length = 26) {
  const ch = char && char.length ? char[0] : '═';
  return ch.repeat(length);
}

function createEmbed(color) {
  return new EmbedBuilder()
    .setColor(color)
    .setFooter({ text: BRANDING })
    .setTimestamp();
}

// Convenience so embeds do not each have to remember to attach the server icon.
function withThumbnail(embed, guild) {
  try {
    const url = guild && guild.iconURL ? guild.iconURL({ size: 256 }) : null;
    if (url) return embed.setThumbnail(url);
  } catch (e) { /* guild may be partial during startup */ }
  return embed;
}

// Puts the server banner above the embed, so announcements and the checker /
// role-apply notices all carry the same artwork instead of looking like a wall
// of plain text boxes.
//
// The image is the wide guild banner when the server has one. Discord only lets
// the bot read a banner with the Guilds intent, and a server may not have set
// one at all, so it falls back to the icon rendered as a banner. An embed that
// already has an image is left alone -- this is a floor, not an override.
function withBanner(embed, guild) {
  try {
    if (!guild) return embed;
    if (embed.data && embed.data.image) return embed;
    const banner = typeof guild.bannerURL === 'function' ? guild.bannerURL({ size: 512 }) : null;
    if (banner) return embed.setImage(banner);
    const icon = typeof guild.iconURL === 'function' ? guild.iconURL({ size: 512 }) : null;
    if (icon) return embed.setImage(icon);
  } catch (e) { /* guild may be partial during startup */ }
  return embed;
}

module.exports = {
  COLORS, BRANDING, STICKERS, normalizeEmoji,
  progressBar, slotStrip, divider, createEmbed, withThumbnail, withBanner
};
