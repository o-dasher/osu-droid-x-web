import type { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import Responses from "../../shared/api/response/Responses";
import OsuDroidUser from "../../shared/database/entities/OsuDroidUser";
import IHasUserID from "../../shared/api/query/IHasUserID";
import IHasSSID from "../../shared/api/query/IHasSSID";
import IHasHash from "../../shared/api/query/IHasHash";
import IHasData from "../../shared/api/query/IHasData";
import OsuDroidScore from "../../shared/database/entities/OsuDroidScore";
import { SubmissionStatus } from "../../shared/droid/interfaces/IOsuDroidScore";
import Database from "../../shared/database/Database";

type body = IHasUserID & IHasSSID & Partial<IHasHash & IHasData<string>>;

const validate = (body: Partial<body>): body is IHasUserID & IHasSSID => {
  return DroidRequestValidator.untypedValidation(
    body,
    DroidRequestValidator.validateUserID,
    DroidRequestValidator.validateSSID
  );
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (!RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { body } = req;
  const { userID, ssid, hash, data } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(
      res,
      !validate(body)
    ) ||
    !validate(body)
  ) {
    return;
  }

  const user = await OsuDroidUser.findOne(userID, {
    relations: ["scores"],
    select: [
      "username",
      "playing",
      "uuid",
      "playcount",
      "totalScore",
      "rankedScore",
      "pp",
    ],
  });

  if (DroidRequestValidator.sendUserNotFound(res, user)) {
    return;
  }

  if (ssid !== user.uuid) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Error while approving login, please try again."));
    return;
  }

  if (typeof hash === "string") {
    user.playing = hash;
    res
      .status(HttpStatusCode.OK)
      .send(Responses.SUCCESS((1).toString(), user.id.toString()));
  } else if (typeof data === "string") {
    const score = await OsuDroidScore.fromSubmission(data, user);

    if (score.status === SubmissionStatus.FAILED) {
      if (OsuDroidScore.isSubmittable(score.beatmap)) {
        res
          .status(HttpStatusCode.BAD_REQUEST)
          .send(Responses.FAILED("Failed to submit score."));
        return;
      } else {
        res.status(HttpStatusCode.BAD_REQUEST).send(Responses.FAILED(""));
        return;
      }
    }

    const uploadReplay = score.status === SubmissionStatus.BEST;

    user.playcount++;
    user.totalScore += score.score;

    if (OsuDroidScore.isSubmittable(score.beatmap)) {
      const bestScore = OsuDroidScore.getBestScoreFromArray(
        score.previousSubmittedScores
      );

      if (bestScore) {
        user.rankedScore -= bestScore.score;
      }

      user.rankedScore += score.score;
    } else {
      throw "Unexpected behavior while submitting score.";
    }

    await score.save();

    user.scores.push(score);

    await user.update();

    await user.save();

    res
      .status(HttpStatusCode.OK)
      .send(
        Responses.SUCCESS(
          user.rank.toString(),
          user.metric.toString(),
          user.accuracy.toString(),
          score.rank.toString(),
          uploadReplay ? score.id.toString() : ""
        )
      );
  }

  res
    .status(HttpStatusCode.BAD_REQUEST)
    .send(Responses.FAILED(Responses.INVALID_REQUEST_BODY));
}
