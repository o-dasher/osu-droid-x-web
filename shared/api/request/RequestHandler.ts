import assert from "assert";
import { NextApiRequest, NextApiResponse } from "next";
import EnumUtils from "../enums/EnumUtils";
import HTTPMethod from "../enums/HttpMethod";
import HttpStatusCode from "../enums/HttpStatusCodes";

export default class RequestHandler {
  public static endWhenInvalidHttpMethod(
    req: NextApiRequest,
    res: NextApiResponse,
    ...validMethods: HTTPMethod[]
  ): boolean {
    assert(validMethods.length > 0);

    const end = () => {
      res.status(HttpStatusCode.BAD_REQUEST).end();
    };

    if (!req.method) {
      end();
      return false;
    }

    const method = EnumUtils.getValueByKey<HTTPMethod>(HTTPMethod, req.method);

    if (!method) {
      end();
      return false;
    }

    if (!validMethods.includes(method)) {
      end();
      return false;
    }

    return true;
  }
}
