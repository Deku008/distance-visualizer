import { authErrorResponse, requireFirebaseUser } from "@/app/lib/firebaseAdmin";

export async function withFirebaseUser<T>(
  request: Request,
  handler: (user: Awaited<ReturnType<typeof requireFirebaseUser>>) => Promise<T>,
) {
  try {
    return await handler(await requireFirebaseUser(request));
  } catch (error) {
    const response = authErrorResponse(error);

    if (response) {
      return response;
    }

    throw error;
  }
}
