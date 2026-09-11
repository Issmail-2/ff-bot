const { EmbedBuilder } = require('discord.js');

const COLORS = {
  primary: 0xFF6600,
  gold: 0xFFD700,
  success: 0x57F287,
  danger: 0xE74C3C,
  info: 0xFFA500,
  loser: 0xFF8C00,
  green: 0x00FF00,
  dark: 0x2B2D31
};

const BRANDING = 'FREE FIRE • AutoMatch';

function progressBar(current, total, size = 8) {
  const filled = Math.max(0, Math.min(size, Math.round((current / Math.max(1, total)) * size)));
  return `${'█'.repeat(filled)}${'░'.repeat(size - filled)}`;
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

module.exports = { COLORS, BRANDING, progressBar, divider, createEmbed };