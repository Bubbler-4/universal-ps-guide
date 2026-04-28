import { A } from "@solidjs/router";

export default function NotFound() {
  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="text-4xl font-bold my-8">404 — Not Found</h1>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          Go Home
        </A>
      </p>
    </main>
  );
}
