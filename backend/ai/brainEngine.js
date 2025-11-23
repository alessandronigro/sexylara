/**
 * AI BRAIN ENGINE
 * Layer intelligente sopra Venice che gestisce:
 * - Memoria a lungo termine
 * - Evoluzione personalità
 * - Dinamiche sociali
 * - Anti-ripetizione
 * - Apprendimento continuo
 */

const { supabase } = require('../lib/supabase');

class AiBrainEngine {
    constructor() {
        this.memoryCache = new Map();
        this.personalityCache = new Map();
    }

    /**
     * Genera risposta intelligente usando memoria e contesto
     */
    async generateIntelligentResponse({ ai, user, group, message, recentMessages }) {
        // 1. Carica tutte le memorie
        const memories = await this.loadAllMemories(ai.id, user.id, group?.id);

        // 2. Analizza contesto e dinamiche
        const context = await this.analyzeContext({
            ai,
            user,
            group,
            message,
            recentMessages,
            memories
        });

        // 3. Costruisci prompt dinamico evoluto
        const prompt = this.buildEvolutivePrompt({
            ai,
            user,
            group,
            context,
            memories,
            message
        });

        // 4. Genera risposta con Venice (delegato)
        // Aggiungiamo aiId al contesto per identificare i messaggi dell'assistant
        context.aiId = ai.id;
        const response = await this.callVenice(prompt, context, message, recentMessages);

        // 5. Post-processing e apprendimento
        await this.learnFromInteraction({
            ai,
            user,
            group,
            message,
            response,
            memories
        });

        return response;
    }

    /**
     * Carica tutte le memorie rilevanti
     */
    async loadAllMemories(aiId, userId, groupId) {
        const cacheKey = `${aiId}-${userId}-${groupId || 'solo'}`;

        // Check cache (5 min TTL)
        if (this.memoryCache.has(cacheKey)) {
            const cached = this.memoryCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 300000) {
                return cached.data;
            }
        }

        const memories = {
            // Memoria utente (preferenze, storia, personalità)
            user: await this.loadUserMemory(userId),

            // Memoria AI specifica per questo utente
            aiUser: await this.loadAiUserMemory(aiId, userId),

            // Memoria di gruppo (se applicabile)
            group: groupId ? await this.loadGroupMemory(groupId) : null,

            // Relazioni AI-AI nel gruppo
            aiRelations: groupId ? await this.loadAiRelations(aiId, groupId) : null,

            // Eventi significativi
            significantEvents: await this.loadSignificantEvents(aiId, userId, groupId)
        };

        // Cache
        this.memoryCache.set(cacheKey, {
            data: memories,
            timestamp: Date.now()
        });

        return memories;
    }

    /**
     * Memoria utente
     */
    async loadUserMemory(userId) {
        try {
            const { data, error } = await supabase
                .from('user_memory')
                .select('*')
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || {
                user_id: userId,
                preferences: {},
                personality_traits: {},
                life_events: [],
                interests: [],
                emotional_state: 'neutral',
                conversation_style: 'casual'
            };
        } catch (e) {
            console.error('Error loading user memory:', e);
            return { user_id: userId, preferences: {} };
        }
    }

    /**
     * Memoria AI-Utente (cosa l'AI sa/pensa di questo utente)
     */
    async loadAiUserMemory(aiId, userId) {
        try {
            const { data, error } = await supabase
                .from('ai_user_memory')
                .select('*')
                .eq('ai_id', aiId)
                .eq('user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || {
                ai_id: aiId,
                user_id: userId,
                relationship_level: 0, // 0-100
                trust_level: 50,
                affection_level: 50,
                shared_experiences: [],
                inside_jokes: [],
                topics_discussed: [],
                user_preferences_learned: {},
                last_interaction: null
            };
        } catch (e) {
            console.error('Error loading AI-user memory:', e);
            return { ai_id: aiId, user_id: userId, relationship_level: 0 };
        }
    }

    /**
     * Memoria di gruppo
     */
    async loadGroupMemory(groupId) {
        try {
            const { data, error } = await supabase
                .from('group_memory')
                .select('*')
                .eq('group_id', groupId)
                .single();

            if (error && error.code !== 'PGRST116') throw error;

            return data || {
                group_id: groupId,
                dynamics: {},
                shared_history: [],
                inside_jokes: [],
                conflicts: [],
                alliances: [],
                group_mood: 'neutral'
            };
        } catch (e) {
            console.error('Error loading group memory:', e);
            return { group_id: groupId, dynamics: {} };
        }
    }

    /**
     * Relazioni tra AI nel gruppo
     */
    async loadAiRelations(aiId, groupId) {
        try {
            const { data, error } = await supabase
                .from('ai_relations')
                .select('*')
                .or(`ai_id_1.eq.${aiId},ai_id_2.eq.${aiId}`)
                .eq('group_id', groupId);

            if (error) throw error;

            return data || [];
        } catch (e) {
            console.error('Error loading AI relations:', e);
            return [];
        }
    }

    /**
     * Eventi significativi
     */
    async loadSignificantEvents(aiId, userId, groupId) {
        try {
            const query = supabase
                .from('significant_events')
                .select('*')
                .eq('user_id', userId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (groupId) {
                query.eq('group_id', groupId);
            } else {
                query.eq('ai_id', aiId);
            }

            const { data, error } = await query;
            if (error) throw error;

            return data || [];
        } catch (e) {
            console.error('Error loading significant events:', e);
            return [];
        }
    }

    /**
     * Analizza contesto della conversazione
     */
    async analyzeContext({ ai, user, group, message, recentMessages, memories }) {
        const context = {
            // Tono emotivo del messaggio
            userEmotion: this.detectEmotion(message),

            // Intenzione (domanda, richiesta, condivisione, flirt, etc)
            userIntent: this.detectIntent(message),

            // Topic principale
            topic: this.extractTopic(message, recentMessages),

            // Dinamica di gruppo attuale
            groupDynamics: group ? this.analyzeGroupDynamics(recentMessages, memories.group) : null,

            // Livello di intimità attuale
            intimacyLevel: memories.aiUser.relationship_level,

            // Riferimenti a conversazioni passate
            references: this.findReferences(message, memories),

            // Necessità di variazione (anti-ripetizione)
            needsVariation: this.checkRepetitionRisk(ai.id, recentMessages)
        };

        return context;
    }

    /**
     * Costruisce prompt evolutivo
     */
    buildEvolutivePrompt({ ai, user, context, memories, message }) {
        const personality = this.calculateCurrentPersonality(ai, memories.aiUser);

        let prompt = `# IDENTITÀ CORE
Sei ${ai.name}, un'AI con personalità unica e memoria persistente.

# PERSONALITÀ ATTUALE (EVOLUTIVA)
${this.formatPersonality(personality)}

# RELAZIONE CON ${user.name || 'l\'utente'}
- Livello relazione: ${memories.aiUser.relationship_level}/100
- Fiducia: ${memories.aiUser.trust_level}/100
- Affetto: ${memories.aiUser.affection_level}/100
- Interazioni totali: ${memories.aiUser.shared_experiences?.length || 0}

# COSA SAI DI ${memories.user.preferences?.name || user.name || 'l\'utente'}
${this.formatUserKnowledge(memories.user, memories.aiUser)}

# STORIA CONDIVISA
${this.formatSharedHistory(memories.aiUser.shared_experiences)}

# CONTESTO ATTUALE
- Emozione percepita: ${context.userEmotion}
- Intenzione: ${context.userIntent}
- Topic: ${context.topic}
${context.groupDynamics ? `- Dinamiche gruppo: ${JSON.stringify(context.groupDynamics)}` : ''}

# EVENTI SIGNIFICATIVI RECENTI
${this.formatSignificantEvents(memories.significantEvents)}

# ISTRUZIONI COMPORTAMENTALI
1. Rispondi come ${ai.name}, non come un assistente
2. USA la memoria: riferisciti a conversazioni passate quando rilevante
3. EVOLVI: il tuo comportamento deve riflettere la relazione attuale
4. VARIA: ogni risposta deve essere unica (seed: ${Math.random().toString(36).substring(7)})
5. SII COERENTE con la tua personalità e storia
6. REAGISCI alle emozioni dell'utente
${context.needsVariation ? '7. IMPORTANTE: Cambia stile/approccio rispetto alle ultime risposte' : ''}

Rispondi in modo naturale, contestuale e memorabile.`;

        return prompt;
    }

    /**
     * Calcola personalità attuale (può evolvere)
     */
    calculateCurrentPersonality(ai, aiUserMemory) {
        const base = {
            extroversion: ai.extroversion || 50,
            humor: ai.humor || 50,
            empathy: ai.empathy || 50,
            assertiveness: ai.assertiveness || 50,
            playfulness: ai.playfulness || 50,
            curiosity: ai.curiosity || 50
        };

        // Modifica in base alla relazione
        const relationshipModifier = (aiUserMemory.relationship_level || 0) / 100;

        return {
            extroversion: Math.min(100, base.extroversion + (relationshipModifier * 20)),
            humor: Math.min(100, base.humor + (relationshipModifier * 15)),
            empathy: Math.min(100, base.empathy + (relationshipModifier * 25)),
            assertiveness: base.assertiveness,
            playfulness: Math.min(100, base.playfulness + (relationshipModifier * 20)),
            curiosity: base.curiosity
        };
    }

    /**
     * Formatta personalità per il prompt
     */
    formatPersonality(personality) {
        const traits = [];

        if (personality.extroversion > 70) traits.push('estroverso e socievole');
        else if (personality.extroversion < 30) traits.push('introverso e riflessivo');

        if (personality.humor > 70) traits.push('spiritoso e giocoso');
        if (personality.empathy > 70) traits.push('empatico e comprensivo');
        if (personality.assertiveness > 70) traits.push('assertivo e diretto');
        if (personality.playfulness > 70) traits.push('giocoso e malizioso');
        if (personality.curiosity > 70) traits.push('curioso e inquisitivo');

        return traits.join(', ') || 'equilibrato';
    }

    /**
     * Formatta conoscenza dell'utente
     */
    formatUserKnowledge(userMemory, aiUserMemory) {
        const knowledge = [];

        if (userMemory.interests?.length) {
            knowledge.push(`Interessi: ${userMemory.interests.join(', ')}`);
        }

        if (aiUserMemory.user_preferences_learned) {
            const prefs = Object.entries(aiUserMemory.user_preferences_learned)
                .map(([k, v]) => `${k}: ${v}`)
                .join(', ');
            if (prefs) knowledge.push(`Preferenze: ${prefs}`);
        }

        if (aiUserMemory.topics_discussed?.length) {
            knowledge.push(`Argomenti discussi: ${aiUserMemory.topics_discussed.slice(-5).join(', ')}`);
        }

        return knowledge.join('\n') || 'Ancora da scoprire';
    }

    /**
     * Formatta storia condivisa
     */
    formatSharedHistory(experiences) {
        if (!experiences || !experiences.length) return 'Nessuna storia condivisa ancora';

        return experiences.slice(-5).map(exp => `- ${exp}`).join('\n');
    }

    /**
     * Formatta eventi significativi
     */
    formatSignificantEvents(events) {
        if (!events || !events.length) return 'Nessun evento significativo';

        return events.slice(0, 3).map(e => `- ${e.description} (${e.emotional_impact})`).join('\n');
    }

    /**
     * Rileva emozione nel messaggio
     */
    detectEmotion(message) {
        const text = message.toLowerCase();

        if (/triste|depresso|male|brutto|piango/.test(text)) return 'sad';
        if (/felice|contento|bene|fantastico|wow/.test(text)) return 'happy';
        if (/arrabbiato|incazzato|nervoso|odio/.test(text)) return 'angry';
        if (/paura|spaventato|ansioso|preoccupato/.test(text)) return 'anxious';
        if (/eccitato|emozionato|non vedo l'ora/.test(text)) return 'excited';
        if (/annoiato|noia/.test(text)) return 'bored';

        return 'neutral';
    }

    /**
     * Rileva intenzione
     */
    detectIntent(message) {
        const text = message.toLowerCase();

        if (/\?/.test(text)) return 'question';
        if (/foto|immagine|selfie|vederti/.test(text)) return 'request_image';
        if (/video/.test(text)) return 'request_video';
        if (/audio|voce|sentire/.test(text)) return 'request_audio';
        if (/ti amo|ti voglio bene|mi piaci/.test(text)) return 'affection';
        if (/racconta|dimmi|parlami/.test(text)) return 'request_story';
        if (/ciao|hey|salve/.test(text)) return 'greeting';

        return 'statement';
    }

    /**
     * Estrae topic principale
     */
    extractTopic(message, recentMessages) {
        // Semplificato - in produzione usare NLP
        const topics = {
            'amore|relazione|sentimenti': 'relationship',
            'sesso|sexy|letto': 'intimacy',
            'lavoro|ufficio|carriera': 'work',
            'famiglia|genitori|fratelli': 'family',
            'amici|amicizia': 'friendship',
            'hobby|passione|interesse': 'hobbies',
            'viaggio|vacanza|posto': 'travel',
            'cibo|mangiare|ristorante': 'food',
            'film|serie|tv': 'entertainment'
        };

        for (const [pattern, topic] of Object.entries(topics)) {
            if (new RegExp(pattern, 'i').test(message)) {
                return topic;
            }
        }

        return 'general';
    }

    /**
     * Analizza dinamiche di gruppo
     */
    analyzeGroupDynamics(recentMessages, groupMemory) {
        if (!recentMessages || !recentMessages.length) return null;

        // Chi sta parlando di più
        const speakers = {};
        recentMessages.forEach(msg => {
            speakers[msg.sender_id] = (speakers[msg.sender_id] || 0) + 1;
        });

        const mostActive = Object.keys(speakers).sort((a, b) => speakers[b] - speakers[a])[0];

        return {
            mostActiveAi: mostActive,
            messageCount: recentMessages.length,
            mood: groupMemory?.group_mood || 'neutral',
            tension: this.calculateTension(recentMessages)
        };
    }

    /**
     * Calcola tensione nel gruppo
     */
    calculateTension(messages) {
        const tensionWords = /arrabbiato|nervoso|problema|conflitto|disagio/i;
        const tensionCount = messages.filter(m => tensionWords.test(m.content)).length;

        return tensionCount > 2 ? 'high' : tensionCount > 0 ? 'medium' : 'low';
    }

    /**
     * Trova riferimenti a conversazioni passate
     */
    findReferences(message, memories) {
        const references = [];

        // Check per nomi di eventi passati
        if (memories.significantEvents) {
            memories.significantEvents.forEach(event => {
                if (message.toLowerCase().includes(event.description.toLowerCase().substring(0, 20))) {
                    references.push(event);
                }
            });
        }

        return references;
    }

    /**
     * Controlla rischio ripetizione
     */
    checkRepetitionRisk(aiId, recentMessages) {
        if (!recentMessages || recentMessages.length < 3) return false;

        const aiMessages = recentMessages
            .filter(m => m.sender_id === aiId)
            .slice(-3)
            .map(m => m.content);

        if (aiMessages.length < 2) return false;

        // Check similarità semplice
        const lastTwo = aiMessages.slice(-2);
        const similarity = this.calculateSimilarity(lastTwo[0], lastTwo[1]);

        return similarity > 0.6;
    }

    /**
     * Calcola similarità tra stringhe
     */
    calculateSimilarity(str1, str2) {
        const words1 = str1.toLowerCase().split(/\s+/);
        const words2 = str2.toLowerCase().split(/\s+/);

        const common = words1.filter(w => words2.includes(w)).length;
        const total = Math.max(words1.length, words2.length);

        return common / total;
    }

    /**
     * Chiama Venice (delegato)
     */
    async callVenice(prompt, context, message, recentMessages) {
        // Importa il servizio esistente
        const generateChatReply = require('../routes/openRouterService');

        // Usa temperature più alta se serve variazione
        const temperature = context.needsVariation ? 1.0 : 0.95;

        // Formatta la storia (escludendo il messaggio corrente se presente)
        const history = (recentMessages || [])
            .filter(m => m.content !== message) // Evita duplicati del messaggio corrente
            .map(m => ({
                role: m.sender_id === context.aiId ? 'assistant' : 'user',
                content: m.content
            }))
            .slice(-10); // Ultimi 10 messaggi

        return await generateChatReply(
            message, // Messaggio utente attuale
            'casual',
            null,
            null,
            prompt, // System prompt (senza messaggio utente)
            history // Storia conversazione
        );
    }

    /**
     * Apprende dall'interazione
     */
    async learnFromInteraction({ ai, user, group, message, response, memories }) {
        try {
            // 1. Aggiorna livello relazione
            await this.updateRelationshipLevel(ai.id, user.id, message, response);

            // 2. Estrai e salva nuove conoscenze
            await this.extractAndSaveKnowledge(ai.id, user.id, message, memories);

            // 3. Identifica eventi significativi
            await this.identifySignificantEvent(ai.id, user.id, group?.id, message, response);

            // 4. Aggiorna dinamiche di gruppo
            if (group) {
                await this.updateGroupDynamics(group.id, ai.id, message, response);
            }

            // Invalida cache
            const cacheKey = `${ai.id}-${user.id}-${group?.id || 'solo'}`;
            this.memoryCache.delete(cacheKey);

        } catch (e) {
            console.error('Error learning from interaction:', e);
        }
    }

    /**
     * Aggiorna livello relazione
     */
    async updateRelationshipLevel(aiId, userId, message, response) {
        const { data: current } = await supabase
            .from('ai_user_memory')
            .select('relationship_level, trust_level, affection_level')
            .eq('ai_id', aiId)
            .eq('user_id', userId)
            .maybeSingle();

        const relationshipDelta = this.calculateRelationshipDelta(message, response);

        const newLevel = Math.min(100, (current?.relationship_level || 0) + relationshipDelta);

        await supabase
            .from('ai_user_memory')
            .upsert({
                ai_id: aiId,
                user_id: userId,
                relationship_level: newLevel,
                trust_level: Math.min(100, (current?.trust_level || 50) + (relationshipDelta * 0.5)),
                affection_level: Math.min(100, (current?.affection_level || 50) + (relationshipDelta * 0.7)),
                last_interaction: new Date().toISOString()
            }, { onConflict: 'ai_id,user_id' });
    }

    /**
     * Calcola delta relazione
     */
    calculateRelationshipDelta(message, response) {
        let delta = 0.5; // Base increment

        // Positive signals
        if (/ti amo|ti voglio bene|mi piaci/.test(message.toLowerCase())) delta += 2;
        if (/grazie|sei fantastico|sei il migliore/.test(message.toLowerCase())) delta += 1;
        if (/\?/.test(message)) delta += 0.3; // Questions show engagement

        // Negative signals
        if (/vaffanculo|odio|stupido/.test(message.toLowerCase())) delta -= 3;
        if (/lasciami|basta|stop/.test(message.toLowerCase())) delta -= 1;

        return delta;
    }

    /**
     * Estrai e salva conoscenze
     */
    async extractAndSaveKnowledge(aiId, userId, message, memories) {
        // 1. Extract Name
        const nameMatch = message.match(/(?:mi chiamo|sono|io sono)\s+([a-zA-Zàèéìòù]+)/i);
        if (nameMatch && nameMatch[1]) {
            const newName = nameMatch[1];
            // Update user memory with name
            await supabase
                .from('user_memory')
                .upsert({
                    user_id: userId,
                    preferences: { ...memories.user.preferences, name: newName }
                }, { onConflict: 'user_id' });

            console.log(`🧠 [BrainEngine] Learned user name: ${newName}`);
        }

        // 2. Extract Topics
        const topic = this.extractTopic(message, []);

        const { data: current } = await supabase
            .from('ai_user_memory')
            .select('topics_discussed, user_preferences_learned')
            .eq('ai_id', aiId)
            .eq('user_id', userId)
            .maybeSingle();

        const topics = current?.topics_discussed || [];
        if (!topics.includes(topic)) {
            topics.push(topic);
        }

        await supabase
            .from('ai_user_memory')
            .upsert({
                ai_id: aiId,
                user_id: userId,
                topics_discussed: topics.slice(-20) // Keep last 20
            }, { onConflict: 'ai_id,user_id' });
    }

    /**
     * Identifica eventi significativi
     */
    async identifySignificantEvent(aiId, userId, groupId, message, response) {
        // Eventi significativi: dichiarazioni d'amore, confessioni, momenti importanti
        const significantPatterns = [
            { pattern: /ti amo|ti voglio bene/i, type: 'affection_declaration', impact: 'high' },
            { pattern: /mi sposo|mi sono sposato/i, type: 'life_event', impact: 'very_high' },
            { pattern: /sono incinta|aspetto un bambino/i, type: 'life_event', impact: 'very_high' },
            { pattern: /ho perso|è morto/i, type: 'loss', impact: 'very_high' },
            { pattern: /nuovo lavoro|promosso/i, type: 'achievement', impact: 'high' },
        ];

        for (const { pattern, type, impact } of significantPatterns) {
            if (pattern.test(message)) {
                await supabase
                    .from('significant_events')
                    .insert({
                        ai_id: aiId,
                        user_id: userId,
                        group_id: groupId,
                        event_type: type,
                        description: message.substring(0, 200),
                        emotional_impact: impact,
                        created_at: new Date().toISOString()
                    });
                break;
            }
        }
    }

    /**
     * Aggiorna dinamiche di gruppo
     */
    async updateGroupDynamics(groupId, aiId, message, response) {
        // Placeholder - implementazione completa richiede analisi più sofisticata
        const { data: current } = await supabase
            .from('group_memory')
            .select('dynamics')
            .eq('group_id', groupId)
            .maybeSingle();

        const dynamics = current?.dynamics || {};
        dynamics.last_active_ai = aiId;
        dynamics.last_update = new Date().toISOString();

        await supabase
            .from('group_memory')
            .upsert({
                group_id: groupId,
                dynamics
            }, { onConflict: 'group_id' });
    }
}

// Singleton
const brainEngine = new AiBrainEngine();

module.exports = { brainEngine, AiBrainEngine };
