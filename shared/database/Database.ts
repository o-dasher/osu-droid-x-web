import { secondsToMilliseconds } from "date-fns";
import NodeCache from "node-cache";
import { Connection, createConnection, getConnection } from "typeorm";
import InMemoryCacheProvider from "typeorm-in-memory-cache";
import { OsuDroidScore, OsuDroidStats, OsuDroidUser } from "./entities";

export default class Database {
  static uri = process.env["DATABASE_URL"];
  static #connection?: Connection;

  static databaseCache: InMemoryCacheProvider;
  static nodeCache = new NodeCache();

  /**
   * this method in used on serverless backend environments
   * in which the connection may be closed regarding to inactivity.
   * @returns The cached connection.
   */
  public static async getConnection(): Promise<Connection> {
    if (!this.databaseCache) {
      this.databaseCache = new InMemoryCacheProvider(this.nodeCache);
    }

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
      cache: {
        provider: () => this.databaseCache,
        type: "database",
        alwaysEnabled: true,
        duration: secondsToMilliseconds(60),
      },
    });

    return this.#connection;
  }
}
