const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('emoji')
        .setDescription('Lists all server emojis with their bot format IDs.'),

    async execute(interaction, client) {
        const guild = interaction.guild;
        const emojis = guild.emojis.cache;

        if (emojis.size === 0) {
            return interaction.reply({ content: 'This server has no custom emojis.', flags: 64 });
        }

        // Split into chunks if there are too many emojis for one embed
        const emojiList = emojis.map(e => {
            const animated = e.animated ? 'a' : '';
            const format = `<${animated}:${e.name}:${e.id}>`;
            return `${e} \`${format}\` — **${e.name}**`;
        });

        // Discord embed description limit is 4096 chars, split if needed
        const chunks = [];
        let current = '';
        for (const line of emojiList) {
            if ((current + '\n' + line).length > 3900) {
                chunks.push(current);
                current = line;
            } else {
                current += (current ? '\n' : '') + line;
            }
        }
        if (current) chunks.push(current);

        let deferred = false;
        try {
            await interaction.deferReply({ flags: 64 });
            deferred = true;
        } catch (e) {
            // Interaction already replied/deferred, will use reply/followUp instead
        }

        for (let i = 0; i < chunks.length; i++) {
            const embed = new EmbedBuilder()
                .setTitle(i === 0 ? `Server Emojis (${emojis.size} total)` : `Server Emojis (cont.)`)
                .setDescription(chunks[i])
                .setColor('#5865F2');

            if (i === 0) {
                if (deferred) {
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    await interaction.reply({ embeds: [embed], flags: 64 });
                }
            } else {
                await interaction.followUp({ embeds: [embed], flags: 64 });
            }
        }
    },
};
