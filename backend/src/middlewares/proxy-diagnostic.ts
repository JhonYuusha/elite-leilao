
import type { RequestHandler } from "express";
import { timingSafeEqual } from "node:crypto";

export const proxyDiagnostic: RequestHandler = (req, res) => {
  const expectedToken = process.env.PROXY_DIAGNOSTIC_TOKEN;
  const suppliedToken = req.get("X-Diagnostic-Token");

  if (
    process.env.PROXY_DIAGNOSTIC_ENABLED !== "true" ||
    !expectedToken ||
    !suppliedToken
  ) {
    res.sendStatus(404);
    return;
  }

  const expected = Buffer.from(expectedToken);
  const supplied = Buffer.from(suppliedToken);

  if (
    expected.length !== supplied.length ||
    !timingSafeEqual(expected, supplied)
  ) {
    res.sendStatus(404);
    return;
  }

  res.setHeader("Cache-Control", "no-store");

  res.json({
    socketIp: req.socket.remoteAddress ?? null,
    expressIp: req.ip ?? null,
    forwardedFor: req.get("X-Forwarded-For") ?? null,
    forwarded: req.get("Forwarded") ?? null,
    trustedProxyHops: req.app.get("trust proxy"),
  });
};
