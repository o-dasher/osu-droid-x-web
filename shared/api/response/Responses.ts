enum DroidAPIResponses {
  SUCCESS = "SUCCESS",
  FAIL = "FAIL",
}

export default class Responses {
  static INVALID_REQUEST_BODY = "Invalid request body.";
  static USER_NOT_FOUND = "User not found.";
  static UNEXPECTED_BEHAVIOR = "Unexpected server behavior.";

  static #BUILD(type: DroidAPIResponses, ...args: string[]) {
    return `${type}\n${this.ARRAY(...args)}`;
  }

  static ARRAY(...args: string[]) {
    return args.join(" ");
  }

  static SUCCESS(...args: string[]) {
    return this.#BUILD(DroidAPIResponses.SUCCESS, ...args);
  }

  static FAILED(...args: string[]) {
    return this.#BUILD(DroidAPIResponses.FAIL, ...args);
  }
}
