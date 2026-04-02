// test-safety-api.js
const { getAllEvents } = require('./src/services/safety/data-pipeline');

async function test() {
  console.log('Testing Safety APIs...');
  const events = await getAllEvents();
  console.log('Fetched events:', events);
}

test();