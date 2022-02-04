import { BaseEntity, FindConditions, ObjectID, Repository } from "typeorm";
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
    await repository.update(criteria, { ...entity, ...{ id: undefined } });
  }
}
