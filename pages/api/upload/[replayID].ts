import "reflect-metadata";
import "../../../shared/database/IncludeFirebase";

import { getBytes, getStorage, ref } from "firebase/storage";

import { NextApiResponse } from "next";
import HTTPMethod from "../../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../../shared/api/request/RequestHandler";
import Database from "../../../shared/database/Database";
import { PatchArrayAt } from "../../../shared/node/PatchArrayAt";
import DroidRequestValidator from "../../../shared/type/DroidRequestValidator";
import NipaaStorage from "../../../shared/database/NipaaStorage";
import NumberUtils from "../../../shared/utils/NumberUtils";
import HttpStatusCode from "../../../shared/api/enums/HttpStatusCodes";
import { assertDefined } from "../../../shared/assertions";

export default async function handler(
  req: NextApiRequestTypedBody<unknown>,
  res: NextApiResponse<string>
) {
  PatchArrayAt();
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { query } = req;
  const { replayID } = query;

  if (typeof replayID !== "string") {
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, false);
    return;
  }

  const numericID = parseInt(replayID);

  if (!NumberUtils.isNumber(numericID)) {
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, false);
    return;
  }

  const storage = getStorage();
  const filename = NipaaStorage.ODRFilePathFromID(numericID);
  const replayBucket = ref(storage, filename);

  let replay: ArrayBuffer;
  try {
    replay = await getBytes(replayBucket);
  } catch {
    res.status(HttpStatusCode.BAD_REQUEST).send("Replay not found.");
    return;
  }

  const buffer = Buffer.alloc(replay.byteLength);
  const view = new Uint8Array(replay);

  for (let i = 0; i < buffer.length; i++) {
    const byte = view[i];
    assertDefined(byte);
    buffer[i] = byte;
  }

  res.status(HttpStatusCode.OK).send(buffer.toString());
}
