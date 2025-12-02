function sanitizeHistoryForLLM(history) {
  if (!Array.isArray(history)) return [];
  const cleaned = history
    .filter(h => h && h.role && typeof h.content === "string")
    .map(h => ({ role: h.role, content: h.content }));
  // Mantieni almeno le ultime 3 battute
  const tail = cleaned.slice(-3);
  return tail.length ? tail : cleaned;
}

module.exports = { sanitizeHistoryForLLM };
