const { Events } = require('discord.js');
const { getPlayers, pmPlayer, jailPlayer, getPlayerName } = require('../api/erlc');

// Track warning counts for players. Key: robloxUsername, Value: warning count
const vcWarnings = new Map();
const commsWarnings = new Map();

// Alternating message endings to avoid spam detection
let msgFlip = false;

// The specific role to give players in game
const IN_GAME_ROLE_ID = '1480589156177674343';
const STAFF_BYPASS_ROLE_ID = '970917178142498824';

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        console.log(`Polling Manager: Ready. Starting loops...`);

        // Main loop — runs everything sequentially to avoid overlap
        const mainLoop = async () => {
            try {
                await runChecks(client);
            } catch (err) {
                console.error('[Main Loop] Unhandled error:', err.message);
            }
            msgFlip = !msgFlip; // Alternate each cycle
            setTimeout(mainLoop, 15 * 1000); // Faster polling: 15 seconds instead of 60
        };

        // Delay by 2 seconds after ready to let cache populate
        setTimeout(mainLoop, 2000);
    },
};

/**
 * Normalizes a string to lowercase and removes extra spaces
 */
function normalizeString(str) {
    if (!str) return '';
    return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Sleeps for ms milliseconds
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Returns alternating punctuation to avoid spam filters
 */
function endPunc() {
    return msgFlip ? '!' : '.';
}

/**
 * Finds a Discord member whose nickname, globalName, or username contains the roblox username
 */
function findDiscordMember(guild, robloxUsername) {
    const normalized = normalizeString(robloxUsername);
    if (!normalized) return null;

    return guild.members.cache.find(m => {
        const nick = normalizeString(m.nickname);
        const globalName = normalizeString(m.user.globalName);
        const username = normalizeString(m.user.username);
        return nick.includes(normalized) || globalName.includes(normalized) || username.includes(normalized);
    });
}

/**
 * Main check function - handles roles, VC checks, and comms checks
 */
async function runChecks(client) {
    const guild = client.guilds.cache.get(process.env.SERVER_ID);
    if (!guild) {
        console.log('[Checks] Guild not found');
        return;
    }

    const inGamePlayersResponse = await getPlayers();
    if (!inGamePlayersResponse) {
        console.log('[Checks] Failed to fetch players from API');
        return;
    }
    const inGamePlayers = Array.isArray(inGamePlayersResponse) ? inGamePlayersResponse : [];

    console.log(`[Checks] Active Players: ${inGamePlayers.length} | Guild Cache: ${guild.members.cache.size}`);

    // --- Role Management & VC Check ---
    for (const player of inGamePlayers) {
        const robloxUsername = getPlayerName(player.Player);
        const member = findDiscordMember(guild, robloxUsername);

        if (member) {
            // --- Give in-game role ---
            if (!member.roles.cache.has(IN_GAME_ROLE_ID)) {
                try {
                    await member.roles.add(IN_GAME_ROLE_ID);
                    console.log(`[Role] Added In-Game Role to ${member.user.tag} (${robloxUsername})`);
                } catch (e) {
                    console.error(`[Role] Failed to add role to ${member.user.tag}:`, e.message);
                }
            }

            // --- Staff Bypass Check ---
            if (member.roles.cache.has(STAFF_BYPASS_ROLE_ID)) {
                vcWarnings.delete(robloxUsername);
                continue;
            }

            // --- VC Check (player IS in Discord, but not in a voice channel) ---
            if (!member.voice.channelId) {
                const warnings = vcWarnings.get(robloxUsername) || 0;
                if (warnings >= 5) {
                    console.log(`[VC] Jailing ${robloxUsername} for not being in VC`);
                    await jailPlayer(player.Player, "Not in a voice channel" + endPunc());
                    await sleep(1500);
                    vcWarnings.delete(robloxUsername);
                } else {
                    console.log(`[VC] Warning ${robloxUsername} (${warnings + 1}/5)`);
                    await pmPlayer(player.Player, "You are in our Discord but not in a Voice Channel" + endPunc() + " Please join a VC to continue RPing" + endPunc());
                    await sleep(1500);
                    vcWarnings.set(robloxUsername, warnings + 1);
                }
            } else {
                vcWarnings.delete(robloxUsername);
            }
        } else {
            // --- Comms Check (player is NOT found in Discord at all) ---
            const warnings = commsWarnings.get(robloxUsername) || 0;
            if (warnings >= 6) {
                console.log(`[Comms] Jailing ${robloxUsername} for not being in Discord`);
                await jailPlayer(player.Player, "Not in the comms server" + endPunc());
                await sleep(1500);
                commsWarnings.delete(robloxUsername);
            } else {
                console.log(`[Comms] Warning ${robloxUsername} (${warnings + 1}/6)`);
                await pmPlayer(player.Player, "You are not in our Discord server" + endPunc() + " Please join or you will be jailed" + endPunc());
                await sleep(1500);
                commsWarnings.set(robloxUsername, warnings + 1);
            }
        }
    }

    // --- Remove role from players who left the game ---
    const inGameUsernames = inGamePlayers.map(p => normalizeString(getPlayerName(p.Player)));

    for (const [memberId, member] of guild.members.cache) {
        if (member.roles.cache.has(IN_GAME_ROLE_ID)) {
            const nick = normalizeString(member.nickname);
            const globalName = normalizeString(member.user.globalName);
            const username = normalizeString(member.user.username);

            const isStillInGame = inGameUsernames.some(rblox =>
                nick.includes(rblox) || globalName.includes(rblox) || username.includes(rblox)
            );

            if (!isStillInGame) {
                try {
                    await member.roles.remove(IN_GAME_ROLE_ID);
                    console.log(`[Role] Removed In-Game Role from ${member.user.tag}`);
                } catch (e) {
                    console.error(`[Role] Failed to remove role from ${member.user.tag}:`, e.message);
                }
            }
        }
    }
}
