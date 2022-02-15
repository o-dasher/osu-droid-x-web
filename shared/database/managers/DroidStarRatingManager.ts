import { Beatmap, Mod } from "@rian8337/osu-base";
import NipaaModUtil from "../../osu/NipaaModUtils";

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

  static getStarRating(beatmap: Beatmap, mods: Mod[]) {}
}
