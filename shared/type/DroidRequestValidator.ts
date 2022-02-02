import { NextApiResponse } from "next";
import HttpStatusCode from "../api/enums/HttpStatusCodes";
import IHasAppSignature from "../api/query/IHasAppSignature";
import IHasDeviceID from "../api/query/IHasDeviceID";
import IHasEmail from "../api/query/IHasEmail";
import IHasHash from "../api/query/IHasHash";
import IHasPassword from "../api/query/IHasPassword";
import IHasSSID from "../api/query/IHasSSID";
import IHasUserID from "../api/query/IHasUserID";
import IHasUsername from "../api/query/IHasUsername";
import Responses from "../api/response/Responses";
import OsuDroidUser from "../database/entities/OsuDroidUser";
import RequestValidator from "./RequestValidator";

export default class DroidRequestValidator extends RequestValidator {
  public static validateUsername(
    args: Partial<IHasUsername>
  ): args is IHasUsername {
    return typeof args.username === "string";
  }

  public static validateUserID(args: Partial<IHasUserID>): args is IHasUserID {
    return typeof args.userID === "string";
  }

  public static validateDeviceID(
    args: Partial<IHasDeviceID>
  ): args is IHasDeviceID {
    return typeof args.deviceID === "string";
  }

  public static validateSSID(args: Partial<IHasSSID>) {
    return typeof args.ssid === "string";
  }

  public static validateHash(args: Partial<IHasHash>) {
    return typeof args.hash === "string";
  }

  public static validateEmail(args: Partial<IHasEmail>): args is IHasEmail {
    return typeof args.email === "string";
  }

  public static validateSign(
    args: Partial<IHasAppSignature>
  ): args is IHasAppSignature {
    return typeof args.sign === "string";
  }

  public static validatePassword(
    args: Partial<IHasPassword>
  ): args is IHasPassword {
    return typeof args.password === "string";
  }

  public static droidStringEndOnInvalidRequest(
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

  public static sendUserNotFound(
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
