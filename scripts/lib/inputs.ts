/**
 * Reading the committed content the Builder runs on, shared by the maintainer scripts so
 * `puzzles:build` and `puzzles:explain` read today's inputs the same way.
 */
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import type { FamiliarityData, TemplateDefinition } from "../../src/builder";
import type { GameDataSnapshot } from "../../src/content/game-data/snapshot";
import { approvedLabels } from "../../src/content/labels";

/** Absolute path of a file under `src/content/`. */
export const content = (path: string) => fileURLToPath(new URL(`../../src/content/${path}`, import.meta.url));

export async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

export async function readOptionalJson<T>(path: string): Promise<T | undefined> {
  return existsSync(path) ? readJson<T>(path) : undefined;
}

/**
 * Today's Builder inputs apart from reviews (each script decides how strictly to read those): the
 * snapshot, Template definitions, approved labels, and Familiarity for the snapshot's patch if any.
 */
export async function readBuilderContent() {
  const snapshot = await readJson<GameDataSnapshot>(content("game-data/snapshot.json"));
  return {
    snapshot,
    templates: await readJson<TemplateDefinition[]>(content("templates/templates.json")),
    labels: approvedLabels,
    familiarity: await readOptionalJson<FamiliarityData>(content(`familiarity/${snapshot.patch}.json`)),
  };
}
