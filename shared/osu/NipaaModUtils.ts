import {
  Mod,
  ModAuto,
  ModAutopilot,
  ModRelax,
  ModScoreV2,
  ModUtil,
} from "@rian8337/osu-base";
import { OsuDroidScore } from "../database/entities";
import NumberUtils from "../utils/NumberUtils";

type DroidStats = {
  mods: Mod[];
  customSpeed: number;
};

export default class NipaaModUtil extends ModUtil {
  static #EXTRA_MODS_SEP = "|";

  static #CUSTOM_SPEED_SEP = "x";

  static #NOMOD_STRING = "-";

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

    const extraModInformation = data.filter((_, i) =>
      response.mods.length > 0 ? i !== 0 : true
    );

    extraModInformation.forEach((data) => {
      const omitSeparatorFromData = (sep: string) =>
        data.replace(new RegExp(sep, "g"), "");

      if (data.startsWith(this.#CUSTOM_SPEED_SEP)) {
        const customSpeed = parseFloat(
          omitSeparatorFromData(this.#CUSTOM_SPEED_SEP)
        );
        if (NumberUtils.isNumber(customSpeed)) {
          response.customSpeed = customSpeed;
        }
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
    let string = mods.reduce(
      (acc, cur) => acc + cur.droidString,
      NipaaModUtil.#NOMOD_STRING
    );

    if (extra) {
      if (string === NipaaModUtil.#NOMOD_STRING) {
        string = "";
      }

      let addedFirstSeparator = false;
      const addExtraRepresentation = (extra: string = "") => {
        if (!addedFirstSeparator) {
          addedFirstSeparator = true;
          addExtraRepresentation();
        }
        string += `${extra}${this.#EXTRA_MODS_SEP}`;
      };

      if (extra.customSpeed) {
        addExtraRepresentation(`${this.#CUSTOM_SPEED_SEP}${extra.customSpeed}`);
      }
    }

    console.log(string);

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

  static isCompatible(mods: Mod[]) {
    return !this.incompatibleMods.some(
      (arr) => arr.filter((m) => mods.includes(m)).length > 1
    );
  }
}
