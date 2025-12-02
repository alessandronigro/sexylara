function detectMediaIntent(text = '') {
  if (!text || typeof text !== 'string') return { wantsMedia: false, type: null };
  const lower = text.toLowerCase();

  const wantsPhoto = /(foto|selfie|vederti|vedere te|immagine|scatto)/i.test(lower);
  const wantsVideo = /(video|clip|filmato)/i.test(lower);
  const wantsAudio = /(audio|vocale|voce|sentirti)/i.test(lower);

  const mediaRequested = wantsPhoto || wantsVideo || wantsAudio;
  let type = null;
  if (wantsPhoto) type = 'photo';
  else if (wantsVideo) type = 'video';
  else if (wantsAudio) type = 'audio';

  return {
    wantsMedia: mediaRequested,
    type,
    prompt: mediaRequested ? 'Vuoi una foto, un video o un audio?' : null,
  };
}

module.exports = { detectMediaIntent };
