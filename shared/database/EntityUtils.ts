import { BaseEntity, FindConditions, ObjectID, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import IHasID from "../interfaces/IHasID";

type criteria<T> =
  | string
  | number
  | Date
  | ObjectID
  | string[]
  | number[]
  | Date[]
  | ObjectID[]
  | FindConditions<T>;
export default class EntityUtils {
  static #getEntityWithIDPartialEntityForUpdate<T extends BaseEntity & IHasID>(
    entity: T
  ) {
    const partialEntity = { ...entity } as Omit<T, keyof IHasID> &
      Partial<Pick<T, keyof IHasID>>;

    delete partialEntity.id;

    return partialEntity;
  }
  /**
   *
   * @param repository the entity repository.
   * @param entity the entity to be updated.
   */
  static async updateEntityWithID<T extends BaseEntity & IHasID>(
    repository: Repository<T>,
    entity: T,
    criteria: criteria<T> = entity.id
  ) {
    const partialEntity = this.#getEntityWithIDPartialEntityForUpdate(entity);
    await repository.update(
      criteria,
      partialEntity as QueryDeepPartialEntity<T>
    );
  }

  static async updateEntityExcludingUndefinedValues<T extends BaseEntity>(
    repository: Repository<T>,
    entity: T,
    criteria: criteria<T>
  ) {
    const partialEntity = { ...entity };
    for (const key in partialEntity) {
      if (partialEntity[key] === undefined) {
        delete partialEntity[key];
      }
    }
    await repository.update(
      criteria,
      entity as unknown as QueryDeepPartialEntity<T>
    );
  }

  static updateEntityWithIDExcludingUndefinedValues<
    T extends BaseEntity & IHasID
  >(repository: Repository<T>, entity: T, criteria: criteria<T> = entity.id) {
    const partialEntity = this.#getEntityWithIDPartialEntityForUpdate(entity);
    return this.updateEntityExcludingUndefinedValues(
      repository,
      partialEntity as T,
      criteria
    );
  }
}
