/**
 * =====================================================================
 * ⚡ HENDY MASTER CENTRAL SERVER HUB & MOCK LIVE ENVIRONMENT (V3.8)
 * =====================================================================
 */

const WebSocket = require('ws');
const http = require('http');
const express = require('express');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 3000;
let activeSlaves = new Map();

// Phục vụ các file tĩnh (như index.html, css, js) từ thư mục hiện tại
app.use(express.static(__dirname));

// API cung cấp danh sách các Tab/Bot đang kết nối realtime lên Dashboard
app.get('/api/slaves', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    let slavesList = [];
    activeSlaves.forEach((client, id) => {
        slavesList.push({
            id: client.id,
            name: client.name,
            role: client.role,
            channel: client.channel,
            isOnLive: client.isOnLive,
            url: client.url,
            lastSeen: new Date(client.lastSeen).toLocaleTimeString('vi-VN')
        });
    });
    res.end(JSON.stringify(slavesList, null, 2));
});

// API giao diện điều khiển từ xa để bấm gửi lệnh xuống tất cả các Bot/Tab đang mở
app.get('/send-command', (req, res) => {
    const cmd = req.query.cmd || 'ĐIỂM DANH + SC88 +';
    let count = 0;
    
    wss.clients.forEach((client) => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify({ action: `CHAT|${cmd}` }));
            count++;
        }
    });
    res.send(`🚀 Đã phát lệnh xuống thành công cho ${count} thiết bị/tab: [ ${cmd} ]`);
});

// Trang chủ Tổng đài Cyberpunk Dashboard kèm theo giao diện quản trị mạng lưới
app.get('/dashboard', (req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <html>
            <head>
                <title>HENDY CYBERPUNK SERVER HUB - DASHBOARD</title>
                <style>
                    body { background: #050208; color: #00e5ff; font-family: monospace; text-align: center; padding: 20px; margin: 0; }
                    h1 { color: #ffcc00; text-shadow: 0 0 10px #ffcc00; }
                    .box { background: #111827; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px auto; width: 85%; text-align: left; box-shadow: 0 4px 15px rgba(0,0,0,0.5); }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #374151; padding: 8px; text-align: left; }
                    th { color: #10b981; }
                    .btn-action { background: #10b981; border: none; color: #fff; padding: 8px 14px; border-radius: 4px; cursor: pointer; font-weight: bold; margin: 5px; }
                    .btn-action:hover { background: #059669; }
                </style>
            </head>
            <body>
                <h1>🚀 TỔNG ĐÀI HENDY CYBERPUNK [VIP PRO v3.8] 🚀</h1>
                <h2>Trạng thái: <span style="color: #0f9;">ĐANG HOẠT ĐỘNG ONLINE</span></h2>
                
                <div class="box">
                    <h3>🕹️ Điều khiển Nhanh Tab / Bot</h3>
                    <button class="btn-action" onclick="sendCmd('ĐIỂM DANH + SC88 +')">Gửi Điểm Danh</button>
                    <button class="btn-action" onclick="sendCmd('SC88 + Xỉu + user123')">Gửi Kèo Xỉu</button>
                    <button class="btn-action" onclick="location.href='/'">Đến Phòng Test Live Mock</button>
                </div>

                <div class="box">
                    <h3>📊 Thống kê mạng lưới Đàn Em (Slaves)</h3>
                    <p>Tổng số thiết bị kết nối WebSocket: <span id="totalClients" style="color:#ffcc00;">0</span></p>
                    <table>
                        <thead>
                            <tr>
                                <th>ID Slave</th>
                                <th>Nickname</th>
                                <th>Kênh / Role</th>
                                <th>Trạng thái Live</th>
                                <th>URL hiện tại</th>
                            </tr>
                        </thead>
                        <tbody id="slaveTableBody">
                            <tr><td colspan="5" style="text-align:center; color:#6b7280;">Đang tải dữ liệu...</td></tr>
                        </tbody>
                    </table>
                </div>
                <div style="font-size: 11px; color: #555;">Cyberpunk Core Engine v3.8 - Running on Port ${PORT}</div>

                <script>
                    async function fetchStatus() {
                        try {
                            let res = await fetch('/api/slaves');
                            let data = await res.json();
                            document.getElementById('totalClients').innerText = data.length;
                            let tbody = document.getElementById('slaveTableBody');
                            if (data.length === 0) {
                                tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:#6b7280;">Chưa có Tab nào kết nối.</td></tr>';
                                return;
                            }
                            tbody.innerHTML = data.map(s => \`
                                <tr>
                                    <td>\${s.id}</td>
                                    <td style="color:#00ffcc; font-weight:bold;">\${s.name}</td>
                                    <td>\${s.channel} (\${s.role})</td>
                                    <td>\${s.isOnLive ? '<span style="color:#10b981">🟢 Đang Live</span>' : '<span style="color:#ef4444">🔴 Ngoại tuyến</span>'}</td>
                                    <td style="word-break:break-all; font-size:10px;"><a href="\${s.url}" target="_blank" style="color:#38bdf8;">\${s.url || 'N/A'}</a></td>
                                </tr>
                            \`).join('');
                        } catch(e) {}
                    }
                    function sendCmd(cmd) {
                        fetch('/send-command?cmd=' + encodeURIComponent(cmd))
                            .then(r => r.text()).then(msg => alert(msg));
                    }
                    setInterval(fetchStatus, 3000);
                    fetchStatus();
                </script>
            </body>
        </html>
    `);
});

// Thuật toán dọn rác Heartbeat định kỳ kiểm tra kết nối WebSocket sống/chết
const heartbeatInterval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) return ws.terminate();
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

// Xử lý sự kiện kết nối WebSocket từ các Tab/Bot client
wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let currentSlaveId = null;
    console.log('🟢 Bot / Tab đã kết nối vào phòng test WebSocket!');

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!data || !data.action) return;

            console.log('📥 Nhận từ Tab/Bot:', data);

            switch (data.action) {
                case 'SYNC_REGISTER_TAB':
                    currentSlaveId = data.value?.id || ('slave_' + Math.random().toString(36).substring(2, 8));
                    ws.slaveId = currentSlaveId;
                    activeSlaves.set(currentSlaveId, {
                        ws: ws,
                        id: currentSlaveId,
                        name: data.value?.name || 'Khách',
                        role: data.value?.role || 'FOLLOWER',
                        channel: data.value?.channel || 'KENH-1',
                        isOnLive: 0,
                        url: '',
                        lastSeen: Date.now()
                    });
                    console.log(`[REGISTER] Tab đăng ký: ID = ${currentSlaveId}`);
                    break;

                case 'SYNC_STATUS':
                    if (data.slaveId && activeSlaves.has(data.slaveId)) {
                        let slaveInfo = activeSlaves.get(data.slaveId);
                        slaveInfo.isOnLive = data.is_on_live;
                        slaveInfo.url = data.url;
                        slaveInfo.name = data.nickname || slaveInfo.name;
                        slaveInfo.lastSeen = Date.now();
                    }
                    // Phản hồi xác nhận trạng thái cho client nếu cần
                    ws.send(JSON.stringify({ status: 'OK', message: 'Sync received' }));
                    break;

                case 'PING':
                    ws.send(JSON.stringify({ action: 'PONG', time: Date.now() }));
                    break;

                default:
                    // Broadcast các hành động chat hoặc tín hiệu khác tới các tab khác
                    if (data.action !== 'SYNC_PING_REQUEST') {
                        console.log(`[PHÁT LỆNH] Lệnh: ${data.action}`);
                    }
                    wss.clients.forEach((client) => {
                        if (client !== ws && client.readyState === WebSocket.OPEN) {
                            client.send(message.toString());
                        }
                    });
                    break;
            }
        } catch (e) {
            console.error('Lỗi parse message:', e);
        }
    });

    ws.on('close', () => {
        if (ws.slaveId && activeSlaves.has(ws.slaveId)) {
            activeSlaves.delete(ws.slaveId);
            console.log(`[NGẮT KẾT NỐI] Đã xóa Tab Slave: ${ws.slaveId}`);
        } else {
            console.log('🔴 Tab đã ngắt kết nối WebSocket.');
        }
    });
});

wss.on('close', () => {
    clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
    console.log(`🚀 [HENDY SERVER HUB] Đang chạy tại: http://localhost:${PORT}`);
    console.log(`👉 Truy cập giao diện Mock Live tại: http://localhost:${PORT}`);
    console.log(`👉 Truy cập Dashboard quản lý tại: http://localhost:${PORT}/dashboard`);
});
