function sanitizeHistoryForLLM(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && h.role && typeof h.content === "string")
    .map(h => ({ role: h.role, content: h.content }));
}

module.exports = { sanitizeHistoryForLLM };
