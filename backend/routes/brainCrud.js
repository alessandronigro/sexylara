const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');

// Utility to standardize error responses
function handleError(res, error, label) {
  console.error(`❌ ${label}:`, error);
  return res.status(500).json({ error: error.message || 'Internal error' });
}

// ========== AI USER MEMORY ==========

router.post('/brain/user-memory', async (req, res) => {
  try {
    const payload = {
      ai_id: req.body.ai_id,
      user_id: req.body.user_id,
      last_interaction: req.body.last_interaction,
      relationship_level: req.body.relationship_level,
      trust_level: req.body.trust_level,
      affection_level: req.body.affection_level,
      shared_experiences: req.body.shared_experiences,
      inside_jokes: req.body.inside_jokes,
      topics_discussed: req.body.topics_discussed,
      user_preferences_learned: req.body.user_preferences_learned,
    };
    const { data, error } = await supabase.from('ai_user_memory').insert(payload).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Create ai_user_memory');
  }
});

router.get('/brain/user-memory/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_user_memory')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Get ai_user_memory');
  }
});

router.get('/brain/user-memory/ai/:aiId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_user_memory')
      .select('*')
      .eq('ai_id', req.params.aiId);
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return handleError(res, error, 'List ai_user_memory by ai_id');
  }
});

router.patch('/brain/user-memory/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_user_memory')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Update ai_user_memory');
  }
});

router.delete('/brain/user-memory/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('ai_user_memory').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Delete ai_user_memory');
  }
});

// ========== AI RELATIONS ==========

router.post('/brain/relations', async (req, res) => {
  try {
    const payload = {
      ai_id_1: req.body.ai_id_1,
      ai_id_2: req.body.ai_id_2,
      group_id: req.body.group_id,
      relationship_type: req.body.relationship_type,
      affinity_level: req.body.affinity_level,
      tension_level: req.body.tension_level,
      shared_moments: req.body.shared_moments,
    };
    const { data, error } = await supabase.from('ai_relations').insert(payload).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Create ai_relations');
  }
});

router.get('/brain/relations/:id', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ai_relations').select('*').eq('id', req.params.id).single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Get ai_relations');
  }
});

router.get('/brain/relations/ai/:aiId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_relations')
      .select('*')
      .or(`ai_id_1.eq.${req.params.aiId},ai_id_2.eq.${req.params.aiId}`);
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return handleError(res, error, 'List ai_relations by ai');
  }
});

router.patch('/brain/relations/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_relations')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Update ai_relations');
  }
});

router.delete('/brain/relations/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('ai_relations').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Delete ai_relations');
  }
});

// ========== SIGNIFICANT EVENTS ==========

router.post('/brain/events', async (req, res) => {
  try {
    const payload = {
      ai_id: req.body.ai_id,
      user_id: req.body.user_id,
      group_id: req.body.group_id,
      event_type: req.body.event_type,
      description: req.body.description,
      emotional_impact: req.body.emotional_impact,
    };
    const { data, error } = await supabase.from('significant_events').insert(payload).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Create significant_events');
  }
});

router.get('/brain/events/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('significant_events')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Get significant_events');
  }
});

router.get('/brain/events/ai/:aiId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('significant_events')
      .select('*')
      .eq('ai_id', req.params.aiId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return handleError(res, error, 'List significant_events by ai_id');
  }
});

router.patch('/brain/events/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('significant_events')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Update significant_events');
  }
});

router.delete('/brain/events/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('significant_events').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Delete significant_events');
  }
});

// ========== AI PERSONALITY EVOLUTION ==========

router.post('/brain/personality', async (req, res) => {
  try {
    const { data, error } = await supabase.from('ai_personality_evolution').insert(req.body).select().single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Create ai_personality_evolution');
  }
});

router.get('/brain/personality/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_personality_evolution')
      .select('*')
      .eq('id', req.params.id)
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Get ai_personality_evolution');
  }
});

router.get('/brain/personality/ai/:aiId', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_personality_evolution')
      .select('*')
      .eq('ai_id', req.params.aiId);
    if (error) throw error;
    return res.json(data || []);
  } catch (error) {
    return handleError(res, error, 'List ai_personality_evolution');
  }
});

router.patch('/brain/personality/:id', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('ai_personality_evolution')
      .update(req.body)
      .eq('id', req.params.id)
      .select()
      .single();
    if (error) throw error;
    return res.json(data);
  } catch (error) {
    return handleError(res, error, 'Update ai_personality_evolution');
  }
});

router.delete('/brain/personality/:id', async (req, res) => {
  try {
    const { error } = await supabase.from('ai_personality_evolution').delete().eq('id', req.params.id);
    if (error) throw error;
    return res.json({ success: true });
  } catch (error) {
    return handleError(res, error, 'Delete ai_personality_evolution');
  }
});

module.exports = router;
