import { Connection, createConnection, getConnectionManager } from "typeorm";
import OsuDroidScore from "./entities/OsuDroidScore";
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
    } else {
      this.#connection = getConnectionManager().connections[0];
      if (this.#connection) return this.#connection;
    }

    this.#connection = await createConnection({
      type: "cockroachdb",
      url: this.uri,
      synchronize: true,
      logging: true,
      ssl: true,
      entities: [OsuDroidScore, OsuDroidUser],
    });

    return this.#connection;
  }
}
