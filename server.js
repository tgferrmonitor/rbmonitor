import fetch from "node-fetch";
import "dotenv/config";
import fs from "fs";
import path from "path";
import {
  accumulateOnline,
  readData,
  writeData,
  parseRemoteTime,
} from "./lib/accumulator.js";
// Ajuste de fuso em minutos (ex: -180 = -3h)
const TZ_OFFSET_MINUTES = Number(process.env.TZ_OFFSET_MINUTES || -180);
// Carrega map de players a partir do .env
let PLAYER_MAP = {};
try {
  const players = JSON.parse(process.env.PLAYERS_JSON || "[]");
  for (const p of players) PLAYER_MAP[String(p.id)] = p;
} catch (err) {
  console.warn("PLAYERS_JSON inválido no .env:", err.message);
}
import express from "express";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const USER_ID = process.env.USER_ID;
const ROBLOSECURITY = process.env.ROBLOSECURITY;

const COOKIES = `.ROBLOSECURITY=${ROBLOSECURITY};`;
const URL = `https://friends.roblox.com/v1/users/${USER_ID}/friends/online`;

// Cache para CSRF token (usado quando a API retorna X-CSRF-TOKEN em 403)
let csrfToken = null;

async function getOnlineFriends() {
  const baseHeaders = {
    accept: "application/json, text/plain, */*",
    "accept-language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
    "cache-control": "no-cache",
    origin: "https://www.roblox.com",
    pragma: "no-cache",
    referer: "https://www.roblox.com/",
    "sec-ch-ua":
      '"Not;A=Brand";v="99", "Google Chrome";v="139", "Chromium";v="139"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"Linux"',
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-site",
    "user-agent":
      "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36",
    cookie: COOKIES,
  };

  // Se houver csrfToken em cache, adiciona ao header
  const headers = { ...baseHeaders };
  if (csrfToken) headers["x-csrf-token"] = csrfToken;

  const maxRetries = 3;
  let attempt = 0;
  let lastError = null;

  while (attempt < maxRetries) {
    attempt++;
    try {
      const response = await fetch(URL, { method: "GET", headers });

      // Se receber 403, pode vir um x-csrf-token para usar na próxima tentativa
      if (response.status === 403) {
        const newToken = response.headers.get("x-csrf-token");
        if (newToken) {
          console.log(
            "[CSRF] Token recebido via header, atualizando cache e re-tentando"
          );
          csrfToken = newToken;
          headers["x-csrf-token"] = csrfToken;
          // repetir o loop para tentar com o novo token
          continue;
        }
      }

      const contentType = response.headers.get("content-type");
      let body;
      if (contentType && contentType.includes("application/json")) {
        body = await response.json();
      } else {
        body = await response.text();
      }

      return body;
    } catch (err) {
      lastError = err;
      console.error(`[ERROR] tentativa ${attempt} falhou:`, err.message);
      // backoff simples
      await new Promise((r) => setTimeout(r, 200 * attempt));
    }
  }

  console.error(
    "Erro ao buscar amigos online depois de retries:",
    lastError && lastError.message
  );
  return null;
}

// Exemplo de uso: logar amigos online e mapear tempo online
async function monitorFriends() {
  const onlineFriends = await getOnlineFriends();
  if (!onlineFriends || !onlineFriends.data) return;

  console.log("[INFO] onlineFriends:", onlineFriends.data);
  // Log resumido: apenas contagem e IDs
  console.log(
    "[INFO] onlineFriends count:",
    onlineFriends.data.length,
    "ids:",
    onlineFriends.data.map((f) => f.id)
  );

  // Atualiza persistência com os dados recebidos (passando offset TZ)
  try {
    accumulateOnline(onlineFriends, TZ_OFFSET_MINUTES);
  } catch (err) {
    console.error("[ERROR] ao acumular tempo online:", err.message);
  }

  for (const friend of onlineFriends.data) {
    const presence = friend.userPresence;
    // Ajusta lastOnline usando o offset configurado
    const adjustedLastOnline = presence.lastOnline
      ? parseRemoteTime(presence.lastOnline, TZ_OFFSET_MINUTES).toISOString()
      : presence.lastOnline;
    const pm = PLAYER_MAP[String(friend.id)];
    const display = pm ? `${pm.displayName} (${pm.name})` : String(friend.id);
    console.log(
      `ID: ${friend.id} - ${display} | Status: ${presence.UserPresenceType} | Local: ${presence.lastLocation} | Última vez online: ${adjustedLastOnline}`
    );
  }

  // Persiste PLAYER_MAP (garante que o arquivo data.json contenha o mapa de players)
  try {
    const data = readData();
    data.playerMap = PLAYER_MAP;
    writeData(data);
  } catch (err) {
    console.error("[WARN] não consegui persistir PLAYER_MAP:", err.message);
  }
}

const SECONDS_INTERVAL = Number(process.env.SECONDS_INTERVAL || 30);
setInterval(monitorFriends, SECONDS_INTERVAL * 1000);
monitorFriends();

// --- HTTP endpoint to expose data (converts seconds -> minutes with 2 decimals)
const PORT = Number(process.env.PORT || 3000);
const app = express();

app.get("/data", (req, res) => {
  // Adiciona autenticação simples: cabeçalho x-api-key ou ?token=
  const token = req.headers["x-api-key"] || req.query.token || "";
  if (!token || token !== process.env.API_TOKEN) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const data = readData();
    // convert seconds to minutes (2 decimals) for output
    const out = {
      players: data.players.map((p) => {
        const pm = PLAYER_MAP[String(p.id)];
        return {
          id: p.id,
          name: pm ? pm.name : undefined,
          displayName: pm ? pm.displayName : undefined,
          totalOnlineMinutes: Number(
            ((p.totalOnlineSeconds || 0) / 60).toFixed(2)
          ),
          games: Object.fromEntries(
            Object.entries(p.games || {}).map(([k, v]) => [
              k,
              Number((v / 60).toFixed(2)),
            ])
          ),
          lastStatus: p.lastStatus,
          lastSeenAt: p.lastSeenAt,
        };
      }),
      lastCheck: data.lastCheck,
    };
    res.json(out);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`HTTP API disponível em http://localhost:${PORT}/data`)
);
