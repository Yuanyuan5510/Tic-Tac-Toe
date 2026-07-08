const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

// 游戏状态和玩家匹配
const games = {};
const players = {};
// 跟踪每个 socket 创建的房间（一个 socket 只允许创建一个未关闭的房间）
const createdRoomsBySocket = {};

function attachSocketHandlers(io) {
    // 广播当前房间列表给所有连接的客户端
    function broadcastRoomList() {
        try {
            const roomList = Object.keys(games).map(roomId => {
                const game = games[roomId];
                return {
                    roomId: roomId,
                    players: game.players.size,
                    status: game.gameOver ? 'Game Over' : (game.players.size === 2 ? 'In Progress' : 'Waiting for Player')
                };
            });
            io.emit('room-list', roomList);
        } catch (e) {
            console.warn('broadcastRoomList error:', e && e.message);
        }
    }

    io.on('connection', (socket) => {
        console.log('新玩家连接:', socket.id);

        // 创建房间（房主专用）
        socket.on('create-room', (roomId) => {
            console.log(`create-room 请求: socket=${socket.id}, roomId=${roomId}`);
            if (createdRoomsBySocket[socket.id] && games[createdRoomsBySocket[socket.id]]) {
                const existing = createdRoomsBySocket[socket.id];
                socket.emit('action-error', { message: `您已有未关闭的房间 (${existing})，请先关闭后再创建新房间` });
                console.log(`拒绝创建新房间: socket=${socket.id} 已有房间 ${existing}`);
                return;
            }

            if (games[roomId]) {
                socket.emit('action-error', { message: `房间 ${roomId} 已存在，请使用其他房间号或直接加入` });
                console.log(`拒绝创建已存在房间: socket=${socket.id}, roomId=${roomId}`);
                return;
            }

            games[roomId] = {
                players: new Set(),
                board: ['', '', '', '', '', '', '', '', ''],
                currentPlayer: 'X',
                gameOver: false,
                creator: socket.id
            };
            createdRoomsBySocket[socket.id] = roomId;
            games[roomId].players.add(socket.id);
            players[socket.id] = {
                roomId: roomId,
                symbol: 'X'
            };
            socket.join(roomId);

            console.log(`房间 ${roomId} 已创建并加入: socket=${socket.id}`);
            socket.emit('waiting-for-player', {
                roomId,
                playerSymbol: 'X',
                isCreator: true
            });
            broadcastRoomList();
        });

        // 加入游戏
        socket.on('join-game', (roomId) => {
            console.log(`join-game 请求: socket=${socket.id}, roomId=${roomId}`);
            if (!games[roomId]) {
                socket.emit('action-error', { message: `房间 ${roomId} 不存在，请先创建或检查房间号` });
                console.log(`房间不存在: socket=${socket.id}, roomId=${roomId}`);
                return;
            }

            if (games[roomId].players.has(socket.id) || (players[socket.id] && players[socket.id].roomId === roomId)) {
                socket.emit('action-error', { message: '您已在该房间中，无需重复加入' });
                console.log(`重复 join 请求被忽略: socket=${socket.id}, roomId=${roomId}`);
                return;
            }

            if (games[roomId].players.size >= 2) {
                socket.emit('action-error', { message: '房间已满' });
                console.log(`房间已满，拒绝加入: socket=${socket.id}, roomId=${roomId}`);
                return;
            }

            games[roomId].players.add(socket.id);
            players[socket.id] = {
                roomId: roomId,
                symbol: games[roomId].players.size === 1 ? 'X' : 'O'
            };

            socket.join(roomId);

            console.log(`房间 ${roomId} 当前玩家数: ${games[roomId].players.size}`);
            if (games[roomId].players.size === 2) {
                io.to(roomId).emit('game-started', {
                    roomId,
                    playerSymbol: players[socket.id].symbol,
                    isCreator: games[roomId].creator === socket.id
                });
                broadcastRoomList();
            } else {
                socket.emit('waiting-for-player', {
                    roomId,
                    playerSymbol: players[socket.id].symbol,
                    isCreator: games[roomId].creator === socket.id
                });
                broadcastRoomList();
            }
        });

        // 扫描所有房间
        socket.on('scan-rooms', () => {
            const roomList = Object.keys(games).map(roomId => {
                const game = games[roomId];
                return {
                    roomId: roomId,
                    players: game.players.size,
                    status: game.gameOver ? 'Game Over' : (game.players.size === 2 ? 'In Progress' : 'Waiting for Player')
                };
            });
            socket.emit('room-list', roomList);
        });

        // 玩家移动
        socket.on('player-move', (data) => {
            const { roomId, cellIndex } = data;
            console.log(`player-move: socket=${socket.id}, room=${roomId}, cell=${cellIndex}`);
            const game = games[roomId];

            if (!game || game.gameOver) return;

            // 检查是否是当前玩家的回合
            if (game.currentPlayer !== players[socket.id].symbol) return;

            // 检查单元格是否已被占用
            if (game.board[cellIndex] !== '') return;

            // 更新棋盘
            game.board[cellIndex] = game.currentPlayer;

            // 检查是否获胜
            const winner = checkWinner(game.board);
            if (winner) {
                game.gameOver = true;
                io.to(roomId).emit('game-over', {
                    winner: winner,
                    board: game.board
                });
                return;
            }

            // 检查是否平局
            if (!game.board.includes('')) {
                game.gameOver = true;
                io.to(roomId).emit('game-over', {
                    winner: null,
                    board: game.board
                });
                return;
            }

            // 切换玩家
            game.currentPlayer = game.currentPlayer === 'X' ? 'O' : 'X';
            io.to(roomId).emit('board-update', {
                board: game.board,
                currentPlayer: game.currentPlayer
            });
        });

        // 玩家退出房间
        socket.on('leave-room', (roomId) => {
            console.log(`leave-room: socket=${socket.id}, room=${roomId}`);
            if (!games[roomId]) return;

            // 若退出者为房主，则关闭房间（通知所有玩家并清理）
            if (games[roomId].creator === socket.id) {
                console.log(`房主退出，房间 ${roomId} 关闭 by ${socket.id}`);
                io.to(roomId).emit('room-closed', { roomId });
                // 清理玩家映射
                const memberSockets = games[roomId].players || [];
                memberSockets.forEach(sid => delete players[sid]);
                // 清理创建者记录
                delete createdRoomsBySocket[socket.id];
                delete games[roomId];
                // 房间已删除，广播更新
                broadcastRoomList();
                return;
            }

            // 从游戏中移除玩家
            games[roomId].players.delete(socket.id);

            // 如果只剩一名玩家，通知对方
            if (games[roomId].players.size === 1) {
                const remaining = Array.from(games[roomId].players)[0];
                io.to(remaining).emit('opponent-disconnected');
            }

            // 如果房间为空，删除房间
            if (games[roomId].players.size === 0) {
                // 若没有玩家，且房间存在，清理创建者记录
                const creatorId = games[roomId].creator;
                if (creatorId) delete createdRoomsBySocket[creatorId];
                delete games[roomId];
                // 房间已删除，广播更新
                broadcastRoomList();
            }

            delete players[socket.id];

            // 通知客户端已成功退出房间
            socket.emit('room-left');
        });

        // 断开连接
        socket.on('disconnect', () => {
            const roomId = players[socket.id]?.roomId;
            console.log(`disconnect: socket=${socket.id}, room=${roomId}`);
            // 如果创建了房间的房主断开，则关闭房间
            const ownedRoom = createdRoomsBySocket[socket.id];
            if (ownedRoom && games[ownedRoom]) {
                console.log(`房主断开连接，关闭房间 ${ownedRoom} by ${socket.id}`);
                io.to(ownedRoom).emit('room-closed', { roomId: ownedRoom });
                const memberSockets = games[ownedRoom].players || [];
                memberSockets.forEach(sid => delete players[sid]);
                delete createdRoomsBySocket[socket.id];
                delete games[ownedRoom];
                // 房间删除，广播更新
                broadcastRoomList();
            }

            if (!roomId) {
                delete players[socket.id];
                return;
            }

            // 从游戏中移除玩家（非房主情况）
            if (games[roomId]) {
                games[roomId].players.delete(socket.id);

                // 如果只剩一名玩家，通知对方
                if (games[roomId].players.size === 1) {
                    const remaining = Array.from(games[roomId].players)[0];
                    io.to(remaining).emit('opponent-disconnected');
                }

                // 如果房间为空，删除房间并清理创建者记录
                if (games[roomId].players.size === 0) {
                    const creatorId = games[roomId].creator;
                    if (creatorId) delete createdRoomsBySocket[creatorId];
                    delete games[roomId];
                    // 房间删除，广播更新
                    broadcastRoomList();
                } else {
                    // 玩家数量变化，广播更新
                    broadcastRoomList();
                }
            }

            delete players[socket.id];
        });

        // 重新开始游戏
        socket.on('restart-game', (roomId) => {
            if (!games[roomId]) return;

            games[roomId] = {
                players: games[roomId].players,
                board: ['', '', '', '', '', '', '', '', ''],
                currentPlayer: 'X',
                gameOver: false
            };

            io.to(roomId).emit('game-restarted', {
                currentPlayer: 'X'
            });
        });

        // 关闭房间（仅创建者可执行）
        socket.on('close-room', (roomId) => {
            try {
                if (!games[roomId]) return;
                if (games[roomId].creator !== socket.id) {
                    socket.emit('action-error', { message: '只有房主可以关闭房间' });
                    return;
                }

                // 通知房间内其他玩家房间已关闭
                io.to(roomId).emit('room-closed', { roomId });

                // 断开并清理玩家
                const memberSockets = games[roomId].players || [];
                memberSockets.forEach(sid => {
                    delete players[sid];
                });
                // 清理创建者记录并删除房间
                if (games[roomId].creator) {
                    delete createdRoomsBySocket[games[roomId].creator];
                }
                delete games[roomId];
                console.log(`房间 ${roomId} 已被关闭 by ${socket.id}`);
            } catch (e) {
                console.error('close-room 处理错误', e.message);
            }
        });
    });
}

// 检查获胜条件
function checkWinner(board) {
    const winningConditions = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
        [0, 4, 8], [2, 4, 6]            // 对角线
    ];

    for (const [a, b, c] of winningConditions) {
        if (board[a] && board[a] === board[b] && board[b] === board[c]) {
            return board[a];
        }
    }
    return null;
}

function startServer(portInput) {
    const serverPort = portInput || process.env.PORT || 31480;
    const fs = require('fs');
    const publicDir = path.join(__dirname, 'public');
    const localClientPath = path.join(publicDir, 'socket.io.min.js');

    // 如果 public 下没有 socket.io 客户端文件，尝试从已安装的 socket.io 包复制一份
    try {
        if (!fs.existsSync(localClientPath)) {
            try {
                const clientDist = require.resolve('socket.io/client-dist/socket.io.min.js');
                const content = fs.readFileSync(clientDist);
                // 确保 public 目录存在
                if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
                fs.writeFileSync(localClientPath, content);
                console.log('已将 socket.io 客户端复制到 public/socket.io.min.js');
            } catch (e) {
                console.warn('未能从 node_modules 复制 socket.io 客户端，若无网络将使用 CDN 回退。', e.message);
            }
        }
    } catch (e) {
        console.warn('检查或写入 public/socket.io.min.js 时发生错误：', e.message);
    }
    const server = http.createServer(app);
    const io = socketIo(server);

    // 静态文件服务
    app.use(express.static(path.join(__dirname, 'public')));

    // 默认路由
    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, 'public', 'zhu.html'));
    });

    // Attach socket handlers
    attachSocketHandlers(io);

    server.listen(serverPort, () => {
        console.log(`服务器运行在 http://localhost:${serverPort}`);
    });

    return { server, port: serverPort };
}

// 如果直接运行，则启动服务器
if (require.main === module) {
    startServer();
}

module.exports = { startServer };