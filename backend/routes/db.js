// db.js
const { supabase } = require('../lib/supabase');

async function getUserCredits(userId) {
    const { data, error } = await supabase
        .from('user_credits')
        .select('credits')
        .eq('user_id', userId)
        .single();

    if (error && error.code !== 'PGRST116') throw error; // ignora "No rows returned"
    return data ? data.credits : 0;
}

async function updateUserCredits(userId, newCredits) {
    const { error } = await supabase
        .from('user_credits')
        .upsert({ user_id: userId, credits: newCredits }, { onConflict: 'user_id' });

    if (error) throw error;
}

async function deductCredit(userId, amount = 1) {
    // Prima prendi i crediti
    const current = await getUserCredits(userId);
    if (current < amount) throw new Error("Crediti insufficienti");

    const newCredits = current - amount;
    await updateUserCredits(userId, newCredits);
}

module.exports = {
    getUserCredits,
    updateUserCredits,
    deductCredit
};
