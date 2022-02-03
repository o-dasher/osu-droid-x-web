import { NextApiResponse } from "next";
import HttpStatusCode from "../api/enums/HttpStatusCodes";
import NextApiRequestTypedBody, {
  ValidatedNextApiRequestTypedBody,
} from "../api/query/NextApiRequestTypedBody";
import IHasID from "../interfaces/IHasID";

export default class RequestValidator {
  public static hasNumericID(
    request: NextApiRequestTypedBody<IHasID>
  ): request is ValidatedNextApiRequestTypedBody<IHasID> {
    return typeof request.body.id === "number";
  }

  public static untypedValidation<T>(
    body: T,
    ...validators: ((body: T) => boolean)[]
  ) {
    return validators
      .map((validator) => validator(body))
      .every((res) => res === true);
  }

  public static endOnInvalidRequest<T>(
    res: NextApiResponse<T>,
    validated: boolean,
    invalidResponse: T
  ) {
    if (!validated) {
      this.sendInvalidRequest(res, invalidResponse);
      return true;
    }
    return false;
  }

  public static sendInvalidRequest<T>(
    res: NextApiResponse<T>,
    invalidResponse: T
  ) {
    res.status(HttpStatusCode.BAD_REQUEST).send(invalidResponse);
  }
}
