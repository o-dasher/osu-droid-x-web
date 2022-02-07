import { Beatmap, Mod, ModRelax, Slider, SliderTick } from "@rian8337/osu-base";
import { hitResult, ReplayAnalyzer } from "@rian8337/osu-droid-replay-analyzer";
import assert from "assert";
import { assertDefined } from "../assertions";
import XModUtils from "../osu/XModUtils";

export default class ReplayAnalyzerUtils {
  static estimateScore(
    analyzer: ReplayAnalyzer,
    customScoreMultiplier: (mod: Mod) => number | undefined = (m) => {
      switch (m.constructor.prototype) {
        case ModRelax:
          return 0.8;
      }
    }
  ) {
    assertDefined(analyzer.data);
    assert(analyzer.map instanceof Beatmap);

    // Assuming you use `Beatmap`
    // Get raw OD, HP, and CS
    const difficultyMultiplier =
      1 +
      analyzer.map.od / 10 +
      analyzer.map.hp / 10 +
      (analyzer.map.cs - 3) / 4;

    const mods = analyzer.data.convertedMods;
    let scoreMultiplier = 1;

    if (XModUtils.isModRanked(mods)) {
      scoreMultiplier = mods.reduce((a, m) => {
        const scoreMultiplier = customScoreMultiplier(m) ?? m.scoreMultiplier;
        return a * scoreMultiplier;
      }, 1);
    } else {
      scoreMultiplier = 0;
    }

    // Custom score multiplier from speed modifier
    let speedScoreMultiplier = 1;
    const speedMultiplier = analyzer.data.speedModification;

    if (speedMultiplier > 1) {
      speedScoreMultiplier += (speedMultiplier - 1) * 0.24;
    } else if (speedMultiplier < 1) {
      speedScoreMultiplier = Math.pow(0.3, (1 - speedMultiplier) * 4);
    }

    scoreMultiplier *= speedScoreMultiplier;

    let currentCombo = 0;
    let score = 0;

    const miss = () => {
      currentCombo = 0;
    };

    const hitReal = (hitValue: number) => {
      score += hitValue;
    };

    const hit = (hitValue: number) => {
      hitReal(hitValue);
      score +=
        (hitValue * currentCombo * difficultyMultiplier * scoreMultiplier) / 25;
      ++currentCombo;
    };

    analyzer.data.hitObjectData.forEach((hitData, i) => {
      assert(analyzer.map instanceof Beatmap);

      const currentObject = analyzer.map.objects[i];

      if (currentObject instanceof Slider) {
        for (let j = 1; j < currentObject.nestedHitObjects.length; ++j) {
          if (hitData.tickset[j - 1]) {
            const currentNested = currentObject.nestedHitObjects[j];
            if (currentNested instanceof SliderTick) {
              hitReal(10);
            } else {
              hitReal(30);
            }
          } else {
            miss();
          }
        }
        return;
      }

      switch (hitData.result) {
        case hitResult.RESULT_0:
          miss();
          break;
        case hitResult.RESULT_50:
          hit(50);
          break;
        case hitResult.RESULT_100:
          hit(100);
          break;
        case hitResult.RESULT_300:
          hit(300);
          break;
      }
    });

    return score;
  }
}
