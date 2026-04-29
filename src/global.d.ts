/// <reference types="@solidjs/start/env" />

declare module "@auth/core/types" {
  interface Session {
    user: {
      name?: string | null;
      email?: string | null;
      image?: string | null;
      githubId?: string;
      username?: string;
      dbUserId?: number;
      needsUsername?: boolean;
    };
  }
}
