import { accumulateOnline, readData } from "../lib/accumulator.js";

// Simula várias respostas da API
const sample = {
  data: [
    {
      id: 2616521101,
      userPresence: {
        UserPresenceType: "InGame",
        UserLocationType: "Game",
        lastLocation: "Construa Um Barco Por Tesouro",
        placeId: 537413528,
        rootPlaceId: 537413528,
        gameInstanceId: "787c4030-3627-4848-9a70-cc9c063efb3c",
        universeId: 210851291,
        lastOnline: new Date().toISOString(),
      },
    },
  ],
};

console.log("Antes:", readData());
const res = accumulateOnline(sample, -180);
console.log("Depois:", res);
