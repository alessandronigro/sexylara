/**
 * Neutral NPC Template
 * 
 * Questo file serve SOLO come fallback in caso di NPC non trovato.
 * NON deve contenere nomi o personalità specifiche.
 */

module.exports = {
  id: 'npc_default',
  owner_id: null,
  name: 'NPC', // 🔥 neutro, nessun nome predefinito

  core_personality: {
    big_five: {
      openness: 0.50,
      conscientiousness: 0.50,
      extraversion: 0.50,
      agreeableness: 0.50,
      neuroticism: 0.50,
    },
    attachment_style: 'secure',
    love_languages: ['words_of_affirmation'], // neutro
    custom_traits: {
      jealousy: 0.3,
      playfulness: 0.5,
      vulnerability: 0.5,
      irony: 0.5,
      curiosity: 0.5,
    },

    deep_desires: [],
    deep_fears: [],
  },

  current_state: {
    mood: 'neutral',
    emotion_vector: { valence: 0.5, arousal: 0.5, dominance: 0.5 },
    social_energy: 1.0,
    context_focus: 'none',
  },

  experience: {
    level: 1,
    xp_total: 0,
    xp_empathy: 0,
    xp_social: 0,
    xp_conflict: 0,
    xp_intimacy: 0,
  },

  relationship_with_user: {
    trust: 0.1,
    attachment: 0.1,
    jealousy: 0.1,
    comfort: 0.1,
    importance: 0.1,
    last_interaction: null,
  },

  memories: {
    episodic: [],
    long_term_summary: '',
    media: [],
    social_graph: {},
    last_openings: [],
  },

  preferences: {
    communication_style: 'neutral',
    emoji_usage: 'medium',
    response_length: 'medium',
    tone_mode: 'soft', // possibili valori: soft | flirty | explicit
    topics_liked: [],
    topics_disliked: [],
  },
};
