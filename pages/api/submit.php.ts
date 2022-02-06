import "reflect-metadata";

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
import Database from "../../shared/database/Database";
import { assertDefined } from "../../shared/assertions";
import { PatchArrayAt } from "../../shared/node/PatchArrayAt";
import OsuDroidGameMode from "../../shared/osu_droid/enum/OsuDroidGameMode";
import SubmissionStatus from "../../shared/osu_droid/enum/SubmissionStatus";

type body = IHasUserID<string> &
  Partial<IHasData<string> & { playID: string } & IHasSSID & IHasHash>;

const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.validateUserID(body);
};

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  PatchArrayAt();
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { body } = req;
  const { ssid, hash, data } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  let user: OsuDroidUser<OsuDroidGameMode> | undefined;

  if (
    DroidRequestValidator.untypedValidation(
      body,
      DroidRequestValidator.validateHash,
      DroidRequestValidator.validateSSID
    )
  ) {
    assertDefined(hash);
    assertDefined(ssid);

    console.log("Submission playing ping.");

    user = await OsuDroidUser.findOne({
      select: ["playing", "uuid"],
    });

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    if (ssid !== user.uuid) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(
          Responses.FAILED("Error while approving login, please try again.")
        );
      return;
    }

    if (user.playing !== hash) {
      user.playing = hash;
      await user.save();
    }

    res
      .status(HttpStatusCode.OK)
      .send(Responses.SUCCESS((1).toString(), user.id.toString()));
  } else if (typeof data === "string") {
    console.log("Submitting a score...");

    /**
     * although pp and accuracy is calculated regardless of then being queried here or not (Work as intended.)
     * we still load then because we may use the already present values if we can't actually submit the score
     * for other reasons, such as passing to the client if necessary.
     */
    user = await OsuDroidUser.findOneWithStatistics({
      select: ["id", "username", "playing"],
    });

    const score = await OsuDroidScore.fromSubmission(data, user);

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    const sendSuccessResponse = async () => {
      assertDefined(user);

      if (!score.isBeatmapSubmittable()) {
        throw "The score must be done on a submittable beatmap to be uploaded.";
      }

      const canSubmit = score.status === SubmissionStatus.BEST;
      const extraResponse: string[] = [];

      if (canSubmit) {
        console.log("Saving a submitted score into the database...");

        await score.save();

        await user.submitScore(score);
        await user.statistics.calculate(score);

        extraResponse.push(score.id.toString());
      }

      user.lastSeen = new Date();

      console.log("Saving a user who submitted a score...");

      await user.save();

      const userRank = await user.statistics.getGlobalRank();

      const response: string[] = [
        userRank.toString(),
        user.statistics.metric.toString(),
        user.statistics.accuracyDroid.toString(),
        score.rank.toString(),
        ...extraResponse,
      ];

      console.log("Saving a user who submitted a score to the database...");

      res.status(HttpStatusCode.OK).send(Responses.SUCCESS(...response));
    };

    if (score.status === SubmissionStatus.FAILED) {
      if (score.isBeatmapSubmittable()) {
        await sendSuccessResponse();
      } else {
        res
          .status(HttpStatusCode.BAD_REQUEST)
          .send(
            Responses.FAILED(`Failed to submit score. (approved = ${false})`)
          );
      }
      return;
    }

    await sendSuccessResponse();
  } else {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED(Responses.UNEXPECTED_BEHAVIOR));
  }
}
