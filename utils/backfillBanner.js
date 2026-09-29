// One-time backfill: add the server banner to messages the bot already posted.
//
// withBanner() only affects embeds built after it existed, so every announcement,
// report and application message sitting in the channels from before the change
// still has no artwork. This walks that history and edits the ones that are
// missing it.
//
// It is deliberately conservative:
//   - only messages the bot itself authored, so it can never touch a human's post
//   - only embeds with no image, so proof screenshots and any other artwork stay
//   - bounded work per run, with a pause between edits to stay off the rate limit
//   - recorded in settings so it does not run twice
const { loadSettings, saveSettings } = require('./settings');

const HISTORY_LIMIT = 100;   // messages to look at per channel
const MAX_EDITS = 40;        // hard cap per run
const EDIT_DELAY_MS = 1200;  // between edits; Discord allows 5 edits / 5s

const TARGET_KEYS = [
  'exposeChannelId',   // announcements
  'checkChannelId',    // checker queue
  'reportChannelId',   // report explainer
  'applyChannelId',    // role apply
  'applyQueueChannelId'
];

// Channels that are not tracked in settings, named directly. Same treatment as
// above: any bot message here without artwork gets the banner.
const EXTRA_CHANNEL_IDS = [
  '1546448959742943252',
  '1545413924483113040'  // live leaderboard
];

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// The same artwork withBanner() picks, so old and new messages match.
function bannerUrlFor(guild) {
  try {
    if (guild && typeof guild.bannerURL === 'function') {
      const b = guild.bannerURL({ size: 512 });
      if (b) return b;
    }
    if (guild && typeof guild.iconURL === 'function') {
      return guild.iconURL({ size: 512 }) || null;
    }
  } catch (e) { /* partial guild */ }
  return null;
}

// Checks the serialised form, not the Embed object, because that is what gets
// sent back. discord.js exposes .image as a getter on the object, so reading it
// there happens to work -- but two sources of truth for "does this have artwork"
// is how proof screenshots get clobbered later.
function needsBanner(embeds) {
  return embeds.some(e => e && !e.image);
}

function alreadyDone() {
  const s = loadSettings();
  return !!s.bannerBackfillAt;
}

function markDone(summary) {
  const s = loadSettings();
  s.bannerBackfillAt = new Date().toISOString();
  s.bannerBackfillSummary = summary;
  saveSettings(s);
}

/**
 * @returns {Promise<{ran:boolean, reason?:string, edited?:number, channels?:object, errors?:string[]}>}
 */
async function run(guild, botUserId) {
  if (!guild) return { ran: false, reason: 'no guild' };
  if (alreadyDone()) return { ran: false, reason: 'already done' };

  const bannerUrl = bannerUrlFor(guild);
  if (!bannerUrl) {
    // Nothing to add. Recording it as done stops it retrying every restart on a
    // server that has no icon and no banner.
    markDone({ edited: 0, reason: 'no server banner or icon available' });
    return { ran: true, edited: 0, reason: 'no banner available' };
  }

  const settings = loadSettings();
  const errors = [];
  const perChannel = {};
  let edited = 0;

  // Settings-tracked channels first, then the ones named directly. De-duplicated,
  // since a channel can be reachable both ways.
  const targets = [];
  for (const key of TARGET_KEYS) {
    if (settings[key]) targets.push({ label: key, id: settings[key] });
  }
  for (const id of EXTRA_CHANNEL_IDS) {
    if (id && !targets.some(t => t.id === id)) targets.push({ label: `extra:${id}`, id });
  }

  for (const { label, id } of targets) {
    if (edited >= MAX_EDITS) break;
    const channel = guild.channels.cache.get(id);
    if (!channel || !channel.isTextBased()) continue;

    let messages;
    try {
      messages = await channel.messages.fetch({ limit: HISTORY_LIMIT });
    } catch (e) {
      errors.push(`${label}: fetch failed - ${e.message}`);
      continue;
    }

    let count = 0;
    for (const msg of messages.values()) {
      if (edited >= MAX_EDITS) break;
      // Only ever touch our own posts.
      if (msg.author && botUserId && msg.author.id !== botUserId) continue;
      if (!msg.embeds || !msg.embeds.length) continue;

      // Serialise first, then decide. toJSON() is what goes back to Discord, so
      // the "already has artwork" check has to read the same shape.
      const data = msg.embeds.map(e => (typeof e.toJSON === 'function' ? e.toJSON() : e));
      if (!needsBanner(data)) continue;

      for (const e of data) {
        if (!e.image) e.image = { url: bannerUrl };
      }

      try {
        await msg.edit({ embeds: data });
        edited++; count++;
        await sleep(EDIT_DELAY_MS);
      } catch (e) {
        // A single failure (message too old, missing permissions) must not abort
        // the whole channel.
        errors.push(`${label}/${msg.id}: ${e.message}`);
      }
    }
    if (count) perChannel[label] = count;
  }

  markDone({ edited, channels: perChannel, at: new Date().toISOString() });
  return { ran: true, edited, channels: perChannel, errors };
}

module.exports = { run, bannerUrlFor, needsBanner, HISTORY_LIMIT, MAX_EDITS, EXTRA_CHANNEL_IDS };
