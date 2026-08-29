const { WebSocketServer } = require('ws');
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });
const clientsMap = new Map();

wss.on('connection', (ws) => {
    let clientId = 'unknown_' + Math.random().toString(36).substring(2, 7);
    clientsMap.set(ws, { id: clientId, role: 'WORKER', name: 'Đang tải...', lastActive: Date.now() });

    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) ws.ping();
    }, 30000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            if (data.action === 'CLIENT_PING') return;

            if (data.action === 'SYNC_REGISTER_TAB' && data.value) {
                clientId = data.value.id || clientId;
                clientsMap.set(ws, { ...data.value, lastActive: Date.now() });
            }

            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    if (data.targetIds && data.targetIds.length > 0) {
                        const meta = clientsMap.get(client);
                        if (meta && data.targetIds.includes(meta.id)) client.send(JSON.stringify(data));
                    } else {
                        client.send(message.toString());
                    }
                }
            });
        } catch (e) {
            wss.clients.forEach(c => c.readyState === ws.OPEN && c.send(message.toString()));
        }
    });

    ws.on('close', () => { clearInterval(heartbeatInterval); clientsMap.delete(ws); });
});
