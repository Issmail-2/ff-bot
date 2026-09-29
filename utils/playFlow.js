const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonStyle
} = require('discord.js');
const { COLORS, BRANDING, withThumbnail } = require('./ui');

const TEAM_SIZES = [2, 3, 4];
const EXPIRY_MS = 5 * 60 * 1000;
const CUSTOM_ID = 'play_setup';

// Pending /play drafts, keyed by user id. A draft only exists between the
// player choosing a team size and submitting the room modal, so a plain Map is
// enough - but it is swept so a user who abandons the flow cannot leave an
// entry behind forever.
const drafts = new Map();
// Ids of the picker messages we posted, so the channel cleanup can remove a
// stale one instead of leaving abandoned menus in the match channel.
const pickMessageIds = new Map();

function sweep() {
  const now = Date.now();
  for (const [userId, d] of drafts) {
    if (now - (d.createdAt || 0) > EXPIRY_MS) {
      drafts.delete(userId);
      pickMessageIds.delete(userId);
    }
  }
}

function sizeLabel(n) {
  return `${n}v${n}`;
}

// ---------------------------------------------------------------------------
// Step 1 - mode + team size picker.
//
// Two dropdowns in one box: mode (PvP / Esport) and team size. Mode is picked
// first because it decides which channel the match belongs to, but the size
// dropdown is live from the start so a player who already knows they want 4v4
// in the default mode can do it in one interaction.
// ---------------------------------------------------------------------------
const MODES = [
  { value: 'amo', label: 'PvP — Custom Room', emoji: '⚔️', desc: 'Normal ranked custom room' },
  { value: 'esport', label: 'Esport', emoji: '🏆', desc: 'Esport lobby and points' }
];

function buildSizePicker(userId, guild, opts = {}) {
  const currentMode = MODES.some(m => m.value === opts.mode) ? opts.mode : 'amo';
  const modeLabel = MODES.find(m => m.value === currentMode).label.split('—')[0].trim();

  const embed = withThumbnail(new EmbedBuilder()
    .setTitle(`${'🎮'} Host a Match`)
    .setColor(COLORS.primary)
    .setDescription(
      `Hey <@${userId}> — pick a **mode** and a **team size**, then enter your room details.\n\n` +
      `Each team needs **N** players, so **4v4** needs **8** players in total.`
    )
    .addFields(
      { name: '📋 Before you start', value: [
        'You must be **in a required voice channel**.',
        'You become **Team 1** automatically and host the room.',
        'The other players pick their team from the lobby.'
      ].join('\n'), inline: false }
    )
    .setFooter({ text: BRANDING }), guild);

  const modeRow = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CUSTOM_ID}_mode`)
      .setPlaceholder('1️⃣ Choose your mode…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(MODES.map(m =>
        new StringSelectMenuOptionBuilder()
          .setLabel(m.label)
          .setDescription(m.desc)
          .setValue(m.value)
          .setEmoji(m.emoji)
          .setDefault(m.value === currentMode)
      ))
  );

  const row = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`${CUSTOM_ID}_size`)
      .setPlaceholder('2️⃣ Choose your team size…')
      .setMinValues(1)
      .setMaxValues(1)
      .addOptions(TEAM_SIZES.map(n =>
        new StringSelectMenuOptionBuilder()
          .setLabel(sizeLabel(n))
          .setDescription(`${n} vs ${n} — ${n * 2} players total`)
          .setValue(String(n))
          .setEmoji(n === 2 ? '⚔️' : n === 3 ? '🎯' : '🏆')
      ))
  );

  return { embeds: [embed], components: [modeRow, row] };
}

// ---------------------------------------------------------------------------
// Step 2 - room details modal
// ---------------------------------------------------------------------------
function buildRoomModal(match) {
  const modal = new ModalBuilder()
    // Reuses the existing roommodal_ handler, which already validates, saves,
    // auto-joins the host to Team 1, posts the lobby embed and arms the join
    // timeout. One code path for both !play and /play.
    .setCustomId(`roommodal_${match.id}`)
    .setTitle(`🏠 ${match.teamSize}v${match.teamSize} Room Details`);

  // Room ID is the one field the player must supply. Free Fire room IDs are
  // numeric, and it is what opponents need to actually connect.
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('roomIdInput')
      .setLabel('Room ID  (required)')
      .setPlaceholder('e.g. 123456789')
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMinLength(4)
      .setMaxLength(12)
  ));

  // Password and join key are both genuinely optional - some custom rooms have
  // neither. Both are optional and validate as numeric-or-empty rather than
  // being forced to something.
  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('passwordInput')
      .setLabel('Room Password (optional)')
      .setPlaceholder('Leave empty if the room has no password')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(16)
  ));

  modal.addComponents(new ActionRowBuilder().addComponents(
    new TextInputBuilder()
      .setCustomId('keyInput')
      .setLabel('Join Password (optional)')
      .setPlaceholder('Leave empty to let anyone join')
      .setStyle(TextInputStyle.Short)
      .setRequired(false)
      .setMaxLength(16)
  ));

  return modal;
}

// The picker message is transient UI, so it is removed once the player moves on
// to the modal. The match itself is the saved state.
function buildSetupMessageParts(match, hostId, guild) {
  const ts = Math.floor(Date.now() / 1000);
  const embed = withThumbnail(new EmbedBuilder()
    .setTitle(`${'🎮'} Match Setup • ${sizeLabel(match.teamSize)}`)
    .setColor(COLORS.neutral)
    .setDescription(
      `**Host** — <@${hostId}>\n` +
      `**Status** — ⏳ *filling your room details…*\n` +
      `**Created** — <t:${ts}:R>`
    )
    .setFooter({ text: BRANDING }), guild);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`setup_${match.id}`)
      .setEmoji('⚙️')
      .setLabel('Enter Room Details')
      .setStyle(ButtonStyle.Primary)
  );
  return { embeds: [embed], components: [row] };
}

// ---------------------------------------------------------------------------
// Draft tracking
// ---------------------------------------------------------------------------
function setDraft(userId, patch) {
  drafts.set(userId, Object.assign({ createdAt: Date.now() }, drafts.get(userId), patch));
  return drafts.get(userId);
}

function getDraft(userId) {
  return drafts.get(userId) || null;
}

function clearDraft(userId) {
  pickMessageIds.delete(userId);
  return drafts.delete(userId);
}

function draftCount() {
  sweep();
  return drafts.size;
}

module.exports = {
  TEAM_SIZES,
  MODES,
  EXPIRY_MS,
  CUSTOM_ID,
  drafts,
  pickMessageIds,
  sweep,
  sizeLabel,
  buildSizePicker,
  buildRoomModal,
  buildSetupMessageParts,
  setDraft,
  getDraft,
  clearDraft,
  draftCount
};
