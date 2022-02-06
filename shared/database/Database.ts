import { Connection, createConnection, getConnection } from "typeorm";
import OsuDroidScore from "./entities/OsuDroidScore";
import OsuDroidStats from "./entities/OsuDroidStats";
import OsuDroidUser from "./entities/OsuDroidUser";
export default class Database {
  static uri = process.env["DATABASE_URL"];
  static #connection?: Connection;

  /**
   * this method in used on serverless backend environments
   * in which the connection may be closed regarding to inactivity.
   * @returns The cached connection.
   */
  public static async getConnection(): Promise<Connection> {
    if (this.#connection) {
      return this.#connection;
    }

    try {
      const staleConnection = getConnection();
      await staleConnection.close();
    } catch {
      // NO STALE CONNECTIONS.
    }

    this.#connection = await createConnection({
      type: "cockroachdb",
      url: this.uri,
      synchronize: true,
      ssl: true,
      entities: [OsuDroidScore, OsuDroidStats, OsuDroidUser],
    });

    return this.#connection;
  }
}
