# WebSocket 心跳消息格式文档

## 消息概述

客户端（VSCode扩展）会定期向WebSocket服务器发送心跳消息，包含用户的订阅使用情况和客户端信息。

## 消息格式

### 心跳消息 (Heartbeat Message)

**消息类型**: `heartbeat`

**发送频率**: 每30秒一次（连接成功后立即发送一次）

**JSON格式**:
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
  "group_id": "isxuaaxaka"
}
```

## 字段说明

| 字段名 | 类型 | 说明 |
|--------|------|------|
| `type` | string | 固定值 "heartbeat" |
| `timestamp` | number | 消息发送时间戳（毫秒） |
| `clientId` | string | 客户端唯一标识，格式：`vscode-{machineId}-{timestamp}` |
| `ip` | string | 客户端公网IP地址 |
| `machineId` | string | VSCode机器唯一标识符 |
| `premium_model_fast_request_limit` | number | 快速模型请求限额 |
| `premium_model_fast_request_usage` | number | 快速模型请求已使用量 |
| `user_id` | string | 用户ID |
| `start_time` | number | 订阅开始时间（Unix时间戳，秒） |
| `end_time` | number | 订阅结束时间（Unix时间戳，秒） |
| `group_id` | string | 用户所在组ID |

## 连接行为

1. **连接建立**: 客户端连接成功后立即会发送一次心跳
2. **定时发送**: 之后每30秒发送一次心跳
