const EN = /\b(the|and|of|to|is|are|for|with|on|new|how|why|what|this|that|from|after|will|its|it's|you|your)\b/gi;
const PT = /\b(de|da|do|das|dos|que|para|com|não|em|os|as|uma|um|por|mais|como|sobre|após|seu|sua)\b/gi;

/** Rough guess good enough to suggest translation: more common English words than Portuguese ones. */
export function looksEnglish(text: string) {
  return (text.match(EN)?.length ?? 0) > (text.match(PT)?.length ?? 0);
}

/** Opens the story's page through Google Translate, in Portuguese. */
export function translatedUrl(url: string) {
  return `https://translate.google.com/translate?sl=auto&tl=pt&u=${encodeURIComponent(url)}`;
}
