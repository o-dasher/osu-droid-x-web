import assert from "assert";
import { NextApiRequest, NextApiResponse } from "next";
import EnumUtils from "../enums/EnumUtils";
import HTTPMethod from "../enums/HttpMethod";
import HttpStatusCode from "../enums/HttpStatusCodes";
import Responses from "../response/Responses";

export default class RequestHandler {
  static endWhenInvalidHttpMethod(
    req: NextApiRequest,
    res: NextApiResponse,
    ...validMethods: HTTPMethod[]
  ): boolean {
    assert(validMethods.length > 0);

    const end = () => {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(Responses.FAILED("Invalid HTTP METHOD."));
    };

    if (!req.method) {
      end();
      return true;
    }

    const method = EnumUtils.getValueByKey<HTTPMethod>(HTTPMethod, req.method);

    if (!method) {
      end();
      return true;
    }

    if (!validMethods.includes(method)) {
      end();
      return true;
    }

    return false;
  }
}
