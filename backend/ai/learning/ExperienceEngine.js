function awardXp(npcJson, xpDeltas) {
  npcJson.experience = npcJson.experience || {};
  const deltaTotal =
    (xpDeltas.intimacy || 0) +
    (xpDeltas.empathy || 0) +
    (xpDeltas.conflict || 0) +
    (xpDeltas.social || 0);

  npcJson.experience.xp_total = (npcJson.experience.xp_total || 0) + deltaTotal;
  npcJson.experience.xp_empathy = (npcJson.experience.xp_empathy || 0) + (xpDeltas.empathy || 0);
  npcJson.experience.xp_social = (npcJson.experience.xp_social || 0) + (xpDeltas.social || 0);
  npcJson.experience.xp_conflict = (npcJson.experience.xp_conflict || 0) + (xpDeltas.conflict || 0);
  npcJson.experience.xp_intimacy = (npcJson.experience.xp_intimacy || 0) + (xpDeltas.intimacy || 0);
  npcJson.experience.total = deltaTotal;
  if (npcJson.experience.xp_total > (npcJson.experience.level || 1) * 100) {
    npcJson.experience.level = (npcJson.experience.level || 1) + 1;
  }
  return npcJson.experience;
}

module.exports = {
  awardXp,
};
