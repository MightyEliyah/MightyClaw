#!/usr/bin/env node
/**
 * Mighty Craw — Discord Welcome Listener
 *
 * Listens for new members joining the Discord server and posts a welcome
 * message via the OpenClaw gateway's Discord send action.
 *
 * Usage:
 *   node scripts/welcome-listener.mjs
 *
 * Required env vars (in .env or environment):
 *   DISCORD_BOT_TOKEN       — your Discord bot token
 *   WELCOME_CHANNEL_ID      — Discord channel ID for welcome messages
 *   OPENCLAW_GATEWAY_URL    — e.g. http://localhost:18789
 *   OPENCLAW_GATEWAY_TOKEN  — gateway auth token
 */

import { createRequire } from "module";

const require = createRequire(import.meta.url);

// Load env from .env if present
try {
  const { config } = await import("dotenv");
  config();
} catch {
  // dotenv optional
}

const {
  DISCORD_BOT_TOKEN,
  WELCOME_CHANNEL_ID,
  OPENCLAW_GATEWAY_URL = "http://localhost:18789",
  OPENCLAW_GATEWAY_TOKEN,
} = process.env;

if (!DISCORD_BOT_TOKEN) {
  console.error("Missing DISCORD_BOT_TOKEN");
  process.exit(1);
}
if (!WELCOME_CHANNEL_ID) {
  console.error("Missing WELCOME_CHANNEL_ID");
  process.exit(1);
}

// ─── Welcome message composer ────────────────────────────────────────────────

function buildWelcomeMessage(username) {
  const lines = [
    `👋 Welcome to the server, **${username}**! Great to have you here 🦞`,
    `Feel free to introduce yourself and ask me anything — I'm Mighty Craw, your community assistant.`,
    `Check out **#rules** and **#announcements** to get started!`,
  ];
  return lines.join("\n");
}

// ─── Send via OpenClaw gateway ────────────────────────────────────────────────

async function sendWelcome(username) {
  const message = buildWelcomeMessage(username);

  const payload = {
    action: "send",
    channel: "discord",
    to: `channel:${WELCOME_CHANNEL_ID}`,
    message,
    silent: false,
  };

  const headers = {
    "Content-Type": "application/json",
    ...(OPENCLAW_GATEWAY_TOKEN
      ? { Authorization: `Bearer ${OPENCLAW_GATEWAY_TOKEN}` }
      : {}),
  };

  try {
    const res = await fetch(`${OPENCLAW_GATEWAY_URL}/api/send`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      console.error(`Gateway send failed: ${res.status} ${await res.text()}`);
    } else {
      console.log(`✅ Welcome sent for ${username}`);
    }
  } catch (err) {
    console.error("Failed to reach OpenClaw gateway:", err.message);
  }
}

// ─── Discord WebSocket gateway listener ──────────────────────────────────────

const DISCORD_GATEWAY_URL = "wss://gateway.discord.gg/?v=10&encoding=json";
const GUILD_MEMBER_ADD = 13; // Discord opcode dispatch event type index

let heartbeatInterval = null;
let sequence = null;

function connect() {
  // Dynamic import of ws (bundled with openclaw or install separately)
  let WebSocket;
  try {
    WebSocket = globalThis.WebSocket ?? require("ws");
  } catch {
    console.error("WebSocket not available. Run: npm install ws");
    process.exit(1);
  }

  const ws = new WebSocket(DISCORD_GATEWAY_URL);

  ws.on("open", () => console.log("🔌 Connected to Discord gateway"));

  ws.on("message", (raw) => {
    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    const { op, d, t, s } = data;
    if (s) sequence = s;

    switch (op) {
      // Hello — start heartbeat + identify
      case 10: {
        const { heartbeat_interval } = d;
        heartbeatInterval = setInterval(() => {
          ws.send(JSON.stringify({ op: 1, d: sequence }));
        }, heartbeat_interval);

        // Identify
        ws.send(
          JSON.stringify({
            op: 2,
            d: {
              token: DISCORD_BOT_TOKEN,
              intents:
                (1 << 1) | // GUILDS
                (1 << 9) | // GUILD_MEMBERS (privileged)
                (1 << 15), // MESSAGE_CONTENT (privileged)
              properties: {
                os: process.platform,
                browser: "mighty-craw",
                device: "mighty-craw",
              },
            },
          })
        );
        break;
      }

      // Heartbeat ACK — nothing to do
      case 11:
        break;

      // Dispatch
      case 0:
        if (t === "GUILD_MEMBER_ADD") {
          const username =
            d.nick ?? d.user?.global_name ?? d.user?.username ?? "friend";
          console.log(`👋 New member: ${username}`);
          sendWelcome(username);
        }
        break;

      default:
        break;
    }
  });

  ws.on("close", (code) => {
    console.warn(`Discord WS closed (${code}), reconnecting in 5s…`);
    clearInterval(heartbeatInterval);
    setTimeout(connect, 5000);
  });

  ws.on("error", (err) => {
    console.error("Discord WS error:", err.message);
  });
}

console.log("🦞 Mighty Craw welcome listener starting…");
connect();
