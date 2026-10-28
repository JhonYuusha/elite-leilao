import type { Request, Response } from "express";

import { refreshSessionConfig } from "../services/session.service.js";

export const REFRESH_COOKIE_NAME = "aureo_refresh_token";

const IS_PRODUCTION = process.env.NODE_ENV === "production";

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: IS_PRODUCTION,
    sameSite: "lax" as const,
    path: "/auth",
  };
}

export function setRefreshCookie(
  res: Response,
  refreshToken: string,
): void {
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, {
    ...getCookieOptions(),
    maxAge: refreshSessionConfig.durationMs,
  });
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE_NAME, getCookieOptions());
}

export function readRefreshCookie(req: Request): string | null {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return null;
  }

  const cookies = cookieHeader.split(";");

  for (const cookie of cookies) {
    const separator = cookie.indexOf("=");

    if (separator === -1) {
      continue;
    }

    const name = cookie.slice(0, separator).trim();

    if (name !== REFRESH_COOKIE_NAME) {
      continue;
    }

    const value = cookie.slice(separator + 1).trim();

    try {
      return decodeURIComponent(value);
    } catch {
      return null;
    }
  }

  return null;
}