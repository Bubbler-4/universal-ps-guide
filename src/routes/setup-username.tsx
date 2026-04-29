import { createResource, createSignal, Show } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { redirect, useNavigate } from "@solidjs/router";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";

async function checkSession() {
  "use server";
  const event = getRequestEvent()!;
  const env = getCloudflareEnv(event);
  const session = await getServerSession(event.request, env);
  if (!session) {
    throw redirect("/login");
  }
  if (!session.needsUsername) {
    throw redirect("/");
  }
  return session;
}

const USERNAME_RE = /^[a-zA-Z_-]{3,30}$/;

export default function SetupUsernamePage() {
  createResource(checkSession);

  const navigate = useNavigate();
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  const validationError = () => {
    const u = username().trim();
    if (u.length === 0) return null;
    if (!USERNAME_RE.test(u))
      return "Must be 3-30 characters: letters, underscores, or hyphens only.";
    return null;
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    const u = username().trim();
    if (!USERNAME_RE.test(u)) return;

    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch("/api/auth/setup-username", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: u }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        navigate("/");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main class="mx-auto max-w-md px-4 py-16">
      <h1 class="text-3xl font-bold text-gray-900 mb-2">Choose a Username</h1>
      <p class="text-gray-500 mb-8">
        Pick a public username. You can only set this once.
      </p>

      <form onSubmit={handleSubmit} class="flex flex-col gap-4">
        <div>
          <label for="username" class="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            autocomplete="off"
            value={username()}
            onInput={e => setUsername(e.currentTarget.value)}
            placeholder="e.g. my_handle"
            class="w-full border border-gray-300 rounded-lg px-4 py-2 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Show when={validationError()}>
            <p class="mt-1 text-sm text-red-600">{validationError()}</p>
          </Show>
        </div>

        <Show when={error()}>
          <p class="text-sm text-red-600">{error()}</p>
        </Show>

        <button
          type="submit"
          disabled={submitting() || !USERNAME_RE.test(username().trim())}
          class="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold px-6 py-2 rounded-lg transition-colors"
        >
          {submitting() ? "Saving…" : "Save Username"}
        </button>
      </form>

      <p class="mt-4 text-xs text-gray-400">
        Allowed characters: letters (a-z, A-Z), underscores (_), hyphens (-). Length: 3-30.
      </p>
    </main>
  );
}
