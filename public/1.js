console.log('public/1.js loaded');

function init() {
    const socket = io();

    // 诊断日志：帮助排查打包后连接问题
    socket.on('connect', () => {
        console.log('Socket 已连接, id=', socket.id);
    });
    socket.on('connect_error', (err) => {
        console.error('Socket 连接错误:', err);
    });
    socket.on('disconnect', (reason) => {
        console.warn('Socket 已断开，原因：', reason);
    });

    // DOM 元素
    const createRoomBtn = document.getElementById('create-room-btn');
    const scanRoomsBtn = document.getElementById('scan-rooms-btn');
    const roomInputDiv = document.getElementById('room-input');
    const roomIdInput = document.getElementById('room-id');
    const joinRoomBtn = document.getElementById('join-room-btn');
    const backBtn = document.getElementById('back-btn');
    const roomListDiv = document.getElementById('room-list');
    const roomsContainer = document.getElementById('rooms-container');
    const backToMenuBtn = document.getElementById('back-to-menu');
    const gameContainer = document.getElementById('game-container');
    const statusDisplay = document.getElementById('status');
    const resultDisplay = document.getElementById('result');
    const restartButton = document.getElementById('restart-button');
    const cells = document.querySelectorAll('.cell');
    const waitingMessage = document.getElementById('waiting-message');
    const opponentDisconnected = document.getElementById('opponent-disconnected');
    const findNewOpponentBtn = document.getElementById('find-new-opponent');
    const mainMenu = document.getElementById('main-menu');
    const exitRoomBtn = document.getElementById('exit-room-btn');
    const closeRoomBtn = document.getElementById('close-room-btn');
    const toast = document.getElementById('toast');

    let currentRoomId = '';
    let playerSymbol = '';
    let isCreator = false;
    let isJoiningRoom = false;

    // 创建房间
    createRoomBtn.addEventListener('click', () => {
        if (isJoiningRoom) {
            showToast('正在创建房间，请稍候', 2000);
            return;
        }
        // 自动生成房间号并直接创建房间
        const roomId = Math.random().toString(36).slice(2, 8);
        console.log('创建房间，生成 roomId=', roomId);
        roomIdInput.value = roomId;
        isJoiningRoom = true;
        socket.emit('create-room', roomId);
        currentRoomId = roomId;
        roomInputDiv.classList.add('hidden');
        waitingMessage.classList.remove('hidden');
    });

    // 扫描房间
    scanRoomsBtn.addEventListener('click', () => {
        console.log('请求扫描房间');
        socket.emit('scan-rooms');
        mainMenu.classList.add('hidden');
        roomListDiv.classList.remove('hidden');
    });

    // 加入房间
    joinRoomBtn.addEventListener('click', () => {
        const roomId = roomIdInput.value.trim();
        if (roomId) {
            joinRoom(roomId);
        }
    });

    // 返回主菜单
    backBtn.addEventListener('click', () => {
        roomInputDiv.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    // 返回主菜单（从房间列表）
    backToMenuBtn.addEventListener('click', () => {
        roomListDiv.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    // 重新开始游戏
    restartButton.addEventListener('click', () => {
        socket.emit('restart-game', currentRoomId);
        restartButton.classList.add('hidden');
    });

    // 寻找新对手
    findNewOpponentBtn.addEventListener('click', () => {
        opponentDisconnected.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    // 退出房间
    exitRoomBtn.addEventListener('click', () => {
        if (currentRoomId) {
            socket.emit('leave-room', currentRoomId);
        }
        gameContainer.classList.add('hidden');
        mainMenu.classList.remove('hidden');
    });

    // 单元格点击
    cells.forEach(cell => {
        cell.addEventListener('click', () => {
            if (cell.textContent !== '') return;

            const cellIndex = parseInt(cell.getAttribute('data-index'));
            socket.emit('player-move', {
                roomId: currentRoomId,
                cellIndex: cellIndex
            });
        });
    });

    // 加入房间
    function joinRoom(roomId) {
        if (isJoiningRoom) {
            showToast('正在加入房间，请稍候', 2000);
            return;
        }
        if (currentRoomId && currentRoomId === roomId) {
            showToast('您已在该房间中，无需重复加入', 3000);
            return;
        }
        isJoiningRoom = true;
        console.log('发送 join-game, roomId=', roomId);
        socket.emit('join-game', roomId);
        currentRoomId = roomId;
        roomInputDiv.classList.add('hidden');
        waitingMessage.classList.remove('hidden');
    }

    // 关闭房间（仅房主可用）
    closeRoomBtn.addEventListener('click', () => {
        if (!currentRoomId) return;
        console.log('发送 close-room, roomId=', currentRoomId);
        socket.emit('close-room', currentRoomId);
    });

    // 显示友好提示
    function showToast(msg, timeout = 3500) {
        if (!toast) return;
        toast.textContent = msg;
        toast.classList.remove('hidden');
        clearTimeout(toast._hideTimer);
        toast._hideTimer = setTimeout(() => {
            toast.classList.add('hidden');
        }, timeout);
    }

    // 更新棋盘
    function updateBoard(board) {
        cells.forEach((cell, index) => {
            cell.textContent = board[index];
            cell.classList.remove('x', 'o', 'winning');
            if (board[index] === 'X') {
                cell.classList.add('x');
            } else if (board[index] === 'O') {
                cell.classList.add('o');
            }
        });
    }

    // Socket 事件处理
    socket.on('waiting-for-player', (data) => {
        playerSymbol = data.playerSymbol;
        // 服务端告知是否为创建者
        isCreator = !!data.isCreator;
        isJoiningRoom = false;
        waitingMessage.classList.remove('hidden');
        gameContainer.classList.add('hidden');
        exitRoomBtn.classList.remove('hidden');
        statusDisplay.textContent = `您是 ${playerSymbol}，等待对手加入...`;
        if (isCreator) {
            closeRoomBtn.classList.remove('hidden');
        } else {
            closeRoomBtn.classList.add('hidden');
        }
    });

    socket.on('game-started', (data) => {
        playerSymbol = data.playerSymbol;
        // 服务端告知是否为创建者
        isCreator = !!data.isCreator;
        isJoiningRoom = false;
        waitingMessage.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        exitRoomBtn.classList.remove('hidden');
        statusDisplay.textContent = `您是 ${playerSymbol}，等待对手的回合...`;
        if (playerSymbol === 'X') {
            statusDisplay.textContent = `您是 ${playerSymbol}，轮到您了`;
        }
        // 只有创建者可以看到关闭房间按钮
        if (isCreator) {
            closeRoomBtn.classList.remove('hidden');
        } else {
            closeRoomBtn.classList.add('hidden');
        }
    });

    socket.on('board-update', (data) => {
        updateBoard(data.board);
        statusDisplay.textContent = `当前玩家: ${data.currentPlayer}`;
    });

    socket.on('game-over', (data) => {
        updateBoard(data.board);
        restartButton.classList.remove('hidden');

        if (data.winner) {
            if (data.winner === playerSymbol) {
                resultDisplay.textContent = `恭喜！您赢了！`;
            } else {
                resultDisplay.textContent = `对手获胜！`;
            }
        } else {
            resultDisplay.textContent = `游戏平局！`;
        }
    });

    socket.on('opponent-disconnected', () => {
        gameContainer.classList.add('hidden');
        opponentDisconnected.classList.remove('hidden');
    });

    socket.on('room-closed', (data) => {
        // 房间被关闭，所有玩家返回主菜单
        console.log('收到 room-closed', data);
        currentRoomId = '';
        isCreator = false;
        gameContainer.classList.add('hidden');
        waitingMessage.classList.add('hidden');
        opponentDisconnected.classList.add('hidden');
        exitRoomBtn.classList.add('hidden');
        mainMenu.classList.remove('hidden');
        closeRoomBtn.classList.add('hidden');
        showToast('房间已被关闭');
    });

    socket.on('action-error', (data) => {
        const message = data && data.message ? data.message : '操作失败';
        console.warn('action-error', message);
        showToast(message);
    });

    socket.on('game-restarted', () => {
        updateBoard(['', '', '', '', '', '', '', '', '']);
        statusDisplay.textContent = `您是 ${playerSymbol}，等待对手的回合...`;
        if (playerSymbol === 'X') {
            statusDisplay.textContent = `您是 ${playerSymbol}，轮到您了`;
        }
        resultDisplay.textContent = '';
        restartButton.classList.add('hidden');
    });

    // 房间列表
    socket.on('room-list', (roomList) => {
        roomsContainer.innerHTML = '';

        // 操作提示：指导用户如何加入并关闭房间
        const help = document.createElement('div');
        help.className = 'room-help';
        help.innerHTML = `
            <strong>提示：</strong> 问题与反馈请联系wang.station@hotmail.com
        `;
        roomsContainer.appendChild(help);
        roomList.forEach(room => {
            const roomElement = document.createElement('div');
            roomElement.className = 'room-item';
            roomElement.innerHTML = `
                <div>
                    <strong>房间号:</strong> ${room.roomId}
                    <br>
                    <strong>状态:</strong> ${room.status}
                    <br>
                    <strong>玩家数:</strong> ${room.players}/2
                </div>
                <button class="join-room-btn" data-room-id="${room.roomId}">${room.players >= 2 ? '已满' : '加入'}</button>
            `;
            roomsContainer.appendChild(roomElement);
        });

        // 为每个"加入"按钮添加事件监听器
        document.querySelectorAll('.join-room-btn').forEach(btn => {
            if (btn.textContent === '已满') {
                btn.disabled = true;
                btn.classList.add('disabled');
                return;
            }
            btn.addEventListener('click', () => {
                const roomId = btn.getAttribute('data-room-id');
                roomIdInput.value = roomId;
                joinRoom(roomId);
            });
        });
    });

    // 背景颜色变化
    function changeBackgroundColor() {
        const colors = [
            '#f5f7fa', '#c3cfe2', '#e0f7fa', '#e8f5e9',
            '#fff3e0', '#ffebee', '#f3e5f5', '#e8eaf6'
        ];

        let currentColorIndex = 0;

        setInterval(() => {
            document.body.style.background = `linear-gradient(135deg, ${colors[currentColorIndex]} 0%, ${colors[(currentColorIndex + 1) % colors.length]} 100%)`;
            currentColorIndex = (currentColorIndex + 1) % colors.length;
        }, 5000);
    }

    // 初始化背景颜色变化
    changeBackgroundColor();

    // 在游戏结束时添加获胜方格的动画
    socket.on('game-over', (data) => {
        updateBoard(data.board);
        restartButton.classList.remove('hidden');

        if (data.winner) {
            highlightWinningCells(data.board, data.winner);

            if (data.winner === playerSymbol) {
                resultDisplay.textContent = `恭喜！您赢了！`;
            } else {
                resultDisplay.textContent = `对手获胜！`;
            }
        } else {
            resultDisplay.textContent = `游戏平局！`;
        }
    });

    // 高亮获胜方格
    function highlightWinningCells(board, winner) {
        const winningConditions = [
            [0, 1, 2], [3, 4, 5], [6, 7, 8], // 行
            [0, 3, 6], [1, 4, 7], [2, 5, 8], // 列
            [0, 4, 8], [2, 4, 6]            // 对角线
        ];

        for (const [a, b, c] of winningConditions) {
            if (board[a] === winner && board[b] === winner && board[c] === winner) {
                cells[a].classList.add('winning');
                cells[b].classList.add('winning');
                cells[c].classList.add('winning');
                break;
            }
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}