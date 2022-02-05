import "reflect-metadata";

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
import Responses from "../../shared/api/response/Responses";
import OsuDroidUser from "../../shared/database/entities/OsuDroidUser";
import IHasPassword from "../../shared/api/query/IHasPassword";
import Database from "../../shared/database/Database";

const MIN_USERNAME_LENGTH = 3;

type body = IHasUsername &
  IHasDeviceID &
  IHasEmail &
  IHasAppSignature &
  IHasPassword;

const validate = (body: Partial<body>): body is body => {
  return DroidRequestValidator.untypedValidation(
    body,
    DroidRequestValidator.validateUsername,
    DroidRequestValidator.validateDeviceID,
    DroidRequestValidator.validateEmail,
    DroidRequestValidator.validateSign,
    DroidRequestValidator.validatePassword
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

  if (
    DroidRequestValidator.droidStringEndOnInvalidRequest(res, validate(body)) ||
    !validate(body)
  ) {
    return;
  }

  const { username, password, deviceID, email } = body;

  if (username.length < MIN_USERNAME_LENGTH) {
    res
      .status(HttpStatusCode.BAD_REQUEST)
      .send(
        Responses.FAILED(
          `Username must be longer than ${MIN_USERNAME_LENGTH} characters.`
        )
      );
    return;
  }

  const existingUser = await OsuDroidUser.findOne({
    where: {
      username,
      email,
    },
    select: ["username", "email"],
  });

  if (existingUser) {
    if (existingUser.email === email) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(Responses.FAILED(`User with selected email already exists.`));
      return;
    } else if (existingUser.username === username) {
      res
        .status(HttpStatusCode.BAD_REQUEST)
        .send(Responses.FAILED(`User with selected username already exists.`));
      return;
    } else {
      throw "unexpected behavior.";
    }
  }

  const user = new OsuDroidUser().applyDefaults();

  user.username = username;
  user.deviceIDS.push(deviceID);
  user.setEmail(email);

  await user.setPassword(password);

  await user.save();

  // TODO VALIDATE APP SIGNATURE?.

  console.log(
    `Registered new user: (id: ${user.id}, username: ${user.username})`
  );

  res.status(HttpStatusCode.OK).send(Responses.SUCCESS("Account created."));
}
