# Trae Usage Server

一个用于监控Trae客户端使用情况和订阅状态的WebSocket服务器和Web界面。（TraeUsage扩展的服务端演示项目）

## 安装和运行

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务器

```bash
# 生产环境
npm start

# 开发环境（自动重启）
npm run dev
```

### 3. 访问界面

- 主页面（默认用户）: http://localhost:8080
- 组页面: http://localhost:8080?group=组ID
- WebSocket端点: ws://localhost:8080/ws

## 服务器部署

```bash
npx pm2 start server.js --name "trae-usage-server"
```

## 客户端集成

客户端需要连接到 `ws://服务器地址:8080/ws` 并发送心跳消息。

### 心跳消息格式

```json
{
  "type": "heartbeat",
  "timestamp": 1704067200000,
  "clientId": "vscode-12345678-1704067200000",
  "ip": "192.168.1.100",
  "machineId": "abcd1234-efgh-5678-ijkl-mnop9012qrst",
  "premium_model_fast_request_limit": 600,
  "premium_model_fast_request_usage": 136,
  "user_id": "7509828020950320136",
  "start_time": 1756017428,
  "end_time": 1758609428,
  "group_id": "abcdefg"
}
```

### 字段说明

- `type`: 固定值 "heartbeat"
- `timestamp`: 消息发送时间戳（毫秒）
- `clientId`: 客户端唯一标识
- `ip`: 客户端公网IP地址
- `machineId`: 设备唯一标识符
- `premium_model_fast_request_limit`: 请求限额
- `premium_model_fast_request_usage`: 已使用量
- `user_id`: 用户ID
- `start_time`: 订阅开始时间（Unix时间戳，秒）
- `end_time`: 订阅结束时间（Unix时间戳，秒）
- `group_id`: 用户所在组ID（可选）

### 获取用户列表

```
GET /api/users
GET /api/users?group=组ID
```

返回格式：
```json
{
  "users": [
    {
      "user_id": "7509828020950320136",
      "group_id": "isxuaaxaka",
      "online": true,
      "deviceCount": 2,
      "devices": [...],
      "subscription": {
        "start_time": 1756017428,
        "end_time": 1758609428,
        "limit": 600,
        "usage": 136,
        "progress": 22.67,
        "isActive": true
      },
      "lastSeen": 1704067200000
    }
  ],
  "timestamp": 1704067200000
}
```

## 分组功能

- 默认页面只显示没有 `group_id` 或 `group_id` 为空的用户
- 要查看特定组的用户，需要通过URL参数访问：`?group=组ID`
- 系统不提供组列表入口，需要直接通过URL访问


## 注意事项

1. 数据存储在内存中，服务器重启后数据会丢失
2. 适合中小规模使用（几十到上百用户）
3. 如需持久化存储，可考虑集成数据库
4. 生产环境建议配置反向代理和HTTPS