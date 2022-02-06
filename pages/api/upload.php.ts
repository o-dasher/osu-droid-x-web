import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Database from "../../shared/database/Database";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import { OsuDroidScore } from "../../shared/database/entities";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import Responses from "../../shared/api/response/Responses";
import { differenceInSeconds } from "date-fns";
import EnvironmentConstants from "../../shared/constants/EnvironmentConstants";
import IHasHash from "../../shared/api/query/IHasHash";
import NumberUtils from "../../shared/utils/NumberUtils";

export const config = {
  api: {
    bodyParser: false,
  },
};

type body = { replayID: string } & IHasHash;

const validate = (body: Partial<body>): body is body => {
  return typeof body.replayID === "string";
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { body } = req;
  console.log(body.replayID);

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  const { replayID } = body;

  const score = await OsuDroidScore.findOne(replayID, {
    select: ["id", "date"],
  });

  if (!score) {
    console.log("Score not found.");
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Failed to find score to upload replay."));
    return;
  }

  if (score.replay) {
    console.log("Suspicious, replay is already uploaded.");
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Score already has a replay."));
    return;
  }

  const dateNow = new Date();

  if (
    differenceInSeconds(score.date, dateNow) >=
    EnvironmentConstants.EDGE_FUNCTION_LIMIT_RESPONSE_TIME
  ) {
    console.log("Suspicious, took to long to upload replay.");

    /**
     * We remove the score from the database.
     * safety measure.
     * we should also periodically check for scores that have the status best and didn't submit their replays.
     */
    await score.remove();

    res.status(HttpStatusCode.BAD_REQUEST).send(Responses.FAILED("Timed out."));

    return;
  }

  const fileName = `${replayID}.odr`;

  console.log(fileName);

  const stream = [];

  const tBody = body as unknown as Record<string, unknown>;
  for (const key in tBody) {
    if (NumberUtils.isNumber(parseInt(key))) {
      stream.push(tBody[key]);
    }
  }

  console.log(stream.values());

  // const replayRaw = stream.slice(191).slice(undefined, -48);

  await score.save();

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS("Replay uploaded."));
}
