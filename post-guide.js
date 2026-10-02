// Posts the tournament help embed into the tournament channel.
//
// Run once by hand:  node post-guide.js
//
// It is safe to run more than once. The message id is recorded in
// data/settings.json, so a second run edits the existing post instead of stacking
// duplicates, and `--force` re-posts regardless if a post really is wanted.
//
// The bot also runs ensureGuidePosted() on startup, so this script is only needed
// if you want the post to appear without waiting for a restart.
const { Client, GatewayIntentBits, Events } = require('discord.js');
const path = require('path');

let config = {};
try { config = require('./config.json'); } catch { config = {}; }

const TOKEN = process.env.DISCORD_TOKEN || config.token;
const CHANNEL_ID = process.env.TOURNAMENT_CHANNEL_ID || config.tournamentChannelId || '1555488260376105060';

if (!TOKEN) {
  console.error('No bot token. Put one in config.json ("token") or set DISCORD_TOKEN, then run this again.');
  process.exit(1);
}

const { buildGuideMessage } = require('./utils/tournamentGuide');
const settingsStore = require('./utils/settings');
const tournament = require('./utils/tournament');
const { fetchMessage, note } = require('./utils/ui');

const FORCE = process.argv.includes('--force');

async function main() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });

  client.once(Events.ClientReady, async (c) => {
    console.log(`Logged in as ${c.user.tag}`);

    const channel = await c.channels.fetch(CHANNEL_ID).catch(e => {
      console.error(`Could not fetch channel ${CHANNEL_ID}: ${e.message}`);
      console.error('Check the id, and that the bot can see the channel.');
      return null;
    });
    if (!channel || !channel.isTextBased()) {
      console.error('That channel is missing or is not a text channel.');
      await destroy();
      return;
    }

    const guild = channel.guild;
    const payload = buildGuideMessage(guild, tournament.getActive());

    const settings = settingsStore.loadSettings();
    const existing = FORCE ? null : await fetchMessage(channel, settings.tournamentGuideMessageId);

    if (existing) {
      await existing.edit(payload).catch(e => note('guide-edit', e));
      console.log(`Updated the existing post (message ${existing.id}).`);
    } else {
      const sent = await channel.send(payload).catch(e => {
        note('guide-send', e);
        return null;
      });
      if (sent) {
        settings.tournamentGuideMessageId = sent.id;
        settings.tournamentGuidePostedAt = new Date().toISOString();
        settings.tournamentGuideChannelId = channel.id;
        settingsStore.saveSettings(settings);
        console.log(`Posted to <#${channel.id}> (message ${sent.id}).`);
      } else {
        console.error('The post failed. Check the bot has Send Messages and Embed Links in that channel.');
      }
    }

    await destroy();
  });

  client.once(Events.Error, e => console.error('Client error:', e.message));

  function destroy() {
    return client.destroy().then(() => process.exit(0));
  }

  client.login(TOKEN).catch(e => {
    console.error('Login failed:', e.message);
    process.exit(1);
  });
}

main();
