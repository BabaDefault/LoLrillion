import { InMemoryPlayStore } from "./in-memory-play-store";
import { InMemoryPlayerStore } from "./in-memory-player-store";
import { describePlayerStoreContract } from "./player-store-contract";

describePlayerStoreContract("InMemoryPlayerStore", () => {
  const plays = new InMemoryPlayStore();
  return { plays, players: new InMemoryPlayerStore(plays) };
});
