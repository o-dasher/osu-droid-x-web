export default class EnumUtils {
  public static getValueByKey<T, E = object>(
    enumObject: E,
    key: string
  ): T | undefined {
    const keys = Object.keys(enumObject);
    const values = Object.values(enumObject);
    if (values.includes(key)) {
      return keys[values.indexOf(key)] as unknown as T;
    }
    return undefined;
  }
}
