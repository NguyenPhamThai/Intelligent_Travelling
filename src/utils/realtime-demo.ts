// Demo realtime with polling
setInterval(async () => {
  const response = await fetch('/api/safety/events-nearby?lat=10.76&lng=106.66&radius=10');
  const events = await response.json();
  console.log('Realtime events:', events);
}, 30000); // Poll every 30s