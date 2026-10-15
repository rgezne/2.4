/**
 * Gopeed 扩展：PikPak 分享下载
 *
 * 解析 https://mypikpak.com/s/{share_id}[/{parent_id}] 形式的分享链接；
 * 签名算法和 API 流程参考 Alist/OpenList 的 pikpak / pikpak_share 驱动。
 *
 * 匿名访问时 PikPak 只给视频返回播放链接（medias），web_content_link 恒为空，
 * 所以 zip 等非视频文件必须登录（账号密码或 refresh_token）后才能拿到下载地址。
 */

// ====== 常量：Web 端签名算法 ======
var WEB_CLIENT_ID = "YUMx5nI8ZU8Ap8pm";
var WEB_CLIENT_VERSION = "2.0.0";
var WEB_PACKAGE_NAME = "mypikpak.com";
var WEB_ALGORITHMS = [
  "C9qPpZLN8ucRTaTiUMWYS9cQvWOE",
  "+r6CQVxjzJV6LCV",
  "F",
  "pFJRC",
  "9WXYIDGrwTCz2OiVlgZa90qpECPD6olt",
  "/750aCr4lm/Sly/c",
  "RB+DT/gZCrbV",
  "",
  "CyLsf7hdkIRxRm215hl",
  "7xHvLi2tOYP0Y92b",
  "ZGTXXxu8E/MIWaEDB+Sm/",
  "1UI3",
  "E7fP5Pfijd+7K+t6Tg/NhuLq0eEUVChpJSkrKxpO",
  "ihtqpG6FMt65+Xk+tWUH2",
  "NhXXU9rg4XXdzo7u5o",
];
// 列表过滤条件：strict 只列"已完成"文件（AList 用的就是它），
// 但 PikPak 里"还在处理中"的文件往往也能拿到下载地址（官方 App 就能下），
// 所以优先用 loose（只排除回收站），被接口拒绝时自动退回 strict。
var FILE_FILTERS_LOOSE = '{"trashed":{"eq":false}}';
var FILE_FILTERS_STRICT =
  '{"phase":{"eq":"PHASE_TYPE_COMPLETE"},"trashed":{"eq":false}}';

var DEFAULT_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/117.0.0.0 Safari/537.36";

// ====== 工具函数 ======
/* Joseph Myers MD5 (CC0 / public domain), https://www.myersdaily.org/joseph/javascript/md5-text.html
 * 处理 UTF-8 输入。
 */
function md5Hex(str) {
  return md5Str(unescape(encodeURIComponent(str)));
}
function md5cycle(x, k) {
  var a = x[0], b = x[1], c = x[2], d = x[3];
  a = ff(a, b, c, d, k[0], 7, -680876936);
  d = ff(d, a, b, c, k[1], 12, -389564586);
  c = ff(c, d, a, b, k[2], 17, 606105819);
  b = ff(b, c, d, a, k[3], 22, -1044525330);
  a = ff(a, b, c, d, k[4], 7, -176418897);
  d = ff(d, a, b, c, k[5], 12, 1200080426);
  c = ff(c, d, a, b, k[6], 17, -1473231341);
  b = ff(b, c, d, a, k[7], 22, -45705983);
  a = ff(a, b, c, d, k[8], 7, 1770035416);
  d = ff(d, a, b, c, k[9], 12, -1958414417);
  c = ff(c, d, a, b, k[10], 17, -42063);
  b = ff(b, c, d, a, k[11], 22, -1990404162);
  a = ff(a, b, c, d, k[12], 7, 1804603682);
  d = ff(d, a, b, c, k[13], 12, -40341101);
  c = ff(c, d, a, b, k[14], 17, -1502002290);
  b = ff(b, c, d, a, k[15], 22, 1236535329);

  a = gg(a, b, c, d, k[1], 5, -165796510);
  d = gg(d, a, b, c, k[6], 9, -1069501632);
  c = gg(c, d, a, b, k[11], 14, 643717713);
  b = gg(b, c, d, a, k[0], 20, -373897302);
  a = gg(a, b, c, d, k[5], 5, -701558691);
  d = gg(d, a, b, c, k[10], 9, 38016083);
  c = gg(c, d, a, b, k[15], 14, -660478335);
  b = gg(b, c, d, a, k[4], 20, -405537848);
  a = gg(a, b, c, d, k[9], 5, 568446438);
  d = gg(d, a, b, c, k[14], 9, -1019803690);
  c = gg(c, d, a, b, k[3], 14, -187363961);
  b = gg(b, c, d, a, k[8], 20, 1163531501);
  a = gg(a, b, c, d, k[13], 5, -1444681467);
  d = gg(d, a, b, c, k[2], 9, -51403784);
  c = gg(c, d, a, b, k[7], 14, 1735328473);
  b = gg(b, c, d, a, k[12], 20, -1926607734);

  a = hh(a, b, c, d, k[5], 4, -378558);
  d = hh(d, a, b, c, k[8], 11, -2022574463);
  c = hh(c, d, a, b, k[11], 16, 1839030562);
  b = hh(b, c, d, a, k[14], 23, -35309556);
  a = hh(a, b, c, d, k[1], 4, -1530992060);
  d = hh(d, a, b, c, k[4], 11, 1272893353);
  c = hh(c, d, a, b, k[7], 16, -155497632);
  b = hh(b, c, d, a, k[10], 23, -1094730640);
  a = hh(a, b, c, d, k[13], 4, 681279174);
  d = hh(d, a, b, c, k[0], 11, -358537222);
  c = hh(c, d, a, b, k[3], 16, -722521979);
  b = hh(b, c, d, a, k[6], 23, 76029189);
  a = hh(a, b, c, d, k[9], 4, -640364487);
  d = hh(d, a, b, c, k[12], 11, -421815835);
  c = hh(c, d, a, b, k[15], 16, 530742520);
  b = hh(b, c, d, a, k[2], 23, -995338651);

  a = ii(a, b, c, d, k[0], 6, -198630844);
  d = ii(d, a, b, c, k[7], 10, 1126891415);
  c = ii(c, d, a, b, k[14], 15, -1416354905);
  b = ii(b, c, d, a, k[5], 21, -57434055);
  a = ii(a, b, c, d, k[12], 6, 1700485571);
  d = ii(d, a, b, c, k[3], 10, -1894986606);
  c = ii(c, d, a, b, k[10], 15, -1051523);
  b = ii(b, c, d, a, k[1], 21, -2054922799);
  a = ii(a, b, c, d, k[8], 6, 1873313359);
  d = ii(d, a, b, c, k[15], 10, -30611744);
  c = ii(c, d, a, b, k[6], 15, -1560198380);
  b = ii(b, c, d, a, k[13], 21, 1309151649);
  a = ii(a, b, c, d, k[4], 6, -145523070);
  d = ii(d, a, b, c, k[11], 10, -1120210379);
  c = ii(c, d, a, b, k[2], 15, 718787259);
  b = ii(b, c, d, a, k[9], 21, -343485551);

  x[0] = add32(a, x[0]);
  x[1] = add32(b, x[1]);
  x[2] = add32(c, x[2]);
  x[3] = add32(d, x[3]);
}
function cmn(q, a, b, x, s, t) {
  a = add32(add32(a, q), add32(x, t));
  return add32((a << s) | (a >>> (32 - s)), b);
}
function ff(a, b, c, d, x, s, t) { return cmn((b & c) | ((~b) & d), a, b, x, s, t); }
function gg(a, b, c, d, x, s, t) { return cmn((b & d) | (c & (~d)), a, b, x, s, t); }
function hh(a, b, c, d, x, s, t) { return cmn(b ^ c ^ d, a, b, x, s, t); }
function ii(a, b, c, d, x, s, t) { return cmn(c ^ (b | (~d)), a, b, x, s, t); }
function md51(s) {
  var n = s.length;
  var state = [1732584193, -271733879, -1732584194, 271733878];
  var i;
  for (i = 64; i <= s.length; i += 64) {
    md5cycle(state, md5blk(s.substring(i - 64, i)));
  }
  s = s.substring(i - 64);
  var tail = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  for (i = 0; i < s.length; i++)
    tail[i >> 2] |= s.charCodeAt(i) << ((i % 4) << 3);
  tail[i >> 2] |= 0x80 << ((i % 4) << 3);
  if (i > 55) {
    md5cycle(state, tail);
    for (i = 0; i < 16; i++) tail[i] = 0;
  }
  tail[14] = n * 8;
  md5cycle(state, tail);
  return state;
}
function md5blk(s) {
  var md5blks = [], i;
  for (i = 0; i < 64; i += 4) {
    md5blks[i >> 2] =
      s.charCodeAt(i) +
      (s.charCodeAt(i + 1) << 8) +
      (s.charCodeAt(i + 2) << 16) +
      (s.charCodeAt(i + 3) << 24);
  }
  return md5blks;
}
var hex_chr = "0123456789abcdef".split("");
function rhex(n) {
  var s = "", j = 0;
  for (; j < 4; j++)
    s += hex_chr[(n >> (j * 8 + 4)) & 0x0f] + hex_chr[(n >> (j * 8)) & 0x0f];
  return s;
}
function hex(x) {
  for (var i = 0; i < x.length; i++) x[i] = rhex(x[i]);
  return x.join("");
}
function md5Str(s) {
  return hex(md51(s));
}
function add32(a, b) {
  return (a + b) & 0xffffffff;
}

function genDeviceId() {
  // 32 位小写 hex，类似 uuid 去横线
  var hex = "0123456789abcdef";
  var s = "";
  for (var i = 0; i < 32; i++) {
    s += hex.charAt(Math.floor(Math.random() * 16));
  }
  return s;
}

// gopeed.storage 是按扩展隔离的持久化 KV（值为字符串），用来跨解析保存登录态
function storageGet(key) {
  try {
    var v = gopeed.storage ? gopeed.storage.get(key) : null;
    return v === null || v === undefined ? "" : String(v);
  } catch (e) {
    return "";
  }
}
function storageSet(key, value) {
  try {
    if (gopeed.storage) gopeed.storage.set(key, value ? String(value) : "");
  } catch (e) {
    // 存储不可用时退化为单次会话
  }
}

function captchaSign(deviceId, ts) {
  var s = WEB_CLIENT_ID + WEB_CLIENT_VERSION + WEB_PACKAGE_NAME + deviceId + ts;
  for (var i = 0; i < WEB_ALGORITHMS.length; i++) {
    s = md5Hex(s + WEB_ALGORITHMS[i]);
  }
  return "1." + s;
}

function buildQuery(params) {
  var parts = [];
  for (var k in params) {
    if (params[k] === undefined || params[k] === null || params[k] === "") continue;
    parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(params[k]));
  }
  return parts.join("&");
}

function parseShareUrl(rawUrl) {
  // 不依赖 URL 构造器（goja 默认未实现）
  var m = /^https?:\/\/[^/]+(\/[^?#]*)/i.exec(rawUrl);
  if (!m) {
    throw new Error("无法解析链接：" + rawUrl);
  }
  var path = m[1];
  var parts = path.split("/").filter(function (x) {
    return x !== "";
  });
  if (parts.length < 2 || parts[0] !== "s") {
    throw new Error("不是合法的 PikPak 分享链接：" + rawUrl);
  }
  // URL 第二段是 parent_id（要直接打开的子目录），不是 pass_code_token；
  // pass_code_token 仅当分享有密码时通过 /drive/v1/share 用密码换取。
  return {
    shareId: parts[1],
    initialParentId: parts.length >= 3 ? parts[2] : "",
  };
}

// ====== HTTP 客户端封装 ======
function httpJson(opts) {
  // opts: { url, method, headers, body }
  return fetch(opts.url, {
    method: opts.method || "GET",
    headers: opts.headers || {},
    body: opts.body || undefined,
  }).then(function (resp) {
    return resp.text().then(function (text) {
      var data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch (e) {
        // 非 JSON
      }
      return { status: resp.status, ok: resp.ok, text: text, data: data };
    });
  });
}

function PikPakClient(settings) {
  this.apiHost = (settings && settings.api_host) || "api-drive.mypikpak.net";
  this.userHost = (settings && settings.user_host) || "user.mypikpak.net";
  this.useTrans = settings && settings.use_transcoding === "1";
  this.sharePwd = (settings && settings.share_pwd) || "";
  this.username = String((settings && settings.username) || "").trim();
  this.password = String((settings && settings.password) || "");
  // 从浏览器控制台复制时常带上两侧引号
  this.refreshTokenSetting = String((settings && settings.refresh_token) || "")
    .trim()
    .replace(/^['"]+|['"]+$/g, "");
  // 登录态和设备绑定，设备 ID 必须持久化，否则每次都像新设备登录、容易触发验证
  this.deviceId = storageGet("device_id");
  if (!this.deviceId) {
    this.deviceId = genDeviceId();
    storageSet("device_id", this.deviceId);
  }
  this.captchaToken = "";
  this.looseFilterOk = null; // 宽松列表过滤是否可用（null=未探测）
  this.passCodeToken = "";
  this.accessToken = "";
  this.refreshToken = "";
  this.userId = "";
}

PikPakClient.prototype._headers = function () {
  var h = {
    "User-Agent": DEFAULT_UA,
    "Content-Type": "application/json",
    "X-Client-ID": WEB_CLIENT_ID,
    "X-Device-ID": this.deviceId,
    "X-Captcha-Token": this.captchaToken || "",
  };
  if (this.accessToken) {
    h.Authorization = "Bearer " + this.accessToken;
  }
  return h;
};

// extraMeta：登录前用 {email|phone_number|username}，登录后默认带 user_id
PikPakClient.prototype.refreshCaptcha = function (action, extraMeta) {
  var ts = String(new Date().getTime());
  var sign = captchaSign(this.deviceId, ts);
  var meta = {
    captcha_sign: sign,
    client_version: WEB_CLIENT_VERSION,
    package_name: WEB_PACKAGE_NAME,
    timestamp: ts,
  };
  if (extraMeta) {
    for (var k in extraMeta) meta[k] = extraMeta[k];
  } else {
    meta.user_id = this.userId || "";
  }
  var body = {
    action: action,
    captcha_token: this.captchaToken || "",
    client_id: WEB_CLIENT_ID,
    device_id: this.deviceId,
    meta: meta,
    redirect_uri: "xlaccsdk01://xbase.cloud/callback?state=harbor",
  };
  var self = this;
  return httpJson({
    url:
      "https://" +
      this.userHost +
      "/v1/shield/captcha/init?client_id=" +
      WEB_CLIENT_ID,
    method: "POST",
    headers: this._headers(),
    body: JSON.stringify(body),
  }).then(function (r) {
    if (!r.ok || !r.data || !r.data.captcha_token) {
      throw new Error(
        "captcha/init 失败：" +
          r.status +
          " " +
          (r.data && r.data.error_description ? r.data.error_description : r.text)
      );
    }
    self.captchaToken = r.data.captcha_token;
    return r.data;
  });
};

// ====== 登录态：账号密码 / refresh_token，token 存在 gopeed.storage 里复用 ======
PikPakClient.prototype.hasCredentials = function () {
  return !!(this.refreshTokenSetting || (this.username && this.password));
};

// Web 端是公开客户端：带浏览器 UA 时不能传 client_secret，否则报 error_code 7
PikPakClient.prototype._authPost = function (path, body) {
  return httpJson({
    url: "https://" + this.userHost + path + "?client_id=" + WEB_CLIENT_ID,
    method: "POST",
    headers: {
      "User-Agent": DEFAULT_UA,
      "Content-Type": "application/json",
      "X-Client-ID": WEB_CLIENT_ID,
      "X-Device-ID": this.deviceId,
    },
    body: JSON.stringify(body),
  });
};

PikPakClient.prototype._saveToken = function (data) {
  var expiresIn = parseInt(data.expires_in, 10) || 7200;
  this.accessToken = data.access_token;
  this.refreshToken = data.refresh_token;
  this.userId = data.sub || "";
  // 匿名阶段拿的 captcha_token 不带 user_id，登录后重新取
  this.captchaToken = "";
  storageSet("access_token", this.accessToken);
  storageSet("refresh_token", this.refreshToken);
  storageSet("user_id", this.userId);
  // 提前 5 分钟视为过期
  storageSet("expires_at", new Date().getTime() + (expiresIn - 300) * 1000);
  storageSet("account", this.username);
};

PikPakClient.prototype._clearToken = function () {
  this.accessToken = "";
  this.refreshToken = "";
  this.userId = "";
  storageSet("access_token", "");
  storageSet("refresh_token", "");
  storageSet("user_id", "");
  storageSet("expires_at", "");
};

function authErrorText(r) {
  if (r.data && (r.data.error_description || r.data.error)) {
    return (
      (r.data.error_code ? r.data.error_code + " " : "") +
      (r.data.error_description || r.data.error)
    );
  }
  return r.status + " " + r.text;
}

PikPakClient.prototype.signin = function () {
  var self = this;
  if (!this.username || !this.password) {
    return Promise.reject(
      new Error(
        "refresh_token 已失效，请在扩展设置中重新填写 refresh_token，或填写账号密码"
      )
    );
  }
  var meta = {};
  if (/\w+([-+.]\w+)*@\w+([-.]\w+)*\.\w+([-.]\w+)*/.test(this.username)) {
    meta.email = this.username;
  } else if (this.username.length >= 11 && this.username.length <= 18) {
    meta.phone_number = this.username;
  } else {
    meta.username = this.username;
  }
  this._clearToken();
  this.captchaToken = "";
  return this.refreshCaptcha("POST:/v1/auth/signin", meta)
    .then(function (captcha) {
      if (captcha.url) {
        // 需要滑块等人机验证，扩展里没法完成
        throw new Error(
          "登录要求人机验证，请改用 refresh_token（见扩展 README）"
        );
      }
      return self._authPost("/v1/auth/signin", {
        captcha_token: self.captchaToken,
        client_id: WEB_CLIENT_ID,
        username: self.username,
        password: self.password,
      });
    })
    .then(function (r) {
      if (!r.data || !r.data.access_token || !r.data.refresh_token) {
        throw new Error("登录失败：" + authErrorText(r));
      }
      self._saveToken(r.data);
      gopeed.logger.info("[pikpak] signed in, user_id=" + self.userId);
    });
};

PikPakClient.prototype.refreshAccessToken = function () {
  var self = this;
  return this._authPost("/v1/auth/token", {
    client_id: WEB_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: this.refreshToken,
  }).then(function (r) {
    if (r.data && r.data.access_token && r.data.refresh_token) {
      self._saveToken(r.data);
      return;
    }
    gopeed.logger.warn("[pikpak] refresh_token 刷新失败：" + authErrorText(r));
    if (!self.username || !self.password) {
      throw new Error(
        "refresh_token 无效（" + authErrorText(r) + "），请重新获取后填写"
      );
    }
    return self.signin();
  });
};

// 有凭据时确保持有可用的 access_token；返回是否处于登录状态
PikPakClient.prototype.ensureLogin = function () {
  if (!this.hasCredentials()) {
    return Promise.resolve(false);
  }
  // 设置里粘贴了新的 refresh_token：以它为准（刷新后会轮换，新值存在 storage 里）
  if (
    this.refreshTokenSetting &&
    this.refreshTokenSetting !== storageGet("seed_refresh_token")
  ) {
    var seed = this.refreshTokenSetting;
    this._clearToken();
    this.refreshToken = seed;
    // 成功后才记下，失败时下次仍会重试这个值并给出真实原因
    return this.refreshAccessToken().then(function () {
      storageSet("seed_refresh_token", seed);
      return true;
    });
  }
  // 换了账号：旧 token 作废
  if (storageGet("account") !== this.username) {
    this._clearToken();
  } else {
    this.accessToken = storageGet("access_token");
    this.refreshToken = storageGet("refresh_token");
    this.userId = storageGet("user_id");
  }
  var expiresAt = parseInt(storageGet("expires_at"), 10) || 0;
  var p;
  if (this.accessToken && new Date().getTime() < expiresAt) {
    p = Promise.resolve();
  } else if (this.refreshToken) {
    p = this.refreshAccessToken();
  } else {
    p = this.signin();
  }
  return p.then(function () {
    return true;
  });
};

// 验证码失效 / access_token 过期时自动刷新后重试（最多重试 2 次）
PikPakClient.prototype._request = function (path, method, query, body) {
  var self = this;
  var url = "https://" + this.apiHost + path;
  if (query) {
    var q = buildQuery(query);
    if (q) url += (url.indexOf("?") >= 0 ? "&" : "?") + q;
  }
  var action = method.toUpperCase() + ":" + path;
  var attempt = 0;
  var doCall = function () {
    attempt++;
    var ensure = self.captchaToken
      ? Promise.resolve()
      : self.refreshCaptcha(action);
    return ensure
      .then(function () {
        return httpJson({
          url: url,
          method: method,
          headers: self._headers(),
          body: body ? JSON.stringify(body) : undefined,
        });
      })
      .then(function (r) {
        var code = r.data && r.data.error_code;
        if (attempt > 2) return r;
        if (code === 9) {
          // 验证码失效
          return self.refreshCaptcha(action).then(doCall);
        }
        if ((code === 16 || code === 4121 || code === 4122) && self.refreshToken) {
          // access_token 过期
          return self.refreshAccessToken().then(doCall);
        }
        return r;
      });
  };
  return doCall()
    .then(function (r) {
      if (!r.data) {
        throw new Error("接口返回非 JSON：" + r.status + " " + r.text);
      }
      if (r.data.error_code) {
        throw new Error(
          "接口错误 " +
            r.data.error_code +
            "：" +
            (r.data.error_description || r.data.error || r.text)
        );
      }
      return r.data;
    });
};

PikPakClient.prototype.getShareInfo = function (shareId, passCode) {
  // 用于密码型分享，换取 pass_code_token
  return this._request("/drive/v1/share", "GET", {
    share_id: shareId,
    pass_code: passCode || "",
    thumbnail_size: "SIZE_LARGE",
    limit: "100",
  });
};

// 列表请求：分享页能看到的文件、插件却拿不到，多出在列举参数上。
// 依次尝试两套参数并合并结果（按文件 id 去重）：
//   ① 不带 with_audit、不带 filters —— 网页版分享页大概率就是这么请求的
//   ② 不带 filters、带 with_audit（原有行为）
// 两套都失败才退回 AList 同款的 strict 条件。
PikPakClient.prototype._listRequest = function (path, baseQuery) {
  var self = this;

  var hasToken = !!baseQuery.pass_code_token;
  function call(variant) {
    var q = {};
    for (var k in baseQuery) q[k] = baseQuery[k];
    if (variant.withAudit) q.with_audit = "true";
    else delete q.with_audit;
    if (variant.filters) q.filters = variant.filters;
    else delete q.filters;
    if (variant.noToken || !hasToken) delete q.pass_code_token;
    return self._request(path, "GET", q);
  }

  var merged = null;
  var nextToken = "";
  var anyOk = false;

  function absorb(resp) {
    var files = resp.files || [];
    if (!merged) {
      merged = {
        files: files.slice(),
        next_page_token: resp.next_page_token || "",
      };
    } else {
      var seen = {};
      for (var a = 0; a < merged.files.length; a++) {
        seen[merged.files[a].id] = true;
      }
      for (var b = 0; b < files.length; b++) {
        if (files[b].id && !seen[files[b].id]) merged.files.push(files[b]);
      }
    }
    if (!nextToken && resp.next_page_token) nextToken = resp.next_page_token;
  }

  function variantTag(variant) {
    return (
      (variant.noToken ? "无token" : "带token") +
      (variant.withAudit ? "+audit" : "") +
      (variant.filters ? "+filter" : "")
    );
  }

  function recordDiag(tag, n) {
    if (!self.listDiag) self.listDiag = [];
    self.listDiag.push(tag + "=" + n);
  }

  function tryVariant(variant) {
    return call(variant).then(
      function (resp) {
        anyOk = true;
        recordDiag(variantTag(variant), (resp.files || []).length);
        absorb(resp);
      },
      function (e) {
        recordDiag(variantTag(variant), "×");
        gopeed.logger.warn(
          "[pikpak] listing variant failed:",
          (e && e.message) || e
        );
      }
    );
  }

  // 关键：分页 token 不能被"无 token"分支污染。
  // 当带 token 时，优先用"带 token + 不带过滤"作为主分页流；
  // 无 token 只作为补充/兜底，避免出现"总数被截断"。
  var plan = hasToken
    ? [
        { filters: null, withAudit: false },
        { filters: null, withAudit: true },
        { filters: FILE_FILTERS_LOOSE, withAudit: true },
        { filters: null, withAudit: false, noToken: true },
      ]
    : [
        { filters: null, withAudit: false },
        { filters: FILE_FILTERS_LOOSE, withAudit: true },
      ];

  var fallback = [
    { filters: null, withAudit: true },
    { filters: FILE_FILTERS_STRICT, withAudit: true },
  ];

  function run(list) {
    return list.reduce(function (p, v) {
      return p.then(function () {
        return tryVariant(v);
      });
    }, Promise.resolve());
  }

  return run(plan)
    .then(function () {
      if (anyOk) return null;
      return run(fallback);
    })
    .then(function () {
      if (!anyOk || !merged) {
        throw new Error("列表接口失败（多种列举参数均不可用）");
      }
      merged.files = merged.files || [];
      if (nextToken) merged.next_page_token = nextToken;
      if (merged.files.length) {
        gopeed.logger.info(
          "[pikpak] listed",
          merged.files.length,
          "entries under",
          baseQuery.parent_id === undefined ? "?" : baseQuery.parent_id || "(root)"
        );
      }
      return merged;
    });
};

PikPakClient.prototype.getShareDetail = function (
  shareId,
  parentId,
  pageToken
) {
  return this._listRequest("/drive/v1/share/detail", {
    share_id: shareId,
    parent_id: parentId || "",
    pass_code_token: this.passCodeToken || "",
    thumbnail_size: "SIZE_LARGE",
    with_audit: "true",
    limit: "100",
    page_token: pageToken || "",
  });
};

PikPakClient.prototype.getFileInfo = function (shareId, fileId, noToken) {
  var q = {
    share_id: shareId,
    file_id: fileId,
    pass_code_token: this.passCodeToken || "",
  };
  if (noToken) delete q.pass_code_token;
  return this._request("/drive/v1/share/file_info", "GET", q);
};

// ====== 转存：PikPak 对非视频文件只提供"存到自己网盘再下载"（网页端的下载按钮也只是引导转存） ======
function sleep(ms) {
  return new Promise(function (resolve) {
    setTimeout(resolve, ms);
  });
}

// trace_file_ids 是 JSON：{分享内文件 ID: 自己网盘里的文件 ID}
function parseTraceIds(s) {
  try {
    return (s && JSON.parse(s)) || {};
  } catch (e) {
    return {};
  }
}

// 有界并发地逐项执行异步任务，单项失败不影响其他项（allSettled 语义）。
// 说明：Gopeed v1.9.x 的 goja 运行时里 XHR 是同步阻塞的，这里的"并发"会退化成串行；
// 但 v2.x 的 webview 运行时里 fetch 是真异步，能拿到真实的并发收益。
// 并发上限保守取 4，避免触发 PikPak 风控。
function mapLimit(items, limit, fn) {
  var results = new Array(items.length);
  var next = 0;
  limit = Math.max(1, Math.min(limit || 1, items.length || 1));
  function worker() {
    if (next >= items.length) return Promise.resolve();
    var i = next++;
    return Promise.resolve()
      .then(function () {
        return fn(items[i], i);
      })
      .then(
        function (v) {
          results[i] = { ok: true, v: v };
        },
        function (e) {
          results[i] = { ok: false, e: e };
        }
      )
      .then(worker);
  }
  var workers = [];
  for (var w = 0; w < limit; w++) workers.push(worker());
  return Promise.all(workers).then(function () {
    return results;
  });
}

PikPakClient.prototype.waitTask = function (taskId) {
  var self = this;
  var tries = 0;
  function poll() {
    tries++;
    // 500ms 轮询：Gopeed 前端对整个解析有 60s(v1.9.x)/120s(v2.x) 超时，
    // 尽量缩短等待转存任务完成的时间
    return sleep(500)
      .then(function () {
        return self._request("/drive/v1/tasks/" + taskId, "GET");
      })
      .then(function (task) {
        var params = task.params || {};
        if (task.phase === "PHASE_TYPE_ERROR" || params.error_detail) {
          throw new Error(
            "转存失败：" + (task.message || params.error_detail || task.phase)
          );
        }
        if (task.phase === "PHASE_TYPE_COMPLETE") {
          return params.trace_file_ids;
        }
        if (tries >= 100) {
          throw new Error("转存超时（任务 " + taskId + "）");
        }
        return poll();
      });
  }
  return poll();
};

// 返回 {分享内文件 ID: 自己网盘里的文件 ID}；ancestorIds 是文件所在目录在分享内的路径
PikPakClient.prototype.restore = function (shareId, fileIds, ancestorIds) {
  var self = this;
  var body = {
    share_id: shareId,
    pass_code_token: this.passCodeToken || "",
    file_ids: fileIds,
    params: { trace_file_ids: fileIds.join(",") },
  };
  if (ancestorIds && ancestorIds.length) {
    body.ancestor_ids = ancestorIds;
  }
  return this._request("/drive/v1/share/restore", "POST", null, body).then(
    function (resp) {
      if (resp.restore_status === "RESTORE_COMPLETE") {
        return parseTraceIds(resp.params && resp.params.trace_file_ids);
      }
      if (!resp.restore_task_id) {
        throw new Error("转存失败：" + JSON.stringify(resp).slice(0, 200));
      }
      return self.waitTask(resp.restore_task_id).then(parseTraceIds);
    }
  );
};

PikPakClient.prototype.getOwnFile = function (fileId) {
  return this._request("/drive/v1/files/" + fileId, "GET", {
    _magic: "2021",
    usage: "FETCH",
    thumbnail_size: "SIZE_LARGE",
  });
};

// 列出自己网盘某目录下所有文件（自动翻页）。
// 与 AList pikpak 驱动一致：列表响应里每个文件自带 web_content_link / medias，
// 一次（或几页）请求即可拿到整个目录的下载地址，无需逐文件调 files/{id}。
PikPakClient.prototype.listOwnFolder = function (parentId, pageToken) {
  var self = this;
  return self
    ._listRequest("/drive/v1/files", {
      parent_id: parentId,
      thumbnail_size: "SIZE_LARGE",
      with_audit: "true",
      limit: "100",
      page_token: pageToken || "",
    })
    .then(function (resp) {
      var files = resp.files || [];
      if (resp.next_page_token) {
        return self
          .listOwnFolder(parentId, resp.next_page_token)
          .then(function (more) {
            return files.concat(more);
          });
      }
      return files;
    });
};

// 递归列自己网盘的目录树，返回 [{id, name, rel, dirRel, size, url}]
// rel 是相对 rootId 的完整路径，dirRel 是所在目录（相对 rootId）。
// 子目录用有界并发展开：v2.x 真并发下更快，v1.9.x 下退化串行但不影响正确性。
PikPakClient.prototype.listOwnTree = function (rootId, concurrency) {
  var self = this;
  var out = [];
  var visited = 0;
  var truncated = false;
  function walk(folderId, prefix) {
    visited++;
    // 防御：异常大的目录树（>500 个目录）不再深挖，避免请求量失控
    if (visited > 500) {
      truncated = true;
      return Promise.resolve();
    }
    return self.listOwnFolder(folderId).then(function (files) {
      var dirs = [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        if (f.id === folderId) continue; // 防御：目录列表里意外出现自身
        var rel = prefix ? prefix + "/" + f.name : f.name;
        if (f.kind === "drive#folder") {
          dirs.push({ id: f.id, rel: rel });
        } else {
          out.push({
            id: f.id,
            name: f.name,
            rel: rel,
            dirRel: prefix,
            size: parseInt(f.size, 10) || 0,
            url: pickDownloadUrl(f, self.useTrans),
          });
        }
      }
      return mapLimit(dirs, concurrency || 3, function (d) {
        return walk(d.id, d.rel);
      });
    });
  }
  return walk(rootId, "").then(function () {
    if (truncated) {
      gopeed.logger.warn(
        "[pikpak] own tree too large, truncated at",
        visited,
        "folders"
      );
    }
    return out;
  });
};

// 在自己网盘根目录下按名字找已存在的同名文件夹（用于跳过重复转存）
PikPakClient.prototype.findOwnFolderByName = function (name) {
  var self = this;
  return self.listOwnFolder("").then(function (entries) {
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].kind === "drive#folder" && entries[i].name === name) {
        return entries[i].id;
      }
    }
    return "";
  });
};

// 按分享内的相对路径在自己网盘里逐层查找同名目录
// （转存有时会保留分享里的目录层级，例如 DyDy_cos/New packs/2.pack）
PikPakClient.prototype.findOwnFolderByPath = function (parts) {
  var self = this;
  var current = "";
  function step(i) {
    if (i >= parts.length) return Promise.resolve(current);
    return self.listOwnFolder(current).then(function (entries) {
      for (var k = 0; k < entries.length; k++) {
        if (entries[k].kind === "drive#folder" && entries[k].name === parts[i]) {
          current = entries[k].id;
          return step(i + 1);
        }
      }
      return "";
    });
  }
  return step(0);
};

// 转存过的文件记在 storage 里，重复解析同一分享时直接复用，不再占用每日转存次数
function restoreCacheKey(shareId, fileId) {
  return "restored:" + shareId + ":" + fileId;
}

// ====== 解析结果缓存：让"超时后重试"变成秒开 ======
// 移动端 + 代理下，逐个请求累计很容易撞上 Gopeed 的 60s 解析超时。
// 一旦完整解析成功就缓存结果（含直链），重试时直接命中、零请求返回。
// PikPak 直链有效期通常以小时计，这里保守取 20 分钟。
var RESULT_CACHE_TTL_MS = 20 * 60 * 1000;
// 插件版本：与 manifest.json 的 version 保持一致。
// 缓存里记录写入时的版本，升级插件后旧缓存自动失效（避免沿用旧逻辑的结果）
var PLUGIN_VERSION = "1.7.1";

function resultCacheKey(shareId, targetPath) {
  return "result:" + shareId + ":" + String(targetPath || "");
}

function readResultCache(shareId, targetPath) {
  var raw = storageGet(resultCacheKey(shareId, targetPath));
  if (!raw) return null;
  try {
    var obj = JSON.parse(raw);
    if (!obj || !obj.ts || !obj.files || !obj.files.length) return null;
    // 根分享曾经在移动端/弱网下可能缓存到单文件结果；根分享的单文件缓存一律丢弃，强制重新列目录。
    if (!String(targetPath || "").trim() && obj.files.length < 2) return null;
    if (new Date().getTime() - obj.ts > RESULT_CACHE_TTL_MS) return null;
    if (obj.v && obj.v !== PLUGIN_VERSION) return null; // 插件升级后不复用旧结果
    return { files: obj.files, name: obj.name || "" };
  } catch (e) {
    return null;
  }
}

function writeResultCache(shareId, targetPath, files, name) {
  try {
    var out = [];
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      // 传进来的可能是 {name,path,size,url} 或已构造好的 {name,path,size,req:{url}}
      var url = f.url || (f.req && f.req.url) || "";
      if (!url) continue;
      out.push({
        name: f.name,
        path: f.path || "",
        size: f.size || 0,
        url: url,
      });
    }
    if (!out.length) return;
    storageSet(
      resultCacheKey(shareId, targetPath),
      JSON.stringify({
        ts: new Date().getTime(),
        v: PLUGIN_VERSION,
        files: out,
        name: name || "",
      })
    );
  } catch (e) {
    // 缓存失败不影响主流程
  }
}

// ====== 整目录直取（强制加速模式）：不做探测、不递归列分享目录 ======
// 流程：找到自己网盘里已存在的同名文件夹（或转存一次）→ 递归列网盘目录 →
// 直接用网盘列表构造下载结果（列表自带 web_content_link / medias）。
// 请求数与文件数无关，只与目录层级有关，是移动端唯一能在 60s 内跑完的方式。
function resolveFolderByBulk(client, shareId, folder) {
  var ancestors = folder.ancestors || [];
  var folderAncestors = ancestors.slice(0, -1);
  var mapKey = "bulkfolder:" + shareId + ":" + folder.id;
  var ownFolderId = storageGet(mapKey);
  var p;
  if (ownFolderId) {
    gopeed.logger.info("[pikpak] bulk: reuse restored folder", ownFolderId);
    p = Promise.resolve(ownFolderId);
  } else {
    // 先找自己网盘里是否已有这份目录：先按分享内路径逐层找（转存可能保留层级），
    // 再按目录名在根目录找（转存到根目录的情况），都没有才真正转存
    var pathParts = String(folder.path || "")
      .split("/")
      .filter(function (x) {
        return x !== "";
      });
    p = client
      .findOwnFolderByPath(pathParts)
      .catch(function () {
        return "";
      })
      .then(function (byPath) {
        if (byPath) return byPath;
        return client.findOwnFolderByName(folder.name).catch(function () {
          return "";
        });
      })
      .then(function (foundId) {
        if (foundId) {
          gopeed.logger.info("[pikpak] bulk: found existing folder", foundId);
          storageSet(mapKey, foundId);
          return foundId;
        }
        gopeed.logger.info("[pikpak] bulk: restoring whole folder", folder.id);
        return client
          .restore(shareId, [folder.id], folderAncestors)
          .then(function (trace) {
            var id = trace[folder.id];
            if (!id) throw new Error("整文件夹转存未返回网盘目录 ID");
            storageSet(mapKey, id);
            return id;
          });
      })
      .catch(function (e) {
        // 缓存的目录可能已失效，清掉映射让下次重新走转存
        storageSet(mapKey, "");
        throw e;
      });
  }
  return p.then(function (id) {
    return client.listOwnTree(id, 3).then(function (entries) {
      var base = folder.path || "";
      // 网盘列表里的直链可能缺失（视频等有时只给 medias，甚至都没有），
      // 对这类文件再用 files/{id}?usage=FETCH 补一次，避免整批文件被误判为"无直链"
      var missing = [];
      for (var k = 0; k < entries.length; k++) {
        if (!entries[k].url) missing.push(entries[k]);
      }
      var filled = Promise.resolve();
      if (missing.length) {
        gopeed.logger.info(
          "[pikpak] bulk:",
          missing.length,
          "entries without link, fetching details"
        );
        filled = mapLimit(missing, 4, function (e) {
          return client.getOwnFile(e.id).then(function (fi) {
            e.url = fi && !fi.trashed ? pickDownloadUrl(fi, client.useTrans) : "";
          });
        });
      }
      return filled.then(function () {
        var files = [];
        var noUrl = 0;
        for (var i = 0; i < entries.length; i++) {
          var e = entries[i];
          if (!e.url) {
            noUrl++;
            continue;
          }
          files.push({
            name: e.name,
            path: base
              ? e.dirRel
                ? base + "/" + e.dirRel
                : base
              : e.dirRel || "",
            size: e.size,
            url: e.url,
          });
        }
        gopeed.logger.info(
          "[pikpak] bulk: built",
          files.length,
          "files from own drive (",
          entries.length,
          "entries,",
          noUrl,
          "without link)"
        );
        // 与分享清单对齐，补齐网盘里缺的文件
        return reconcileWithShare(client, shareId, folder, files);
        // 一个都没拿到：交给调用方回退（外层会转成逐文件直链流程）
        if (!files.length) {
          gopeed.logger.warn(
            "[pikpak] bulk: 网盘目录共",
            entries.length,
            "项，均无下载地址（转存可能还在处理中）"
          );
        }
        return files;
      });
    });
  });
}


// 用分享内的文件清单对网盘结果做一次对齐补齐：
// 网盘目录树里缺失的文件（转存还没完成、或转存到了别处），改从分享侧取链接补上。
// 缺失数量过大时放弃补齐（避免又把解析拖超时）。
var RECONCILE_MAX_MISSING = 15;

function reconcileWithShare(client, shareId, folder, bulkFiles) {
  return listAllFiles(
    client,
    shareId,
    folder.id,
    folder.path,
    folder.ancestors
  )
    .then(function (shareFiles) {
      if (!shareFiles.length) return bulkFiles;
      // 记下分享侧应有文件数，便于在结果名里显示完整度（如 28/36）
      bulkFiles.__expected = shareFiles.length;
      var have = {};
      for (var i = 0; i < bulkFiles.length; i++) {
        have[(bulkFiles[i].path || "") + "/" + bulkFiles[i].name] = true;
      }
      var missing = [];
      for (var j = 0; j < shareFiles.length; j++) {
        var sf = shareFiles[j];
        if (!have[(sf.path || "") + "/" + sf.name]) missing.push(sf);
      }
      if (!missing.length) {
        gopeed.logger.info("[pikpak] reconcile: nothing missing");
        return bulkFiles;
      }
      if (missing.length > RECONCILE_MAX_MISSING) {
        gopeed.logger.warn(
          "[pikpak] reconcile skipped:",
          missing.length,
          "files missing from own drive (too many to fix without timeout)"
        );
        return bulkFiles;
      }
      gopeed.logger.info(
        "[pikpak] reconcile: own drive has",
        bulkFiles.length,
        "of",
        shareFiles.length,
        "files, resolving",
        missing.length,
        "from share"
      );
      // 逐个从分享侧取链接（视频有播放直链；其余登录后转存）
      return mapLimit(missing, 4, function (sf) {
        return fetchShareInfo(client, shareId, sf);
      })
        .then(function () {
          var stillNoUrl = missing.filter(function (sf) {
            return !sf.url;
          });
          if (!stillNoUrl.length || !client.hasCredentials()) return;
          // 转存失败不能影响已经拿到的部分（否则补齐白做，且看不到完整度）
          return resolveByRestore(client, shareId, stillNoUrl).catch(function (e) {
            client.restoreError = (e && e.message) || String(e);
            gopeed.logger.warn(
              "[pikpak] reconcile restore failed:",
              client.restoreError
            );
          });
        })
        .then(function () {
          var out = bulkFiles.slice();
          out.__expected = shareFiles.length;
          var added = 0;
          for (var k = 0; k < missing.length; k++) {
            if (missing[k].url) {
              out.push(missing[k]);
              added++;
            }
          }
          gopeed.logger.info(
            "[pikpak] reconcile done: +" + added,
            "/",
            missing.length,
            "files recovered, total",
            out.length
          );
          return out;
        });
    })
    .catch(function (e) {
      gopeed.logger.warn(
        "[pikpak] reconcile failed:",
        (e && e.message) || e,
        "- 用网盘侧结果返回"
      );
      return bulkFiles;
    });
}

// 一组待转存文件数达到该值、且同属分享内同一个文件夹时，
// 直接转存整个文件夹再一次性列表拿全部直链：
// 把 O(N) 次串行请求（N 次 share/file_info + N 次 files/{id}）降为常数次，
// 避免 Gopeed 前端 60s(v1.9.x)/120s(v2.x) 的解析超时。
// 代价：会把该文件夹里的其他文件（如视频）一并转存，占用转存配额。
var FOLDER_FAST_PATH_MIN = 5;

// 第 1 步：查缓存，已转存过的文件直接取下载地址（并发，单项失败不影响整体）
function lookupCached(client, shareId, items) {
  return mapLimit(items, 4, function (item) {
    var ownId = storageGet(restoreCacheKey(shareId, item.id));
    if (!ownId) return;
    return client.getOwnFile(ownId).then(function (fi) {
      item.url = fi.trashed ? "" : pickDownloadUrl(fi, client.useTrans);
    });
  }).then(function () {
    return items.filter(function (it) {
      return !it.url;
    });
  });
}

// 逐文件转存（同目录一次 restore 请求），转存后并发取各自下载地址
function restoreGroupPerFile(client, shareId, group) {
  var ids = group.map(function (it) {
    return it.id;
  });
  gopeed.logger.info("[pikpak] restoring", ids.length, "files to own drive");
  return client.restore(shareId, ids, group[0].ancestors).then(function (trace) {
    return mapLimit(group, 4, function (item) {
      var ownId = trace[item.id];
      if (!ownId) return;
      storageSet(restoreCacheKey(shareId, item.id), ownId);
      return client.getOwnFile(ownId).then(function (fi) {
        item.url = pickDownloadUrl(fi, client.useTrans);
      });
    });
  });
}

// 快速路径：整个文件夹一次转存，然后列一次自己网盘目录拿到全部直链。
// 失败（API 不支持文件夹转存、任务失败等）时返回 false，由调用方兜底。
function restoreFolderFastPath(client, shareId, group) {
  var ancestors = group[0].ancestors || [];
  if (!ancestors.length) return Promise.resolve(false);
  var folderId = ancestors[ancestors.length - 1];
  var folderAncestors = ancestors.slice(0, -1);
  gopeed.logger.info(
    "[pikpak] fast path: restore whole folder",
    folderId,
    "(" + group.length + "files)"
  );
  return client
    .restore(shareId, [folderId], folderAncestors)
    .then(function (trace) {
      var ownFolderId = trace[folderId];
      if (!ownFolderId) return false;
      return client.listOwnFolder(ownFolderId).then(function (ownFiles) {
        var byName = {};
        for (var i = 0; i < ownFiles.length; i++) {
          byName[ownFiles[i].name] = ownFiles[i];
        }
        var left = [];
        for (var j = 0; j < group.length; j++) {
          var item = group[j];
          var own = byName[item.name];
          if (!own) {
            left.push(item);
            continue;
          }
          storageSet(restoreCacheKey(shareId, item.id), own.id);
          item.url = pickDownloadUrl(own, client.useTrans);
        }
        if (left.length) {
          gopeed.logger.warn(
            "[pikpak] fast path missing",
            left.length,
            "files, falling back to per-file restore"
          );
          return restoreGroupPerFile(client, shareId, left).then(function () {
            return true;
          });
        }
        return true;
      });
    });
}

function resolveByRestore(client, shareId, items) {
  // 1) 先试缓存
  return lookupCached(client, shareId, items).then(function (pending) {
    // 2) 其余的按所在目录分组（同目录一次请求）
    var groups = {};
    var order = [];
    for (var i = 0; i < pending.length; i++) {
      var key = pending[i].ancestors.join(",");
      if (!groups[key]) {
        groups[key] = [];
        order.push(key);
      }
      groups[key].push(pending[i]);
    }
    return order.reduce(function (p, key) {
      return p.then(function () {
        var group = groups[key];
        var job = Promise.resolve(false);
        if (
          group.length >= FOLDER_FAST_PATH_MIN &&
          group[0].ancestors &&
          group[0].ancestors.length
        ) {
          job = restoreFolderFastPath(client, shareId, group).catch(function (e) {
            gopeed.logger.warn(
              "[pikpak] folder fast path failed:",
              (e && e.message) || e
            );
            return false;
          });
        }
        return job.then(function (fastOk) {
          if (fastOk) return;
          var left = group.filter(function (it) {
            return !it.url;
          });
          if (!left.length) return;
          return restoreGroupPerFile(client, shareId, left).catch(function (e) {
            // 一组失败（如每日转存次数用完）不影响其他文件，原因留给最终报错
            client.restoreError = (e && e.message) || String(e);
            gopeed.logger.warn("[pikpak] restore failed:", client.restoreError);
          });
        });
      });
    }, Promise.resolve());
  });
}

// ====== 取分享直链：按实测速度自适应选择策略 ======
// Gopeed 前端对整个解析有硬超时（v1.9.x 60s / v2.x Web 120s，桌面 v2.x 无），
// 而 Gopeed v1.9.x 的 goja 运行时里 fetch 是同步阻塞的（JS 并发不会真的并行）。
// 所以文件夹里文件一多，逐文件取链接（每个文件一次 share/file_info）必然超时。
// 策略：先做两轮探测——串行测单文件耗时，再并发测并发是否真的生效——
// 据此估算总耗时；超预算且已登录时，改为"整个文件夹转存一次 + 递归列一次自己网盘"，
// 把 O(N) 次请求降为常数次。
var PROBE_SERIAL = 2;
var PROBE_PARALLEL = 2;
var BULK_TIME_BUDGET_MS = 35000;

function fetchShareInfo(client, shareId, item) {
  if (item.url) return Promise.resolve();

  function applyInfo(info) {
    var fi = info.file_info || info;
    item.url = pickDownloadUrl(fi, client.useTrans);
  }

  function callOnce(noToken) {
    return client.getFileInfo(shareId, item.id, noToken).then(applyInfo);
  }

  // 先按当前模式请求；若设置了 pass_code_token，再补一次无 token 兜底。
  function sequence() {
    return callOnce(false).then(
      function () {
        if (item.url || !client.passCodeToken) return;
        return callOnce(true);
      },
      function (eWithToken) {
        if (!client.passCodeToken) throw eWithToken;
        return callOnce(true).catch(function (eNoToken) {
          throw eWithToken || eNoToken;
        });
      }
    );
  }

  // 网络抖动常见，补一次快速重试。
  return sequence().then(function () {
    if (item.url) return;
    return sleep(200).then(function () {
      return sequence();
    });
  });
}

// 文件相对目标文件夹的路径（用于和自己网盘列表做匹配）
function relativePathInFolder(item, folder) {
  var base = folder.path || "";
  var dir = item.path || "";
  if (!base) return "";
  if (dir === base) return item.name;
  if (
    dir.length > base.length + 1 &&
    dir.slice(0, base.length) === base &&
    dir.charAt(base.length) === "/"
  ) {
    return dir.slice(base.length + 1) + "/" + item.name;
  }
  return "";
}

// 整文件夹转存 + 递归列自己网盘目录，一次性拿到整个子树的直链。
// 返回仍未拿到直链的文件（调用方用逐文件逻辑兜底）。
function resolveByBulkRestore(client, shareId, folder, files) {
  var ancestors = folder.ancestors || [];
  var folderAncestors = ancestors.slice(0, -1);
  gopeed.logger.info(
    "[pikpak] bulk mode: restore whole folder",
    folder.id,
    "(" + files.length + " files)"
  );
  return client
    .restore(shareId, [folder.id], folderAncestors)
    .then(function (trace) {
      var ownFolderId = trace[folder.id];
      if (!ownFolderId) throw new Error("整文件夹转存未返回网盘目录 ID");
      return client.listOwnTree(ownFolderId).then(function (entries) {
        var byRel = {};
        for (var i = 0; i < entries.length; i++) {
          if (entries[i].url) byRel[entries[i].rel] = entries[i];
        }
        var left = [];
        for (var j = 0; j < files.length; j++) {
          var item = files[j];
          var rel = relativePathInFolder(item, folder);
          var own = rel ? byRel[rel] : null;
          if (own) {
            storageSet(restoreCacheKey(shareId, item.id), own.id);
            item.url = own.url;
          } else {
            left.push(item);
          }
        }
        gopeed.logger.info(
          "[pikpak] bulk mode resolved",
          files.length - left.length,
          "of",
          files.length,
          "files"
        );
        return left;
      });
    });
}

// stage 2 主流程：取分享直链 + 必要时转存
function resolveLinks(client, shareId, files, opts) {
  var t0 = new Date().getTime();
  var total = files.length;
  var serialCount = Math.min(PROBE_SERIAL, total);

  function perFilePass(list) {
    if (!list.length) return Promise.resolve();
    return mapLimit(list, 4, function (it) {
      return fetchShareInfo(client, shareId, it);
    }).then(function (firstPass) {
      var failed = [];
      for (var i = 0; i < list.length; i++) {
        var r = firstPass[i];
        if (r && r.ok) continue;
        if (!list[i].url) failed.push(list[i]);
      }
      if (!failed.length) return;
      gopeed.logger.warn(
        "[pikpak] file_info failed for",
        failed.length,
        "files, retry sequentially"
      );
      return mapLimit(failed, 1, function (it) {
        return fetchShareInfo(client, shareId, it);
      });
    });
  }

  function afterProbe(perFile, rest) {
    var estimate = perFile * rest.length;
    gopeed.logger.info(
      "[pikpak] measured ~" +
        Math.round(perFile) +
        "ms/file, remain " +
        rest.length +
        " files ≈ " +
        Math.round(estimate / 1000) +
        "s"
    );
    var wantBulk =
      !opts.skipBulk &&
      !!opts.folder &&
      opts.loggedIn &&
      opts.bulkSetting !== "0" &&
      (opts.bulkSetting === "1" || estimate > BULK_TIME_BUDGET_MS);
    if (!wantBulk || !rest.length) {
      return perFilePass(rest);
    }
    // 预计会超出 Gopeed 解析超时：整文件夹转存 + 一次递归列表
    return resolveByBulkRestore(client, shareId, opts.folder, files)
      .catch(function (e) {
        gopeed.logger.warn("[pikpak] bulk mode failed:", (e && e.message) || e);
        client.restoreError = (e && e.message) || String(e);
        return files.filter(function (it) {
          return !it.url;
        });
      })
      .then(function (left) {
        // 兜底：bulk 没覆盖到的文件仍按逐文件取链接
        return perFilePass(left);
      });
  }

  // 1) 串行探测，测单文件耗时
  return mapLimit(files.slice(0, serialCount), 1, function (it) {
    return fetchShareInfo(client, shareId, it);
  })
    .then(function () {
      var perFileSerial = (new Date().getTime() - t0) / serialCount;
      var pStart = serialCount;
      var pCount = Math.min(PROBE_PARALLEL, total - pStart);
      if (pCount < 2) {
        return { perFile: perFileSerial, next: pStart };
      }
      // 2) 并发探测，判断当前运行时是否真并发（goja 下会退化成串行）
      var t1 = new Date().getTime();
      return mapLimit(files.slice(pStart, pStart + pCount), 2, function (it) {
        return fetchShareInfo(client, shareId, it);
      }).then(function () {
        var perFileConcurrent = (new Date().getTime() - t1) / pCount;
        var concurrent = perFileConcurrent < perFileSerial * 0.6;
        gopeed.logger.info(
          "[pikpak] runtime concurrency:",
          concurrent ? "yes" : "no (serialized)"
        );
        return {
          perFile: concurrent ? perFileConcurrent : perFileSerial,
          next: pStart + pCount,
        };
      });
    })
    .then(function (probe) {
      return afterProbe(probe.perFile, files.slice(probe.next));
    })
    .then(function () {
      // 3) 仍然没有直链的（zip 等）登录后转存到自己网盘再取下载链
      var noUrl = files.filter(function (it) {
        return !it.url;
      });
      if (!noUrl.length || !opts.loggedIn) return;
      // 大文件夹加速设为"关闭"时，连逐文件转存也不做（完全不占用网盘空间与转存次数）
      if (opts.bulkSetting === "0") {
        gopeed.logger.warn(
          "[pikpak] 转存已关闭，跳过",
          noUrl.length,
          "个需要转存才能下载的文件：",
          describeNames(noUrl.map(function (it) {
            return it.name;
          }))
        );
        return;
      }
      var tRestore = new Date().getTime();
      return resolveByRestore(client, shareId, noUrl).then(function () {
        gopeed.logger.info(
          "[pikpak] restore done in",
          new Date().getTime() - tRestore,
          "ms"
        );
      });
    });
}

// ====== 业务逻辑 ======
function listAllFiles(client, shareId, parentId, pathPrefix, ancestors) {
  // 递归列出所有文件，返回 [{name, path, size, id, ancestors}]
  ancestors = ancestors || [];
  var out = [];
  var pageToken = "";
  var page = 0;
  function loop() {
    page++;
    return client
      .getShareDetail(shareId, parentId, pageToken)
      .then(function (resp) {
        if (
          resp.share_status === "PASS_CODE_EMPTY" ||
          resp.share_status === "PASS_CODE_ERROR"
        ) {
          throw new Error(
            "分享需要密码，请在扩展设置 share_pwd 中填入访问密码"
          );
        }
        if (resp.share_status && resp.share_status !== "OK") {
          throw new Error(
            "分享状态异常：" +
              resp.share_status +
              " " +
              (resp.share_status_text || "")
          );
        }
        var files = resp.files || [];
        var subTasks = [];
        for (var i = 0; i < files.length; i++) {
          var f = files[i];
          if (f.kind === "drive#folder") {
            subTasks.push({ folder: f });
          } else {
            out.push({
              id: f.id,
              name: f.name,
              path: pathPrefix,
              size: parseInt(f.size, 10) || 0,
              ancestors: ancestors,
              // 分享列表本身有时已经带 web_content_link / medias。
              // Gopeed Android 上逐个 share/file_info 偶发只返回部分视频链接，
              // 所以优先保留列表里的直链，避免后续逐文件请求把结果削成 1 个。
              url: pickDownloadUrl(f, client.useTrans),
            });
          }
        }
        pageToken = resp.next_page_token || "";
        var next = pageToken ? loop() : Promise.resolve();
        return next.then(function () {
          // 串行处理子文件夹（避免并发触发风控）
          return subTasks.reduce(function (p, t) {
            return p.then(function () {
              var sub = pathPrefix
                ? pathPrefix + "/" + t.folder.name
                : t.folder.name;
              return listAllFiles(
                client,
                shareId,
                t.folder.id,
                sub,
                ancestors.concat([t.folder.id])
              ).then(function (childFiles) {
                out = out.concat(childFiles);
              });
            });
          }, Promise.resolve());
        });
      });
  }
  return loop().then(function () {
    return out;
  });
}

// 目标路径模式：逐层定位目标文件或文件夹；命中文件夹后只递归扫描该子树。
// targetPath 示例：DyDy_cos/update/26.09 patreon/ALL IN_S.mp4
function cleanString(s) {
  s = String(s == null ? "" : s);
  if (s.normalize) {
    try { s = s.normalize("NFKC"); } catch (e) {}
  }
  return s
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeForMatch(s) {
  return cleanString(s).toLowerCase();
}

function splitTargetPath(targetPath) {
  var s = String(targetPath || "");
  if (s.normalize) {
    try { s = s.normalize("NFKC"); } catch (e) {}
  }
  // 手机输入时常见：把路径换行、使用全角斜杠、或在 / 两侧混入空格。
  s = s
    .replace(/\u00a0/g, " ")
    .replace(/[\u200B-\u200D\uFEFF]/g, "")
    .replace(/[\\／]+/g, "/")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s*\/\s*/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return s.split("/").map(function (x) { return cleanString(x); }).filter(function (x) { return x !== ""; });
}

function summarizeNames(names) {
  if (!names || !names.length) return "空目录";
  var shown = names.slice(0, 20).join("、");
  return names.length > 20 ? shown + " 等 " + names.length + " 项" : shown;
}

function checkShareStatus(resp) {
  if (resp.share_status === "PASS_CODE_EMPTY" || resp.share_status === "PASS_CODE_ERROR") {
    throw new Error("分享需要密码，请在扩展设置 share_pwd 中填入访问密码");
  }
  if (resp.share_status && resp.share_status !== "OK") {
    throw new Error("分享状态异常：" + resp.share_status + " " + (resp.share_status_text || ""));
  }
}

function findInDirectory(client, shareId, parentId, wantedName, wantFolder) {
  var pageToken = "";
  var names = [];
  var exact = null;
  var loose = [];
  var wantedNorm = normalizeForMatch(wantedName);

  function kindOk(f) {
    if (wantFolder === true) return f.kind === "drive#folder";
    if (wantFolder === false) return f.kind !== "drive#folder";
    return true;
  }

  function loop() {
    return client.getShareDetail(shareId, parentId, pageToken).then(function (resp) {
      checkShareStatus(resp);
      var files = resp.files || [];
      for (var i = 0; i < files.length; i++) {
        var f = files[i];
        names.push(f.name + (f.kind === "drive#folder" ? "/" : ""));
        if (!kindOk(f)) continue;
        if (!exact && f.name === wantedName) exact = f;
        if (normalizeForMatch(f.name) === wantedNorm) loose.push(f);
      }
      pageToken = resp.next_page_token || "";
      return pageToken ? loop() : null;
    });
  }

  return loop().then(function () {
    if (exact) return { entry: exact, names: names, count: names.length };
    if (loose.length === 1) return { entry: loose[0], names: names, count: names.length, loose: true };
    if (loose.length > 1) {
      var e = new Error("目标路径匹配到多个同名项：" + wantedName + "；请把路径写得更精确");
      e.pathDepth = 0;
      throw e;
    }
    return { entry: null, names: names, count: names.length };
  });
}

function makePathError(label, parts, index, names) {
  var partial = parts.slice(0, index + 1).join("/");
  var e = new Error(
    "目标路径第 " + (index + 1) + " 层找不到：" + partial +
      "；已查看位置：" + label +
      "；当前目录实际有：" + summarizeNames(names)
  );
  e.pathNotFound = true;
  e.pathDepth = index + 1;
  return e;
}

function makeFoundItem(entry, ancestors, pathParts) {
  return {
    id: entry.id,
    name: entry.name,
    path: pathParts.join("/"),
    size: parseInt(entry.size, 10) || 0,
    ancestors: ancestors.slice(),
  };
}

function makeFoundFolder(entry, ancestors, pathParts) {
  return {
    kind: "folder",
    id: entry.id,
    name: entry.name,
    path: pathParts.concat([entry.name]).join("/"),
    ancestors: ancestors.concat([entry.id]),
  };
}

function findTargetEntryFromParts(client, shareId, parts, baseParentId, label) {
  function walk(index, parentId, ancestors, pathParts) {
    var part = parts[index];
    var isLast = index === parts.length - 1;
    return findInDirectory(client, shareId, parentId, part, isLast ? null : true).then(function (result) {
      var entry = result.entry;
      if (!entry) {
        // 容错：用户常把文件名前缀误当成目录，例如
        // 26.09 patreon/ALL IN_S.mp4，实际文件名可能是 26.09 patreon ALL IN_S.mp4。
        if (!isLast) {
          var joinedFileName = parts.slice(index).join(" ");
          return findInDirectory(client, shareId, parentId, joinedFileName, false).then(function (joinedResult) {
            if (joinedResult.entry) {
              return { kind: "file", item: makeFoundItem(joinedResult.entry, ancestors, pathParts) };
            }
            throw makePathError(label, parts, index, result.names);
          });
        }
        throw makePathError(label, parts, index, result.names);
      }
      if (!isLast) {
        return walk(index + 1, entry.id, ancestors.concat([entry.id]), pathParts.concat([entry.name]));
      }
      if (entry.kind === "drive#folder") {
        return makeFoundFolder(entry, ancestors, pathParts);
      }
      return { kind: "file", item: makeFoundItem(entry, ancestors, pathParts) };
    });
  }

  return walk(0, baseParentId || "", baseParentId ? [baseParentId] : [], []);
}

function chooseBestPathError(errors) {
  if (!errors.length) return new Error("目标路径解析失败");
  var best = errors[0];
  for (var i = 1; i < errors.length; i++) {
    if ((errors[i].pathDepth || 0) > (best.pathDepth || 0)) best = errors[i];
  }
  return best;
}

function findTargetEntry(client, shareId, targetPath, initialParentId) {
  var parts = splitTargetPath(targetPath);
  if (!parts.length) return Promise.resolve(null);

  var attempts = [
    { label: "分享根目录", parentId: "", parts: parts }
  ];
  // 分享链接最后一段通常是当前打开的文件/目录 ID。若用户复制的是子目录链接，
  // 自动把它也作为起点尝试，并逐步尝试去掉路径前缀，避免必须猜真实根目录。
  if (initialParentId) {
    for (var skip = 0; skip < parts.length; skip++) {
      attempts.push({
        label: "链接所在目录（跳过前 " + skip + " 层）",
        parentId: initialParentId,
        parts: parts.slice(skip)
      });
    }
  }

  var errors = [];
  function tryOne(i) {
    if (i >= attempts.length) {
      var e = chooseBestPathError(errors);
      e.message = e.message + "。已自动尝试分享根目录" + (initialParentId ? "和链接所在目录" : "") + "；请检查目标路径或直接填从当前链接目录开始的相对路径。";
      throw e;
    }
    var a = attempts[i];
    if (!a.parts.length) return tryOne(i + 1);
    return findTargetEntryFromParts(client, shareId, a.parts, a.parentId, a.label).catch(function (e) {
      // 只有路径不存在时才切换到下一种起点；网络、权限、密码等错误直接暴露。
      if (!e || !e.pathNotFound) throw e;
      errors.push(e);
      return tryOne(i + 1);
    });
  }
  return tryOne(0);
}

// 只做路径定位：命中文件直接返回该文件；命中文件夹则返回文件夹本身（不展开）。
// 展开与否由调用方决定——强制加速时无需展开分享目录（用网盘列表即可拿到全部文件）。
function findTarget(client, shareId, targetPath, initialParentId) {
  return findTargetEntry(client, shareId, targetPath, initialParentId).then(function (target) {
    if (!target) return { files: [] };
    if (target.kind === "file") return { files: [target.item] };
    client.targetFolder = {
      id: target.id,
      name: target.name,
      path: target.path,
      ancestors: target.ancestors,
    };
    return { folder: client.targetFolder };
  });
}

// 构造 Gopeed 的解析结果（含每文件的请求头）
function buildResource(parsed, files) {
  var out = [];
  for (var i = 0; i < files.length; i++) {
    var f = files[i];
    out.push({
      name: f.name,
      path: f.path || "",
      size: f.size || 0,
      req: {
        url: f.url,
        extra: {
          header: {
            "User-Agent": DEFAULT_UA,
            Referer: "https://mypikpak.com/",
          },
        },
      },
    });
  }
  var resName =
    out.length === 1 ? out[0].name : "PikPak-" + parsed.shareId.slice(-10);
  return { name: resName, files: out };
}

function pickDownloadUrl(fileInfo, useTrans) {
  if (!fileInfo) return "";
  var direct = fileInfo.web_content_link || "";
  var medias = fileInfo.medias || [];
  if (useTrans && medias.length > 1 && medias[1].link && medias[1].link.url) {
    return medias[1].link.url;
  }
  if (direct) return direct;
  if (medias.length > 0 && medias[0].link && medias[0].link.url) {
    return medias[0].link.url;
  }
  return "";
}

function describeNames(names) {
  var shown = names.slice(0, 3).join("、");
  return names.length > 3 ? shown + " 等 " + names.length + " 个文件" : shown;
}

// 只有 MessageError 会被 Gopeed 展示给用户；普通 Error 或空结果都会让 Gopeed
// 退回成把分享页当普通 HTTP 下载，解析出一个"未知文件"
var UserError = typeof MessageError !== "undefined" ? MessageError : Error;


// ====== 分批解析：慢网络下把"一次解析全部文件"拆成多次小任务 ======
// Gopeed v1.9.x 前端只等 60 秒，PikPak 每个文件都要单独请求一次，
// 文件多时必然超时。开启分批后每次只解析 batch_size 个文件（并单独缓存），
// 成功一次就自动推进到下一批，点几次就能把整个文件夹加进下载列表。
function batchKeyOf(shareId, targetPath) {
  return "batch:" + shareId + ":" + String(targetPath || "");
}

function readBatchState(shareId, targetPath, size) {
  var offset = parseInt(storageGet(batchKeyOf(shareId, targetPath)), 10);
  if (!(offset >= 0)) offset = 0;
  return { offset: offset, size: size };
}

function advanceBatch(shareId, targetPath, offset, size, total) {
  var next = offset + size >= total ? 0 : offset + size;
  storageSet(batchKeyOf(shareId, targetPath), String(next));
  return next;
}

function batchLabel(offset, size, total) {
  return (
    "批次 " + (Math.floor(offset / size) + 1) + "/" + Math.ceil(total / size)
  );
}

// 标准流程：展开分享内的目标文件夹 → 逐文件取链接（必要时转存）
function resolveStandard(client, shareId, t, opts) {
  var listing = t.files
    ? Promise.resolve(t.files)
    : listAllFiles(client, shareId, t.folder.id, t.folder.path, t.folder.ancestors);
  return listing.then(function (files) {
    if (!files.length) {
      throw new Error(
        t.folder
          ? "目标文件夹为空或不包含文件：" + t.folder.path
          : "分享内未找到任何可下载的文件"
      );
    }
    gopeed.logger.info("[pikpak] flat files:", files.length);
    // 分批：只解析当前批次，成功后由 finish() 推进批次偏移
    var total = files.length;
    if (opts.batchSize > 0 && total > opts.batchSize) {
      var off = opts.batchOffset;
      if (off >= total) off = 0;
      files = files.slice(off, Math.min(off + opts.batchSize, total));
      files.__batch = {
        offset: off,
        size: opts.batchSize,
        total: total,
        label: batchLabel(off, opts.batchSize, total),
      };
      gopeed.logger.info(
        "[pikpak] batch",
        files.__batch.label,
        "- 解析第",
        off + 1,
        "~",
        off + files.length,
        "个文件（共",
        total,
        "个）"
      );
    }
    var tFileInfo = new Date().getTime();
    return resolveLinks(client, shareId, files, {
      loggedIn: opts.loggedIn,
      folder: client.targetFolder,
      bulkSetting: opts.bulkSetting,
      skipBulk: opts.skipBulk || opts.batchSize > 0,
    }).then(function () {
      gopeed.logger.info(
        "[pikpak] link resolve done in",
        new Date().getTime() - tFileInfo,
        "ms"
      );
      // 记下分享内应有文件数：只要解析数少于它，结果名里就会显示（已解析/应有）
      if (!files.__expected) files.__expected = total;
      return files;
    });
  });
}

gopeed.events.onResolve(function (ctx) {
  var settings = gopeed.settings || {};
  var client = new PikPakClient(settings);
  var parsed = null;
  var loggedIn = false;
  var tStart = new Date().getTime();
  // 分批解析：读当前批次偏移，并把批次写进缓存 key（每批独立缓存）
  var batchSize = parseInt(String(settings.batch_size || "0"), 10) || 0;
  var batchState = { offset: 0, size: batchSize };
  var cacheScope = settings.target_path; // 分批模式下会带上批次偏移

  // 收尾：筛掉没有直链的文件，构造结果并写入缓存
  function finish(files) {
    var resolved = [];
    var missing = [];
    for (var i = 0; i < files.length; i++) {
      var item = files[i];
      if (!item.url) {
        gopeed.logger.warn("[pikpak] no download url for", item.name);
        missing.push(item.name);
        continue;
      }
      resolved.push(item);
    }
    if (!resolved.length) {
      throw new Error(
        loggedIn
          ? "已登录，但未能拿到下载地址：" +
              describeNames(missing) +
              (client.restoreError ? "（" + client.restoreError + "）" : "")
          : "匿名访问只提供视频的播放地址，" +
              describeNames(missing) +
              " 需要登录后才能下载。请在扩展设置中填写 PikPak 账号密码或 refresh_token"
      );
    }
    if (missing.length) {
      gopeed.logger.warn(
        "[pikpak] skipped",
        missing.length,
        "files without download url" +
          (loggedIn ? "" : " (configure login to download them)")
      );
    }
    // Gopeed v1.9.x 要求 name 非空，否则退回 HTTP 解析
    ctx.res = buildResource(parsed, resolved);
    var batch = files && files.__batch;
    if (batch) {
      // 结果名带上批次，方便区分多次解析出来的任务
      ctx.res.name = "PikPak-" + batch.label;
    } else if (files && files.__expected > resolved.length) {
      // 有文件没拿到直链：结果名里显示完整度，一眼可见缺了多少。
      // 单文件结果用文件名（HTTP 下载只用文件名拼路径，name 仅作标题）
      var baseName =
        resolved.length === 1
          ? resolved[0].name
          : "PikPak-" + parsed.shareId.slice(-10);
      ctx.res.name =
        baseName + "（" + resolved.length + "/" + files.__expected + "）";
    }
    // 调试信息：把"密码 token 状态 + 各参数列举到的文件数"显示在任务名里
    if (String(settings.debug_info || "0") === "1") {
      var diag = (client.passNote || "") +
        (client.listDiag && client.listDiag.length
          ? "｜列表:" + client.listDiag.join(",")
          : "");
      // 放最前面：Gopeed 弹窗标题会截断，诊断信息优先可见
      if (diag) ctx.res.name = "〔" + diag + "〕" + ctx.res.name;
      gopeed.logger.info("[pikpak] debug:", diag);
    }

    // 全部文件都拿到直链才缓存：部分成功不缓存，否则重试会跳过缺失文件的转存
    if (!missing.length) {
      writeResultCache(parsed.shareId, cacheScope, resolved, ctx.res.name);
      if (batch) {
        var next = advanceBatch(
          parsed.shareId,
          settings.target_path,
          batch.offset,
          batch.size,
          batch.total
        );
        gopeed.logger.info(
          "[pikpak] 下一批从第",
          next + 1,
          "个文件开始（共",
          batch.total,
          "个）；再次确认即可继续"
        );
      }
    }
    gopeed.logger.info(
      "[pikpak] resolved",
      resolved.length,
      "files in",
      new Date().getTime() - tStart,
      "ms" + (missing.length ? " (" + missing.length + " skipped)" : "")
    );
  }

  return Promise.resolve()
    .then(function () {
      parsed = parseShareUrl(ctx.req.url);
      client.listDiag = [];
      if (batchSize > 0) {
        batchState = readBatchState(
          parsed.shareId,
          settings.target_path,
          batchSize
        );
        cacheScope =
          String(settings.target_path || "") + "#" + batchState.offset;
        gopeed.logger.info(
          "[pikpak] batch mode: size=" + batchSize,
          "offset=" + batchState.offset
        );
      }
      gopeed.logger.info(
        "[pikpak] resolve shareId=" + parsed.shareId,
        "initialParentId=" + (parsed.initialParentId || "(none)")
      );
      // 0) 结果缓存命中：零请求直接返回（移动端超时后重试时秒开）
      var cached = readResultCache(parsed.shareId, cacheScope);
      if (cached) {
        gopeed.logger.info(
          "[pikpak] cache hit,",
          cached.files.length,
          "files, skip all API calls",
          cached.name ? "(" + cached.name + ")" : ""
        );
        ctx.res = buildResource(parsed, cached.files);
        if (cached.name) ctx.res.name = cached.name;
        return true;
      }
      return client.ensureLogin().then(function (ok) {
        loggedIn = ok;
        gopeed.logger.info(
          "[pikpak] mode=" +
            (loggedIn ? "login user_id=" + client.userId : "anonymous")
        );
        return false;
      });
    })
    .then(function (fromCache) {
      if (fromCache) return null;
      // 1) pass_code_token：仅密码分享时需要
      if (!settings.share_pwd) {
        client.passCodeToken = "";
        client.passNote = "未设分享密码";
        return null;
      }
      return client
        .getShareInfo(parsed.shareId, settings.share_pwd)
        .then(function (info) {
          client.passCodeToken = info.pass_code_token || "";
          client.passNote = client.passCodeToken
            ? "密码token=有"
            : "密码token=空(密码可能不对/分享无密码)";
          if (!client.passCodeToken) {
            gopeed.logger.warn(
              "[pikpak] 设置了分享密码但没换到 pass_code_token，将不带 token 请求（列表可能不完整）"
            );
          }
          return null;
        });
    })
    .then(function () {
      if (ctx.res) return [];
      var tList = new Date().getTime();
      var targetPath = String(settings.target_path || "").trim();
      if (targetPath) {
        // 只做路径定位，文件夹不在这里展开
        return findTarget(
          client,
          parsed.shareId,
          settings.target_path,
          parsed.initialParentId
        ).then(function (t) {
          gopeed.logger.info(
            "[pikpak] path walk done in",
            new Date().getTime() - tList,
            "ms"
          );
          return t;
        });
      }
      // 留空则扫描整个分享
      return listAllFiles(client, parsed.shareId, "", "").then(function (files) {
        gopeed.logger.info(
          "[pikpak] listing done in",
          new Date().getTime() - tList,
          "ms"
        );
        return { files: files };
      });
    })
    .then(function (t) {
      if (ctx.res) return [];
      // 2) 强制整目录加速：完全跳过分享目录递归与逐文件取链，
      //    直接遍历自己网盘目录（列表自带直链），请求数只与目录层级有关
      var bulkSetting = String(settings.bulk_restore || "auto");
      var bulkWanted =
        t.folder && loggedIn && bulkSetting === "1" && batchSize === 0;
      var fallback = function (why) {
        gopeed.logger.warn(
          "[pikpak] bulk mode unusable (" + why + "), fallback to per-file"
        );
        return resolveStandard(client, parsed.shareId, t, {
          loggedIn: loggedIn,
          bulkSetting: bulkSetting,
          skipBulk: true, // 整目录直取刚失败过，不再重复尝试
          batchSize: batchSize,
          batchOffset: batchState.offset,
        });
      };
      if (bulkWanted) {
        gopeed.logger.info("[pikpak] bulk mode: direct from own drive");
        return resolveFolderByBulk(client, parsed.shareId, t.folder).then(
          function (bulkFiles) {
            if (bulkFiles && bulkFiles.length) return bulkFiles;
            return fallback("no files resolved");
          },
          function (e) {
            return fallback((e && e.message) || String(e));
          }
        );
      }
      return resolveStandard(client, parsed.shareId, t, {
        loggedIn: loggedIn,
        bulkSetting: bulkSetting,
        batchSize: batchSize,
        batchOffset: batchState.offset,
      });
    })
    .then(function (files) {
      if (ctx.res) return; // 缓存命中，结果已构造好
      finish(files);
    })
    .catch(function (e) {
      throw new UserError("PikPak: " + ((e && e.message) || String(e)));
    });
});
