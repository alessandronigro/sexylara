async function analyze() {
  // Media intent delegato a intentLLM a livello server-ws; qui non forziamo nulla
  return {
    wantsMedia: false,
    type: null,
    details: null,
    userProvidesPhoto: false,
  };
}

module.exports = {
  analyze,
};
