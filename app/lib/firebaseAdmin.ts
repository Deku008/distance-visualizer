import "server-only";

import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

const AUTH_HEADER_PATTERN = /^Bearer\s+(.+)$/i;

export class ApiAuthError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 401, code = "AUTH_REQUIRED") {
    super(message);
    this.name = "ApiAuthError";
    this.status = status;
    this.code = code;
  }
}

type ServiceAccountConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
};

type DecodedTokenPreview = {
  aud?: unknown;
  iss?: unknown;
  sub?: unknown;
  exp?: unknown;
  auth_time?: unknown;
  firebase?: {
    sign_in_provider?: unknown;
  };
};

function assertServerOnly() {
  if (typeof window !== "undefined") {
    throw new Error("Firebase Admin can only be initialized on the server.");
  }
}

function unwrapEnvValue(value: string) {
  const trimmedValue = value.trim();
  const firstChar = trimmedValue[0];
  const lastChar = trimmedValue[trimmedValue.length - 1];
  const isWrapped =
    trimmedValue.length >= 2 &&
    ((firstChar === '"' && lastChar === '"') ||
      (firstChar === "'" && lastChar === "'") ||
      (firstChar === "`" && lastChar === "`"));

  return isWrapped ? trimmedValue.slice(1, -1).trim() : trimmedValue;
}

function normalizePrivateKey(privateKey: string) {
  const normalizedKey = unwrapEnvValue(privateKey)
    .replace(/\\n/g, "\n")
    .replace(/\r\n/g, "\n")
    .trim();

  if (!normalizedKey.includes("BEGIN PRIVATE KEY") || !normalizedKey.includes("END PRIVATE KEY")) {
    throw new Error(
      "FIREBASE_PRIVATE_KEY is not a valid PEM private key. Check Vercel env formatting and newline escaping.",
    );
  }

  return normalizedKey;
}

function serviceAccountFromEnv(): ServiceAccountConfig {
  return {
    projectId: process.env.FIREBASE_PROJECT_ID
      ? unwrapEnvValue(process.env.FIREBASE_PROJECT_ID)
      : undefined,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL
      ? unwrapEnvValue(process.env.FIREBASE_CLIENT_EMAIL)
      : undefined,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
  };
}

function validateServiceAccount(serviceAccount: ServiceAccountConfig) {
  const missingFields = [
    ["FIREBASE_PROJECT_ID", serviceAccount?.projectId],
    ["FIREBASE_CLIENT_EMAIL", serviceAccount?.clientEmail],
    ["FIREBASE_PRIVATE_KEY", serviceAccount?.privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingFields.length > 0) {
    console.error("[Firebase Auth] Missing Firebase Admin environment variables", {
      missingFields,
      ...firebaseAdminEnvDebug(),
    });
    throw new Error(`Firebase Admin credentials are missing: ${missingFields.join(", ")}.`);
  }

  if (!serviceAccount?.clientEmail?.includes("@")) {
    throw new Error("FIREBASE_CLIENT_EMAIL must be a valid Firebase service account email.");
  }

  return {
    projectId: serviceAccount.projectId as string,
    clientEmail: serviceAccount.clientEmail as string,
    privateKey: normalizePrivateKey(serviceAccount.privateKey as string),
  };
}

function maskServiceAccountEmail(clientEmail: string) {
  const [name, domain] = clientEmail.split("@");

  if (!domain) {
    return "<invalid-email>";
  }

  return `${name.slice(0, 12)}...@${domain}`;
}

function firebaseAdminEnvDebug() {
  return {
    hasFirebaseProjectId: Boolean(process.env.FIREBASE_PROJECT_ID),
    hasFirebaseClientEmail: Boolean(process.env.FIREBASE_CLIENT_EMAIL),
    hasFirebasePrivateKey: Boolean(process.env.FIREBASE_PRIVATE_KEY),
    privateKeyLength: process.env.FIREBASE_PRIVATE_KEY?.length ?? 0,
    clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    vercelEnvironment: process.env.VERCEL_ENV ?? null,
  };
}

function validateProjectMatch(adminProjectId: string) {
  const clientProjectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (clientProjectId && clientProjectId !== adminProjectId) {
    throw new Error(
      `Firebase project mismatch: NEXT_PUBLIC_FIREBASE_PROJECT_ID is "${clientProjectId}" but FIREBASE_PROJECT_ID is "${adminProjectId}".`,
    );
  }
}

function parseBearerToken(request: Request) {
  const authorization = request.headers.get("authorization")?.trim();
  const match = authorization?.match(AUTH_HEADER_PATTERN);
  const token = match?.[1]?.trim();

  return token || undefined;
}

function decodeTokenPreview(token: string): DecodedTokenPreview | undefined {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return undefined;
    }

    const base64Payload = payload.replace(/-/g, "+").replace(/_/g, "/");
    const normalizedPayload = base64Payload.padEnd(base64Payload.length + ((4 - (base64Payload.length % 4)) % 4), "=");
    const decodedPayload = Buffer.from(normalizedPayload, "base64").toString("utf8");
    return JSON.parse(decodedPayload) as DecodedTokenPreview;
  } catch {
    return undefined;
  }
}

function logAuthDebug(stage: string, details: Record<string, unknown>) {
  console.info(`[Firebase Auth] ${stage}`, details);
}

export function getFirebaseAdminApp(): App {
  assertServerOnly();

  if (getApps().length) {
    return getApps()[0];
  }

  const serviceAccount = validateServiceAccount(serviceAccountFromEnv());
  validateProjectMatch(serviceAccount.projectId);

  try {
    logAuthDebug("Initializing Admin SDK", {
      ...firebaseAdminEnvDebug(),
      adminProjectId: serviceAccount.projectId,
      clientEmail: maskServiceAccountEmail(serviceAccount.clientEmail),
      existingApps: getApps().length,
      privateKeyLines: serviceAccount.privateKey.split("\n").length,
    });

    const app = initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });

    logAuthDebug("Admin SDK initialized successfully", {
      ...firebaseAdminEnvDebug(),
      adminProjectId: serviceAccount.projectId,
      appName: app.name,
      existingApps: getApps().length,
    });

    return app;
  } catch (error) {
    console.error("[Firebase Auth] Admin SDK initialization failed", {
      ...firebaseAdminEnvDebug(),
      adminProjectId: serviceAccount.projectId,
      errorMessage: error instanceof Error ? error.message : "Unknown initialization error.",
    });
    throw new Error(
      `Firebase Admin initialization failed: ${
        error instanceof Error ? error.message : "Unknown initialization error."
      }`,
    );
  }
}

export function getAdminAuth() {
  return getAuth(getFirebaseAdminApp());
}

export function getAdminDb() {
  return getFirestore(getFirebaseAdminApp());
}

export async function requireFirebaseUser(request: Request) {
  const token = parseBearerToken(request);

  if (!token) {
    logAuthDebug("Missing bearer token", {
      path: new URL(request.url).pathname,
      hasAuthorizationHeader: Boolean(request.headers.get("authorization")),
    });
    throw new ApiAuthError("Please sign in to continue.", 401, "AUTH_REQUIRED");
  }

  const preview = decodeTokenPreview(token);
  const expectedProjectId = process.env.FIREBASE_PROJECT_ID;
  const tokenAudience = typeof preview?.aud === "string" ? preview.aud : undefined;
  const tokenIssuer = typeof preview?.iss === "string" ? preview.iss : undefined;
  const tokenExpiresAt =
    typeof preview?.exp === "number" ? new Date(preview.exp * 1000).toISOString() : undefined;

  logAuthDebug("Verifying ID token", {
    path: new URL(request.url).pathname,
    expectedProjectId,
    clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
    tokenAudience: tokenAudience ?? null,
    tokenIssuer: tokenIssuer ?? null,
    tokenSubject: typeof preview?.sub === "string" ? preview.sub : null,
    tokenExpiresAt: tokenExpiresAt ?? null,
    signInProvider: preview?.firebase?.sign_in_provider ?? null,
  });

  if (tokenAudience && expectedProjectId && tokenAudience !== expectedProjectId) {
    console.warn("[Firebase Auth] Token project mismatch", {
      expectedProjectId,
      tokenAudience,
      tokenIssuer: tokenIssuer ?? null,
    });
  }

  try {
    const decodedToken = await getAdminAuth().verifyIdToken(token);

    logAuthDebug("ID token verified", {
      path: new URL(request.url).pathname,
      uid: decodedToken.uid,
      audience: decodedToken.aud,
      issuer: decodedToken.iss,
      expiresAt: new Date(decodedToken.exp * 1000).toISOString(),
    });

    return decodedToken;
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    const code =
      error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code)
        : "";
    const tokenExpired =
      code === "auth/id-token-expired" ||
      message.includes("expired") ||
      message.includes("auth/id-token-expired");
    console.warn("[Firebase Auth] ID token verification failed", {
      path: new URL(request.url).pathname,
      code: code || null,
      expectedProjectId,
      tokenAudience: tokenAudience ?? null,
      tokenIssuer: tokenIssuer ?? null,
      tokenExpiresAt: tokenExpiresAt ?? null,
      message,
    });
    throw new ApiAuthError(
      tokenExpired ? "Your session expired. Refreshing sign-in..." : "Invalid Firebase authentication token.",
      401,
      tokenExpired ? "TOKEN_EXPIRED" : "INVALID_TOKEN",
    );
  }
}

export function authErrorResponse(error: unknown) {
  if (error instanceof ApiAuthError) {
    return Response.json(
      {
        error: error.message,
        code: error.code,
      },
      { status: error.status },
    );
  }

  return undefined;
}
