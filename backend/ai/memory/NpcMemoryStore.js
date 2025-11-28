const { supabase } = require('../../lib/supabase')

// ❗ Seed GENERICO: nessun nome hardcoded!
function seedProfile(npcId, fallbackName = "NPC") {
  return {
    id: npcId,
    name: fallbackName,
    corePersonality: {
      bigFive: {
        openness: 0.50,
        conscientiousness: 0.50,
        extraversion: 0.50,
        agreeableness: 0.50,
        neuroticism: 0.50,
      },
      attachmentStyle: 'secure',
      loveLanguages: ['words_of_affirmation'],
      customTraits: {
        jealousy: 0.3,
        playfulness: 0.5,
        irony: 0.5,
        vulnerability: 0.5,
      },
    },
    currentState: {
      mood: 'neutral',
      emotionVector: { valence: 0.5, arousal: 0.5, dominance: 0.5 },
      socialEnergy: 1.0,
      relationships: {},
    },
    memories: {
      episodic: [],
      longTermSummary: '',
      socialGraph: {},
      media: [],
    },
    experience: {
      level: 1,
      xpTotal: 0,
      xpEmpathy: 0,
      xpSocial: 0,
      xpConflict: 0,
      xpIntimacy: 0,
    },
  }
}

async function getNpcProfile(npcId) {
  try {
    // Fetch paralleli per prestazioni
    const [gfResult, traitsResult] = await Promise.all([
      supabase.from('npcs').select('*').eq('id', npcId).single(),
      supabase.from('ai_personality_evolution').select('*').eq('ai_id', npcId).single()
    ])

    // ❗ Se NON ESISTE IN DB → seed, ma usa l'ID come nome
    if (gfResult.error || !gfResult.data) {
      console.warn(`[NpcMemoryStore] No DB profile for ${npcId}. Using seed.`)
      return seedProfile(npcId, npcId)
    }

    const gf = gfResult.data
    const traits = traitsResult.data || {}

    // Mapping Big Five
    const bigFive = {
      openness: (traits.curiosity ?? 50) / 100,
      conscientiousness: (traits.loyalty ?? 50) / 100,
      extraversion: (traits.extroversion ?? 50) / 100,
      agreeableness: (traits.empathy ?? 50) / 100,
      neuroticism: (traits.jealousy ?? 30) / 100,
    }

    const customTraits = {
      jealousy: (traits.jealousy ?? 30) / 100,
      playfulness: (traits.playfulness ?? 50) / 100,
      irony: (traits.humor ?? 50) / 100,
      vulnerability: 0.5,
    }

    return {
      id: npcId,
      name: gf.name || npcId, // ❗ NAME SICURO
      corePersonality: {
        bigFive,
        attachmentStyle: 'secure',
        loveLanguages: ['words_of_affirmation'],
        customTraits,
      },
      currentState: {
        mood: gf.current_mood || 'neutral',
        emotionVector: { valence: 0.5, arousal: 0.5, dominance: 0.5 },
        socialEnergy: 1.0,
        relationships: {},
      },
      memories: {
        episodic: [],
        longTermSummary: gf.bio || '',
        socialGraph: {},
        media: [],
      },
      experience: {
        level: gf.level || 1,
        xpTotal: gf.xp || 0,
        xpEmpathy: 0,
        xpSocial: 0,
        xpConflict: 0,
        xpIntimacy: 0,
      },
    }
  } catch (err) {
    console.error(`[NpcMemoryStore] Error loading NPC ${npcId}:`, err)
    return seedProfile(npcId, npcId)
  }
}

async function updateNpcProfile(npcId, patch) {
  try {
    const ops = []

    // XP / Level update
    if (patch.experience) {
      ops.push(
        supabase.from('npcs')
          .update({
            level: patch.experience.level,
            xp: patch.experience.xpTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', npcId)
      )
    }

    // Personality update
    if (patch.corePersonality?.bigFive) {
      const p = patch.corePersonality.bigFive

      ops.push(
        supabase.from('ai_personality_evolution').upsert({
          ai_id: npcId,
          curiosity: Math.round(p.openness * 100),
          loyalty: Math.round(p.conscientiousness * 100),
          extroversion: Math.round(p.extraversion * 100),
          empathy: Math.round(p.agreeableness * 100),
          jealousy: Math.round(p.neuroticism * 100),
          updated_at: new Date().toISOString()
        })
      )
    }

    await Promise.all(ops)

    return getNpcProfile(npcId)
  } catch (err) {
    console.error('[NpcMemoryStore] Error updating NPC:', err)
    return null
  }
}

async function getGroupState(groupId) {
  try {
    const { data } = await supabase
      .from('group_memory')
      .select('*')
      .eq('group_id', groupId)
      .single()

    if (!data) {
      return { id: groupId, harmony: 0.7, tensions: [] }
    }

    return {
      id: groupId,
      harmony: 0.7,
      tensions: data.conflicts || [],
    }
  } catch {
    return { id: groupId, harmony: 0.5, tensions: [] }
  }
}

module.exports = {
  getNpcProfile,
  updateNpcProfile,
  getGroupState,
}