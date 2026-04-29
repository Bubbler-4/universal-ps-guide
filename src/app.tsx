import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createResource, Suspense } from "solid-js";
import { getRequestEvent } from "solid-js/web";
import { getServerSession } from "~/lib/auth";
import { getCloudflareEnv } from "~/server/env";
import TopBar from "~/components/TopBar";
import "./app.css";

async function fetchSession() {
  "use server";
  const event = getRequestEvent();
  if (!event) return null;
  const env = getCloudflareEnv(event);
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
