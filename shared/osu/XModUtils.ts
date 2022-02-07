import {
  Mod,
  ModAuto,
  ModAutopilot,
  ModScoreV2,
  ModUtil,
} from "@rian8337/osu-base";

type ModConstructor = {
  new (): Mod;
};
export default class XModUtils extends ModUtil {
  static modsToBitwise(mods: Mod[]): number {
    return mods.map((m) => m.bitwise).reduce((acc, cur) => acc + cur, 0);
  }

  static modsToDroidString(mods: Mod[]): string {
    return mods.map((m) => m.droidString).reduce((acc, cur) => acc + cur, "-");
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
      ...XModUtils.allMods.filter(
        (m) => !this.XServersUnrankedMods.includes(m.constructor.prototype)
      ),
    ];
  }

  static toModAcronymString(mods: Mod[]) {
    return mods.map((m) => m.acronym).reduce((acc, cur) => acc + cur, "");
  }

  static isModRanked(mods: Mod[]) {
    const modsPrototypes = mods.map((m) => m.constructor.prototype);
    return !this.XServersUnrankedMods.some((m) => modsPrototypes.includes(m));
  }

  static HasMod(mods: Mod[], search: ModConstructor[]) {
    mods.forEach((m, i) => {
      if (search.includes(m.constructor.prototype)) {
        search.splice(i, 1);
      }
    });
    return search.length === 0;
  }

  static removeMod(mods: Mod[], remove: ModConstructor[]) {
    remove.forEach((m) => {
      const inMod = mods.find((mo) => mo.constructor.prototype === m);
      if (inMod) {
        const index = mods.indexOf(inMod);
        mods.splice(index, 1);
      }
    });
  }
}
