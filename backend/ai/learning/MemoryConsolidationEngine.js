function consolidate(npcJson, summary) {
  npcJson.memories = npcJson.memories || {};
  npcJson.memories.long_term_summary = summary;
  return npcJson;
}

module.exports = {
  consolidate,
};
