const { SlashCommandBuilder } = require('discord.js');
const { runCommand } = require('../api/erlc');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('erlc')
        .setDescription('Execute an in-game ERLC command.')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to run (e.g. m Hello Server!)')
                .setRequired(true)),

    async execute(interaction, client) {

        const cmd = interaction.options.getString('command');

        // Ensure command starts with a colon if the user forgot it, though PRC uses colon for all commands. Let's let the user type whatever like `m Hello` or `:m Hello` just in case. They usually type it without the colon if it's like a discord input but let's assume they know how PRC commands work.
        const prcCmd = cmd.startsWith(':') ? cmd : `:${cmd}`;

        await interaction.deferReply({ flags: 0 });

        const result = await runCommand(prcCmd);

        if (result) {
            await interaction.editReply(`Executed \`${prcCmd}\` in the server successfully.`);
        } else {
            await interaction.editReply(`Failed to execute \`${prcCmd}\`. Please check the bot console or API key.`);
        }
    },
};
