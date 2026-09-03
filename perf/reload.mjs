const targets = await (await fetch('http://localhost:8099/json')).json();
const page = targets.find((t) => t.type === 'page' && /sidekick/i.test(t.title + t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((r) => (ws.onopen = r));
ws.send(JSON.stringify({ id: 1, method: 'Page.reload', params: { ignoreCache: true } }));
await new Promise((r) => setTimeout(r, 1500));
ws.close(); console.log('reloaded');
