const { WebSocketServer } = require('ws');

const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Lưu trữ danh sách chi tiết các Client đang kết nối
const clientsMap = new Map();

console.log(`[HenDy WebSocket Server PRO] Đang khởi động trên cổng ${PORT}`);

wss.on('connection', (ws) => {
    let clientId = 'slave_' + Math.random().toString(36).substring(2, 7);
    
    // Khởi tạo thông tin mặc định cho client mới
    clientsMap.set(ws, {
        id: clientId,
        name: 'Chưa đặt tên',
        role: 'WORKER',
        note: 'SC88',
        isOk: true,
        captchaSrc: '',
        lastActive: Date.now()
    });

    console.log(`[+] Client mới kết nối (Tạm thời ID: ${clientId})`);

    // Gửi tín hiệu giữ kết nối mỗi 25 giây (Chống timeout trên Railway)
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ action: 'SYNC_PING_REQUEST' }));
        }
    }, 25000);

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            let clientMeta = clientsMap.get(ws) || {};

            // 1. Cập nhật thông tin chi tiết khi Slave đăng ký hoặc báo cáo trạng thái
            if (data.action === 'SYNC_REGISTER_TAB' && data.value) {
                clientId = data.value.id || clientId;
                clientMeta = {
                    id: clientId,
                    name: data.value.name || clientMeta.name,
                    role: data.value.role || 'WORKER',
                    note: data.value.note || 'SC88',
                    isOk: data.value.isOk,
                    captchaSrc: data.value.captchaSrc || '',
                    lastActive: Date.now()
                };
                clientsMap.set(ws, clientMeta);
            }

            // 2. Tính năng mới: Master yêu cầu lấy danh sách toàn bộ Worker đang online
            if (data.action === 'GET_ALL_WORKERS') {
                const activeWorkers = Array.from(clientsMap.values());
                ws.send(JSON.stringify({
                    action: 'SYNC_WORKERS_LIST',
                    value: activeWorkers
                }));
                return;
            }

            // 3. Định tuyến tin nhắn thông minh (Broadcast hoặc gửi đích danh targetIds)
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    if (data.targetIds && Array.isArray(data.targetIds) && data.targetIds.length > 0) {
                        const targetMeta = clientsMap.get(client);
                        if (targetMeta && data.targetIds.includes(targetMeta.id)) {
                            client.send(JSON.stringify(data));
                        }
                    } else {
                        // Tránh gửi ngược lại chính thằng vừa gửi tin (nếu cần thiết, ở đây giữ nguyên broadcast)
                        client.send(message.toString());
                    }
                }
            });

        } catch (e) {
            // Trường hợp dữ liệu là tin nhắn thuần (không phải JSON)
            const msgStr = message.toString();
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(msgStr);
                }
            });
        }
    });

    ws.on('close', () => {
        clearInterval(heartbeatInterval);
        clientsMap.delete(ws);
        console.log(`[-] Client (${clientId}) đã ngắt kết nối.`);
    });

    ws.on('error', (error) => {
        console.error(`[!] Lỗi kết nối client:`, error.message);
    });
});
