# LARP Bot

A Discord bot built with discord.js that integrates with the ERLC (Emergency Response: Liberty County) API.

## Project Overview

This is a Discord bot ("larp-bot") that provides slash commands and event handling for managing ERLC server interactions. It uses:
- **discord.js v14** for Discord API integration
- **enmap** for persistent key-value storage (server settings)
- **axios** for HTTP requests to the ERLC API
- **dotenv** for environment variable management

## Architecture

- `index.js` - Entry point; loads commands/events and logs in the Discord client
- `src/commands/` - Slash command handlers (emoji, erlc, git, playerlist, setup, ssd, ssu, ssu_vote)
- `src/events/` - Discord event handlers (ready, interactionCreate, interactionButton, messageCreate, automation)
- `src/api/erlc.js` - ERLC API wrapper (server info, players, commands)
- `src/deploy-commands.js` - Script to register slash commands with Discord

## Required Secrets

- `TOKEN` - Discord bot token
- `CLIENT_ID` - Discord application client ID
- `ERLC_API_KEY` - ERLC (PRC) server API key

## Running

The bot is started with `node index.js` and runs as a console workflow.
