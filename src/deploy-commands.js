const { REST, Routes } = require('discord.js');
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getLeoGuildIds, getMainGuildId } = require('./utils/guildConfig');

const commandsPath = path.join(__dirname, 'commands');
const loadedCommands = [];

if (fs.existsSync(commandsPath)) {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    for (const file of commandFiles) {
        const command = require(`./commands/${file}`);
        if ('data' in command && 'execute' in command) {
            loadedCommands.push(command);
        } else {
            console.log(`[WARNING] The command at ${file} is missing a required "data" or "execute" property.`);
        }
    }
}

const byName = new Map(loadedCommands.map(command => [command.data.name, command]));
const commonCommands = loadedCommands
    .filter(command => !['setup', 'citation'].includes(command.data.name))
    .map(command => command.data.toJSON());

const setupCommand = byName.get('setup');
const citationCommand = byName.get('citation');

const buildLeoCommands = () => {
    const commands = [...commonCommands];

    if (setupCommand) commands.push(setupCommand.data.toJSON());

    if (citationCommand && typeof citationCommand.buildCitationData === 'function') {
        commands.push(citationCommand.buildCitationData({ includeCreate: true, includeLookup: false }).toJSON());
    }

    return commands;
};

const buildMainCommands = () => {
    const commands = [...commonCommands];

    if (citationCommand && typeof citationCommand.buildCitationData === 'function') {
        commands.push(citationCommand.buildCitationData({ includeCreate: false, includeLookup: true }).toJSON());
    }

    return commands;
};

const rest = new REST().setToken(process.env.TOKEN);

(async () => {
    try {
        const leoGuildIds = getLeoGuildIds();
        const mainGuildId = getMainGuildId();

        if (leoGuildIds.length === 0 && !mainGuildId) {
            throw new Error('No guild targets configured. Set MAIN_GUILD_ID and/or LEO_GUILD_IDS (or LEO_GUILD_1, LEO_GUILD_2, ...).');
        }

        for (const leoGuildId of leoGuildIds) {
            const leoCommands = buildLeoCommands();
            console.log(`Refreshing ${leoCommands.length} commands for LEO guild ${leoGuildId}...`);

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, leoGuildId),
                { body: leoCommands }
            );

            console.log(`Successfully reloaded commands for LEO guild ${leoGuildId}.`);
        }

        if (mainGuildId) {
            const mainCommands = buildMainCommands();
            console.log(`Refreshing ${mainCommands.length} commands for main guild ${mainGuildId}...`);

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, mainGuildId),
                { body: mainCommands }
            );

            console.log(`Successfully reloaded commands for main guild ${mainGuildId}.`);
        }

        console.log('Guild-specific command deployment completed.');
    } catch (error) {
        console.error(error);
    }
})();
