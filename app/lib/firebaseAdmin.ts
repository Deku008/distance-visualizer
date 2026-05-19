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
  project_id?: string;
  client_email?: string;
  private_key?: string;
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

function normalizePrivateKey(privateKey: string) {
  const normalizedKey = privateKey.replace(/\\n/g, "\n").trim();

  if (!normalizedKey.includes("BEGIN PRIVATE KEY") || !normalizedKey.includes("END PRIVATE KEY")) {
    throw new Error("FIREBASE_PRIVATE_KEY is not a valid PEM private key.");
  }

  return normalizedKey;
}

function parseServiceAccountJson(encodedConfig: string) {
  try {
    return JSON.parse(encodedConfig) as ServiceAccountConfig;
  } catch {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY must be valid JSON.");
  }
}

function serviceAccountFromEnv(): ServiceAccountConfig | undefined {
  const encodedConfig = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

  if (encodedConfig) {
    const parsed = parseServiceAccountJson(encodedConfig);
    const privateKey = parsed.privateKey ?? parsed.private_key;

    return {
      projectId: parsed.projectId ?? parsed.project_id,
      clientEmail: parsed.clientEmail ?? parsed.client_email,
      privateKey: privateKey ? normalizePrivateKey(privateKey) : undefined,
    };
  }

  return {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY
      ? normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY)
      : undefined,
  };
}

function validateServiceAccount(serviceAccount: ServiceAccountConfig | undefined) {
  const missingFields = [
    ["FIREBASE_PROJECT_ID", serviceAccount?.projectId],
    ["FIREBASE_CLIENT_EMAIL", serviceAccount?.clientEmail],
    ["FIREBASE_PRIVATE_KEY", serviceAccount?.privateKey],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missingFields.length > 0) {
    throw new Error(`Firebase Admin credentials are missing: ${missingFields.join(", ")}.`);
  }

  return {
    projectId: serviceAccount?.projectId as string,
    clientEmail: serviceAccount?.clientEmail as string,
    privateKey: serviceAccount?.privateKey as string,
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

  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = validateServiceAccount(serviceAccountFromEnv());
  validateProjectMatch(serviceAccount.projectId);

  try {
    logAuthDebug("Initializing Admin SDK", {
      adminProjectId: serviceAccount.projectId,
      clientProjectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? null,
      clientEmail: serviceAccount.clientEmail,
      existingApps: getApps().length,
    });

    return initializeApp({
      credential: cert(serviceAccount),
      projectId: serviceAccount.projectId,
    });
  } catch (error) {
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
