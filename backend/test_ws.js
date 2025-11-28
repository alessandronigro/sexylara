const WebSocket = require('ws');
const ws = new WebSocket('ws://localhost:5001/ws?user_id=testuser');
ws.on('open', () => {
    console.log('Connected to WS');
    const msg = JSON.stringify({
        text: 'ciao',
        traceId: 'test123',
        npc_id: 'b3ced21a-198a-4802-82fd-2c0053e98989',
        userId: 'testuser'
    });
    ws.send(msg);
});
ws.on('message', data => {
    console.log('Received:', data.toString());
});
ws.on('error', err => console.error('WS error', err));
ws.on('close', () => console.log('WS closed'));
