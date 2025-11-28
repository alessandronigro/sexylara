const TextUnderstanding = require('../perception/TextUnderstanding');
const VisionEngine = require('../perception/VisionEngine');
const AudioEngine = require('../perception/AudioEngine');

function analyze(context) {
  const textAnalysis = TextUnderstanding.analyze(context.message);
  const perception = {
    textAnalysis,
  };

  if (context.media?.type === 'image') {
    perception.visionAnalysis = VisionEngine.analyze(context.media.url);
  }
  if (context.media?.type === 'audio') {
    perception.audioAnalysis = AudioEngine.analyze(context.media.url);
  }

  return perception;
}

module.exports = {
  analyze,
};
