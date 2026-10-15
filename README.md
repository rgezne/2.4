# gopeed-extension-pikpak

[Gopeed](https://gopeed.com) 的 PikPak 分享解析扩展。把 `https://mypikpak.com/s/<share_id>[/<parent_id>]` 形式的分享链接喂给 Gopeed，自动列出所有文件并解析直链下载。

> **视频可匿名下载；zip 等其他文件需要登录并转存。** PikPak 对分享里的非视频文件不给直链（网页端的“下载”按钮也只是引导你先转存）。登录后，扩展会把这些文件**转存到你自己的 PikPak 网盘**，再取网盘里的下载地址。
>
> - 转存会占用你的网盘空间；免费账号每天的转存次数有限
> - 同一分享里转存过的文件会记住，重复解析不会再次转存（除非你把网盘里那份删了）

## 功能

- 识别 `mypikpak.com` / `mypikpak.net` 上的分享链接
- 自动算 captcha_sign；视频无需账号
- 可选登录（账号密码 / refresh_token），登录态缓存在扩展存储里，过期自动刷新
- 登录后自动转存非视频文件到自己网盘再下载
- 递归遍历子目录 + 自动翻页
- `target_path` 可指定单个文件，也可指定文件夹并递归展开全部嵌套文件
- 文件夹结果交给 Gopeed 原生文件树，可展开目录并勾选需要下载的文件
- 单文件 / 多文件 / 嵌套目录都保留原始结构
- 支持密码型分享（在扩展设置里填密码）
- 视频可选转码地址（清晰度低但更稳）

## 安装

### 通过 Gopeed Scheme（推荐）

打开下面这个链接（桌面端 Gopeed 已运行时）：

```
gopeed://install/https%3A%2F%2Fgithub.com%2FTeamBreakerr%2Fgopeed-extension-pikpak
```

或在 Gopeed 扩展页粘贴：`https://github.com/TeamBreakerr/gopeed-extension-pikpak`

### 本地开发模式

1. 在 Gopeed 扩展页连续点击安装按钮 5 次开启开发者模式
2. 点目录选择按钮，选中本仓库目录
3. 创建任务时贴 PikPak 分享链接即可

### 命令行调试

不进 Gopeed 也能跑：仓库根目录的 `cli.js` 用 Node 模拟 Gopeed 运行时，设置项走环境变量（`PIKPAK_USERNAME` / `PIKPAK_PASSWORD` / `PIKPAK_REFRESH_TOKEN` / `PIKPAK_SHARE_PWD` / `PIKPAK_TARGET_PATH` / `PIKPAK_BULK_RESTORE` / `PIKPAK_BATCH_SIZE` / `PIKPAK_DEBUG_INFO` 等），扩展存储落在仓库根目录的 `.storage.json`（可用 `PIKPAK_STORAGE_FILE` 自定义）。

```bash
PIKPAK_TARGET_PATH="DyDy_cos/update/26.09 patreon" node cli.js https://mypikpak.com/s/<share_id>
```

## 设置项

| 设置 | 默认 | 说明 |
|---|---|---|
| `api_host` | `api-drive.mypikpak.com` | PikPak API 域名。某些规则集（如 ChinaMax）会把 `.net` 误判为中国域名走直连，默认用 `.com` 命中率更高 |
| `user_host` | `user.mypikpak.com` | captcha/init 域名 |
| `use_transcoding` | 关闭 | 视频文件是否优先用转码地址 |
| `share_pwd` | 空 | 密码分享时填这里 |
| `target_path` | 空 | 可填写文件或文件夹路径；文件只解析单项，文件夹递归解析整个子树并在 Gopeed 文件树中多选；支持从分享根目录或链接所在目录开始，留空则扫描整个分享 |
| `username` / `password` | 空 | PikPak 账号密码。若登录被要求人机验证（扩展里无法完成），改用 `refresh_token` |
| `refresh_token` | 空 | 从网页端取得的 refresh_token，见下文 |

注意：Gopeed 设置项是明文保存的。

### `target_path` 示例

- 指定单个文件：`DyDy_cos/update/26.09 patreon/ALL IN_S.mp4`
- 指定文件夹：`DyDy_cos/update/26.09 patreon`

当 `target_path` 指向文件夹时，扩展会递归列出该文件夹以及所有嵌套子目录中的文件，并通过 `files[].path` 保留目录结构。Gopeed 会在解析结果中显示原生文件树，你可以展开文件夹、按文件勾选后再开始下载。扩展不支持解析阶段之后的远端懒加载，因此目标文件夹会在解析时完成枚举；大型目录可能需要更长时间。

### 为什么以前文件夹会"超时"，现在怎么解决的

Gopeed 前端对"创建任务"的解析请求有硬超时（v1.9.x 为 60 秒，v2.x 桌面版走 FFI 没有超时，v2.x Web 版 120 秒）。而 Gopeed v1.9.x 的 goja 运行时里 fetch 是同步阻塞的，**JS 层面的并发完全无效**——移动端 + 代理下每个请求都要一秒左右，请求数一多必然撞上 60 秒。

v1.5.0 提供两条路径：

**A. 逐文件直链（默认，`bulk_restore = 自动/关闭`）**
递归列出目标文件夹 → 逐文件取分享直链。文件不多时最快，不占用转存配额。自动模式会先串行取 2 个、再并发取 2 个来测速并判断当前运行时是否真并发，估算会超时才切到 B。

**B. 整目录直取（`bulk_restore = 始终开启`，或自动模式下预计超时时）**

1. 先在自己网盘里找这份目录：按分享内路径逐层找（如 `DyDy_cos/New packs/2.pack`）、再按目录名在根目录找；**找到就直接用，不会重复转存**；
2. 找不到才把整个文件夹转存一次到自己网盘；
3. 递归遍历网盘目录，列表响应自带每个文件的 `web_content_link`/`medias`，**直接用网盘列表构造下载结果**——不递归列分享目录、也不逐个取链接。

请求数只与目录层级有关，与文件数无关。实测 50 个文件从"约 60 秒（必超时）"降到 **约 5 秒**；已转存过的目录第二次解析几乎瞬时。

**C. 网盘列表没有直链时自动补取**：网盘目录列表里部分文件（尤其是视频）可能不含下载地址，此时扩展会对这些文件调用一次 `files/{id}?usage=FETCH` 补取；如果整批都取不到（例如转存任务还没处理完），会**自动回退到逐文件直链流程**，而不是直接报错。

**D. 分批解析（`batch_size`，慢网络/多文件推荐）**

Gopeed v1.9.x 前端只等 60 秒，而 PikPak 对每个文件都要单独发一次请求——**这是 PikPak API 的设计，插件无法合并**。36 个文件在手机 + 代理下约 1~2 秒/个，一次解析必然超时；此时开分批：

- 每次点「确认」只解析一批（推荐 10 个），批内请求数 = 10 + 少量固定请求，稳定落在 60 秒内；
- 成功后**自动记住进度**，任务名显示「批次 x/y」，再点一次「确认」就继续下一批；
- 整个文件夹走完后自动回到第一批（方便重新下载）；
- 每批单独缓存，同一批再次点击零请求秒开。

36 个文件 → 点 4 次确认即可全部加入 Gopeed 下载列表（每批一个任务，文件名不会冲突）。开启分批后，整目录加速会自动让位（两者互斥）。

**E. 与分享清单对齐补齐（v1.6.1）**

整目录加速是拿自己网盘的目录树当数据源，如果某些文件还没转存完成（PikPak 侧 `PHASE_TYPE_COMPLETE` 之前会被列表过滤），或者之前几次尝试把它们转存到了网盘别的位置，就会出现"解析出来缺几个"。v1.6.1 会在整目录加速之后**再列一次分享目录做对齐**：网盘里缺的文件，回到分享侧逐个取链接补上（缺失超过 15 个时放弃补齐，避免又把解析拖超时）。

日志形如：

```
[pikpak] reconcile: own drive has 29 of 36 files, resolving 7 from share
[pikpak] reconcile done: +7 / 7 files recovered, total 36
```

如果补齐后仍然少，说明这些文件在 PikPak 侧确实没有可用链接（审核未通过/仍在处理中），任何工具都拿不到。

**F. 列表过滤放宽（v1.6.3）**

PikPak 的目录接口默认按 `phase = PHASE_TYPE_COMPLETE` 过滤（AList 也是这么做的），会把"还在处理中"的文件从列表里藏掉——但这类文件往往**是能下载的**（PikPak 官方 App 就能下）。v1.6.3 改为先用宽松过滤（只排除回收站）列举，若接口拒绝则自动退回原过滤条件，每个解析过程只探测一次。

这就是"解析出来少几个文件"的主因：文件在分享/网盘里存在，只是被过滤条件挡住了。

**G. 结果缓存**：一次完整解析成功后缓存结果（含直链，有效期 20 分钟）。超时后重试会**零请求秒开**；只有全部文件都拿到直链才写入缓存，部分成功不缓存（否则重试会跳过缺失文件的转存）。

日志会打印决策依据，便于排查：

```
[pikpak] path walk done in 4 ms
[pikpak] bulk: found existing folder own_C          ← 命中已有目录，未重复转存
[pikpak] bulk: built 3 files from own drive
[pikpak] resolved 3 files in 15 ms
```

`bulk_restore` 设置：**自动**（默认，预计超时才切换）/ **始终开启**（顽固超时时选它，直接走最快路径）/ **关闭**。注意整目录加速会把该文件夹内所有文件（含视频）都转存到你网盘，占用空间和每日转存次数。

> **小技巧（重要）**：Gopeed 的解析超时只是"前端不再等结果"，**扩展在后台仍会继续跑完并写入结果缓存**。所以第一次如果报超时：
> 1. 先等 30~60 秒（让后台把剩余请求跑完）；
> 2. 再点一次「确认」——这一次会直接命中结果缓存，**零请求、秒出文件树**。
>
> 文件特别多（30+）且网络较慢时，这就是最稳定的用法：第一次负责"干活"，第二次负责"取结果"。

路径指向具体文件时仍保持单文件兼容行为。匿名模式下没有可用下载地址的文件仍会被跳过；如果目标文件夹内全部文件都没有下载地址，需要配置账号密码或 `refresh_token`，让扩展尝试转存后获取下载地址。

## 获取 refresh_token

1. 用浏览器**无痕窗口**打开 <https://mypikpak.com/drive> 并登录
2. F12 打开控制台，执行：
   ```js
   JSON.parse(localStorage.getItem("credentials_YUMx5nI8ZU8Ap8pm")).refresh_token
   ```
3. 把输出的字符串填进扩展设置的 `refresh_token`
4. **直接关闭无痕窗口，不要点退出登录**（退出会吊销这个 token）

refresh_token 每次刷新都会轮换，扩展会把新值存在自己的存储里；设置里的值只在你粘贴新 token 时生效。如果提示 refresh_token 已失效，重复上面的步骤即可。

## 网络要求

PikPak 对 IDC IP 段（DigitalOcean/AWS/各类云厂商）有屏蔽。如果直连返回 `share_status: PROHIBITED`，需要给 `mypikpak.com` 配住宅出口的代理（HK/JP/SG 一般可用）：

- **Surge / Quantumult X / Clash** 加分流：
  ```
  DOMAIN-SUFFIX,mypikpak.com,你的代理节点
  DOMAIN-SUFFIX,mypikpak.net,你的代理节点
  ```
- **Gopeed Docker** 容器需要把 HTTP 代理填到 Gopeed 全局设置里（容器流量不会自动走宿主机的系统代理），或在容器层面用 `HTTP_PROXY` 环境变量。

## 实现原理

参考 [alist 的 pikpak_share 驱动](https://github.com/alist-org/alist/tree/main/drivers/pikpak_share)，移植成纯 JS 在 Gopeed 的 goja 运行时里跑：

```
parseShareUrl(URL)
       │
       ▼
captcha/init  (POST user.mypikpak.com)
  body: { captcha_sign = md5_chain(client_id+ver+pkg+device_id+ts, salts...) }
       │  → captcha_token
       ▼
(可选) 登录  POST user.mypikpak.com/v1/auth/signin 或 /v1/auth/token
       │  → access_token（缓存在 gopeed.storage，之后请求带 Authorization）
       ▼
share/detail  (GET api-drive.mypikpak.com)
  query: { share_id, parent_id, pass_code_token, page_token, ... }
       │  → 递归子目录 + 翻页
       ▼
share/file_info (GET api-drive.mypikpak.com)
  query: { share_id, file_id, pass_code_token }
       │  → medias[].link（仅视频有）
       ▼
(登录时，对没有链接的文件) share/restore → tasks/{id} 轮询(500ms) → files/{own_id}?usage=FETCH
       │  同目录待转存文件 ≥ 5 时走快速路径：
       │  share/restore(整个文件夹) → files?parent_id={own_folder_id}（列表自带全部直链）
       │  → web_content_link
       ▼
ctx.res = { name, files: [{ name, path, size, req: { url, extra.header } }] }
```

## License

MIT

## 致谢

- [alist](https://github.com/alist-org/alist) — PikPak 分享 API 与签名算法
- [Gopeed](https://gopeed.com) — 优秀的开源下载器和扩展生态
- [Joseph Myers' MD5](https://www.myersdaily.org/joseph/javascript/md5-text.html) — goja 运行时下的 MD5 实现
