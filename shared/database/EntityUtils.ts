import { BaseEntity, FindConditions, ObjectID, Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import IHasID from "../interfaces/IHasID";

export default class EntityUtils {
  /**
   *
   * @param repository the entity repository.
   * @param entity the entity to be updated.
   */
  static async updateEntityWithID<T extends BaseEntity & IHasID>(
    repository: Repository<T>,
    entity: T,
    criteria:
      | string
      | number
      | Date
      | ObjectID
      | string[]
      | number[]
      | Date[]
      | ObjectID[]
      | FindConditions<T> = entity.id
  ) {
    const partialEntity = { ...entity } as Omit<T, keyof IHasID> &
      Partial<Pick<T, keyof IHasID>>;

    delete partialEntity.id;

    await repository.update(
      criteria,
      partialEntity as QueryDeepPartialEntity<T>
    );
  }
}
