import { NextApiResponse } from "next";
import HttpStatusCode from "../api/enums/HttpStatusCodes";
import IHasApiKey from "../api/query/IHasApiKey";
import IHasEmail from "../api/query/IHasEmail";
import IHasPassword from "../api/query/IHasPassword";
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

  static validateEmail(args: Partial<IHasEmail>): args is IHasEmail {
    return typeof args.email === "string";
  }

  static validatePassword(args: Partial<IHasPassword>): args is IHasPassword {
    return typeof args.password === "string";
  }

  static validateApiKey(args: Partial<IHasApiKey>): args is IHasApiKey {
    return typeof args.k === "string";
  }

  static sendInvalidRequest<T>(res: NextApiResponse<T>, invalidResponse: T) {
    res.status(HttpStatusCode.BAD_REQUEST).send(invalidResponse);
  }
}
