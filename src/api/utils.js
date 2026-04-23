export function canonicalizeProblemId(rawValue) {
  return String(rawValue ?? "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();
}

export function normalizeSite(rawValue) {
  return String(rawValue ?? "").trim();
}

export function jsonResponse(status, payload) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json",
    },
  });
}

export function parsePositiveInt(rawValue) {
  const value = Number.parseInt(String(rawValue), 10);
  if (!Number.isInteger(value) || value <= 0) {
    return null;
  }

  return value;
}
