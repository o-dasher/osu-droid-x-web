import { Mod, ModUtil } from "@rian8337/osu-base";

export default class XModUtils extends ModUtil {
  static modsToBitwise(mods: Mod[]): number {
    return mods.map((m) => m.bitwise).reduce((acc, cur) => acc + cur, 0);
  }

  static checkEquality(mods1: Mod[], mods2: Mod[]) {
    const prototypes1 = mods1.map((m) => m.constructor.prototype);
    const prototypes2 = mods2.map((m) => m.constructor.prototype);
    return (
      prototypes1.every((v) => prototypes2.includes(v)) &&
      prototypes2.every((v) => prototypes1.includes(v))
    );
  }
}
