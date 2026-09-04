const { Client, GatewayIntentBits } = require('discord.js');
const config = require('./config.json');

const CHANNEL_ID = '1545413924483113040';

const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const emoji = '<:emoji_1:1453512185807634473>';

const msg = `${emoji} **البوت شغال ومستعد!** ${emoji}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🎮 **@everyone The bot is officially LIVE and ready to go!**

Now you can **play matches, earn points, and climb the leaderboard!**
🎯 Win = 80 points  |  💪 Loss = 30 points

The more you play, the more you earn!
🏆 Top MVP players will win **500 Diamonds + exclusive Roles!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${emoji} **@everyone البوت شغال و日正式!**

الحين تقدر **تلعب ماتشات، تجمع نقاط، وتتصدر لوحة المتصدرين!**
🎯 فوز = 80 نقطة  |  💪 خسارة = 30 نقطة

كل ما تلعب أكثر، تجمع أكثر!
🏆 أكثر شخص نقاط رح يكسب **500 جوهرة + رولات حصرية!**

━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚡ **!play** للعب كاستjom روم  |  **!esport** للعب اسبرتس
📊 **!leaderboard** عرض الترتيب

🚀 **يلا نبدأ! GO PLAY!**`;

client.once('ready', async (c) => {
  console.log('Logged in as ' + c.user.tag);
  const channel = client.channels.cache.get(CHANNEL_ID);
  if (!channel) { console.log('Channel not found'); process.exit(1); }
  try {
    await channel.send(msg);
    console.log('Sent!');
  } catch (e) { console.log('Error: ' + e.message); }
  process.exit(0);
});

client.login(config.token);
