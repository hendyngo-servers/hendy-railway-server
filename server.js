const WebSocket = require('ws');
const http = require('http');
const express = require('express');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
const SECRET_TOKEN = process.env.SECRET_TOKEN || 'hendy_secret_pro_key';

// Bộ nhớ RAM lưu trữ tạm thời
const clients = new Set();
const activeSlaves = new Map();
const activeBots = new Map();
const activeUsers = new Map([
    [1, { id: 1, username: 'admin_hendy', role: 'Admin', status: 'Hoạt động' }],
    [2, { id: 2, username: 'mod_hades', role: 'Mod', status: 'Hoạt động' }],
    [3, { id: 3, username: 'test_user01', role: 'User', status: 'Khóa' }]
]);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// Route chính phục vụ trang Control Panel
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API lấy danh sách Slaves
app.get('/api/slaves', (req, res) => {
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
    res.json(slavesList);
});

// API lấy danh sách Bots
app.get('/api/bots', (req, res) => {
    res.json(Array.from(activeBots.values()));
});

// API Quản lý Người dùng (Users CRUD)
app.get('/api/users', (req, res) => {
    res.json(Array.from(activeUsers.values()));
});

app.post('/api/users', (req, res) => {
    const { username, role } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Tên đăng nhập không được để trống' });
    }
    const id = activeUsers.size + 1;
    const newUser = { id, username, role: role || 'User', status: 'Hoạt động' };
    activeUsers.set(id, newUser);
    res.status(201).json(newUser);
});

// API gửi lệnh điều khiển nhanh
app.get('/send-command', (req, res) => {
    const cmd = req.query.cmd || 'ĐIỂM DANH + SC88 +';
    let count = 0;
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: `CHAT|${cmd}`, type: 'COMMAND', data: cmd }));
            count++;
        }
    });
    res.send(`🚀 Đã phát lệnh thành công cho ${count} thiết bị: [ ${cmd} ]`);
});

// Giám sát kết nối WebSocket (Heartbeat Interval)
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log('[WS] Phát hiện ngắt kết nối không phản hồi (Dead Client).');
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('connection', (ws) => {
    clients.add(ws);
    ws.isAlive = true;
    let currentSlaveId = null;

    console.log('[WS] Client kết nối thành công.');
    ws.send(JSON.stringify({ type: 'SYSTEM', message: 'Kết nối thành công tới Hendy Central WebSocket Hub!' }));

    ws.on('pong', () => { ws.isAlive = true; });

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            const now = Date.now();
            console.log('[WS RECV]:', data);

            // Phản hồi PING -> PONG tính Latency (Độ trễ)
            if (data.action === 'PING') {
                ws.send(JSON.stringify({ action: 'PONG', time: data.time }));
                return;
            }

            if (data.action === 'SYNC_REGISTER_TAB') {
                currentSlaveId = data.value?.id || ('slave_' + Math.random().toString(36).substring(2, 8));
                ws.slaveId = currentSlaveId;
                activeSlaves.set(currentSlaveId, {
                    ws: ws,
                    id: currentSlaveId,
                    name: data.value?.name || 'Khách',
                    role: data.value?.role || 'VIP_BOT',
                    isOnLive: 1,
                    url: '',
                    lastSeen: now
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
                console.log(`[BOT CREATED] ID: ${data.botId} | Acc: ${data.account}`);
            }

            // Broadcast dữ liệu/lệnh tới tất cả WebSocket Clients khác
            wss.clients.forEach((client) => {
                if (client !== ws && client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({ type: 'BROADCAST', data }));
                }
            });
        } catch (e) {
            console.error('[WS ERROR]: Lỗi định dạng JSON message', e);
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

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
    console.log(`🚀 [HENDY SERVER HUB] Đang chạy tại cổng: ${PORT}`);
});
