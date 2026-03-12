async function upsertAnnouncementMessage({
    client,
    guildId,
    channel,
    content = '',
    embeds = [],
    components = [],
    announcementMessageId,
}) {
    const settings = client.settings.get(guildId) || {};
    const storedId = announcementMessageId || settings.announcementMessageId;

    console.log(`[upsert] guildId=${guildId} storedId=${storedId}`);

    let existingMessage = null;

    if (storedId) {
        try {
            existingMessage = await channel.messages.fetch(storedId);
            console.log(`[upsert] Fetched existing message: ${storedId}`);
        } catch (error) {
            console.log(`[upsert] Could not fetch message ${storedId}: ${error.message}`);
            existingMessage = null;
        }
    }

    if (existingMessage) {
        console.log(`[upsert] Editing existing message ${existingMessage.id}`);
        return existingMessage.edit({ content, embeds, components });
    }

    console.log(`[upsert] Sending new message to channel ${channel.id}`);
    const sentMessage = await channel.send({ content, embeds, components });
    client.settings.set(guildId, { ...settings, announcementMessageId: sentMessage.id });
    console.log(`[upsert] Stored new announcementMessageId: ${sentMessage.id}`);
    return sentMessage;
}

module.exports = {
    upsertAnnouncementMessage,
};
