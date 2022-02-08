import { MapInfo } from "@rian8337/osu-base";
import Database from "../Database";

export default class BeatmapManager {
  static async fetchBeatmap(
    beatmapIDOrHash: string,
    fetchBeatmaps = async (): Promise<MapInfo> => {
      return await MapInfo.getInformation({
        hash: beatmapIDOrHash,
      });
    }
  ): Promise<MapInfo | undefined> {
    let selectedBeatmap: MapInfo | undefined;

    const cacheBeatmap = (selectedBeatmap =
      Database.nodeCache.get(beatmapIDOrHash));

    /**
     * We also don't want to load cache from maps that we previously couldn't fetch.
     */
    if (!cacheBeatmap && cacheBeatmap !== null) {
      const newBeatmap = await fetchBeatmaps();
      Database.nodeCache.set(beatmapIDOrHash, newBeatmap ?? undefined, 60);
      if (!newBeatmap.title) {
        return undefined;
      }
      selectedBeatmap = newBeatmap;
    }

    return selectedBeatmap;
  }
}
