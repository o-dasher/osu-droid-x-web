import { NextApiResponse } from "next";
import HttpStatusCode from "../api/enums/HttpStatusCodes";
import IHasAppSignature from "../api/query/IHasAppSignature";
import IHasDeviceID from "../api/query/IHasDeviceID";
import IHasHash from "../api/query/IHasHash";
import IHasSSID from "../api/query/IHasSSID";
import IHasUserID from "../api/query/IHasUserID";
import IHasUsername from "../api/query/IHasUsername";
import Responses from "../api/response/Responses";
import OsuDroidUser from "../database/entities/OsuDroidUser";
import RequestValidator from "./RequestValidator";

export default class DroidRequestValidator extends RequestValidator {
  static validateUsername(args: Partial<IHasUsername>): args is IHasUsername {
    return typeof args.username === "string";
  }

  static validateUserID<T extends string | number>(
    args: Partial<IHasUserID<T>>
  ): args is IHasUserID<T> {
    return args.userID !== undefined && args.userID !== null;
  }

  static validateDeviceID(args: Partial<IHasDeviceID>): args is IHasDeviceID {
    return typeof args.deviceID === "string";
  }

  static validateSSID(args: Partial<IHasSSID>) {
    return typeof args.ssid === "string";
  }

  static validateHash(args: Partial<IHasHash>) {
    return typeof args.hash === "string";
  }

  static validateSign(
    args: Partial<IHasAppSignature>
  ): args is IHasAppSignature {
    return typeof args.sign === "string";
  }

  static droidStringEndOnInvalidRequest(
    res: NextApiResponse<string>,
    validated: boolean,
    invalidResponse: string = Responses.INVALID_REQUEST_BODY
  ): boolean {
    return super.endOnInvalidRequest(
      res,
      validated,
      Responses.FAILED(invalidResponse)
    );
  }

  static sendUserNotFound(
    res: NextApiResponse,
    user: OsuDroidUser | undefined
  ): user is undefined {
    if (!user) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(Responses.FAILED(Responses.USER_NOT_FOUND));
      return true;
    }
    return false;
  }
}
