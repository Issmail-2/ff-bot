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

module.exports = { COLORS, BRANDING, progressBar, slotStrip, divider, createEmbed, withThumbnail };
