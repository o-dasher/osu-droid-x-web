import { Mod, ModUtil } from "@rian8337/osu-base";

export default class XModUtils extends ModUtil {
  static modsToBitwise(mods: Mod[]): number {
    return mods.map((m) => m.bitwise).reduce((acc, cur) => acc + cur, 0);
  }
}
