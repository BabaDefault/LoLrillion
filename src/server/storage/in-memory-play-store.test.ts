import { InMemoryPlayStore } from "./in-memory-play-store";
import { describePlayStoreContract } from "./play-store-contract";

describePlayStoreContract("InMemoryPlayStore", () => new InMemoryPlayStore());
