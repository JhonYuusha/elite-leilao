import axios from "axios";
import type {
  AxiosError,
  InternalAxiosRequestConfig,
} from "axios";

const API_URL =
  import.meta.env.VITE_API_URL || "http://localhost:3333";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  withCredentials: true,
});

let accessToken: string | null = null;
let sessionVersion = 0;

let refreshPromise: Promise<string | null> | null = null;
let refreshPromiseVersion: number | null = null;

type TokenListener = (token: string | null) => void;

const tokenListeners = new Set<TokenListener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function getSessionVersion(): number {
  return sessionVersion;
}

export function isCurrentSession(version: number): boolean {
  return version === sessionVersion;
}

export function subscribeToAccessToken(
  listener: TokenListener,
): () => void {
  tokenListeners.add(listener);

  return () => {
    tokenListeners.delete(listener);
  };
}

function notifyTokenChange(): void {
  for (const listener of tokenListeners) {
    listener(accessToken);
  }
}

export function setAccessToken(token: string | null): void {
  if (accessToken === token) {
    return;
  }

  accessToken = token;
  notifyTokenChange();
}

export function invalidateSession(): void {
  sessionVersion += 1;
  setAccessToken(null);
}

export function clearAccessToken(): void {
  invalidateSession();
}

interface RefreshResponse {
  accessToken: string;
  tokenType: "Bearer";
}

async function performRefresh(
  version: number,
): Promise<string | null> {
  try {
    const response = await axios.post<RefreshResponse>(
      `${API_URL}/auth/refresh`,
      {},
      {
        timeout: 10000,
        withCredentials: true,
      },
    );

    if (!isCurrentSession(version)) {
      return null;
    }

    setAccessToken(response.data.accessToken);

    return response.data.accessToken;
  } catch {
    if (isCurrentSession(version)) {
      setAccessToken(null);
    }

    return null;
  }
}

export function refreshAccessToken(): Promise<string | null> {
  const version = getSessionVersion();

  if (
    refreshPromise &&
    refreshPromiseVersion === version
  ) {
    return refreshPromise;
  }

  const promise = performRefresh(version);

  refreshPromise = promise;
  refreshPromiseVersion = version;

  void promise.finally(() => {
    if (refreshPromise === promise) {
      refreshPromise = null;
      refreshPromiseVersion = null;
    }
  });

  return promise;
}

// Aguarda uma renovação já iniciada nesta aba.
// Deve ficar fora dos interceptors.
export async function waitForPendingRefresh(): Promise<void> {
  const pending = refreshPromise;

  if (pending) {
    await pending;
  }
}

type RetryableConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
  _sessionVersion?: number;
};

api.interceptors.request.use((config) => {
  const request = config as RetryableConfig;

  if (request._sessionVersion === undefined) {
    request._sessionVersion = getSessionVersion();
  }

  const token = getAccessToken();

  if (token) {
    request.headers.set(
      "Authorization",
      `Bearer ${token}`,
    );
  } else {
    request.headers.delete("Authorization");
  }

  return request;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as
      | RetryableConfig
      | undefined;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      originalRequest.url?.includes("/auth/login") ||
      originalRequest.url?.includes("/auth/refresh") ||
      originalRequest.url?.includes("/auth/logout")
    ) {
      return Promise.reject(error);
    }

    const requestVersion =
      originalRequest._sessionVersion;

    if (
      requestVersion === undefined ||
      !isCurrentSession(requestVersion)
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    const token = await refreshAccessToken();

    if (
      !token ||
      !isCurrentSession(requestVersion)
    ) {
      return Promise.reject(error);
    }

    originalRequest.headers.set(
      "Authorization",
      `Bearer ${token}`,
    );

    return api(originalRequest);
  },
);