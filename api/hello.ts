require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const Twilio = require('twilio');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

const twilioClient = Twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

async function scheduleReminder(reminderId) {
  const { data: reminder, error } = await supabase
    .from('Reminder')
    .select('*')
    .eq('id', reminderId)
    .single();

  if (error || !reminder) {
    console.error('Failed to fetch reminder:', error);
    return;
  }

  const { data: event, error: eventError } = await supabase
    .from('Event')
    .select('*')
    .eq('id', reminder.eventId)
    .single();

  if (eventError || !event) {
    console.error('Failed to fetch event:', eventError);
    return;
  }

  const { data: contact, error: contactError } = await supabase
    .from('Contact')
    .select('*')
    .eq('id', reminder.contactId)
    .single();

  if (contactError || !contact) {
    console.error('Failed to fetch contact:', contactError);
    return;
  }

  const messageBody = `Reminder: ${event.summary} - ${event.start}. ${reminder.rmdrText}`;
  const sendTime = new Date(Date.now() + reminder.timeToSend * 1000);

  try {
    const message = await twilioClient.messages.create({
      body: messageBody,
      from: process.env.TWILIO_PHONE_NUMBER,
      to: contact.phoneNumber,
      sendAt: sendTime,
    });

    await supabase
      .from('Reminder')
      .update({ twilioMessageSid: message.sid })
      .eq('id', reminder.id);

    console.log('Reminder scheduled:', message.sid);
  } catch (error) {
    console.error('Failed to schedule reminder:', error);
  }
}

async function updateReminder(reminderId) {
  const { data: reminder, error } = await supabase
    .from('Reminder')
    .select('*')
    .eq('id', reminderId)
    .single();

  if (error || !reminder) {
    console.error('Failed to fetch reminder:', error);
    return;
  }

  const messageSid = reminder.twilioMessageSid;

  if (!messageSid) {
    console.error('No Twilio message SID found for reminder:', reminderId);
    return;
  }

  const sendTime = new Date(Date.now() + reminder.timeToSend * 1000);

  try {
