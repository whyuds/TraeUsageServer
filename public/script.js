// 格式化相对时间
function formatRelativeTime(timestamp) {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    return `${Math.floor(hours / 24)}天前`;
}

// 格式化日期
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
}

// 计算设备数量（按machineId去重）
function calculateDeviceCount(devices) {
    if (!devices || !Array.isArray(devices)) return 0;
    
    const uniqueMachineIds = new Set();
    devices.forEach(device => {
        if (device.machineId && device.connected) {
            uniqueMachineIds.add(device.machineId);
        }
    });
    
    return uniqueMachineIds.size;
}

// 生成模拟数据
function generateMockUsers() {
    return [{
        user_id: '00000000',
        online: true,
        devices: [
            {
                clientId: 'mock-client-1',
                machineId: 'mock-machine-1',
                ip: 'unknown',
                lastHeartbeat: Date.now() - 60000,
                connected: true
            },
            {
                clientId: 'mock-client-2',
                machineId: 'mock-machine-1', // 同一台设备
                ip: 'unknown',
                lastHeartbeat: Date.now() - 30000,
                connected: true
            }
        ],
        lastSeen: Date.now() - 300000,
        subscription: {
            isActive: true,
            progress: 65.8,
            usage: '658',
            limit: '1000',
            start_time: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
            end_time: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
        }
    }];
}

// 创建用户卡片
function createUserCard(user) {
    const { online, subscription, devices = [], lastSeen, user_id } = user;
    const deviceCount = calculateDeviceCount(devices);
    const { progress = 0, usage, limit, start_time, end_time, isActive } = subscription;
    
    return `
        <div class="user-card ${online ? 'online' : 'offline'}" data-user-id="${user_id}">
            <div class="card-tooltip">
                订阅量: ${limit} | 已使用: ${usage} | 有效期: ${formatDate(start_time)} - ${formatDate(end_time)}
            </div>
            <div class="user-header">
                <div class="user-id">${user_id}</div>
                <div class="status ${online ? 'online' : 'offline'}">
                    ${online ? '在线' : '离线'}
                </div>
            </div>
            
            <div class="device-info">
                <span class="device-count">${deviceCount}</span> 台设备在线
                <div class="last-seen">最后活跃: ${formatRelativeTime(lastSeen)}</div>
                <div class="last-update">更新: ${new Date().toLocaleTimeString('zh-CN', {hour12: false})}</div>
            </div>
            
            <div class="subscription">
                <div class="subscription-header">
                    <span>订阅状态</span>
                    <span class="subscription-status ${isActive ? 'active' : 'inactive'}">
                        ${isActive ? '有效' : '已过期'}
                    </span>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                    <div class="usage-text">
                        已使用: ${usage} / ${limit} (${progress.toFixed(1)}%)
                    </div>
                </div>
                
                <div class="subscription-time">
                    ${formatDate(start_time)} - ${formatDate(end_time)}
                </div>
            </div>
        </div>
    `;
}

// 更新用户卡片
function updateUserCard(user, cardElement) {
    const { online, subscription, devices = [], lastSeen } = user;
    const deviceCount = calculateDeviceCount(devices);
    const { progress = 0, usage, limit, start_time, end_time, isActive } = subscription;
    
    cardElement.className = `user-card ${online ? 'online' : 'offline'}`;
    cardElement.querySelector('.card-tooltip').textContent = 
        `订阅量: ${limit} | 已使用: ${usage} | 有效期: ${formatDate(start_time)} - ${formatDate(end_time)}`;
    
    const statusEl = cardElement.querySelector('.status');
    statusEl.className = `status ${online ? 'online' : 'offline'}`;
    statusEl.textContent = online ? '在线' : '离线';
    
    cardElement.querySelector('.device-count').textContent = deviceCount;
    cardElement.querySelector('.last-seen').textContent = `最后活跃: ${formatRelativeTime(lastSeen)}`;
    cardElement.querySelector('.last-update').textContent = `更新: ${new Date().toLocaleTimeString('zh-CN', {hour12: false})}`;
    
    const subscriptionStatus = cardElement.querySelector('.subscription-status');
    subscriptionStatus.className = `subscription-status ${isActive ? 'active' : 'inactive'}`;
    subscriptionStatus.textContent = isActive ? '有效' : '已过期';
    
    cardElement.querySelector('.progress-fill').style.width = `${progress}%`;
    cardElement.querySelector('.usage-text').textContent = 
        `已使用: ${usage} / ${limit} (${progress.toFixed(1)}%)`;
    cardElement.querySelector('.subscription-time').textContent = 
        `${formatDate(start_time)} - ${formatDate(end_time)}`;
}

// 处理用户数据，计算正确的设备数量
function processUserData(users) {
    return users.map(user => {
        // 如果有 devices 数组，重新计算 deviceCount
        if (user.devices && Array.isArray(user.devices)) {
            user.deviceCount = calculateDeviceCount(user.devices);
        } else if (user.deviceCount === undefined) {
            user.deviceCount = 0;
        }
        return user;
    });
}

// 更新用户列表
function updateUsersGrid(users) {
    const usersGrid = document.getElementById('usersGrid');
    
    if (users.length === 0) {
        usersGrid.innerHTML = '<div style="text-align: center; color: #64748b;">暂无用户数据</div>';
        return;
    }
    
    // 处理用户数据，确保设备计数正确
    const processedUsers = processUserData(users);
    
    const existingCards = usersGrid.querySelectorAll('.user-card[data-user-id]');
    const existingUserIds = new Set(Array.from(existingCards).map(card => card.dataset.userId));
    const newUserIds = new Set(processedUsers.map(user => user.user_id));
    
    // 移除不存在的用户
    existingCards.forEach(card => {
        if (!newUserIds.has(card.dataset.userId)) {
            card.remove();
        }
    });
    
    // 更新或添加用户卡片
    processedUsers.forEach(user => {
        const existingCard = usersGrid.querySelector(`[data-user-id="${user.user_id}"]`);
        
        if (existingCard) {
            updateUserCard(user, existingCard);
        } else {
            usersGrid.insertAdjacentHTML('beforeend', createUserCard(user));
        }
    });
}

// 加载用户数据
async function loadUsers() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    
    if (loading.style.display !== 'none') {
        loading.style.display = 'block';
    }
    error.style.display = 'none';
    
    try {
        let users = [];
        
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const groupId = urlParams.get('group_id') || urlParams.get('group');
            const url = groupId ? `/api/users?group=${groupId}` : '/api/users';
            
            const response = await fetch(url);
            if (response.ok) {
                const data = await response.json();
                users = data.users || [];
            }
        } catch (fetchError) {
            console.log('API 不可用，使用模拟数据');
        }
        
        // 如果没有真实数据，使用模拟数据
        if (users.length === 0) {
            users = generateMockUsers();
        }
        
        loading.style.display = 'none';
        updateUsersGrid(users);
        
    } catch (err) {
        console.error('Error loading users:', err);
        loading.style.display = 'none';
        error.style.display = 'block';
    }
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    loadUsers();
    setInterval(loadUsers, 30000); // 每30秒刷新
});
