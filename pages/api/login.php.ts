import type { NextApiResponse } from "next";
import HTTPMethod from "../../shared/api/enums/HttpMethod";
import HttpStatusCode from "../../shared/api/enums/HttpStatusCodes";
import NextApiRequestTypedBody from "../../shared/api/query/NextApiRequestTypedBody";
import RequestHandler from "../../shared/api/request/RequestHandler";
import IHasUsername from "../../shared/api/query/IHasUsername";
import IHasDeviceID from "../../shared/api/query/IHasDeviceID";
import IHasEmail from "../../shared/api/query/IHasEmail";
import IHasAppSignature from "../../shared/api/query/IHasAppSignature";
import DroidRequestValidator from "../../shared/type/DroidRequestValidator";
import OsuDroidUser from "../../shared/database/entities/OsuDroidUser";
import IHasPassword from "../../shared/api/query/IHasPassword";
import Responses from "../../shared/api/response/Responses";
import Database from "../../shared/database/Database";
import passwordHasher from "password-hash";

const MIN_USERNAME_LENGTH = 3;

type body = IHasUsername & IHasPassword;

const validate = (
  body: Partial<body>
): body is IHasUsername &
  IHasDeviceID &
  IHasEmail &
  IHasAppSignature &
  IHasPassword => {
  return DroidRequestValidator.untypedValidation(
    body,
    DroidRequestValidator.validateUsername,
    DroidRequestValidator.validatePassword
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

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(
      res,
      validate(req.body)
    ) ||
    !validate(req.body)
  ) {
    return;
  }

  const { username, password } = req.body;

  const user = await OsuDroidUser.findOne(undefined, {
    where: {
      username,
    },
    select: ["password", "uuid", "rank", "totalScore", "accuracy", "username"],
  });

  if (DroidRequestValidator.sendUserNotFound(res, user)) {
    return;
  }

  if (username.length < MIN_USERNAME_LENGTH) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(
        Responses.FAILED(
          `Username must have more than ${MIN_USERNAME_LENGTH} characters.`
        )
      );
  }

  const validatedPassword = passwordHasher.verify(password, user.password);

  if (!validatedPassword) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(Responses.FAILED("Wrong password."));
    return;
  }

  user.lastSeen = new Date();

  res
    .status(HttpStatusCode.OK)
    .send(
      Responses.SUCCESS(
        user.id.toString(),
        user.uuid,
        user.rank.toString(),
        user.totalScore.toString(),
        user.accuracy.toString(),
        user.username,
        ""
      )
    );
}
