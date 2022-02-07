import { FirebaseApp, FirebaseOptions, initializeApp } from "firebase/app";

const firebaseApiKey = process.env["FIREBASE_API_KEY"];
const firebaseProjectID = process.env["FIREBASE_PROJECT_ID"];

const firebaseConfig: FirebaseOptions = {
  apiKey: firebaseApiKey,
  projectId: firebaseProjectID,
  storageBucket: `${firebaseProjectID}.appspot.com`,
};

let app: FirebaseApp | undefined = undefined;

if (!app) {
  app = initializeApp(firebaseConfig);
}

export { app };
