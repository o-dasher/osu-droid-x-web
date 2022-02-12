import {
  Mod,
  ModAuto,
  ModAutopilot,
  ModRelax,
  ModScoreV2,
  ModUtil,
} from "@rian8337/osu-base";
import { OsuDroidScore } from "../database/entities";

type DroidStats = {
  mods: Mod[];
  customSpeed: number;
};

export default class NipaaModUtil extends ModUtil {
  static #EXTRA_MODS_SEP = "|";

  static #CUSTOM_SPEED_SEP = "x";

  static MODS_WITH_CUSTOM_MULTIPLIER = [ModRelax];

  static modsToBitwise(mods: Mod[]): number {
    return mods.reduce((acc, cur) => acc + cur.bitwise, 0);
  }

  static droidStringFromScore(score: OsuDroidScore) {
    return this.modsToDroidString(score.mods, {
      customSpeed: score.customSpeed,
    });
  }

  static droidStatsFromDroidString(string: string): DroidStats {
    const data = string.split(this.#EXTRA_MODS_SEP);

    const response: DroidStats = {
      customSpeed: 1,
      mods: [],
    };

    const modsData = data[0];
    if (modsData) {
      response.mods.push(...this.droidStringToMods(modsData));
    }

    if (data.length <= 1) {
      return response;
    }

    const extraModInformation = data.filter((_, i) => i !== 0);

    extraModInformation.forEach((data) => {
      const omitSeparatorFromData = (sep: string) =>
        data.replace(new RegExp(sep, "g"), "");

      if (data.startsWith(this.#CUSTOM_SPEED_SEP)) {
        response.customSpeed = parseFloat(
          omitSeparatorFromData(this.#CUSTOM_SPEED_SEP)
        );
      }
    });

    return response;
  }

  static modsToDroidString(
    mods: Mod[],
    extra?: {
      customSpeed?: number;
    }
  ): string {
    let string = mods.reduce((acc, cur) => acc + cur.droidString, "-");

    if (extra) {
      const addExtraRepresentation = (extra: string = "") =>
        (string += `${extra}${this.#EXTRA_MODS_SEP}`);

      addExtraRepresentation();

      if (extra.customSpeed) {
        addExtraRepresentation(`${this.#CUSTOM_SPEED_SEP}${extra.customSpeed}`);
      }
    }

    return string;
  }

  static checkEquality(mods1: Mod[], mods2: Mod[]) {
    const prototypes1 = mods1.map((m) => m.constructor.prototype);
    const prototypes2 = mods2.map((m) => m.constructor.prototype);
    return (
      prototypes1.every((v) => prototypes2.includes(v)) &&
      prototypes2.every((v) => prototypes1.includes(v))
    );
  }

  static get XServersUnrankedMods() {
    return [ModAuto, ModAutopilot, ModScoreV2];
  }

  static get XServersRankedMods() {
    return [
      ...NipaaModUtil.allMods.filter(
        (m) => !this.XServersUnrankedMods.includes(m.constructor.prototype)
      ),
    ];
  }

  static toModAcronymString(mods: Mod[]) {
    return mods.reduce((acc, cur) => acc + cur.acronym, "");
  }

  static isModRanked(mods: Mod[]) {
    return mods.every(
      (m) => !this.XServersUnrankedMods.includes(m.constructor.prototype)
    );
  }
}
