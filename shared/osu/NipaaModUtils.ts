import {
  Mod,
  ModAuto,
  ModAutopilot,
  ModScoreV2,
  ModUtil,
} from "@rian8337/osu-base";

export default class NipaaModUtil extends ModUtil {
  static modsToBitwise(mods: Mod[]): number {
    return mods.reduce((acc, cur) => acc + cur.bitwise, 0);
  }

  static modsToDroidString(mods: Mod[]): string {
    return mods.reduce((acc, cur) => acc + cur.droidString, "-");
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
    return mods.every((m) =>
      this.XServersRankedMods.includes(m.constructor.prototype)
    );
  }
}
