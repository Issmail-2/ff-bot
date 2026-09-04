const { Client, GatewayIntentBits, Events, EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ChannelType, PermissionsBitField } = require('discord.js');
const config = require('./config.json');
if (process.env.DISCORD_TOKEN) config.token = process.env.DISCORD_TOKEN;
const storage = require('./utils/storage');
const manager = require('./utils/matchManager');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const WINNER_POINTS = config.matchPoints.winner;
const LOSER_POINTS = config.matchPoints.loser;

const SERVER_ID = '1423528601701187717';

function getModeByChannel(channelId) {
  if (config.modes.esport && config.modes.esport.matchChannelId === channelId) return 'esport';
  return 'amo';
}

function getModeConfig(mode) {
  return config.modes[mode] || config.modes.amo;
}

async function ensureEsportChannels(guild) {
  const es = config.modes.esport;
  const botMember = guild.members.me;

  if (!es.matchChannelId) {
    const matchChannel = await guild.channels.create({
      name: '🎮│esports-matches',
      type: ChannelType.GuildText,
    });
    es.matchChannelId = matchChannel.id;
  }

  if (!es.voiceCategoryId) {
    const cat = await guild.channels.create({
      name: '🔊│esports-voice',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [],
    });
    es.voiceCategoryId = cat.id;
  }

  if (!es.logsCategoryId) {
    const cat = await guild.channels.create({
      name: '🗨️│esports-logs',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        {
          id: guild.id,
          deny: [PermissionsBitField.Flags.ViewChannel],
        }
      ],
    });
    es.logsCategoryId = cat.id;
  }

  return es;
}


async function buildMatchBox(guild, match, creatorUser) {
  const progress1 = `${match.team1.length}/${match.teamSize}`;
  const progress2 = `${match.team2.length}/${match.teamSize}`;

  const t1 = match.team1.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') || '*Empty*';
  const t2 = match.team2.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') || '*Empty*';
  const display = getModeConfig(match.mode).displayName;

  let box = '';
  box += `### __${config.emojis.game} ${display} ${match.teamSize}v${match.teamSize} Match__\n`;
  box += '\n';
  box += `> Match started by <@${match.creatorId}>\n`;
  box += '\n';
  box += `${config.emojis.team1} Team 1 (${progress1})\n`;
  box += t1 + '\n';
  box += '\n';
  box += `${config.emojis.team2} Team 2 (${progress2})\n`;
  box += t2;

  return box;
}

async function buildMatchEmbed(guild, match, creatorUser) {
  const box = await buildMatchBox(guild, match, creatorUser);
  const embed = new EmbedBuilder()
    .setDescription(box)
    .setColor(0xFF6600);
  return embed;
}

async function updateMatchChannel(guild, match) {
  const channel = guild.channels.cache.get(match.channelId2);
  if (!channel) return;
  const list1 = match.team1.length > 0 ? match.team1.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') : 'Empty';
  const list2 = match.team2.length > 0 ? match.team2.map(id => {
    const badge = storage.getRankBadge(id, match.mode || 'amo');
    return badge ? `<@${id}> \`[${badge}]\`` : `<@${id}>`;
  }).join('\n') : 'Empty';
  const embed = new EmbedBuilder()
    .setTitle(`🎮 ${match.teamSize}v${match.teamSize} Match Room`)
    .setColor(0xFF6600)
    .setDescription(`**🏠 Room ID:** \`${match.roomId}\`\n**🔑 Password:** \`${match.password}\``)
    .addFields(
      { name: `🟢 Team 1 (${match.team1.length}/${match.teamSize})`, value: list1, inline: true },
      { name: `🔴 Team 2 (${match.team2.length}/${match.teamSize})`, value: list2, inline: true }
    );
  await channel.messages.fetch({ limit: 20 }).catch(() => {});
  const lastMsg = channel.lastMessage;
  if (lastMsg && lastMsg.author.id === client.user.id && lastMsg.embeds.length) {
    await lastMsg.edit({ embeds: [embed] }).catch(() => {});
  } else {
    await channel.send({ embeds: [embed] }).catch(() => {});
  }
}

async function startFullMatch(guild, match) {
  match.status = 'full';
  manager.persistMatches();

  const { team1Channel, team2Channel } = await manager.createVoiceChannels(guild, match);
  const roomChannel = await manager.createChannel(guild, match);
  await manager.movePlayersToVoice(guild, match, team1Channel, team2Channel);

  const apostado = guild.channels.cache.get(match.channelId);
  if (apostado) {
    const msg2 = await apostado.messages.fetch(match.message).catch(() => null);
    if (msg2) {
      await msg2.edit({
        content: await buildMatchBox(guild, match, null),
        components: []
      }).catch(() => {});
    }

    const ts = Math.floor(Date.now() / 1000);
    await apostado.send({
      content: `${config.emojis.team1} **Match Ready!**\nMoving players to voice channels...\n<t:${ts}:f>`
    }).catch(() => {});
  }

  const privateEmbed = new EmbedBuilder()
    .setTitle(`🎮 Match Room - ${match.teamSize}v${match.teamSize}`)
    .setColor(0x00FF00)
    .setDescription(`**Room ID:** \`${match.roomId}\`\n**Password:** \`${match.password}\`\n\n**Voice channels:**\n🟢 Team 1: <#${team1Channel.id}>\n🔴 Team 2: <#${team2Channel.id}>`)
    .setFooter({ text: 'This room is only visible to match players.' });

  await roomChannel.send({ embeds: [privateEmbed] }).catch(e => console.error('Failed to post room info:', e.message));

  return { team1Channel, team2Channel, roomChannel };
}

function buildMatchButtons(match, userId) {
  const joinTeam1 = new ButtonBuilder()
    .setCustomId(`join1_${match.id}`)
    .setLabel('🟢 Join Team 1')
    .setStyle(ButtonStyle.Success);

  const joinTeam2 = new ButtonBuilder()
    .setCustomId(`join2_${match.id}`)
    .setLabel('🔴 Join Team 2')
    .setStyle(ButtonStyle.Primary);

  const leave = new ButtonBuilder()
    .setCustomId(`leave_${match.id}`)
    .setLabel('🚪 Leave')
    .setStyle(ButtonStyle.Danger);

  const cancel = new ButtonBuilder()
    .setCustomId(`cancel_${match.id}`)
    .setLabel('❌ Cancel Match')
    .setStyle(ButtonStyle.Danger);

  const row1 = new ActionRowBuilder().addComponents(joinTeam1, joinTeam2, leave);

  const components = [row1];

  if (match.creatorId === userId) {
    const cancelRow = new ActionRowBuilder().addComponents(cancel);
    components.push(cancelRow);
  }

  return components;
}

client.once(Events.ClientReady, (c) => {
  console.log(`✅ Logged in as ${c.user.tag}!`);
  c.user.setActivity('Free Fire | !play', { type: 3 });
});

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();
  const lowercase = content.toLowerCase();

  if (lowercase.startsWith('!play') || lowercase.startsWith('!esport')) {
    const isEsport = lowercase.startsWith('!esport');
    const mode = isEsport ? 'esport' : 'amo';
    const modeCfg = getModeConfig(mode);

    if (isEsport) {
      await ensureEsportChannels(message.guild);
    }

    const matchChannelId = getModeConfig(mode).matchChannelId;
    if (message.channel.id !== matchChannelId) {
      return message.reply(`❌ Please use \`${modeCfg.command}\` in the ${modeCfg.displayName} channel <#${matchChannelId}>.`);
    }

    const existing = manager.getMatchByCreator(message.author.id, mode);
    if (existing) {
      return message.reply('❌ You already have a pending match! Cancel it first.');
    }

    await cleanupOldMessages(message.channel);

    const match = manager.createMatch(message.author.id, null, message.channel.id, mode);

    const setupEmbed = new EmbedBuilder()
      .setTitle(`🎮 ${modeCfg.displayName} Match Setup`)
      .setDescription(`<@${message.author.id}>, click **Set Room Config** to enter your match details.`)
      .setColor(0xFF6600)
      .setFooter({ text: 'This message will be replaced once configured.' });

    const setupButton = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`setup_${match.id}`)
        .setLabel('⚙️ Set Room Config')
        .setStyle(ButtonStyle.Primary)
    );

    await message.delete().catch(() => {});
    const msg = await message.channel.send({ embeds: [setupEmbed], components: [setupButton] });
    match.message = msg.id;
    return;
  }

  if (lowercase.startsWith('!forcefull')) {
    if (!message.member.roles.cache.has(config.supervisorRoleId)) {
      return message.reply('❌ Only supervisors can use this!');
    }
    const mode = getModeByChannel(message.channel.id);
    const match = manager.getPendingOrFullMatch(mode === 'esport' ? 'esport' : undefined);
    if (!match) {
      return message.reply('❌ No pending match found.');
    }
    const dummy = message.author.id;
    while (match.team1.length < match.teamSize) match.team1.push(dummy);
    while (match.team2.length < match.teamSize) match.team2.push(dummy);
    manager.persistMatches();
    try {
      await startFullMatch(message.guild, match);
      await message.reply('🔧 **Force-full complete!** Voice channels created and ready message posted.');
    } catch (e) {
      console.error('Force-full error:', e);
      await message.reply(`❌ Force-full failed: ${e.message}`);
    }
    return;
  }
});

async function cleanupOldMessages(channel) {
  try {
    const msgs = await channel.messages.fetch({ limit: 50 });
    const toDelete = msgs.filter(m =>
      m.author.id === client.user.id || m.content.trim().toLowerCase().startsWith('!play')
    );
    if (toDelete.size > 0) {
      await channel.bulkDelete(toDelete).catch(async () => {
        for (const m of toDelete.values()) {
          await m.delete().catch(() => {});
        }
      });
    }
  } catch (e) {
    console.log('Cleanup error:', e.message);
  }
}

client.on(Events.InteractionCreate, async (interaction) => {
  if (interaction.isModalSubmit() && interaction.customId.startsWith('roommodal_')) {
    const matchId = interaction.customId.replace('roommodal_', '');
    console.log(`[MODAL] submit received for match ${matchId}`);
    const match = manager.getMatch(matchId);

    if (!match) {
      console.log('[MODAL] match not found for', matchId);
      return interaction.reply({ content: '⚠️ Match not found.', flags: 64 });
    }
    if (match.creatorId !== interaction.user.id) {
      console.log('[MODAL] wrong user tried to configure match', interaction.user.id);
      return interaction.reply({ content: '❌ Only the match host can set room details.', flags: 64 });
    }

    await interaction.deferReply({ flags: 64 });
    console.log('[MODAL] deferred reply OK');

    const teamSizeInput = interaction.fields.getTextInputValue('teamSizeInput').trim();
    const roomId = interaction.fields.getTextInputValue('roomIdInput').trim();
    const password = interaction.fields.getTextInputValue('passwordInput').trim();

    const sizeMap = { '2': 2, '3': 3, '4': 4 };
    const teamSize = sizeMap[teamSizeInput];
    if (!teamSize) {
      console.log('[MODAL] invalid team size', teamSizeInput);
      return interaction.editReply({ content: '❌ Team size must be 2, 3, or 4!' });
    }

    match.teamSize = teamSize;
    match.roomId = roomId;
    match.password = password;
    match.team1.push(interaction.user.id);
    console.log(`[MODAL] teamSize=${teamSize} roomId=${roomId} pass=${password} creator auto-joined T1`);

    try {
      const matchBox = await buildMatchBox(interaction.guild, match, interaction.user);
      const components = buildMatchButtons(match, interaction.user.id);

      const channel = interaction.guild.channels.cache.get(match.channelId);
      console.log('[MODAL] apostado channel found:', !!channel);
      const oldMsg = await channel.messages.fetch(match.message).catch(() => null);
      if (oldMsg) await oldMsg.delete().catch(() => {});

      const newMsg = await channel.send({ content: matchBox, components });
      match.message = newMsg.id;
      manager.persistMatches();
      console.log('[MODAL] match box sent successfully, new msg id:', newMsg.id);

      await interaction.editReply({ content: `✅ Match created! You are on 🔴 Team 1.` }).catch(() => {});
    } catch (e) {
      console.error('Error creating match:', e);
      await interaction.editReply({ content: `❌ Error creating match: ${e.message}.` }).catch(() => {});
    }
  }

  if (interaction.isButton()) {
    const separator = interaction.customId.indexOf('_');
    if (separator === -1) return interaction.reply({ content: '⚠️ Invalid interaction.', ephemeral: true });
    const action = interaction.customId.slice(0, separator);
    const matchId = interaction.customId.slice(separator + 1);
    const match = manager.getMatch(matchId);
    if (!match) return interaction.reply({ content: '⚠️ This match no longer exists.', ephemeral: true });

    if (action === 'setup' || action === 'room') {
      if (match.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only the match host can set room details.', ephemeral: true });
      }

      const roomModal = new ModalBuilder()
        .setCustomId(`roommodal_${match.id}`)
        .setTitle('🏠 Enter Room Config');

      const teamSizeInput = new TextInputBuilder()
        .setCustomId('teamSizeInput')
        .setLabel('Team Size (2, 3, or 4)')
        .setPlaceholder('e.g. 4')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const roomIdInput = new TextInputBuilder()
        .setCustomId('roomIdInput')
        .setLabel('Room ID')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const passwordInput = new TextInputBuilder()
        .setCustomId('passwordInput')
        .setLabel('Room Password')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      const row1 = new ActionRowBuilder().addComponents(teamSizeInput);
      const row2 = new ActionRowBuilder().addComponents(roomIdInput);
      const row3 = new ActionRowBuilder().addComponents(passwordInput);

      roomModal.addComponents(row1, row2, row3);

      return interaction.showModal(roomModal);
    }

    if (action === 'join1' || action === 'join2') {
      const team = action === 'join1' ? 1 : 2;
      const result = manager.joinTeam(matchId, interaction.user.id, team);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        await msg.edit({
          content: await buildMatchBox(interaction.guild, match, interaction.user),
          components: buildMatchButtons(match, interaction.user.id)
        });
      }

      await interaction.reply({ content: `✅ Joined Team ${team}!`, ephemeral: true });
      await updateMatchChannel(interaction.guild, match);

      if (manager.isTeamsFull(matchId)) {
        try {
          await startFullMatch(interaction.guild, match);
          await interaction.channel.send({ content: `🎮 **Match ready!** Players moved to voice channels.` }).catch(() => {});
        } catch (e) {
          console.error('Error starting match:', e);
          await interaction.channel.send({ content: `❌ Error starting match: ${e.message}. Make sure the bot can manage channels.` }).catch(() => {});
        }
      }
    }

    if (action === 'leave') {
      const result = manager.leaveMatch(matchId, interaction.user.id);
      if (!result.success) {
        return interaction.reply({ content: `❌ ${result.error}`, ephemeral: true });
      }

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        await msg.edit({
          content: await buildMatchBox(interaction.guild, match, interaction.user),
          components: buildMatchButtons(match, interaction.user.id)
        });
      }

      await interaction.reply({ content: '🚪 You left the match!', ephemeral: true });
      await updateMatchChannel(interaction.guild, match);
    }

    if (action === 'cancel') {
      if (match.creatorId !== interaction.user.id) {
        return interaction.reply({ content: '❌ Only the match host can cancel the match!', ephemeral: true });
      }

      await manager.deleteVoiceChannels(interaction.guild, match);
      await manager.deleteChannel(interaction.guild, match);
      manager.removeMatch(matchId);

      const msg = await interaction.channel.messages.fetch(match.message).catch(() => null);
      if (msg) {
        const cancelledEmbed = new EmbedBuilder()
          .setTitle('❌ Match Cancelled')
          .setColor(0xFF0000)
          .setDescription(`Match by <@${match.creatorId}> has been cancelled.`);
        await msg.edit({ embeds: [cancelledEmbed], components: [] });
      }

      await interaction.reply({ content: '❌ Match cancelled!', ephemeral: true });
    }
  }
});

const adminCommands = {
  leaderboard: async (message, mode = 'amo') => {
    const sorted = storage.getLeaderboard(mode);
    if (sorted.length === 0) {
      return message.reply('📊 No matches played yet!');
    }

    const embed = new EmbedBuilder()
      .setTitle(`🏆 ${getModeConfig(mode).displayName} Leaderboard`)
      .setColor(0xFFD700)
      .setDescription(sorted.map(([id, data], i) => {
        const rank = i + 1;
        const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        return `${medal} <@${id}> - **${data.totalPoints} pts** (${data.wins}W/${data.losses}L)`;
      }).join('\n'));

    await message.reply({ embeds: [embed] });
  },
  resetpoints: async (message, mode = 'amo') => {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Only admins can reset points!');
    }
    storage.resetAllPoints(mode);
    await message.reply(`🔄 All ${getModeConfig(mode).displayName} points have been reset!`);
  },
  setpoints: async (message, mode = 'amo') => {
    if (!message.member.permissions.has('Administrator')) {
      return message.reply('❌ Only admins can adjust points!');
    }
    const args = message.content.split(/\s+/);
    if (args.length < 4) return message.reply('Usage: `!setpoints @user points type (win/loss)`');

    const user = message.mentions.users.first();
    if (!user) return message.reply('❌ Please mention a user!');

    const points = parseInt(args[2]);
    if (isNaN(points)) return message.reply('❌ Invalid points value!');

    const type = (args[3] || 'win').toLowerCase() === 'loss' ? 'loss' : 'win';
    const result = storage.addPoints(user.id, points, type, mode);
    await message.reply(`✅ Added **${points}** points to <@${user.id}>. Total: **${result.totalPoints}**`);
  }
};

client.on(Events.MessageCreate, async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim().toLowerCase();
  const mode = getModeByChannel(message.channel.id);

  if (content.startsWith('&clear')) {
    const target = message.member;
    const isAdmin = target.permissions.has('Administrator');
    const hasRole = config.supervisorRoleId && target.roles.cache.has(config.supervisorRoleId);
    if (!isAdmin && !hasRole) {
      return message.reply('❌ Only supervisors/admins can use this!');
    }
    const args = message.content.trim().split(/\s+/);
    const count = parseInt(args[1]);
    if (!count || isNaN(count) || count < 1 || count > 100) {
      return message.reply('Usage: `&clear <number>` (1-100)');
    }
    try {
      const fetched = await message.channel.messages.fetch({ limit: count });
      await message.delete().catch(() => {});
      await message.channel.bulkDelete(fetched).catch(async () => {
        for (const m of fetched.values()) {
          await m.delete().catch(() => {});
        }
      });
    } catch (e) {
      console.log('Clear error:', e.message);
    }
    return;
  }

  if (content === '!leaderboard') {
    await adminCommands.leaderboard(message, mode);
  } else if (content === '!resetpoints') {
    await adminCommands.resetpoints(message, mode);
  } else if (content.startsWith('!setpoints')) {
    await adminCommands.setpoints(message, mode);
  } else if (content === '!clearmatches' || content === '!cleargames') {
    const isAdmin = message.member.permissions.has('Administrator');
    const hasRole = config.supervisorRoleId && message.member.roles.cache.has(config.supervisorRoleId);
    if (!isAdmin && !hasRole) {
      return message.reply('❌ Only supervisors/admins can clear stuck matches!');
    }
    const cleared = manager.clearAllMatches();
    await message.reply(`🧹 Cleared **${cleared}** stuck match(es)!`);
  } else if (content.startsWith('!cancelgame')) {
    const isAdmin = message.member.permissions.has('Administrator');
    const hasRole = config.supervisorRoleId && message.member.roles.cache.has(config.supervisorRoleId);
    if (!isAdmin && !hasRole) {
      return message.reply('❌ Only supervisors/admins can cancel a match!');
    }
    const target = message.mentions.users.first();
    if (!target) return message.reply('Usage: `!cancelgame @user`');
    const existing = manager.getAllMatches().find(m => m.creatorId === target.id && m.mode === mode);
    if (!existing) return message.reply('❌ No active match found for that user.');
    await manager.deleteVoiceChannels(message.guild, existing);
    await manager.deleteChannel(message.guild, existing);
    manager.removeMatch(existing.id);
    await message.reply(`❌ Cancelled <@${target.id}>'s match!`);
  } else if (content === '!resetvote') {
    const isAdmin = message.member.permissions.has('Administrator');
    const hasRole = config.supervisorRoleId && message.member.roles.cache.has(config.supervisorRoleId);
    if (!isAdmin && !hasRole) {
      return message.reply('❌ Only supervisors/admins can reset votes!');
    }
    const match = manager.getAllMatches().find(m =>
      m.creatorId === message.author.id &&
      (m.status === 'full' || m.status === 'waiting')
    );
    if (!match) return message.reply('❌ No active match found.');
    const resetMode = match.mode || mode;

    let refunded = [];
    if (match.winnerId) {
      storage.removePoints(match.winnerId, WINNER_POINTS, 'win', resetMode);
      refunded.push(`🏆 <@${match.winnerId}> (${WINNER_POINTS} pts refunded)`);
    }
    if (match.loserId) {
      storage.removePoints(match.loserId, LOSER_POINTS, 'loss', resetMode);
      refunded.push(`💪 <@${match.loserId}> (${LOSER_POINTS} pts refunded)`);
    }
    match.winnerId = null;
    match.loserId = null;
    manager.persistMatches();

    if (refunded.length === 0) {
      await message.reply('✅ Votes were already clear. Re-vote with `!w @player` / `!l @player`.');
    } else {
      await message.reply(`♻️ **Votes reset & points refunded!**\n${refunded.join('\n')}\n\nRe-vote with \`!w @player\` / \`!l @player\`.`);
    }
  } else if (content.startsWith('!w') || content.startsWith('!l')) {
    const isWin = content.startsWith('!w');
    const target = message.mentions.users.first();
    if (!target) {
      return message.reply(`Usage: \`${isWin ? '!w' : '!l'} @player\``);
    }

    const doneMatch = manager.getAllMatches().find(m =>
      m.creatorId === message.author.id &&
      (m.status === 'full' || m.status === 'waiting')
    );
    if (!doneMatch) {
      const available = manager.getAllMatches().map(mm => ({
        id: mm.id, mode: mm.mode, status: mm.status, creator: mm.creatorId
      }));
      console.log('[VOTE] no matching doneMatch. available=', JSON.stringify(available));
      return;
    }
    const voteMode = doneMatch.mode || mode;
    console.log('[VOTE] found doneMatch', doneMatch.id, 'status', doneMatch.status, 'mode', doneMatch.mode);

    const points = isWin ? WINNER_POINTS : LOSER_POINTS;
    const result = storage.addPoints(target.id, points, isWin ? 'win' : 'loss', voteMode);

    const embed = new EmbedBuilder()
      .setTitle(isWin ? '🏆 MVP Winner!' : '💪 MVP Loser!')
      .setColor(isWin ? 0xFFD700 : 0xFF6600)
      .setDescription(`<@${target.id}> earned **${points} points**!`)
      .setFooter({ text: `Total: ${result.totalPoints} pts | ${result.wins}W/${result.losses}L` });

    await message.channel.send({ embeds: [embed] });

    if (isWin) doneMatch.winnerId = target.id;
    else doneMatch.loserId = target.id;
    manager.persistMatches();

    if (doneMatch.winnerId && doneMatch.loserId) {
      const logEmbed = new EmbedBuilder()
        .setTitle(`📜 Match Log - ${doneMatch.teamSize}v${doneMatch.teamSize}`)
        .setColor(0x00FF00)
        .setDescription(`**Match finished** — MVP votes submitted.`)
        .addFields(
          { name: '🏆 Winner', value: `<@${doneMatch.winnerId}>`, inline: true },
          { name: '💪 Loser', value: `<@${doneMatch.loserId}>`, inline: true }
        )
        .setFooter({ text: 'Players returned to their channels. Match cleaned up.' });
      await message.channel.send({ embeds: [logEmbed] }).catch(() => {});

      manager.logMatch({
        id: doneMatch.id,
        timestamp: Date.now(),
        teamSize: doneMatch.teamSize,
        roomId: doneMatch.roomId,
        password: doneMatch.password,
        team1: doneMatch.team1,
        team2: doneMatch.team2,
        winnerId: doneMatch.winnerId,
        loserId: doneMatch.loserId
      });

      await manager.finishMatch(message.guild, doneMatch);
    } else {
      const pending = isWin ? '💪 **!l** loser' : '🏆 **!w** winner';
      await message.channel.send({ content: `⏳ Waiting for the ${pending} vote before finishing the match.`, }).catch(() => {});
    }
  }
});

client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  const leftVoice = oldState.channelId && !newState.channelId;
  if (!leftVoice) return;
  if (manager.isSuppressed(oldState.member.id)) return;
  const match = manager.getActiveMatchForPlayer(oldState.member.id);
  if (!match) return;
  const leftTeamChannel = match.voiceChannels.includes(oldState.channelId);
  if (!leftTeamChannel) return;

  oldState.member.send('⚠️ **You left the match voice channel!** Please come back to your team voice channel. The match is still in progress.').catch(() => {});
});

client.login(config.token);

