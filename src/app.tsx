import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createResource, Suspense } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { getServerSession } from "~/lib/auth";
import type { CloudflareEnv } from "~/lib/auth";
import TopBar from "~/components/TopBar";
import "./app.css";

async function fetchSession() {
  "use server";
  const event = getRequestEvent()!;
  const ctx = event.nativeEvent.context as {
    cloudflare?: { env?: CloudflareEnv };
  };
  const env: CloudflareEnv = ctx.cloudflare?.env ?? {};
  return getServerSession(event.request, env);
}

export default function App() {
  const [session] = createResource(fetchSession);

  return (
    <Router
      root={props => (
        <Suspense>
          <TopBar session={session() ?? null} />
          {props.children}
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
