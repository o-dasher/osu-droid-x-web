import { MapInfo, MapStats, Mod } from "@rian8337/osu-base";
import { DroidStarRating } from "@rian8337/osu-difficulty-calculator";
import assert from "assert";
import { assertDefined } from "../../assertions";
import NipaaModUtil from "../../osu/NipaaModUtils";
import Database from "../Database";

export default class DroidStarRatingManager {
  static readonly allPossibleModCombinations = ((): Mod[][] => {
    const combinations: Mod[][] = [];
    NipaaModUtil.allMods.forEach((m) => {
      const currentPossibleCombinations: Mod[][] = [];
      const currentModCombination = [m];
      NipaaModUtil.allMods
        .filter((a) => a.constructor.prototype !== m.constructor.prototype)
        .forEach((mo) => {
          const newCombination = [...currentModCombination, mo];
          if (NipaaModUtil.isCompatible(newCombination)) {
            currentModCombination.push(mo);
            currentPossibleCombinations.push([...currentModCombination]);
          }
        });
      if (currentPossibleCombinations.length > 0) {
        combinations.push(...currentPossibleCombinations);
      }
    });
    return combinations;
  })();

  static getStarRating(beatmap: MapInfo, mods: Mod[], stats?: MapStats) {
    const getKey = (mods: Mod[]) =>
      `${beatmap.hash}${NipaaModUtil.toModAcronymString(mods)}${stats?.cs}${
        stats?.ar
      }${stats?.od}${stats?.isForceAR}${stats?.speedMultiplier}`;

    const cacheStarRating = Database.nodeCache.get(getKey(mods));
    if (cacheStarRating) {
      assert(cacheStarRating instanceof DroidStarRating);
      return cacheStarRating;
    }

    const selectedStarRating: DroidStarRating[] = [];

    this.allPossibleModCombinations.forEach((combination) => {
      assertDefined(beatmap.map);
      const newStarRating = new DroidStarRating().calculate({
        map: beatmap.map,
        mods: combination,
        stats,
      });
      if (NipaaModUtil.checkEquality(combination, mods)) {
        assert(selectedStarRating.length === 0);
        selectedStarRating.push(newStarRating);
      }
      Database.nodeCache.set(getKey(combination), newStarRating);
    });

    return selectedStarRating;
  }
}
