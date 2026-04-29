import { createResource } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { redirect } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import type { CloudflareEnv } from "~/lib/auth";

async function checkSession() {
  "use server";
  const event = getRequestEvent()!;
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: CloudflareEnv };
  };
  const env: CloudflareEnv = ctx.cloudflare?.env ?? {};
  const session = await getServerSession(event.request, env);
  if (session && !session.needsUsername) {
    throw redirect("/");
  }
  return session;
}

export default function LoginPage() {
  createResource(checkSession);

  return (
    <main class="mx-auto max-w-md px-4 py-16 text-center">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Sign In</h1>
      <p class="text-gray-500 mb-10">
        Sign in to submit translations, solutions, and vote on content.
      </p>
      <a
        href="/api/auth/signin/github"
        class="inline-flex items-center gap-3 bg-gray-900 hover:bg-gray-700 text-white font-semibold px-6 py-3 rounded-lg text-base transition-colors shadow-md"
      >
        <svg
          aria-hidden="true"
          class="w-5 h-5 fill-current"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61-.546-1.385-1.335-1.755-1.335-1.755-1.09-.745.083-.73.083-.73 1.205.085 1.84 1.236 1.84 1.236 1.07 1.835 2.807 1.305 3.492.997.108-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23A11.51 11.51 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.29-1.552 3.297-1.23 3.297-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.807 5.625-5.48 5.92.43.37.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z" />
        </svg>
        Continue with GitHub
      </a>
    </main>
  );
}
