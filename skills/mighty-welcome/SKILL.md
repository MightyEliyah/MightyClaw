---
name: mighty-welcome
description: "Welcomes new Discord members in the welcome channel when they join the server."
metadata:
  openclaw:
    emoji: "🦞"
    requires:
      config:
        - channels.discord.token
        - channels.discord.guilds.YOUR_SERVER_ID.welcomeChannelId
---

# Mighty Welcome

Triggered when a new member joins the Discord server. Sends a personalized welcome
message in the configured welcome channel.

## What it does

1. Listens for `guildMemberAdd` Discord gateway events
2. Composes a warm, personalized welcome message using the member's username
3. Posts it to the guild's `welcomeChannelId`

## Setup

See `scripts/welcome-listener.mjs` — run it alongside the OpenClaw gateway.
Set `DISCORD_BOT_TOKEN`, `WELCOME_CHANNEL_ID`, and `OPENCLAW_GATEWAY_TOKEN` in `.env`.
