const { WebSocketServer } = require('ws');

// Railway sẽ tự cấp phát cổng thông qua biến môi trường process.env.PORT
const PORT = process.env.PORT || 8080;
const wss = new WebSocketServer({ port: PORT });

console.log(`[HenDy WebSocket Server] Đang khởi động trên cổng ${PORT}`);

wss.on('connection', (ws) => {
    console.log('[+] Một Client (Master hoặc Worker) vừa kết nối thành công!');

    // Nhận lệnh từ Master Hub hoặc Worker và chuyển tiếp (broadcast)
    ws.on('message', (message) => {
        const msgStr = message.toString();
        console.log(`[Đang chuyển tiếp tin nhắn]: ${msgStr}`);

        wss.clients.forEach((client) => {
            if (client.readyState === ws.OPEN) {
                client.send(msgStr);
            }
        });
    });

    ws.on('close', () => {
        console.log('[-] Một Client đã ngắt kết nối.');
    });
});
