---
title: SSL证书笔记
date: 2026-10-23 10:00:00
tags: [SSL, TLS, 证书, PKI, OpenSSL]
categories: [网络]
comments: false
---

本文按「信任体系 → 签发流程 → 客户端验证 → 企业落地」的顺序，讲清楚一张证书从生成密钥到被浏览器信任的完整链路。重点回答三个问题：

1. 谁有权签发证书，信任是怎么一层层传下来的？
2. 一张证书具体是怎么被签出来的，每一步的输入、输出和风险是什么？
3. 企业如何设计、自动化、监控和治理这套证书体系？

> 主要依据：RFC 5280（X.509/CRL）、RFC 8446（TLS 1.3）、CA/Browser Forum TLS Baseline Requirements 2.3.1（2026-10-04）、RFC 6960（OCSP）、RFC 6962（CT）、RFC 8555（ACME）、RFC 8659（CAA）、RFC 9525（主机名验证）、RFC 7633（Must-Staple）、RFC 6797（HSTS）以及 OpenSSL 官方文档。

<!-- more -->


# SSL 证书

## 一张图看懂证书签发

证书体系本质上是一棵**签名树**。根 CA 用自己的私钥给自己签名，再用根私钥给中间 CA 签名，中间 CA 再用自己的私钥给服务器证书签名：

```text
                    ┌─────────────────────────┐
                    │  根 CA Root CA          │
                    │  自签名，离线，信任锚   │
                    │  CA:TRUE, pathlen=1     │
                    └────────────┬────────────┘
                                 │ 用根私钥签名
                                 ▼
                    ┌─────────────────────────┐
                    │  中间 CA Intermediate   │
                    │  在线签发，CA:TRUE      │
                    │  pathlen=0              │
                    └────────────┬────────────┘
                                 │ 用中间 CA 私钥签名
                                 ▼
                    ┌─────────────────────────┐
                    │  服务器证书 Leaf        │
                    │  CA:FALSE               │
                    │  SAN=example.com        │
                    │  EKU=serverAuth         │
                    └────────────┬────────────┘
                                 │ 部署 leaf + intermediate
                                 ▼
                    ┌─────────────────────────┐
                    │  客户端                 │
                    │  构建链 → 逐级验签      │
                    │  校验证书 → 建立 TLS    │
                    └─────────────────────────┘
```

一张公开信任的服务器证书，从申请到部署的完整流水线是：

```text
生成密钥对
   ↓
生成 CSR（证书签名请求）
   ↓
提交申请（ACME / CA 门户 / API）
   ↓
CA 验证域名、IP 或组织身份
   ↓
CA 检查 CAA、黑名单、弱密钥等
   ↓
CA 按证书 Profile 组装 TBS
   ↓
（公开信任证书）提交 CT 日志，取得 SCT
   ↓
CA 用中间 CA 私钥对最终证书签名
   ↓
下发 leaf + intermediate（fullchain）
   ↓
部署到服务器 / 负载均衡 / CDN
   ↓
客户端验签、验证有效期/域名/用途/吊销
   ↓
TLS 握手完成，客户端确认服务器持有私钥
```

理解这张图的关键是：**证书不是申请者自己写的，而是 CA 根据申请者的公钥和身份，按固定 Profile 组装并签名的**。申请者能控制的只有密钥对和 CSR 中的请求信息，最终证书内容由 CA 决定。

## 证书的作用与边界

证书解决的是**公钥和身份的绑定**问题，不是数据加密本身。

- 没有证书时，客户端无法确认「这个公钥到底属于谁」，容易遭受中间人攻击。
- CA 用私钥对「主体信息 + 公钥 + 有效期 + 扩展」签名，客户端用 CA 公钥验签，从而信任这个绑定关系。
- TLS 握手用证书完成**身份认证**，用 ECDHE/PSK 等完成**密钥协商**，最后由记录层用协商出的会话密钥**加密数据**。
- 证书是公开的，可以随便分发；**私钥必须保密**。证书和私钥不匹配时，握手会失败。

TLS 1.3 中，服务器发送 `Certificate` 和 `CertificateVerify` 两条消息：

- `Certificate`：证书链，证明「我的公钥被 CA 签过」。
- `CertificateVerify`：用证书对应的私钥对握手 transcript 签名，证明「我确实持有这个私钥」。

客户端验证证书链，只能证明证书本身合法；`CertificateVerify` 验证成功，才能证明对面真的持有私钥。两者缺一不可。

## 信任体系的分层架构

### 根 CA

根 CA 是整个信任体系的起点，具备以下特征：

- **自签名**：Issuer 和 Subject 相同，签名用根自己的私钥。
- **离线保存**：根私钥通常放在离线 HSM 或气隙环境中，签名操作需要严格 ceremony 和双人控制。
- **预置在信任库**：操作系统、浏览器、Java、Go 等客户端内置受信任根证书列表。
- **有效期长**：常见 10～25 年，但根过期会导致整条链失效。
- **路径长度受限**：根证书通常设置 `basicConstraints: CA:TRUE, pathlen:1`，表示下面最多只能再有一层中间 CA。
- **只签中间 CA**：在标准分层 PKI 中，根不直接签服务器证书。

根证书的核心字段示例：

| 字段 | 典型值 |
| ---- | ------ |
| Subject / Issuer | `CN=Example Root CA, O=Example, C=CN` |
| Basic Constraints | critical, `CA:TRUE, pathlen:1` |
| Key Usage | critical, `keyCertSign, cRLSign` |
| Subject Key Identifier | 必须有 |
| 有效期 | 10～25 年 |
| SAN | 无 |

### 中间 CA

中间 CA 由根 CA 签名，是在线签发服务器证书的主力：

- **保护根私钥**：日常签发不触碰离线根。
- **按用途/环境拆分**：服务器 TLS、客户端 mTLS、代码签名、邮件加密分别使用不同中间 CA。
- **可撤销/可替换**：中间 CA 出问题时可吊销并更换，不必动摇根。
- **路径长度**：签发服务器证书的中间 CA 通常设置 `pathlen:0`，表示它不能再签下级 CA。
- **名称约束**：私有 CA 常用 `nameConstraints` 限制只能签发某些域名，降低误签风险。
- **交叉签名**：根轮换时，同一中间 CA 可以同时被新旧根签名，形成多条链。

中间 CA 证书的核心字段：

| 字段 | 典型值 |
| ---- | ------ |
| Issuer | 根 CA 的 Subject |
| Subject | 中间 CA 自己的 DN |
| Basic Constraints | critical, `CA:TRUE, pathlen:0` |
| Key Usage | critical, `keyCertSign, cRLSign` |
| Extended Key Usage | 可按用途限制，如 `serverAuth` |
| Authority Key Identifier | 必须等于根的 Subject Key Identifier |
| Subject Key Identifier | 必须有 |
| CRL Distribution Points | 必须有 |
| Authority Information Access | 指向根证书或 OCSP |

### 服务器证书

服务器证书（Leaf / End-Entity）由中间 CA 签名，直接部署在服务器上：

- `basicConstraints: CA:FALSE`，不能再签发其他证书。
- `keyUsage` 与 `extendedKeyUsage` 必须允许 TLS 服务器认证。
- `subjectAltName` 必须包含实际访问的域名或 IP。
- 有效期受 CA/B Forum 限制，公开信任证书当前最长 200 天。
- 包含 AIA、CRLDP、SCT 等扩展，方便客户端构建链和检查吊销。

### 交叉签名与多链

交叉签名（Cross-Signing）是根轮换和兼容旧客户端的关键手段：

- 同一中间 CA 的公钥和 Subject，可以生成两张证书：一张由旧根签名，一张由新根签名。
- 服务器可以同时提供两条链，客户端选择自己能验证的那条。
- 典型场景：新根尚未进入老客户端信任库时，用旧根交叉签名过渡。
- 风险：链变长、握手变大、旧根过期后旧链失效，需要监控。

### 信任锚

客户端信任的不是「所有 CA」，而是本地信任库中的**根证书**。信任是本地决策：

- Windows：证书管理器 / 组策略
- macOS：Keychain
- Linux：`/etc/ssl/certs`、`ca-certificates`
- Java：`$JAVA_HOME/lib/security/cacerts`
- Firefox：自带信任库
- Go：系统根证书或自定义 `CertPool`
- Python：`certifi`
- Node.js：内置根证书或 `NODE_EXTRA_CA_CERTS`

企业私有 CA 的根证书必须分发到所有需要验证的客户端，否则会出现 `unknown authority`。

## 签发流程的十个步骤

| 步骤 | 执行方 | 输入 | 输出 | 关键控制 |
| ---- | ------ | ---- | ---- | -------- |
| 1. 生成密钥对 | 申请者 | 算法与长度 | 私钥 + 公钥 | 私钥不出安全边界 |
| 2. 生成 CSR | 申请者 | 私钥、Subject、SAN | CSR | CSR 自签名，证明持有私钥 |
| 3. 提交申请 | 申请者 / ACME 客户端 | CSR、域名、联系人 | Order / 申请单 | 账户与授权 |
| 4. 身份验证 | CA / RA | 域名、IP、组织材料 | 验证结果 | 多视角、防劫持 |
| 5. CAA 检查 | CA | 域名与 CAA 记录 | 是否允许签发 | 防止误签发 |
| 6. 生成 Profile | CA | 验证结果、CSR、策略 | TBS 字段 | 不盲目复制 CSR 扩展 |
| 7. 预签/CT | CA | TBS / Precert | SCT | CT 日志记录 |
| 8. 正式签名 | CA / HSM | TBS、CA 私钥 | 证书签名值 | 签名密钥保护 |
| 9. 组装证书 | CA | TBS + 签名 + SCT | 最终证书 | 编码与扩展正确 |
| 10. 下发部署 | CA / 运维 | 证书链 | fullchain | 链完整、私钥匹配 |

### 步骤 1：生成密钥对

私钥应在可控环境中生成，优先在 HSM、KMS、TPM 或服务器本地生成，不要通过邮件或聊天工具传递。

```bash
# RSA 2048，兼容性最好
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out server.key

# ECDSA P-256，现代首选
openssl ecparam -name prime256v1 -genkey -noout -out server.key

# Ed25519（公开 TLS 证书体系暂不普遍支持）
openssl genpkey -algorithm ED25519 -out server.key
```

公开信任证书的 CA/B 要求：

- RSA 模长至少 2048 位，且为 8 的整数倍。
- ECDSA 只允许 NIST P-256、P-384、P-521。
- 不允许使用弱密钥、Debian 弱密钥等已知问题密钥。

### 步骤 2：生成 CSR

CSR（Certificate Signing Request）是 PKCS#10 结构，包含：

- 申请者的 Subject（C/ST/L/O/OU/CN 等）。
- 申请者的公钥。
- 请求的扩展，最常见的是 SAN。
- 申请者用自己的私钥对上述内容的签名，证明持有私钥。

```bash
openssl req -new -key server.key -out server.csr \
  -subj "/C=CN/ST=Beijing/L=Beijing/O=Example/CN=example.com" \
  -addext "subjectAltName=DNS:example.com,DNS:www.example.com"
```

CSR 只是**请求**，不是证书。CA 可以拒绝、修改或忽略 CSR 中的扩展。尤其是 `basicConstraints`、`keyUsage` 这类安全敏感扩展，CA 必须按自己的 Profile 生成，不能盲目复制 CSR 内容。

### 步骤 3：提交申请

公开 CA 通常通过 ACME（RFC 8555）自动提交，企业也可以走 CA 门户、API 或工单。ACME 的核心对象：

- **Account**：账户密钥，代表申请者身份。
- **Order**：一次证书订单，包含一组 identifier（域名/IP）。
- **Authorization**：每个 identifier 的授权挑战。
- **Challenge**：证明控制权的方式，如 HTTP-01、DNS-01、TLS-ALPN-01。
- **Finalize**：验证通过后提交 CSR。
- **Certificate**：下载最终证书链。

### 步骤 4：身份验证

CA 必须验证申请者对域名或 IP 的控制权；OV/EV 证书还要验证组织身份。

常见验证方式：

| 方式 | 原理 | 适用 |
| ---- | ---- | ---- |
| DNS TXT | 在 `_acme-challenge` 放置指定值 | 泛域名、无法开放 80 端口 |
| HTTP 文件 | 在 `/.well-known/acme-challenge/` 放置 token | 普通网站 |
| TLS-ALPN | 443 端口使用 `acme-tls/1` ALPN 响应 | 反向代理/托管商 |
| 邮件验证 | 向 WHOIS 管理员邮箱发验证邮件 | 人工场景 |
| 人工审核 | 提交营业执照、电话回访等 | OV/EV |

企业要注意：

- 验证应从多个网络视角进行，防止 DNS 缓存污染或流量劫持。
- 泛域名必须使用 DNS-01，且要验证 base domain 的控制权。
- 域名验证数据有复用期限，CA/B 当前规定域名/IP 验证数据最长复用 200 天（2026-03-15 起）。
- 组织身份验证数据复用期限为 398 天（2026-03-15 起）。

### 步骤 5：CAA 检查

CAA（RFC 8659）是放在 DNS 中的授权策略，告诉 CA「哪些 CA 可以为这个域名签发证书」。

```dns
example.com.        CAA 0 issue "letsencrypt.org"
example.com.        CAA 0 issuewild "letsencrypt.org"
example.com.        CAA 0 iodef "mailto:security@example.com"
```

- `issue`：允许签发非泛域名证书的 CA。
- `issuewild`：允许签发泛域名证书的 CA；存在时优先于 `issue`。
- `iodef`：安全问题报告地址。
- `critical` 标志（flag 值 128）：如果 CA 不认识某个 critical 属性，必须拒绝签发。
- CAA 采用树形查找：当前域名没有记录时向父域查找，直到找到或到达根；CNAME 会被跟随。
- CA 必须在 CAA 记录的 TTL 或 8 小时内完成签发，超过则需要重新查询。
- CAA 在**签发时**检查，不是吊销机制；签发后修改 CAA 不会使已签发证书失效。
- 建议用 DNSSEC 保护 CAA 记录，防止被篡改或删除。

企业应把 CAA 作为防误签发的基础控制，并监控 CAA 记录变更。

### 步骤 6：生成证书 Profile

CA 不是把 CSR 原样签名，而是按证书类型生成标准 Profile。以公开信任服务器证书为例：

| 字段 | 要求 |
| ---- | ---- |
| `subjectAltName` | 必须包含至少一个 FQDN 或 IP；所有域名都要验证 |
| `commonName` | 可选，不推荐；若存在必须是 SAN 中的一个值 |
| `basicConstraints` | `CA:FALSE` |
| `keyUsage` | RSA 至少一个位，TLS 1.3 需要 `digitalSignature`；ECDSA 必须 `digitalSignature` |
| `extendedKeyUsage` | 必须包含 `serverAuth` |
| `authorityKeyIdentifier` | 必须等于签发 CA 的 SKI |
| `subjectKeyIdentifier` | 必须有 |
| `authorityInfoAccess` | OCSP（可选）、caIssuers（SHOULD） |
| `crlDistributionPoints` | 非短有效期证书必须有，除非包含 OCSP AIA |
| `certificatePolicies` | 按 CA 策略 |
| `SCT List` | 公开信任证书按 CT 策略 |
| 序列号 | 大于 0，至少 64 位 CSPRNG 熵 |
| 有效期 | 当前公开信任服务器证书最长 200 天 |

这一步是整个签发逻辑的核心：**Profile 决定了证书能做什么、不能做什么**。

### 步骤 7：CT 预证书与 SCT

公开信任证书通常要先走 Certificate Transparency：

1. CA 生成 Precertificate：结构与最终证书几乎相同，但包含一个 critical 的 poison 扩展（OID `1.3.6.1.4.1.11129.2.4.3`），防止被客户端当作正式证书使用。
2. CA 用中间 CA 私钥签 Precertificate。
3. 把 Precertificate 提交给多个 CT Log。
4. CT Log 返回 SCT（Signed Certificate Timestamp），表示「我承诺在最大合并延迟（MMD，通常 24 小时）内把它纳入日志」。
5. CA 生成最终证书：去掉 poison 扩展，加入 SCT List 扩展，再正式签名。

SCT 也可以通过 TLS 扩展或 OCSP 响应传递，但嵌入式 SCT List 最常见。

CT 的作用不是阻止误签发，而是让误签发**可被发现**。企业应监控 CT 日志，发现未经授权的证书。

公开 CA 通常会向多个 CT Log 提交，并把多个 SCT 嵌入证书。浏览器 CT 策略决定需要多少个 SCT、来自哪些合格日志，具体数量会随证书有效期和浏览器政策变化。私有 CA 不受浏览器 CT 策略约束。

### 步骤 8：正式签名

CA 对 TBSCertificate 做摘要，再用 CA 私钥签名：

```text
signature = Sign(CA_private_key, Hash(TBSCertificate))
```

最终证书结构：

```text
Certificate ::= SEQUENCE {
    tbsCertificate       TBSCertificate,
    signatureAlgorithm   AlgorithmIdentifier,
    signatureValue       BIT STRING
}
```

- 签名覆盖整个 TBS，包括 Subject、公钥、有效期和所有扩展。
- 任何字段被改动，签名都会失效。
- 签名算法和 TBS 内部的 `signature` 字段必须一致。
- CA 私钥通常在 HSM 中，签名操作有审计日志和权限控制。

### 步骤 9：组装与下发

CA 返回的通常是证书链，顺序为：

```text
leaf.crt
intermediate.crt
```

根证书一般不需要下发，因为客户端信任库中已有。服务器应发送 `leaf + intermediate`，形成 `fullchain`：

```bash
cat server.crt intermediate.crt > fullchain.crt
```

如果链不完整，部分客户端（尤其是 curl、Java、Go）会直接报错，而浏览器可能通过 AIA 或缓存补链。

### 步骤 10：客户端验证

客户端收到证书链后，执行以下检查：

1. 从 leaf 开始，用 Issuer/AKI 找到上一级证书。
2. 用上一级公钥验证 leaf 签名。
3. 逐级验证到信任库中的根。
4. 检查每张证书的有效期。
5. 检查 Basic Constraints、Path Length、Key Usage、EKU。
6. 检查 Name Constraints（如果有）。
7. 检查吊销状态（CRL/OCSP，很多客户端是 soft-fail）。
8. 检查主机名是否在 SAN 中。
9. 检查 CT 策略（浏览器）。
10. 验证 `CertificateVerify`，确认服务器持有私钥。

只有全部通过，TLS 握手才会继续。

## 数字签名与证书原理

### 签名与验签

- **签名**：对内容计算摘要（如 SHA-256），再用签名者私钥按算法生成签名值。
- **验签**：用签名者公钥验证签名值，并比对摘要，确认内容未被篡改。
- 证书签名不是「把证书加密」，而是「对证书内容做数字签名」。

### 证书的签名覆盖范围

```text
TBSCertificate = 版本 + 序列号 + 签名算法 + Issuer + 有效期
               + Subject + 公钥 + 扩展
signatureValue = Sign(CA 私钥, Hash(TBSCertificate))
```

因此：

- 改域名、改有效期、改扩展，都会导致签名失效。
- 证书的 `signatureAlgorithm` 字段本身也在 TBS 中，算法不能随便替换。
- 证书链验证本质上是「逐级验签」。

### 证书签名与 TLS 握手的区别

- 证书签名：CA 证明「这个公钥属于这个主体」。
- `CertificateVerify`：服务器证明「我持有这个公钥对应的私钥」。
- 两者都通过，才能确认对面身份。

### 自签名证书

自签名证书的 Issuer = Subject，签名者就是自己：

- 技术上和普通证书没有区别。
- 问题是客户端信任库中没有它，所以默认不信任。
- 适合测试、内部服务或私有 CA 的根证书。
- 公网生产环境不应直接使用自签名证书。

## X.509 v3 证书结构

### ASN.1 结构

```asn1
Certificate ::= SEQUENCE {
    tbsCertificate       TBSCertificate,
    signatureAlgorithm   AlgorithmIdentifier,
    signatureValue       BIT STRING
}

TBSCertificate ::= SEQUENCE {
    version              [0] EXPLICIT Version DEFAULT v1,
    serialNumber         CertificateSerialNumber,
    signature            AlgorithmIdentifier,
    issuer               Name,
    validity             Validity,
    subject              Name,
    subjectPublicKeyInfo SubjectPublicKeyInfo,
    issuerUniqueID       [1] IMPLICIT UniqueIdentifier OPTIONAL,
    subjectUniqueID      [2] IMPLICIT UniqueIdentifier OPTIONAL,
    extensions           [3] EXPLICIT Extensions OPTIONAL
}

Validity ::= SEQUENCE {
    notBefore            Time,
    notAfter             Time
}
```

### 主要字段

| 字段 | 说明 |
| ---- | ---- |
| version | v1/v2/v3；现代证书基本都是 v3 |
| serialNumber | CA 内唯一；公开信任证书要求至少 64 位 CSPRNG 熵 |
| signature | 签名算法，如 sha256WithRSAEncryption、ecdsa-with-SHA256 |
| issuer | 签发 CA 的 DN |
| validity | notBefore / notAfter，UTC 时间 |
| subject | 证书持有者 DN |
| subjectPublicKeyInfo | 公钥算法 + 公钥 |
| extensions | SAN、KU、EKU、BasicConstraints 等 |
| signatureValue | CA 对 TBS 的签名 |

### Subject 与 SAN

- Subject 是证书持有者的身份信息，常见属性：`C`、`ST`、`L`、`O`、`OU`、`CN`。
- 现代 TLS **只看 SAN**（subjectAltName），不看 CN。
- CA/B 规定 `commonName` 为 NOT RECOMMENDED；如果存在，必须是 SAN 中的一个值。
- 一个证书可以包含多个 SAN：多个域名、泛域名、IP 地址。
- 泛域名只能覆盖一级子域，`*.example.com` 不覆盖 `example.com`，也不覆盖 `a.b.example.com`。

### 编码格式

| 格式 | 说明 | 常见扩展名 |
| ---- | ---- | ---------- |
| PEM | DER 的 Base64 文本，带 `-----BEGIN CERTIFICATE-----` 头尾，最常用 | .pem .crt .cer .key |
| DER | 二进制 ASN.1 编码，证书签名和传输的底层格式 | .der .cer |
| PKCS#7 | 可包含证书链，不含私钥，常用于 CA 下发 | .p7b .p7c |
| PKCS#12 | 证书 + 私钥（+ 链），有密码保护，常用于导入浏览器/Java | .pfx .p12 |
| CSR | 证书签名请求，PKCS#10 结构 | .csr |

文件里可能是证书、私钥、公钥、CSR 或 CA 链，**不能只看扩展名，要看内容**。

```bash
# 查看证书结构
openssl x509 -in cert.pem -noout -text

# ASN.1 解析
openssl asn1parse -in cert.pem -i

# PEM -> DER
openssl x509 -in cert.pem -outform DER -out cert.der

# DER -> PEM
openssl x509 -in cert.der -inform DER -out cert.pem

# PEM 证书 + 私钥 + 链 -> PKCS#12
openssl pkcs12 -export -in cert.pem -inkey key.pem -certfile chain.pem -out cert.p12

# PKCS#12 -> PEM（-nodes 表示私钥不加密）
openssl pkcs12 -in cert.p12 -out all.pem -nodes

# PKCS#7 -> PEM
openssl pkcs7 -in cert.p7b -print_certs -out chain.pem
```

## 证书关键扩展

### 扩展的 critical 规则

- 扩展可以标记为 critical 或 non-critical。
- 客户端遇到**不认识的 critical 扩展**必须拒绝证书。
- 不认识的 non-critical 扩展可以忽略。
- 因此 CA 不会随便把私有扩展标成 critical，否则会破坏兼容性。

### 常用扩展

| 扩展 | 作用 | 典型 critical |
| ---- | ---- | ------------- |
| basicConstraints | 是否为 CA、路径长度限制 | 是 |
| keyUsage | 密钥用途位 | 通常是 |
| extendedKeyUsage | 扩展用途，如 serverAuth/clientAuth | 否 |
| subjectAltName | 域名/IP 身份 | 否 |
| subjectKeyIdentifier | 公钥标识 | 否 |
| authorityKeyIdentifier | 签发者公钥标识 | 否 |
| nameConstraints | 限制可签发的命名空间 | 是 |
| certificatePolicies | 证书策略 OID | 否 |
| policyConstraints | 策略约束 | 是 |
| inhibitAnyPolicy | 禁止 anyPolicy | 是 |
| CRLDistributionPoints | CRL 地址 | 否 |
| authorityInfoAccess | OCSP / caIssuers 地址 | 否 |
| TLS Feature | 如 Must-Staple（status_request） | 否 |
| SCT List | 证书透明度签名时间戳 | 否 |

### Key Usage 与 EKU 的关系

- KeyUsage 是「这把钥匙能干什么」的底层限制。
- EKU 是「这张证书适用于什么场景」的上层限制。
- 两者必须同时满足。例如服务器证书：
  - RSA：`digitalSignature` 必须，`keyEncipherment` 可选（兼容 TLS 1.2 RSA 密钥交换）。
  - ECDSA：`digitalSignature` 必须。
  - EKU：`serverAuth` 必须。

### Name Constraints

Name Constraints 只对 CA 证书有意义，用来限制下级 CA 能签发的域名/IP 范围：

```text
permittedSubtrees: DNS:.example.com
excludedSubtrees:  DNS:.internal.example.com
```

企业私有 CA 常用它防止某个中间 CA 被滥用后签发任意域名。公开 CA 通常不使用名称约束，因为要服务大量客户。

## 服务器证书的标准 Profile

### 根 CA Profile

| 字段 | 要求 |
| ---- | ---- |
| basicConstraints | critical, `CA:TRUE`，可设 pathlen |
| keyUsage | critical, `keyCertSign, cRLSign` |
| subjectKeyIdentifier | 必须有 |
| authorityKeyIdentifier | 自签名时可省略或等于 SKI |
| SAN | 不应有 |
| 有效期 | 10～25 年 |

### 中间 CA Profile

| 字段 | 要求 |
| ---- | ---- |
| basicConstraints | critical, `CA:TRUE, pathlen:0` |
| keyUsage | critical, `keyCertSign, cRLSign` |
| extendedKeyUsage | 按用途限制，如 `serverAuth` |
| subjectKeyIdentifier | 必须有 |
| authorityKeyIdentifier | 等于根 SKI |
| CRLDistributionPoints | 必须有 |
| authorityInfoAccess | 指向根证书/OCSP |
| nameConstraints | 私有 CA 建议配置 |

### 服务器证书 Profile

| 字段 | 要求 |
| ---- | ---- |
| basicConstraints | `CA:FALSE`，pathlen 不出现 |
| keyUsage | RSA：`digitalSignature`（TLS 1.3 必需）；ECDSA：`digitalSignature` |
| extendedKeyUsage | `serverAuth` |
| subjectAltName | 必须，包含所有域名/IP |
| commonName | 可选，不推荐 |
| authorityKeyIdentifier | 等于签发 CA 的 SKI |
| subjectKeyIdentifier | 必须有 |
| authorityInfoAccess | OCSP（可选）、caIssuers（SHOULD） |
| CRLDistributionPoints | 非短有效期证书必须有，除非有 OCSP AIA |
| SCT List | 公开信任证书按 CT 策略 |
| 有效期 | 当前最长 200 天 |

### 客户端证书 Profile

| 字段 | 要求 |
| ---- | ---- |
| basicConstraints | `CA:FALSE` |
| keyUsage | `digitalSignature`，某些场景可用 `keyAgreement` |
| extendedKeyUsage | `clientAuth` |
| subjectAltName | 客户端身份，如邮箱、SPIFFE ID、设备名 |
| 有效期 | 建议短有效期，配合自动轮换 |

### OCSP Responder Profile

| 字段 | 要求 |
| ---- | ---- |
| basicConstraints | `CA:FALSE` |
| keyUsage | `digitalSignature` |
| extendedKeyUsage | 仅 `OCSPSigning` |
| id-pkix-ocsp-nocheck | 通常包含，避免递归检查 |
| 签发者 | 与被检查证书相同的 CA，或受信任的 delegated responder |

## 证书链与信任模型

### 链是怎么构建的

客户端通常按以下顺序构建链：

1. 读取 leaf 的 Issuer DN 和 Authority Key Identifier。
2. 在本地或服务器提供的证书中寻找匹配的中间 CA。
3. 如果找不到，尝试通过 AIA 的 `caIssuers` 下载中间证书。
4. 继续向上，直到找到信任库中的根。
5. 如果存在多条链（交叉签名），选择能验证到受信任根的那条。

### 链的顺序

服务器应发送：

```text
leaf → intermediate
```

根证书不需要发送。链顺序错误、缺少中间证书、发送了错误中间证书，都会导致验证失败。

### 链的验证

客户端不是「看链里有什么就信什么」，而是：

- 从信任锚开始，逐级验证签名。
- 检查每张证书的有效期、用途、约束。
- 检查吊销状态。
- 检查主机名。

### 常见链错误

| 报错 | 原因 | 处理 |
| ---- | ---- | ---- |
| unable to get local issuer certificate | 缺少中间证书或客户端没有根 | 部署完整链，安装根证书 |
| unable to verify the first certificate | 链不完整 | 发送 leaf + intermediate |
| self signed certificate in certificate chain | 链中包含自签名证书但客户端不信任 | 使用受信任 CA，或分发私有根 |
| certificate has expired | 证书过期 | 续期并检查系统时间 |
| certificate is not yet valid | 客户端时间错误或 notBefore 未到 | 校准时间 |
| hostname mismatch | SAN 不包含访问域名 | 重新签发正确 SAN |
| unsupported certificate purpose | EKU/KU 不允许当前用途 | 使用正确类型的证书 |
| certificate revoked | 证书被吊销 | 更换证书，排查原因 |

## 认证路径验证

RFC 5280 定义了一套认证路径验证算法，核心步骤如下：

1. **初始化**：确定信任锚、初始策略集、初始路径长度等状态。
2. **基本证书处理**：对路径中的每张证书检查：
   - 签名是否有效。
   - 有效期是否覆盖当前时间。
   - 是否被吊销（如果启用了吊销检查）。
   - Issuer 名称是否匹配上一级 Subject。
   - 策略、名称约束、Basic Constraints、Key Usage 是否允许。
3. **准备下一张证书**：更新路径长度、策略树、名称约束等状态。
4. **收尾**：检查最终策略、路径长度、密钥用途等。

企业实践中，最常见的失败点不是算法，而是：

- 服务器没有发送中间证书。
- 客户端信任库没有私有根。
- 中间证书过期。
- 证书链顺序错误。
- EKU/KU 与用途不匹配。
- 主机名不在 SAN 中。
- 客户端时间错误。

## 主机名验证与 SNI

RFC 9525 规定 TLS 服务身份验证规则：

- 客户端使用 SAN 中的 `dNSName` 或 `iPAddress` 匹配，不使用 CN。
- DNS 名称比较不区分大小写。
- 泛域名只允许出现在**最左侧完整标签**，如 `*.example.com`。
- 不允许部分通配，如 `www*.example.com`、`*example.com`。
- `*.example.com` 只匹配一级子域，不匹配 `example.com`，也不匹配 `a.b.example.com`。
- IP 地址必须放在 `iPAddress` 类型的 SAN 中，不能放在 `dNSName`。
- 国际化域名要使用 A-label（punycode）比较。

SNI（Server Name Indication）让客户端在握手时告诉服务器要访问的域名，支持同一 IP 上部署多张证书：

```bash
openssl s_client -connect example.com:443 -servername example.com -showcerts
```

如果没有发送 SNI，服务器可能返回默认证书，导致 `hostname mismatch`。

ALPN 则用于协商应用层协议，如 `h2`、`http/1.1`：

```bash
openssl s_client -connect example.com:443 -servername example.com -alpn h2
```

## 证书类型与选型

| 类型 | 验证内容 | 适用场景 | 注意 |
| ---- | -------- | -------- | ---- |
| DV | 域名控制权 | 普通网站、API | 签发快，自动化友好 |
| OV | 组织身份 + 域名 | 企业官网、对外服务 | 需要组织材料 |
| EV | 严格组织验证 | 金融、品牌保护 | 浏览器不再特殊展示 |
| 单域名 | 一个 FQDN | 单一服务 | 最简单 |
| 多域名 SAN | 多个 FQDN/IP | 多域名合并 | 注意 SAN 变更需重签 |
| 泛域名 | `*.example.com` | 大量同级子域 | 不覆盖 apex 和多级子域，密钥风险集中 |
| IP 证书 | IP 地址 | 内部服务、IoT | 需要支持 IP SAN 的 CA |
| 客户端证书 | 客户端身份 | mTLS、设备认证 | 需要私钥保护和吊销 |
| 代码签名 | 代码发布者 | 软件分发 | 与 TLS 证书用途不同 |
| 私有 CA | 内部信任 | 内网、mTLS、测试 | 需分发根证书 |
| 自签名 | 无第三方 | 测试、实验 | 公网生产不推荐 |

选型建议：

- 公网 Web 优先 DV + 自动化，OV/EV 只在合规或品牌需求时使用。
- 泛域名用于确实需要大量同级子域的场景；能按服务拆分 SAN 就拆分。
- 内部服务使用私有 CA，配合短有效期和自动轮换。
- 不要用一张证书覆盖所有环境；测试、预发、生产分开。
- 不要用代码签名证书当 TLS 证书，EKU 不同。

## 密钥算法与强度

| 算法 | 常见长度 | 优点 | 缺点 | 适用 |
| ---- | -------- | ---- | ---- | ---- |
| RSA | 2048 / 3072 / 4096 | 兼容性最好 | 密钥大、握手慢 | 通用 |
| ECDSA | P-256 / P-384 / P-521 | 密钥小、速度快 | 老客户端兼容性略差 | 现代 TLS |
| Ed25519 | 256 位 | 性能好、实现简单 | 公开 TLS CA 支持有限 | 内部/实验 |
| ML-DSA | PQC | 抗量子 | 标准和生态仍在演进 | 迁移规划 |

公开信任证书要求：

- RSA 至少 2048 位。
- ECDSA 只允许 P-256/P-384/P-521。
- 签名算法使用 SHA-256/SHA-384/SHA-512，SHA-1 已被禁止。
- TLS 1.3 的 `CertificateVerify` 不允许 SHA-1；RSA 使用 RSA-PSS。

企业建议：

- 新系统优先 ECDSA P-256，保留 RSA 证书作为兼容回退。
- 私钥长度不是越长越好，2048 位 RSA 在可预见期内足够；4096 位会增加握手开销。
- 规划 crypto agility：算法、密钥类型、证书链都要能快速替换。
- 关注后量子迁移：NIST FIPS 203/204/205 已发布，TLS 混合密钥交换和 PQC 证书仍在演进，先做资产盘点和迁移预案。

## 证书生命周期

| 阶段 | 关键动作 | 企业控制 |
| ---- | -------- | -------- |
| 规划 | 确定用途、域名、CA、有效期 | 证书策略、命名规范 |
| 申请 | 生成密钥、CSR、提交 | 审批、职责分离 |
| 验证 | 域名/IP/组织验证 | 多视角、防劫持 |
| 签发 | CA 按 Profile 签名 | HSM、审计、CT |
| 部署 | 安装 fullchain、配置服务 | 变更管理、灰度 |
| 监控 | 到期、链、CT、CAA | 告警、巡检 |
| 续期 | 自动续期、换密钥 | ACME/ARI、演练 |
| 吊销 | 私钥泄露、误签、停用 | 应急预案 |
| 归档 | 保留审计记录 | 合规留存 |

企业常见角色：

- **证书所有者**：业务/系统负责人，对域名和证书用途负责。
- **PKI 管理员**：维护 CA、Profile、信任库。
- **安全团队**：策略、审计、CT/CAA 监控。
- **运维/SRE**：部署、续期、故障处理。
- **采购/法务**：CA 合同、合规要求。

## CSR 与签发

### CSR 结构

```asn1
CertificationRequest ::= SEQUENCE {
    certificationRequestInfo CertificationRequestInfo,
    signatureAlgorithm         AlgorithmIdentifier,
    signature                  BIT STRING
}

CertificationRequestInfo ::= SEQUENCE {
    version       INTEGER { v1(0) },
    subject       Name,
    subjectPKInfo SubjectPublicKeyInfo,
    attributes    [0] IMPLICIT Attributes
}
```

CSR 的签名证明申请者持有私钥，但不证明申请者拥有域名。域名控制权必须由 CA 通过验证流程确认。

### 用 OpenSSL 签发私有证书

这是一个最小化的三层签发示例，仅用于理解流程和实验环境。生产环境应使用 EJBCA、Vault PKI、step-ca、AD CS 等成熟 CA 软件。

```bash
# 1. 根 CA
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:4096 -out root.key
openssl req -x509 -new -key root.key -sha256 -days 7300 \
  -subj "/C=CN/O=Example/CN=Example Root CA" \
  -addext "basicConstraints=critical,CA:TRUE,pathlen:1" \
  -addext "keyUsage=critical,keyCertSign,cRLSign" \
  -out root.crt

# 2. 中间 CA
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:3072 -out intermediate.key
openssl req -new -key intermediate.key \
  -subj "/C=CN/O=Example/CN=Example Issuing CA" \
  -out intermediate.csr

cat > intermediate.ext <<'EOF'
basicConstraints=critical,CA:TRUE,pathlen:0
keyUsage=critical,keyCertSign,cRLSign
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req -in intermediate.csr -CA root.crt -CAkey root.key \
  -CAcreateserial -days 3650 -sha256 -extfile intermediate.ext \
  -out intermediate.crt

# 3. 服务器证书
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out server.key
openssl req -new -key server.key \
  -subj "/C=CN/O=Example/CN=example.com" \
  -addext "subjectAltName=DNS:example.com,DNS:www.example.com" \
  -out server.csr

cat > server.ext <<'EOF'
basicConstraints=CA:FALSE
keyUsage=critical,digitalSignature,keyEncipherment
extendedKeyUsage=serverAuth
subjectAltName=DNS:example.com,DNS:www.example.com
subjectKeyIdentifier=hash
authorityKeyIdentifier=keyid,issuer
EOF

openssl x509 -req -in server.csr -CA intermediate.crt -CAkey intermediate.key \
  -CAcreateserial -days 200 -sha256 -extfile server.ext \
  -out server.crt

# 4. 验证
openssl verify -show_chain -CAfile root.crt -untrusted intermediate.crt server.crt
```

### 为什么生产环境不直接用 `openssl x509 -req`

- 没有证书数据库、序列号管理、吊销列表、审计日志。
- 容易把 CSR 中的扩展原样复制，导致权限提升。
- 没有并发控制和权限分离。
- OpenSSL 官方文档也明确说明 `openssl ca` 原本只是示例，代码不具备生产 CA 的质量。

生产私有 CA 应至少具备：

- 离线根 + 在线中间 CA。
- HSM/KMS 保护私钥。
- 证书数据库、序列号管理、CRL/OCSP。
- Profile 校验、审批流、审计日志。
- 高可用和备份。
- API/ACME 集成。

## 私有 CA 建设

### 推荐架构

```text
离线根 CA（HSM，气隙，双人控制）
   ├── 服务器 TLS 中间 CA（按环境：生产/预发/测试）
   ├── 客户端 mTLS 中间 CA
   ├── 代码签名中间 CA
   └── 邮件加密中间 CA
```

设计要点：

- 根 CA 离线，只有签发/更新中间 CA 时才上线。
- 每个用途、环境、区域使用独立中间 CA，缩小爆炸半径。
- 中间 CA 设置 `pathlen:0`，不能再签下级 CA。
- 使用 `nameConstraints` 限制可签发域名。
- 服务器证书、客户端证书、代码签名证书使用不同 EKU。
- 私钥放 HSM/KMS，至少双人授权。
- 根密钥 ceremony 要覆盖密钥生成、备份、激活、轮换、销毁，采用 m-of-n 分片、双人控制和完整审计。
- 申请、审批、签发、部署、审计职责分离，避免单人完成全链路。
- 根证书通过 GPO、MDM、配置管理、容器镜像等方式分发。
- 建立 CP/CPS（证书策略/认证实践声明）和审计流程。

### 私有 CA 的信任分发

- **Windows**：组策略或 `certutil -addstore Root`
- **Linux**：`/usr/local/share/ca-certificates/` + `update-ca-certificates`
- **Java**：`keytool -importcert -cacerts`
- **Go**：系统根证书或自定义 `CertPool`
- **Python**：`certifi` 或 `REQUESTS_CA_BUNDLE`
- **Node.js**：`NODE_EXTRA_CA_CERTS`
- **curl**：`--cacert`
- **Kubernetes**：Secret/ConfigMap 挂载，或 cert-manager Trust Bundle

### 常用私有 CA 工具

| 工具 | 特点 |
| ---- | ---- |
| EJBCA | 功能完整的开源企业 CA，支持 OCSP/CT/HSM |
| HashiCorp Vault PKI | API 化签发，适合动态证书 |
| step-ca | 轻量、ACME/SSH 支持好，适合云原生 |
| AD CS | Windows 企业集成，GPO 分发方便 |
| cert-manager | Kubernetes 证书自动化，支持 ACME/Vault/私有 CA |
| CFSSL | Cloudflare 的 PKI 工具，适合中小规模 |
| Venafi / Lemur | 商业/企业证书生命周期管理 |

## 证书吊销与状态检查

### CRL

CRL（Certificate Revocation List）是 CA 定期发布的吊销列表：

- 包含被吊销证书的序列号、吊销时间、原因。
- 通过 `CRLDistributionPoints` 扩展中的 URL 分发。
- 有 `thisUpdate`、`nextUpdate`、CRL Number。
- 支持完整 CRL 和增量 CRL（Delta CRL）。
- 支持分片 CRL（Issuing Distribution Point）以适应大规模 CA。

CA/B 对 CRL 的要求：

- 必须通过公开 HTTP URL 发布。
- 有 OCSP AIA 的 CA，至少每 7 天更新一次 CRL；否则每 4 天。
- 记录吊销后 24 小时内必须发布新 CRL。
- 短有效期证书可以豁免 CRLDP 要求。

### OCSP

OCSP（RFC 6960）是在线查询单张证书状态的协议：

- 请求包含证书序列号和签发者信息。
- 响应状态：`good`、`revoked`、`unknown`。
- 响应由 CA 或授权的 OCSP Responder 签名。
- OCSP Responder 证书必须包含 `OCSPSigning` EKU。
- 有 `thisUpdate`、`nextUpdate`，客户端据此缓存。
- 支持 nonce 防重放，但会增加延迟。
- 隐私问题：CA 能看到谁在访问哪个网站。

### OCSP Stapling

服务器代替客户端向 CA 获取 OCSP 响应，并在 TLS 握手中下发：

- 减少客户端到 CA 的请求，保护隐私。
- 降低握手延迟。
- 服务器需要定期刷新响应。
- 可配合 Must-Staple（RFC 7633）强制要求 stapling。

### 行业变化：OCSP 正在退场

Let's Encrypt 已明确停止 OCSP：

- 2025-01-30：包含 Must-Staple 的申请失败（除非账户之前签发过）。
- 2025-05-07：从证书中移除 OCSP URL；所有 Must-Staple 申请失败。
- 2025-08-06：关闭 OCSP Responder。

同时，CA/B Forum 已将 OCSP 从强制基线中弱化，CRL 成为默认吊销机制，短有效期证书可以进一步简化。企业应：

- 新系统优先支持 CRL。
- 不要假设所有证书都有 OCSP URL。
- 对 mTLS/内部服务，明确吊销检查策略（hard-fail/soft-fail）。
- 公开 Web 更多依赖短有效期 + CT + 自动化，而不是实时吊销。
- 如果仍使用 OCSP Stapling，监控响应刷新和失败情况。

### 吊销检查的现实

- 很多浏览器对 OCSP/CRL 失败采取 soft-fail，吊销并不可靠。
- 攻击者可能阻断吊销查询。
- 短有效期证书让「等待过期」成为可接受的替代。
- 企业内网可以实施 hard-fail，但必须保证 CRL/OCSP 高可用。
- 证书透明度让误签发可被发现，但不能替代吊销。

### 吊销原因码

| 原因码 | 含义 | 典型场景 |
| ------ | ---- | -------- |
| keyCompromise | 私钥泄露 | 服务器被入侵、密钥文件泄露 |
| cACompromise | CA 私钥泄露 | CA 被攻破 |
| affiliationChanged | 归属变更 | 域名/组织变更 |
| superseded | 已被替换 | 正常换证 |
| cessationOfOperation | 停止使用 | 服务下线 |
| certificateHold | 暂停使用 | 临时冻结，可恢复 |
| removeFromCRL | 从 CRL 移除 | 仅用于 delta CRL |
| privilegeWithdrawn | 权限撤销 | 证书用途被取消 |
| aACompromise | 属性机构泄露 | AA 私钥泄露 |

### 吊销方式选择

| 场景 | 建议 |
| ---- | ---- |
| 公开 Web | 短有效期 + CT + CRL；OCSP Stapling 可选 |
| 内部 mTLS | 短有效期 + CRL/OCSP，必要时 hard-fail |
| 老客户端兼容 | CRL + OCSP Stapling，保留回退 |
| 高安全场景 | 短有效期 + hard-fail + CT 监控 + 快速轮换 |
| 大规模私有 CA | 分片 CRL + OCSP/CRL 高可用，监控 nextUpdate |

## 证书透明度 CT

Certificate Transparency（RFC 6962）是一个公开的、只追加的证书日志系统：

- CA 把预证书提交到多个 CT Log。
- Log 返回 SCT（Signed Certificate Timestamp）。
- 浏览器要求公开信任证书满足 CT 策略。
- 任何人都可以查询日志，发现某域名被签发了哪些证书。

关键概念：

- **Log**：独立的 CT 日志服务器。
- **SCT**：日志对「将在 MMD 内纳入」的签名承诺。
- **MMD**：Maximum Merge Delay，通常 24 小时。
- **Precertificate**：带 poison 扩展的预证书。
- **Inclusion Proof**：证明证书已纳入日志的 Merkle 路径。

SCT 的传递方式：

1. 嵌入最终证书的 SCT List 扩展（最常见）。
2. TLS 握手扩展 `signed_certificate_timestamp`。
3. OCSP 响应扩展。

企业实践：

- 监控 CT 日志，发现未经授权的证书签发。
- 使用 crt.sh、Cert Spotter 等工具做域名监控。
- 结合 CAA 限制可签发 CA。
- 私有 CA 不受浏览器 CT 策略约束，但大型企业可以自建 CT 用于审计。

## CAA 与误签发防护

CAA 是 DNS 中的授权记录，企业应至少配置：

```dns
example.com.  CAA 0 issue "letsencrypt.org"
example.com.  CAA 0 issuewild "letsencrypt.org"
example.com.  CAA 0 iodef "mailto:security@example.com"
```

实践要点：

- 只授权实际使用的 CA，减少误签发面。
- 泛域名单独用 `issuewild` 控制。
- 使用 DNSSEC 保护 CAA 记录，防止被篡改。
- 监控 CAA 记录变化，防止被恶意删除或修改。
- CAA 不是万能的：它不能阻止已授权的 CA 被攻破，也不能撤销已签发证书。
- CAA 与 CT 监控配合：CAA 预防，CT 发现，吊销/替换响应。

## ACME 自动化

ACME（RFC 8555）是公开 CA 自动签发证书的标准协议。

### 流程

```text
创建/复用 Account
   ↓
New Order（提交域名列表）
   ↓
获取 Authorization
   ↓
完成 Challenge（HTTP-01 / DNS-01 / TLS-ALPN-01）
   ↓
CA 验证 + CAA 检查
   ↓
Finalize Order（提交 CSR）
   ↓
下载 Certificate Chain
```

### 挑战类型

| 类型 | 方式 | 端口 | 泛域名 | 适用 |
| ---- | ---- | ---- | ------ | ---- |
| HTTP-01 | `/.well-known/acme-challenge/` | 80 | 否 | 普通 Web |
| DNS-01 | `_acme-challenge` TXT | 53 | 是 | 泛域名、无 80 端口 |
| TLS-ALPN-01 | ALPN `acme-tls/1` | 443 | 否 | 反向代理/托管商 |

### 速率限制

以 Let's Encrypt 为例（具体以官方最新文档为准）：

- 每个注册域名每 7 天最多 50 张证书。
- 每个精确标识符集合每 7 天最多 5 张证书。
- 每个账户每 3 小时最多 300 个新订单。
- 每个标识符每账户每小时最多 5 次授权失败。
- 账户注册、请求频率等还有独立限制。

企业应：

- 使用 staging 环境测试。
- 支持 ARI（ACME Renewal Info），在推荐窗口续期。
- 不要把 DNS API 全权限凭据放在 Web 服务器上。
- 使用 CNAME 委派 `_acme-challenge` 到专用 DNS 区域。
- 监控续期失败和证书到期时间。
- 新密钥每次续期都重新生成，避免长期复用。

### 常见客户端

- certbot
- acme.sh
- cert-manager（Kubernetes）
- Caddy（内置 ACME）
- Traefik（内置 ACME）
- lego
- Vault PKI + ACME

## mTLS 双向认证

mTLS 是客户端和服务器都出示证书的 TLS：

1. 服务器发送证书链。
2. 服务器发送 `CertificateRequest`，列出可接受的 CA。
3. 客户端发送自己的证书链。
4. 客户端发送 `CertificateVerify`，证明持有私钥。
5. 双方验证对方证书链、有效期、用途、吊销状态。
6. 建立加密通道。

客户端证书要求：

- `basicConstraints: CA:FALSE`
- `keyUsage: digitalSignature`
- `extendedKeyUsage: clientAuth`
- SAN 表示客户端身份，如 SPIFFE ID、服务名、设备 ID、邮箱
- 短有效期，自动轮换
- 私钥放安全存储

TLS 1.3 中客户端证书在握手加密后才发送；还支持 post-handshake authentication，服务器可以在握手完成后请求客户端证书。

企业实践：

- 服务间 mTLS 用私有 CA 或 service mesh（Istio/Linkerd）自动签发。
- 信任 bundle 要包含所有可能签发客户端证书的 CA。
- 吊销策略要明确：内部 mTLS 可以 hard-fail CRL/OCSP。
- 不要把 mTLS 当作人类用户认证的唯一手段，通常还要结合 OIDC/OAuth。
- 证书轮换要平滑，避免旧连接中断。
- 常见错误：`unknown ca`、`bad certificate`、`certificate required`、EKU 不匹配。

## 部署与安全配置

### Nginx

```nginx
server {
    listen 443 ssl;
    http2 on;
    server_name example.com www.example.com;

    ssl_certificate     /etc/nginx/ssl/fullchain.pem;
    ssl_certificate_key /etc/nginx/ssl/server.key;

    ssl_protocols       TLSv1.2 TLSv1.3;
    ssl_ciphers         ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-CHACHA20-POLY1305:ECDHE-RSA-CHACHA20-POLY1305;
    ssl_prefer_server_ciphers off;

    ssl_session_cache   shared:SSL:10m;
    ssl_session_timeout 1d;
    ssl_session_tickets off;

    ssl_stapling on;
    ssl_stapling_verify on;
    ssl_trusted_certificate /etc/nginx/ssl/chain.pem;
    resolver 1.1.1.1 8.8.8.8 valid=300s;

    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
}
```

### 关键配置项

- 只启用 TLS 1.2/1.3，禁用 SSLv3、TLS 1.0/1.1。
- 优先 ECDHE + AEAD 套件，具备前向保密。
- 部署完整链 `leaf + intermediate`。
- 私钥权限 `600`，属主为服务运行用户或 root。
- 启用 OCSP Stapling 时配置 `resolver` 和 `ssl_trusted_certificate`。
- HSTS 先从小 `max-age` 开始，确认全站 HTTPS 后再加 `includeSubDomains`。
- 慎用 `preload`，移除周期很长。
- 多证书场景确认 SNI 和默认证书。
- 负载均衡/CDN 终止 TLS 时，回源也要加密。
- 更新证书后平滑 reload，避免连接中断。
- 多实例部署要确保所有实例都更新。

### HSTS

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
```

- 让浏览器后续强制使用 HTTPS。
- `includeSubDomains` 会影响所有子域，必须确认子域都支持 HTTPS。
- `preload` 会写入浏览器内置列表，移除困难。
- 回滚：`max-age=0`。
- HSTS 不能保护第一次访问，仍需 HTTP 跳转和证书有效。

## 监控巡检与故障排查

### 监控指标

- 证书到期时间（leaf、intermediate、root）。
- 证书链完整性。
- 主机名/SAN 是否匹配。
- 证书类型、密钥算法、签名算法。
- 签发者、序列号、指纹。
- CT 日志中是否出现未知证书。
- CAA 记录是否被修改。
- OCSP/CRL 可用性。
- 握手失败率、TLS 版本分布、套件分布。
- 自动化续期成功率、上次续期时间。

### 到期告警阈值

建议至少设置：

- 30 天：提醒
- 14 天：警告
- 7 天：严重
- 3 天：紧急

对于 47 天有效期的未来证书，阈值要相应提前，不能沿用 30 天。

### 巡检脚本

```bash
#!/usr/bin/env bash
set -euo pipefail

host="$1"
port="${2:-443}"

echo | openssl s_client -connect "${host}:${port}" -servername "${host}" 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates -serial -fingerprint -sha256

echo | openssl s_client -connect "${host}:${port}" -servername "${host}" 2>/dev/null \
  | openssl x509 -noout -checkend $((30*86400)) \
  && echo "OK: > 30 days" || echo "WARN: <= 30 days"
```

### 常用工具

- `openssl s_client`：握手、证书链、OCSP Stapling、ALPN。
- `openssl verify`：离线验证链。
- `curl -vI`：快速检查 HTTPS。
- `nmap --script ssl-enum-ciphers`：枚举协议和套件。
- `testssl.sh`：全面的 TLS 配置检测。
- SSL Labs：在线评分和链分析。
- `blackbox_exporter`：Prometheus SSL 探针。
- Zabbix/Prometheus：到期告警。
- crt.sh / Cert Spotter：CT 监控。

### 故障排查顺序

1. 确认 DNS 和 SNI 是否正确。
2. 用 `openssl s_client -showcerts` 看服务器实际发送的链。
3. 用 `openssl verify` 离线验证链。
4. 检查证书有效期和客户端时间。
5. 检查 SAN 和访问域名。
6. 检查 EKU/KU 是否匹配用途。
7. 检查客户端信任库。
8. 检查吊销状态和 OCSP/CRL 可达性。
9. 检查 TLS 版本/套件是否协商失败。
10. 抓包看握手在哪一步中断。

### 客户端信任库差异

| 客户端 | 信任库 | 常见问题 |
| ------ | ------ | -------- |
| 浏览器 | 系统 + 自带 | 根证书分发、CT 策略 |
| Java | `cacerts` | 缺少私有根、`trustStore` 配置 |
| Go | 系统根证书 | 容器镜像缺少 CA 包 |
| Python | `certifi` | 未使用系统根、`REQUESTS_CA_BUNDLE` |
| Node.js | 内置根 | `NODE_EXTRA_CA_CERTS` |
| curl | 系统 CA bundle | `--cacert` 未指定 |
| Kubernetes | 容器内 CA | 镜像精简导致证书缺失 |

## 合规与审计

### 主要标准

| 标准 | 关注点 |
| ---- | ------ |
| CA/B Forum TLS BR | 公开信任证书的签发、Profile、有效期、CT、CAA、吊销 |
| RFC 5280 | X.509 证书和 CRL 的格式与路径验证 |
| RFC 8446 | TLS 1.3 的证书认证和握手 |
| NIST SP 800-52 Rev.2 | 联邦 TLS 配置指南 |
| PCI DSS v4.0 | 支付环境要求 TLS 1.2+，禁用 SSL/早期 TLS |
| FIPS 140-3 | 加密模块安全要求 |
| ISO 27001 / SOC 2 | 密钥管理、访问控制、审计证据 |

### 有效期时间表

| 证书签发时间 | 公开信任服务器证书最长有效期 |
| ------------ | ---------------------------- |
| 2026-03-15 之前 | 398 天 |
| 2026-03-15 至 2027-03-15 | 200 天 |
| 2027-03-15 至 2029-03-15 | 100 天 |
| 2029-03-15 之后 | 47 天 |

这意味着**自动化续期不是可选项，而是基础设施能力**。

### 审计证据

- 证书策略/CP/CPS 和 Profile 定义。
- 证书清单：域名、用途、CA、有效期、负责人。
- 私钥 custody 记录：HSM、权限、双人控制。
- 签发审批和变更记录。
- 吊销记录和事件响应记录。
- CT/CAA 监控记录。
- 续期成功率和异常处理记录。

## 企业落地架构清单

### CA 选型与多 CA 容灾

公开 CA 选型不只看价格，至少评估：

| 维度 | 要确认的内容 |
| ---- | ------------ |
| 信任库覆盖 | 目标客户端（浏览器、移动端、Java、IoT）是否信任其根 |
| 自动化能力 | ACME/API、证书链下载、续期通知、ARI 支持 |
| 吊销能力 | CRL 发布频率、OCSP 是否仍提供、Must-Staple 支持 |
| CT 合规 | 是否按浏览器策略提交 CT、SCT 如何下发 |
| 根生命周期 | 根轮换计划、交叉签名策略、历史根移除风险 |
| SLA 与支持 | 签发可用性、故障响应、紧急吊销通道 |
| 合规审计 | WebTrust/ETSI 审计、CP/CPS 是否公开 |

多 CA 策略：

- CAA 中允许主备 CA，避免单一 CA 故障导致无法续期。
- ACME 客户端配置主 CA 失败后切换备用 CA 的能力。
- 定期演练 CA 不可用、根被移除、CRL 拉取失败等场景。
- 监控 CT，发现任一 CA 对自有域名的异常签发。
- 备用证书链要提前验证客户端兼容性，不要等故障时才测试。

私有 CA 选型关注：

- 是否支持离线根 + 在线中间 CA。
- 是否支持 HSM/KMS、ACME/API、证书数据库、CRL/OCSP。
- 是否支持证书 Profile、Name Constraints、Path Length。
- 是否具备高可用、备份恢复、审计日志和权限分离。
- 是否容易与 Kubernetes、服务网格、CI/CD 集成。

### 证书生命周期管理平台

企业证书数量上去后，Excel 和手工续期必然失控。CLM（Certificate Lifecycle Management）平台至少应具备：

- **发现与盘点**：扫描 IP/端口、接入负载均衡/CDN/Ingress API、导入 CMDB，形成证书清单。
- **归属管理**：每张证书有业务负责人、域名、用途、环境、CA、自动化状态。
- **申请与审批**：自助申请、策略校验、审批流、职责分离。
- **自动化签发**：ACME、私有 CA API、cert-manager、Vault PKI。
- **部署连接器**：Nginx/Apache/HAProxy/Envoy/F5/CDN/Kubernetes。
- **续期与轮换**：到期前自动续期、换密钥、灰度发布、失败告警。
- **吊销与应急**：一键吊销、替换、通知、审计。
- **监控与报表**：到期、链错误、CT 异常、CAA 变更、合规报表。

常见组合：

- 公有云 + Kubernetes：cert-manager + ACME/私有 CA + External Secrets。
- 混合云：Vault PKI 或 EJBCA 作为私有 CA，Venafi/Lemur 做 CLM。
- Windows 环境：AD CS + GPO/Intune 分发。
- 服务网格：Istio/Linkerd 自动签发 mTLS 证书并轮换。

黄金路径应是「默认自动化、例外才手工」；手工证书必须有审批、到期提醒和责任人。

### 信任库分发

私有 CA 的根证书必须分发到所有验证方，否则会出现 `unknown authority`：

- Windows：GPO、Intune、`certutil -addstore Root`
- Linux：`/usr/local/share/ca-certificates/` + `update-ca-certificates`
- Java：`keytool -importcert -cacerts`
- Python：`certifi` 或 `REQUESTS_CA_BUNDLE`
- Node.js：`NODE_EXTRA_CA_CERTS`
- Go：系统根证书或自定义 `CertPool`
- 容器：基础镜像预置 CA 包，或在启动时挂载
- Kubernetes：Secret/ConfigMap、cert-manager Trust Bundle、service mesh 信任包

分发时要考虑：

- 先灰度到测试环境，再生产；保留回滚路径。
- 根轮换要提前分发新根，不能等旧根过期。
- 监控信任库版本，避免部分节点缺失根证书。
- 不要把私钥和根证书一起打包分发。

### 应急响应 Runbook

| 场景 | 首要动作 | 后续动作 |
| ---- | -------- | -------- |
| 私钥泄露 | 立即吊销并换新密钥重签 | 排查泄露路径、检查 CT/日志、通知相关方、复盘 |
| 证书过期 | 紧急续期并全量部署 | 校验所有实例、补充到期告警、复盘自动化缺口 |
| 误签发/CA 被攻破 | 吊销问题证书、切换受信任链 | 通知 CA、监控 CT、评估影响、更新 CAA |
| 链错误/中间证书过期 | 更换完整链 | 校验客户端兼容性、监控中间证书到期 |
| 算法弱化 | 规划迁移到新算法/密钥 | 盘点资产、灰度、验证客户端兼容性 |
| 根被移除/轮换 | 部署交叉签名或新链 | 更新信任库、验证老客户端、更新监控 |

Runbook 要写清楚：谁有权吊销、谁批准、多久完成、如何验证、如何对外沟通。

### 关键指标与 SLO

建议至少监控：

- 证书总数、按 CA/用途/环境分布。
- 30/14/7/3 天内到期数量。
- 自动化覆盖率、续期成功率、平均续期耗时。
- 链验证失败率、握手失败率。
- CT 中出现的未知证书数量。
- CAA 记录变更次数。
- CRL/OCSP 可用性。
- 未纳管证书数量（发现但不在清单中）。
- 私钥托管在 HSM/KMS 的比例。

SLO 示例：

- 公开信任证书续期成功率 ≥ 99.9%。
- 生产证书 100% 纳入清单和到期监控。
- 到期前 14 天完成续期比例 ≥ 99%。
- CT 异常发现后 24 小时内完成研判。

## 常见误区

- **证书会加密数据**：证书只做身份认证和公钥绑定，数据加密由 TLS 会话密钥完成。
- **泛域名覆盖所有子域**：只覆盖一级子域，不覆盖 apex 和多级子域。
- **自签名证书一定不安全**：技术上可以安全，只是默认不被公共客户端信任；私有 CA 可以解决。
- **EV 证书更安全**：验证更严格，但不会让 TLS 加密更强，浏览器也不再特殊展示。
- **吊销检查可靠**：很多客户端 soft-fail，吊销不能替代短有效期和自动化。
- **证书过期就是私钥泄露**：过期只是有效期结束，和私钥是否泄露无关。
- **CN 可以替代 SAN**：现代客户端只看 SAN。
- **一张证书可以覆盖所有服务**：应按用途、环境、域名拆分，降低爆炸半径。
- **私钥可以复用**：续期应换新密钥，降低泄露影响。
- **做了证书固定就安全**：没有备用 pin 的 pinning 会导致轮换事故；HPKP 已被废弃。
- **关闭证书验证可以解决问题**：这是最危险的做法，会直接失去中间人防护。
- **根证书要发给客户端**：客户端信任库已有根，服务器通常只需发 leaf + intermediate。
- **链顺序无所谓**：顺序错误会导致部分客户端验证失败。
- **有效期越长越省事**：有效期正在缩短，长证书会迫使你更晚面对自动化问题。

### 签发架构反模式

| 反模式 | 风险 | 正确做法 |
| ------ | ---- | -------- |
| 根 CA 在线长期开机 | 根私钥暴露面大 | 根离线、HSM、ceremony、双人控制 |
| 所有用途共用一张中间 CA | 一处泄露影响全部 | 按用途/环境拆分中间 CA |
| 私钥放 Git、镜像、聊天工具 | 泄露不可控 | HSM/KMS/Secret Manager，权限最小化 |
| 手工续期 + Excel 台账 | 过期事故 | ACME/CLM 自动化 + 到期监控 |
| 一张泛域名证书覆盖所有服务 | 密钥集中、影响面大 | 按服务/环境拆分 SAN 或证书 |
| 关闭证书校验 | 直接失去中间人防护 | 修复信任链，绝不关闭校验 |
| 只监控 leaf 不监控中间/根 | 链过期导致全站故障 | 监控整条链的有效期 |
| 没有 CT/CAA 监控 | 误签发无法发现 | CAA 限制 + CT 监控 + 告警 |
| 长期复用同一私钥 | 泄露影响历史流量 | 每次续期生成新密钥 |
| 没有备用 pin 的证书固定 | 轮换导致大面积不可用 | 备用 pin + 远程配置 + 回退 |
| 证书清单缺失 | 不知道有什么、何时过期 | 自动发现 + CMDB + 责任人 |

## 常见问题

**Q：证书是怎么签出来的？**

A：申请者生成密钥和 CSR，CA 验证域名/IP/组织身份，按 Profile 组装 TBS，用中间 CA 私钥签名；公开信任证书还要先提交 CT 日志取得 SCT，最后组装成最终证书。

**Q：为什么需要中间 CA，根 CA 直接签不好吗？**

A：根私钥必须离线保护，日常签发不能触碰根；中间 CA 可以在线签发、按用途拆分、单独吊销和轮换，降低风险。

**Q：证书链为什么只需要 leaf + intermediate？**

A：根证书已经在客户端信任库中，客户端自己知道。服务器发送根证书不会增加信任，反而增加握手体积。

**Q：证书过期后服务器为什么还能返回？**

A：服务器只是读取文件，不会主动检查有效期；是客户端拒绝过期证书。

**Q：证书和私钥不匹配会怎样？**

A：TLS 握手失败，常见报错 `key values mismatch` 或 `private key does not match certificate`。用公钥摘要比对可以确认。

**Q：证书换了但客户端仍报旧证书？**

A：检查是否只更新了叶子证书而中间证书不匹配、负载均衡或多实例未全部更新、CDN 缓存，或客户端复用了旧会话。用 `openssl s_client -showcerts` 确认服务器实际下发的链。

**Q：RSA 和 ECDSA 怎么选？**

A：新系统优先 ECDSA P-256，性能更好、证书更小；保留 RSA 证书作为老客户端兼容回退。双证书部署需要服务器支持。

**Q：公开信任证书最长能签多久？**

A：截至 2026-10，公开信任服务器证书最长 200 天；2027-03-15 起 100 天，2029-03-15 起 47 天。

**Q：Let's Encrypt 证书为什么只有 90 天？**

A：短有效期降低私钥泄露和吊销滞后的风险，配合 ACME 自动续期。未来行业有效期还会进一步缩短。

**Q：OCSP 和 CRL 怎么选？**

A：新系统优先 CRL；公开 Web 更多依赖短有效期 + CT。OCSP 隐私和可用性问题较多，Let's Encrypt 已停止 OCSP，CA/B 也已弱化 OCSP 要求。

**Q：什么是 CT，企业要做什么？**

A：CT 是公开证书日志。企业应监控 CT，发现未经授权的证书签发；配合 CAA 限制可签发 CA。

**Q：CAA 能阻止证书被签吗？**

A：能阻止遵守 CAA 的 CA 在未授权时签发，但不能阻止已授权 CA 被攻破，也不能撤销已签发证书。

**Q：mTLS 的客户端证书怎么管？**

A：使用私有 CA 签发，EKU 为 `clientAuth`，短有效期，自动轮换；信任 bundle 分发到所有服务端；明确 CRL/OCSP 策略。

**Q：私有 CA 的根证书怎么分发？**

A：Windows 用 GPO/Intune，Linux 用 `ca-certificates`，Java 用 `keytool`，容器镜像预置，Kubernetes 用 Secret/ConfigMap 或 cert-manager Trust Bundle。

**Q：证书固定（pinning）还能用吗？**

A：HPKP 已被废弃。移动端如必须 pinning，要预留备用公钥、支持远程配置和紧急回退，否则证书轮换会导致大面积不可用。

**Q：后量子的证书现在要上吗？**

A：先做资产盘点和迁移规划，关注 TLS 混合密钥交换和 PQC 证书标准演进；短期内以 crypto agility 为目标，不必急于替换所有证书。

## 命令速查

### 查看与验证

| 目的 | 命令 |
| ---- | ---- |
| 查看证书详情 | `openssl x509 -in cert.pem -noout -text` |
| 查看主题/颁发者/有效期 | `openssl x509 -in cert.pem -noout -subject -issuer -dates` |
| 查看 SAN | `openssl x509 -in cert.pem -noout -ext subjectAltName` |
| 查看指纹 | `openssl x509 -in cert.pem -noout -fingerprint -sha256` |
| 查看序列号 | `openssl x509 -in cert.pem -noout -serial` |
| 查看公钥 | `openssl x509 -in cert.pem -noout -pubkey` |
| 验证链 | `openssl verify -CAfile root.crt -untrusted intermediate.crt cert.pem` |
| 显示链 | `openssl verify -show_chain -CAfile root.crt cert.pem` |
| 验证主机名 | `openssl verify -verify_hostname example.com -CAfile root.crt cert.pem` |
| 验证用途 | `openssl verify -purpose sslserver -CAfile root.crt cert.pem` |
| 检查私钥 | `openssl pkey -in server.key -check` |
| 证书私钥匹配 | 比较 `x509 -pubkey` 与 `pkey -pubout` 的 SHA-256 |

### 在线检查

| 目的 | 命令 |
| ---- | ---- |
| 获取证书链 | `openssl s_client -connect host:443 -servername host -showcerts </dev/null` |
| 验证握手 | `openssl s_client -connect host:443 -servername host -verify_return_error` |
| 查看 OCSP Stapling | `openssl s_client -connect host:443 -servername host -status` |
| 指定 TLS 版本 | `openssl s_client -connect host:443 -servername host -tls1_3` |
| 指定 ALPN | `openssl s_client -connect host:443 -servername host -alpn h2` |
| 快速检查 | `curl -vI https://host` |
| 枚举套件 | `nmap --script ssl-enum-ciphers -p 443 host` |
| 综合检测 | `testssl.sh host:443` |
| 在线评分 | SSL Labs |

### 生成与转换

| 目的 | 命令 |
| ---- | ---- |
| 生成 RSA 私钥 | `openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out key.pem` |
| 生成 ECDSA 私钥 | `openssl ecparam -name prime256v1 -genkey -noout -out key.pem` |
| 生成 CSR | `openssl req -new -key key.pem -out req.csr -addext "subjectAltName=DNS:example.com"` |
| 自签名证书 | `openssl req -x509 -new -key key.pem -days 365 -out cert.pem` |
| PEM 转 DER | `openssl x509 -in cert.pem -outform DER -out cert.der` |
| DER 转 PEM | `openssl x509 -in cert.der -inform DER -out cert.pem` |
| 导出 PKCS#12 | `openssl pkcs12 -export -in cert.pem -inkey key.pem -certfile chain.pem -out cert.p12` |
| 解析 PKCS#12 | `openssl pkcs12 -in cert.p12 -nodes -out all.pem` |
| ASN.1 解析 | `openssl asn1parse -in cert.pem -i` |

### 吊销检查

| 目的 | 命令 |
| ---- | ---- |
| 查询 OCSP | `openssl ocsp -issuer intermediate.crt -cert cert.pem -url http://ocsp.example.com -resp_text` |
| 查看 CRL | `openssl crl -in crl.pem -noout -text` |
| 验证时检查 CRL | `openssl verify -CRLfile crl.pem -crl_check -CAfile root.crt cert.pem` |

## 参考资料

- [RFC 5280 - X.509 证书与 CRL Profile](https://datatracker.ietf.org/doc/html/rfc5280)
- [RFC 8446 - TLS 1.3](https://datatracker.ietf.org/doc/html/rfc8446)
- [RFC 6960 - OCSP](https://datatracker.ietf.org/doc/html/rfc6960)
- [RFC 6962 - Certificate Transparency](https://datatracker.ietf.org/doc/html/rfc6962)
- [RFC 8555 - ACME](https://datatracker.ietf.org/doc/html/rfc8555)
- [RFC 8659 - CAA](https://datatracker.ietf.org/doc/html/rfc8659)
- [RFC 9525 - Service Identity in TLS](https://datatracker.ietf.org/doc/html/rfc9525)
- [RFC 7633 - TLS Feature / Must-Staple](https://datatracker.ietf.org/doc/html/rfc7633)
- [RFC 6797 - HSTS](https://datatracker.ietf.org/doc/html/rfc6797)
- [RFC 8737 - ACME TLS-ALPN](https://datatracker.ietf.org/doc/html/rfc8737)
- [CA/Browser Forum TLS Baseline Requirements](https://cabforum.org/working-groups/server/baseline-requirements/requirements/)
- [Let's Encrypt Challenge Types](https://letsencrypt.org/docs/challenge-types/)
- [Let's Encrypt Rate Limits](https://letsencrypt.org/docs/rate-limits/)
- [Let's Encrypt Ending OCSP Support](https://letsencrypt.org/2024/12/05/ending-ocsp/)
- [OpenSSL 官方文档](https://docs.openssl.org/)
- [NIST SP 800-52 Rev.2](https://csrc.nist.gov/pubs/sp/800/52/r2/final)
- [SSL Labs](https://www.ssllabs.com/ssltest/)
