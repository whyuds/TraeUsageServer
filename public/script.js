let currentGroupId = null;

// 从URL参数获取组ID
function getGroupIdFromUrl() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('group_id') || urlParams.get('group');
}

// 格式化时间
function formatTime(timestamp) {
    return new Date(timestamp * 1000).toLocaleString('zh-CN');
}

// 格式化日期（只显示日期）
function formatDate(timestamp) {
    return new Date(timestamp * 1000).toLocaleDateString('zh-CN');
}

// 格式化相对时间
function formatRelativeTime(timestamp) {
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}小时前`;
    
    const days = Math.floor(hours / 24);
    return `${days}天前`;
}

// 生成模拟用户数据
function generateMockUsers() {
    const mockUsers = [
        {
            user_id: '00000000',
            online: true,
            deviceCount: 2,
            lastSeen: Date.now() - 300000, // 5分钟前
            subscription: {
                isActive: true,
                progress: 65.8,
                usage: '658',
                limit: '1000',
                start_time: Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000),
                end_time: Math.floor((Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000)
            }
        }
    ];
    
    return mockUsers;
}

// 计算用户的实际设备数量（按machineId去重）
function getUniqueDeviceCount(user) {
    if (!user.devices || !Array.isArray(user.devices)) {
        return user.deviceCount || 0;
    }
    
    const uniqueMachineIds = new Set();
    user.devices.forEach(device => {
        if (device.connected && device.machineId) {
            uniqueMachineIds.add(device.machineId);
        }
    });
    
    return uniqueMachineIds.size;
}

// 创建用户卡片
function createUserCard(user) {
    const isOnline = user.online;
    const progress = user.subscription.progress || 0;
    const uniqueDeviceCount = getUniqueDeviceCount(user);
    
    return `
        <div class="user-card ${isOnline ? 'online' : 'offline'}" data-user-id="${user.user_id}">
            <div class="user-header">
                <div class="user-id">用户 ${user.user_id}</div>
                <div class="status ${isOnline ? 'online' : 'offline'}">
                    ${isOnline ? '在线' : '离线'}
                </div>
            </div>
            
            <div class="device-info">
                <span class="device-count">${uniqueDeviceCount}</span> 台设备在线
                <div class="last-seen">
                    最后活跃: ${formatRelativeTime(user.lastSeen)}
                </div>
            </div>
            
            <div class="subscription">
                <div class="subscription-header">
                    <span>订阅状态</span>
                    <span class="subscription-status ${user.subscription.isActive ? 'active' : 'inactive'}">
                        ${user.subscription.isActive ? '有效' : '已过期'}
                    </span>
                </div>
                
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${progress}%"></div>
                    <div class="usage-text">
                        已使用: ${user.subscription.usage} / ${user.subscription.limit} (${progress.toFixed(1)}%)
                    </div>
                </div>
                
                <div class="subscription-time">
                    ${formatDate(user.subscription.start_time)} - ${formatDate(user.subscription.end_time)}
                </div>
            </div>
        </div>
    `;
}

// 更新统计信息
function updateStats(users) {
    const onlineUsers = users.filter(u => u.online).length;
    const totalDevices = users.reduce((sum, u) => sum + getUniqueDeviceCount(u), 0);
    
    document.getElementById('onlineUsers').textContent = onlineUsers;
    document.getElementById('totalUsers').textContent = users.length;
    document.getElementById('activeDevices').textContent = totalDevices;
    document.getElementById('lastUpdate').textContent = new Date().toLocaleTimeString('zh-CN');
}

// 存储当前用户数据
let currentUsers = [];
let isFirstLoad = true;

// 更新单个用户卡片
function updateUserCard(user, cardElement) {
    const isOnline = user.online;
    const progress = user.subscription.progress || 0;
    const uniqueDeviceCount = getUniqueDeviceCount(user);
    
    // 更新卡片类名
    cardElement.className = `user-card ${isOnline ? 'online' : 'offline'}`;
    
    // 更新状态
    const statusElement = cardElement.querySelector('.status');
    statusElement.className = `status ${isOnline ? 'online' : 'offline'}`;
    statusElement.textContent = isOnline ? '在线' : '离线';
    
    // 更新设备数量
    cardElement.querySelector('.device-count').textContent = uniqueDeviceCount;
    
    // 更新最后活跃时间
    const lastSeenElement = cardElement.querySelector('.last-seen');
    if (lastSeenElement) {
        lastSeenElement.textContent = `最后活跃: ${formatRelativeTime(user.lastSeen)}`;
    }
    
    // 更新订阅状态
    const subscriptionStatus = cardElement.querySelector('.subscription-status');
    subscriptionStatus.className = `subscription-status ${user.subscription.isActive ? 'active' : 'inactive'}`;
    subscriptionStatus.textContent = user.subscription.isActive ? '有效' : '已过期';
    
    // 更新进度条
    const progressFill = cardElement.querySelector('.progress-fill');
    progressFill.style.width = `${progress}%`;
    
    // 更新使用量文本
    cardElement.querySelector('.usage-text').textContent = 
        `已使用: ${user.subscription.usage} / ${user.subscription.limit} (${progress.toFixed(1)}%)`;
    
    // 更新订阅时间
    cardElement.querySelector('.subscription-time').textContent = 
        `${formatDate(user.subscription.start_time)} - ${formatDate(user.subscription.end_time)}`;
}

// 平滑更新用户列表
function updateUsersGrid(users) {
    const usersGrid = document.getElementById('usersGrid');
    
    if (users.length === 0) {
        usersGrid.innerHTML = '<div style="text-align: center; color: #64748b; grid-column: 1 / -1;">暂无用户数据</div>';
        return;
    }
    
    // 获取当前所有用户卡片
    const existingCards = usersGrid.querySelectorAll('.user-card[data-user-id]');
    const existingUserIds = new Set(Array.from(existingCards).map(card => card.dataset.userId));
    const newUserIds = new Set(users.map(user => user.user_id));
    
    // 移除不存在的用户卡片
    existingCards.forEach(card => {
        if (!newUserIds.has(card.dataset.userId)) {
            card.remove();
        }
    });
    
    // 更新或添加用户卡片
    users.forEach(user => {
        const existingCard = usersGrid.querySelector(`[data-user-id="${user.user_id}"]`);
        
        if (existingCard) {
            // 更新现有卡片
            updateUserCard(user, existingCard);
        } else {
            // 添加新卡片
            const cardHtml = createUserCard(user);
            usersGrid.insertAdjacentHTML('beforeend', cardHtml);
        }
    });
}

// 加载用户数据
async function loadUsers() {
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    
    // 只在首次加载时显示loading
    if (isFirstLoad) {
        loading.style.display = 'block';
    }
    error.style.display = 'none';
    
    try {
        const url = currentGroupId ? `/api/users?group=${currentGroupId}` : '/api/users';
        
        let users = [];
        
        try {
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
        
        if (isFirstLoad) {
            loading.style.display = 'none';
            isFirstLoad = false;
        }
        
        // 平滑更新用户列表
        updateUsersGrid(users);
        
        // 更新统计信息
        updateStats(users);
        
        currentUsers = users;
        
    } catch (err) {
        console.error('Error loading users:', err);
        if (isFirstLoad) {
            loading.style.display = 'none';
            error.style.display = 'block';
        }
    }
}

// 初始化
function init() {
    currentGroupId = getGroupIdFromUrl();
    loadUsers();
    
    // 每30秒自动刷新
    setInterval(loadUsers, 30000);
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', init);