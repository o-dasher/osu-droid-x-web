import "reflect-metadata";

import { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import IHasData from "../../shared/api/query/IHasData";
import IHasHash from "../../shared/api/query/IHasHash";
import IHasSSID from "../../shared/api/query/IHasSSID";
import IHasUserID from "../../shared/api/query/IHasUserID";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import Responses from "../../shared/api/response/Responses";
import { assertDefined } from "../../shared/assertions";
import Database from "../../shared/database/Database";
import { OsuDroidUser, OsuDroidScore } from "../../shared/database/entities";
import { PatchArrayAt } from "../../shared/node/PatchArrayAt";
import SubmissionStatus, {
  SubmissionStatusUtils,
} from "../../shared/osu_droid/enum/SubmissionStatus";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";

type body = IHasUserID<string> &
  Partial<IHasData<string> & { playID: string } & IHasSSID & IHasHash>;

const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.validateUserID(body);
};

PatchArrayAt();

export default async function handler(
  req: NextApiRequestTypedBody<body>,
  res: NextApiResponse<string>
) {
  await Database.getConnection();

  if (RequestHandler.endWhenInvalidHttpMethod(req, res, HTTPMethod.POST)) {
    return;
  }

  const { body } = req;
  const { ssid, hash, data, userID } = body;

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  let user: OsuDroidUser | undefined;

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

    user = await OsuDroidUser.findOne(userID, {
      select: ["id", "playing", "sessionID"],
    });

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    if (ssid !== user.sessionID) {
      console.log("Mismatch uuid");
      console.log(ssid);
      console.log(user.sessionID);

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
      where: {
        id: userID,
      },
      select: ["id", "username", "playing"],
    });

    if (DroidRequestValidator.sendUserNotFound(res, user)) {
      return;
    }

    const score = await OsuDroidScore.fromSubmission(data, user);

    const sendSuccessResponse = async () => {
      assertDefined(user);

      if (!score.isBeatmapSubmittable()) {
        throw "The score must be done on a submittable beatmap to be uploaded.";
      }

      console.log(`Submission status: ${score.status}`);

      const canSubmit = SubmissionStatusUtils.isUserBest(score.status);
      const extraResponse: string[] = [];

      if (canSubmit) {
        console.log("Saving a submitted score into the database...");

        await score.save();

        await user.statistics.calculate();

        extraResponse.push(score.id.toString());
      }

      user.lastSeen = new Date();

      console.log("Saving a user who submitted a score...");

      await user.statistics.calculateGlobalRank();

      /**
       * We save stats regardless of the score being submitted
       * because we also update our playcount on that mode.
       */
      await user.statistics.save();

      await user.save();

      const response: string[] = [
        user.statistics.rank.toString(),
        user.statistics.roundedMetric.toString(),
        user.statistics.accuracyDroid.toString(),
        score.rank.toString(),
        ...extraResponse,
      ];

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
