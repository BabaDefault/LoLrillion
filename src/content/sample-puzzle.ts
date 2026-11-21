import type { Entity, EntityId, Puzzle, Tier } from "@/engine";
import { championEntityId, entityRegistry, itemEntityId } from "./game-data";

/**
 * A hand-written sample Puzzle over the real Entity registry. Answer Sets will come from the
 * Puzzle Builder later; Tiers here are illustrative only.
 */

export const sampleEntities: readonly Entity[] = entityRegistry;

/** Champion Answer Set keyed by Data Dragon champion id, e.g. `MonkeyKing`. */
const champions = (entries: Record<string, Tier>) => keyed(entries, championEntityId);
/** Item Answer Set keyed by Riot item id, e.g. `3111`. */
const items = (entries: Record<string, Tier>) => keyed(entries, itemEntityId);

function keyed(entries: Record<string, Tier>, toId: (key: string) => EntityId): Record<EntityId, Tier> {
  return Object.fromEntries(Object.entries(entries).map(([key, tier]) => [toId(key), tier]));
}

export const samplePuzzle: Puzzle = {
  prompts: [
    {
      text: "Name a champion with a dash",
      answerType: "champion",
      rule: "One of the champion's own abilities moves them quickly across the ground or through the air to a location or target.",
      answerSet: champions({
        Yasuo: "minion",
        LeeSin: "minion",
        Riven: "kill",
        Ahri: "kill",
        Tristana: "kill",
        Graves: "triple-kill",
        Kindred: "triple-kill",
        Kalista: "triple-kill",
        Corki: "quadra-kill",
        Quinn: "quadra-kill",
        Rell: "pentakill",
      }),
    },
    {
      text: "Name a champion who can pull an enemy",
      answerType: "champion",
      rule: "One of the champion's own abilities forcibly moves an enemy toward the champion or toward a point.",
      answerSet: champions({
        Blitzcrank: "minion",
        Thresh: "minion",
        Nautilus: "kill",
        Pyke: "kill",
        Darius: "triple-kill",
        Sett: "triple-kill",
        Zac: "quadra-kill",
        Urgot: "quadra-kill",
        Skarner: "pentakill",
      }),
    },
    {
      text: "Name a champion who can become invisible",
      answerType: "champion",
      rule: "Their own base kit grants invisibility or camouflage. Stolen abilities don't count.",
      answerSet: champions({
        Twitch: "minion",
        Evelynn: "minion",
        Shaco: "kill",
        Akali: "kill",
        Teemo: "kill",
        Rengar: "triple-kill",
        Khazix: "triple-kill",
        Vayne: "triple-kill",
        Talon: "quadra-kill",
        Pyke: "quadra-kill",
        MonkeyKing: "quadra-kill",
        Kaisa: "pentakill",
      }),
    },
    {
      text: "Name an item that gives Magic Resist",
      answerType: "item",
      rule: "Items currently in the shop whose stats include Magic Resist.",
      answerSet: items({
        "3111": "minion", // Mercury's Treads
        "1057": "minion", // Negatron Cloak
        "3065": "kill", // Spirit Visage
        "4401": "kill", // Force of Nature
        "3156": "kill", // Maw of Malmortius
        "3091": "triple-kill", // Wit's End
        "3102": "triple-kill", // Banshee's Veil
        "1033": "too-clever", // Null-Magic Mantle
        "2504": "quadra-kill", // Kaenic Rookern
        "6664": "quadra-kill", // Hollow Radiance
        "8020": "quadra-kill", // Abyssal Mask
        "3222": "pentakill", // Mikael's Blessing
      }),
    },
    {
      text: "Name an item that gives Armor",
      answerType: "item",
      rule: "Items currently in the shop whose stats include Armor.",
      answerSet: items({
        "3075": "minion", // Thornmail
        "1029": "minion", // Cloth Armor
        "3047": "kill", // Plated Steelcaps
        "3143": "kill", // Randuin's Omen
        "3110": "kill", // Frozen Heart
        "3068": "triple-kill", // Sunfire Aegis
        "6333": "triple-kill", // Death's Dance
        "3076": "too-clever", // Bramble Vest
        "3742": "quadra-kill", // Dead Man's Plate
        "3157": "quadra-kill", // Zhonya's Hourglass
        "3026": "pentakill", // Guardian Angel
      }),
    },
    {
      text: "Name a champion whose name is three letters or fewer",
      answerType: "champion",
      rule: "Count letters in the champion's official name.",
      answerSet: champions({
        Vi: "minion",
        Lux: "minion",
        Zed: "kill",
        Jax: "kill",
        Vex: "triple-kill",
        Zac: "pentakill",
      }),
    },
    {
      text: "Name a champion with a global ultimate",
      answerType: "champion",
      rule: "The champion's own ultimate (R) can reach any point on the map.",
      answerSet: champions({
        Karthus: "minion",
        Shen: "minion",
        TwistedFate: "kill",
        Pantheon: "kill",
        Ashe: "kill",
        Ezreal: "kill",
        Jinx: "triple-kill",
        Soraka: "triple-kill",
        Gangplank: "triple-kill",
        Draven: "quadra-kill",
        Senna: "quadra-kill",
        Nocturne: "pentakill",
      }),
    },
  ],
};
