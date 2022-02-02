import "reflect-metadata";

import { Connection, createConnection, getConnectionManager } from "typeorm";
import OsuDroidScore from "./entities/OsuDroidScore";
import OsuDroidUser from "./entities/OsuDroidUser";

export default class Database {
  static uri = process.env["DATABASE_URL"];
  static #connection: Connection;

  public static async getConnection(): Promise<Connection> {
    if (!this.#connection) {
      const connectionManager = getConnectionManager();
      if (connectionManager.connections.length > 0) {
        this.#connection = connectionManager.connections[0];
        return this.#connection;
      }
    }

    if (this.#connection) {
      return this.#connection;
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
