---
name: server-containers-manage
description: 在部署服务器上查看、重启、启停 Docker Compose 容器及查看日志。当用户要求看服务器上的容器状态、查 Synapse/Matrix 日志、重启某个服务、或管理 10.1.1.15 等部署机上的容器时使用。
---

# 管理部署服务器上的容器

通过 SSH 在部署机（如 `root@10.1.1.15`）上执行 Docker Compose 命令，管理 Matrix 等服务的容器。假定 compose 项目在目标机的 `/root/matrix`（Matrix 部署），其他栈可替换工作目录与 compose 文件路径。

## 前置条件

- 可 SSH 登录部署机（如 `ssh root@10.1.1.15`）
- 目标机已安装 Docker 与 Docker Compose（V2）

## 常用命令（均通过 SSH 在目标机执行）

**工作目录**：Matrix 为 `cd /root/matrix`，compose 文件默认为当前目录的 `docker-compose.yml`。

| 操作 | 命令 |
|------|------|
| **查看容器状态** | `ssh root@<IP> "cd /root/matrix && docker compose ps"` |
| **查看某服务日志** | `ssh root@<IP> "cd /root/matrix && docker compose logs -f synapse"`（可换为 `postgres` 等） |
| **查看最近日志（不跟踪）** | `ssh root@<IP> "cd /root/matrix && docker compose logs --tail=80 synapse"` |
| **重启单个服务** | `ssh root@<IP> "cd /root/matrix && docker compose restart synapse"` |
| **重启全部** | `ssh root@<IP> "cd /root/matrix && docker compose restart"` |
| **启动栈** | `ssh root@<IP> "cd /root/matrix && docker compose up -d"` |
| **停止栈** | `ssh root@<IP> "cd /root/matrix && docker compose down"` |
| **进入容器 shell** | `ssh root@<IP> "cd /root/matrix && docker compose exec synapse sh"`（交互式） |

## Matrix 服务名

- `synapse`：Synapse 主进程
- `postgres`：PostgreSQL 数据库

## 其他栈

若管理非 Matrix 的 compose 项目，将 `root@<IP>` 与 `/root/matrix` 替换为实际用户、主机与项目路径；多 compose 文件时使用 `-f /path/to/docker-compose.yml`。
