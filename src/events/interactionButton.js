const { Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, client) {
        if (!interaction.isButton()) return;

        const ssuVoteCommand = client.commands.get('ssu_vote');
        if (!ssuVoteCommand || !ssuVoteCommand.activeVotes) return;

        const activeVotes = ssuVoteCommand.activeVotes;
        const voteData = activeVotes.get(interaction.message.id);

        if (!voteData) return;

        if (interaction.customId === 'vote_btn') {
            // Toggle vote — if already voted, remove it
            if (voteData.voters.has(interaction.user.id)) {
                voteData.voters.delete(interaction.user.id);
                console.log(`[Vote] ${interaction.user.tag} removed their vote (${voteData.voters.size}/${voteData.targetVotes})`);
            } else {
                voteData.voters.add(interaction.user.id);
                console.log(`[Vote] ${interaction.user.tag} voted (${voteData.voters.size}/${voteData.targetVotes})`);
            }

            // Rebuild progress bar
            const progressBar = ssuVoteCommand.buildProgressBar(voteData.voters.size, voteData.targetVotes, interaction.guild);

            const newLabel = `Vote (${voteData.voters.size}/${voteData.targetVotes})`;
            const voteBtn = new ButtonBuilder()
                .setCustomId('vote_btn')
                .setLabel(newLabel)
                .setStyle(ButtonStyle.Success);

            const viewVotesBtn = new ButtonBuilder()
                .setCustomId('view_votes_btn')
                .setLabel('View Votes')
                .setStyle(ButtonStyle.Primary);

            // Update embed with new progress
            const embed = new EmbedBuilder()
                .setTitle('Session Poll')
                .setDescription(`We have now initiated a session vote. Please react below if you're willing to attend today's session. We require **${voteData.targetVotes}** votes to start a session.\n\n${progressBar}`)
                .setColor('#5865F2')
                .setImage('https://i.postimg.cc/qvdpPzw1/Session-Vote-Banner.webp');

            // Check if goal reached
            if (voteData.voters.size >= voteData.targetVotes) {
                voteBtn.setDisabled(true);
                voteBtn.setLabel(`Goal Reached! (${voteData.voters.size}/${voteData.targetVotes})`);

                // DM initiator
                try {
                    const initiator = await client.users.fetch(voteData.initiatorId);
                    if (initiator) {
                        await initiator.send(`Your SSU Vote in **${interaction.guild.name}** has reached its goal of **${voteData.targetVotes}** votes!`);
                    }
                } catch (e) {
                    console.log('[Vote] Could not DM initiator.');
                }

                activeVotes.delete(interaction.message.id);
            }

            const row = new ActionRowBuilder().addComponents(voteBtn, viewVotesBtn);
            await interaction.update({ embeds: [embed], components: [row] });

        } else if (interaction.customId === 'view_votes_btn') {
            const voterIds = Array.from(voteData.voters);

            // Build blue-line styled embed
            const emojiBLine = interaction.guild.emojis.cache.find(e => e.name === 'BLine');
            const bLine = emojiBLine ? `${emojiBLine}`.repeat(10) : '';

            if (voterIds.length === 0) {
                const embed = new EmbedBuilder()
                    .setTitle('Session Votes')
                    .setDescription(`No one has voted yet.${bLine ? '\n\n' + bLine : ''}`)
                    .setColor('#5865F2');
                return interaction.reply({ embeds: [embed], flags: 64 });
            }

            const mentions = voterIds.map(id => `<@${id}>`).join('\n');
            const embed = new EmbedBuilder()
                .setTitle('Session Votes')
                .setDescription(`These are the people who voted. You can remove your vote by clicking Vote again.\n\n${mentions}${bLine ? '\n\n' + bLine : ''}`)
                .setColor('#5865F2');

            await interaction.reply({ embeds: [embed], flags: 64 });
        }
    },
};
