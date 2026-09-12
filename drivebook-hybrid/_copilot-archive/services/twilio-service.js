const twilio = require('twilio');

function buildVoiceResponse() {
  return new twilio.twiml.VoiceResponse();
}

module.exports = { buildVoiceResponse };