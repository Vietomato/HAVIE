export function cleanRacketName(name, categorySlug) {
  if (categorySlug !== "rackets" || typeof name !== "string") return name;
  return name.replace(/\s*[([]\s*(?:(?:đã|chưa)\s+căng\s+dây|(?:pre-?)?strung|unstrung)\s*[)\]]/giu, "")
    .replace(/\s{2,}/gu, " ").trim();
}
