function gatherMemory(context) {
  const npc = context.npc || {};
  const memories = npc.memories || {};

  return {
    shortTerm: context.history || [],
    midTerm: {},
    longTerm: memories.long_term_summary || '',
    episodic: memories.episodic || [],
    social: memories.social_graph || {},
    media: memories.media || [],
    lastOpenings: memories.last_openings || [],
  };
}

module.exports = {
  gatherMemory,
};
