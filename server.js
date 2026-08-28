const { WebSocketServer } = require('ws');

// Railway sẽ tự cấp phát cổng thông qua biến môi trường process.env.PORT
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

// Lưu trữ danh sách các Worker/Client đang kết nối kèm metadata
const clientsMap = new Map();

console.log(`[HenDy WebSocket Server V2] Đang khởi động trên cổng ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[+] Một Client (Master hoặc Worker) vừa kết nối thành công!');
    
    // Gán ID tạm thời cho client cho đến khi nhận được gói tin đăng ký
    let clientId = 'unknown_' + Math.random().toString(36).substring(2, 7);
    clientsMap.set(ws, { id: clientId, role: 'WORKER', name: 'Đang tải...' });

    // Gửi tín hiệu ping nội bộ để duy trì kết nối
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.ping();
        }
    }, 30000);

    // Nhận thông điệp từ Master Hub hoặc Worker
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message.toString());
            
            // 1. Nếu là gói đăng ký hoặc cập nhật trạng thái từ Slave/Worker
            if (data.action === 'SYNC_REGISTER_TAB' && data.value) {
                clientId = data.value.id || clientId;
                clientsMap.set(ws, {
                    id: clientId,
                    name: data.value.name || 'Không tên',
                    role: data.value.role || 'WORKER',
                    note: data.value.note || 'N/A',
                    isOk: data.value.isOk,
                    lastActive: Date.now()
                });
                console.log(`[SYNC] Đã cập nhật trạng thái Client: ${clientId} (${data.value.name})`);
            }

            // 2. Định tuyến tin nhắn (Hỗ trợ targetIds hoặc Broadcast toàn bộ)
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    // Nếu gói tin có chỉ định rõ targetIds cụ thể
                    if (data.targetIds && Array.isArray(data.targetIds) && data.targetIds.length > 0) {
                        const targetMeta = clientsMap.get(client);
                        if (targetMeta && data.targetIds.includes(targetMeta.id)) {
                            client.send(JSON.stringify(data));
                        }
                    } else {
                        // Broadcast chung cho tất cả nếu không giới hạn người nhận
                        client.send(message.toString());
                    }
                }
            });

        } catch (e) {
            // Trường hợp message là dạng chuỗi thuần túy không phải JSON
            const msgStr = message.toString();
            console.log(`[Đang chuyển tiếp tin nhắn thuần]: ${msgStr}`);
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(msgStr);
                }
            });
        }
    });

    // Khi client ngắt kết nối
    ws.on('close', () => {
        clearInterval(heartbeatInterval);
        clientsMap.delete(ws);
        console.log(`[-] Một Client (${clientId}) đã ngắt kết nối.`);
    });

    ws.on('error', (error) => {
        console.error(`[!] Lỗi kết nối từ client ${clientId}:`, error.message);
    });
});
