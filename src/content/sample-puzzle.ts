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
      text: "Name a Yordle",
      answerType: "champion",
      rule: "Champions officially described as Yordles in their current lore.",
      answerSet: champions({
        Teemo: "minion",
        Tristana: "minion",
        Lulu: "kill",
        Veigar: "kill",
        Poppy: "kill",
        Heimerdinger: "kill",
        Kled: "too-clever",
        Corki: "triple-kill",
        Ziggs: "triple-kill",
        Rumble: "triple-kill",
        Kennen: "triple-kill",
        Gnar: "triple-kill",
        Vex: "quadra-kill",
        Yuumi: "quadra-kill",
        Amumu: "pentakill",
      }),
    },
    {
      text: "Name a champion from Bilgewater",
      answerType: "champion",
      rule: "Champions whose official home region is Bilgewater.",
      answerSet: champions({
        MissFortune: "minion",
        Gangplank: "minion",
        TwistedFate: "kill",
        Graves: "kill",
        Pyke: "kill",
        Illaoi: "triple-kill",
        Nautilus: "triple-kill",
        Fizz: "quadra-kill",
        TahmKench: "quadra-kill",
        Nilah: "pentakill",
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
      text: "Name a champion from the Void",
      answerType: "champion",
      rule: "Champions who are Void creatures or Void-born.",
      answerSet: champions({
        Khazix: "minion",
        Chogath: "minion",
        Velkoz: "kill",
        KogMaw: "kill",
        RekSai: "kill",
        Kaisa: "triple-kill",
        Belveth: "quadra-kill",
        Malzahar: "too-clever",
        Kassadin: "pentakill",
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
      text: "Name a champion from Demacia",
      answerType: "champion",
      rule: "Champions whose official home region is Demacia.",
      answerSet: champions({
        Garen: "minion",
        Lux: "minion",
        JarvanIV: "kill",
        XinZhao: "kill",
        Fiora: "kill",
        Galio: "triple-kill",
        Lucian: "triple-kill",
        Vayne: "triple-kill",
        Shyvana: "triple-kill",
        Quinn: "quadra-kill",
        Sona: "quadra-kill",
        Kayle: "quadra-kill",
        Morgana: "quadra-kill",
        Poppy: "too-clever",
        Sylas: "pentakill",
      }),
    },
  ],
};
