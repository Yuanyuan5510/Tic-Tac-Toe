const http = require('http');
const { startServer } = require('./1.js');
const { exec } = require('child_process');

const DEFAULT_PORT = process.env.PORT || 31480;
const CHECK_PATH = '/zhu.html';
const MAX_RETRIES = 30;
const RETRY_INTERVAL = 1000; // ms

function openBrowser(url) {
    const platform = process.platform;
    let cmd;
    if (platform === 'win32') {
        cmd = `start "" "${url}"`;
    } else if (platform === 'darwin') {
        cmd = `open "${url}"`;
    } else {
        cmd = `xdg-open "${url}"`;
    }
    exec(cmd, (err) => {
        if (err) console.error('打开浏览器失败：', err.message);
    });
}

function checkService(port, retries = 0) {
    return new Promise((resolve, reject) => {
        const req = http.get({ hostname: '127.0.0.1', port: port, path: CHECK_PATH, timeout: 2000 }, (res) => {
            if (res.statusCode === 200) {
                resolve(true);
            } else {
                resolve(false);
            }
        });
        req.on('error', () => resolve(false));
        req.on('timeout', () => { req.destroy(); resolve(false); });
    });
}

async function waitForService(port) {
    for (let i = 0; i < MAX_RETRIES; i++) {
        const ok = await checkService(port);
        if (ok) return true;
        await new Promise(r => setTimeout(r, RETRY_INTERVAL));
    }
    return false;
}

async function main() {
    const { server, port } = startServer(DEFAULT_PORT);
    console.log('启动中，正在检查服务状态...');
    const ok = await waitForService(port);
    if (ok) {
        const url = `http://localhost:${port}${CHECK_PATH}`;
        console.log(`服务已就绪，打开：${url}`);
        openBrowser(url);
    } else {
        console.error('服务未在限定时间内响应，请检查日志。');
    }

    // 保持进程运行，输出简单指示
    server.on('close', () => {
        console.log('服务器已停止');
        process.exit(0);
    });
}

main().catch(err => {
    console.error('启动失败：', err);
    process.exit(1);
});
