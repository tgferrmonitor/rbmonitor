import fs from "fs";
import path from "path";

const DATA_FILE = path.resolve(process.cwd(), "data.json");

export function readData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    // Migrate old schema: if totalOnlineMinutes exists, convert to seconds
    let migrated = false;
    if (Array.isArray(data.players)) {
      for (const p of data.players) {
        if (p.totalOnlineMinutes && !p.totalOnlineSeconds) {
          p.totalOnlineSeconds = Number(p.totalOnlineMinutes) * 60;
          delete p.totalOnlineMinutes;
          if (p.games) {
            for (const k of Object.keys(p.games)) {
              p.games[k] = Number(p.games[k]) * 60;
            }
          }
          migrated = true;
        }
        if (!p.totalOnlineSeconds) p.totalOnlineSeconds = 0;
      }
    }
    if (migrated) writeData(data);
    return data;
  } catch (err) {
    return { players: [], lastCheck: null };
  }
}

export function writeData(obj) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(obj, null, 2), "utf8");
}

export function parseRemoteTime(remoteIso, tzOffsetMinutes) {
  const d = new Date(remoteIso);
  const local = new Date(d.getTime() + tzOffsetMinutes * 60 * 1000);
  return local;
}

export function ensurePlayer(data, playerId) {
  let p = data.players.find((x) => x.id === String(playerId));
  if (!p) {
    p = {
      id: String(playerId),
      totalOnlineSeconds: 0,
      games: {},
      lastStatus: "offline",
      lastSeenAt: null,
    };
    data.players.push(p);
  }
  return p;
}

// Accumulate using seconds (more precise)
export function accumulateOnline(onlineFriends, tzOffsetMinutes = -180) {
  const data = readData();
  const now = new Date();

  let deltaSeconds = 0;
  if (data.lastCheck) {
    const last = new Date(data.lastCheck);
    deltaSeconds = Math.max(0, Math.round((now - last) / 1000));
  } else {
    deltaSeconds = 1;
  }

  for (const friend of onlineFriends.data) {
    const id = friend.id;
    const presence = friend.userPresence || {};
    const status = presence.UserPresenceType || "Unknown";
    const gameName = presence.lastLocation || "plataforma";

    const player = ensurePlayer(data, id);

    if (status === "InGame" || status === "Online") {
      player.totalOnlineSeconds =
        (player.totalOnlineSeconds || 0) + deltaSeconds;
      player.games[gameName] = (player.games[gameName] || 0) + deltaSeconds;
    }

    player.lastStatus =
      status === "InGame" ? `jogando: ${gameName}` : status.toLowerCase();

    if (presence.lastOnline) {
      const parsed = parseRemoteTime(presence.lastOnline, tzOffsetMinutes);
      player.lastSeenAt = parsed.toISOString();
    }
  }

  data.lastCheck = now.toISOString();
  writeData(data);
  return data;
}
