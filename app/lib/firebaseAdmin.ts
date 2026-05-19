import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type ServiceAccountConfig = {
  projectId?: string;
  clientEmail?: string;
  privateKey?: string;
  project_id?: string;
  client_email?: string;
  private_key?: string;
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

export function getFirebaseAdminApp(): App {
  assertServerOnly();

  const existingApp = getApps()[0];

  if (existingApp) {
    return existingApp;
  }

  const serviceAccount = validateServiceAccount(serviceAccountFromEnv());

  try {
    return initializeApp({
      credential: cert(serviceAccount),
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
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(/^Bearer (.+)$/i);

  if (!match) {
    throw new Error("Authentication is required.");
  }

  try {
    return await getAdminAuth().verifyIdToken(match[1]);
  } catch {
    throw new Error("Invalid or expired Firebase authentication token.");
  }
}
