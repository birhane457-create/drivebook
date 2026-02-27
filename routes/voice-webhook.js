const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const instructorService = require('../services/instructor-service');
const copilotService = require('../services/copilot-service');
const messageService = require('../services/message-service');
const logger = require('../utils/logger');

router.post('/incoming', async (req, res) => {
  const { From, To } = req.body || {};
  const requestId = req.requestId;
  try {
    if (!From || !To) {
      logger.logWarning('Missing From or To in voice webhook', { requestId });
      return res.status(400).send('Missing required Twilio fields');
    }

    logger.logInfo('Incoming call', { from: From, to: To, requestId });

    const instructor = await instructorService.findInstructorByPhone(To);
    const twiml = new twilio.twiml.VoiceResponse();

    if (instructor) {
      // Attempt to connect to Copilot agent
      const agentResponse = await copilotService.connectToCopilotAgent(instructor.id, { callerPhone: From });
      if (agentResponse && agentResponse.type === 'dial') {
        twiml.dial({ callerId: To }, agentResponse.number);
      } else if (agentResponse && agentResponse.type === 'say') {
        twiml.say(agentResponse.text);
      } else {
        // fallback - take message
        twiml.say('The instructor is currently unavailable. Please leave a message after the beep.');
        twiml.record({ maxLength: 120, action: '/api/voice/voicemail' });
      }
    } else {
      twiml.say('We could not find the instructor. Please leave a message after the beep.');
      twiml.record({ maxLength: 120, action: '/api/voice/voicemail' });
    }

    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    logger.logError(err, { requestId });
    res.status(500).send('Server error');
  }
});

// Simple voicemail handler (stores message)
router.post('/voicemail', async (req, res) => {
  const { RecordingUrl, From } = req.body || {};
  try {
    if (!RecordingUrl || !From) return res.status(400).send('Missing fields');
    await messageService.takeVoiceMessage(From, null, `Voicemail: ${RecordingUrl}`);
    const twiml = new twilio.twiml.VoiceResponse();
    twiml.say('Thanks. Your message has been recorded. Goodbye.');
    res.type('text/xml').send(twiml.toString());
  } catch (err) {
    logger.logError(err, { requestId: req.requestId });
    res.status(500).send('Server error');
  }
});

module.exports = router;
