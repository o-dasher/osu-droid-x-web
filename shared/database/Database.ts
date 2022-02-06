import { Connection, createConnection, getConnection } from "typeorm";
import { OsuDroidScore, OsuDroidStats, OsuDroidUser } from "./entities";

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

    console.log("Retrieving connection...");

    try {
      const staleConnection = getConnection();
      await staleConnection.close();
      console.log("Stale connection closed.");
    } catch {
      // NO STALE CONNECTIONS.
    }

    this.#connection = await createConnection({
      type: "cockroachdb",
      url: this.uri,
      synchronize: true,
      ssl: true,
      logging: true,
      entities: [OsuDroidScore, OsuDroidStats, OsuDroidUser],
    });

    return this.#connection;
  }
}
