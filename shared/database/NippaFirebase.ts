import { cert, initializeApp } from "firebase-admin/app";
import { assertDefined } from "../assertions";
import admin from "firebase-admin";

/**
 * Initializes firebase in the cloud function which the method is called.
 */
export const getNipaaFirebaseApp = () => {
  console.log("Initializing firebase...");

  const projectId = process.env["FIREBASE_PROJECT_ID"];
  const privateKey = process.env["FIREBASE_PRIVATE_KEY"];

  assertDefined(projectId);
  assertDefined(privateKey);

  const app =
    admin.apps.length === 0
      ? initializeApp({
          credential: cert({
            projectId: projectId,
            privateKey: privateKey.replace(/\\n/g, "\n"),
            clientEmail: process.env["FIREBASE_CLIENT_EMAIL"],
          }),
          storageBucket: `gs://${projectId}.appspot.com`,
        })
      : admin.app();

  console.log("Initialized firebase...");

  return app;
};
