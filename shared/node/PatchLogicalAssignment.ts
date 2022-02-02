import { readFile, writeFile } from "fs/promises";
import path from "path";

class PatchLogicalAssignment {
  static operator = "??=";

  static MODULE = path.join(
    "var",
    "task",
    "node_modules",
    "@rian8337",
    "osu-base",
    "dist"
  );

  static #patched = false;

  public static async patch() {
    if (process.env.NODE_ENV !== "production") {
      return;
    }

    const patchFile = async (file: string, path: string) => {
      const lines = file.split(/\r?\n/);
      lines.forEach((line, i) => {
        if (line.includes(this.operator)) {
          const split = line.trim().split(this.operator);
          lines[i] = `${split[0]} = ${split[0]} || ${split[1]}`;
        }
      });
      await writeFile(path, lines.join("\n"));
    };

    if (!this.#patched) {
      const join = (...paths: string[]) => {
        return path.join(this.MODULE, ...paths);
      };

      const work = async (path: string) => {
        const file = await readFile(path, "utf-8");
        patchFile(file, path);
      };

      work(join("utils", "Accuracy.js"));
      work(join("tools", "MapInfo.js"));

      this.#patched = true;
    }
  }
}

export default PatchLogicalAssignment;
