/** @OnlyCurrentDoc */
/**
 * 論壇資源島：金幣、暱稱、登島碼、下載紀錄、留言碼頭、物資島、好友的後台（Google 試算表 + Apps Script）。
 * 金幣與物資以試算表為準，同一個人用登島碼在手機、電腦都能接回同一個帳號。
 *
 * 部署：試算表 → 擴充功能 → Apps Script → 貼上本檔 → 存檔
 *       → 部署 → 管理部署作業 → 編輯（鉛筆）→ 版本選「新版本」→ 部署（網址不變）
 * 第一次換上本版：在上方函式選單選 setupOwner → 執行，建立站長的兩個帳號。
 *
 * 工作表「玩家」：每位玩家一列（登島碼、暱稱、金幣、物資、頭像、海島編號、好友…），就是統計表。
 * 工作表「下載紀錄」：逐筆記錄誰在什麼時間下載了哪篇文章的哪個檔案。
 * 工作表「造訪紀錄」：每位玩家每天第一次登上某座島時記一筆（誰、哪座島、什麼時間）。
 * 工作表「留言板」：留言碼頭的留言與站長回覆；狀態欄填「隱藏」就不會出現在網站上。
 * 工作表「物資島」：四座物資島今天的總量、已採集數量、鑽石藏在第幾份（每天第一次有人來時自動重抽）。
 * 工作表「悄悄話」：好友之間的悄悄話與送禮紀錄。
 * 工作表「公告」：站長發的公告（狀態欄填「刪除」就不會顯示）；兩個站長帳號都能在網站上發布、編輯。
 * 工作表「小島紀錄」：每位玩家在自己小島上蓋房子、種菜收成、領養寵物的紀錄。
 * 玩家表最後一欄「小島資料」是 JSON：房子等級、菜田、裝飾、寵物、蔬菜庫存（請不要手動改壞格式）。
 */
var SITE = 'https://kv1012tiger.github.io/autocad-tw-island/';
var TZ = 'Asia/Taipei';
var OWNER = [{ nick: 'Tiger&蘋果爸', admin: true }, { nick: '蘋果爸', admin: false }];
var RESERVED = /蘋果爸|管理員|站長|autocad\s*顧問|admin/i;
/* 封測：建立新帳號（登島）要有邀請碼，每組預設限 2 位。邀請碼放在「邀請碼」分頁（第 1 欄碼、第 2 欄名額、第 3 欄已用），
   可以自己在表裡新增一列：碼填英數字，名額填 2。要結束封測就把 INVITE_ON 改成 false。已經有登島碼的人不受影響。 */
var INVITE_ON = false;
var INV_HEAD = ['邀請碼', '名額', '已用', '使用者', '建立時間'];
var INV_CAP = 2;
function invKey_(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }

var P_HEAD = ['登島碼', '暱稱', '目前金幣', '累計金幣', '連續登島天數', '最後登島日', '第一次登島', '最後上線',
  '下載次數', '最近下載', '管理員', '今日', '今日在線金幣', '今日爬文金幣', '今日問答金幣', '已拿金幣的問答島',
  '頭像', '海島編號', '好友', '水果', '鐵礦', '木材', '石頭', '鑽石', '累計物資', '累計鑽石',
  '今日採集', '最後採集', '今日兌換', '今日送禮', '今日留言', '最後留言', '今日悄悄話', '未讀悄悄話', '小島資料', '開放參觀', '已讀公告', '公告權限'];
var C = { code: 0, nick: 1, bal: 2, earned: 3, streak: 4, last: 5, first: 6, seen: 7, dls: 8, recent: 9, admin: 10,
  day: 11, onl: 12, rd: 13, qa: 14, qaDone: 15,
  av: 16, fid: 17, friends: 18, fruit: 19, iron: 20, wood: 21, stone: 22, dia: 23, tres: 24, tdia: 25,
  gToday: 26, gLast: 27, trades: 28, gifts: 29, msgN: 30, msgLast: 31, noteN: 32, unread: 33, isle: 34, open: 35, annSeen: 36, ann: 37 };
var D_HEAD = ['時間', '暱稱', '登島碼', '文章', '文章網址', '檔案', '下載後剩餘金幣', '備註'];
/* v71：解壓縮密碼放在私人試算表的「解壓密碼」工作表（文章編號｜密碼｜備註），不寫進公開的程式碼；會員下載成功後才回傳 */
var PW_HEAD = ['文章編號', '密碼', '備註'];
function dlPw_(page) {
  var m = /(?:^|\/)t(\d+)\//.exec(String(page || '')); if (!m) return '';
  var map = cget_('dlpw');
  if (!map) {
    map = {}; var sh = sheet_('解壓密碼', PW_HEAD), n = sh.getLastRow() - 1;
    if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(function (v) { var id = String(v[0]).replace(/\D/g, ''); if (id && String(v[1]).trim()) map[id] = String(v[1]).trim(); });
    cput_('dlpw', map, 600);
  }
  return map[m[1]] || '';
}
var V_HEAD = ['時間', '暱稱', '登島碼', '小島代號', '小島', '日期', '管理員'];
var M_HEAD = ['編號', '時間', '暱稱', '登島碼', '頭像', '內容', '回覆', '回覆時間', '回覆修改時間', '狀態', '圖片', '修改時間'];   // v81 加「圖片」（多張，逗號分隔）、「修改時間」
var MR_HEAD = ['留言編號', '時間', '暱稱', '登島碼', '頭像', '內容', '圖片', '修改時間', '狀態'];   // v81 圖片可多張（逗號分隔）；加「修改時間」「狀態」（刪除）   // v74：回覆也能附圖（圖片編號，圖存在「留言圖片」）
var MI_HEAD = ['留言編號', '片', '內容'];
var LK_HEAD = ['目標編號', '登島碼', '暱稱', '時間'];   // v76 按讚：一列一個讚（收回就清空那一列）；目標＝留言編號，或回覆的「留言編號_回覆時間毫秒」   // v59 留言圖片：JPEG base64 切成多片存在這個工作表（不用雲端硬碟授權）
var R_HEAD = ['代號', '物資島', '日期', '今日總量', '已採集', '鑽石藏在第幾份', '已撿到鑽石'];
var N_HEAD = ['時間', '寄件海島編號', '寄件暱稱', '收件海島編號', '收件暱稱', '內容', '圖片', '修改時間', '狀態', '收件人刪除'];   // v81 圖片可多張；狀態「收回」＝雙方都看不到；收件人刪除＝只從收件人那邊拿掉   // v80 加「圖片」：悄悄話圖片編號（W 開頭，只有寄件人、收件人讀得到）
var DAILY = 3;      // 第 1 天 3 枚、第 2 天 4 枚
var DAILY_MAX = 5;  // 第 3 天起每天固定 5 枚
var CAP = { online: 3, read: 6, qa: 9 };
/* 打遊戲送金幣：遊戲（autocad-game 兩款）結束時由網頁回報分數。分數 ≥ 門檻各 1／2／3 枚；每款每天最多 GAME_DAY 枚；同一款至少隔 GAME_GAP 才再算 */
var GAME_KEYS = { quick: 1, runner: 1 }, GAME_T = [150, 500, 1000], GAME_DAY = 8, GAME_GAP = 20 * 1000;
var KIND_COL = { online: C.onl, read: C.rd, qa: C.qa };
var ALPHA = '23456789ABCDFGHJKMNPQRSTUVWXYZ';

/* 動物頭像（網站上的選單要和這裡一致） */
var AVATARS = ['🐱', '🐶', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐧', '🦉', '🐢'];
/* 物資島 */
var RES = {
  fruit: { name: '果園島', item: '水果', col: C.fruit },
  iron: { name: '礦山島', item: '鐵礦', col: C.iron },
  wood: { name: '森林島', item: '木材', col: C.wood },
  stone: { name: '採石島', item: '石頭', col: C.stone }
};
var RES_KEYS = ['fruit', 'iron', 'wood', 'stone'];
/* 20 座物資島：[代號, 種類, 名稱, 再採間隔秒, 每次最少, 每次最多]（網頁 templates/island-home.html 有同一份，要一起改） */
var ISL = [['r0','stone','花崗岩島',100,3,5],['r1','iron','礦山島',90,3,6],['r2','wood','森林島',80,3,7],['r3','stone','採石島',70,2,4],['r4','iron','銅礦灣',80,3,6],['r5','iron','鐵砧島',60,2,6],['r6','wood','松林島',30,1,3],['r7','stone','石灰岩',30,1,4],['r8','wood','楓樹林',40,1,5],['r9','iron','紅岩礦坑',70,2,4],['r10','gold','金礦島',110,1,2],['r11','gold','金沙灣',110,1,2],['r12','gold','黃金谷',120,1,2],['r13','iron','黑曜礦脈',50,2,5],['r14','wood','竹林灣',50,2,6],['r15','stone','大理石岸',100,3,5],['r16','wood','橡木谷',40,1,4],['r17','gold','淘金河',120,1,2],['r18','wood','神木島',60,2,4],['r19','stone','礫石灘',90,3,6]].map(function (a) { return { id: a[0], t: a[1], name: a[2], gap: a[3], lo: a[4], hi: a[5] }; });
var ISL_MAP = {};
ISL.forEach(function (x) { ISL_MAP[x.id] = x; });
/* 金礦島（t:'gold'）：採集拿的是金幣，不是物資。全島每天只有 GOLD_STOCK 枚（大家搶），每人每座每天最多採 GOLD_MAX 次，不會藏鑽石 */
var GOLD_STOCK_MIN = 23, GOLD_STOCK_MAX = 23, GOLD_MAX = 3;   // 每座金礦每天全島固定 23 枚（2026-11-21 由 15 提高 50%）
var RPS_WIN = 3, RPS_MAX = 24;   // v58 猜拳：贏 3 枚、連勝加倍、單局最多 24 枚
/* 物資島「隨機換一批」：每座島每一輪的資源多寡不同（0 稀少／1 普通／2 豐富），島永遠都能採，只是這一輪拿得多或少。
   每一輪長度也隨機：1、2 或 3 分鐘（每座島、每天各自抽一串，全站所有人看到的一樣；網頁用同一套算法自己算，不用再問後台）。
   稀少 ≈ 一半數量、豐富 ≈ 1.6 倍（金礦：稀少 1、普通 1～2、豐富 2～3） */
var ISL_SCHED = true; // false = 全部「普通」（測試用）
function islLvFromR_(il, r) {
  if (il.t === 'gold') return r < 0.5 ? 0 : r < 0.85 ? 1 : 2;
  return r < 0.3 ? 0 : r < 0.75 ? 1 : 2;
}
/* 回傳 { lv: 這一輪的豐富度, w: 還要幾毫秒換下一批 }；從當天（UTC）0 點開始依序抽「長度 1～3 分鐘、豐富度」 */
function islLv_(il, now) {
  now = now || Date.now();
  if (!ISL_SCHED) return { lv: 1, w: 60000 };
  var DAYMS = 86400000, day = Math.floor(now / DAYMS), off = now - day * DAYMS;
  var r = rng_(hash_('isl-seg-v1|' + il.id + '|' + day)), t = 0;
  for (var k = 0; k < 2000; k++) {
    var len = (1 + Math.floor(r() * 3)) * 60000, lvr = r();
    if (off < t + len) return { lv: islLvFromR_(il, lvr), w: t + len - off };
    t += len;
  }
  return { lv: 1, w: 60000 };
}
/* 依豐富度把「底數」（原本 lo～hi 抽出來的數字）換成這一輪實際數量 */
function islScale_(il, base, lv) {
  var n = lv === 0 ? Math.max(1, Math.round(base * 0.5)) : lv === 2 ? Math.round(base * 1.6) : base;
  if (il.t === 'gold') n = lv === 0 ? 1 : lv === 2 ? base + 1 : base;   // 金礦：稀少 1、普通 1～2、豐富 2～3
  return Math.max(1, n);
}
var ISL_LEGACY = { fruit: 'r0', iron: 'r1', wood: 'r2', stone: 'r3' }; // 舊版網頁送的是種類名稱
var HOUSE_MS = [0, 1, 5, 15, 30, 45, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330, 360].map(function(m){return m*60000}); // Lv1～10 施工分鐘
var FIELD_MS = [60 * 1000, 2 * 60 * 1000, 4 * 60 * 1000];      // 菜田第 1／2／3 塊：1、2、4 分鐘
var DECO_MS = { tree: 2 * 60 * 1000, fountain: 5 * 60 * 1000, tower: 10 * 60 * 1000 }; // 果樹 2 分、噴水池 5 分、瞭望塔 10 分
/* 商店島：船（0 號免費）、金幣換物資 */
var SHIPS = [{ name: '小木帆船', cost: 0 }, { name: '彩旗帆船', cost: 8 }, { name: '海盜大帆船', cost: 25 },
  { name: '商賈雙桅船', cost: 60 }, { name: '皇家旗艦', cost: 120 }, { name: '鑽石龍船', cost: 250 }];
var BUY_COST = 1, BUY_N = 6;        // 1 枚金幣買 6 個物資（賣出是 10 個換 1 枚，所以不能無限賺）
var SWAP_FROM = 3, SWAP_TO = 2;     // 3 個甲物資換 2 個乙物資（剛開始互相交換很容易）
var DIA_BUY = 20;                   // 20 枚金幣買 1 顆鑽石（賣出是 1 顆換 10 枚，所以買賣不能賺差價）
var PG_COST = 5;                    // 領「提示詞禮物包」要花 5 枚金幣（領一次，之後免費重複查看；累積拿滿 5 枚才開放）
var XCHG_MAX = 20;                  // 一次最多換 20 份
var READ_DIA_P = 0.06;             // 隱藏優惠：每看一篇不同文章有 6% 機率撿到 1 顆鑽石（不限篇數）
var READ_DIA_DAY = 5;               // 為了防止程式亂刷，每人每天最多從爬文撿 5 顆（網頁上不公開）
var ONLINE_WIN = 6 * 60 * 1000;     // 6 分鐘內有動作就算在線（網頁開著會每 5 分鐘自動回報一次）
var STOCK_MIN = 90, STOCK_MAX = 240; // 每座物資島每天的總量（隨機；2026-11-21 由 60～160 提高 50%）
var GATHER_N = [2, 6];               // 每次採集拿到幾個（2～6，原本是 1～3，加倍）
var DIA_MAX = 2;                     // 每座物資島每天藏 0～2 顆鑽石（隨機，平均 1 顆；機會比之前高）
var GATHER_MAX = 8;                  // 每人每座島每天最多採 8 次（2026-11-21 由 5 提高）
var GATHER_GAP = 1000;               // 任兩次採集至少隔 1 秒（防連點）；每座島另有自己的冷卻（30～120 秒）
var TRADE_RATE = 10;                 // 10 個同種物資換 1 枚金幣
var DIA_RATE = 10;                    // 1 顆鑽石換 5 枚金幣
var TRADE_MAX = 3;                   // 物資賣金幣（含南瓜）每天最多 3 次
var SWAP_DAY = 5;                    // 物資互換每天最多 5 次（2026-11-18 站長要求）
var BUY_DAY = 5;                     // 金幣買物資：水果／鐵礦／木材／石頭每種每天最多 5 次（2026-11-18 站長要求）
var DIA_BUY_DAY = 3;                 // 金幣買鑽石每天最多 3 次
var DIA_SELL_DAY = 3;                // 鑽石換金幣每天最多 3 次（獨立計算，不再和物資賣金幣共用）
var FRIEND_MAX = 50;
var A_HEAD = ['編號', '時間', '標題', '內容', '發布者', '修改時間', '狀態'];
var ANN_TITLE = 40, ANN_LEN = 500, ANN_KEEP = 20, VISIT_KEEP = 10, VISIT_GAP = 10 * 60 * 1000, VOY_KEEP = 60;
/* ---------- 我的小島：蓋房子、種菜、養寵物 ---------- */
var L_HEAD = ['時間', '暱稱', '登島碼', '動作', '內容'];
var HOUR = 3600 * 1000, DAY_MS = 24 * HOUR;
var HOUSE = [null, { wood: 5, stone: 3 }, { wood: 10, stone: 8, iron: 3 }, { wood: 20, stone: 15, iron: 8 },
  { wood: 30, stone: 20, iron: 10 }, { wood: 45, stone: 30, iron: 15 },
  { wood: 65, stone: 45, iron: 22 }, { wood: 90, stone: 60, iron: 30 },
  { wood: 120, stone: 80, iron: 40 }, { wood: 160, stone: 105, iron: 50 },
  { wood: 210, stone: 135, iron: 65 },
  { wood: 270, stone: 170, iron: 80, dia: 1 }, { wood: 340, stone: 210, iron: 100, dia: 2 }, { wood: 420, stone: 260, iron: 125, dia: 3 },   // v85 Lv11～16（擴地後開放，要鑽石）
  { wood: 510, stone: 320, iron: 150, dia: 4 }, { wood: 610, stone: 380, iron: 180, dia: 5 }, { wood: 720, stone: 450, iron: 210, dia: 6 }];
var FIELD = [{ wood: 3, stone: 2 }, { wood: 6, stone: 5 }, { wood: 12, stone: 8, iron: 3 }];
var DECO = {
  tree: { name: '果樹', cost: { fruit: 6, wood: 3 }, pts: 5 },
  fountain: { name: '噴水池', cost: { stone: 10, iron: 5 }, pts: 10 },
  tower: { name: '瞭望塔', cost: { iron: 15, wood: 10 }, pts: 20 }
};
/* 果樹可以種很多棵：會自己長大（幼苗 → 小樹 → 結果樹），結果樹每隔一段時間長出水果，累積最多 TREE_CAP 顆，要自己去摘 */
var TREE_MAX = 6, TREE_GROW = [5 * 60 * 1000, 20 * 60 * 1000], TREE_EVERY = 20 * 60 * 1000, TREE_CAP = 3;
function treeCost_(n) { return { fruit: 6 + 2 * n, wood: 3 + n }; }   // 第 1 棵 🍎6 🪵3，之後每多一棵貴一點
/* 噴水池、瞭望塔可以升級到 Lv8：[null, Lv1, …, Lv8]（Lv1 = 原本的蓋法）；施工時間 = DECO_MS × LV_MULT；Lv7、Lv8 要鑽石 */
var DECO_LV_MAX = 14;
var HOUSE_CAP = [0, 10, 12, 14, 16], DECO_CAP = [0, 8, 10, 12, 14];   // v85 擴地 Lv1～4 時，小屋／噴水池、瞭望塔的最高等級
var UPC = {
  fountain: [null, { stone: 10, iron: 5 }, { stone: 20, iron: 10, wood: 8 }, { stone: 35, iron: 18 },
    { stone: 50, iron: 25, wood: 15 }, { stone: 70, iron: 35, wood: 25 }, { stone: 95, iron: 50, wood: 35 },
    { stone: 125, iron: 65, wood: 50, dia: 1 }, { stone: 160, iron: 85, wood: 70, dia: 2 },
    { stone: 200, iron: 105, wood: 90, dia: 3 }, { stone: 250, iron: 130, wood: 110, dia: 4 }, { stone: 310, iron: 160, wood: 135, dia: 5 },   // v85 Lv9～14
    { stone: 380, iron: 195, wood: 165, dia: 6 }, { stone: 460, iron: 235, wood: 200, dia: 7 }, { stone: 550, iron: 280, wood: 240, dia: 8 }],
  tower: [null, { iron: 15, wood: 10 }, { iron: 30, wood: 18, stone: 12 }, { iron: 50, wood: 30, stone: 25 },
    { iron: 70, wood: 40, stone: 35 }, { iron: 95, wood: 55, stone: 50 }, { iron: 125, wood: 70, stone: 65 },
    { iron: 160, wood: 90, stone: 85, dia: 1 }, { iron: 200, wood: 115, stone: 110, dia: 2 },
    { iron: 250, wood: 140, stone: 135, dia: 3 }, { iron: 310, wood: 175, stone: 165, dia: 4 }, { iron: 380, wood: 215, stone: 200, dia: 5 },
    { iron: 460, wood: 260, stone: 245, dia: 6 }, { iron: 550, wood: 310, stone: 295, dia: 7 }, { iron: 650, wood: 370, stone: 350, dia: 8 }]
};
var FT_PTS = { fountain: [0, 10, 20, 35, 50, 70, 95, 125, 160, 200, 245, 295, 350, 410, 475], tower: [0, 20, 40, 70, 100, 140, 190, 250, 320, 400, 490, 590, 700, 820, 950] };
var LV_MULT = [1, 1.6, 3, 4.5, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24];
/* v82 擴地 Lv1～4：陸地變大、開放新設施（Lv1 就是原本的島） */
var LAND = [null, {}, { wood: 40, stone: 30, iron: 15 }, { wood: 90, stone: 70, iron: 40, dia: 1 }, { wood: 180, stone: 140, iron: 80, dia: 3 }];
var LAND_SHIP = [0, 0, 1, 2, 3], TEMPLE_SHIP = [0, 0, 0, 0, 4];   // v85 擴地 Lv2～4、神殿 Lv4 要先擁有的船（商店島買）
var LAND_MS = [0, 0, 30, 120, 360].map(function (m) { return m * 60000; }), LAND_MAX = 4;
/* v82 生產設施：自動產出物資、存在設施裡，要自己來收（存滿就停）。r = 每小時產量、cap = 最多存幾個；倉庫每一級讓存放上限 +DEPOT_PCT% */
var FAC_R = [0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5], FAC_CAP = [0, 8, 12, 16, 20, 24, 28, 32, 40];
var FAC = {
  lumber: { name: '伐木場', res: 'wood', xl: 2, max: 8, base: { stone: 20, iron: 5 }, r: FAC_R, cap: FAC_CAP },
  quarry: { name: '採石場', res: 'stone', xl: 2, max: 8, base: { wood: 20, iron: 5 }, r: FAC_R, cap: FAC_CAP },
  forge: { name: '鍛鐵爐', res: 'iron', xl: 3, max: 8, base: { wood: 15, stone: 15, iron: 8 }, r: [0, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 3], cap: [0, 5, 8, 10, 12, 15, 18, 20, 25] },
  depot: { name: '倉庫', xl: 2, max: 10, base: { wood: 25, stone: 20 } },
  fish: { name: '釣魚碼頭', xl: 3, max: 5, base: { wood: 30, iron: 10 } },
  kitchen: { name: '料理小屋', xl: 3, max: 5, base: { wood: 30, stone: 20, fruit: 10 } },
  studio: { name: 'CAD 繪圖工作室', xl: 4, max: 8, base: { wood: 40, stone: 30, iron: 20 } }
};
var FAC_MULT = [0, 1, 1.8, 3, 4.5, 6.5, 9, 12, 16, 20, 25], FAC_DIA = { 7: 1, 8: 2, 9: 2, 10: 3 }, DEPOT_PCT = 20;
var FAC_MS = [0, 5, 10, 20, 30, 45, 60, 90, 120, 150, 180].map(function (m) { return m * 60000; });
function facCost_(k, lv) { var b = FAC[k].base, c = {}; Object.keys(b).forEach(function (x) { c[x] = Math.round(b[x] * FAC_MULT[lv]); }); if (FAC_DIA[lv]) c.dia = FAC_DIA[lv]; return c; }
function facCap_(o, k, lv) { return Math.floor(FAC[k].cap[lv] * (1 + num_((o.fac.depot || {}).lv) * DEPOT_PCT / 100 + skillPct_(o, 'earth'))); }
function facPer_(k, lv, o) { return 3600000 / (FAC[k].r[lv] * (1 + facBoost_(o, k))); }
function facBoost_(o, k) { return !o ? 0 : k === 'lumber' ? skillPct_(o, 'wood') : k === 'quarry' ? skillPct_(o, 'earth') : k === 'forge' ? Math.max(skillPct_(o, 'metal'), skillPct_(o, 'fire')) : 0; }
function facStore_(o, k, now) { var f = o.fac[k]; if (!f || !FAC[k].res || !num_(f.lv)) return 0; return Math.min(facCap_(o, k, f.lv), Math.max(0, Math.floor((now - num_(f.c)) / facPer_(k, f.lv, o)))); }
function facNext_(o, k, now) { var f = o.fac[k]; if (!f || !FAC[k].res || !num_(f.lv)) return 0; if (facStore_(o, k, now) >= facCap_(o, k, f.lv)) return 0; var per = facPer_(k, f.lv, o); return Math.max(0, Math.ceil(per - ((now - num_(f.c)) % per))); }
/* v82 花園裝飾：每樣買一次、馬上擺好、不能升級，島主分 +pts */
var GARDEN = { flower: { name: '花圃', cost: { fruit: 5, wood: 3 }, pts: 3 }, sunflower: { name: '向日葵', cost: { fruit: 8, wood: 2 }, pts: 3 },
  lantern: { name: '燈籠', cost: { wood: 6, iron: 4 }, pts: 4 }, bench: { name: '長椅', cost: { wood: 12, stone: 4 }, pts: 4 },
  flag: { name: '旗子', cost: { wood: 6, iron: 3 }, pts: 3 }, mailbox: { name: '信箱', cost: { wood: 8, iron: 5 }, pts: 4 },
  parasol: { name: '海灘傘', cost: { wood: 10, fruit: 6 }, pts: 5 }, statue: { name: '石像', cost: { stone: 30, iron: 10, dia: 1 }, pts: 10 } };
/* v82 五行神殿 Lv1～4：升級要先收集到幾種神獸，開放新的神獸玩法 */
var TEMPLE = [null, {}, { stone: 50, iron: 30 }, { stone: 100, iron: 60, dia: 2 }, { stone: 180, iron: 120, dia: 5 }];
var TEMPLE_NEED = [0, 0, 1, 3, 5], TEMPLE_MAX = 4;
var TEMPLE_MS = [0, 0, 20, 60, 180].map(function (m) { return m * 60000; });
var TEMPLE_OPEN = [null, '📖 神獸圖鑑', '🧬 神獸技能', '🏯 五行塔', '🔥 神獸覺醒'];
/* v83 神獸技能（五行神殿 Lv2 起）：島上有那種神獸就發揮；效果看 IV 與等級（8%～20%），覺醒後加倍 */
var SKILL = { water: { name: '水靈潤田', d: '種菜時間縮短' }, fire: { name: '火鳳旺灶', d: '料理時間縮短、鍛鐵爐產量增加' },
  wood: { name: '麒麟生林', d: '伐木場產量增加' }, metal: { name: '白虎聚財', d: '鍛鐵爐產量增加、釣到稀有物的機率提高' }, earth: { name: '靈龜厚土', d: '採石場產量增加、生產設施存放上限提高' } };
function skillPct_(o, el) {
  if (num_(o.tl) < 2) return 0;
  var best = 0;
  (o.pets || []).forEach(function (p) { if (!isBeast_(p.k) || ANIMALS[p.k].beast !== el) return; var v = (8 + ivOf_(p) / 31 * 8 + Math.min(BEAST_LV_MAX, petLv_(p)) * 0.4) * (p.aw ? 2 : 1); if (v > best) best = v; });
  return Math.round(best) / 100;
}
/* v83 釣魚碼頭：每天釣的次數看等級；拉竿時機對了才有收穫 */
var FISH_DAY = [0, 3, 4, 5, 6, 7], FISH_FOOD = 45;
/* v83 料理小屋：用水果、蔬菜、魚、神獸果做料理，給寵物吃（飽足度比生的高，部分加親密度） */
var DISH = { pie: { name: '蘋果派', lv: 1, need: { fruit: 5 }, min: 20, food: 50 }, salad: { name: '田園沙拉', lv: 2, need: { carrot: 2, cabbage: 1 }, min: 30, food: 70 },
  soup: { name: '南瓜濃湯', lv: 3, need: { pumpkin: 1, carrot: 1 }, min: 45, food: 90 }, grill: { name: '烤魚', lv: 4, need: { fish: 2 }, min: 40, food: 100, aff: 1 },
  feast: { name: '神獸大餐', lv: 5, need: { bfruit: 1, fish: 1, pumpkin: 1 }, min: 60, food: 100, aff: 3, beast: 1 } };
function needHave_(r, o, k) { return k === 'fruit' ? num_(r[C.fruit]) : k === 'fish' ? num_(o.fish) : k === 'bfruit' ? num_(btOf_(o).fr) : num_(o.veg[k]); }
function needPay_(r, o, k, n) { if (k === 'fruit') r[C.fruit] = num_(r[C.fruit]) - n; else if (k === 'fish') o.fish = num_(o.fish) - n; else if (k === 'bfruit') btOf_(o).fr -= n; else o.veg[k] = num_(o.veg[k]) - n; }
/* v83 CAD 繪圖工作室：接設計案，時間到交稿拿金幣（高級案子有鑽石）；每天最多 JOB_DAY 件 */
var JOBS = [null, { name: '平面圖', min: 30, coin: 3 }, { name: '配置圖', min: 45, coin: 4 }, { name: '立面圖', min: 60, coin: 6 }, { name: '剖面圖', min: 90, coin: 8 },
  { name: '施工大樣圖', min: 120, coin: 10 }, { name: '水電配置圖', min: 180, coin: 14 }, { name: '3D 建模', min: 240, coin: 18, dia: 1 }, { name: 'BIM 整合專案', min: 360, coin: 25, dia: 2 }];
var JOB_DAY = 3;
/* v83 神獸圖鑑：5 種 × 普通／高 IV（25 以上）／覺醒，另有隱藏的異色；拿到過就點亮 */
var CX_V = ['n', 'iv', 'aw'], CX_ROW = { dia: 3 }, CX_COL = { bfruit: 5 }, CX_ALL = { dia: 10 }, SHINY_P = 0.01;
function cxCur_(o) {
  var m = {};
  function add(k, x) { m[k + '.n'] = 1; if (ivOf_(x) >= 25) m[k + '.iv'] = 1; if (x.aw) m[k + '.aw'] = 1; if (x.sh) m[k + '.sh'] = 1; }
  (o.pets || []).forEach(function (p) { if (isBeast_(p.k)) add(p.k, p); });
  var col = o.bcol && typeof o.bcol === 'object' ? o.bcol : {};
  Object.keys(col).forEach(function (k) { if (ANIMALS[k] && Array.isArray(col[k])) col[k].forEach(function (x) { if (x && typeof x === 'object') add(k, x); }); });
  return m;
}
function cxDone_(o, c) {
  if (c === 'all') return BEASTS.every(function (k) { return CX_V.every(function (v) { return o.cx[k + '.' + v]; }); });
  if (/^r\./.test(c)) { var v = c.slice(2); return CX_V.indexOf(v) >= 0 && BEASTS.every(function (k) { return o.cx[k + '.' + v]; }); }
  if (/^c\./.test(c)) { var k = c.slice(2); return BEASTS.indexOf(k) >= 0 && CX_V.every(function (v) { return o.cx[k + '.' + v]; }); }
  return false;
}
/* v83 五行塔（神獸試煉島裡，神殿 Lv3 起）：每週一重置，30 層、每 5 層一個魔王；輸了當天不能再爬 */
var TW_FLOORS = 30, EL_BEAT = { water: 'fire', fire: 'metal', metal: 'wood', wood: 'earth', earth: 'water' }, EL_KEYS = ['water', 'fire', 'wood', 'metal', 'earth'];
function twWeek_() { return Math.floor((Date.now() + 8 * 3600000 - 4 * 86400000) / (7 * 86400000)); }
function twGuard_(wk, fl) { var rr = rng_(hash_('tw|' + wk + '|' + fl)), boss = fl % 5 === 0; return { fl: fl, el: EL_KEYS[Math.floor(rr() * 5)], boss: boss, pw: Math.round(90 * (1 + fl * 0.07) * (boss ? 1.25 : 1)) }; }
function twOf_(o) { var wk = twWeek_(), t = o.tw && typeof o.tw === 'object' ? o.tw : {}; if (t.wk !== wk) t = { wk: wk, fl: 0, lost: 0, top: num_(t.top) }; o.tw = t; return t; }
function beastPow_(p) { return Math.round(beastHp_(p.k, ivOf_(p), Math.min(BEAST_LV_MAX, petLv_(p))) * (p.aw ? 1.3 : 1)); }
function twChance_(p, g) { var el = ANIMALS[p.k].beast, mod = EL_BEAT[el] === g.el ? 0.15 : EL_BEAT[g.el] === el ? -0.15 : 0, pw = beastPow_(p); return Math.max(0.1, Math.min(0.95, 0.5 + (pw - g.pw) / g.pw * 0.8 + mod)); }
/* v83 覺醒（神殿 Lv4）：神獸 Lv10 才能覺醒，花神獸果、同種碎片頭身腳各 2、鑽石 */
var AW_COST = { bfruit: 10, shard: 2, dia: 5 };
/* v83 榮譽紀念碑：完成成就就自動變高，不能花錢買 */
function monList_(o) {
  var three = ['lumber', 'quarry', 'forge'].every(function (k) { return num_((o.fac[k] || {}).lv) >= 8; });
  return [['🏠', '小屋蓋到 Lv10', o.h >= 10], ['🏝️', '擴地到 Lv4', o.xl >= 4], ['🌸', '花園裝飾擺滿 8 樣', o.gd.length >= Object.keys(GARDEN).length],
    ['⛩️', '五行神殿升到 Lv4', o.tl >= 4], ['🐲', '在試煉島召喚出 5 種神獸', earnN_(btOf_(o)) >= 5], ['📖', '神獸圖鑑點亮 10 格', Object.keys(o.cx || {}).length >= 10],
    ['🏭', '伐木場、採石場、鍛鐵爐都到 Lv8', three], ['🏯', '五行塔爬到第 30 層', num_((o.tw || {}).top) >= TW_FLOORS]];
}
/* v84 神獸分靈守護島：論壇教學島各有 1 個守護位子。答對該島題庫的試煉（8 題、6 題以上）就能放上神獸分靈，守護 3 小時。
   題庫 QBANK 放在 Apps Script 另一個私人檔案（qbank.gs，不進公開 repo），網頁拿不到答案；守護狀態存在 ScriptProperties「guards」。 */
var RUSH_DIA = 1, RETRY_DIA = 2, SAND_DIA = 3;   // v85 鑽石用途
var GUARD_MS = 3 * 3600000, GUARD_DROP_MS = 30 * 60000, GUARD_DROPS = 6, GUARD_CD = 3600000, GUARD_PASS = 6, GT_DAY = 3, GUARD_READ_MAX = 20, GQ_N = 8, GQ_TTL = 30 * 60000;
var SAND_DAY = 3, SAND_ISLES = 2, SAND_LV = 5, SAND_GACHA_P = 0.03, SAND_TOWER_P = 0.15, SAND_CX = 3;
var SPLIT = [null, null, { lv: 5, pass: 7, cost: { bfruit: 5 } }, { lv: 10, aw: 1, pass: 8, cost: { bfruit: 10, dia: 3 } }];
var GUARD_DROP = [['coin', 30], ['res', 30], ['bfruit', 14], ['shard', 10], ['dia', 8], ['sand', 8]];
var BOARD_NAME = { beginner: '初階入門島', cad2d: '2D 討論島', quiz: '測驗練習島', cad3d: '3D 討論島', f44: '專案報告島', videos: '影片教學島', advanced: '進階討論島',
  courses: '光碟課程島', realtime: '即時動態島', announce: '最新公告島', career: '職場交流島', plugins: '外掛工具島', memberb: '專屬 B 資源島', sponsora: '贊助 A 資源島' };
function qbank_() { return typeof QBANK !== 'undefined' && QBANK ? QBANK : {}; }
function guardsGet_() { try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('guards') || '{}') || {}; } catch (e) { return {}; } }
function guardsPut_(g) { PropertiesService.getScriptProperties().setProperty('guards', JSON.stringify(g)); CacheService.getScriptCache().remove('guardsPub'); }
function guOf_(o) {
  var u = o.gu && typeof o.gu === 'object' ? o.gu : {}, td = day_();
  u.sp = u.sp && typeof u.sp === 'object' ? u.sp : {}; u.gh = Array.isArray(u.gh) ? u.gh : []; u.cd = u.cd && typeof u.cd === 'object' ? u.cd : {}; u.sand = num_(u.sand);
  if (u.d !== td) { u.d = td; u.t = {}; u.sd = 0; }
  u.t = u.t && typeof u.t === 'object' ? u.t : {}; o.gu = u; return u;
}
function guardPub_(G, now) { var m = {}; Object.keys(G).forEach(function (is) { var g = G[is]; if (!g || num_(g.e) <= now) return; m[is] = { nick: g.nick, fid: g.fid, bk: g.bk, iv: g.iv, aw: g.aw ? 1 : 0, sh: g.sh ? 1 : 0, lv: g.lv, sc: g.sc, ms: g.ms, s: g.s, e: g.e, shd: num_(g.shd) > now ? g.shd : 0 }; }); return m; }
/* 守護結束（時間到或被換下）：紀錄搬到守護者自己的 gu.gh，等他回來領獎勵 */
function guardEnd_(G, is, rows, touched, endT) {
  var g = G[is]; delete G[is]; if (!g) return;
  var j = find_(rows, g.code); if (j < 0) return;
  var o = isleOf_(rows[j]), u = guOf_(o);
  u.gh.push({ is: is, code: g.code, s: g.s, e: endT, full: endT >= g.e ? 1 : 0, c: num_(g.c), rd: num_(g.rd), rp: num_(g.rp) });
  if (u.gh.length > 30) u.gh = u.gh.slice(-30);
  u.cd[is] = endT + GUARD_CD;
  rows[j][C.isle] = JSON.stringify(o); touched[j] = 1;
}
function guardSweep_(G, rows, touched, now) { Object.keys(G).forEach(function (is) { if (G[is] && num_(G[is].e) <= now) guardEnd_(G, is, rows, touched, num_(G[is].e)); }); }
function guardDrop_(r, o, rr) {
  var tot = 0, x, k = GUARD_DROP[0][0]; GUARD_DROP.forEach(function (d) { tot += d[1]; }); x = rr() * tot;
  for (var i = 0; i < GUARD_DROP.length; i++) { if (x < GUARD_DROP[i][1]) { k = GUARD_DROP[i][0]; break; } x -= GUARD_DROP[i][1]; }
  if (k === 'coin') { var n = 3 + Math.floor(rr() * 6); r[C.bal] = num_(r[C.bal]) + n; r[C.earned] = num_(r[C.earned]) + n; return { k: 'coin', n: n }; }
  if (k === 'res') { var rk = ['wood', 'stone', 'iron'][Math.floor(rr() * 3)], rn = 10 + Math.floor(rr() * 11); r[BAG_COL[rk]] = num_(r[BAG_COL[rk]]) + rn; return { k: rk, n: rn }; }
  if (k === 'bfruit') { var fn = 1 + Math.floor(rr() * 2); btOf_(o).fr += fn; return { k: 'bfruit', n: fn }; }
  if (k === 'shard') { var sb = BEASTS[Math.floor(rr() * BEASTS.length)], spp = BT_PARTS[Math.floor(rr() * 3)], bt = btOf_(o); bt.sh[sb + '.' + spp] = num_(bt.sh[sb + '.' + spp]) + 1; return { k: 'shard', n: 1, b: sb, part: spp }; }
  if (k === 'dia') { var dn = 1 + Math.floor(rr() * 2); r[C.dia] = num_(r[C.dia]) + dn; return { k: 'dia', n: dn }; }
  guOf_(o).sand++; return { k: 'sand', n: 1 };
}
/* 領一筆守護的獎勵（到 upto 為止該掉的隨機獎勵＋讀文章金幣＋守滿 3 小時的寶箱）；同一筆紀錄的每一次掉落是固定的（用種子算），不會重複拿 */
function guardPay_(r, o, rec, upto, got) {
  var due = Math.min(GUARD_DROPS, Math.floor((Math.min(upto, rec.e || upto) - rec.s) / GUARD_DROP_MS));
  for (var i = num_(rec.c); i < due; i++) got.push(guardDrop_(r, o, rng_(hash_('gd|' + rec.code + '|' + rec.is + '|' + rec.s + '|' + i))));
  rec.c = Math.max(num_(rec.c), due);
  var rc = Math.min(GUARD_READ_MAX, num_(rec.rd)) - num_(rec.rp);
  if (rc > 0) { r[C.bal] = num_(r[C.bal]) + rc; r[C.earned] = num_(r[C.earned]) + rc; rec.rp = num_(rec.rp) + rc; got.push({ k: 'read', n: rc }); }
  if (rec.full && !rec.chest) {
    rec.chest = 1; r[C.dia] = num_(r[C.dia]) + 1; got.push({ k: 'chest', n: 1 });
    var cr = rng_(hash_('gc|' + rec.code + '|' + rec.is + '|' + rec.s)), big = Math.floor(cr() * 4);
    if (big === 0) { r[C.bal] = num_(r[C.bal]) + 20; r[C.earned] = num_(r[C.earned]) + 20; got.push({ k: 'coin', n: 20 }); }
    else if (big === 1) { ['wood', 'stone', 'iron'].forEach(function (k) { r[BAG_COL[k]] = num_(r[BAG_COL[k]]) + 30; }); got.push({ k: 'res3', n: 30 }); }
    else if (big === 2) { btOf_(o).fr += 5; got.push({ k: 'bfruit', n: 5 }); }
    else { guOf_(o).sand++; got.push({ k: 'sand', n: 1 }); }
  }
}
function guardPend_(o, G, code, now) {
  var u = guOf_(o), n = 0;
  function cnt(rec, upto) { n += Math.max(0, Math.min(GUARD_DROPS, Math.floor((Math.min(upto, rec.e) - rec.s) / GUARD_DROP_MS)) - num_(rec.c)) + Math.max(0, Math.min(GUARD_READ_MAX, num_(rec.rd)) - num_(rec.rp)) + (rec.full && !rec.chest ? 1 : 0); }
  u.gh.forEach(function (h) { cnt(h, h.e); });
  Object.keys(G).forEach(function (is) { var g = G[is]; if (g && g.code === code && num_(g.e) > now) cnt(g, now); else if (g && g.code === code) cnt({ s: g.s, e: g.e, c: g.c, rd: g.rd, rp: g.rp, full: 1 }, g.e); });
  return n;
}
function gqPick_(pool, nE, nM, nH) {
  var by = { 1: [], 2: [], 3: [] }, out = [];
  pool.forEach(function (p) { var d = Math.max(1, Math.min(3, num_(p.q.d) || 2)); by[d].push(p); });
  function take(arr, n) { for (var i = 0; i < n && arr.length; i++) out.push(arr.splice(Math.floor(Math.random() * arr.length), 1)[0]); }
  take(by[1], nE); take(by[2], nM); take(by[3], nH);
  var rest = by[1].concat(by[2], by[3]); take(rest, GQ_N - out.length);
  for (var i = out.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = out[i]; out[i] = out[j]; out[j] = t; }
  return out;
}
function beastKinds_(o) { var m = {}; (o.pets || []).forEach(function (p) { if (isBeast_(p.k)) m[p.k] = 1; }); var col = o.bcol && typeof o.bcol === 'object' ? o.bcol : {}; Object.keys(col).forEach(function (k) { if (ANIMALS[k] && Array.isArray(col[k]) && col[k].length) m[k] = 1; }); return Object.keys(m).length; }
var FEED_AFF_DAY = 2; // 餵食也會加親密度：每隻寵物每天最多 +2
function decoMs_(kind, tgt) { return kind === 'tree' ? DECO_MS.tree : Math.round(DECO_MS[kind] * LV_MULT[tgt - 1]); }
function treeStage_(t, now) { var age = now - num_(t.p); return age < TREE_GROW[0] ? 0 : age < TREE_GROW[1] ? 1 : 2; }
function treeFrom_(t) { return Math.max(num_(t.lp), num_(t.p) + TREE_GROW[1]); }
function treeRipe_(t, now) { return treeStage_(t, now) < 2 ? 0 : Math.min(TREE_CAP, Math.max(0, Math.floor((now - treeFrom_(t)) / TREE_EVERY))); }
/* 距離下一個變化（長大一階或下一顆水果）還要多久；已經滿了就回 0 */
function treeNext_(t, now) {
  var st = treeStage_(t, now);
  if (st < 2) return num_(t.p) + TREE_GROW[st] - now;
  var ripe = treeRipe_(t, now);
  return ripe >= TREE_CAP ? 0 : treeFrom_(t) + (ripe + 1) * TREE_EVERY - now;
}
var VEG = {
  carrot: { name: '胡蘿蔔', seed: 1, hours: 4, n: 2, food: 20 },
  cabbage: { name: '高麗菜', seed: 2, hours: 8, n: 3, food: 35 },
  pumpkin: { name: '南瓜', seed: 3, hours: 24, n: 2, food: 60 }
};
var FRUIT_FOOD = 10, HUNGER_PER_DAY = 25, PUMPKIN_RATE = 5, WATER_BONUS = HOUR;
var ANIMALS = {
  hamster: { name: '倉鼠', cost: 10 }, rabbit: { name: '兔兔', cost: 15 }, turtle: { name: '烏龜', cost: 15 },
  dog: { name: '狗狗', cost: 20 }, cat: { name: '貓貓', cost: 20 }, parrot: { name: '鸚鵡', cost: 25 },
  fox: { name: '狐狸', cost: 40 }, panda: { name: '熊貓', cost: 60 },
  // 神獸：只能從扭蛋島抽到；不佔小屋的寵物名額
  dragon: { name: '水靈龍', cost: 0, beast: 'water' }, phoenix: { name: '火鳳凰', cost: 0, beast: 'fire' }, qilin: { name: '木麒麟', cost: 0, beast: 'wood' },
  tiger: { name: '金白虎', cost: 0, beast: 'metal' }, tortoise: { name: '土靈龜', cost: 0, beast: 'earth' }
};
function isBeast_(k) { return !!(ANIMALS[k] && ANIMALS[k].beast); }
function petCount_(o) { return o.pets.filter(function (p) { return !isBeast_(p.k); }).length; } // 佔名額的寵物（不含神獸）
/* 扭蛋島：每抽 5 枚金幣、每天 3 次；[種類, 數量, 機率權重, 扭蛋顏色] */
var GACHA_COST = 5, GACHA_DAY = 3;
var PLAY_RESET = '20261123a';   // v63：改這個字串，所有人的「今天扭蛋次數、拉霸局數」各重置一次（因應神獸試煉島上線）
var GACHA = [['fruit', 10, 11, 'w'], ['wood', 20, 15, 'g'], ['stone', 20, 15, 'g'], ['iron', 20, 15, 'g'], ['coin', 15, 10, 'b'], ['dia', 1, 10, 'p'], ['dia', 3, 3, 'y'], ['beast', 1, 6, 'r'], ['shard', 1, 10, 'p'], ['bfruit', 2, 5, 'g']];   // v62：水果 26→11，新增神獸碎片 10%、神獸果 ×2 5%   // 第三欄是機率（%），合計 100
var BEASTS = ['dragon', 'phoenix', 'qilin', 'tiger', 'tortoise'];
var BEAST_SELL = { wood: 66, stone: 66, iron: 66, dia: 6 };   // 重複的神獸到商店島換資源
var BEAST_SELL_IV = 2;   // v62：換資源依個體值加成，IV 每 1 點木、石、鐵各多 2
/* v62 神獸試煉島：碎片（5 隻神獸 × 頭身腳）、合成、個體值 IV（0～31）、神獸果（只有神獸能吃，親密度 +5） */
var BT_PARTS = ['head', 'body', 'foot'], BT_SHARD_DAY = 5, BT_FRUIT_DAY = 5, BT_FORGE = 40, BT_PITY = 20;
var BT_FRUIT_AFF = 5, BT_FEED_DAY = 2, BEAST_LV_MAX = 10, SLOT_FRUIT_P = 0.08, SLOT_FRUIT_DAY = 3, SLOT_SHARD_P = 0.03, SLOT_SHARD_DAY = 1, BT_GAP = 6 * 1000;   // v69：試煉兩場結算間隔 15→6 秒（8 題不可能 6 秒內答完）
function partRoll_() { var x = Math.random() * 100; return x < 20 ? 'head' : x < 60 ? 'body' : 'foot'; }   // 頭 20%、身 40%、腳 40%
function ivRoll_() { return Math.floor(Math.random() * 32); }
/* v78 試煉島召喚靠自己答題，IV 保底：難度 1 起 15、每升一級 +3（難度 5 起 27）；扭蛋維持 0～31 隨機 */
function ivFloor_(d) { return 12 + 3 * Math.max(1, Math.min(5, d)); }
function ivTrial_(d) { var lo = ivFloor_(d); return lo + Math.floor(Math.random() * (32 - lo)); }
/* v78 試煉難度只算「自己在試煉島召喚成功過」的種類（bt.earn）；扭蛋抽到、好友送的都不算 */
function earnN_(b) { return BEASTS.filter(function (k) { return b.earn && b.earn[k]; }).length; }
/* 神獸的個體值：新拿到的存在 p.iv；舊的（v62 以前抽到的）用寵物編號算一個固定值，不會每次不一樣 */
function ivOf_(p) { return p && p.iv != null && isFinite(p.iv) ? Math.max(0, Math.min(31, Math.floor(Number(p.iv)))) : hash_('iv|' + String(p && p.id || '')) % 32; }
function btOf_(o) {
  var b = o.bt && typeof o.bt === 'object' ? o.bt : {}, td = day_();
  b.sh = b.sh && typeof b.sh === 'object' ? b.sh : {}; b.pity = b.pity && typeof b.pity === 'object' ? b.pity : {}; b.fr = num_(b.fr);
  if (b.d !== td) { b.d = td; b.st = 0; b.ft = 0; b.sf = 0; b.ss = 0; }
  b.ss = num_(b.ss);   // v73：今天從拉霸掉到的碎片數
  b.earn = b.earn && typeof b.earn === 'object' ? b.earn : {};   // v78
  b.receipts = Array.isArray(b.receipts) ? b.receipts.slice(-60) : [];
  o.bt = b; return b;
}
function btPub_(o) {
  var b = btOf_(o), kinds = earnN_(b);
  return { sh: b.sh, fr: b.fr, pity: b.pity, st: num_(b.st), ft: num_(b.ft), sf: num_(b.sf), ss: num_(b.ss), kinds: kinds, earn: BEASTS.filter(function (k) { return b.earn[k]; }), ivFloor: ivFloor_(kinds + 1),
    max: { shard: BT_SHARD_DAY, fruit: BT_FRUIT_DAY, slot: SLOT_FRUIT_DAY, slotShard: SLOT_SHARD_DAY, feed: BT_FEED_DAY, lv: BEAST_LV_MAX }, forge: BT_FORGE, pityStep: BT_PITY };
}
/* 神獸收藏改成一隻一隻記（isle.bcol = {種類: [{iv, aff}]}），isle.bbag 的數量跟著同步；舊的只有數量，就補上固定的 IV */
function bcolOf_(o) {
  var bag = bbagOf_(o), src = o.bcol && typeof o.bcol === 'object' ? o.bcol : null, out = {};
  BEASTS.forEach(function (k) {
    var arr = src && Array.isArray(src[k]) ? src[k].filter(function (x) { return x && typeof x === 'object'; }).map(function (x) { var y = { iv: ivOf_(x), aff: num_(x.aff) }; if (x.sh) y.sh = 1; if (x.aw) y.aw = 1; return y; }) : [];
    if (!src) for (var i = 0; i < num_(bag[k]); i++) arr.push({ iv: hash_('bcol|' + k + '|' + i) % 32, aff: 0 });
    if (arr.length) out[k] = arr;
  });
  return out;
}
function bcolSet_(o, col) { o.bcol = {}; o.bbag = {}; BEASTS.forEach(function (k) { if (col[k] && col[k].length) { o.bcol[k] = col[k]; o.bbag[k] = col[k].length; } }); }
var BEAST_BASE = { dragon: 105, phoenix: 85, qilin: 100, tiger: 90, tortoise: 120 };   // 與前端 BEAST_BASE 一致
function beastHp_(k, iv, lv) { return Math.round((BEAST_BASE[k] || 100) * (1 + iv / 31 * 0.5) * (1 + (lv - 1) * 0.15)); }
function lowIdx_(arr) { var b = 0; arr.forEach(function (x, i) { if (x.iv < arr[b].iv) b = i; }); return b; }
/* 喜報跑馬燈：船長得到神獸就記一筆（工作表「喜報」），地圖與扭蛋島顯示最近 24 小時、最多 10 則；v70 多記「來源」：gacha＝扭蛋島、trial＝試煉島召喚 */
var BN_HEAD = ['時間', '暱稱', '神獸', '收藏', '來源'], BN_KEEP = 10, BN_HOURS = 24;
function bnews_() {
  var hit = cget_('bnews'); if (hit) return hit;
  var sh = sheet_('喜報', BN_HEAD), n = sh.getLastRow() - 1, out = [], since = Date.now() - BN_HOURS * 3600000;
  if (n > 0) {
    var v = sh.getRange(Math.max(2, n + 2 - 30), 1, Math.min(n, 30), BN_HEAD.length).getValues();
    for (var x = v.length - 1; x >= 0 && out.length < BN_KEEP; x--) {
      var t = +new Date(v[x][0]), b = String(v[x][2]);
      if (!t || t < since || !ANIMALS[b]) continue;
      out.push({ t: t, nick: plain_(v[x][1]), b: b, name: ANIMALS[b].name, dup: v[x][3] === '是' ? 1 : 0, src: String(v[x][4] || '') });
    }
  }
  cput_('bnews', out, 300);
  return out;
}
function bnewsAdd_(nick, b, dup, src) {
  sheet_('喜報', BN_HEAD).appendRow([new Date(), String(nick || '船長'), b, dup ? '是' : '', src || '']);
  /* v67：新神獸住進小島時，官方自動在留言碼頭發一篇喜報（重複的不發） */
  if (!dup && ANIMALS[b]) { try {
    sheet_('留言板', M_HEAD).appendRow(['M' + Date.now().toString(36).toUpperCase() + 'BN', new Date(), '論壇資源島', 'SYSTEM', '🎉', '🎉 喜報：恭喜船長「' + plain_(nick || '船長') + '」得到五行神獸「' + ANIMALS[b].name + '」，已經住進小島、點亮五行神殿！大家也到 🐲 神獸試煉島、🎁 扭蛋島試試手氣吧～', '', '', '', '']);
    bump_('msgs');
  } catch (e) {} }
  CacheService.getScriptCache().remove('bnews');
}
/* 重複抽到的神獸先收在「神獸收藏」（isle.bbag）；可以送給好友，或到商店換資源 */
function bbagOf_(o) { var b = o.bbag && typeof o.bbag === 'object' ? o.bbag : {}, out = {}; BEASTS.forEach(function (k) { if (num_(b[k]) > 0) out[k] = num_(b[k]); }); return out; }
/* 收到一隻神獸：沒有就住進小島，有了就放進收藏 */
function beastGive_(o, k, iv, aff) {
  o.pets = Array.isArray(o.pets) ? o.pets : [];
  iv = iv == null ? ivRoll_() : iv; aff = num_(aff);
  var shn = Math.random() < SHINY_P ? 1 : 0;   // v83 異色神獸 1%
  o.lastShiny = shn;
  var cur = null; o.pets.forEach(function (x) { if (x.k === k) cur = x; });
  if (cur) {   /* v62：已經有同一種 → IV 高的住小島，另一隻（連同親密度）放進收藏；v83 覺醒過的不換下來 */
    var col = bcolOf_(o), civ = ivOf_(cur);
    col[k] = col[k] || [];
    if (iv > civ && !cur.aw) { var old = { iv: civ, aff: num_(cur.aff) }; if (cur.sh) old.sh = 1; col[k].push(old); cur.iv = iv; cur.aff = aff; if (shn) cur.sh = 1; else delete cur.sh; bcolSet_(o, col); return 'swap'; }
    var nw = { iv: iv, aff: aff }; if (shn) nw.sh = 1; col[k].push(nw); bcolSet_(o, col); return 'bag';
  }
  var t = Date.now(), np = { id: 'P' + t.toString(36).toUpperCase() + 'B' + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), k: k, n: ANIMALS[k].name, full: 80, ft: t, aff: aff, pd: 0, iv: iv };
  if (shn) np.sh = 1; o.pets.push(np);
  return 'pet';
}
/* v78 送神獸要對方接受：神獸先從送的人收藏扣下來，放在收禮人的 isle.bin（待接收）；送的人記在 isle.bout。
   收禮人選「住進小島」或「收藏起來」，或婉拒（退回）；7 天沒回應自動退回送的人 */
var BGIFT_DAYS = 7, BIN_MAX = 10;
function binOf_(o) { o.bin = Array.isArray(o.bin) ? o.bin.filter(function (x) { return x && x.id && isBeast_(x.k); }) : []; return o.bin; }
function boutOf_(o) { o.bout = Array.isArray(o.bout) ? o.bout.filter(function (x) { return x && x.id; }) : []; return o.bout; }
function colPut_(o, k, iv, aff) { var col = bcolOf_(o); col[k] = col[k] || []; col[k].push({ iv: iv, aff: num_(aff) }); bcolSet_(o, col); }
/* 收禮人選「住進小島」：島上沒有就住進去；已經有同一種 → 新的上島，原本那隻（連同親密度）放進收藏 */
function beastPlace_(o, k, iv, aff) {
  o.pets = Array.isArray(o.pets) ? o.pets : [];
  var cur = null; o.pets.forEach(function (x) { if (x.k === k) cur = x; });
  if (cur) { colPut_(o, k, ivOf_(cur), cur.aff); cur.iv = iv; cur.aff = num_(aff); return 'swap'; }
  var t = Date.now(); o.pets.push({ id: 'P' + t.toString(36).toUpperCase() + 'B' + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), k: k, n: ANIMALS[k].name, full: 80, ft: t, aff: num_(aff), pd: 0, iv: iv });
  return 'pet';
}
function binPub_(o) { var now = Date.now(); return binOf_(o).map(function (g) { return { id: g.id, k: g.k, iv: num_(g.iv), nick: plain_(g.nick), left: Math.max(0, BGIFT_DAYS * 86400000 - (now - num_(g.t))) }; }); }
function giftNote_(fromRow, toRow, text) { sheet_('悄悄話', N_HEAD).appendRow([new Date(), fromRow[C.fid], fromRow[C.nick], toRow[C.fid], toRow[C.nick], text]); }
/* 過期的贈禮退回送的人（收禮人或送的人有寫入動作時順便檢查） */
function giftSweep_(rows, i, touched) {
  var r = rows[i], raw = String(r[C.isle] || '');
  if (raw.indexOf('"bin"') < 0 && raw.indexOf('"bout"') < 0) return;
  var o = isleOf_(r), now = Date.now(), lim = BGIFT_DAYS * 86400000, ch = false, bin = binOf_(o), bout = boutOf_(o);
  for (var x = bin.length - 1; x >= 0; x--) {
    var g = bin[x]; if (now - num_(g.t) < lim) continue;
    bin.splice(x, 1); ch = true;
    var js = findFid_(rows, g.from); if (js < 0 || js === i) continue;
    var so = isleOf_(rows[js]); colPut_(so, g.k, num_(g.iv), 0); so.bout = boutOf_(so).filter(function (b) { return b.id !== g.id; });
    rows[js][C.isle] = JSON.stringify(so); rows[js][C.unread] = num_(rows[js][C.unread]) + 1; touched[js] = 1;
    giftNote_(r, rows[js], '↩️ 你送的神獸「' + ANIMALS[g.k].name + '」' + BGIFT_DAYS + ' 天沒被領取，已退回你的神獸收藏。');
  }
  for (var y = bout.length - 1; y >= 0; y--) {
    var b = bout[y]; if (now - num_(b.t) < lim) continue;
    bout.splice(y, 1); ch = true;
    var jr = findFid_(rows, b.to); if (jr < 0 || jr === i) continue;
    var ro = isleOf_(rows[jr]), rb = binOf_(ro), hit = -1; rb.forEach(function (gg, z) { if (gg.id === b.id) hit = z; });
    if (hit < 0) continue;
    var back = rb.splice(hit, 1)[0]; colPut_(o, back.k, num_(back.iv), 0); rows[jr][C.isle] = JSON.stringify(ro); touched[jr] = 1;
    r[C.unread] = num_(r[C.unread]) + 1;
    giftNote_(rows[jr], r, '↩️ 你送的神獸「' + ANIMALS[back.k].name + '」' + BGIFT_DAYS + ' 天沒被領取，已退回你的神獸收藏。');
  }
  if (ch) r[C.isle] = JSON.stringify(o);
}
/* v78 一次性搬移：難度改看 bt.earn。現有的神獸照舊算（看當下小島上的種類），但確定是好友送的（悄悄話有送神獸紀錄）不算 */
/* v83 新玩法公告：部署後第一個寫入動作時，官方在留言碼頭貼一篇（ScriptProperties 記住，只貼一次） */
function ann83_() {
  var props; try { props = PropertiesService.getScriptProperties(); } catch (e) { return; }
  if (props.getProperty('ann83')) return;
  props.setProperty('ann83', '1');
  try { sheet_('留言板', M_HEAD).appendRow(['M' + Date.now().toString(36).toUpperCase() + 'AN', new Date(), '論壇資源島', 'SYSTEM', '📢', '🆕 新玩法上線：我的小島大升級＋神獸新玩法！\n\n🏝️ 擴地 Lv1～4：島變大，開放新設施\n・擴地 Lv2：🪚 伐木場、⛏️ 採石場、📦 倉庫\n・擴地 Lv3：⚒️ 鍛鐵爐、🍳 料理小屋、🎣 釣魚碼頭\n・擴地 Lv4：📐 CAD 繪圖工作室\n🪚⛏️⚒️ 生產設施會自動產出木材、石頭、鐵礦，存滿就停，記得回來收；📦 倉庫讓存放上限變大\n🎣 釣魚碼頭：魚標游到綠色區按「拉竿」，可以釣到魚、物資、金幣，運氣好還有神獸果或鑽石\n🍳 料理小屋：用水果、蔬菜、魚做料理餵寵物，飽足度更高\n📐 CAD 繪圖工作室：接設計案，畫好交稿拿金幣（大案子有鑽石）\n🌸 花園裝飾 8 樣：買一次就擺好，島主分加分\n🏆 榮譽紀念碑：完成成就，紀念碑自動長高\n\n⛩️ 五行神殿可以升級 Lv1～4（要先收集到足夠種類的神獸）：\n・Lv1 📖 神獸圖鑑：集滿送鑽石、神獸果，還有隱藏的 ✨ 異色神獸（召喚時 1%）\n・Lv2 🧬 神獸技能：島上的神獸幫你種菜、生產更快\n・Lv3 🏯 五行塔：在 🐲 神獸試煉島挑戰，每週 30 層、每 5 層一個魔王\n・Lv4 🔥 神獸覺醒：Lv10 的神獸可以覺醒，技能加倍\n\n到 🏝️ 我的小島「🏗️ 建造」開始吧！', '', '', '', '', '', '']); bump_('msgs'); } catch (e) {}
}
/* v86 站長要求：公告拿掉「分類選單」那一行（只做一次） */
function ann86_() {
  var props; try { props = PropertiesService.getScriptProperties(); } catch (e) { return; }
  if (props.getProperty('ann86')) return;
  props.setProperty('ann86', '1');
  try {
    var sh = sheet_('留言板', M_HEAD), n = sh.getLastRow() - 1; if (n < 1) return;
    var v = sh.getRange(2, 1, n, M_HEAD.length).getValues();
    for (var x = v.length - 1; x >= 0; x--) {
      if (/AN$/.test(String(v[x][0])) && String(v[x][5]).indexOf('新玩法上線') >= 0) {
        var t = String(v[x][5]).split('\n').filter(function (l) { return l.indexOf('我的小島改成分類選單') < 0; }).join('\n');
        if (t !== String(v[x][5])) { v[x][5] = t; sh.getRange(x + 2, 1, 1, M_HEAD.length).setValues([v[x]]); bump_('msgs'); }
        return;
      }
    }
  } catch (e) {}
}
/* v85 站長要求：上線時直接編輯更新 11/28 那篇新玩法公告（不另貼新的），留下修改時間；只做一次 */
function ann85_() {
  var props; try { props = PropertiesService.getScriptProperties(); } catch (e) { return; }
  if (props.getProperty('ann85')) return;
  props.setProperty('ann85', '1');
  try {
    var sh = sheet_('留言板', M_HEAD), n = sh.getLastRow() - 1; if (n < 1) return;
    var v = sh.getRange(2, 1, n, M_HEAD.length).getValues();
    for (var x = v.length - 1; x >= 0; x--) {
      if (/AN$/.test(String(v[x][0])) && String(v[x][5]).indexOf('新玩法上線') >= 0) {
        v[x][5] = "🆕 新玩法上線：我的小島大升級＋神獸新玩法＋神獸分靈守護島！（11/29 更新）\n\n🏝️ 擴地 Lv1～4：島變大，開放新設施，小屋／噴水池／瞭望塔的最高等級也跟著提高（小屋最高 Lv16、噴水池瞭望塔最高 Lv14）\n・擴地 Lv2：🪚 伐木場、⛏️ 採石場、📦 倉庫（要先有 ⛵ 彩旗帆船）\n・擴地 Lv3：⚒️ 鍛鐵爐、🍳 料理小屋、🎣 釣魚碼頭（要先有 ⛵ 海盜大帆船）\n・擴地 Lv4：📐 CAD 繪圖工作室（要先有 ⛵ 商賈雙桅船）\n🪚⛏️⚒️ 生產設施自動產出木材、石頭、鐵礦，存滿就停；📦 倉庫讓存放上限變大\n🎣 釣魚碼頭、🍳 料理小屋、📐 CAD 繪圖工作室、🌸 花園裝飾、🏆 榮譽紀念碑\n\n⛩️ 五行神殿 Lv1～4（要先收集神獸種類；Lv4 還要 ⛵ 皇家旗艦）：\n・Lv1 📖 神獸圖鑑（含隱藏的 ✨ 異色神獸）・Lv2 🧬 神獸技能＋🛡️ 守護試煉・Lv3 🏯 五行塔＋✨ 結界砂・Lv4 🔥 神獸覺醒\n\n🛡️ 神獸分靈守護島（新！）：\n・每座論壇教學島都有一個守護位子，回答這座島的文章題目（每份 8 題，答對 6 題通過），就能放上你的神獸分靈守護 3 小時\n・分數比現任守護者高（同分比速度）就能換下他；每座島每天可以挑戰 3 次\n・守護期間每 30 分鐘掉一次隨機獎勵（金幣、物資、神獸果、碎片、鑽石、結界砂），有人來讀文章再加金幣，守滿 3 小時還有守護寶箱\n・✨ 五行結界砂：撒在你守護的島上，結界期間別人不能挑戰\n・🌌 靈脈試煉：讓一隻神獸最多分靈 3 隻，守護更多島\n・讀越多文章，越容易佔領！挑你擅長的島去攻略吧\n\n💎 鑽石新用途：施工 💎1 立即完成、💎2 再挑戰一次（五行塔、守護試煉）、💎3 換 1 把結界砂，高等級建築也要用鑽石\n\n到 🏝️ 我的小島「🏗️ 建造」開始吧！"; v[x][11] = new Date();
        sh.getRange(x + 2, 1, 1, M_HEAD.length).setValues([v[x]]); bump_('msgs'); return;
      }
    }
  } catch (e) {}
}
function migrate78_(sh, rows) {
  var props; try { props = PropertiesService.getScriptProperties(); } catch (e) { return; }   // 測試環境沒有 PropertiesService
  if (props.getProperty('mig78')) return;
  var gifted = {}, nameK = {}; BEASTS.forEach(function (k) { nameK[ANIMALS[k].name] = k; });
  var ns = sheet_('悄悄話', N_HEAD), nn = ns.getLastRow() - 1;
  if (nn > 0) ns.getRange(2, 1, nn, N_HEAD.length).getValues().forEach(function (v) {
    var m = /^🐲 送你一隻神獸「([^」]+)」/.exec(String(v[5])); if (m && nameK[m[1]]) { var to = String(v[3]); (gifted[to] = gifted[to] || {})[nameK[m[1]]] = 1; }
  });
  rows.forEach(function (r, x) {
    var raw = String(r[C.isle] || ''); if (raw.indexOf('"pets"') < 0) return;
    var o = isleOf_(r), b = btOf_(o), g = gifted[String(r[C.fid])] || {}, e = {}, any = false;
    (o.pets || []).forEach(function (p) { if (isBeast_(p.k) && !g[p.k]) { e[p.k] = 1; any = true; } });
    if (!any && !Object.keys(g).length) return;
    b.earn = e; r[C.isle] = JSON.stringify(o); sh.getRange(x + 2, 1, 1, P_HEAD.length).setValues([r]);
  });
  props.setProperty('mig78', String(Date.now()));
}
var BAG_COL = { fruit: C.fruit, iron: C.iron, wood: C.wood, stone: C.stone, dia: C.dia };
/* 留言碼頭與悄悄話 */
var LOCK_WAIT = 15000;
var LIKE_DAY = 100, LIKE_GAP = 2000;   // v76：按讚每天最多 100 次、兩次至少隔 2 秒（不算在留言額度）   // v75：等寫入鎖最多 15 秒
var MSG_LEN = 300, MSG_DAY = 10, MSG_GAP = 60 * 1000, MSG_PAGE = 20;
var MSG_IMG_MAX = 400000, MSG_IMG_CHUNK = 45000;   // v59 圖片 base64 上限（前台先縮到 1024px JPEG）；每格最多 45000 字（試算表一格上限 50000）
var NOTE_LEN = 300, NOTE_DAY = 20;   // v80 100 → 300 字，網址比較放得下

/* ---------- 漂流寶物（隨機出現在各座島的金幣、鑽石）與每日任務 ---------- */
var DROP_SLOT = 15 * 60 * 1000;   // 每 15 分鐘換一批
var DROP_GRACE = 90 * 1000;       // 換批後 90 秒內，上一批還可以撿（網路慢的緩衝）
var DROP_COINS = 3;               // 每批有幾座島出現金幣
var DROP_DIA_CHANCE = 0.5;        // 每批另外有一座島出現鑽石的機率
var DROP_COIN_DAY = 4, DROP_DIA_DAY = 2;   // 每人每天最多撿幾枚金幣、幾顆鑽石
var DROP_SALT = 'isle-drop-v1';
/* v72 寶箱：常來、而且真的有在操作的人才撿得到。網頁只在「開著＋3 分鐘內有點擊／捲動」時累計在線時間，
   每 15 分鐘（新來訪只要 5 分鐘）跳出一個寶箱；伺服器再檢查：兩個寶箱至少隔 CHEST_GAP、每天最多 CHEST_DAY 個、最近 ONLINE_WIN 內有實際操作 */
var CHEST_DAY = 4, CHEST_GAP = 5 * 60 * 1000;
var CHEST = [['coin', 3, 5, 30], ['wood', 5, 15, 20], ['iron', 5, 15, 20], ['stone', 5, 15, 20], ['dia', 1, 3, 7], ['shard', 1, 1, 3]];   // [種類, 最少, 最多, 機率%]
function chestRoll_() {
  var tot = 0, x; CHEST.forEach(function (c) { tot += c[3]; }); x = Math.random() * tot;
  for (var i = 0; i < CHEST.length; i++) { x -= CHEST[i][3]; if (x < 0) return CHEST[i]; }
  return CHEST[0];
}
var QUEST_N = 3, QUEST_COIN = 1;  // 每天 3 個任務，每個 1 枚金幣
/* 網站地圖上每座島的代號（和網頁的 ISLAND_KEYS 一致；新增島嶼時要一起加） */
var DROP_SPOTS = [
  'home', 'mine', 'search', 'msg', 'qa-0', 'isle-beginner',
  'qa-1', 'res-0', 'isle-cad2d', 'qa-2', 'game', 'isle-quiz',
  'qa-3', 'pets', 'res-1', 'isle-cad3d', 'qa-4', 'isle-f44',
  'qa-5', 'isle-videos', 'res-2', 'qa-6', 'isle-advanced', 'qa-7',
  'isle-courses', 'res-3', 'qa-8', 'isle-realtime', 'isle-announce', 'isle-career',
  'isle-plugins', 'castle', 'dock', 'shop',
  'res-4', 'res-5', 'res-6', 'res-7', 'res-8', 'res-9', 'res-10', 'res-11', 'res-12', 'res-13', 'res-14', 'res-15', 'res-16', 'res-17', 'res-18', 'res-19'
];
function hash_(str) {
  var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (var i = 0; i < str.length; i++) { var ch = str.charCodeAt(i); h1 = Math.imul(h1 ^ ch, 2654435761); h2 = Math.imul(h2 ^ ch, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h1 ^ h2) >>> 0;
}
function rng_(seed) {
  var a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function dropSlot_() { return Math.floor(Date.now() / DROP_SLOT); }
/* 這一批有哪些寶物：由批次編號算出來，不用存；每位玩家各撿各的，不用搶 */
function dropAt_(slot) {
  var rnd = rng_(hash_(DROP_SALT + '|' + slot)), keys = DROP_SPOTS.slice(), out = [];
  for (var i = 0; i < DROP_COINS && keys.length; i++) out.push({ k: keys.splice(Math.floor(rnd() * keys.length), 1)[0], t: 'c' });
  if (rnd() < DROP_DIA_CHANCE && keys.length) out.push({ k: keys.splice(Math.floor(rnd() * keys.length), 1)[0], t: 'd' });
  return out;
}
function dropsPub_() {
  var slot = dropSlot_();
  return { ok: true, slot: slot, left: (slot + 1) * DROP_SLOT - Date.now(), list: dropAt_(slot), max: { c: DROP_COIN_DAY, g: DROP_DIA_DAY } };
}
var QUESTS = {
  gather3: { e: '⛏️', t: '在物資島採集 3 次', chk: function (r) { var c = counts_(r[C.gToday]), n = 0; Object.keys(c).forEach(function (k) { n += c[k]; }); return n >= 3; } },
  trade1: { e: '🏪', t: '到兌換所換 1 次',
    ok: function (r) { var b = bag_(r), m = 0; Object.keys(b).forEach(function (k) { m = Math.max(m, b[k]); }); return m >= TRADE_RATE || num_(r[C.dia]) >= 1; },
    chk: function (r, o) { return num_(r[C.trades]) >= 1 || (!!o && !!o.xd && o.xd.d === day_() && num_(o.xd.ds) >= 1); } },
  msg1: { e: '📮', t: '在留言碼頭留言 1 次', chk: function (r) { return num_(r[C.msgN]) >= 1; } },
  water1: { e: '💧', t: '幫好友的菜園澆水 1 次', ok: function (r) { return list_(r[C.friends]).length >= 1; },
    chk: function (r, o) { return !!o.wd && o.wd.d === day_() && o.wd.f.length >= 1; } },
  gift1: { e: '🎁', t: '送好友一份禮物', ok: function (r) { return list_(r[C.friends]).length >= 1; }, chk: function (r) { return list_(r[C.gifts]).length >= 1; } },
  pat1: { e: '🐾', t: '摸摸小島上的寵物', ok: function (r, o) { return o.pets.length >= 1; },
    chk: function (r, o) { return o.pets.some(function (p) { return num_(p.pd) === day_(); }); } },
  visit2: { e: '🧭', t: '拜訪 2 座不同的島', chk: function (r, o) { return !!o.q && o.q.d === day_() && o.q.v.length >= 2; } },
  drop1: { e: '✨', t: '撿到 1 個漂流寶物', chk: function (r, o) { return !!o.dr && o.dr.d === day_() && (num_(o.dr.c) + num_(o.dr.g)) >= 1; } }
};
/* 每人每天從「做得到的任務」裡抽 3 個，抽好就存起來（當天不會變） */
function pickQuests_(r, o) {
  var pool = Object.keys(QUESTS).filter(function (k) { return !QUESTS[k].ok || QUESTS[k].ok(r, o); });
  var rnd = rng_(hash_(String(r[C.code]) + '|' + day_() + '|q')), out = [];
  while (out.length < QUEST_N && pool.length) out.push(pool.splice(Math.floor(rnd() * pool.length), 1)[0]);
  return out;
}
function qState_(o, r) {
  if (o.q && o.q.d === day_() && Array.isArray(o.q.ids)) return false;
  o.q = { d: day_(), ids: pickQuests_(r, o), done: [], v: [] };
  return true;
}
function questSync_(r) {
  var o = isleOf_(r);
  if (qState_(o, r)) r[C.isle] = JSON.stringify(o);
}

/* ---------- 工作表 ---------- */
var SHEETS_ = {};
var SS_ = null;
function ss_() { return SS_ || (SS_ = SpreadsheetApp.getActive()); }
function sheet_(name, head) {
  if (SHEETS_[name]) return SHEETS_[name]; // 同一次執行只檢查一次標題列，省下重複讀取
  var sh = ss_().getSheetByName(name);
  var hk = 'hdr:' + name + ':' + hash_(head.join('|')); // 標題列檢查過就記 6 小時（標題改版時 hash 會變，會重新檢查）
  if (!sh) {
    sh = ss_().insertSheet(name);
    if (name === '玩家' || name === '邀請碼') sh.getRange('A:A').setNumberFormat('@'); // 登島碼、邀請碼一律當文字
    cdel_(hk);
  }
  if (!cget_(hk)) {
    var cur = sh.getRange(1, 1, 1, head.length).getValues()[0];
    if (cur.join('|') !== head.join('|')) {
      sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setBackground('#ffe8a3');
      sh.setFrozenRows(1);
    }
    cput_(hk, 1, 21600);
  }
  SHEETS_[name] = sh;
  return sh;
}
function players_() { return sheet_('玩家', P_HEAD); }
function rows_(sh) {
  var n = sh.getLastRow() - 1;
  return n > 0 ? sh.getRange(2, 1, n, P_HEAD.length).getValues() : [];
}
function find_(rows, code) {
  code = String(code || '').toUpperCase();
  if (!code) return -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][C.code]).toUpperCase() === code) return i;
  return -1;
}
function findFid_(rows, fid) {
  fid = String(fid || '').replace(/[^0-9A-Z]/gi, '').toUpperCase();
  if (!fid) return -1;
  for (var i = 0; i < rows.length; i++) if (String(rows[i][C.fid]).toUpperCase() === fid) return i;
  return -1;
}

/* ---------- 快取（Google CacheService）：留言、造訪紀錄、站長名單 ---------- */
function cget_(k) { try { var v = CacheService.getScriptCache().get(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function cput_(k, v, sec) { try { CacheService.getScriptCache().put(k, JSON.stringify(v), sec); } catch (e) {} }
function cdel_(k) { try { CacheService.getScriptCache().remove(k); } catch (e) {} }
function ver_(name) { return cget_('ver:' + name) || 0; }
function bump_(name) { cput_('ver:' + name, ver_(name) + 1, 21600); } // 在鎖裡面呼叫，不會同時加

/* ---------- 工具 ---------- */
function day_(offset) {
  return Number(Utilities.formatDate(new Date(Date.now() + (offset || 0) * 86400000), TZ, 'yyyyMMdd'));
}
function num_(v) { v = Math.floor(Number(v)); return isFinite(v) && v >= 0 && v < 1e15 ? v : 0; }
function text_(s, n) {
  s = String(s == null ? '' : s).replace(/[<>\r\n\t]/g, ' ').trim().slice(0, n || 80);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
/* 留言內容：保留換行（最多連續 2 個），網站顯示時會再跳脫 */
function body_(s, n) {
  s = String(s == null ? '' : s).replace(/\r\n?/g, '\n').replace(/[\t\u0000-\u0008\u000b-\u001f]/g, ' ')
    .replace(/\n{3,}/g, '\n\n').trim().slice(0, n);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}
function plain_(v) { return String(v == null ? '' : v).replace(/^'/, ''); }
function cleanNick_(s) { return String(s || '').replace(/[<>\r\n\t=+@]/g, '').replace(/\s+/g, ' ').trim().slice(0, 12); }
function nickKey_(s) { return String(s).replace(/^'/, '').replace(/\s+/g, '').toLowerCase(); }
function nickTaken_(rows, nick, exceptIdx) {
  var k = nickKey_(nick);
  for (var i = 0; i < rows.length; i++) if (i !== exceptIdx && nickKey_(rows[i][C.nick]) === k) return true;
  return false;
}
function rand_(n) { var s = ''; for (var i = 0; i < n; i++) s += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length)); return s; }
function newCode_(rows) { for (;;) { var c = rand_(6); if (find_(rows, c) < 0) return c; } }
function newFid_(rows) { for (;;) { var c = rand_(5); if (findFid_(rows, c) < 0) return c; } }
function newRow_(code, nick, admin, init, fid) {
  var now = new Date(), r = [];
  for (var i = 0; i < P_HEAD.length; i++) r.push('');
  r[C.code] = code; r[C.nick] = text_(nick, 12); r[C.bal] = init; r[C.earned] = init; r[C.streak] = 0; r[C.last] = 0;
  r[C.first] = now; r[C.seen] = now; r[C.dls] = 0; r[C.admin] = admin ? '是' : ''; r[C.day] = day_();
  r[C.onl] = 0; r[C.rd] = 0; r[C.qa] = 0; r[C.fid] = fid;
  r[C.isle] = JSON.stringify({h:1, fields:1, starterTree:true, starterGuide:0, starterWood:true});
  return r;
}
function list_(v) { return plain_(v).split(',').filter(String); }
/* 今日計數「fruit:2,iron:1」 */
function counts_(v) {
  var o = {};
  plain_(v).split(',').forEach(function (p) { var kv = p.split(':'); if (kv[0]) o[kv[0]] = num_(kv[1]); });
  return o;
}
function countsStr_(o) { return Object.keys(o).map(function (k) { return k + ':' + o[k]; }).join(','); }
function xd_(io) { var t = day_(); if (!io.xd || io.xd.d !== t) io.xd = { d: t, sw: 0, ds: 0, b: {} }; if (!io.xd.b || typeof io.xd.b !== 'object') io.xd.b = {}; return io.xd; }   // 小島資料裡的「今天交易次數」
function bag_(r) { return { fruit: num_(r[C.fruit]), iron: num_(r[C.iron]), wood: num_(r[C.wood]), stone: num_(r[C.stone]) }; }
function profile_(r) {
  var io = isleOf_(r), pd = day_(), cur = String(dropSlot_());
  return { code: String(r[C.code]), nick: plain_(r[C.nick]), bal: num_(r[C.bal]), earned: num_(r[C.earned]),
    streak: num_(r[C.streak]), admin: r[C.admin] === '是', qa: list_(r[C.qaDone]),
    av: plain_(r[C.av]), fid: String(r[C.fid] || ''), bag: bag_(r), dia: num_(r[C.dia]),
    tres: num_(r[C.tres]), tdia: num_(r[C.tdia]), today: counts_(r[C.gToday]), gLast: num_(r[C.gLast]),
    trades: num_(r[C.trades]), tradeMax: TRADE_MAX,
    swaps: io.xd && io.xd.d === pd ? num_(io.xd.sw) : 0, swapMax: SWAP_DAY, diaSells: io.xd && io.xd.d === pd ? num_(io.xd.ds) : 0, diaSellMax: DIA_SELL_DAY,
    buys: io.xd && io.xd.d === pd && io.xd.b ? io.xd.b : {}, buyMax: BUY_DAY, diaBuyMax: DIA_BUY_DAY, bbag: bbagOf_(io), bsell: BEAST_SELL, bsellIv: BEAST_SELL_IV, bcol: bcolOf_(io), bt: btPub_(io), bin: binPub_(io), unread: num_(r[C.unread]), friends: list_(r[C.friends]).length, fl: list_(r[C.friends]).map(String), // fl：好友的好友碼（排行榜標「好友」用）
    veg: io.veg, score: isleScore_(io), ship: io.ship, pg: !!io.pg, starterGuide:io.starterGuide===0?0:1,
    cd: (function () { var m = {}, nw = Date.now(); Object.keys(io.cd).forEach(function (k) { m[k] = Math.ceil((io.cd[k] - nw) / 1000); }); return m; })(),
    open: r[C.open] !== '否', annSeen: num_(r[C.annSeen]), ann: r[C.admin] === '是' || r[C.ann] === '是',
    dr: io.dr && io.dr.d === pd && Array.isArray(io.dr.k)
      ? { c: num_(io.dr.c), g: num_(io.dr.g), k: io.dr.k.filter(function (x) { return x.split(':')[0] === cur; }).map(function (x) { return x.split(':')[1]; }) }
      : { c: 0, g: 0, k: [] },
    drMax: { c: DROP_COIN_DAY, g: DROP_DIA_DAY },
    qs: io.q && io.q.d === pd && Array.isArray(io.q.ids)
      ? io.q.ids.filter(function (id) { return QUESTS[id]; }).map(function (id) { return { id: id, e: QUESTS[id].e, t: QUESTS[id].t, ok: !!QUESTS[id].chk(r, io), got: io.q.done.indexOf(id) >= 0 }; })
      : [],
    qCoin: QUEST_COIN };
}
function pub_(r) { return { nick: plain_(r[C.nick]), av: plain_(r[C.av]), fid: String(r[C.fid] || '') }; }
function resetDay_(r) {
  var t = day_();
  if (Number(r[C.day]) !== t) {
    r[C.day] = t; r[C.onl] = 0; r[C.rd] = 0; r[C.qa] = 0;
    r[C.gToday] = ''; r[C.trades] = 0; r[C.gifts] = ''; r[C.msgN] = 0; r[C.noteN] = 0;
  }
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function fmt_(d) { return d ? Utilities.formatDate(new Date(d), TZ, 'yyyy/M/d HH:mm') : ''; }

/* ---------- 主程式 ---------- */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var q = {};
  try { q = JSON.parse(p.q || '{}'); } catch (err) { return out_({ ok: false, err: 'bad' }); }
  if (!q.a && p.a) q = p;
  return out_(handle_(q));
}
function doPost(e) {
  var q = {};
  try { q = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out_({ ok: false, err: 'bad' }); }
  return out_(handle_(q));
}

function handle_(q) {
  SHEETS_ = {};
  var a = String(q.a || '');
  if (a === 'top') return top_(q);
  if (a === 'visitors') return { ok: true, v: visitors_(String(q.isle || '')) };
  if (a === 'visall') return { ok: true, vs: visStats_() };
  if (a === 'msgs') return msgs_(q);
  if (a === 'mimg') return msgImg_(q);   // v59 讀留言圖片：只讀、不排隊等鎖
  if (a === 'nimg') return noteImg_(q);  // v80 讀悄悄話圖片：要登島，而且只有寄件人、收件人讀得到
  if (a === 'anns') return anns_();
  if (a === 'voyage') return voyage_();
  if (a === 'drops') return dropsPub_();
  if (a === 'isl') return islLite_();
  if (a === 'guards') { var gpc = cget_('guardsPub'); if (gpc) return { ok: true, guards: gpc, now: Date.now() }; var gpv = guardPub_(guardsGet_(), Date.now()); cput_('guardsPub', gpv, 60); return { ok: true, guards: gpv, now: Date.now() }; }   // v84
  if (a === 'island' && !q.fid) return islandOwn_(q); // 看自己的小島：只讀、不排隊等鎖，快很多
  if (a === 'friends') { // 好友清單：只讀、不排隊等鎖
    var fRows = rows_(players_()), fi = find_(fRows, q.code);
    if (fi < 0) return { ok: false, err: 'nocode' };
    var fr0 = fRows[fi]; resetDay_(fr0);
    return { ok: true, add: 0, friends: friendsOf_(fRows, fr0), p: profile_(fr0) };
  }
  if (a === 'unread') { // v77 網頁每 60 秒問一次有沒有新悄悄話：只讀、不排隊等鎖
    var uRows = rows_(players_()), ui = find_(uRows, q.code);
    if (ui < 0) return { ok: false, err: 'nocode' };
    return { ok: true, unread: num_(uRows[ui][C.unread]) };
  }
  if (a === 'island' && q.fid) { var fv = islandVisit_(q); if (fv) return fv; } // 參觀別人的島：同樣只讀（訪客紀錄由前台另外送 a:'isvisit'）
  var lock = LockService.getScriptLock(), lk0 = Date.now();
  /* v75：排不到寫入鎖就回 busy（什麼都還沒寫，前台可以放心自動重試），不再丟例外變成「網路不穩」 */
  if (!lock.tryLock(LOCK_WAIT)) { logAct_(a, 'busy', Date.now() - lk0, 0); return { ok: false, err: 'busy' }; }
  var lk1 = Date.now(); logAct_(a, 'start', lk1 - lk0, 0);   // 先記一筆：萬一這次卡到 6 分鐘被強制停掉，也看得出是哪個動作
  try {
    var sh = players_();
    var rows = rows_(sh);

    if (a === 'reg') {
      var nick = cleanNick_(q.nick);
      if (nick.length < 2) return { ok: false, err: 'short' };
      if (RESERVED.test(nick)) return { ok: false, err: 'reserved' };
      var invRow = -1, invSh = null, invUsed = 0, invWho = '';
      if (INVITE_ON) {
        var ik = invKey_(q.inv);
        if (!ik) return { ok: false, err: 'noinv' };
        invSh = sheet_('邀請碼', INV_HEAD);
        var iv = invSh.getLastRow() > 1 ? invSh.getRange(2, 1, invSh.getLastRow() - 1, INV_HEAD.length).getValues() : [];
        for (var iq = 0; iq < iv.length; iq++) if (invKey_(iv[iq][0]) === ik) { invRow = iq + 2; break; }
        if (invRow < 0) return { ok: false, err: 'badinv' };
        var ir = iv[invRow - 2], icap = num_(ir[1]) || INV_CAP;
        invUsed = num_(ir[2]); invWho = String(ir[3] || '');
        if (invUsed >= icap) return { ok: false, err: 'invfull' };
      }
      if (nickTaken_(rows, nick, -1)) return { ok: false, err: 'taken' };
      var row = newRow_(newCode_(rows), nick, false, Math.min(CAP.qa, num_(q.init)), newFid_(rows));
      sh.appendRow(row);
      if (invRow > 0) {
        invSh.getRange(invRow, 3, 1, 2).setValues([[invUsed + 1, (invWho ? invWho + '、' : '') + nick + '（' + row[C.fid] + '）']]);
      }
      return { ok: true, p: profile_(row) };
    }
    if (a === 'isles' && !q.code) return { ok: true, isles: islesPub_(isles_(), null) };

    var i = find_(rows, q.code);
    if (i < 0) return { ok: false, err: 'nocode' };
    migrate78_(sh, rows);   // v78：只跑一次
    ann83_();   // v83：新玩法公告貼到留言碼頭（只貼一次）
    ann85_();   // v85：編輯更新新玩法公告（只做一次）
    ann86_();   // v86：公告拿掉分類選單那行（只做一次）
    var r = rows[i];
    if (!r[C.fid]) r[C.fid] = newFid_(rows);
    resetDay_(r);
    questSync_(r);
    var touched = {}; // 一起被改到的其他玩家（加好友、送禮、悄悄話）
    giftSweep_(rows, i, touched);   // v78：過期的神獸贈禮退回
    var me = profile_(r);
    var res = { ok: true, add: 0 };
    /* 商店請求識別碼與交易結果一起存入玩家資料，同一請求重送不重複扣款。 */
    var shopId = String(q.tx || ''), shopOp = a === 'xbuy' || a === 'xswap' || a === 'trade', shopSig = '', shopRecords = null;
    if (shopOp && shopId) {
      if (!/^[A-Za-z0-9_-]{12,80}$/.test(shopId)) return {ok:false,err:'bad',p:me};
      shopSig = JSON.stringify([a,String(q.k||''),String(q.f||''),String(q.t||''),num_(q.n)]);
      var shopData = isleOf_(r), allShopRecords = Array.isArray(shopData.shopReceipts) ? shopData.shopReceipts : [];
      var priorShop = allShopRecords.find(function(x){return x.id === shopId});
      if (priorShop) { if (priorShop.sig !== shopSig) return {ok:false,err:'bad',p:me}; return {ok:true,add:0,replayed:true,p:me}; }
      var shopTime = parseInt(shopId.split('-').pop(),36);
      if (!isFinite(shopTime) || Math.abs(Date.now()-shopTime) > 86400000) return {ok:false,err:'expired',p:me};
      shopRecords = allShopRecords.filter(function(x){return num_(x.time) >= Date.now()-86400000});
    }

    if (a === 'starterguide') {
      var guideIsland=isleOf_(r); if (guideIsland.starterGuide===0) guideIsland.starterGuide=1;
      r[C.isle]=JSON.stringify(guideIsland);
    } else if (a === 'betstatus' || a === 'betplay') {
      var betIsland=isleOf_(r), betDay=day_(), bets=betIsland.bets||{};
      if (bets.d!==betDay) bets={d:betDay,slot:0,rps:0,rs:0,rt:PLAY_RESET,receipts:Array.isArray(bets.receipts)?bets.receipts.slice(-100):[]};
      if (bets.rt!==PLAY_RESET) { bets.slot=0; bets.rt=PLAY_RESET; }   // 只重置拉霸，猜拳次數與連勝不動
      if (!Array.isArray(bets.receipts)) bets.receipts=[];
      if (a==='betplay') {
        var bt=String(q.kind||''),bid=String(q.id||''),choice=String(q.choice||'');
        if ((bt!=='slot'&&bt!=='rps')||! /^[A-Za-z0-9_-]{12,80}$/.test(bid)||(bt==='rps'&&['rock','paper','scissors'].indexOf(choice)<0)) return {ok:false,err:'bad',p:me};
        var existing=bets.receipts.find(function(x){return x.id===bid});
        if (existing) { if(existing.kind!==bt) return {ok:false,err:'bad',p:me}; res.bet=existing.result; }
        else {
          var betTime=parseInt(bid.split('-').pop(),36);if(!isFinite(betTime)||Math.abs(Date.now()-betTime)>86400000) return {ok:false,err:'expired',p:me};
          if (num_(bets[bt])>=10) return {ok:false,err:'betmax',p:me};
          if (num_(r[C.bal])<1) return {ok:false,err:'nocoin',p:me};
          var roll=[],paid=0,result='',bdia=0,streak=null;
          if (bt==='slot') {
            /* v58：五種圖案（4 = 💎）；兩個一樣 3 枚、三個一樣 10 枚；💎 兩個一樣 3 顆鑽石、三個一樣 10 顆鑽石 */
            for(var br=0;br<3;br++)roll.push(Math.floor(Math.random()*5));
            var uniq=roll.filter(function(x,i){return roll.indexOf(x)===i}).length,same=uniq===3?-1:roll[0]===roll[1]||roll[0]===roll[2]?roll[0]:roll[1];
            if(uniq<3){var big=uniq===1?10:3;if(same===4)bdia=big;else paid=big;}
            result=uniq===1?'三個相同':uniq===2?'兩個相同':'沒有相同';
          } else {
            /* v58：贏 3 枚，連勝加倍（3、6、12，最多 24）；平手回 1 枚、連勝保留；輸了連勝歸 0 */
            var hands=['rock','paper','scissors'],cpu=hands[Math.floor(Math.random()*3)],player=hands.indexOf(choice),op=hands.indexOf(cpu),rs=num_(bets.rs);
            if(player===op){paid=1;result='平手';}
            else if((player-op+3)%3===1){paid=Math.min(RPS_MAX,RPS_WIN*Math.pow(2,rs));rs++;result='獲勝';}
            else {rs=0;result='落敗';}
            bets.rs=rs;streak=rs;roll=[choice,cpu];
          }
          r[C.bal]=num_(r[C.bal])-1+paid;r[C.earned]=num_(r[C.earned])+Math.max(0,paid-1);bets[bt]=num_(bets[bt])+1;
          if(bdia)r[C.dia]=num_(r[C.dia])+bdia;
          res.bet={kind:bt,roll:roll,paid:paid,result:result};if(bdia)res.bet.dia=bdia;if(streak!==null)res.bet.streak=streak;if(bt==='slot'){var sfb=btOf_(betIsland);if(sfb.sf<SLOT_FRUIT_DAY&&Math.random()<SLOT_FRUIT_P){sfb.sf++;sfb.fr++;res.bet.bfruit=1;}if(sfb.ss<SLOT_SHARD_DAY&&Math.random()<SLOT_SHARD_P){var ssk=BEASTS[Math.floor(Math.random()*BEASTS.length)],ssp=partRoll_();sfb.ss++;sfb.sh[ssk+'.'+ssp]=num_(sfb.sh[ssk+'.'+ssp])+1;res.bet.bshard={b:ssk,part:ssp,name:ANIMALS[ssk].name,el:ANIMALS[ssk].beast};}}bets.receipts.push({id:bid,kind:bt,result:res.bet});if(bets.receipts.length>100)bets.receipts=bets.receipts.slice(-100);
        }
      }
      betIsland.bets=bets;r[C.isle]=JSON.stringify(betIsland);res.betstats={slot:10-num_(bets.slot),rps:10-num_(bets.rps),rs:num_(bets.rs)};
    } else if (a === 'gacha') {
      /* 扭蛋島：q.id 有值就抽一次（同一個 id 重送只回原結果），沒有 id 只回今天剩幾次 */
      var gIsle=isleOf_(r), gDay=day_(), ga=gIsle.gacha||{};
      if (ga.d!==gDay) ga={d:gDay,n:0,rt:PLAY_RESET,receipts:Array.isArray(ga.receipts)?ga.receipts.slice(-50):[]};
      if (ga.rt!==PLAY_RESET) { ga.n=0; ga.rt=PLAY_RESET; }
      if (!Array.isArray(ga.receipts)) ga.receipts=[];
      gIsle.pets=Array.isArray(gIsle.pets)?gIsle.pets:[];
      var gid=String(q.id||'');
      if (gid) {
        if (!/^[A-Za-z0-9_-]{12,80}$/.test(gid)) return {ok:false,err:'bad',p:me};
        var gOld=ga.receipts.find(function(x){return x.id===gid});
        if (gOld) res.gacha=gOld.result;
        else {
          var gTime=parseInt(gid.split('-').pop(),36);if(!isFinite(gTime)||Math.abs(Date.now()-gTime)>86400000) return {ok:false,err:'expired',p:me};
          if (num_(ga.n)>=GACHA_DAY) return {ok:false,err:'gachamax',p:me};
          if (num_(r[C.bal])<GACHA_COST) return {ok:false,err:'nocoin',p:me};
          var tot=0,pick=null,rv;GACHA.forEach(function(g){tot+=g[2]});rv=Math.random()*tot;
          for (var gi=0;gi<GACHA.length;gi++){rv-=GACHA[gi][2];if(rv<0){pick=GACHA[gi];break}} if(!pick)pick=GACHA[0];
          r[C.bal]=num_(r[C.bal])-GACHA_COST;
          var gr={k:pick[0],n:pick[1],tier:pick[3]};
          if (pick[0]==='coin'){r[C.bal]=num_(r[C.bal])+pick[1];r[C.earned]=num_(r[C.earned])+Math.max(0,pick[1]-GACHA_COST);}
          else if (pick[0]==='beast'){
            var bk=BEASTS[Math.floor(Math.random()*BEASTS.length)];gr.b=bk;gr.name=ANIMALS[bk].name;gr.el=ANIMALS[bk].beast;
            var giv=ivRoll_(),gw=beastGive_(gIsle,bk,giv,0);gr.iv=giv;gr.where=gw;
            if (gw!=='pet') gr.dup=1;
            bnewsAdd_(r[C.nick],bk,gr.dup,'gacha');
          }
          else if (pick[0]==='shard'){var gsb=btOf_(gIsle),gsk=BEASTS[Math.floor(Math.random()*BEASTS.length)],gsp=partRoll_();gsb.sh[gsk+'.'+gsp]=num_(gsb.sh[gsk+'.'+gsp])+1;gr.b=gsk;gr.part=gsp;gr.name=ANIMALS[gsk].name;gr.el=ANIMALS[gsk].beast;}
          else if (pick[0]==='bfruit'){var gfb=btOf_(gIsle);gfb.fr+=pick[1];}
          else r[BAG_COL[pick[0]]]=num_(r[BAG_COL[pick[0]]])+pick[1];
          if (Math.random() < SAND_GACHA_P) { guOf_(gIsle).sand++; gr.sand = 1; }   // v84 扭蛋額外掉五行結界砂
          ga.n=num_(ga.n)+1;res.gacha=gr;
          ga.receipts.push({id:gid,result:gr,t:Date.now()});if(ga.receipts.length>50)ga.receipts=ga.receipts.slice(-50);
        }
      }
      gIsle.gacha=ga;r[C.isle]=JSON.stringify(gIsle);res.gachaLeft=Math.max(0,GACHA_DAY-num_(ga.n));res.gachaCost=GACHA_COST;
      res.gachaLog=ga.receipts.slice(-6).reverse().map(function(x){return x.result});res.bn=bnews_();
    } else if (a === 'bsell') {
      /* 商店島：收藏裡的一隻神獸換資源 */
      var sIsle=isleOf_(r), sk=String(q.k||''), scol=bcolOf_(sIsle), sarr=scol[sk]||[];
      if (!sarr.length) return {ok:false,err:'nobeast',p:me};
      var sidx=q.i!=null&&q.i!==''?Math.floor(num_(q.i)):lowIdx_(sarr);
      if (sidx<0||sidx>=sarr.length) return {ok:false,err:'bad',p:me};
      var sold=sarr.splice(sidx,1)[0], sgot={}; bcolSet_(sIsle,scol);
      for (var bs in BEAST_SELL) { sgot[bs]=BEAST_SELL[bs]+(bs==='dia'?0:sold.iv*BEAST_SELL_IV); r[BAG_COL[bs]]=num_(r[BAG_COL[bs]])+sgot[bs]; }
      r[C.isle]=JSON.stringify(sIsle); res.sold={k:sk,iv:sold.iv,got:sgot};
    } else if (a === 'bgift') {
      /* 送一隻收藏的神獸給好友（不算每天送禮的次數）。v78：先放進對方的「待接收」，對方選住進小島／收藏起來，或婉拒退回 */
      var bk2=String(q.k||''), jb=findFid_(rows, q.fid);
      if (!ANIMALS[bk2]||!ANIMALS[bk2].beast||jb<0||jb===i) return {ok:false,err:'bad',p:me};
      var bfid=String(rows[jb][C.fid]);
      if (list_(r[C.friends]).indexOf(bfid)<0) return {ok:false,err:'notfriend',p:me};
      var myIsle=isleOf_(r), mcol=bcolOf_(myIsle), marr=mcol[bk2]||[];
      if (!marr.length) return {ok:false,err:'nobeast',p:me};
      var fIsle=isleOf_(rows[jb]), fbin=binOf_(fIsle);
      if (fbin.length>=BIN_MAX) return {ok:false,err:'binfull',p:me};
      var midx=q.i!=null&&q.i!==''?Math.floor(num_(q.i)):lowIdx_(marr);
      if (midx<0||midx>=marr.length) return {ok:false,err:'bad',p:me};
      var mgive=marr.splice(midx,1)[0], gid='G'+Date.now().toString(36).toUpperCase()+Math.floor(Math.random()*46656).toString(36).toUpperCase(), gnow=Date.now();
      bcolSet_(myIsle,mcol); boutOf_(myIsle).push({id:gid,to:bfid,k:bk2,t:gnow}); r[C.isle]=JSON.stringify(myIsle);
      fbin.push({id:gid,k:bk2,iv:mgive.iv,from:String(r[C.fid]),nick:plain_(r[C.nick]),t:gnow}); rows[jb][C.isle]=JSON.stringify(fIsle);
      rows[jb][C.unread]=num_(rows[jb][C.unread])+1; touched[jb]=1;
      giftNote_(r, rows[jb], '🐲 想送你一隻神獸「'+ANIMALS[bk2].name+'」（IV '+mgive.iv+'）！打開背包的「🐲 待接收的神獸」，選擇住進小島或收藏起來（'+BGIFT_DAYS+' 天內沒回應會退回）。');
      res.friends=friendsOf_(rows, r); res.bgift={k:bk2,to:'wait'};
    } else if (a === 'bin') {
      /* v78 收禮人處理待接收的神獸：pet＝住進小島、bag＝收藏起來、no＝婉拒（退回送的人的收藏）。都不影響試煉難度 */
      var nI=isleOf_(r), nb=binOf_(nI), nid=String(q.id||''), ndo=String(q.do||''), nx=-1;
      if (['pet','bag','no'].indexOf(ndo)<0) return {ok:false,err:'bad',p:me};
      nb.forEach(function(g,z){if(g.id===nid)nx=z});
      if (nx<0) return {ok:false,err:'nogift',p:me};
      var ng=nb.splice(nx,1)[0], njs=findFid_(rows,ng.from), nwhere=ndo, nname=ANIMALS[ng.k].name;
      if (ndo==='pet') nwhere=beastPlace_(nI,ng.k,num_(ng.iv),0); else if (ndo==='bag') colPut_(nI,ng.k,num_(ng.iv),0);
      if (njs>=0 && njs!==i) {
        var nso=isleOf_(rows[njs]); nso.bout=boutOf_(nso).filter(function(b){return b.id!==ng.id});
        if (ndo==='no') colPut_(nso,ng.k,num_(ng.iv),0);
        rows[njs][C.isle]=JSON.stringify(nso); rows[njs][C.unread]=num_(rows[njs][C.unread])+1; touched[njs]=1;
        giftNote_(r, rows[njs], ndo==='no'?'↩️ 婉拒了你送的神獸「'+nname+'」，已退回你的神獸收藏。':'🙏 收下了你送的神獸「'+nname+'」'+(ndo==='pet'?'，讓牠住進小島了！':'，放進神獸收藏了。'));
      }
      r[C.isle]=JSON.stringify(nI); res.bin={k:ng.k,name:nname,iv:num_(ng.iv),to:nwhere}; res.island=islePub_(r,true);
    } else if (a === 'trial') {
      /* v62 神獸試煉島關卡結算：網頁回報答對幾題（0～8），伺服器決定掉不掉碎片／神獸果；同一個 id 重送只回原結果 */
      var tIsle=isleOf_(r), tb=btOf_(tIsle), tid=String(q.id||'');
      if (!/^[A-Za-z0-9_-]{12,80}$/.test(tid)) return {ok:false,err:'bad',p:me};
      var tOld=tb.receipts.find(function(x){return x.id===tid});
      if (tOld) res.trial=tOld.result;
      else {
        var tTime=parseInt(tid.split('-').pop(),36);if(!isFinite(tTime)||Math.abs(Date.now()-tTime)>86400000) return {ok:false,err:'expired',p:me};
        var tright=Math.floor(num_(q.right));if(tright<0||tright>8) return {ok:false,err:'bad',p:me};
        if (Date.now()-num_(tb.lt)<BT_GAP) return {ok:false,err:'gamecool',wait:BT_GAP-(Date.now()-num_(tb.lt)),p:me};   // v69：告訴網頁還要等幾毫秒
        var tch=tright>=8?100:tright>=7?60:tright>=5?30:0, tres={right:tright,shard:null,fruit:0,chance:tch};
        if (tch && num_(tb.st)<BT_SHARD_DAY && Math.random()*100<tch) {
          var tk=BEASTS[Math.floor(Math.random()*BEASTS.length)], tp=partRoll_();
          tb.sh[tk+'.'+tp]=num_(tb.sh[tk+'.'+tp])+1; tb.st=num_(tb.st)+1; tres.shard={k:tk,p:tp,name:ANIMALS[tk].name};
        } else if (tch && num_(tb.st)>=BT_SHARD_DAY) tres.full=1;
        var tfr=tright>=8?2:tright>=5?1:0; tfr=Math.max(0,Math.min(tfr,BT_FRUIT_DAY-num_(tb.ft)));
        if (tfr) { tb.fr+=tfr; tb.ft=num_(tb.ft)+tfr; tres.fruit=tfr; }
        tb.lt=Date.now(); tb.receipts.push({id:tid,result:tres}); res.trial=tres;
      }
      r[C.isle]=JSON.stringify(tIsle);
    } else if (a === 'forge') {
      /* v62 合成：同一隻神獸的頭身腳各一片；成功率 40%，失敗一次 +20%（最多 3 次失敗必成功） */
      var fI=isleOf_(r), fb=btOf_(fI), fk=String(q.k||''), fxid=String(q.id||'');
      if (BEASTS.indexOf(fk)<0||!/^[A-Za-z0-9_-]{12,80}$/.test(fxid)) return {ok:false,err:'bad',p:me};
      var fOld=fb.receipts.find(function(x){return x.id===fxid});
      if (fOld) res.forge=fOld.result;
      else {
        var fTime=parseInt(fxid.split('-').pop(),36);if(!isFinite(fTime)||Math.abs(Date.now()-fTime)>86400000) return {ok:false,err:'expired',p:me};
        if (!BT_PARTS.every(function(pp){return num_(fb.sh[fk+'.'+pp])>0})) return {ok:false,err:'noshard',p:me};
        BT_PARTS.forEach(function(pp){fb.sh[fk+'.'+pp]=num_(fb.sh[fk+'.'+pp])-1;if(!fb.sh[fk+'.'+pp])delete fb.sh[fk+'.'+pp]});
        var frate=Math.min(100,BT_FORGE+BT_PITY*num_(fb.pity[fk])), fwin=Math.random()*100<frate, fres={k:fk,name:ANIMALS[fk].name,rate:frate,win:fwin};
        if (fwin) { fb.pity[fk]=0; var fd=Math.min(5,earnN_(fb)+1), fiv=ivTrial_(fd), fw=beastGive_(fI,fk,fiv,0); fb.earn[fk]=1; fres.iv=fiv; fres.d=fd; fres.floor=ivFloor_(fd); fres.where=fw; bnewsAdd_(r[C.nick],fk,fw!=='pet','trial'); }   // v78：IV 依難度保底、記成自己召喚的
        else { fb.pity[fk]=num_(fb.pity[fk])+1; fres.next=Math.min(100,BT_FORGE+BT_PITY*fb.pity[fk]); }
        fb.receipts.push({id:fxid,result:fres}); res.forge=fres;
      }
      r[C.isle]=JSON.stringify(fI); res.island=islePub_(r,true);
    } else if (a === 'bfeed') {
      /* v62 餵神獸果：親密度 +5，每隻神獸每天最多 2 顆，Lv10 封頂 */
      var bI=isleOf_(r), bfb=btOf_(bI), bp=null;
      (bI.pets||[]).forEach(function(pp){if(pp.id===String(q.id||''))bp=pp});
      if (!bp||!isBeast_(bp.k)) return {ok:false,err:'bad',p:me};
      if (bfb.fr<1) return {ok:false,err:'nobfruit',p:me};
      if (petLv_(bp)>=BEAST_LV_MAX) return {ok:false,err:'maxed',p:me};
      if (num_(bp.bfd)!==day_()) { bp.bfd=day_(); bp.bfn=0; }
      if (num_(bp.bfn)>=BT_FEED_DAY) return {ok:false,err:'bfedmax',p:me};
      bfb.fr--; bp.bfn=num_(bp.bfn)+1; bp.aff=num_(bp.aff)+BT_FRUIT_AFF;
      r[C.isle]=JSON.stringify(bI); res.island=islePub_(r,true); res.bfed={id:bp.id,lv:petLv_(bp),aff:num_(bp.aff)};
    } else if (a === 'bswap') {
      /* v62 收藏裡的某一隻換上小島，原本在小島的那隻進收藏（IV、親密度各自跟著走） */
      var wI=isleOf_(r), wk=String(q.k||''), wcol=bcolOf_(wI), warr=wcol[wk]||[], wi=Math.floor(num_(q.i)), wp=null;
      (wI.pets||[]).forEach(function(pp){if(pp.k===wk)wp=pp});
      if (wi<0||wi>=warr.length) return {ok:false,err:'bad',p:me};
      if (!wp) { var wput=warr.splice(wi,1)[0]; bcolSet_(wI,wcol); beastPlace_(wI,wk,ivOf_(wput),wput.aff); r[C.isle]=JSON.stringify(wI); res.island=islePub_(r,true); }   // v79：小島上沒有這種 → 直接住上去
      else {
      var wit=warr[wi]; warr[wi]={iv:ivOf_(wp),aff:num_(wp.aff)}; wp.iv=wit.iv; wp.aff=num_(wit.aff); bcolSet_(wI,wcol);
      r[C.isle]=JSON.stringify(wI); res.island=islePub_(r,true); }
    } else if (a === 'bstash') {
      /* v79 小島上的神獸收進收藏（IV、親密度跟著走），之後可以送好友、換資源，或再換上小島 */
      var kI=isleOf_(r), kp=null, kx=-1;
      (kI.pets||[]).forEach(function(pp,z){if(pp.id===String(q.id||'')){kp=pp;kx=z}});
      if (!kp||!isBeast_(kp.k)) return {ok:false,err:'bad',p:me};
      kI.pets.splice(kx,1); colPut_(kI,kp.k,ivOf_(kp),kp.aff);
      r[C.isle]=JSON.stringify(kI); res.bstash={k:kp.k,name:ANIMALS[kp.k].name}; res.island=islePub_(r,true);
    } else if (a === 'login' || a === 'me') {
      // 只回傳資料
    } else if (a === 'daily') {
      var t = day_();
      if (Number(r[C.last]) !== t) {
        r[C.streak] = Number(r[C.last]) === day_(-1) ? num_(r[C.streak]) + 1 : 1;
        r[C.last] = t;
        res.add = Math.min(DAILY + (r[C.streak] - 1), DAILY_MAX);
      }
    } else if (a === 'earn') {
      var k = String(q.k || '');
      var col = KIND_COL[k];
      if (col == null) return { ok: false, err: 'bad' };
      if (k === 'qa') {
        // 每座問答島每個帳號只能拿一次（不論用哪台裝置）
        var key = String(q.key || '').replace(/[^0-9a-z_-]/gi, '').slice(0, 12);
        var doneList = list_(r[C.qaDone]);
        if (!key || doneList.indexOf(key) >= 0) return { ok: true, add: 0, p: me };
        doneList.push(key);
        r[C.qaDone] = doneList.join(',');
      }
      if (num_(r[col]) < CAP[k]) { r[col] = num_(r[col]) + 1; res.add = 1; }
    } else if (a === 'gameplay') {
      var gk = String(q.game || ''), gsc = Math.floor(num_(q.score));
      if (!GAME_KEYS[gk] || gsc < 0 || gsc > 1000000) return { ok: false, err: 'bad', p: me };
      var gx = isleOf_(r), gnow = Date.now(), gtd = day_();
      if (!gx.gm || gx.gm.d !== gtd) gx.gm = { d: gtd, quick: 0, runner: 0, t: {}, receipts:gx.gm && Array.isArray(gx.gm.receipts)?gx.gm.receipts.slice(-100):[] };
      if (!gx.gm.t) gx.gm.t = {};
      var grid=String(q.id||'');
      if(grid && !/^[A-Za-z0-9_-]{12,80}$/.test(grid)) return {ok:false,err:'bad',p:me};
      gx.gm.receipts=Array.isArray(gx.gm.receipts)?gx.gm.receipts:[];
      var grOld=grid&&gx.gm.receipts.find(function(x){return x.id===grid});
      if(grOld){if(grOld.kind!==gk) return {ok:false,err:'bad',p:me};return {ok:true,p:me,game:grOld.result};}
      if(grid){var grTime=parseInt(grid.split('-').pop(),36);if(!isFinite(grTime)||Math.abs(Date.now()-grTime)>86400000) return {ok:false,err:'expired',p:me};}
      var gcoin = gsc >= GAME_T[2] ? 3 : gsc >= GAME_T[1] ? 2 : gsc >= GAME_T[0] ? 1 : 0;
      if (gnow - num_(gx.gm.t[gk]) < GAME_GAP) { if(grid) return {ok:false,err:'gamecool',p:me}; gcoin = 0; }      // 連著亂送太快不算
      gcoin = Math.max(0, Math.min(gcoin, GAME_DAY - num_(gx.gm[gk])));
      gx.gm.t[gk] = gnow; gx.gm[gk] = num_(gx.gm[gk]) + gcoin;
      res.game = { got: gcoin, left: GAME_DAY - gx.gm[gk], day: GAME_DAY, t: GAME_T };
      if(grid){gx.gm.receipts.push({id:grid,kind:gk,result:res.game});if(gx.gm.receipts.length>100)gx.gm.receipts=gx.gm.receipts.slice(-100)}
      r[C.isle] = JSON.stringify(gx);
      if (gcoin) res.add = gcoin;
    } else if (a === 'dl' || a === 'memberdl') {
      var note = '';
      if (a === 'memberdl' && !/^(memberb|sponsora)\/t[0-9]+\/index\.html$/.test(String(q.page || ''))) return { ok: false, err: 'badpage' };
      if (a === 'memberdl') note = '會員島免扣（記錄點擊）';
      else if (me.admin) note = '管理員免扣';
      else if (me.bal < 1) return { ok: false, err: 'nocoin', p: me };
      else r[C.bal] = me.bal - 1;
      r[C.dls] = num_(r[C.dls]) + 1;
      var item = text_(q.title, 60) + '／' + text_(q.file, 60);
      r[C.recent] = [item].concat(String(r[C.recent] || '').split('\n').filter(String)).slice(0, 10).join('\n');
      sheet_('下載紀錄', D_HEAD).appendRow([new Date(), r[C.nick], r[C.code], text_(q.title, 100), SITE + text_(q.page, 80),
        text_(q.file, 100), num_(r[C.bal]), note]);
      var pw = dlPw_(q.page); if (pw) res.pw = pw;   // v71：有解壓縮密碼就一起回傳
    } else if (a === 'visit') {
      var isle = text_(q.isle, 40), vs = sheet_('造訪紀錄', V_HEAD), t2 = day_(), dup = false;
      var vn = vs.getLastRow() - 1;
      if (vn > 0) {
        var recent = vs.getRange(Math.max(2, vn - 498), 3, Math.min(vn, 500), 4).getValues();
        for (var x = recent.length - 1; x >= 0; x--) {
          if (Number(recent[x][3]) !== t2) break;
          if (String(recent[x][0]) === me.code && String(recent[x][1]) === isle) { dup = true; break; }
        }
      }
      if (!dup) { vs.appendRow([new Date(), r[C.nick], me.code, isle, text_(q.name, 30), t2, me.admin ? '是' : '']); cdel_('vis'); }
      var vo = isleOf_(r);
      qState_(vo, r);
      if (vo.q.v.indexOf(isle) < 0 && vo.q.v.length < 30) vo.q.v.push(isle);
      r[C.isle] = JSON.stringify(vo);
      res.v = visitors_(isle);
    } else if (a === 'nick') {
      var nn = cleanNick_(q.nick);
      if (nn.length < 2) return { ok: false, err: 'short' };
      if (nickKey_(nn) !== nickKey_(r[C.nick])) {
        if (RESERVED.test(nn) && !me.admin) return { ok: false, err: 'reserved' };
        if (nickTaken_(rows, nn, i)) return { ok: false, err: 'taken' };
        r[C.nick] = text_(nn, 12);
      }
    } else if (a === 'avatar') {
      if (AVATARS.indexOf(String(q.av)) < 0) return { ok: false, err: 'bad' };
      r[C.av] = String(q.av);

    /* ----- 物資島 ----- */
    } else if (a === 'isles') {
      res.isles = islesPub_(isles_(), r);
      var nxi = ISL_MAP[String(q.isle || '')];
      if (nxi) {
        var nio = isleOf_(r);
        if (!nio.nx) nio.nx = {};
        if (!nio.nx[nxi.id]) { nio.nx[nxi.id] = rollN_(nxi); r[C.isle] = JSON.stringify(nio); }
        res.nx = nio.nx[nxi.id]; res.nxi = nxi.id;   // 回傳「底數」，網頁再依這一輪的豐富度換算（換批時不用重抓）
      } else if (String(q.isle) === '*') {
        // 登入後一次把 20 座島下一次的底數全抽好，進哪座島都能馬上結算（不用等後台）
        var aio = isleOf_(r), dirtyN = false; if (!aio.nx) aio.nx = {};
        res.nxall = {};
        ISL.forEach(function (x) { if (!aio.nx[x.id]) { aio.nx[x.id] = rollN_(x); dirtyN = true; } res.nxall[x.id] = aio.nx[x.id]; });
        if (dirtyN) r[C.isle] = JSON.stringify(aio);
      }
    } else if (a === 'gather') {
      var rk = String(q.isle || '');
      if (ISL_LEGACY[rk]) rk = ISL_LEGACY[rk];
      var il = ISL_MAP[rk];
      if (!il) return { ok: false, err: 'bad' };
      var now = Date.now(), wait = num_(r[C.gLast]) + GATHER_GAP - now;
      if (wait > 0) return { ok: false, err: 'cool', wait: Math.ceil(wait / 1000), p: me };
      var lvNow = islLv_(il, now).lv;
      var gio = isleOf_(r), ready = num_(gio.cd[rk]);
      if (ready > now) return { ok: false, err: 'cool', wait: Math.ceil((ready - now) / 1000), p: me };
      var tc = counts_(r[C.gToday]);
      if ((tc[rk] || 0) >= (il.t === 'gold' ? GOLD_MAX : GATHER_MAX)) return { ok: false, err: 'tired', p: me };
      var st = isles_(), isl = st.map[rk], left = isl.total - isl.taken;
      if (left <= 0) return { ok: false, err: 'empty', p: me, isles: islesPub_(st, r) };
      if (!gio.nx) gio.nx = {};
      var want = islScale_(il, num_(gio.nx[rk]) >= il.lo && num_(gio.nx[rk]) <= il.hi ? num_(gio.nx[rk]) : rollN_(il), lvNow);
      var got = Math.min(left, want), from = isl.taken;
      isl.taken += got;
      var dia = 0;
      isl.dias.forEach(function (pos) { if (pos > from && pos <= isl.taken) dia++; });
      if (dia) isl.found += dia;
      st.sh.getRange(isl.row, 5).setValue(isl.taken);
      if (dia) st.sh.getRange(isl.row, 7).setValue(isl.found);
      cdel_('isl2');
      tc[rk] = (tc[rk] || 0) + 1;
      r[C.gToday] = countsStr_(tc);
      r[C.gLast] = now;
      gio.cd[rk] = now + il.gap * 1000;
      gio.nx[rk] = rollN_(il); // 下一次的數量先抽好
      r[C.isle] = JSON.stringify(gio);
      if (il.t === 'gold') res.add = got; // 金礦：直接拿金幣（尾端會一起加進累計金幣）
      else {
        r[RES[il.t].col] = num_(r[RES[il.t].col]) + got;
        r[C.tres] = num_(r[C.tres]) + got;
        if (dia) { r[C.dia] = num_(r[C.dia]) + dia; r[C.tdia] = num_(r[C.tdia]) + dia; }
      }
      res.got = { k: il.t, n: got, dia: dia, isle: rk };
      res.nx = gio.nx[rk]; res.nxi = rk;
      res.isles = islesPub_(st, r);
    /* ----- 商店島：買船、換船、金幣換物資 ----- */
    } else if (a === 'buyship' || a === 'useship') {
      var sid = Math.floor(num_(q.k)), sp = SHIPS[sid];
      if (!sp) return { ok: false, err: 'bad', p: me };
      var so = isleOf_(r);
      if (a === 'buyship') {
        if (so.ship.own.indexOf(sid) >= 0) return { ok: false, err: 'owned', p: me };
        if (!me.admin) {
          if (num_(r[C.bal]) < sp.cost) return { ok: false, err: 'nocoin', p: me };
          r[C.bal] = num_(r[C.bal]) - sp.cost;
        }
        so.ship.own.push(sid); so.ship.own.sort(function (x, y) { return x - y; });
        so.ship.cur = sid;
        var snm = cleanNick_(q.name).slice(0, 8);
        if (snm.length >= 1) so.ship.names[sid] = text_(snm, 8);
        sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], '買船', sp.name + '（' + sp.cost + ' 金幣）']);
      } else {
        if (so.ship.own.indexOf(sid) < 0) return { ok: false, err: 'notown', p: me };
        so.ship.cur = sid;
      }
      r[C.isle] = JSON.stringify(so);
    } else if (a === 'pgclaim') {
      var po = isleOf_(r);
      if (!po.pg) {
        if (num_(r[C.earned]) < 5) return { ok: false, err: 'pgnot', p: me };
        if (!me.admin) {
          if (num_(r[C.bal]) < PG_COST) return { ok: false, err: 'nocoin', p: me };
          r[C.bal] = num_(r[C.bal]) - PG_COST;
        }
        po.pg = 1; r[C.isle] = JSON.stringify(po);
        sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], '領禮物包', '提示詞禮物包' + (me.admin ? '（管理員免費）' : '（' + PG_COST + ' 金幣）')]);
      }
      res.pg = 1;
    } else if (a === 'readres') {
      // 隱藏優惠：看文章有機率掉鑽石。結果由「帳號＋日期＋文章」算出來（同一篇看再多次結果都一樣），只記中獎的文章，不用存整份已讀清單
      var rkey = String(q.key || '').replace(/[^0-9a-z_\/-]/gi, '').slice(0, 40);
      if (!/^[a-z0-9]+\/t\d{1,6}$/.test(rkey)) return { ok: false, err: 'bad', p: me };
      var ro = isleOf_(r), rtd = day_();
      try { var rbd = rkey.split('/')[0], RG = guardsGet_(), rg = RG[rbd]; if (rg && rg.code !== String(r[C.code]).toUpperCase() && num_(rg.e) > Date.now() && num_(rg.rd) < GUARD_READ_MAX) { rg.rd = num_(rg.rd) + 1; guardsPut_(RG); } } catch (e) {}   // v84 守護者：有人來讀文章 +1 金幣
      if (!ro.rr || ro.rr.d !== rtd || !Array.isArray(ro.rr.won)) ro.rr = { d: rtd, won: [] };
      var roll = hash_(String(r[C.code]) + '|' + rtd + '|' + rkey + '|rd') / 4294967296;
      if (roll < READ_DIA_P && ro.rr.won.indexOf(rkey) < 0 && ro.rr.won.length < READ_DIA_DAY) {
        ro.rr.won.push(rkey);
        r[C.dia] = num_(r[C.dia]) + 1;
        res.got = { dia: 1, k: 'dia', n: 0 };
      }
      r[C.isle] = JSON.stringify(ro);
    } else if (a === 'shipname') {
      var nid = Math.floor(num_(q.k)), no = isleOf_(r);
      if (!SHIPS[nid] || no.ship.own.indexOf(nid) < 0) return { ok: false, err: 'notown', p: me };
      var nn = cleanNick_(q.name).slice(0, 8);
      if (nn.length >= 1) no.ship.names[nid] = text_(nn, 8); else delete no.ship.names[nid];
      r[C.isle] = JSON.stringify(no);
    } else if (a === 'xbuy') {
      var xk = String(q.k || ''), xn = Math.max(1, Math.min(XCHG_MAX, Math.floor(num_(q.n) || 1)));
      var xcost = (xk === 'dia' ? DIA_BUY : BUY_COST) * xn;
      if (xk !== 'dia' && !RES[xk]) return { ok: false, err: 'bad', p: me };
      var bxo = isleOf_(r), bxd = xd_(bxo), bxm = xk === 'dia' ? DIA_BUY_DAY : BUY_DAY;
      if (num_(bxd.b[xk]) + xn > bxm) return { ok: false, err: 'buymax', p: me };
      if (num_(r[C.bal]) < xcost) return { ok: false, err: 'nocoin', p: me };
      bxd.b[xk] = num_(bxd.b[xk]) + xn; r[C.isle] = JSON.stringify(bxo);
      r[C.bal] = num_(r[C.bal]) - xcost;
      if (xk === 'dia') r[C.dia] = num_(r[C.dia]) + xn;
      else r[RES[xk].col] = num_(r[RES[xk].col]) + BUY_N * xn;
    } else if (a === 'xswap') {
      var sf = String(q.f || ''), st2 = String(q.t || ''), sn = Math.max(1, Math.min(XCHG_MAX, Math.floor(num_(q.n) || 1)));
      if (!RES[sf] || !RES[st2] || sf === st2) return { ok: false, err: 'bad', p: me };
      var swo = isleOf_(r), swd = xd_(swo);
      if (num_(swd.sw) + sn > SWAP_DAY) return { ok: false, err: 'swapmax', p: me };
      if (num_(r[RES[sf].col]) < SWAP_FROM * sn) return { ok: false, err: 'few', p: me };
      r[RES[sf].col] = num_(r[RES[sf].col]) - SWAP_FROM * sn;
      r[RES[st2].col] = num_(r[RES[st2].col]) + SWAP_TO * sn;
      swd.sw = num_(swd.sw) + sn; r[C.isle] = JSON.stringify(swo);
    } else if (a === 'trade') {
      var tk = String(q.k || '');
      if (tk === 'dia') {   // 鑽石換金幣：自己的每日次數，不佔物資賣金幣的 3 次
        var dso = isleOf_(r), dsd = xd_(dso);
        if (num_(dsd.ds) >= DIA_SELL_DAY) return { ok: false, err: 'diamax', p: me };
        if (num_(r[C.dia]) < 1) return { ok: false, err: 'few', p: me };
        r[C.dia] = num_(r[C.dia]) - 1; res.add = DIA_RATE;
        dsd.ds = num_(dsd.ds) + 1; r[C.isle] = JSON.stringify(dso);
      }
      if (tk !== 'dia' && num_(r[C.trades]) >= TRADE_MAX) return { ok: false, err: 'trademax', p: me };
      if (tk === 'dia') {
      } else if (tk === 'pumpkin') {
        var tis = isleOf_(r);
        if (tis.veg.pumpkin < PUMPKIN_RATE) return { ok: false, err: 'few', p: me };
        tis.veg.pumpkin -= PUMPKIN_RATE; r[C.isle] = JSON.stringify(tis); res.add = 1;
      } else if (RES[tk]) {
        if (num_(r[RES[tk].col]) < TRADE_RATE) return { ok: false, err: 'few', p: me };
        r[RES[tk].col] = num_(r[RES[tk].col]) - TRADE_RATE; res.add = 1;
      } else return { ok: false, err: 'bad' };
      if (tk !== 'dia') r[C.trades] = num_(r[C.trades]) + 1;

    /* ----- 我的小島 ----- */
    } else if (a === 'island') {
      if (q.fid && String(q.fid).toUpperCase() !== String(r[C.fid])) {
        var jv = findFid_(rows, q.fid);
        if (jv < 0) return { ok: false, err: 'nofid', p: me };
        var vFriend = list_(r[C.friends]).indexOf(String(rows[jv][C.fid])) >= 0;
        if (rows[jv][C.open] === '否' && !vFriend && !me.admin) return { ok: false, err: 'closed', p: me };
        if (!me.admin) { // 留下訪客紀錄（同一人 10 分鐘內只記一次）
          var ti = isleOf_(rows[jv]), nowV = Date.now(), prevV = null;
          ti.vis.forEach(function (x) { if (x.f === me.fid) prevV = x; });
          if (!prevV || nowV - prevV.t > VISIT_GAP) {
            ti.vis = [{ f: me.fid, n: me.nick, a: me.av, t: nowV }].concat(ti.vis.filter(function (x) { return x.f !== me.fid; })).slice(0, VISIT_KEEP);
            rows[jv][C.isle] = JSON.stringify(ti); touched[jv] = 1;
          }
        }
        res.island = islePub_(rows[jv], false, isleOf_(r));
        res.island.friend = vFriend;
      } else res.island = islePub_(r, true);
    } else if (a === 'isvisit') { // 參觀後補記訪客紀錄（前台先顯示小島，再送這個，不擋畫面）
      var jw = findFid_(rows, q.fid);
      if (jw >= 0 && jw !== i && !me.admin && (rows[jw][C.open] !== '否' || list_(r[C.friends]).indexOf(String(rows[jw][C.fid])) >= 0)) {
        var tw = isleOf_(rows[jw]), nowW = Date.now(), prevW = null;
        tw.vis.forEach(function (x) { if (x.f === me.fid) prevW = x; });
        if (!prevW || nowW - prevW.t > VISIT_GAP) {
          tw.vis = [{ f: me.fid, n: me.nick, a: me.av, t: nowW }].concat(tw.vis.filter(function (x) { return x.f !== me.fid; })).slice(0, VISIT_KEEP);
          rows[jw][C.isle] = JSON.stringify(tw); touched[jw] = 1;
        }
      }
    } else if (a === 'setopen') {
      r[C.open] = q.o ? '' : '否';
      res.island = islePub_(r, true);
    } else if (a === 'build' || a === 'plant' || a === 'harvest' || a === 'pick' || a === 'moveitem' || a === 'chopwood' || a === 'adopt' || a === 'feed' || a === 'pat' || a === 'pethome' || a === 'collect' || a === 'fish' || a === 'cook' || a === 'job' || a === 'jobdone' || a === 'cxclaim' || a === 'tower' || a === 'awaken' || a === 'rush' || a === 'diaretry' || a === 'buysand') {
      var out = isleAct_(a, q, r, me);
      if (out.err) return { ok: false, err: out.err, miss: out.miss, need: out.need, p: me };
      if (out.add) res.add = out.add;
      if (out.gift) res.gift = out.gift;
      if (out.got) res.got = out.got;
      if (out.tw) res.tw = out.tw;
      if (out.dishAff) res.dishAff = out.dishAff;
      if (out.log) sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], out.log[0], out.log[1]]);
      res.island = islePub_(r, true);
    } else if (a === 'tarotsync') {
      // 在同一把寫入鎖內合併已抽牌；先存入的結果優先，不因其他裝置的空資料覆蓋。
      var tday=String(day_()), tdate=tday.slice(0,4)+'-'+tday.slice(4,6)+'-'+tday.slice(6,8);
      if (String(q.d || '') !== tdate) return { ok:false, err:'bad', p:me };
      var ot=isleOf_(r), ts=ot.tarot && ot.tarot.d===tdate ? ot.tarot : {d:tdate,love:null,career:null};
      for (var ti=0,tk=['love','career','wealth','social','health','study'];ti<tk.length;ti++) {
        var key= tk[ti], incoming=q[key];
        if (incoming != null) {
          if (typeof incoming!=='object' || !Number.isInteger(incoming.id) || incoming.id<0 || incoming.id>=78 || typeof incoming.rev!=='boolean') return {ok:false,err:'bad',p:me};
          if (!ts[key] || String(q.redraw || '')===key) ts[key]={id:incoming.id,rev:incoming.rev};   // v80 再抽一次：指定的那張用新抽的蓋掉
        }
      }
      ot.tarot=ts; r[C.isle]=JSON.stringify(ot); res.tarot=ts;
    } else if (a === 'gtest') {   // v84 守護試煉／靈脈試煉：出 8 題（不給答案）
      var go = isleOf_(r), gu2 = guOf_(go), gis = String(q.isle || ''), QB = qbank_(), gnow = Date.now(), gbk = String(q.bk || ''), gsplit = gis === '*', gcode = String(r[C.code]).toUpperCase();
      if (go.tl < 2) return { ok: false, err: 'needtemple', need: 2, p: me };
      var gpet = null; go.pets.forEach(function (p) { if (p.k === gbk && isBeast_(p.k)) gpet = p; });
      if (!gpet) return { ok: false, err: 'nobeast2', p: me };
      if (num_(gu2.t[gis]) >= GT_DAY) return { ok: false, err: 'gtmax', p: me };
      var pool = [];
      if (gsplit) {
        var tg2 = num_(gu2.sp[gbk]) + 1; if (tg2 < 2) tg2 = 2;
        if (tg2 > 3) return { ok: false, err: 'maxed', p: me };
        var SP2 = SPLIT[tg2];
        if (petLv_(gpet) < SP2.lv) return { ok: false, err: 'splitlv', need: SP2.lv, p: me };
        if (SP2.aw && !gpet.aw) return { ok: false, err: 'splitaw', p: me };
        Object.keys(QB).forEach(function (b) { (QB[b] || []).forEach(function (qq, ix) { if (num_(qq.d) >= 2) pool.push({ b: b, i: ix, q: qq }); }); });
      } else {
        if (!BOARD_NAME[gis]) return { ok: false, err: 'bad', p: me };
        (QB[gis] || []).forEach(function (qq, ix) { pool.push({ b: gis, i: ix, q: qq }); });
        if (num_(gu2.cd[gis]) > gnow) return { ok: false, err: 'gcool', left: num_(gu2.cd[gis]) - gnow, p: me };
        var GG = guardsGet_(), gc = GG[gis];
        if (gc && num_(gc.e) > gnow && gc.code === gcode) return { ok: false, err: 'gmine', p: me };
        if (gc && num_(gc.e) > gnow && num_(gc.shd) > gnow) return { ok: false, err: 'shielded', left: num_(gc.shd) - gnow, p: me };
      }
      if (pool.length < GQ_N) return { ok: false, err: 'noqbank', p: me };
      var paper = gsplit ? gqPick_(pool, 0, 5, 3) : gqPick_(pool, 3, 3, 2);
      gu2.t[gis] = num_(gu2.t[gis]) + 1;
      go.gp = { is: gis, bk: gbk, t: gnow, ids: paper.map(function (p) { return [p.b, p.i]; }), pm: paper.map(function (p) { var o4 = p.q.o.map(function (x, k) { return k; }); for (var z = o4.length - 1; z > 0; z--) { var w = Math.floor(Math.random() * (z + 1)), tt = o4[z]; o4[z] = o4[w]; o4[w] = tt; } return o4; }) };
      res.paper = { is: gis, bk: gbk, ttl: GQ_TTL, qs: paper.map(function (p, k) { return { q: p.q.q, o: go.gp.pm[k].map(function (ix) { return p.q.o[ix]; }), d: num_(p.q.d) || 2 }; }), left: GT_DAY - gu2.t[gis] };
      r[C.isle] = JSON.stringify(go);
    } else if (a === 'gsubmit') {   // v84 交卷：批改；通過就放上分靈（或換下分數較低的守護者）
      var so = isleOf_(r), su = guOf_(so), sp = so.gp, snow = Date.now(), QB2 = qbank_(), scode = String(r[C.code]).toUpperCase();
      if (!sp) return { ok: false, err: 'nopaper', p: me };
      so.gp = null; r[C.isle] = JSON.stringify(so);   // 同一份考卷只能交一次
      if (snow - sp.t > GQ_TTL) return { ok: false, err: 'gexpired', p: me };
      var ans = Array.isArray(q.ans) ? q.ans : [], score = 0, right = [];
      sp.ids.forEach(function (id, k) { var qq = (QB2[id[0]] || [])[id[1]]; var okk = !!qq && sp.pm[k][num_(ans[k])] === num_(qq.a) && ans[k] != null && ans[k] !== ''; if (okk) score++; right.push({ ok: okk ? 1 : 0, a: qq ? sp.pm[k].indexOf(num_(qq.a)) : -1, why: qq && qq.w ? qq.w : '' }); });
      var sms = snow - sp.t, sres = { score: score, n: sp.ids.length, ms: sms, right: right, is: sp.is };
      var spet = null; so.pets.forEach(function (p) { if (p.k === sp.bk && isBeast_(p.k)) spet = p; });
      if (sp.is === '*') {
        var tg3 = Math.max(2, num_(su.sp[sp.bk]) + 1), SP3 = SPLIT[tg3];
        sres.pass = SP3 && score >= SP3.pass ? 1 : 0; sres.need = SP3 ? SP3.pass : GQ_N;
        if (sres.pass) {
          var lack3 = {}; Object.keys(SP3.cost).forEach(function (k) { var h = needHave_(r, so, k === 'dia' ? 'dia' : k); if (k === 'dia') h = num_(r[C.dia]); if (h < SP3.cost[k]) lack3[k] = SP3.cost[k] - h; });
          if (Object.keys(lack3).length) { sres.pass = 0; sres.miss = lack3; }
          else { Object.keys(SP3.cost).forEach(function (k) { if (k === 'dia') r[C.dia] = num_(r[C.dia]) - SP3.cost[k]; else needPay_(r, so, k, SP3.cost[k]); }); su.sp[sp.bk] = tg3; sres.split = tg3; }
        }
        r[C.isle] = JSON.stringify(so); res.gres = sres;
      } else {
        sres.pass = score >= GUARD_PASS ? 1 : 0; sres.need = GUARD_PASS;
        if (sres.pass && spet) {
          var SG = guardsGet_(); guardSweep_(SG, rows, touched, snow);
          so = isleOf_(r); su = guOf_(so);   // 掃過期守護時可能改到自己這一列，重新讀一次
          var cap = Math.max(1, num_(su.sp[sp.bk])), used = Object.keys(SG).filter(function (k) { return SG[k].code === scode && SG[k].bk === sp.bk; }).length, cur = SG[sp.is];
          if (cur && cur.code === scode) sres.place = 'mine';
          else if (num_(su.cd[sp.is]) > snow) sres.place = 'cool';
          else if (used >= cap) sres.place = 'nosplit';
          else if (cur && num_(cur.shd) > snow) sres.place = 'shield';
          else if (cur && !(score > num_(cur.sc) || (score === num_(cur.sc) && sms < num_(cur.ms)))) { sres.place = 'lose'; sres.cur = { nick: cur.nick, sc: cur.sc, ms: cur.ms }; }
          else {
            if (cur) {
              var oldNick = cur.nick, jo = find_(rows, cur.code);
              guardEnd_(SG, sp.is, rows, touched, snow);
              if (jo >= 0) { rows[jo][C.unread] = num_(rows[jo][C.unread]) + 1; touched[jo] = 1; try { giftNote_(r, rows[jo], '🛡️ 你在「' + BOARD_NAME[sp.is] + '」的守護神獸，被船長「' + plain_(r[C.nick]) + '」用 ' + score + '/' + GQ_N + ' 題的成績換下了。已經累積的守護獎勵還在，到 🏝️ 我的小島「🛡️ 守護」領取。'); } catch (e) {} }
              sres.beat = oldNick;
              so = isleOf_(r); su = guOf_(so);
            }
            SG[sp.is] = { code: scode, nick: plain_(r[C.nick]), fid: String(r[C.fid] || ''), bk: sp.bk, iv: ivOf_(spet), aw: spet.aw ? 1 : 0, sh: spet.sh ? 1 : 0, lv: Math.min(BEAST_LV_MAX, petLv_(spet)), sc: score, ms: sms, s: snow, e: snow + GUARD_MS, c: 0, rd: 0, rp: 0, shd: 0 };
            sres.place = 'ok';
          }
          guardsPut_(SG); res.guards = guardPub_(SG, snow);
        }
        r[C.isle] = JSON.stringify(so); res.gres = sres;
      }
      sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], sp.is === '*' ? '靈脈試煉' : '守護試煉', (BOARD_NAME[sp.is] || '綜合') + ' ' + score + '/' + GQ_N + (sres.place ? ' ' + sres.place : '') + (sres.split ? ' 分靈' + sres.split : '')]);
      res.island = islePub_(r, true);
    } else if (a === 'gclaim') {   // v84 領守護獎勵
      var co = isleOf_(r), cu = guOf_(co), cnow = Date.now(), ccode = String(r[C.code]).toUpperCase(), CG = guardsGet_(), cgot = [];
      guardSweep_(CG, rows, touched, cnow); co = isleOf_(r); cu = guOf_(co);
      cu.gh.forEach(function (h) { h.code = h.code || ccode; guardPay_(r, co, h, h.e, cgot); });
      cu.gh = [];
      Object.keys(CG).forEach(function (is) { var g = CG[is]; if (g.code !== ccode) return; var rec = { code: ccode, is: is, s: g.s, e: g.e, c: g.c, rd: g.rd, rp: g.rp }; guardPay_(r, co, rec, cnow, cgot); g.c = rec.c; g.rp = rec.rp; });
      guardsPut_(CG);
      if (!cgot.length) return { ok: false, err: 'nogpend', p: me };
      r[C.isle] = JSON.stringify(co); res.ggot = cgot; res.island = islePub_(r, true);
      sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], '守護獎勵', JSON.stringify(cgot).slice(0, 300)]);
    } else if (a === 'gshield') {   // v84 撒五行結界砂
      var ho = isleOf_(r), hu = guOf_(ho), hnow = Date.now(), hcode = String(r[C.code]).toUpperCase(), HG = guardsGet_(), his = String(q.isle || ''), hg = HG[his];
      if (!hg || hg.code !== hcode || num_(hg.e) <= hnow) return { ok: false, err: 'notguard', p: me };
      if (ho.tl < 3) return { ok: false, err: 'needtemple', need: 3, p: me };
      var hpet = null; ho.pets.forEach(function (p) { if (p.k === hg.bk) hpet = p; });
      if (!hpet || petLv_(hpet) < SAND_LV) return { ok: false, err: 'sandlv', p: me };
      if (num_(hg.shd) > hnow) return { ok: false, err: 'shielded2', p: me };
      if (hu.sand < 1) return { ok: false, err: 'nosand', p: me };
      if (num_(hu.sd) >= SAND_DAY) return { ok: false, err: 'sandmax', p: me };
      if (Object.keys(HG).filter(function (k) { return HG[k].code === hcode && num_(HG[k].shd) > hnow; }).length >= SAND_ISLES) return { ok: false, err: 'sandisles', p: me };
      hu.sand--; hu.sd = num_(hu.sd) + 1; hg.shd = hg.e;
      guardsPut_(HG); r[C.isle] = JSON.stringify(ho); res.guards = guardPub_(HG, hnow); res.island = islePub_(r, true);
      sheet_('小島紀錄', L_HEAD).appendRow([new Date(), r[C.nick], r[C.code], '結界砂', BOARD_NAME[his]]);
    } else if (a === 'water') {
      var jw = findFid_(rows, q.fid);
      if (jw < 0 || jw === i) return { ok: false, err: 'bad', p: me };
      if (list_(r[C.friends]).indexOf(String(rows[jw][C.fid])) < 0) return { ok: false, err: 'notfriend', p: me };
      var mi = isleOf_(r), fi = isleOf_(rows[jw]), today = day_();
      if (mi.wd.d !== today) mi.wd = { d: today, f: [] };
      if (mi.wd.f.indexOf(String(rows[jw][C.fid])) >= 0) return { ok: false, err: 'watered', p: me };
      var nowW = Date.now(), target = -1;
      fi.f.forEach(function (c, k) { if (target < 0 && c && cropLeft_(c, nowW) > 0) target = k; });
      if (target < 0) return { ok: false, err: 'nocrop', p: me };
      fi.f[target].b = num_(fi.f[target].b) + WATER_BONUS;
      mi.wd.f.push(String(rows[jw][C.fid]));
      var wk = RES_KEYS[Math.floor(Math.random() * RES_KEYS.length)];
      r[RES[wk].col] = num_(r[RES[wk].col]) + 1;
      r[C.isle] = JSON.stringify(mi);
      rows[jw][C.isle] = JSON.stringify(fi); touched[jw] = 1;
      res.got = { k: wk, n: 1 };
      res.island = islePub_(rows[jw], false, mi);
      res.island.friend = true;

    /* ----- 漂流寶物、每日任務 ----- */
    } else if (a === 'drop') {
      var dk = String(q.k || ''), ds = num_(q.s), dcur = dropSlot_();
      var dok = ds === dcur || (ds === dcur - 1 && Date.now() % DROP_SLOT < DROP_GRACE);
      if (!dok || DROP_SPOTS.indexOf(dk) < 0) return { ok: false, err: 'nodrop', p: me };
      var spawn = null;
      dropAt_(ds).forEach(function (x) { if (x.k === dk) spawn = x; });
      if (!spawn) return { ok: false, err: 'nodrop', p: me };
      var od = isleOf_(r), dday = day_();
      if (!od.dr || od.dr.d !== dday || !Array.isArray(od.dr.k)) od.dr = { d: dday, c: 0, g: 0, k: [] };
      var dkey = ds + ':' + dk;
      if (od.dr.k.indexOf(dkey) >= 0) return { ok: false, err: 'got', p: me };
      if (spawn.t === 'c') {
        if (num_(od.dr.c) >= DROP_COIN_DAY) return { ok: false, err: 'dropmax', p: me };
        od.dr.c = num_(od.dr.c) + 1; res.add = 1;
      } else {
        if (num_(od.dr.g) >= DROP_DIA_DAY) return { ok: false, err: 'dropmax', p: me };
        od.dr.g = num_(od.dr.g) + 1;
        r[C.dia] = num_(r[C.dia]) + 1; r[C.tdia] = num_(r[C.tdia]) + 1;
      }
      od.dr.k.push(dkey);
      if (od.dr.k.length > 12) od.dr.k = od.dr.k.slice(-12);
      r[C.isle] = JSON.stringify(od);
      res.got = { t: spawn.t, k: dk };
    } else if (a === 'chest') {   // v72 寶箱
      var cid = String(q.id || '');
      if (!/^[A-Za-z0-9_-]{8,80}$/.test(cid)) return { ok: false, err: 'bad', p: me };
      var co = isleOf_(r), cday = day_(), cnow = Date.now();
      if (!co.ck || co.ck.d !== cday) co.ck = { d: cday, n: 0, t: num_(co.ck && co.ck.t), rc: [] };
      co.ck.rc = Array.isArray(co.ck.rc) ? co.ck.rc.slice(-CHEST_DAY) : [];
      var cold = null; co.ck.rc.forEach(function (x) { if (x.id === cid) cold = x; });
      if (cold) { res.chest = cold.r; res.ck = { n: num_(co.ck.n), max: CHEST_DAY }; }
      else {
        if (num_(co.ck.n) >= CHEST_DAY) return { ok: false, err: 'chestmax', p: me, ck: { n: num_(co.ck.n), max: CHEST_DAY } };
        if (cnow - num_(co.ck.t) < CHEST_GAP) return { ok: false, err: 'chestwait', p: me, wait: Math.ceil((CHEST_GAP - (cnow - num_(co.ck.t))) / 1000) };
        if (!r[C.seen] || cnow - new Date(r[C.seen]).getTime() >= ONLINE_WIN) return { ok: false, err: 'chestidle', p: me };
        var cp = chestRoll_(), cn = cp[1] + Math.floor(Math.random() * (cp[2] - cp[1] + 1)), cr = { k: cp[0], n: cn };
        if (cp[0] === 'coin') res.add = cn;
        else if (cp[0] === 'dia') { r[C.dia] = num_(r[C.dia]) + cn; r[C.tdia] = num_(r[C.tdia]) + cn; }
        else if (cp[0] === 'shard') {
          var cb = btOf_(co), csk = BEASTS[Math.floor(Math.random() * BEASTS.length)], csp = partRoll_();
          cb.sh[csk + '.' + csp] = num_(cb.sh[csk + '.' + csp]) + 1; cr.b = csk; cr.part = csp; cr.name = ANIMALS[csk].name; cr.el = ANIMALS[csk].beast;
        } else r[BAG_COL[cp[0]]] = num_(r[BAG_COL[cp[0]]]) + cn;
        co.ck.n = num_(co.ck.n) + 1; co.ck.t = cnow; co.ck.rc.push({ id: cid, r: cr });
        r[C.isle] = JSON.stringify(co);
        res.chest = cr; res.ck = { n: co.ck.n, max: CHEST_DAY };
      }
    } else if (a === 'qclaim') {
      var oq = isleOf_(r);
      qState_(oq, r);
      var qid = String(q.id || '');
      if (oq.q.ids.indexOf(qid) < 0 || !QUESTS[qid]) return { ok: false, err: 'bad', p: me };
      if (oq.q.done.indexOf(qid) >= 0) return { ok: false, err: 'got', p: me };
      if (!QUESTS[qid].chk(r, oq)) return { ok: false, err: 'notyet', p: me };
      oq.q.done.push(qid);
      res.add = QUEST_COIN;
      r[C.isle] = JSON.stringify(oq);
      res.got = { t: 'q', k: qid };

    /* ----- 公告 ----- */
    } else if (a === 'annread') {
      var seq = Math.min(num_(q.seq), anns_().max);
      if (seq > num_(r[C.annSeen])) r[C.annSeen] = seq;
    } else if (a === 'annpost' || a === 'annedit' || a === 'anndel') {
      if (!me.ann) return { ok: false, err: 'admin', p: me };
      var ash = sheet_('公告', A_HEAD), atitle = text_(q.title, ANN_TITLE) || '公告', atext = body_(q.text, ANN_LEN);
      if (a !== 'anndel' && plain_(atext).length < 2) return { ok: false, err: 'annshort', p: me };
      if (a === 'annpost') {
        var an = ash.getLastRow() - 1, aid = (an > 0 ? num_(ash.getRange(an + 1, 1).getValue()) : 0) + 1;
        ash.appendRow([aid, new Date(), atitle, atext, r[C.nick], '', '']);
        r[C.annSeen] = aid; // 自己發的就當作看過
      } else {
        var arow = msgRow_(ash, q.id);
        if (!arow) return { ok: false, err: 'bad', p: me };
        if (a === 'annedit') { ash.getRange(arow, 3, 1, 1).setValue(atitle); ash.getRange(arow, 4, 1, 1).setValue(atext); ash.getRange(arow, 6, 1, 1).setValue(new Date()); }
        else ash.getRange(arow, 7, 1, 1).setValue('刪除');
      }
      CacheService.getScriptCache().remove('anns');

    /* ----- 好友 ----- */
    } else if (a === 'friends') {
      res.friends = friendsOf_(rows, r);
    } else if (a === 'fadd') {
      var j = findFid_(rows, q.fid);
      if (j < 0) return { ok: false, err: 'nofid', p: me };
      if (j === i) return { ok: false, err: 'self', p: me };
      var mine = list_(r[C.friends]), theirs = list_(rows[j][C.friends]), ofid = String(rows[j][C.fid]);
      if (mine.indexOf(ofid) < 0) {
        if (mine.length >= FRIEND_MAX) return { ok: false, err: 'fmax', p: me };
        mine.push(ofid); r[C.friends] = mine.join(',');
      }
      if (theirs.indexOf(String(r[C.fid])) < 0 && theirs.length < FRIEND_MAX) {
        theirs.push(String(r[C.fid])); rows[j][C.friends] = theirs.join(','); touched[j] = 1;
      }
      res.added = pub_(rows[j]);
      res.friends = friendsOf_(rows, r);
    } else if (a === 'fdel') {
      var fid = String(q.fid || '').toUpperCase();
      r[C.friends] = list_(r[C.friends]).filter(function (f) { return f !== fid; }).join(',');
      var jd = findFid_(rows, fid);
      if (jd >= 0) {
        rows[jd][C.friends] = list_(rows[jd][C.friends]).filter(function (f) { return f !== String(r[C.fid]); }).join(',');
        touched[jd] = 1;
      }
      res.friends = friendsOf_(rows, r);
    } else if (a === 'gift') {
      var gk = String(q.k || ''), jg = findFid_(rows, q.fid);
      if (!RES[gk] || jg < 0) return { ok: false, err: 'bad', p: me };
      var gfid = String(rows[jg][C.fid]);
      if (list_(r[C.friends]).indexOf(gfid) < 0) return { ok: false, err: 'notfriend', p: me };
      var gl = list_(r[C.gifts]);
      if (gl.indexOf(gfid) >= 0) return { ok: false, err: 'gifted', p: me };
      if (num_(r[RES[gk].col]) < 5) return { ok: false, err: 'few', p: me };
      r[RES[gk].col] = num_(r[RES[gk].col]) - 5;
      rows[jg][RES[gk].col] = num_(rows[jg][RES[gk].col]) + 5;
      rows[jg][C.unread] = num_(rows[jg][C.unread]) + 1;
      touched[jg] = 1;
      gl.push(gfid); r[C.gifts] = gl.join(',');
      sheet_('悄悄話', N_HEAD).appendRow([new Date(), r[C.fid], r[C.nick], gfid, rows[jg][C.nick], '🎁 送你 5 個' + RES[gk].item]);
      res.friends = friendsOf_(rows, r);
    } else if (a === 'note') {
      var jn = findFid_(rows, q.fid), txt = body_(q.text, NOTE_LEN), nimgs = imgsIn_(q, IMG_MAX_N), nimgId = '';
      if (!nimgs) return { ok: false, err: 'imgbad', p: me };
      if (jn < 0 || (!plain_(txt) && !nimgs.length)) return { ok: false, err: 'bad', p: me };
      if (list_(r[C.friends]).indexOf(String(rows[jn][C.fid])) < 0) return { ok: false, err: 'notfriend', p: me };
      if (num_(r[C.noteN]) >= NOTE_DAY) return { ok: false, err: 'notemax', p: me };
      r[C.noteN] = num_(r[C.noteN]) + 1;
      rows[jn][C.unread] = num_(rows[jn][C.unread]) + 1;
      touched[jn] = 1;
      if (nimgs.length) { try { nimgId = imgsSave_('W', nimgs).join(','); } catch (nie) { return { ok: false, err: 'imgfail', p: me }; } }
      sheet_('悄悄話', N_HEAD).appendRow([new Date(), r[C.fid], r[C.nick], rows[jn][C.fid], rows[jn][C.nick], txt, nimgId, '', '', '']);
    } else if (a === 'nedit' || a === 'ndel') {
      /* v81 悄悄話：寄件人可以編輯、收回（雙方都看不到）；收件人可以從自己的收件匣刪掉（對方那邊還在） */
      var nf = noteRow_(q.id), myf = String(r[C.fid] || '');
      if (!nf || !myf || nf.v[8] === '收回') return { ok: false, err: 'bad', p: me };
      var nS = String(nf.v[1]) === myf, nR = String(nf.v[3]) === myf, nold = idList_(nf.v[6]);
      if (a === 'nedit') {
        if (!nS || sysNote_(nf.v[5])) return { ok: false, err: 'bad', p: me };
        var ntx = body_(q.text, NOTE_LEN), nadd = imgsIn_(q, IMG_MAX_N), nkeep = keepList_(q.keep, nold), nnew;
        if (!nadd || nkeep.length + nadd.length > IMG_MAX_N) return { ok: false, err: 'imgbad', p: me };
        if (!plain_(ntx) && !nkeep.length && !nadd.length) return { ok: false, err: 'bad', p: me };
        try { nnew = nkeep.concat(imgsSave_('W', nadd)); } catch (neie) { return { ok: false, err: 'imgfail', p: me }; }
        nold.forEach(function (k) { if (nnew.indexOf(k) < 0) msgImgTrash_(k); });
        editLog_('編輯悄悄話', q.id, r, plain_(nf.v[5]), nold, plain_(ntx), nnew);
        nf.v[5] = ntx; nf.v[6] = nnew.join(','); nf.v[7] = new Date();
      } else if (nS && !sysNote_(nf.v[5])) {
        nf.v[8] = '收回'; nold.forEach(msgImgTrash_);
        editLog_('收回悄悄話', q.id, r, plain_(nf.v[5]), nold, '', []);
      } else if (nR) nf.v[9] = 1;
      else return { ok: false, err: 'bad', p: me };
      nf.sh.getRange(nf.row, 1, 1, N_HEAD.length).setValues([nf.v]);
      res.inbox = inbox_(rows, myf);
    } else if (a === 'inbox') {
      res.inbox = inbox_(rows, String(r[C.fid]));
      r[C.unread] = 0;

    /* ----- 留言碼頭 ----- */
    } else if (a === 'msg') {
      var body = body_(q.text, MSG_LEN), mimgs = imgsIn_(q, IMG_MAX_N), mids = [];
      if (!mimgs) return { ok: false, err: 'imgbad', p: me };
      if (plain_(body).length < 2 && !mimgs.length) return { ok: false, err: 'msgshort', p: me };
      var mw = num_(r[C.msgLast]) + MSG_GAP - Date.now();
      if (mw > 0 && !me.admin) return { ok: false, err: 'msgcool', wait: Math.ceil(mw / 1000), p: me };
      if (num_(r[C.msgN]) >= MSG_DAY && !me.admin) return { ok: false, err: 'msgmax', p: me };
      var newMid = 'M' + Date.now().toString(36).toUpperCase();
      if (mimgs.length) { try { mids = imgsSave_('M', mimgs); } catch (ie) { return { ok: false, err: 'imgfail', p: me }; } }
      r[C.msgN] = num_(r[C.msgN]) + 1;
      r[C.msgLast] = Date.now();
      sheet_('留言板', M_HEAD).appendRow([newMid, new Date(), r[C.nick], r[C.code], r[C.av], body, '', '', '', '', mids.join(','), '']);
      bump_('msgs');
    } else if (a === 'like') {
      var lt = likeTarget_(String(q.id || ''));
      if (!lt) return { ok: false, err: 'bad', p: me };
      if (lt.w === String(r[C.code]).toUpperCase()) return { ok: false, err: 'likeself', p: me };
      var lio = isleOf_(r), lkd = day_(), lkq = lio.lk && lio.lk.d === lkd ? lio.lk : { d: lkd, n: 0, t: 0 };
      if (Date.now() - num_(lkq.t) < LIKE_GAP) return { ok: false, err: 'likefast', p: me };
      if (num_(lkq.n) >= LIKE_DAY) return { ok: false, err: 'likemax', p: me };
      var lsh = sheet_('按讚', LK_HEAD), ln = lsh.getLastRow() - 1, lvals = ln > 0 ? lsh.getRange(2, 1, ln, 2).getValues() : [], lmine = 0, lcnt = 0, lcode = String(r[C.code]).toUpperCase();
      lvals.forEach(function (v, x) { if (String(v[0]) !== lt.id) return; lcnt++; if (String(v[1]).toUpperCase() === lcode) lmine = x + 2; });
      if (lmine) { lsh.getRange(lmine, 1, 1, LK_HEAD.length).setValues([['', '', '', '']]); lcnt--; res.liked = false; }
      else { lsh.appendRow([lt.id, r[C.code], r[C.nick], new Date()]); lcnt++; res.liked = true; }
      res.likes = lcnt; lkq.n = num_(lkq.n) + 1; lkq.t = Date.now(); lio.lk = lkq; r[C.isle] = JSON.stringify(lio);
      bump_('msgs');
    } else if (a === 'msgreply') {
      var parentSheet = sheet_('留言板', M_HEAD), parentRow = msgRow_(parentSheet, q.id);
      if (!parentRow) return { ok: false, err: 'bad', p: me };
      var parent = parentSheet.getRange(parentRow, 1, 1, M_HEAD.length).getValues()[0];
      if (parent[9] === '隱藏' || parent[9] === '刪除') return { ok: false, err: 'bad', p: me };
      var replyBody = body_(q.text, MSG_LEN), rimgs = imgsIn_(q, IMG_MAX_N), replyImgId = '';
      if (!rimgs) return { ok: false, err: 'imgbad', p: me };
      if (plain_(replyBody).length < 2 && !rimgs.length) return { ok: false, err: 'msgshort', p: me };
      var replyWait = num_(r[C.msgLast]) + MSG_GAP - Date.now();
      if (replyWait > 0 && !me.admin) return { ok: false, err: 'msgcool', wait: Math.ceil(replyWait / 1000), p: me };
      if (num_(r[C.msgN]) >= MSG_DAY && !me.admin) return { ok: false, err: 'msgmax', p: me };
      if (rimgs.length) { try { replyImgId = imgsSave_('M', rimgs).join(','); } catch (rie) { return { ok: false, err: 'imgfail', p: me }; } }
      sheet_('留言回覆', MR_HEAD).appendRow([String(parent[0]), new Date(), r[C.nick], r[C.code], r[C.av], replyBody, replyImgId, '', '']);
      r[C.msgN] = num_(r[C.msgN]) + 1; r[C.msgLast] = Date.now(); notifyMsgReply_(rows, r, parent, plain_(replyBody) ? replyBody : '🖼️（圖片）', touched); bump_('msgs');
    } else if (a === 'medit') {
      /* v81 編輯自己的留言或回覆：改文字、留下哪些舊圖、加新圖（合計最多 4 張）；改前內容記到「編輯紀錄」 */
      var fe = msgFind_(q.id);
      if (!fe || fe.parent[9] === '隱藏') return { ok: false, err: 'bad', p: me };
      if (fe.w !== String(r[C.code]).toUpperCase()) return { ok: false, err: 'admin', p: me };
      var etxt = body_(q.text, MSG_LEN), eadd = imgsIn_(q, IMG_MAX_N), ekeep = keepList_(q.keep, fe.imgs), enew;
      if (!eadd || ekeep.length + eadd.length > IMG_MAX_N) return { ok: false, err: 'imgbad', p: me };
      if (plain_(etxt).length < 2 && !ekeep.length && !eadd.length) return { ok: false, err: 'msgshort', p: me };
      try { enew = ekeep.concat(imgsSave_('M', eadd)); } catch (eie) { return { ok: false, err: 'imgfail', p: me }; }
      fe.imgs.forEach(function (k) { if (enew.indexOf(k) < 0) msgImgTrash_(k); });
      editLog_(fe.kind === 'm' ? '編輯留言' : '編輯回覆', q.id, r, fe.text, fe.imgs, plain_(etxt), enew);
      fe.v[5] = etxt;
      if (fe.kind === 'm') { fe.v[10] = enew.join(','); fe.v[11] = new Date(); fe.sh.getRange(fe.row, 1, 1, M_HEAD.length).setValues([fe.v]); }
      else { fe.v[6] = enew.join(','); fe.v[7] = new Date(); fe.sh.getRange(fe.row, 1, 1, MR_HEAD.length).setValues([fe.v]); }
      bump_('msgs');
    } else if (a === 'mdel' && String(q.id || '').indexOf('_') > 0) {
      /* v81 刪除回覆：本人或站長 */
      var fdl = msgFind_(q.id);
      if (!fdl || fdl.kind !== 'r') return { ok: false, err: 'bad', p: me };
      if (fdl.w !== String(r[C.code]).toUpperCase() && !me.admin) return { ok: false, err: 'admin', p: me };
      fdl.v[8] = '刪除'; fdl.sh.getRange(fdl.row, 1, 1, MR_HEAD.length).setValues([fdl.v]);
      fdl.imgs.forEach(msgImgTrash_);
      editLog_('刪除回覆', q.id, r, fdl.text, fdl.imgs, '', []);
      bump_('msgs');
    } else if (a === 'reply' || a === 'hide' || a === 'mdel') {
      var ms = sheet_('留言板', M_HEAD), mrow = msgRow_(ms, q.id);
      if (!mrow) return { ok: false, err: 'bad', p: me };
      var mv = ms.getRange(mrow, 1, 1, M_HEAD.length).getValues()[0];
      if (a === 'reply') {
        if (!me.admin) return { ok: false, err: 'admin', p: me };
        var rep = body_(q.text, MSG_LEN);
        if (!plain_(rep)) { mv[6] = ''; mv[7] = ''; mv[8] = ''; }
        else { var isNewReply = !mv[6]; if (mv[6] && mv[7]) mv[8] = new Date(); else mv[7] = new Date(); mv[6] = rep; if (isNewReply && mv[9] !== '隱藏' && mv[9] !== '刪除') notifyMsgReply_(rows, r, mv, rep, touched); }
      } else if (a === 'hide') {
        if (!me.admin) return { ok: false, err: 'admin', p: me };
        mv[9] = q.h ? '隱藏' : '';
      } else {
        if (String(mv[3]).toUpperCase() !== me.code.toUpperCase() && !me.admin) return { ok: false, err: 'admin', p: me };
        var dimgs = mainImgs_(mv);
        mv[9] = '刪除';
        msgImgTrash_(String(mv[0])); dimgs.forEach(msgImgTrash_);
        editLog_('刪除留言', String(mv[0]), r, plain_(mv[5]), dimgs, '', []);
      }
      ms.getRange(mrow, 1, 1, M_HEAD.length).setValues([mv]);
      bump_('msgs');
    } else {
      return { ok: false, err: 'bad' };
    }

    if (shopOp && shopId) {
      var shopSaved = isleOf_(r);
      shopRecords.push({id:shopId,sig:shopSig,time:Date.now()}); shopSaved.shopReceipts = shopRecords;
      r[C.isle] = JSON.stringify(shopSaved);
    }
    if (res.add) { r[C.bal] = num_(r[C.bal]) + res.add; r[C.earned] = num_(r[C.earned]) + res.add; }
    if (!num_(q.idle)) r[C.seen] = new Date();   // v66：網頁閒置時的自動同步（idle=1）不算在線，有實際操作才算
    sh.getRange(i + 2, 1, 1, P_HEAD.length).setValues([r]);
    Object.keys(touched).forEach(function (jx) { jx = Number(jx); sh.getRange(jx + 2, 1, 1, P_HEAD.length).setValues([rows[jx]]); });
    res.p = profile_(r);
    return res;
  } finally {
    lock.releaseLock();
    logAct_(a, 'ok', lk1 - lk0, Date.now() - lk1);   // v75：執行紀錄裡看得到每次寫入是哪個動作、等鎖與執行各花多久
  }
}
function logAct_(a, st, wait, run) { try { console.log('act=' + a + ' ' + st + ' wait=' + wait + 'ms run=' + run + 'ms' + (run > 8000 ? ' SLOW' : '')); } catch (e) {} }

/* 造訪紀錄：一次掃過整張表，算好每座島的人數與最近 12 位，快取 2 分鐘（有人新留下足跡就清掉） */
var VIS_TTL = 120;
function visStats_() {
  var hit = cget_('vis');
  if (hit) return hit;
  var vs = sheet_('造訪紀錄', V_HEAD), n = vs.getLastRow() - 1, out = {};
  if (n > 0) {
    var rows = vs.getRange(2, 1, n, V_HEAD.length).getValues(), seen = {};
    for (var i = rows.length - 1; i >= 0; i--) {
      var r = rows[i], k = String(r[3]);
      if (!k || r[6] === '是' || seen[k + '|' + r[2]]) continue;
      seen[k + '|' + r[2]] = 1;
      var o = out[k] || (out[k] = { total: 0, list: [] });
      o.total++;
      if (o.list.length < 12) o.list.push({ nick: plain_(r[1]), d: Utilities.formatDate(new Date(r[0]), TZ, 'M/d') });
    }
  }
  cput_('vis', out, VIS_TTL);
  return out;
}
function visitors_(isle) { return (isle && visStats_()[isle]) || { list: [], total: 0 }; }

/* 排行榜：coin（目前金幣）、res（累計採集的物資）、dia（v61 起：手上現有的鑽石）。
   三份名單一起算好，在 Google 快取放 60 秒，期間不用重讀整張玩家表。 */
var TOP_TTL = 60;
function topLists_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('top6');
  if (hit) return JSON.parse(hit);
  var rows = rows_(players_()), out = {}, isl = rows.map(isleOf_), scoreOf = {}; var nowT = Date.now();
  rows.forEach(function (r, x) { scoreOf[x] = isleScore_(isl[x]); });
  /* v65 神獸榜：小島上每隻神獸的 HP 加總（神獸戰力）；bs 是擁有的神獸與 IV、等級 */
  var powOf = {}, bsOf = {};
  rows.forEach(function (r, x) { var p = 0, bs = []; (isl[x].pets || []).forEach(function (pt) { if (!isBeast_(pt.k)) return; var iv = ivOf_(pt), lv = petLv_(pt); var hp = beastHp_(pt.k, iv, lv); p += hp; bs.push({ k: pt.k, iv: iv, lv: lv, hp: hp }); }); powOf[x] = p; bsOf[x] = bs; });   // v77 排行榜每隻多帶 HP
  [['coin', C.bal], ['res', C.tres], ['dia', C.dia], ['isle', -1], ['beast', -2]].forEach(function (kc) {   // v61：鑽石榜改看手上現有的鑽石
    var k = kc[0], col = kc[1];
    var val = function (r) { return col === -2 ? powOf[rows.indexOf(r)] : col < 0 ? scoreOf[rows.indexOf(r)] : num_(r[col]); };
    out[k] = rows
      .filter(function (r) { return r[C.nick] && r[C.admin] !== '是' && (k === 'coin' || val(r) > 0); })
      .sort(function (x, y) { return val(y) - val(x); })
      .slice(0, 20)
      .map(function (r) {
        var o = { c: String(r[C.code]).toUpperCase(), nick: plain_(r[C.nick]), av: plain_(r[C.av]), v: val(r), bal: num_(r[C.bal]), fid: String(r[C.fid] || '') };
        if (r[C.seen] && nowT - new Date(r[C.seen]).getTime() < ONLINE_WIN) o.on = 1;   // 在線（跟上面「現在 X 位在線」同一個判斷）
        if (k === 'res') o.bag = bag_(r);
        if (k === 'beast') o.bs = bsOf[rows.indexOf(r)];
        return o;
      });
  });
  // 可以航向的小島：開放參觀、有蓋東西的玩家
  var voy = [];
  rows.forEach(function (r, x) {
    if (!r[C.nick] || r[C.admin] === '是' || r[C.open] === '否' || !scoreOf[x]) return;
    voy.push({ fid: String(r[C.fid] || ''), nick: plain_(r[C.nick]), av: plain_(r[C.av]), score: scoreOf[x], h: isl[x].h, pets: isl[x].pets.length, seen: r[C.seen] ? new Date(r[C.seen]).getTime() : 0 });
  });
  out.voy = voy.sort(function (p, q) { return q.score - p.score; }).slice(0, VOY_KEEP);
  // 登島船長總人數：所有有暱稱的一般玩家（不含站長帳號），不是只算排行榜前 20 名
  out.n = rows.filter(function (r) { return r[C.nick] && r[C.admin] !== '是'; }).length;
  out.on = rows.filter(function (r) { return r[C.nick] && r[C.admin] !== '是' && r[C.seen] && nowT - new Date(r[C.seen]).getTime() < ONLINE_WIN; }).length;
  try { cache.put('top6', JSON.stringify(out), TOP_TTL); } catch (e) {}
  return out;
}
function voyage_() { return { ok: true, list: topLists_().voy || [] }; }
function anns_() {
  var cache = CacheService.getScriptCache(), hit = cache.get('anns');
  if (hit) return JSON.parse(hit);
  var sh = sheet_('公告', A_HEAD), n = sh.getLastRow() - 1, list = [], max = 0;
  if (n > 0) {
    var v = sh.getRange(2, 1, n, A_HEAD.length).getValues();
    for (var x = v.length - 1; x >= 0; x--) {
      var r = v[x], id = num_(r[0]);
      if (!id) continue;
      if (id > max) max = id;
      if (String(r[6]) === '刪除' || list.length >= ANN_KEEP) continue;
      list.push({ id: id, t: fmt_(r[1]), title: plain_(r[2]), text: plain_(r[3]), by: plain_(r[4]), re: fmt_(r[5]) });
    }
  }
  var out = { ok: true, list: list, max: max };
  try { cache.put('anns', JSON.stringify(out), TOP_TTL); } catch (e) {}
  return out;
}
function top_(q) {
  var lists = topLists_(), code = String(q.code || '').toUpperCase();
  function pub(list) { return list.map(function (o) { var x = {}; for (var k in o) if (k !== 'c') x[k] = o[k]; x.me = !!code && o.c === code; return x; }); }
  if (q.k === 'all') return { ok: true, n: lists.n, on: lists.on || 0, all: { coin: pub(lists.coin), res: pub(lists.res), dia: pub(lists.dia), isle: pub(lists.isle || []), beast: pub(lists.beast || []) } };
  var k = q.k === 'res' || q.k === 'dia' ? q.k : 'coin';
  return { ok: true, k: k, n: lists.n, on: lists.on || 0, top: pub(lists[k]) };
}

/* ---------- 物資島：每天第一次有人來時重抽總量與鑽石位置 ---------- */
/* 下一次採集會拿到幾個：先抽好、存在玩家的小島資料裡，網頁一進物資島就拿到，連點完成時馬上顯示，不用等後台回覆（後台再照這個數字結算） */
function rollN_(il) { return il.lo + Math.floor(Math.random() * (il.hi - il.lo + 1)); }
function isles_() {
  var sh = sheet_('物資島', R_HEAD), t = day_(), n = sh.getLastRow() - 1;
  var vals = n > 0 ? sh.getRange(2, 1, n, R_HEAD.length).getValues() : [];
  var byId = {};
  vals.forEach(function (v) { byId[String(v[0])] = v; });
  var map = {}, rows = [], dirty = false;
  ISL.forEach(function (il, i) {
    var v = byId[il.id];
    var gold = il.t === 'gold';
    if (v && Number(v[2]) === t && gold && (num_(v[3]) !== GOLD_STOCK_MAX || num_(v[4]) > GOLD_STOCK_MAX)) { v = v.slice(); v[3] = GOLD_STOCK_MAX; v[4] = Math.min(num_(v[4]), GOLD_STOCK_MAX); dirty = true; } // 調整過總量：今天的金礦也改成現在的數字（已被採走的照算）
    if (!v || Number(v[2]) !== t) {
      var total = gold ? GOLD_STOCK_MIN + Math.floor(Math.random() * (GOLD_STOCK_MAX - GOLD_STOCK_MIN + 1)) : STOCK_MIN + Math.floor(Math.random() * (STOCK_MAX - STOCK_MIN + 1));
      var nd = gold ? 0 : Math.floor(Math.random() * (DIA_MAX + 1)), pos = [];
      while (pos.length < nd) { var p = 1 + Math.floor(Math.random() * total); if (pos.indexOf(p) < 0) pos.push(p); }
      v = [il.id, il.name, t, total, 0, "'" + pos.sort(function (x, y) { return x - y; }).join(','), 0];
      dirty = true;
    } else v = [v[0], v[1], v[2], v[3], v[4], "'" + String(v[5]).replace(/^'/, ''), v[6]];
    rows.push(v);
    map[il.id] = { row: i + 2, total: num_(v[3]), taken: num_(v[4]),
      dias: plain_(v[5]).split(',').filter(String).map(Number), found: num_(v[6]) };
  });
  var ordered = vals.length >= ISL.length && ISL.every(function (il, i) { return String(vals[i][0]) === il.id; });
  if (dirty || !ordered) sh.getRange(2, 1, rows.length, R_HEAD.length).setValues(rows); // 一次寫完 20 列（比一列一列寫快很多）
  return { sh: sh, map: map };
}
/* 地圖上顯示「資源島現在有沒有東西可採」用的輕量版：只讀、不重抽、快取 20 秒（有人採集就清掉） */
/* 留言碼頭的「動態數」：公開的留言數＋站長回覆數（隱藏／刪除的不算），網頁用它判斷有沒有新留言可以通知。依留言版本快取 6 小時 */
function msgAct_() {
  var k = 'mact:' + ver_('msgs'), hit = cget_(k);
  if (hit !== null && hit !== undefined) return hit;
  var sh = sheet_('留言板', M_HEAD), n = sh.getLastRow() - 1, act = 0;
  if (n > 0) sh.getRange(2, 1, n, M_HEAD.length).getValues().forEach(function (v) {
    var st = String(v[9]);
    if (!v[0] || st === '刪除' || st === '隱藏') return;
    act++; if (v[6]) act++;
  });
  cput_(k, act, 21600);
  return act;
}
function islLite_() {
  var hit = cget_('isl2');
  if (hit) return withOpen_(hit);
  var sh = sheet_('物資島', R_HEAD), n = sh.getLastRow() - 1, t = day_(), left = {};
  ISL.forEach(function (il) { left[il.id] = 1; }); // 今天還沒人來過 → 當作還有
  (n > 0 ? sh.getRange(2, 1, n, R_HEAD.length).getValues() : []).forEach(function (v) {
    var k = String(v[0]);
    if (ISL_MAP[k] && Number(v[2]) === t) left[k] = Math.max(0, num_(v[3]) - num_(v[4]));
  });
  var out = { ok: true, left: left, ma: msgAct_() };
  cput_('isl2', out, 20);
  return withOpen_(out);
}
/* 地圖用：每座島這一輪的豐富度 op[id] = [0稀少/1普通/2豐富, 還剩幾毫秒換批]（每次現算，不進快取） */
function withOpen_(o) {
  var op = {};
  ISL.forEach(function (il) { var x = islLv_(il); op[il.id] = [x.lv, x.w]; });
  var bn = []; try { bn = bnews_(); } catch (e) {}
  return { ok: o.ok, left: o.left, ma: o.ma, op: op, bn: bn };
}
function islesPub_(st, r) {
  var o = {}, tc = r ? counts_(r[C.gToday]) : {};
  ISL.forEach(function (il) {
    var m = st.map[il.id];
    var lv = islLv_(il);
    o[il.id] = { total: m.total, left: Math.max(0, m.total - m.taken), found: m.found, mine: tc[il.id] || 0, max: il.t === 'gold' ? GOLD_MAX : GATHER_MAX, lv: lv.lv, w: lv.w };
  });
  return o;
}

/* ---------- 我的小島 ---------- */
function woodGrow_(seed, i, t) { return (240 + Math.floor(rng_(hash_('wood-grow|' + seed + '|' + i + '|' + t))() * 121)) * 60000; }
function isleOf_(r) {
  var o = {};
  try { o = JSON.parse(plain_(r[C.isle]) || '{}') || {}; } catch (e) { o = {}; }
  o.h = num_(o.h); o.fields = num_(o.fields);
  o.f = Array.isArray(o.f) ? o.f : [];
  o.dl = o.dl && typeof o.dl === 'object' ? o.dl : {};
  o.trees = Array.isArray(o.trees) ? o.trees : [];
  o.xl = Math.max(1, Math.min(LAND_MAX, num_(o.xl) || 1)); o.tl = Math.max(1, Math.min(TEMPLE_MAX, num_(o.tl) || 1));   // v82 擴地、神殿等級
  o.fac = o.fac && typeof o.fac === 'object' && !Array.isArray(o.fac) ? o.fac : {};
  Object.keys(o.fac).forEach(function (k) { if (!FAC[k] || !o.fac[k] || typeof o.fac[k] !== 'object') delete o.fac[k]; });
  o.gd = Array.isArray(o.gd) ? o.gd.filter(function (g, i, a) { return GARDEN[g] && a.indexOf(g) === i; }) : [];
  var nowB = Date.now(), bb = {};
  if (o.bb) Object.keys(o.bb).forEach(function (k) {
    var e = num_(o.bb[k] && o.bb[k].e);
    if (e > nowB) { bb[k] = { e: e, t: num_(o.bb[k].t) }; return; } // 還在施工
    if (k === 'land') { o.xl = Math.max(o.xl, Math.min(LAND_MAX, num_(o.bb[k].t))); return; }   // v82 擴地完工
    if (k === 'temple') { o.tl = Math.max(o.tl, Math.min(TEMPLE_MAX, num_(o.bb[k].t))); return; }
    if (FAC[k]) {   // v82 生產設施完工：原本存的數量保留，之後照新等級的速度生產
      if (k === 'depot') Object.keys(o.fac).forEach(function (q) { var fq = o.fac[q]; if (!FAC[q].res || !num_(fq.lv)) return; var per = facPer_(q, fq.lv, o), cap = facCap_(o, q, fq.lv); if ((e - num_(fq.c)) / per >= cap) fq.c = e - cap * per; });   // 倉庫變大前已經存滿的，從完工那一刻才繼續生產，不會一下子補滿
      var f0 = o.fac[k] || { lv: 0, c: e }, t0 = Math.min(FAC[k].max, num_(o.bb[k].t)), keep = 0;
      if (FAC[k].res && num_(f0.lv)) keep = Math.min(facCap_(o, k, f0.lv), Math.max(0, Math.floor((e - num_(f0.c)) / facPer_(k, f0.lv, o))));
      if (t0 > num_(f0.lv)) { f0.lv = t0; if (FAC[k].res) f0.c = e - keep * facPer_(k, t0, o); }
      o.fac[k] = f0; return;
    }
    if (k === 'field') { o.fields++; }                          // 菜田完工
    else if (k === 'tree') { if (o.trees.length < TREE_MAX) o.trees.push({ p: e, lp: e }); }   // 果樹蓋好：從完工那一刻開始長
    else if (DECO[k]) { o.deco = Array.isArray(o.deco) ? o.deco : []; if (o.deco.indexOf(k) < 0) o.deco.push(k); o.dl[k] = Math.max(num_(o.dl[k]), num_(o.bb[k].t) || 1); }
  });
  o.bb = bb;
  while (o.f.length < o.fields) o.f.push(null);
  o.deco = Array.isArray(o.deco) ? o.deco.filter(function (d) { return DECO[d]; }) : [];
  if (o.deco.indexOf('tree') >= 0) { // 舊版的單棵果樹 → 變成已經長大的結果樹
    if (!o.trees.length) o.trees.push({ p: 1, lp: 1 });
    o.deco = o.deco.filter(function (d) { return d !== 'tree'; });
  }
  o.deco.forEach(function (d) { if (!num_(o.dl[d])) o.dl[d] = 1; });
  o.pets = Array.isArray(o.pets) ? o.pets : [];
  o.veg = o.veg || {};
  Object.keys(VEG).forEach(function (k) { o.veg[k] = num_(o.veg[k]); });
  o.wd = o.wd && o.wd.f ? o.wd : { d: 0, f: [] };
  o.vis = Array.isArray(o.vis) ? o.vis : [];
  var nowI = Date.now();
  if (o.hb && num_(o.hb.e) <= nowI) { o.h = Math.max(o.h, num_(o.hb.t)); o.hb = null; } // 施工時間到了，小屋完工
  if (!o.hb) o.hb = null;
  if (o.h < 1) { o.h = 1; if (o.hb && num_(o.hb.t) <= 1) o.hb = null; }
  o.ship = o.ship && Array.isArray(o.ship.own) ? o.ship : { cur: 0, own: [0] };
  if (o.ship.own.indexOf(0) < 0) o.ship.own.unshift(0);
  if (!o.ship.names || typeof o.ship.names !== 'object') o.ship.names = {}; // 每艘船可以自己取名字
  if (o.ship.own.indexOf(o.ship.cur) < 0) o.ship.cur = 0;
  var cd = {};
  if (o.cd) Object.keys(o.cd).forEach(function (k) { if (ISL_MAP[k] && num_(o.cd[k]) > nowI) cd[k] = num_(o.cd[k]); });
  o.cd = cd;
  // 固定樹位令每棵樹可獨立計算每日採收次數；沿用 v31 已生長樹木的位置。
  var seed = String(r[C.fid] || r[C.code] || ''), first = new Date(r[C.first]).getTime();
  var base = Math.max(1794499200000, isFinite(first) ? first : 0);
  if (!Array.isArray(o.woodSlots)) {
    var oldTrees = o.wild && Array.isArray(o.wild.items) ? o.wild.items.slice(0, 5) : [];
    o.woodSlots = [];
    for (var si=0;si<5;si++) {
      var prior=oldTrees[si], rnd=rng_(hash_('wood-slot|' + seed + '|' + si));
      var angle=rnd()*Math.PI*2, radius=Math.sqrt(rnd());
      var born=base + si*1200000;
      if (o.starterWood && si===0 && !prior) born=0;
      o.woodSlots.push({id:prior?String(prior.id):'slot'+si, x:prior?prior.x:Math.round(50+Math.cos(angle)*radius*27), y:prior?prior.y:Math.round(50+Math.sin(angle)*radius*21), start:prior?0:born, ready:(prior||(o.starterWood&&si===0))?0:born+woodGrow_(seed,si,born), day:0, count:0});
    }
  }
  o.layout = o.layout && typeof o.layout === 'object' && !Array.isArray(o.layout) ? o.layout : {};
  o.fish = num_(o.fish); o.dish = o.dish && typeof o.dish === 'object' ? o.dish : {};   // v83
  Object.keys(o.dish).forEach(function (k) { if (!DISH[k]) delete o.dish[k]; else o.dish[k] = num_(o.dish[k]); });
  if (o.ck && DISH[o.ck.d] && num_(o.ck.e) <= nowI) { o.dish[o.ck.d] = num_(o.dish[o.ck.d]) + 1; o.ck = null; }   // 料理煮好了，自動放進料理庫存
  if (!o.ck || !DISH[o.ck.d]) o.ck = null;
  if (o.job && !JOBS[num_(o.job.j)]) o.job = null;
  o.cx = o.cx && typeof o.cx === 'object' ? o.cx : {}; o.cxc = o.cxc && typeof o.cxc === 'object' ? o.cxc : {};
  var cxn = cxCur_(o); Object.keys(cxn).forEach(function (k) { o.cx[k] = 1; });   // 拿到過就點亮（之後送人也不熄滅）
  return o;
}
function isleScore_(o) {
  var s = o.h * 10;
  var nowS = Date.now();
  o.deco.forEach(function (d) { s += (FT_PTS[d] || [0, DECO[d].pts])[Math.min(DECO_LV_MAX, num_(o.dl[d]) || 1)]; });
  o.trees.forEach(function (t) { s += [3, 5, 8][treeStage_(t, nowS)]; });
  o.pets.forEach(function (p) { s += num_(p.aff); });
  s += (o.xl - 1) * 20 + (o.tl - 1) * 15;   // v82
  Object.keys(o.fac).forEach(function (k) { s += num_(o.fac[k].lv) * 5; });
  o.gd.forEach(function (g) { s += GARDEN[g].pts; });
  return s;
}
function cropLeft_(c, now) { return Math.max(0, num_(c.t) + VEG[c.v].hours * HOUR - num_(c.b) - now); }
function fullNow_(p, now) { return Math.max(0, Math.min(100, Number(p.full) - HUNGER_PER_DAY * (now - num_(p.ft)) / DAY_MS)); }
function petLv_(p) { var l = 1 + Math.floor(num_(p.aff) / 10); return isBeast_(p.k) ? Math.min(BEAST_LV_MAX, l) : l; }
function hasCost_(r, cost) { for (var k in cost) if (num_(r[BAG_COL[k]]) < cost[k]) return false; return true; }
/* 看自己的小島（只讀，不寫回試算表、不佔用鎖）：登入小島時最常被呼叫，所以走最短的路 */
function islandOwn_(q) {
  var rows = rows_(players_()), i = find_(rows, q.code);
  if (i < 0) return { ok: false, err: 'nocode' };
  var r = rows[i];
  resetDay_(r); // 只改記憶體裡的這一列（跨日的今日計數歸零），不存回去
  return { ok: true, add: 0, island: islePub_(r, true), p: profile_(r) };
}
/* 參觀別人的小島：只讀、不排隊等鎖。回 null 表示要走原本（有鎖）的路線 */
function islandVisit_(q) {
  var rows = rows_(players_()), i = find_(rows, q.code);
  if (i < 0) return { ok: false, err: 'nocode' };
  var r = rows[i];
  if (!r[C.fid]) return null; // 還沒有好友碼的舊帳號：走有鎖的路線補上
  resetDay_(r);
  var me = profile_(r);
  if (String(q.fid).toUpperCase() === String(r[C.fid])) return { ok: true, add: 0, island: islePub_(r, true), p: me };
  var jv = findFid_(rows, q.fid);
  if (jv < 0) return { ok: false, err: 'nofid', p: me };
  var vFriend = list_(r[C.friends]).indexOf(String(rows[jv][C.fid])) >= 0;
  if (rows[jv][C.open] === '否' && !vFriend && !me.admin) return { ok: false, err: 'closed', p: me };
  var isl = islePub_(rows[jv], false, isleOf_(r));
  isl.friend = vFriend;
  return { ok: true, add: 0, island: isl, p: me };
}
/* 還缺多少：{ wood: 3, stone: 2 }（只列不夠的） */
function missCost_(r, cost) {
  var m = {};
  for (var k in cost) { var have = num_(r[BAG_COL[k]]); if (have < cost[k]) m[k] = cost[k] - have; }
  return m;
}
function payCost_(r, cost) { for (var k in cost) r[BAG_COL[k]] = num_(r[BAG_COL[k]]) - cost[k]; }
var COST_NAME = { fruit: '水果', iron: '鐵礦', wood: '木材', stone: '石頭', dia: '鑽石' };
function costText_(cost) { return Object.keys(cost).map(function (k) { return COST_NAME[k] + '×' + cost[k]; }).join(' '); }
function islePub_(r, mine, viewer) {
  var o = isleOf_(r), now = Date.now(), wd = viewer && viewer.wd && viewer.wd.d === day_() ? viewer.wd.f : [];
  var out = {
    nick: plain_(r[C.nick]), av: plain_(r[C.av]), fid: String(r[C.fid] || ''), mine: !!mine,
    starterGuide:o.starterGuide, starterTree:!!o.starterTree, h: o.h, fields: o.fields, deco: o.deco, dl: o.dl, score: isleScore_(o), layout: o.layout, wild: o.woodSlots.map(function(t){var span=Math.max(1,num_(t.ready)-num_(t.start)), phase=now>=num_(t.ready)?2:now>=num_(t.start)+span/2?1:0;return {id:String(t.id),x:t.x,y:t.y,stage:phase,left:Math.max(0,num_(t.ready)-now),count:num_(t.day)===day_()?num_(t.count):0};}), wildNext: (function(){var next=null;o.woodSlots.forEach(function(t){var st=num_(t.start),en=num_(t.ready),half=st+(en-st)/2,n=now<half?half-now:now<en?en-now:null;if(n!=null&&(next==null||n<next))next=n;if(num_(t.day)===day_()&&num_(t.count)>=2){var reset=86400000-((now+8*3600000)%86400000);if(next==null||reset<next)next=reset;}});return next;})(),
    trees: o.trees.map(function (t) { return { st: treeStage_(t, now), ripe: treeRipe_(t, now), nx: Math.max(0, treeNext_(t, now)) }; }),
    bt: (function () { var m = {}; Object.keys(o.bb).forEach(function (k) { m[k] = num_(o.bb[k].t); }); return m; })(),
    xl: o.xl, tl: o.tl, gd: o.gd, bk: beastKinds_(o),   // v82
    mon: monList_(o).map(function (m) { return [m[0], m[1], m[2] ? 1 : 0]; }),   // v83
    fac: (function () { var m = {}; Object.keys(o.fac).forEach(function (k) { var f = o.fac[k], lv = num_(f.lv); if (!lv) return; m[k] = { lv: lv }; if (mine && FAC[k].res) { m[k].n = facStore_(o, k, now); m[k].cap = facCap_(o, k, lv); m[k].nx = facNext_(o, k, now); m[k].per = Math.round(facPer_(k, lv, o)); } }); return m; })(),
    ships: o.ship.own.map(function (id) { return { k: id, n: plain_(o.ship.names[id]) || SHIPS[id].name, d: SHIPS[id].name }; }), shipCur: o.ship.cur,
    bb: (function () { var m = {}; Object.keys(o.bb).forEach(function (k) { m[k] = Math.max(0, o.bb[k].e - now); }); return m; })(),
    hb: o.hb ? { t: num_(o.hb.t), left: Math.max(0, num_(o.hb.e) - now), total: HOUSE_MS[num_(o.hb.t)] || 0 } : null,
    f: o.f.map(function (c) { return c && VEG[c.v] ? { v: c.v, left: cropLeft_(c, now), total: VEG[c.v].hours * HOUR } : null; }),
    pets: o.pets.map(function (p) {
      return { aw: p.aw ? 1 : 0, sh: p.sh ? 1 : 0, id: p.id, k: p.k, n: p.n, full: Math.round(fullNow_(p, now)), aff: num_(p.aff), lv: petLv_(p), patted: num_(p.pd) === day_(), fa: num_(p.fd) === day_() ? num_(p.fa) : 0, home: num_(p.home) ? 1 : 0, iv: isBeast_(p.k) ? ivOf_(p) : undefined, bfn: isBeast_(p.k) && num_(p.bfd) === day_() ? num_(p.bfn) : 0, beast: isBeast_(p.k) ? ANIMALS[p.k].beast : '' };
    })
  };
  if (mine) {   // v83
    var twp = twOf_(o), tdy = day_();
    out.fish = o.fish; out.dish = o.dish; out.ck = o.ck ? { d: o.ck.d, left: Math.max(0, num_(o.ck.e) - now), total: Math.max(1, num_(o.ck.e) - num_(o.ck.s || o.ck.e - 60000)) } : null;
    out.job = o.job ? { j: num_(o.job.j), left: Math.max(0, num_(o.job.e) - now), total: Math.max(1, num_(o.job.e) - num_(o.job.s || o.job.e - 60000)) } : null;
    out.jd = o.jd && o.jd.d === tdy ? num_(o.jd.n) : 0; out.fs = o.fs && o.fs.d === tdy ? num_(o.fs.n) : 0;
    out.cx = o.cx; out.cxc = o.cxc; out.bfr = num_(btOf_(o).fr); out.bsh = btOf_(o).sh;
    out.tw = { fl: twp.fl, top: num_(twp.top), lost: num_(twp.lost) === tdy ? 1 : 0, next: twp.fl < TW_FLOORS ? twGuard_(twp.wk, twp.fl + 1) : null };
    var gG = guardsGet_(), gu = guOf_(o), myCode = String(r[C.code]).toUpperCase();   // v84 守護
    out.gu = { sand: gu.sand, sd: gu.sd, sp: gu.sp, t: gu.t, cd: gu.cd, pend: guardPend_(o, gG, myCode, now), mine: Object.keys(gG).filter(function (is) { return gG[is].code === myCode && num_(gG[is].e) > now; }).map(function (is) { return { is: is, bk: gG[is].bk, e: gG[is].e, shd: num_(gG[is].shd) > now ? gG[is].shd : 0 }; }) };
    out.skills = EL_KEYS.map(function (el) { return { el: el, pct: Math.round(skillPct_(o, el) * 100) }; }).filter(function (x) { return x.pct > 0; });
    out.twChance = {}; o.pets.forEach(function (p) { if (isBeast_(p.k) && out.tw.next) out.twChance[p.id] = { p: Math.round(twChance_(p, out.tw.next) * 100), pw: beastPow_(p) }; });
  }
  if (mine) { out.open = r[C.open] !== '否'; out.vis = o.vis.map(function (x) { return { n: x.n, a: x.a, t: x.t, f: x.f }; }); out.veg = o.veg; out.rules = { house: HOUSE, houseMs: HOUSE_MS, fieldMs: FIELD_MS, decoMs: DECO_MS, field: FIELD, deco: DECO,
    up: UPC, upPts: FT_PTS, upMult: LV_MULT, treeMax: TREE_MAX, treeCost: Array.apply(null, Array(TREE_MAX)).map(function (x, n) { return o.starterTree && n===0 ? {} : treeCost_(n); }), treeGrow: TREE_GROW, treeEvery: TREE_EVERY, treeCap: TREE_CAP, veg: VEG, animals: ANIMALS, fruitFood: FRUIT_FOOD,
    guard: { ms: GUARD_MS, drop: GUARD_DROP_MS, drops: GUARD_DROPS, pass: GUARD_PASS, n: GQ_N, day: GT_DAY, cd: GUARD_CD, readMax: GUARD_READ_MAX, sandDay: SAND_DAY, sandIsles: SAND_ISLES, sandLv: SAND_LV, split: SPLIT, boards: Object.keys(qbank_()).filter(function (k) { return (qbank_()[k] || []).length >= GQ_N; }) },
    fishDay: FISH_DAY, fishFood: FISH_FOOD, dish: DISH, jobs: JOBS, jobDay: JOB_DAY, skill: SKILL, cxRow: CX_ROW, cxCol: CX_COL, cxAll: CX_ALL, awCost: AW_COST, twFloors: TW_FLOORS, beastLvMax: BEAST_LV_MAX,
    land: LAND, landMs: LAND_MS, landShip: LAND_SHIP, templeShip: TEMPLE_SHIP, shipNames: SHIPS.map(function (x) { return x.name; }), houseCap: HOUSE_CAP, decoCap: DECO_CAP, rushDia: RUSH_DIA, retryDia: RETRY_DIA, sandDia: SAND_DIA, temple: TEMPLE, templeNeed: TEMPLE_NEED, templeMs: TEMPLE_MS, templeOpen: TEMPLE_OPEN, garden: GARDEN, facMs: FAC_MS, depotPct: DEPOT_PCT,
    fac: (function () { var m = {}; Object.keys(FAC).forEach(function (k) { var x = FAC[k], c = [null]; for (var l = 1; l <= x.max; l++) c.push(facCost_(k, l)); m[k] = { name: x.name, res: x.res || '', xl: x.xl, max: x.max, cost: c, r: x.r || null, cap: x.cap || null }; }); return m; })() }; }
  else out.watered = wd.indexOf(out.fid) >= 0;
  return out;
}
/* 小島上的動作：回傳 { err } 或 { add, gift, got, log } */
function isleAct_(a, q, r, me) {
  var o = isleOf_(r), now = Date.now(), out = {};
  if (a === 'build') {
    var kind = String(q.k || ''), cost, label, tgt = 0, bms = 0, gk = '';
    if (kind === 'house') {
      if (o.hb) return { err: 'building' };
      if (o.h >= HOUSE_CAP[o.xl]) return o.xl >= LAND_MAX ? { err: 'maxed' } : { err: 'needland', need: o.xl + 1 };   // v85
      cost = HOUSE[o.h + 1]; label = '小屋 Lv' + (o.h + 1) + '（施工 ' + Math.round(HOUSE_MS[o.h + 1] / 60000) + ' 分鐘）';
    } else if (kind === 'field') {
      if (o.bb.field) return { err: 'building' };
      if (o.fields >= FIELD.length) return { err: 'maxed' };
      cost = FIELD[o.fields]; label = '菜田 第 ' + (o.fields + 1) + ' 塊（施工 ' + Math.round(FIELD_MS[o.fields] / 60000) + ' 分鐘）';
    } else if (DECO[kind]) {
      if (o.bb[kind]) return { err: 'building' };
      if (kind === 'tree') {
        if (o.trees.length >= TREE_MAX) return { err: 'maxed' };
        tgt = 0; cost = o.starterTree && !o.trees.length ? {} : treeCost_(o.trees.length); label = '果樹 第 ' + (o.trees.length + 1) + ' 棵（施工 ' + Math.round(DECO_MS.tree / 60000) + ' 分鐘）';
      } else {
        var curLv = num_(o.dl[kind]) || (o.deco.indexOf(kind) >= 0 ? 1 : 0);
        if (curLv >= DECO_CAP[o.xl]) return o.xl >= LAND_MAX ? { err: 'maxed' } : { err: 'needland', need: o.xl + 1 };   // v85
        tgt = curLv + 1; cost = UPC[kind][tgt];
        label = DECO[kind].name + ' Lv' + tgt + '（施工 ' + Math.round(decoMs_(kind, tgt) / 60000) + ' 分鐘）';
      }
    } else if (kind === 'land') {   // v82 擴地
      if (o.bb.land) return { err: 'building' };
      if (o.xl >= LAND_MAX) return { err: 'maxed' };
      tgt = o.xl + 1; cost = LAND[tgt]; bms = LAND_MS[tgt];
      if (LAND_SHIP[tgt] && o.ship.own.indexOf(LAND_SHIP[tgt]) < 0) return { err: 'needship', need: LAND_SHIP[tgt] }; label = '擴地 Lv' + tgt + '（施工 ' + Math.round(bms / 60000) + ' 分鐘）';
    } else if (kind === 'temple') {   // v82 五行神殿升級
      if (o.bb.temple) return { err: 'building' };
      if (o.tl >= TEMPLE_MAX) return { err: 'maxed' };
      tgt = o.tl + 1;
      if (beastKinds_(o) < TEMPLE_NEED[tgt]) return { err: 'needbeast', need: TEMPLE_NEED[tgt] };
      if (TEMPLE_SHIP[tgt] && o.ship.own.indexOf(TEMPLE_SHIP[tgt]) < 0) return { err: 'needship', need: TEMPLE_SHIP[tgt] };
      cost = TEMPLE[tgt]; bms = TEMPLE_MS[tgt]; label = '五行神殿 Lv' + tgt + '（施工 ' + Math.round(bms / 60000) + ' 分鐘）';
    } else if (FAC[kind]) {   // v82 生產設施、倉庫
      if (o.bb[kind]) return { err: 'building' };
      var fl = num_((o.fac[kind] || {}).lv);
      if (fl >= FAC[kind].max) return { err: 'maxed' };
      if (o.xl < FAC[kind].xl) return { err: 'needland', need: FAC[kind].xl };
      tgt = fl + 1; cost = facCost_(kind, tgt); bms = FAC_MS[tgt]; label = FAC[kind].name + ' Lv' + tgt + '（施工 ' + Math.round(bms / 60000) + ' 分鐘）';
    } else if (/^g_/.test(kind) && GARDEN[kind.slice(2)]) {   // v82 花園裝飾：買了馬上擺好
      gk = kind.slice(2);
      if (o.gd.indexOf(gk) >= 0) return { err: 'maxed' };
      cost = GARDEN[gk].cost; label = '花園裝飾 ' + GARDEN[gk].name;
    } else return { err: 'bad' };
    if (!hasCost_(r, cost)) return { err: 'few', miss: missCost_(r, cost) }; // 一併告訴網頁還缺什麼
    payCost_(r, cost);
    if (kind === 'tree' && o.starterTree && !o.trees.length) o.starterTree=false;
    if (kind === 'house') o.hb = { t: o.h + 1, e: now + HOUSE_MS[o.h + 1] };
    else if (kind === 'field') o.bb.field = { e: now + FIELD_MS[o.fields] };
    else if (gk) o.gd.push(gk);
    else if (bms) o.bb[kind] = { e: now + bms, t: tgt };
    else o.bb[kind] = { e: now + decoMs_(kind, tgt), t: tgt };
    out.log = ['蓋', label + '（' + costText_(cost) + '）'];
  } else if (a === 'plant') {
    var fi = num_(q.i), v = String(q.v || '');
    if (!VEG[v] || fi >= o.fields) return { err: 'bad' };
    if (o.f[fi]) return { err: 'busy' };
    if (num_(r[C.fruit]) < VEG[v].seed) return { err: 'few' };
    r[C.fruit] = num_(r[C.fruit]) - VEG[v].seed;
    o.f[fi] = { v: v, t: now, b: Math.round(VEG[v].hours * HOUR * skillPct_(o, 'water')) };   // v83 水靈龍技能：種菜時間縮短
  } else if (a === 'harvest') {
    var hi = num_(q.i), c = o.f[hi];
    if (!c || !VEG[c.v]) return { err: 'bad' };
    if (cropLeft_(c, now) > 0) return { err: 'notyet' };
    o.veg[c.v] += VEG[c.v].n; out.got = { k: c.v, n: VEG[c.v].n };
    o.f[hi] = null;
    out.log = ['收成', VEG[c.v].name + '×' + VEG[c.v].n];
  } else if (a === 'pick') {
    var tot = 0, pi = q.i == null ? -1 : Number(q.i);
    if (pi !== -1 && (!isFinite(pi) || pi < 0 || pi !== Math.floor(pi) || pi >= o.trees.length)) return { err: 'bad' };
    o.trees.forEach(function (t, i) {
      if (pi !== -1 && i !== pi) return;
      var n = treeRipe_(t, now);
      if (n > 0) { tot += n; t.lp = n >= TREE_CAP ? now : treeFrom_(t) + n * TREE_EVERY; }
    });
    if (tot < 1) return { err: 'notyet' };
    r[C.fruit] = num_(r[C.fruit]) + tot; out.got = { k: 'fruit', n: tot };
    out.log = ['摘果', '果樹 🍎×' + tot];
  } else if (a === 'collect') {   // v82 收生產設施的物資
    var ck = String(q.k || ''), cf = o.fac[ck];
    if (!FAC[ck] || !FAC[ck].res || !cf || !num_(cf.lv)) return { err: 'bad' };
    var cn = facStore_(o, ck, now);
    if (cn < 1) return { err: 'notyet' };
    cf.c = cn >= facCap_(o, ck, cf.lv) ? now : num_(cf.c) + cn * facPer_(ck, cf.lv, o);
    r[BAG_COL[FAC[ck].res]] = num_(r[BAG_COL[FAC[ck].res]]) + cn;
    out.got = { k: FAC[ck].res, n: cn }; out.log = ['收成', FAC[ck].name + ' ' + COST_NAME[FAC[ck].res] + '×' + cn];
  } else if (a === 'fish') {   // v83 釣魚
    var fsl = num_((o.fac.fish || {}).lv); if (!fsl) return { err: 'bad' };
    var tdf = day_(); o.fs = o.fs && o.fs.d === tdf ? o.fs : { d: tdf, n: 0 };
    if (num_(o.fs.n) >= FISH_DAY[fsl]) return { err: 'fishmax' };
    o.fs.n = num_(o.fs.n) + 1;
    if (!num_(q.hit)) { out.got = { k: 'miss', n: 0 }; out.log = ['釣魚', '魚跑掉了']; }
    else {
      var mp = skillPct_(o, 'metal'), T = [['fish', 58], ['res', 22], ['coin', 10], ['bfruit', 4 + fsl + mp * 20], ['dia', 1 + fsl * 0.5 + mp * 10], ['sand', 1]], tot0 = 0, x0;
      T.forEach(function (t) { tot0 += t[1]; }); x0 = Math.random() * tot0;
      var pick = T[T.length - 1][0]; for (var ti = 0; ti < T.length; ti++) { if (x0 < T[ti][1]) { pick = T[ti][0]; break; } x0 -= T[ti][1]; }
      if (pick === 'fish') { var fn = Math.random() < 0.4 ? 2 : 1; o.fish += fn; out.got = { k: 'fish', n: fn }; }
      else if (pick === 'res') { var rk = ['wood', 'stone', 'iron'][Math.floor(Math.random() * 3)], rn = 3 + Math.floor(Math.random() * 3); r[BAG_COL[rk]] = num_(r[BAG_COL[rk]]) + rn; out.got = { k: rk, n: rn }; }
      else if (pick === 'coin') { var cn2 = 2 + Math.floor(Math.random() * 3); out.add = cn2; out.got = { k: 'coin', n: cn2 }; }
      else if (pick === 'bfruit') { btOf_(o).fr++; out.got = { k: 'bfruit', n: 1 }; }
      else if (pick === 'sand') { guOf_(o).sand++; out.got = { k: 'sand', n: 1 }; }
      else { r[C.dia] = num_(r[C.dia]) + 1; out.got = { k: 'dia', n: 1 }; }
      out.log = ['釣魚', out.got.k + '×' + out.got.n];
    }
  } else if (a === 'cook') {   // v83 料理
    var kl = num_((o.fac.kitchen || {}).lv), dd = DISH[String(q.d || '')];
    if (!kl || !dd) return { err: 'bad' };
    if (kl < dd.lv) return { err: 'needlv' };
    if (o.ck) return { err: 'cooking' };
    var nk = Object.keys(dd.need), lack = {};
    nk.forEach(function (k) { var h = needHave_(r, o, k); if (h < dd.need[k]) lack[k] = dd.need[k] - h; });
    if (Object.keys(lack).length) return { err: 'few', miss: lack };
    nk.forEach(function (k) { needPay_(r, o, k, dd.need[k]); });
    o.ck = { d: String(q.d), e: now + Math.round(dd.min * 60000 * (1 - skillPct_(o, 'fire'))), s: now };
    out.log = ['料理', dd.name];
  } else if (a === 'job') {   // v83 接設計案
    var sl = num_((o.fac.studio || {}).lv), jj = num_(q.j), jb = JOBS[jj];
    if (!sl || !jb) return { err: 'bad' };
    if (jj > sl) return { err: 'needlv' };
    if (o.job) return { err: 'jobbusy' };
    var tdj = day_(); o.jd = o.jd && o.jd.d === tdj ? o.jd : { d: tdj, n: 0 };
    if (num_(o.jd.n) >= JOB_DAY) return { err: 'jobmax' };
    o.jd.n = num_(o.jd.n) + 1; o.job = { j: jj, e: now + jb.min * 60000, s: now };
    out.log = ['接案', jb.name];
  } else if (a === 'jobdone') {   // v83 交稿
    if (!o.job) return { err: 'bad' };
    if (num_(o.job.e) > now) return { err: 'notyet' };
    var jd2 = JOBS[num_(o.job.j)]; out.add = jd2.coin; out.got = { k: 'coin', n: jd2.coin };
    if (jd2.dia) { r[C.dia] = num_(r[C.dia]) + jd2.dia; out.got.dia = jd2.dia; }
    o.job = null; out.log = ['交稿', jd2.name + ' 🪙' + jd2.coin + (jd2.dia ? ' 💎' + jd2.dia : '')];
  } else if (a === 'cxclaim') {   // v83 圖鑑獎勵
    var cc = String(q.c || '');
    if (o.cxc[cc]) return { err: 'claimed' };
    if (!cxDone_(o, cc)) return { err: 'cxno' };
    var rw = cc === 'all' ? CX_ALL : /^r\./.test(cc) ? CX_ROW : CX_COL;
    if (rw.dia) r[C.dia] = num_(r[C.dia]) + rw.dia;
    if (rw.bfruit) btOf_(o).fr += rw.bfruit;
    o.cxc[cc] = 1; out.got = { k: rw.dia ? 'dia' : 'bfruit', n: rw.dia || rw.bfruit }; out.log = ['圖鑑', cc];
    if (cc === 'all') { guOf_(o).sand += SAND_CX; out.got.sand = SAND_CX; }
  } else if (a === 'tower') {   // v83 五行塔
    if (o.tl < 3) return { err: 'needtemple', need: 3 };
    var tw = twOf_(o), tp = null;
    if (num_(tw.lost) === day_()) return { err: 'twlost' };
    if (tw.fl >= TW_FLOORS) return { err: 'twtop' };
    o.pets.forEach(function (p) { if (p.id === String(q.id || '') && isBeast_(p.k)) tp = p; });
    if (!tp) return { err: 'bad' };
    var g = twGuard_(tw.wk, tw.fl + 1), ch = twChance_(tp, g), win = Math.random() < ch;
    out.tw = { win: win, g: g, p: Math.round(ch * 100), pw: beastPow_(tp) };
    if (win) {
      tw.fl++; tw.top = Math.max(num_(tw.top), tw.fl);
      var tc = 2 + Math.floor(tw.fl / 5); out.add = tc; out.got = { k: 'coin', n: tc };
      if (g.boss) { btOf_(o).fr += 2; out.got.bfruit = 2; if (Math.random() < SAND_TOWER_P) { guOf_(o).sand++; out.got.sand = 1; } }
      out.log = ['五行塔', '第 ' + tw.fl + ' 層過關'];
    } else { tw.lost = day_(); out.log = ['五行塔', '第 ' + g.fl + ' 層落敗']; }
  } else if (a === 'awaken') {   // v83 覺醒
    if (o.tl < 4) return { err: 'needtemple', need: 4 };
    var ap = null; o.pets.forEach(function (p) { if (p.id === String(q.id || '') && isBeast_(p.k)) ap = p; });
    if (!ap) return { err: 'bad' };
    if (ap.aw) return { err: 'maxed' };
    if (petLv_(ap) < BEAST_LV_MAX) return { err: 'awlv' };
    var ab = btOf_(o);
    if (ab.fr < AW_COST.bfruit) return { err: 'nobfruit' };
    if (!BT_PARTS.every(function (pp) { return num_(ab.sh[ap.k + '.' + pp]) >= AW_COST.shard; })) return { err: 'noshard' };
    if (num_(r[C.dia]) < AW_COST.dia) return { err: 'few', miss: { dia: AW_COST.dia - num_(r[C.dia]) } };
    ab.fr -= AW_COST.bfruit; BT_PARTS.forEach(function (pp) { ab.sh[ap.k + '.' + pp] -= AW_COST.shard; if (!ab.sh[ap.k + '.' + pp]) delete ab.sh[ap.k + '.' + pp]; });
    r[C.dia] = num_(r[C.dia]) - AW_COST.dia; ap.aw = 1; o.cx[ap.k + '.aw'] = 1;
    out.log = ['覺醒', ANIMALS[ap.k].name];
  } else if (a === 'rush') {   // v85 用 💎 1 立刻完成施工
    var rk2 = String(q.k || '');
    if (rk2 === 'house') { if (!o.hb || num_(o.hb.e) <= now) return { err: 'bad' }; }
    else if (!o.bb[rk2] || num_(o.bb[rk2].e) <= now) return { err: 'bad' };
    if (num_(r[C.dia]) < RUSH_DIA) return { err: 'few', miss: { dia: RUSH_DIA - num_(r[C.dia]) } };
    r[C.dia] = num_(r[C.dia]) - RUSH_DIA;
    if (rk2 === 'house') o.hb.e = now; else o.bb[rk2].e = now;
    out.log = ['加速', rk2 + ' 💎' + RUSH_DIA];
  } else if (a === 'diaretry') {   // v85 用 💎 2 再挑戰一次（五行塔輸了、守護試煉次數用完）
    var dk2 = String(q.k || '');
    if (num_(r[C.dia]) < RETRY_DIA) return { err: 'few', miss: { dia: RETRY_DIA - num_(r[C.dia]) } };
    if (dk2 === 'tower') { var dtw = twOf_(o); if (num_(dtw.lost) !== day_()) return { err: 'bad' }; dtw.lost = 0; }
    else if (dk2 === 'guard') { var dgu = guOf_(o), dis = String(q.isle || ''); if (num_(dgu.t[dis]) < GT_DAY) return { err: 'bad' }; dgu.t[dis] = num_(dgu.t[dis]) - 1; }
    else return { err: 'bad' };
    r[C.dia] = num_(r[C.dia]) - RETRY_DIA; out.log = ['再挑戰', dk2 + ' 💎' + RETRY_DIA];
  } else if (a === 'buysand') {   // v85 用 💎 3 換 1 把五行結界砂
    if (num_(r[C.dia]) < SAND_DIA) return { err: 'few', miss: { dia: SAND_DIA - num_(r[C.dia]) } };
    r[C.dia] = num_(r[C.dia]) - SAND_DIA; guOf_(o).sand++; out.got = { k: 'sand', n: 1 }; out.log = ['換結界砂', '💎' + SAND_DIA];
  } else if (a === 'moveitem') {
    var mk = String(q.k || ''), x = Number(q.x), y = Number(q.y), valid = mk === 'house' && (o.h > 0 || o.hb);
    var fm = /^field(\d+)$/.exec(mk), tm = /^tree(\d+)$/.exec(mk);
    if (fm) valid = Number(fm[1]) < o.fields;
    if (tm) valid = Number(tm[1]) < o.trees.length;
    if (mk === 'fountain' || mk === 'tower') valid = o.deco.indexOf(mk) >= 0;
    if (!valid || !isFinite(x) || !isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) return { err: 'bad' };
    o.layout[mk] = [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
  } else if (a === 'chopwood') {
    var wid = String(q.id || ''), wi = o.woodSlots.findIndex(function (t) { return String(t.id) === wid; });
    if (wi < 0) return { err: 'bad' };
    var tree = o.woodSlots[wi], todayW=day_();
    if (num_(tree.day)!==todayW) { tree.day=todayW; tree.count=0; }
    if (num_(tree.count)>=2) return { err: 'tired' };
    if (now<num_(tree.ready)) return { err: 'notyet' };
    tree.count=num_(tree.count)+1; tree.start=now;
    tree.ready=now+woodGrow_(String(r[C.fid] || r[C.code] || ''),wi,now);
    r[C.wood] = num_(r[C.wood]) + 3; r[C.tres] = num_(r[C.tres]) + 3;
    out.got = { k: 'wood', n: 3 }; out.log = ['砍樹', '木材×3'];
  } else if (a === 'adopt') {
    var an = ANIMALS[String(q.k || '')], name = cleanNick_(q.name).slice(0, 8);
    if (!an || an.beast) return { err: 'bad' };
    if (o.pets.some(function(p) { return p.k === String(q.k); })) return { err: 'petowned' };
    if (o.h < 1) return { err: 'nohouse' };
    if (petCount_(o) >= Math.min(o.h, 8)) return { err: 'petmax' };
    if (name.length < 1) name = an.name;
    if (!me.admin) {
      if (num_(r[C.bal]) < an.cost) return { err: 'nocoin' };
      r[C.bal] = num_(r[C.bal]) - an.cost;
    }
    o.pets.push({ id: 'P' + now.toString(36).toUpperCase() + Math.floor(Math.random() * 1296).toString(36).toUpperCase(), k: String(q.k), n: text_(name, 8), full: 80, ft: now, aff: 0, pd: 0 });
    out.log = ['領養', an.name + '「' + name + '」' + (me.admin ? '（管理員免費）' : '（' + an.cost + ' 金幣）')];
  } else if (a === 'pethome') {   // 寵物帶回家（小島上不出現）或放出來
    var hp = null;
    o.pets.forEach(function (p) { if (p.id === String(q.id || '')) hp = p; });
    if (!hp) return { err: 'bad' };
    hp.home = num_(q.home) ? 1 : 0;
  } else if (a === 'feed' || a === 'pat') {
    var pet = null;
    o.pets.forEach(function (p) { if (p.id === String(q.id || '')) pet = p; });
    if (!pet) return { err: 'bad' };
    var full = fullNow_(pet, now);
    if (a === 'feed') {
      var food = String(q.food || ''), plus;
      if (full >= 100) return { err: 'petfull' };
      if (food === 'fruit') { if (num_(r[C.fruit]) < 1) return { err: 'few' }; r[C.fruit] = num_(r[C.fruit]) - 1; plus = FRUIT_FOOD; }
      else if (VEG[food]) { if (o.veg[food] < 1) return { err: 'few' }; o.veg[food]--; plus = VEG[food].food; }
      else if (food === 'fish') { if (num_(o.fish) < 1) return { err: 'few' }; o.fish--; plus = FISH_FOOD; }   // v83
      else if (/^d_/.test(food) && DISH[food.slice(2)]) {
        var dk = food.slice(2); if (DISH[dk].beast && !isBeast_(pet.k)) return { err: 'beastonly' };
        if (num_(o.dish[dk]) < 1) return { err: 'few' }; o.dish[dk]--; plus = DISH[dk].food; if (DISH[dk].aff) { pet.aff = num_(pet.aff) + DISH[dk].aff; out.dishAff = DISH[dk].aff; }
      }
      else return { err: 'bad' };
      pet.full = Math.min(100, full + plus); pet.ft = now;
      if (num_(pet.fd) !== day_()) { pet.fd = day_(); pet.fa = 0; }
      if (num_(pet.fa) < FEED_AFF_DAY) { pet.fa = num_(pet.fa) + 1; pet.aff = num_(pet.aff) + 1; out.aff = 1; }
    } else {
      if (num_(pet.pd) === day_()) return { err: 'patted' };
      pet.pd = day_(); pet.aff = num_(pet.aff) + 1;
      if (full >= 50) {
        if (Math.random() < 0.1) { out.add = 1; out.gift = { k: 'coin', n: 1 }; }
        else { var gk = RES_KEYS[Math.floor(Math.random() * RES_KEYS.length)]; r[RES[gk].col] = num_(r[RES[gk].col]) + 1; out.gift = { k: gk, n: 1 }; }
      }
    }
  }
  r[C.isle] = JSON.stringify(o);
  return out;
}

/* ---------- 好友 ---------- */
function friendsOf_(rows, r) {
  var gifted = list_(r[C.gifts]);
  return list_(r[C.friends]).map(function (f) {
    var j = findFid_(rows, f);
    if (j < 0) return null;
    var x = rows[j];
    return { fid: f, nick: plain_(x[C.nick]), av: plain_(x[C.av]), bal: num_(x[C.bal]), bag: bag_(x), dia: num_(x[C.dia]),
      tres: num_(x[C.tres]), seen: x[C.seen] ? Utilities.formatDate(new Date(x[C.seen]), TZ, 'M/d') : '',
      gifted: gifted.indexOf(f) >= 0 };
  }).filter(Boolean);
}
function inbox_(rows, fid) {
  var sh = sheet_('悄悄話', N_HEAD), n = sh.getLastRow() - 1, out = [];
  if (n < 1) return out;
  var from = Math.max(0, n - 1500), vals = sh.getRange(2 + from, 1, n - from, N_HEAD.length).getValues();
  for (var x = vals.length - 1; x >= 0 && out.length < 30; x--) {
    var v = vals[x], mine = String(v[1]) === fid;   // v80 自己傳出的也列出來（mine:1），看得到自己回了什麼
    if (String(v[3]) !== fid && !mine) continue;
    if (v[8] === '收回' || (!mine && v[9])) continue;   // v81 收回的雙方都不列；收件人刪掉的只在收件人這邊不列
    var ofid = String(mine ? v[3] : v[1]), j = findFid_(rows, ofid), o = { t: fmt_(v[0]), fid: ofid, nick: j >= 0 ? plain_(rows[j][C.nick]) : plain_(mine ? v[4] : v[2]), av: j >= 0 ? plain_(rows[j][C.av]) : '', text: plain_(v[5]) };
    if (mine) o.mine = 1;
    o.id = String(v[1]) + '_' + new Date(v[0]).getTime();
    var il = idList_(v[6]); if (il.length) o.imgs = il;
    if (v[7]) o.ed = fmt_(v[7]);
    if (sysNote_(v[5])) o.sys = 1;
    out.push(o);
  }
  return out;
}

/* ---------- 留言碼頭 ---------- */
/* 用既有帳號收件匣保存通知，與悄悄話共用未讀數；自己回覆不通知。 */
function notifyMsgReply_(rows, actor, parent, content, touched) {
  var recipient = find_(rows, parent[3]);
  if (recipient < 0 || String(rows[recipient][C.code]).toUpperCase() === String(actor[C.code]).toUpperCase()) return;
  var fid = String(rows[recipient][C.fid] || '');
  if (!fid) { fid = newFid_(rows); rows[recipient][C.fid] = fid; }
  rows[recipient][C.unread] = num_(rows[recipient][C.unread]) + 1; touched[recipient] = 1;
  sheet_('悄悄話', N_HEAD).appendRow([new Date(), actor[C.fid], actor[C.nick], fid, rows[recipient][C.nick], '📮 回覆了你的留言：' + plain_(content)]);
}
function msgRow_(sh, id) {
  id = String(id || '');
  var n = sh.getLastRow() - 1;
  if (n < 1 || !id) return 0;
  var ids = sh.getRange(2, 1, n, 1).getValues();
  for (var x = ids.length - 1; x >= 0; x--) if (String(ids[x][0]) === id) return x + 2;
  return 0;
}
/* 留言：每一頁（站長版／一般版）快取 60 秒；有人留言、回覆、隱藏、刪除時換版本號，快取就自動作廢 */
var MSG_TTL = 60, MSG_CACHE_PAGES = 10;
function adminCodes_() {
  var hit = cget_('adm');
  if (hit) return hit;
  var out = [];
  rows_(players_()).forEach(function (r) { if (r[C.admin] === '是') out.push(String(r[C.code]).toUpperCase()); });
  cput_('adm', out, 600);
  return out;
}
/* v59 留言圖片：base64 切片存在「留言圖片」工作表（每片前面加 i，避免被當成公式）；讀圖走只讀的 a:'mimg' */
function msgImgSave_(mid, b64) {
  var sh = sheet_('留言圖片', MI_HEAD), out = [];
  for (var k = 0, n = 0; k < b64.length; k += MSG_IMG_CHUNK, n++) out.push([mid, n, 'i' + b64.slice(k, k + MSG_IMG_CHUNK)]);
  sh.getRange(sh.getLastRow() + 1, 1, out.length, 3).setValues(out);
}
/* v81 多張圖片、編輯、刪除 */
var IMG_MAX_N = 4;
var EL_HEAD = ['時間', '種類', '編號', '暱稱', '登島碼', '改前內容', '改前圖片', '改後內容', '改後圖片'];   // 「編輯紀錄」只有站長看得到
function imgsIn_(q, max) {   // q.imgs（陣列）或舊的 q.img；格式不對或超過張數回 null
  var a = Array.isArray(q.imgs) ? q.imgs : (q.img ? [q.img] : []);
  a = a.map(function (x) { return String(x || ''); }).filter(Boolean);
  if (a.length > max) return null;
  for (var i = 0; i < a.length; i++) if (a[i].length > MSG_IMG_MAX || !/^[A-Za-z0-9+\/]+=*$/.test(a[i])) return null;
  return a;
}
function imgsSave_(pre, arr) {
  var t = Date.now().toString(36).toUpperCase();
  return arr.map(function (b, i) { var id = pre + t + String.fromCharCode(65 + i) + Math.floor(Math.random() * 46656).toString(36).toUpperCase(); msgImgSave_(id, b); return id; });
}
function idList_(s) { return String(s || '').split(',').filter(function (x) { return /^[MW][0-9A-Z]{4,20}$/.test(x); }); }
function keepList_(keep, cur) { var k = idList_(Array.isArray(keep) ? keep.join(',') : keep); return k.filter(function (x, i) { return cur.indexOf(x) >= 0 && k.indexOf(x) === i; }); }
function editLog_(kind, id, r, oldText, oldImgs, newText, newImgs) {
  sheet_('編輯紀錄', EL_HEAD).appendRow([new Date(), kind, String(id), r[C.nick], r[C.code], oldText, (oldImgs || []).join(','), newText, (newImgs || []).join(',')]);
}
function mainImgs_(mv, sh) {   // 主留言的圖片：v81 起記在「圖片」欄；舊留言的圖用留言編號存
  var l = idList_(mv[10]);
  if (!l.length && msgImgRows_(sh || sheet_('留言圖片', MI_HEAD), String(mv[0])).length) l = [String(mv[0])];
  return l;
}
/* 找留言或回覆：id 是 M…（主留言）或 M…_毫秒（回覆）；已刪除的找不到 */
function msgFind_(id) {
  id = String(id || '');
  if (!/^M[0-9A-Z]{4,20}(_\d{9,15})?$/.test(id)) return null;
  var parts = id.split('_'), ms = sheet_('留言板', M_HEAD), mr = msgRow_(ms, parts[0]);
  if (!mr) return null;
  var mv = ms.getRange(mr, 1, 1, M_HEAD.length).getValues()[0];
  if (mv[9] === '刪除') return null;
  if (parts.length === 1) return { kind: 'm', sh: ms, row: mr, v: mv, w: String(mv[3]).toUpperCase(), text: plain_(mv[5]), imgs: mainImgs_(mv), parent: mv };
  var rs = sheet_('留言回覆', MR_HEAD), rn = rs.getLastRow() - 1;
  if (rn < 1) return null;
  var vals = rs.getRange(2, 1, rn, MR_HEAD.length).getValues();
  for (var x = 0; x < vals.length; x++) {
    var v = vals[x];
    if (String(v[0]) === parts[0] && String(new Date(v[1]).getTime()) === parts[1] && v[8] !== '刪除') return { kind: 'r', sh: rs, row: x + 2, v: v, w: String(v[3]).toUpperCase(), text: plain_(v[5]), imgs: idList_(v[6]), parent: mv };
  }
  return null;
}
/* 悄悄話編號：寄件海島編號_毫秒 */
function noteRow_(id) {
  var m = String(id || '').match(/^([0-9A-Z]{4,8})_(\d{9,15})$/);
  if (!m) return null;
  var sh = sheet_('悄悄話', N_HEAD), n = sh.getLastRow() - 1;
  if (n < 1) return null;
  var from = Math.max(0, n - 3000), vals = sh.getRange(2 + from, 1, n - from, N_HEAD.length).getValues();
  for (var x = vals.length - 1; x >= 0; x--) { var v = vals[x]; if (String(v[1]) === m[1] && String(new Date(v[0]).getTime()) === m[2]) return { sh: sh, row: 2 + from + x, v: v }; }
  return null;
}
function sysNote_(t) { return /^(🎁 送你|📮 回覆了你的留言：|🐲 想送你一隻神獸|🙏 收下了你送的神獸|↩️ 你送的神獸|↩️ 婉拒了你送的神獸)/.test(String(t || '')); }   // 系統代發的通知：不能編輯、不能收回
function msgImgRows_(sh, mid) {
  var n = sh.getLastRow() - 1, rows = [];
  if (n > 0) sh.getRange(2, 1, n, 2).getValues().forEach(function (v, x) { if (String(v[0]) === mid) rows.push({ row: x + 2, part: num_(v[1]) }); });
  return rows;
}
function msgImgMap_() {
  var sh = sheet_('留言圖片', MI_HEAD), n = sh.getLastRow() - 1, m = {};
  if (n > 0) sh.getRange(2, 1, n, 1).getValues().forEach(function (v) { if (v[0]) m[String(v[0])] = 1; });
  return m;
}
function msgImg_(q) {
  var mid = String(q.id || '');
  if (!/^M[0-9A-Z]{4,20}$/.test(mid)) return { ok: false, err: 'bad' };
  return imgB64_(mid);
}
function noteImg_(q) {
  var mid = String(q.id || '');
  if (!/^W[0-9A-Z]{4,20}$/.test(mid)) return { ok: false, err: 'bad' };
  var pr = rows_(players_()), pi = find_(pr, q.code);
  if (pi < 0) return { ok: false, err: 'nocode' };
  var fid = String(pr[pi][C.fid] || ''), sh = sheet_('悄悄話', N_HEAD), n = sh.getLastRow() - 1, ok = false;
  if (n > 0 && fid) {
    var from = Math.max(0, n - 3000), vals = sh.getRange(2 + from, 1, n - from, N_HEAD.length).getValues();
    for (var x = vals.length - 1; x >= 0; x--) if (idList_(vals[x][6]).indexOf(mid) >= 0) { ok = vals[x][8] !== '收回' && (String(vals[x][1]) === fid || String(vals[x][3]) === fid); break; }
  }
  if (!ok) return { ok: false, err: 'noimg' };
  return imgB64_(mid);
}
function imgB64_(mid) {
  var sh = sheet_('留言圖片', MI_HEAD), rows = msgImgRows_(sh, mid);
  if (!rows.length) return { ok: false, err: 'noimg' };
  rows.sort(function (a, b) { return a.part - b.part; });
  var first = rows[0].row, last = rows[rows.length - 1].row, vals = sh.getRange(first, 1, last - first + 1, 3).getValues(), b64 = '';
  rows.forEach(function (r) { b64 += String(vals[r.row - first][2]).slice(1); });
  return { ok: true, id: mid, b64: b64 };
}
function msgImgTrash_(mid) {
  var sh = sheet_('留言圖片', MI_HEAD);
  msgImgRows_(sh, mid).forEach(function (r) { sh.getRange(r.row, 1, 1, 3).setValues([['', '', '']]); });
}
function msgsBuild_(admin, prefix) {
  var rows = rows_(players_()), avOf = {};
  rows.forEach(function (r) { avOf[String(r[C.code]).toUpperCase()] = plain_(r[C.av]); });
  var sh = sheet_('留言板', M_HEAD), n = sh.getLastRow() - 1, list = [], pending = 0;
  if (n > 0) {
    var vals = sh.getRange(2, 1, n, M_HEAD.length).getValues();
    for (var x = vals.length - 1; x >= 0; x--) {
      var v = vals[x], st = String(v[9]);
      if (!v[0] || st === '刪除' || (st === '隱藏' && !admin)) continue;
      if (!v[6] && st !== '隱藏' && String(v[3]) !== 'SYSTEM') pending++;   // 官方自動喜報不算待回覆
      var who = String(v[3]).toUpperCase();
      list.push({ id: String(v[0]), t: fmt_(v[1]), nick: plain_(v[2]), av: avOf[who] || plain_(v[4]), text: plain_(v[5]),
        reply: plain_(v[6]), rt: fmt_(v[7]), re: fmt_(v[8]), hidden: st === '隱藏', w: who, imgs: idList_(v[10]), ed: String(v[3]) === 'SYSTEM' ? '' : fmt_(v[11]) });   // v86 官方公告（SYSTEM）不顯示「已編輯」
    }
  }
  var replySheet = sheet_('留言回覆', MR_HEAD), replyCount = replySheet.getLastRow() - 1, byParent = {};
  if (replyCount > 0) replySheet.getRange(2, 1, replyCount, MR_HEAD.length).getValues().forEach(function (v) {
    var id = String(v[0] || ''), who = String(v[3] || '').toUpperCase(); if (!id || v[8] === '刪除') return;
    (byParent[id] || (byParent[id] = [])).push({ id: id + '_' + new Date(v[1]).getTime(), t: fmt_(v[1]), nick: plain_(v[2]), av: avOf[who] || plain_(v[4]), text: plain_(v[5]), imgs: idList_(v[6]), ed: fmt_(v[7]), w: who });
  });
  var likes = likesMap_();
  var imgs = msgImgMap_();
  list.forEach(function (m) { m.replies = byParent[m.id] || []; if (!m.imgs.length && imgs[m.id]) m.imgs = [m.id]; m.lk = likes[m.id] || []; m.replies.forEach(function (rp) { rp.lk = likes[rp.id] || []; }); });
  var total = list.length, pages = Math.max(1, Math.ceil(total / MSG_PAGE)), all = {}, first = {};
  for (var p = 1; p <= Math.min(pages, MSG_CACHE_PAGES); p++) {
    first = { total: total, pending: admin ? pending : 0, pages: pages, list: list.slice((p - 1) * MSG_PAGE, p * MSG_PAGE) };
    all[prefix + p] = JSON.stringify(first);
  }
  try { CacheService.getScriptCache().putAll(all, MSG_TTL); } catch (e) {}
  return { total: total, pending: admin ? pending : 0, pages: pages, list: list };
}
function msgs_(q) {
  var code = String(q.code || '').toUpperCase();
  var admin = !!code && adminCodes_().indexOf(code) >= 0;
  var page = Math.max(1, num_(q.page) || 1);
  var prefix = 'msgs:' + ver_('msgs') + ':' + (admin ? 'a' : 'p') + ':';
  var pg = page <= MSG_CACHE_PAGES ? cget_(prefix + page) : null;
  if (!pg) {
    var all = msgsBuild_(admin, prefix);
    pg = { total: all.total, pending: all.pending, pages: all.pages, list: all.list.slice((page - 1) * MSG_PAGE, page * MSG_PAGE) };
  }
  return { ok: true, total: pg.total, pending: pg.pending, admin: admin, page: page, pages: pg.pages,
    list: pg.list.map(function (m) {
      return { id: m.id, t: m.t, nick: m.nick, av: m.av, text: m.text, reply: m.reply, rt: m.rt, re: m.re, hidden: m.hidden, mine: !!code && m.w === code, imgs: m.imgs && m.imgs.length ? m.imgs : undefined, ed: m.ed || undefined, lk: likePub_(m.lk, code),
        replies: (m.replies || []).map(function (rp) { return { id: rp.id, t: rp.t, nick: rp.nick, av: rp.av, text: rp.text, imgs: rp.imgs && rp.imgs.length ? rp.imgs : undefined, ed: rp.ed || undefined, mine: !!code && rp.w === code, lk: likePub_(rp.lk, code) }; }) };
    }) };
}

/* v76 按讚：整張「按讚」讀成 {目標: [{c 登島碼, n 暱稱}]}（只在後台與快取裡，不對外）；對外只給讚數、暱稱、自己有沒有按 */
function likesMap_() {
  var sh = sheet_('按讚', LK_HEAD), n = sh.getLastRow() - 1, m = {};
  if (n > 0) sh.getRange(2, 1, n, 3).getValues().forEach(function (v) { if (!v[0]) return; (m[String(v[0])] || (m[String(v[0])] = [])).push({ c: String(v[1]).toUpperCase(), n: plain_(v[2]) }); });
  return m;
}
function likePub_(lk, code) {
  lk = lk || []; if (!lk.length) return undefined;
  return { n: lk.length, who: lk.map(function (x) { return x.n; }), me: !!code && lk.some(function (x) { return x.c === code; }) };
}
/* 找按讚的目標：留言（沒被刪、沒被隱藏）或某則回覆；回傳 {id, w 作者登島碼} */
function likeTarget_(id) {
  if (!/^M[0-9A-Z]{4,20}(_\d{9,15})?$/.test(id)) return null;
  var parts = id.split('_'), ms = sheet_('留言板', M_HEAD), mr = msgRow_(ms, parts[0]);
  if (!mr) return null;
  var mv = ms.getRange(mr, 1, 1, M_HEAD.length).getValues()[0];
  if (mv[9] === '隱藏' || mv[9] === '刪除') return null;
  if (parts.length === 1) return { id: id, w: String(mv[3]).toUpperCase() };
  var rs = sheet_('留言回覆', MR_HEAD), rn = rs.getLastRow() - 1, found = null;
  if (rn > 0) rs.getRange(2, 1, rn, 4).getValues().forEach(function (v) { if (!found && String(v[0]) === parts[0] && String(new Date(v[1]).getTime()) === parts[1]) found = { id: id, w: String(v[3]).toUpperCase() }; });
  return found;
}

/* ---------- 站長帳號：在 Apps Script 編輯器執行一次 ---------- */
function setupOwner() {
  var sh = players_();
  var rows = rows_(sh);
  OWNER.forEach(function (o) {
    var i = -1;
    for (var k = 0; k < rows.length; k++) if (nickKey_(rows[k][C.nick]) === nickKey_(o.nick)) i = k;
    if (i < 0) {
      var row = newRow_(newCode_(rows), o.nick, o.admin, 0, newFid_(rows));
      row[C.ann] = '是';
      sh.appendRow(row);
      rows.push(row);
      Logger.log(o.nick + ' 的登島碼：' + row[C.code] + (o.admin ? '（管理員：不上排行榜、下載不扣金幣）' : ''));
    } else {
      if (rows[i][C.ann] !== '是') sh.getRange(i + 2, C.ann + 1).setValue('是'); // 兩個站長帳號都能發公告
      Logger.log(o.nick + ' 已經存在，登島碼：' + rows[i][C.code] + '（已有發公告權限）');
    }
  });
}
