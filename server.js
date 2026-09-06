/**
 * =====================================================================
 * ⚡ HENDY MASTER CENTRAL SERVER HUB (SYNC 2-WAY V3.8 - ADVANCED)
 * =====================================================================
 */

const WebSocket = require('ws');
const http = require('http');

const PORT = process.env.PORT || 3000;

// Tạo HTTP Server phục vụ trang chủ trạng thái & dashboard quản lý tab realtime
const server = http.createServer((req, res) => {
    if (req.url === '/api/slaves') {
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
        return;
    }

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`
        <html>
            <head>
                <title>HENDY CYBERPUNK SERVER HUB</title>
                <style>
                    body { background: #050208; color: #00e5ff; font-family: monospace; text-align: center; padding: 20px; }
                    h1 { color: #ffcc00; text-shadow: 0 0 10px #ffcc00; }
                    .box { background: #111827; border: 1px solid #10b981; border-radius: 8px; padding: 15px; margin: 20px auto; width: 80%; text-align: left; }
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                    th, td { border: 1px solid #374151; padding: 8px; text-align: left; }
                    th { color: #10b981; }
                </style>
            </head>
            <body>
                <h1>🚀 TỔNG ĐÀI HENDY CYBERPUNK [VIP PRO v3.8] 🚀</h1>
                <h2>Trạng thái: <span style="color: #0f9;">ĐANG HOẠT ĐỘNG ONLINE</span></h2>
                <div class="box">
                    <h3>📊 Thống kê mạng lưới Đàn Em</h3>
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
                    setInterval(fetchStatus, 3000);
                    fetchStatus();
                </script>
            </body>
        </html>
    `);
});

const wss = new WebSocket.Server({ server });
let activeSlaves = new Map();

// Thuật toán dọn rác Heartbeat định kỳ
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('connection', (ws, req) => {
    ws.isAlive = true;
    ws.on('pong', () => { ws.isAlive = true; });

    let currentSlaveId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            if (!data || !data.action) return;

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
                    break;

                case 'PING':
                    ws.send(JSON.stringify({ action: 'PONG', time: Date.now() }));
                    break;

                default:
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
            console.error(`[LỖI DỮ LIỆU]:`, e.message);
        }
    });

    ws.on('close', () => {
        if (ws.slaveId && activeSlaves.has(ws.slaveId)) {
            activeSlaves.delete(ws.slaveId);
            console.log(`[NGẮT KẾT NỐI] Đã xóa Tab Slave: ${ws.slaveId}`);
        }
    });
});

wss.on('close', () => {
    clearInterval(interval);
});

server.listen(PORT, () => {
    console.log(`[HENDY SERVER HUB] Đang chạy tại cổng: ${PORT}`);
});
