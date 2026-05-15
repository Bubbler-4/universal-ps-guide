import { createContext, useContext, ParentProps } from "solid-js";
import { createSignal } from "solid-js";
import { cookieStorage, makePersisted } from "@solid-primitives/storage";

export type Lang = "en" | "ko";

const translations = {
  en: {
    // TopBar
    login: "Login",
    logout: "Logout",
    signedInAs: "Signed in as",
    finishSetup: "Finish setup",
    switchToKorean: "Switch to Korean",
    switchToEnglish: "Switch to English",
    showMenu: "Menu",
    hideMenu: "Close",
    collectionsNav: "Collections",
    faqNav: "FAQ",
    // Collections pages
    collectionId: "Collection ID",
    collectionName: "Collection Name",
    creator: "Creator",
    problemCount: "Problem Count",
    addCollection: "Add collection",
    editCollection: "Edit collection",
    deleteCollection: "Delete collection",
    deleteProblem: "Delete problem",
    collectionTitle: "Collection title",
    collectionTitlePlaceholder: "Enter collection name",
    noCollectionsYet: "No collections yet.",
    noProblemsYet: "No problems yet.",
    currentProblems: "Current Problems",
    reorder: "Reorder",
    moveUp: "Move up",
    moveDown: "Move down",
    dragToReorderProblems: "Drag problems to reorder them.",
    shortDescription: "Short description",
    shortDescriptionPlaceholder: "Optional short note",
    addProblem: "Add problem",
    addProblemToCollection: "Add problem to collection",
    collectionTitleRequired: "Collection title cannot be empty.",
    collectionProblemIdRequired: "Please enter a valid problem ID.",
    collectionProblemNotFound: "Problem not found.",
    collectionProblemAlreadyAdded: "This problem is already in the collection.",
    failedToSaveCollection: "Failed to save collection.",
    failedToDeleteCollection: "Failed to delete collection.",
    confirmDeleteCollection:
      "Are you sure you want to delete this collection? This cannot be undone.",
    previous: "Previous",
    next: "Next",
    pageXofY: "Page {x} of {y}",
    forbidden: "Forbidden",
    forbiddenCollectionEditDesc: "You can only edit your own collections.",
    // Home page
    homeSubtitle:
      "Search competitive programming problems and explore community translations and editorial solutions across major online judges.",
    searchProblem: "Search a Problem",
    onlineJudgeSiteLabel: "Online judge site",
    problemIdLabel: "Problem ID",
    problemIdPlaceholder: "Problem ID (e.g. 1234, 1234A, ABC123A)",
    search: "Search",
    recentProblems: "Recently Added Problems",
    recentTranslations: "Recently Added Translations",
    recentSolutions: "Recently Added Solutions",
    noRecentItems: "No items yet.",
    // Login page
    signIn: "Sign In",
    signInSubtitle: "Sign in to submit translations and solutions.",
    continueWithGitHub: "Continue with GitHub",
    // Setup username page
    chooseUsername: "Choose a Username",
    chooseUsernameSubtitle: "Pick a public username. You can only set this once.",
    usernameLabel: "Username",
    usernamePlaceholder: "e.g. my_handle",
    usernameValidationError:
      "Must be 3-30 characters: letters, digits, underscores, or hyphens only.",
    savingEllipsis: "Saving…",
    saveUsername: "Save Username",
    usernameAllowedChars:
      "Allowed characters: letters (a-z, A-Z), digits (0-9), underscores (_), hyphens (-). Length: 3-30.",
    somethingWentWrong: "Something went wrong. Please try again.",
    // Problem page — general
    loading: "Loading…",
    viewOriginalProblem: "View original problem ↗",
    anonymous: "Anonymous",
    by: "By",
    preview: "Preview",
    updatePreview: "Update preview",
    submittingEllipsis: "Submitting…",
    submit: "Submit",
    networkError: "Network error. Please try again.",
    backToProblem: "Back to problem",
    // Problem page — translations section
    translationsSection: "Translations",
    addTranslation: "Add translation",
    noTranslationsYet: "No translations yet.",
    selectTranslation: "Select translation",
    editTranslation: "Edit translation",
    deleteTranslation: "Delete translation",
    deletingEllipsis: "Deleting…",
    confirmDeleteTranslation:
      "Are you sure you want to delete your translation? This cannot be undone.",
    failedToDeleteTranslation: "Failed to delete translation.",
    translationContentEmpty: "Translation content cannot be empty.",
    translationAlreadySubmitted:
      "You have already submitted a translation for this problem.",
    failedToSubmitTranslation:
      "Failed to submit translation. Please check your connection and try again.",
    failedToUpdateTranslation:
      "Failed to update translation. Please check your connection and try again.",
    // Problem page — solutions section
    solutionsSection: "Solutions",
    addSolution: "Add solution",
    noSolutionsYet: "No solutions yet.",
    showingFirstNSolutions: "Showing the first {n} solutions for this problem.",
    editSolution: "Edit solution",
    deleteSolution: "Delete solution",
    expandSolution: "Expand solution",
    collapseSolution: "Collapse solution",
    confirmDeleteSolution:
      "Are you sure you want to delete your solution? This cannot be undone.",
    failedToDeleteSolution: "Failed to delete solution.",
    solutionContentEmpty: "Solution content cannot be empty.",
    failedToSubmitSolution:
      "Failed to submit solution. Please check your connection and try again.",
    failedToUpdateSolution:
      "Failed to update solution. Please check your connection and try again.",
    // Add/Edit pages — success states
    translationSubmitted: "Translation submitted!",
    translationSaved: "Your translation has been saved successfully.",
    translationUpdated: "Translation updated!",
    solutionSubmitted: "Solution submitted!",
    solutionSaved: "Your solution has been saved successfully.",
    solutionUpdated: "Solution updated!",
    // Add/Edit pages — editor
    translationEditorLabel: "Translation (CommonMark, no HTML, KaTeX math supported)",
    translationEditorPlaceholder:
      "Write your translation here. Use $...$ for inline math and $$...$$ for block math.",
    solutionEditorLabel: "Solution (CommonMark, no HTML, KaTeX math supported)",
    solutionEditorPlaceholder:
      "Write your solution here. Use $...$ for inline math and $$...$$ for block math.",
    save: "Save",
    // Heading suffixes (appended to "Site/ProblemId - ")
    addTranslationSuffix: "Add translation",
    editTranslationSuffix: "Edit translation",
    addSolutionSuffix: "Add solution",
    editSolutionSuffix: "Edit solution",
    setProblemLinkSuffix: "Set problem link",
    // No translation/solution found
    noTranslationFound: "No Translation Found",
    noTranslationFoundDesc: "You don't have an existing translation for this problem.",
    noSolutionFound: "No Solution Found",
    noSolutionFoundDesc: "You don't have access to that solution.",
    // Set link page
    problemLinkLabel: "Link to the original problem",
    problemLinkPlaceholder: "https://...",
    pleaseEnterUrl: "Please enter a URL.",
    urlMustUseHttps: "URL must use http or https.",
    pleaseEnterValidUrl: "Please enter a valid URL.",
    urlMustBeFromSite: "URL must be from {hostname}.",
    urlMustContainProblemId: "URL must contain the problem ID as a path segment.",
    saveLink: "Save link",
    failedToSaveLink: "Failed to save link. Please try again.",
    goToProblemPage: "Go to problem page",
    problemNotFoundSetLinkDesc:
      "This problem does not exist yet. Please visit the problem page to create it.",
    // Error states (shared across pages)
    problemNotFound: "Problem Not Found",
    problemNotFoundDesc: "This problem does not exist yet.",
    invalidProblem: "Invalid Problem",
    invalidProblemDesc: "The site or problem ID is not valid.",
    invalidProblemWithSolutionDesc:
      "The site, problem ID, or solution ID is not valid.",
    serverError: "Server Error",
    serverErrorDesc: "Something went wrong on our end. Please try again later.",
    // 404 page
    notFound: "404 — Not Found",
    goHome: "Go Home",
  },
  ko: {
    // TopBar
    login: "로그인",
    logout: "로그아웃",
    signedInAs: "로그인됨:",
    finishSetup: "설정 완료하기",
    switchToKorean: "한국어로 전환",
    switchToEnglish: "영어로 전환",
    showMenu: "메뉴",
    hideMenu: "닫기",
    collectionsNav: "문제집",
    faqNav: "FAQ",
    // Collections pages
    collectionId: "문제집 ID",
    collectionName: "문제집 이름",
    creator: "작성자",
    problemCount: "문제 수",
    addCollection: "문제집 추가",
    editCollection: "문제집 수정",
    deleteCollection: "문제집 삭제",
    deleteProblem: "문제 제거",
    collectionTitle: "문제집 이름",
    collectionTitlePlaceholder: "문제집 이름을 입력하세요",
    noCollectionsYet: "아직 문제집이 없습니다.",
    noProblemsYet: "아직 문제가 없습니다.",
    currentProblems: "현재 문제 목록",
    reorder: "순서 변경",
    moveUp: "위로 이동",
    moveDown: "아래로 이동",
    dragToReorderProblems: "문제를 드래그해서 순서를 바꿀 수 있습니다.",
    shortDescription: "짧은 설명",
    shortDescriptionPlaceholder: "선택 사항: 짧은 메모",
    addProblem: "문제 추가",
    addProblemToCollection: "문제집에 문제 추가",
    collectionTitleRequired: "문제집 이름을 입력해 주세요.",
    collectionProblemIdRequired: "유효한 문제 ID를 입력해 주세요.",
    collectionProblemNotFound: "문제를 찾을 수 없습니다.",
    collectionProblemAlreadyAdded: "이미 문제집에 추가된 문제입니다.",
    failedToSaveCollection: "문제집 저장에 실패했습니다.",
    failedToDeleteCollection: "문제집 삭제에 실패했습니다.",
    confirmDeleteCollection:
      "정말 이 문제집을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.",
    previous: "이전",
    next: "다음",
    pageXofY: "{x} / {y} 페이지",
    forbidden: "권한 없음",
    forbiddenCollectionEditDesc: "본인이 만든 문제집만 수정할 수 있습니다.",
    // Home page
    homeSubtitle:
      "주요 온라인 저지의 알고리즘 문제를 검색하고 커뮤니티 번역과 풀이를 탐색하세요.",
    searchProblem: "문제 검색",
    onlineJudgeSiteLabel: "온라인 저지 사이트",
    problemIdLabel: "문제 ID",
    problemIdPlaceholder: "문제 ID (예: 1234, 1234A, ABC123A)",
    search: "검색",
    recentProblems: "최근 추가된 문제",
    recentTranslations: "최근 추가된 번역",
    recentSolutions: "최근 추가된 풀이",
    noRecentItems: "아직 항목이 없습니다.",
    // Login page
    signIn: "로그인",
    signInSubtitle: "번역, 풀이를 제출하려면 로그인하세요.",
    continueWithGitHub: "GitHub으로 계속하기",
    // Setup username page
    chooseUsername: "사용자 이름 선택",
    chooseUsernameSubtitle: "공개 사용자 이름을 선택하세요. 한 번만 설정할 수 있습니다.",
    usernameLabel: "사용자 이름",
    usernamePlaceholder: "예: my_handle",
    usernameValidationError: "3~30자, 영문자, 숫자, 밑줄(_), 하이픈(-)만 허용됩니다.",
    savingEllipsis: "저장 중…",
    saveUsername: "사용자 이름 저장",
    usernameAllowedChars:
      "허용 문자: 영문자(a-z, A-Z), 숫자(0-9), 밑줄(_), 하이픈(-). 길이: 3-30.",
    somethingWentWrong: "오류가 발생했습니다. 다시 시도하세요.",
    // Problem page — general
    loading: "로딩 중…",
    viewOriginalProblem: "원본 문제 보기 ↗",
    anonymous: "익명",
    by: "작성자:",
    preview: "미리보기",
    updatePreview: "미리보기 업데이트",
    submittingEllipsis: "제출 중…",
    submit: "제출",
    networkError: "네트워크 오류가 발생했습니다. 다시 시도하세요.",
    backToProblem: "문제로 돌아가기",
    // Problem page — translations section
    translationsSection: "번역",
    addTranslation: "번역 추가",
    noTranslationsYet: "아직 번역이 없습니다.",
    selectTranslation: "번역 선택",
    editTranslation: "번역 수정",
    deleteTranslation: "번역 삭제",
    deletingEllipsis: "삭제 중…",
    confirmDeleteTranslation: "번역을 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
    failedToDeleteTranslation: "번역 삭제에 실패했습니다.",
    translationContentEmpty: "번역 내용을 입력해 주세요.",
    translationAlreadySubmitted: "이 문제에 대한 번역을 이미 제출했습니다.",
    failedToSubmitTranslation:
      "번역 제출에 실패했습니다. 연결을 확인하고 다시 시도하세요.",
    failedToUpdateTranslation:
      "번역 업데이트에 실패했습니다. 연결을 확인하고 다시 시도하세요.",
    // Problem page — solutions section
    solutionsSection: "풀이",
    addSolution: "풀이 추가",
    noSolutionsYet: "아직 풀이가 없습니다.",
    showingFirstNSolutions: "이 문제의 처음 {n}개 풀이를 표시합니다.",
    editSolution: "풀이 수정",
    deleteSolution: "풀이 삭제",
    expandSolution: "풀이 펼치기",
    collapseSolution: "풀이 접기",
    confirmDeleteSolution: "풀이를 삭제하시겠습니까? 이 작업은 취소할 수 없습니다.",
    failedToDeleteSolution: "풀이 삭제에 실패했습니다.",
    solutionContentEmpty: "풀이 내용을 입력해 주세요.",
    failedToSubmitSolution:
      "풀이 제출에 실패했습니다. 연결을 확인하고 다시 시도하세요.",
    failedToUpdateSolution:
      "풀이 업데이트에 실패했습니다. 연결을 확인하고 다시 시도하세요.",
    // Add/Edit pages — success states
    translationSubmitted: "번역이 제출되었습니다!",
    translationSaved: "번역이 성공적으로 저장되었습니다.",
    translationUpdated: "번역이 업데이트되었습니다!",
    solutionSubmitted: "풀이가 제출되었습니다!",
    solutionSaved: "풀이가 성공적으로 저장되었습니다.",
    solutionUpdated: "풀이가 업데이트되었습니다!",
    // Add/Edit pages — editor
    translationEditorLabel: "번역 (CommonMark, HTML 미지원, KaTeX 수식 지원)",
    translationEditorPlaceholder:
      "번역을 여기에 작성하세요. 인라인 수식은 $...$, 블록 수식은 $$...$$를 사용하세요.",
    solutionEditorLabel: "풀이 (CommonMark, HTML 미지원, KaTeX 수식 지원)",
    solutionEditorPlaceholder:
      "풀이를 여기에 작성하세요. 인라인 수식은 $...$, 블록 수식은 $$...$$를 사용하세요.",
    save: "저장",
    // Heading suffixes (appended to "Site/ProblemId - ")
    addTranslationSuffix: "번역 추가",
    editTranslationSuffix: "번역 수정",
    addSolutionSuffix: "풀이 추가",
    editSolutionSuffix: "풀이 수정",
    setProblemLinkSuffix: "문제 링크 설정",
    // No translation/solution found
    noTranslationFound: "번역을 찾을 수 없습니다",
    noTranslationFoundDesc: "이 문제에 대한 번역이 없습니다.",
    noSolutionFound: "풀이를 찾을 수 없습니다",
    noSolutionFoundDesc: "해당 풀이에 접근할 수 없습니다.",
    // Set link page
    problemLinkLabel: "원본 문제 링크",
    problemLinkPlaceholder: "https://...",
    pleaseEnterUrl: "URL을 입력해 주세요.",
    urlMustUseHttps: "URL은 http 또는 https를 사용해야 합니다.",
    pleaseEnterValidUrl: "유효한 URL을 입력해 주세요.",
    urlMustBeFromSite: "URL은 {hostname}에서 제공된 것이어야 합니다.",
    urlMustContainProblemId: "URL에 문제 ID가 경로에 포함되어야 합니다.",
    saveLink: "링크 저장",
    failedToSaveLink: "링크 저장에 실패했습니다. 다시 시도하세요.",
    goToProblemPage: "문제 페이지로 이동",
    problemNotFoundSetLinkDesc:
      "이 문제는 아직 존재하지 않습니다. 문제 페이지를 방문하여 생성하세요.",
    // Error states (shared across pages)
    problemNotFound: "문제를 찾을 수 없습니다",
    problemNotFoundDesc: "이 문제는 아직 존재하지 않습니다.",
    invalidProblem: "잘못된 문제",
    invalidProblemDesc: "사이트 또는 문제 ID가 유효하지 않습니다.",
    invalidProblemWithSolutionDesc: "사이트, 문제 ID, 또는 풀이 ID가 유효하지 않습니다.",
    serverError: "서버 오류",
    serverErrorDesc: "서버에서 오류가 발생했습니다. 나중에 다시 시도하세요.",
    // 404 page
    notFound: "404 — 페이지를 찾을 수 없습니다",
    goHome: "홈으로 이동",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

type I18nContextType = {
  lang: () => Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
  tf: (key: TranslationKey, vars: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nContextType>();

export function I18nProvider(props: ParentProps) {
  const persistedLangOptions = {
    name: "lang",
    serialize: (value: Lang) => value,
    deserialize: (value: string): Lang => (value === "ko" ? "ko" : "en"),
  } as const;

  const [lang, setLang] = makePersisted(createSignal<Lang>("en"), {
    name: persistedLangOptions.name,
    storage: cookieStorage.withOptions({ path: "/", sameSite: "Lax", maxAge: 60 * 60 * 24 * 365 }),
    serialize: persistedLangOptions.serialize,
    deserialize: persistedLangOptions.deserialize,
  });

  const toggleLang = () => {
    setLang(lang() === "en" ? "ko" : "en");
  };

  const t = (key: TranslationKey): string =>
    (translations[lang()] as Record<string, string>)[key] ?? key;

  const tf = (key: TranslationKey, vars: Record<string, string | number>): string => {
    let s = t(key);
    for (const [k, v] of Object.entries(vars)) {
      s = s.replace(`{${k}}`, String(v));
    }
    return s;
  };

  return (
    <I18nContext.Provider value={{ lang, toggleLang, t, tf }}>
      {props.children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextType {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
