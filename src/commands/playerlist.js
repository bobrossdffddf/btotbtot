const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const { getPlayers, getPlayerName, getPlayerId } = require('../api/erlc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playerlist')
        .setDescription('Admin ONLY: View the current server player list with VC and Discord status.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, client) {
        try {
            await interaction.deferReply({ flags: 64 });
        } catch (e) {
            console.error('Failed to defer reply:', e.message);
            return;
        }

        const inGamePlayers = await getPlayers();
        if (!inGamePlayers || !Array.isArray(inGamePlayers)) {
            return interaction.editReply('Failed to fetch player list from the ERLC API.');
        }

        const guild = interaction.guild;
        const staffCount = inGamePlayers.filter(p => p.Permission !== 'Normal').length;

        // Grab custom emojis from the server by name
        const emojiStaff = guild.emojis.cache.find(e => e.name === 'Staff');
        const emojiDiscord = guild.emojis.cache.find(e => e.name === 'Discord');
        const emojiMic = guild.emojis.cache.find(e => e.name === 'mic');
        const emojiBLine = guild.emojis.cache.find(e => e.name === 'BLine');

        const staffStr = emojiStaff ? `${emojiStaff}` : '🛡️';
        const discordStr = emojiDiscord ? `${emojiDiscord}` : '💬';
        const micStr = emojiMic ? `${emojiMic}` : '🎙️';
        const bLineStr = emojiBLine ? `${emojiBLine}` : '';

        let lines = [];
        let notInVCCount = 0;
        let notInDiscordCount = 0;

        for (const player of inGamePlayers) {
            const username = getPlayerName(player.Player);
            const robloxId = getPlayerId(player.Player);
            const team = player.Team || 'Civilian';
            const callsign = player.Callsign ? ` ${player.Callsign}` : '';
            const isStaff = player.Permission !== 'Normal';

            // Check Discord presence
            const normalized = username.toLowerCase();
            const member = guild.members.cache.find(m => {
                const nick = (m.nickname || '').toLowerCase();
                const globalName = (m.user.globalName || '').toLowerCase();
                const uname = (m.user.username || '').toLowerCase();
                return nick.includes(normalized) || globalName.includes(normalized) || uname.includes(normalized);
            });

            // Build status icons
            let icons = '';
            if (!member) {
                notInDiscordCount++;
                // No icons if they're not in Discord
            } else {
                if (member.voice.channelId) {
                    icons = micStr;
                } else {
                    notInVCCount++;
                    icons = discordStr;
                }
            }

            const staffBadge = isStaff ? ` ${staffStr}` : '';
            const line = `\u2022 ${icons ? icons + ' ' : ''}**${username}** ${robloxId} \u2022 ${team}${callsign}${staffBadge}`;
            lines.push(line);
        }

        const embed = new EmbedBuilder()
            .setAuthor({ name: 'Texas State Roleplay' })
            .setTitle('Server Players')
            .setColor('#2C2F33')
            .setDescription(lines.join('\n') || 'No players currently in server.')
            .setFooter({ text: `${inGamePlayers.length}/40 Players \u2022 ${staffCount} Staff` })
            .setTimestamp();

        // Status summary at bottom
        const summaryParts = [];
        summaryParts.push(`${micStr} In VC  ${bLineStr ? bLineStr + ' ' : '\u2022 '}${discordStr} In Discord only`);
        summaryParts.push(`**Not in VC:** ${notInVCCount}  ${bLineStr ? bLineStr + ' ' : '\u2022 '}**Not in Discord:** ${notInDiscordCount}`);
        embed.addFields({ name: '\u200b', value: summaryParts.join('\n') });

        await interaction.editReply({ embeds: [embed] });
    },
};
