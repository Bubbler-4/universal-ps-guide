import { A } from "@solidjs/router";
import { useI18n } from "~/lib/i18n";

export default function NotFound() {
  const { t } = useI18n();

  return (
    <main class="text-center mx-auto text-gray-700 p-4">
      <h1 class="text-4xl font-bold my-8">{t("notFound")}</h1>
      <p class="my-4">
        <A href="/" class="text-sky-600 hover:underline">
          {t("goHome")}
        </A>
      </p>
    </main>
  );
}
