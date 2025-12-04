// GroupInitiativeEngine - simple stub producing occasional gossip/thread prompts.

function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

const sampleGossip = [
  'Hai sentito cosa ha detto ieri l’utente?',
  'Mi chiedo se l’utente oggi sarà di buon umore.',
  'Dovremmo chiedere com’è andato il suo appuntamento.',
  'Forse l’utente ha bisogno di un messaggio di incoraggiamento.',
];

async function evaluateGroupInitiative(context) {
  // 30% chance to emit a gossip entry
  const shouldGossip = Math.random() < 0.3;
  const gossip = shouldGossip ? [{ text: randomPick(sampleGossip) }] : [];
  // 10% chance to emit a lightweight auto-response from a random NPC
  const responses = [];
  const npc = context.npcs?.[0];
  if (npc && Math.random() < 0.1) {
    responses.push({
      npcId: npc.id,
      text: randomPick(sampleGossip),
    });
  }
  return {
    responses,
    gossip,
  };
}

module.exports = { evaluateGroupInitiative };
