/** Return true only when the user explicitly asks to receive an HTML file. */
export function requestsHtmlFile(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (!normalized) return false;

  const htmlFile = /\b(?:html|\.html)\s+(?:file|document|page)\b|\bfile\s+(?:in|as)\s+(?:html|\.html)\b/;
  const delivery = /\b(?:give|send|provide|create|make|generate|export|save|download|return|attach)\b/;
  return htmlFile.test(normalized) && delivery.test(normalized);
}
