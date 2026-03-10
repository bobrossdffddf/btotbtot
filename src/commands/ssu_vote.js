const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

// Map to store active votes. Key: messageId, Value: { targetVotes, voters (Set), initiatorId }
const activeVotes = new Map();

/**
 * Builds a progress bar using the :BLine: emoji (falls back to blue square)
 */
function buildProgressBar(current, total, guild) {
    const emojiBLine = guild.emojis.cache.find(e => e.name === 'BLine');
    const fillChar = emojiBLine ? `${emojiBLine}` : '🟦';
    const emptyChar = '⬛';
    const barLength = 10;
    const filled = Math.round((current / total) * barLength);
    const empty = barLength - filled;
    return fillChar.repeat(filled) + emptyChar.repeat(empty);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ssu_vote')
        .setDescription('Start a vote for an SSU.')
        .addIntegerOption(option =>
            option.setName('votes_needed')
                .setDescription('Number of votes required to pass (default 5).')
                .setRequired(false)),

    async execute(interaction, client) {
        const guildId = interaction.guild.id;
        const settings = client.settings.get(guildId);

        if (!settings || !settings.ssuChannelId) {
            return interaction.reply({ content: 'Please configure the bot with `/setup` first.', flags: 64 });
        }

        const ssuChannel = client.channels.cache.get(settings.ssuChannelId);
        if (!ssuChannel) {
            return interaction.reply({ content: 'The configured SSU channel could not be found.', flags: 64 });
        }

        const targetVotes = interaction.options.getInteger('votes_needed') || 5;
        const pingRole = settings.pingRoleId ? `<@&${settings.pingRoleId}>` : '@here';
        const initiator = interaction.user;

        const progressBar = buildProgressBar(0, targetVotes, interaction.guild);

        const embed = new EmbedBuilder()
            .setTitle('Session Poll')
            .setDescription(`We have now initiated a session vote. Please react below if you're willing to attend today's session. We require **${targetVotes}** votes to start a session.\n\n${progressBar}`)
            .setColor('#5865F2')
            .setImage('https://i.postimg.cc/qvdpPzw1/Session-Vote-Banner.webp');

        const voteBtn = new ButtonBuilder()
            .setCustomId('vote_btn')
            .setLabel(`Vote (0/${targetVotes})`)
            .setStyle(ButtonStyle.Success);

        const viewVotesBtn = new ButtonBuilder()
            .setCustomId('view_votes_btn')
            .setLabel('View Votes')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder().addComponents(voteBtn, viewVotesBtn);

        try {
            await interaction.reply({ content: 'Starting vote...', flags: 64 });
            const message = await ssuChannel.send({ content: pingRole, embeds: [embed], components: [row] });

            activeVotes.set(message.id, {
                targetVotes: targetVotes,
                voters: new Set(),
                initiatorId: initiator.id
            });
        } catch (e) {
            console.error('[SSU Vote] Error:', e.message);
            await interaction.followUp({ content: 'Failed to start vote.', flags: 64 });
        }
    },

    activeVotes,
    buildProgressBar
};
