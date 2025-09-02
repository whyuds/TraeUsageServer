const WebSocket = require('ws');
const express = require('express');
const path = require('path');
const http = require('http');
const fs = require('fs');
const util = require('util');

const app = express();
const server = http.createServer(app);

// 日志配置
const LOG_FILE = path.join(__dirname, 'server.log');
const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

// 日志函数
function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const formattedMessage = util.format(message, ...args);
  const logEntry = `[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}\n`;
  
  // 写入文件
  logStream.write(logEntry);
  
  // 同时输出到控制台（可选）
  console.log(`[${timestamp}] [${level.toUpperCase()}] ${formattedMessage}`);
}

// 便捷的日志方法
const logger = {
  info: (message, ...args) => log('info', message, ...args),
  error: (message, ...args) => log('error', message, ...args),
  warn: (message, ...args) => log('warn', message, ...args),
  debug: (message, ...args) => log('debug', message, ...args)
};

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 用户状态管理
class UserManager {
  constructor() {
    this.users = new Map(); // user_id -> user data
    this.groups = new Map(); // group_id -> Set of user_ids
    this.connections = new Map(); // clientId -> ws connection
  }

  updateUser(heartbeat, ws) {
    const { user_id, group_id, clientId } = heartbeat;
    
    // 更新连接映射
    this.connections.set(clientId, ws);
    
    // 获取或创建用户数据
    if (!this.users.has(user_id)) {
      this.users.set(user_id, {
        user_id,
        group_id: group_id || null,
        devices: new Map(),
        lastSeen: Date.now(),
        subscription: {
          start_time: heartbeat.start_time,
          end_time: heartbeat.end_time,
          limit: heartbeat.premium_model_fast_request_limit,
          usage: heartbeat.premium_model_fast_request_usage
        }
      });
    }
    
    const user = this.users.get(user_id);
    
    // 更新设备信息
    user.devices.set(clientId, {
      clientId,
      machineId: heartbeat.machineId,
      ip: heartbeat.ip,
      lastHeartbeat: Date.now(),
      connected: true
    });
    
    // 更新订阅信息
    user.subscription = {
      start_time: heartbeat.start_time,
      end_time: heartbeat.end_time,
      limit: heartbeat.premium_model_fast_request_limit,
      usage: heartbeat.premium_model_fast_request_usage
    };
    
    user.lastSeen = Date.now();
    user.group_id = group_id || null;
    
    // 更新组信息
    if (group_id) {
      if (!this.groups.has(group_id)) {
        this.groups.set(group_id, new Set());
      }
      this.groups.get(group_id).add(user_id);
    }
  }
  
  removeConnection(clientId) {
    this.connections.delete(clientId);
    
    // 查找并更新用户设备状态
    for (const [userId, user] of this.users) {
      if (user.devices.has(clientId)) {
        user.devices.get(clientId).connected = false;
        break;
      }
    }
  }
  
  getDefaultUsers() {
    const defaultUsers = [];
    for (const [userId, user] of this.users) {
      if (!user.group_id) {
        defaultUsers.push(this.formatUserData(user));
      }
    }
    return defaultUsers;
  }
  
  getGroupUsers(groupId) {
    const groupUsers = [];
    if (this.groups.has(groupId)) {
      for (const userId of this.groups.get(groupId)) {
        const user = this.users.get(userId);
        if (user) {
          groupUsers.push(this.formatUserData(user));
        }
      }
    }
    return groupUsers;
  }
  
  formatUserData(user) {
    const onlineDevices = Array.from(user.devices.values()).filter(device => {
      return device.connected && (Date.now() - device.lastHeartbeat) < 60000; // 1分钟内活跃
    });
    
    const now = Date.now() / 1000;
    const progress = user.subscription.limit > 0 ? 
      (user.subscription.usage / user.subscription.limit) * 100 : 0;
    
    return {
      user_id: user.user_id,
      group_id: user.group_id,
      online: onlineDevices.length > 0,
      deviceCount: onlineDevices.length,
      devices: onlineDevices,
      subscription: {
        ...user.subscription,
        progress: Math.min(progress, 100),
        isActive: now >= user.subscription.start_time && now <= user.subscription.end_time
      },
      lastSeen: user.lastSeen
    };
  }
  
  cleanupInactiveUsers() {
    const now = Date.now();
    const inactiveThreshold = 5 * 60 * 1000; // 5分钟
    
    for (const [userId, user] of this.users) {
      // 清理非活跃设备
      for (const [clientId, device] of user.devices) {
        if (now - device.lastHeartbeat > inactiveThreshold) {
          user.devices.delete(clientId);
          this.connections.delete(clientId);
        }
      }
      
      // 如果用户没有活跃设备，标记为离线但保留数据
      if (user.devices.size === 0) {
        // 可以选择删除长时间不活跃的用户
        // this.users.delete(userId);
      }
    }
  }
}

const userManager = new UserManager();

// WebSocket服务器
const wss = new WebSocket.Server({ 
  server,
  path: '/ws'
});

wss.on('connection', (ws, req) => {
  logger.info('New WebSocket connection from: %s', req.socket.remoteAddress);
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      if (message.type === 'heartbeat') {
        logger.info('Received heartbeat from user: %s, data: %s', message.user_id, JSON.stringify(message));
        userManager.updateUser(message, ws);
        
        // 发送确认
        ws.send(JSON.stringify({ type: 'ack', timestamp: Date.now() }));
      }
    } catch (error) {
      logger.error('Error processing message: %s', error.message);
    }
  });
  
  ws.on('close', () => {
    logger.info('WebSocket connection closed');
    // 查找并移除连接
    for (const [clientId, connection] of userManager.connections) {
      if (connection === ws) {
        userManager.removeConnection(clientId);
        break;
      }
    }
  });
  
  ws.on('error', (error) => {
    logger.error('WebSocket error: %s', error.message);
  });
});

// API路由
app.get('/api/users', (req, res) => {
  const groupId = req.query.group;
  logger.info('API request: /api/users%s', groupId ? `?group=${groupId}` : '');
  let users;
  
  if (groupId) {
    users = userManager.getGroupUsers(groupId);
    logger.info('Returning %d users for group %s', users.length, groupId);
  } else {
    users = userManager.getDefaultUsers();
    logger.info('Returning %d default users', users.length);
  }
  
  res.json({ users, timestamp: Date.now() });
});

app.get('/api/groups', (req, res) => {
  const groups = Array.from(userManager.groups.keys());
  res.json({ groups });
});

// 主页路由
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 定期清理非活跃用户
setInterval(() => {
  userManager.cleanupInactiveUsers();
}, 60000); // 每分钟清理一次

const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  logger.info('Server running on port %d', PORT);
  logger.info('WebSocket endpoint: ws://localhost:%d/ws', PORT);
  logger.info('Web interface: http://localhost:%d', PORT);
});

// 优雅关闭处理
process.on('SIGINT', () => {
  logger.info('Received SIGINT, closing server gracefully...');
  logStream.end();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logger.info('Received SIGTERM, closing server gracefully...');
  logStream.end();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, userManager };