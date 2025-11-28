function normalizeMediaRequest(text) {
  if (!text) return false;
  const lower = text.toLowerCase();
  const triggers = ['facciamo una foto insieme', 'foto insieme', 'selfie con te', 'foto con te', 'una foto con noi'];
  return triggers.some((t) => lower.includes(t));
}

module.exports = {
  normalizeMediaRequest,
};
