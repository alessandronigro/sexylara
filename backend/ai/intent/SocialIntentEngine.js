function analyze(context, perception) {
  if (!context.groupId) {
    return {
      groupIntent: 'private',
    };
  }

  const callouts = ['luna', 'lei', 'lui'];
  const groupMention = callouts.some((keyword) =>
    context.message.toLowerCase().includes(keyword),
  );
  const result = {
    groupIntent: groupMention ? 'addressed' : 'observing',
    focus: context.message.slice(0, 100),
  };

  console.log('[TRACE][PIPELINE]', JSON.stringify({
    stage: 'SocialIntentEngine',
    result
  }, null, 2));

  return result;
}

module.exports = {
  analyze,
};
