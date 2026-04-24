import { APIEvent } from "@solidjs/start/server";

export interface AuthUser {
  userId: string;
}

export async function getAuth(event: APIEvent): Promise<AuthUser | null> {
  const userId = event.request.headers.get("x-user-id");
  if (!userId) return null;
  return { userId };
}
