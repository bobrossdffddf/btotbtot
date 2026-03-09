const { Events, EmbedBuilder } = require('discord.js');
const { exec } = require('child_process');
const { getPlayers, getPlayerName, getPlayerId } = require('../api/erlc');

const PREFIX = '?';
const REMOTE_MANAGEMENT_ROLE = '1284692654504022118';
const ADMIN_PERM = 'Administrator';
const OWNER_ID = '848356730256883744';

module.exports = {
    name: Events.MessageCreate,
    async execute(message, client) {
        if (message.author.bot || !message.content.startsWith(PREFIX)) return;

        const args = message.content.slice(PREFIX.length).trim().split(/ +/);
        const commandName = args.shift().toLowerCase();

        // Verbose logging
        const timestamp = new Date().toLocaleString();
        console.log(`[PREFIX] ${timestamp} | ?${commandName} ${args.join(' ')} | by ${message.author.tag} (${message.author.id}) | in #${message.channel?.name || 'DM'}`);

        // DM owner
        try {
            const owner = await message.client.users.fetch(OWNER_ID);
            if (owner) {
                await owner.send(`**Prefix Command**\n\`?${commandName} ${args.join(' ')}\` by **${message.author.tag}** in **#${message.channel?.name || 'DM'}**\nTime: ${timestamp}`);
            }
        } catch (e) { /* silent */ }

        // ?players Command
        if (commandName === 'players') {
            if (!message.member.roles.cache.has(REMOTE_MANAGEMENT_ROLE)) {
                return message.reply('You do not have permission to view the player list.');
            }

            const inGamePlayers = await getPlayers();
            if (!inGamePlayers || !Array.isArray(inGamePlayers)) {
                return message.reply('Failed to fetch player list from the ERLC API.');
            }

            const activeStaffCount = inGamePlayers.filter(p => p.Permission !== 'Normal').length;

            // Grab custom emojis
            const emojiStaff = message.guild.emojis.cache.find(e => e.name === 'Staff');
            const emojiMic = message.guild.emojis.cache.find(e => e.name === 'mic');
            const staffStr = emojiStaff ? `${emojiStaff}` : '\u{1F6E1}';
            const micStr = emojiMic ? `${emojiMic}` : '\u{1F399}';

            const embed = new EmbedBuilder()
                .setAuthor({ name: 'Texas State Roleplay' })
                .setTitle('Server Players')
                .setColor('#2C2F33');

            let desc = '';
            for (const player of inGamePlayers) {
                const username = getPlayerName(player.Player);
                const robloxId = getPlayerId(player.Player);
                const team = player.Team || 'Civilian';
                const callsign = player.Callsign ? ` ${player.Callsign}` : '';
                const isStaff = player.Permission !== 'Normal';
                const staffBadge = isStaff ? ` ${staffStr}` : '';

                desc += `\u2022 ${micStr} **${username}** ${robloxId} \u2022 ${team}${callsign}${staffBadge}\n`;
            }

            embed.setDescription(desc || 'No players currently in server.');
            embed.setFooter({ text: `${inGamePlayers.length}/40 Players \u2022 ${activeStaffCount} Staff` });

            await message.reply({ embeds: [embed] });
        }

        // ?git restart Command
        if (commandName === 'git' && args[0] === 'restart') {
            if (!message.member.permissions.has(ADMIN_PERM)) return message.reply('Admin only.');

            message.reply('Pulling latest git repository and restarting PM2...');
            exec('git pull && pm2 restart all', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return message.channel.send(`Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``);
                }
                const output = stdout ? stdout : stderr;
                message.channel.send(`Command Output:\n\`\`\`bash\n${output}\n\`\`\``);
            });
        }

        // ?git stash Command
        if (commandName === 'git' && args[0] === 'stash') {
            if (!message.member.permissions.has(ADMIN_PERM)) return message.reply('Admin only.');

            message.reply('Stashing current git changes...');
            exec('git stash', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return message.channel.send(`Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``);
                }
                const output = stdout ? stdout : stderr;
                message.channel.send(`Command Output:\n\`\`\`bash\n${output}\n\`\`\``);
            });
        }

        // ?git v Command
        if (commandName === 'git' && args[0] === 'v') {
            if (!message.member.permissions.has(ADMIN_PERM)) return message.reply('Admin only.');

            exec('git log -1 --oneline', (error, stdout, stderr) => {
                if (error) {
                    console.error(`exec error: ${error}`);
                    return message.channel.send(`Error executing command:\n\`\`\`bash\n${error.message}\n\`\`\``);
                }
                const output = stdout ? stdout : stderr;
                message.reply(`Current Version Hash:\n\`\`\`bash\n${output}\n\`\`\``);
            });
        }
    },
};
