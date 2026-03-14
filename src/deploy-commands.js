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
            console.log(`[WARNING] The command at ${file} is missing "data" or "execute".`);
        }
    }
}

const byName = new Map(loadedCommands.map(command => [command.data.name, command]));
const citationCommand = byName.get('citation');
const setupCommand = byName.get('setup');

// LEO guilds: only /citation (create + lookup) and /setup (admin-only, hidden from regular members).
// No ERLC, SSU, SSD, playerlist, or any other commands.
const buildLeoCommands = () => {
    const commands = [];

    if (citationCommand && typeof citationCommand.buildCitationData === 'function') {
        commands.push(citationCommand.buildCitationData({ includeCreate: true, includeLookup: true }).toJSON());
    }

    if (setupCommand) commands.push(setupCommand.data.toJSON());

    return commands;
};

// Main guild: only /citation lookup.
const buildMainCommands = () => {
    const commands = [];

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
            throw new Error('No guild targets configured. Set MAIN_GUILD_ID and/or LEO_GUILD_IDS.');
        }

        for (const leoGuildId of leoGuildIds) {
            const leoCommands = buildLeoCommands();
            console.log(`Deploying ${leoCommands.length} commands to LEO guild ${leoGuildId}: ${leoCommands.map(c => c.name).join(', ')}`);

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, leoGuildId),
                { body: leoCommands }
            );

            console.log(`Done: LEO guild ${leoGuildId}`);
        }

        if (mainGuildId) {
            const mainCommands = buildMainCommands();
            console.log(`Deploying ${mainCommands.length} commands to main guild ${mainGuildId}: ${mainCommands.map(c => c.name).join(', ')}`);

            await rest.put(
                Routes.applicationGuildCommands(process.env.CLIENT_ID, mainGuildId),
                { body: mainCommands }
            );

            console.log(`Done: main guild ${mainGuildId}`);
        }

        console.log('Guild-specific command deployment completed.');
    } catch (error) {
        console.error(error);
    }
})();
