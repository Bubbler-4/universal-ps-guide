import { Show } from "solid-js";
import { useI18n } from "~/lib/i18n";

export default function FaqPage() {
  const { lang } = useI18n();

  return (
    <main class="mx-auto max-w-5xl px-4 py-12 text-gray-800 dark:text-gray-200">
      <h1 class="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-8">FAQ</h1>

      <Show when={lang() === "ko"} fallback={<FaqEnglish />}>
        <FaqKorean />
      </Show>
    </main>
  );
}

function FaqKorean() {
  return (
    <div class="space-y-10">
      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">번역 기여하기</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>번역은 원본 문제 본문에 충실하게 작성하거나 각색을 제거해도 됩니다. 다만, 지문이 이해하기 쉽도록 작성하는 것을 최우선으로 해 주세요.</li>
          <li>새로운 각색을 넣으면 풀이를 읽기 어려워질 수 있으므로 피해 주세요.</li>
          <li>같은 이유로, 원본 지문에 등장한 값을 나타내는 기호($N$, $M$, $A_i$ 등)는 모두 그대로 사용해 주세요.</li>
          <li>입출력 형식과 문제 제한은 모두 빠짐없이 구체적으로 옮겨 주세요. 다만, 원본 문제의 제한이 틀렸을 경우에는 가능하면 실제 데이터를 반영한 제한을 적어 주세요.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">풀이 기여하기</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>풀이는 자유롭게 작성하되, 가능하면 읽었을 때 학습에 도움이 되도록 작성해 주세요. 잘 알려진 특정 자료구조나 알고리즘을 사용하는 경우에는 해당 자료구조나 알고리즘에 대한 설명은 생략해도 됩니다.</li>
          <li>완성된 코드를 그대로 제출하는 부정행위를 방지하기 위해서, 완성된 코드를 업로드하는 것은 피해 주세요.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Markdown 도움말</h2>
        <p>다음과 같은 문법을 사용할 수 있습니다. HTML 태그는 사용할 수 없으며, 수식 렌더링 엔진은 KaTeX입니다.</p>
        <pre class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm leading-6">
{`*Italic* **Bold** ***Bold-Italic*** \`code\` $inline math$

$$
block math
$$

# Heading 1

## Heading 2

[Link](https://example.com)

![Image](https://example.com/1.png)

> Blockquote

* List
* List
  * Nested list

1. One
2. Two
3. Three

\`\`\`
code block
\`\`\`

---`}
        </pre>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">기능 추가 또는 개선 문의, 버그 제보</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            <a href="https://github.com/Bubbler-4/universal-ps-guide/issues" class="text-sky-600 dark:text-sky-400 hover:underline">
              GitHub 이슈 트래커
            </a>
            {" "}또는 solved.ac 디스코드의 1ps.guide 개발 채널에 올려 주세요.
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">사이트 추가</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>온라인 저지 사이트 추가를 원하시면 추가해 드릴 수 있습니다.</li>
          <li>BOJ(백준 온라인 저지)는 현재 사용할 수 없는 사이트이고, 다시 돌아오더라도 코드 제출이 불가능하기 때문에 사이트 추가를 고려하지 않고 있습니다.</li>
          <li>Project Euler는 문제 풀이를 공개적인 장소에 게시하는 것을 금지하고 있으므로 추가하지 않습니다.</li>
        </ul>
      </section>
    </div>
  );
}

function FaqEnglish() {
  return (
    <div class="space-y-10">
      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Contributing Translations</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>You may write a faithful translation of the original statement, and you may remove stylization/adaptation if needed. Please prioritize readability.</li>
          <li>Please avoid adding new adaptation, as it can make editorials harder to follow.</li>
          <li>For the same reason, keep symbols from the original statement as-is ($N$, $M$, $A_i$, etc.).</li>
          <li>Translate input/output format and constraints completely and concretely. If original constraints are wrong, prefer constraints that reflect real data when possible.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Contributing Editorials</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>You can write editorials freely, but please try to make them educational.</li>
          <li>If you use a well-known data structure or algorithm, you can omit basic explanations of that concept.</li>
          <li>To discourage cheating by direct copy-submission, please avoid uploading fully-submittable complete code.</li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Markdown Help</h2>
        <p>You can use the following syntax. Raw HTML tags are not allowed, and the math rendering engine is KaTeX.</p>
        <pre class="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 p-4 text-sm leading-6">
{`*Italic* **Bold** ***Bold-Italic*** \`code\` $inline math$

$$
block math
$$

# Heading 1

## Heading 2

[Link](https://example.com)

![Image](https://example.com/1.png)

> Blockquote

* List
* List
  * Nested list

1. One
2. Two
3. Three

\`\`\`
code block
\`\`\`

---`}
        </pre>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Feature Requests, Improvements, and Bug Reports</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>
            Please post on the{" "}
            <a href="https://github.com/Bubbler-4/universal-ps-guide/issues" class="text-sky-600 dark:text-sky-400 hover:underline">
              GitHub issue tracker
            </a>
            {" "}or the 1ps.guide development channel in solved.ac Discord.
          </li>
        </ul>
      </section>

      <section class="space-y-3">
        <h2 class="text-2xl font-semibold text-gray-900 dark:text-gray-100">Adding Sites</h2>
        <ul class="list-disc pl-6 space-y-2">
          <li>We can add online judge sites on request.</li>
          <li>BOJ is currently unavailable, and even if it returns, code submission is not possible, so we are not considering BOJ support.</li>
          <li>Project Euler forbids publicly posting problem solutions, so we do not add it.</li>
        </ul>
      </section>
    </div>
  );
}
