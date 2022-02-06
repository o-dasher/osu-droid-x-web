import { NextApiResponse } from "next";
import HttpStatusCode from "../api/enums/HttpStatusCodes";
import NextApiRequestTypedBody, {
  ValidatedNextApiRequestTypedBody,
} from "../api/query/NextApiRequestTypedBody";
import Responses from "../api/response/Responses";
import IHasID from "../interfaces/IHasID";

export default class RequestValidator {
  static hasNumericID(
    request: NextApiRequestTypedBody<IHasID>
  ): request is ValidatedNextApiRequestTypedBody<IHasID> {
    return typeof request.body.id === "number";
  }

  static untypedValidation<T>(
    body: T,
    ...validators: ((body: T) => boolean)[]
  ) {
    return validators
      .map((validator) => validator(body))
      .every((res) => res === true);
  }

  static endOnInvalidRequest<T>(
    res: NextApiResponse<T>,
    validated: boolean,
    invalidResponse: T
  ) {
    if (!validated) {
      console.log(Responses.INVALID_REQUEST_BODY);
      this.sendInvalidRequest(res, invalidResponse);
      return true;
    }
    return false;
  }

  static sendInvalidRequest<T>(res: NextApiResponse<T>, invalidResponse: T) {
    res.status(HttpStatusCode.BAD_REQUEST).send(invalidResponse);
  }
}
