const { supabase } = require('../../lib/supabase');
const DEFAULT_NPC_TEMPLATE = require('./npcTemplate');

const personalityPresets = {
  mysterious: {
    bigFive: { openness: 0.78, conscientiousness: 0.55, extraversion: 0.42, agreeableness: 0.66, neuroticism: 0.48 },
    customTraits: { jealousy: 0.35, playfulness: 0.45, irony: 0.55, vulnerability: 0.4 },
  },
  explicit: {
    bigFive: { openness: 0.82, conscientiousness: 0.4, extraversion: 0.72, agreeableness: 0.6, neuroticism: 0.52 },
    customTraits: { jealousy: 0.4, playfulness: 0.72, irony: 0.5, vulnerability: 0.55 },
  },
  romantic: {
    bigFive: { openness: 0.8, conscientiousness: 0.52, extraversion: 0.6, agreeableness: 0.8, neuroticism: 0.45 },
    customTraits: { jealousy: 0.45, playfulness: 0.65, irony: 0.35, vulnerability: 0.75 },
  },
  dominant: {
    bigFive: { openness: 0.68, conscientiousness: 0.65, extraversion: 0.7, agreeableness: 0.4, neuroticism: 0.38 },
    customTraits: { jealousy: 0.55, playfulness: 0.5, irony: 0.4, vulnerability: 0.3 },
  },
  cute: {
    bigFive: { openness: 0.7, conscientiousness: 0.58, extraversion: 0.75, agreeableness: 0.82, neuroticism: 0.35 },
    customTraits: { jealousy: 0.3, playfulness: 0.8, irony: 0.35, vulnerability: 0.65 },
  },
};

function mapToneMode(tone) {
  const lower = (tone || '').toLowerCase();
  if (lower === 'extreme') return 'extreme';
  if (lower === 'romantic') return 'romantic';
  if (lower === 'explicit' || lower === 'dirty' || lower === 'nsfw') return 'explicit';
  if (lower === 'dominant' || lower === 'cute' || lower === 'flirty' || lower === 'warm_flirty' || lower === 'playful') {
    return 'flirty';
  }
  if (lower === 'mysterious' || lower === 'serious') return 'soft';
  return 'soft';
}

function buildFromGirlfriend(gf, evo) {
  const preset = personalityPresets[(gf.personality_type || '').toLowerCase()] || personalityPresets.mysterious || DEFAULT_NPC_TEMPLATE.core_personality;
  const customTraits = {
    ...preset.customTraits,
    ...(gf.characteristics || {}),
    ...(evo || {}),
  };

  return {
    id: gf.id,
    name: gf.name,
    avatar: gf.avatar_url,
    appearance: {
      ethnicity: gf.ethnicity,
      bodyType: gf.body_type,
      hair: { length: gf.hair_length, color: gf.hair_color },
      eyes: gf.eye_color,
      height: gf.height_cm,
      age: gf.age,
      gender: gf.gender,
    },
    corePersonality: {
      bigFive: preset.bigFive,
      attachmentStyle: 'secure',
      loveLanguages: ['words_of_affirmation'],
      customTraits,
    },
    currentState: {
      mood: 'neutral',
      emotionVector: { valence: 0.5, arousal: 0.5, dominance: 0.5 },
      socialEnergy: 1.0,
    },
    experience: {
      level: gf.level || 1,
      xpTotal: gf.xp || 0,
      xpEmpathy: 0,
      xpSocial: 0,
      xpConflict: 0,
      xpIntimacy: 0,
    },
    relationship_with_user: {},
    memories: {
      episodic: [],
      long_term_summary: gf.bio || '',
      social_graph: {},
      media: [],
      last_openings: [],
    },
    preferences: {
      tone_mode: mapToneMode(gf.tone),
      emoji_usage: 'high',
      response_length: 'medium',
      topics_liked: [],
      topics_disliked: [],
    },
  };
}

async function getNpcProfile(npcId, fallbackName) {
  // Load npc_profiles row (may contain LifeCore/prompt_system)
  const { data: profileRow, error: profileErr } = await supabase
    .from('npc_profiles')
    .select('*')
    .eq('id', npcId)
    .maybeSingle();

  // Load npc base row
  const { data: npcRow, error: npcErr } = await supabase
    .from('npcs')
    .select('id, name, avatar_url, ethnicity, body_type, hair_length, hair_color, eye_color, height_cm, age, gender, tone, personality_type, characteristics, bio, level, xp, user_id, prompt_system')
    .eq('id', npcId)
    .maybeSingle();

  if (profileErr && !npcRow) {
    const seeded = { ...DEFAULT_NPC_TEMPLATE, id: npcId, name: fallbackName || DEFAULT_NPC_TEMPLATE.name };
    return { data: seeded, profile: null, npc: null };
  }

  if (profileRow && profileRow.data) {
    const base = profileRow.data || {};
    const lifeCore = base.npc_json || base.lifeCore || null;
    const promptSystem = base.prompt_system || base.promptSystem || null;
    const enriched = { ...base };
    if (promptSystem) enriched.prompt_system = promptSystem;
    if (lifeCore) enriched.npc_json = lifeCore;
    return { data: enriched, lifeCore, promptSystem, profile: profileRow, npc: npcRow };
  }

  if (!npcRow) {
    const seeded = { ...DEFAULT_NPC_TEMPLATE, id: npcId, name: fallbackName || DEFAULT_NPC_TEMPLATE.name };
    return { data: seeded, profile: null, npc: null };
  }

  // Load latest personality evolution (optional)
  let evoTraits = null;
  const { data: evo } = await supabase
    .from('ai_personality_evolution')
    .select('*')
    .eq('ai_id', npcId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  if (evo) {
    evoTraits = {
      playfulness: evo.playfulness ? evo.playfulness / 100 : undefined,
      jealousy: evo.jealousy ? evo.jealousy / 100 : undefined,
      empathy: evo.empathy ? evo.empathy / 100 : undefined,
      curiosity: evo.curiosity ? evo.curiosity / 100 : undefined,
    };
  }

  const npc = buildFromGirlfriend(npcRow, evoTraits);

  // Save initial profile if not present
  if (profileErr) {
    await supabase
      .from('npc_profiles')
      .insert({ id: npcId, name: npcRow.name, data: npc });
  }

  return { data: npc, profile: profileRow, npc: npcRow };
}

async function updateNpcProfile(npcId, data) {
  // Preserve existing prompt_system / npc_json / seed if present
  let base = {};
  try {
    const { data: existing } = await supabase
      .from('npc_profiles')
      .select('data')
      .eq('id', npcId)
      .single();
    base = existing?.data || {};
  } catch (_) {
    base = {};
  }

  const profileData = {
    ...base,
    ...data,
    preferences: {
      ...(base.preferences || {}),
      ...(data.preferences || {}),
      tone_mode: (data.preferences || {}).tone_mode || (base.preferences || {}).tone_mode || 'soft',
    },
  };
  // preserve prompt_system/npc_json/seed if not provided
  if (base.prompt_system && !profileData.prompt_system) profileData.prompt_system = base.prompt_system;
  if (base.npc_json && !profileData.npc_json) profileData.npc_json = base.npc_json;
  if (base.seed && !profileData.seed) profileData.seed = base.seed;
  // Persist XP/level
  await supabase
    .from('npcs')
    .update({ xp: profileData.experience?.xpTotal || 0, level: profileData.experience?.level || 1 })
    .eq('id', npcId);

  // Persist personality evolution in ai_personality_evolution
  const traits = profileData.corePersonality?.customTraits || {};
  await supabase
    .from('ai_personality_evolution')
    .insert({
      ai_id: npcId,
      playfulness: traits.playfulness != null ? Math.round(traits.playfulness * 100) : null,
      jealousy: traits.jealousy != null ? Math.round(traits.jealousy * 100) : null,
      empathy: traits.vulnerability != null ? Math.round(traits.vulnerability * 100) : null,
      curiosity: traits.curiosity != null ? Math.round(traits.curiosity * 100) : null,
    });

  // Update JSON brain snapshot
  await supabase
    .from('npc_profiles')
    .upsert({ id: npcId, name: profileData.name, data: profileData }, { onConflict: 'id' });
}

module.exports = {
  getNpcProfile,
  updateNpcProfile,
};
