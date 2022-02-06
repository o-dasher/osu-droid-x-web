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

type body = { replayID: string; uploadedFile: string } & IHasHash;

const validate = (body: Partial<body>): body is body => {
  return (
    typeof body.replayID === "string" &&
    typeof body.uploadedFile === "string" &&
    DroidRequestValidator.untypedValidation(
      body,
      DroidRequestValidator.validateHash
    )
  );
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
  console.log(typeof body.uploadedFile);

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  const { replayID, uploadedFile } = body;

  const score = await OsuDroidScore.findOne(replayID, {
    select: ["id", "date"],
  });

  if (!score) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Failed to find score to upload replay."));
    return;
  }

  if (score.replay) {
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
    /**
     * We remove the score from the database.
     * safety measure.
     * we should also periodically check for scores that have the status best and didn't submit their replays.
     */
    await score.remove();

    res.status(HttpStatusCode.BAD_REQUEST).send(Responses.FAILED("Timed out."));

    return;
  }

  const replayRaw = uploadedFile.slice(191).slice(undefined, -48);

  score.replay = replayRaw;

  await score.save();

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS("Replay uploaded."));
}
