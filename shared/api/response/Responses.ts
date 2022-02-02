enum DroidAPIResponses {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
}

export default class Responses {
  public static INVALID_REQUEST_BODY = "Invalid request body.";
  public static USER_NOT_FOUND = "User not found.";

  private static BUILD(type: DroidAPIResponses, ...args: string[]) {
    return `${type}\n${args.join(" ")}`;
  }

  public static SUCCESS(...args: string[]) {
    return this.BUILD(DroidAPIResponses.SUCCESS, ...args);
  }

  public static FAILED(...args: string[]) {
    return this.BUILD(DroidAPIResponses.FAILED, ...args);
  }
}
