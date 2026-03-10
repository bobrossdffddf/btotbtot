const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('hardcode')
        .setDescription('Add a bypass for a Roblox user so they won\'t be jailed or warned')
        .addStringOption(option =>
            option.setName('identifier')
                .setDescription('Roblox username or ID')
                .setRequired(true)),

    async execute(interaction, client) {
        const identifier = interaction.options.getString('identifier');
        
        // Get existing bypasses
        const bypasses = client.settings.get(interaction.guild.id, 'hardcodeBypasses') || [];
        
        if (bypasses.includes(identifier)) {
            return interaction.reply({ content: `\`${identifier}\` is already in the bypass list.`, flags: 64 });
        }
        
        bypasses.push(identifier);
        client.settings.set(interaction.guild.id, bypasses, 'hardcodeBypasses');
        
        await interaction.reply({ content: `Successfully added \`${identifier}\` to the hardcode bypass list.`, flags: 64 });
    },
};