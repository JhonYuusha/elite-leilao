import { rateLimit } from "express-rate-limit";

export const LOGIN_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
export const LOGIN_RATE_LIMIT_MAX = 10;

export const LOGIN_RATE_LIMIT_MESSAGE = {
  error:
    "Muitas tentativas de login. Tente novamente em alguns minutos.",
};

export function createLoginRateLimit(
  options: { skipInTests?: boolean } = {},
) {
  const { skipInTests = false } = options;

  return rateLimit({
    windowMs: LOGIN_RATE_LIMIT_WINDOW_MS,
    limit: LOGIN_RATE_LIMIT_MAX,

    standardHeaders: "draft-8",
    legacyHeaders: false,

    skip: () =>
      skipInTests && process.env.NODE_ENV === "test",

    message: LOGIN_RATE_LIMIT_MESSAGE,
  });
}

export const loginRateLimit = createLoginRateLimit({
  skipInTests: true,
});