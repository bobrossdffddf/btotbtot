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


    },
};
