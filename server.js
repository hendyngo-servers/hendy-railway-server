const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const clients = new Set();
const activeSlaves = new Map();
const activeBots = new Map(); // Quản lý danh sách Bot động

app.use(express.json());
// Serves static files từ thư mục public và thư mục gốc
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Route chính trả về giao diện Dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API lấy danh sách Slaves
app.get('/api/slaves', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    let slavesList = [];
    activeSlaves.forEach((client) => {
        slavesList.push({
            id: client.id,
            name: client.name,
            role: client.role,
            isOnLive: client.isOnLive,
            url: client.url,
            lastSeen: new Date(client.lastSeen).toLocaleTimeString('vi-VN')
        });
    });
    res.end(JSON.stringify(slavesList, null, 2));
});

// API lấy danh sách Bot active
app.get('/api/bots', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify(Array.from(activeBots.values()), null, 2));
});

// API gửi lệnh điều khiển nhanh
app.get('/send-command', (req, res) => {
    const cmd = req.query.cmd || 'ĐIỂM DANH + SC88 +';
    let count = 0;
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: `CHAT|${cmd}` }));
            count++;
        }
    });
    res.send(`🚀 Đã phát lệnh thành công cho ${count} thiết bị: [ ${cmd} ]`);
});

// WebSocket Server Event Processing
wss.on('connection', (ws, req) => {
    clients.add(ws);
    ws.isAlive = true;
    let currentSlaveId = null;
    
    console.log(`[WS] Client kết nối từ IP: ${req.socket.remoteAddress}`);
    ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Kết nối thành công tới WebSocket Hub!' }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const now = Date.now();
            console.log('[WS RECV]:', data);

            // Xử lý PING từ Client để đo latency
            if (data.action === 'PING') {
                ws.send(JSON.stringify({ action: 'PONG', time: data.time || now }));
                return;
            }

            if (data.action === 'SYNC_REGISTER_TAB') {
                currentSlaveId = data.value?.id || ('slave_' + Math.random().toString(36).substring(2, 8));
                ws.slaveId = currentSlaveId;
                activeSlaves.set(currentSlaveId, {
                    ws: ws, id: currentSlaveId,
                    name: data.value?.name || 'Khách',
                    role: data.value?.role || 'VIP_BOT',
                    isOnLive: 1, url: '', lastSeen: now
                });
            } else if (data.action === 'SYNC_STATUS') {
                currentSlaveId = data.slaveId;
                if (activeSlaves.has(currentSlaveId)) {
                    let slave = activeSlaves.get(currentSlaveId);
                    slave.name = data.nickname || slave.name;
                    slave.isOnLive = data.is_on_live;
                    slave.url = data.url;
                    slave.lastSeen = now;
                }
            } else if (data.action === 'CREATE_BOT') {
                activeBots.set(data.botId, {
                    botId: data.botId,
                    account: data.account,
                    status: data.status || 'RUNNING',
                    timestamp: data.timestamp || new Date().toLocaleTimeString('vi-VN')
                });
                console.log(`[BOT CREATED] ID: ${data.botId} \vert{} Acc:${data.account}`);
            }

            // Broadcast dữ liệu/lệnh tới tất cả Client WebSocket khác
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'BROADCAST', data }));
                }
            });
        } catch (e) {
            console.error('[WS ERROR]: Lỗi xử lý message:', e.message);
        }
    });

    ws.on('close', () => {
        clients.delete(ws);
        if (ws.slaveId && activeSlaves.has(ws.slaveId)) {
            activeSlaves.delete(ws.slaveId);
        }
        console.log('[WS] Client đã ngắt kết nối.');
    });
});

server.listen(PORT, () => {
    console.log(`🚀 [HENDY SERVER HUB] Đang chạy tại cổng: ${PORT}`);
    console.log(`🌐 TRUY CẬP DỰ ÁN TẠI: http://localhost:${PORT}`);
});
