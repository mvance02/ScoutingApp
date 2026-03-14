import * as functions from "firebase-functions";
import express, { Request, Response } from "express";

const app = express();

app.get("/api/test", (req: Request, res: Response) => {
  res.send("Backend working!");
});

export const api = functions.https.onRequest(app);
