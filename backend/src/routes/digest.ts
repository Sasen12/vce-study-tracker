import { Router } from "express";
import { asyncHandler, HttpError } from "../utils/http.js";
import { unsubscribeWeeklyDigest } from "../services/weeklyDigestService.js";

export const digestRouter = Router();

const page = (title: string, body: string) => `
  <!doctype html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${title}</title>
      <style>
        body {
          margin: 0;
          min-height: 100vh;
          display: grid;
          place-items: center;
          background: #07111d;
          color: #f4f7ff;
          font-family: Arial, sans-serif;
        }
        main {
          width: min(520px, calc(100vw - 32px));
          border: 1px solid #1f4260;
          border-radius: 8px;
          background: #0f1d2d;
          padding: 28px;
        }
        h1 {
          margin: 0 0 10px;
          font-size: 30px;
        }
        p {
          color: #a8b3ca;
          line-height: 1.5;
        }
        a {
          color: #38bdf8;
          font-weight: 700;
        }
      </style>
    </head>
    <body>
      <main>
        <h1>${title}</h1>
        <p>${body}</p>
        <p><a href="https://www.vceforge.space">Back to VCE Forge</a></p>
      </main>
    </body>
  </html>
`;

digestRouter.get(
  "/unsubscribe/:token",
  asyncHandler(async (req, res) => {
    const user = await unsubscribeWeeklyDigest(req.params.token);
    if (!user) {
      throw new HttpError(400, "This unsubscribe link is invalid or expired.");
    }

    res
      .status(200)
      .type("html")
      .send(page("Weekly emails turned off", "You will not receive the VCE Forge weekly digest anymore."));
  })
);
