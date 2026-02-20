# Matrix 联邦（Federation）说明

> Matrix 是**去中心化**的通信协议：用户和房间可以分布在不同服务器上，通过「联邦」跨服务器互通。本文说明联邦的含义、与 server_name 的关系，以及当前内网单实例部署下的取舍。

---

## 一、联邦是什么

**联邦（Federation）** 指：多台 **Matrix Homeserver**（如 Synapse）之间按协议互相通信，使「不同服务器上的用户」能在同一房间聊天、互发消息。

- **无联邦**：只有你这台 Synapse 上的用户彼此能聊；所有成员必须在本服务器注册。
- **有联邦**：你这台服务器可以和其它 Matrix 服务器（如 matrix.org、其它公司自建的 Synapse）建立连接；房间内可以有 `@alice:你的域名` 和 `@bob:别的公司.com`，消息在服务器之间转发。

可以类比为「邮件」：每台服务器是一个邮局（Homeserver），用户地址是 `@名字:邮局域名`；联邦就是邮局之间互相投递信件。

---

## 二、联邦如何工作（简要）

1. **身份与寻址**  
   每个用户/房间的 ID 都带 **server_name**（如 `@alice:cosai.junhai.work`）。其它服务器看到域名 `cosai.junhai.work`，就知道要和你这台 Synapse 通信。

2. **发现与连接**  
   其它服务器通过 **DNS**（或 `.well-known/matrix/server`）找到你的 Homeserver 的联邦接口地址（通常 `https://<server_name>:8448`），然后建立 **HTTPS** 连接。

3. **事件同步**  
   当房间里有「外服」用户时，你方 Synapse 与对方 Synapse 会互相推送房间内的事件（发消息、加入、离开等），使双方看到的时间线一致。

4. **信任与安全**  
   联邦基于 TLS 与服务器间认证；可配置「只与指定服务器联邦」或「允许公网联邦」。数据会在多台服务器上存在副本（消息会复制到参与房间的每台服务器）。

因此：**server_name 在联邦下 = 你的服务器在「Matrix 网络」里的唯一标识**，其它服务器靠它找到你并和你同步数据。

---

## 三、与 server_name 的关系

| 场景 | server_name 的作用 |
|------|---------------------|
| **仅内网、不联邦** | 仍需要：用来生成 MXID/房间 ID（`@user:server_name`、`!room:server_name`），区分本服务器上的实体。其它服务器不连你，但协议上每个 Homeserver 必须有唯一名字。 |
| **开启联邦** | 其它服务器通过 server_name（及 DNS / .well-known）发现并连接你；server_name 通常用**对外可解析的域名**，且需开放联邦端口（如 8448）、配置 TLS。 |

所以：**无论是否联邦，server_name 都不能省**；区别只在于「是否用它对公网或对其它服务器开放联邦」。

---

## 四、当前项目中的典型用法

- **deploy/matrix** 默认是**内网单实例**：一台 Synapse，只服务本公司/内网用户，**不对外联邦**。
- 此时 server_name 可以填内网 IP（如 `10.1.1.15`）、内网主机名（如 `matrix.internal`）或公司域名（如 `cosai.junhai.work`）；不联邦时只要本网内一致即可，不要求公网 DNS。
- 若未来要**和别的 Matrix 服务器互通**（例如与 matrix.org 用户同房、或与合作伙伴的 Synapse 互通），则需要：
  - server_name 使用**对外可解析的域名**；
  - 开放联邦端口（8448）、配置 TLS；
  - 在防火墙/反向代理上放行联邦流量；
  - 注意隐私与合规（房间内事件会同步到对方服务器）。

---

## 五、小结

| 概念 | 说明 |
|------|------|
| **联邦** | 多台 Matrix Homeserver 之间按协议互联，实现跨服务器的用户/房间互通。 |
| **server_name** | 单台 Homeserver 的唯一标识，用于 MXID/房间 ID 的后缀；联邦时也用于被其它服务器发现与连接。不能移除。 |
| **一机多后缀** | 不支持；一个 Synapse 实例只能有一个 server_name。 |
| **内网单实例** | 可不开启联邦，仅用 server_name 生成 ID；若要日后联邦，建议 server_name 用域名并预留 8448/TLS。 |

更多协议细节见 [Matrix 规范](https://spec.matrix.org/) 中的 Server-Server API 与 Federation 相关章节。
