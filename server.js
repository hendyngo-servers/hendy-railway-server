const { WebSocketServer } = require('ws');

// Railway sẽ tự cấp phát cổng thông qua biến môi trường process.env.PORT
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`[HenDy WebSocket Server V2.0] Đang khởi động trên cổng ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[+] Một Client (Master hoặc Worker) vừa kết nối thành công!');
    
    // Gắn thuộc tính định danh tạm thời cho client
    ws.isAlive = true;
    ws.clientId = null;
    ws.clientRole = 'UNKNOWN'; // MASTER hoặc WORKER/SLAVE

    // Cơ chế phản hồi Heartbeat (Pong) từ client để chống rớt mạng
    ws.on('pong', () => {
        ws.isAlive = true;
    });

    // Nhận thông điệp từ Client
    ws.on('message', (message) => {
        try {
            let msgStr = message.toString();
            let data = JSON.parse(msgStr);

            // 1. Nếu client gửi hành động đăng ký thông tin (SYNC_REGISTER_TAB)
            if (data.action === 'SYNC_REGISTER_TAB' && data.value) {
                ws.clientId = data.value.id;
                ws.clientRole = data.value.role || 'WORKER';
                console.log(`[REG] Đã định danh Client -> ID: ${ws.clientId} | Role: ${ws.clientRole} | Tên: ${data.value.name}`);
            }

            console.log(`[Xử lý hành động]: ${data.action || 'UNKNOWN'} từ [${ws.clientId || 'Anonymous'}]`);

            // 2. Định tuyến tin nhắn (Hỗ trợ gửi cho toàn bộ hoặc lọc theo targetIds)
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    // Nếu message có mảng targetIds chỉ định rõ người nhận
                    if (data.targetIds && Array.isArray(data.targetIds) && data.targetIds.length > 0) {
                        if (client.clientId && data.targetIds.includes(client.clientId)) {
                            client.send(msgStr);
                        }
                    } else {
                        // Broadcast mặc định cho tất cả nếu không có target cụ thể
                        // (Có thể tùy chỉnh loại trừ chính người gửi nếu cần: client !== ws)
                        client.send(msgStr);
                    }
                }
            });

        } catch (e) {
            // Trường hợp message không phải dạng JSON (chuỗi thuần thông thường)
            console.log(`[Đang chuyển tiếp tin nhắn thô]: ${message.toString()}`);
            wss.clients.forEach((client) => {
                if (client.readyState === ws.OPEN) {
                    client.send(message.toString());
                }
            });
        }
    });

    ws.on('close', () => {
        console.log(`[-] Client [${ws.clientId || 'Unknown'}] đã ngắt kết nối.`);
    });

    ws.on('error', (error) => {
        console.error(`[!] Lỗi kết nối từ Client [${ws.clientId || 'Unknown'}]:`, error.message);
    });
});

// Kiểm tra và dọn dẹp các kết nối chết định kỳ mỗi 30 giây
const interval = setInterval(() => {
    wss.clients.forEach((ws) => {
        if (ws.isAlive === false) {
            console.log(`[!] Ngắt kết nối chết của Client ID: ${ws.clientId || 'Anonymous'}`);
            return ws.terminate();
        }
        ws.isAlive = false;
        ws.ping();
    });
}, 30000);

wss.on('close', () => {
    clearInterval(interval);
});
