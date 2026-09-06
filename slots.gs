/**
 * ET (Eorzea / Game Time) 預約時段產生器
 * ───────────────────────────────────────────────
 * 換算邏輯：
 *   1970-01-01 00:00:00 UTC = ET 00:00:00
 *   1 現實秒 = 20.5714285714 遊戲秒    (即 1 ET 日 = 70 分鐘現實時間)
 *
 * 對 ET 第 N 天 09:00：
 *   game_seconds = N * 86400 + 9 * 3600
 *   real_seconds = game_seconds / 20.5714285714
 *
 * 一個時段最多可預約兩組人，欄位以雙列合併表頭表示。
 */

const TIMEZONE        = 'Asia/Taipei';
const RATE            = 20.5714285714;
const ET_HOUR         = 9;
const SECONDS_PER_DAY = 86400;

/* ── 表頭結構（雙列合併） ───────────────────────
 *  A  B  C  D    E  F  G  H        I  J  K  L
 *  ┌──┬──┬──┬──┬─────────────────┬─────────────────┐
 *  │日│時│天│狀│     預約人 A     │     預約人 B     │
 *  │期│間│數│態├──┬───┬─────┬───┼──┬───┬─────┬───┤
 *  │  │  │  │  │ID│伺服│Gmail│桌│ID│伺服│Gmail│桌│
 *  └──┴──┴──┴──┴──┴───┴─────┴───┴──┴───┴─────┴───┘
 */
const HEADER_ROW_1 = [
  '現實日期', '現實時間 (UTC+8)', '遊戲天數', '狀態',
  '預約人 A', '', '', '',
  '預約人 B', '', '', ''
];
const HEADER_ROW_2 = [
  '', '', '', '',
  '遊戲ID', '伺服器', 'Gmail', '座位',
  '遊戲ID', '伺服器', 'Gmail', '座位'
];
const NUM_COLS = HEADER_ROW_1.length;          // 12
const DATA_START_ROW = 3;                       // 資料從第 3 列開始
const STATUS_COL = 4;                           // D 欄
const A_START_COL = 5;                          // E 欄起 4 格
const B_START_COL = 9;                          // I 欄起 4 格
const BOOKING_COLS_PER_PERSON = 4;

/* ── 樣式色票（與咖啡廳網站同調性） ───────────── */
const C = {
  headerBg:    '#3B2418',
  subHeaderBg: '#5A3A27',
  headerText:  '#FBF3E5',
  bandOdd:     '#FBF3E5',
  bandEven:    '#FFFFFF',
  trueRow:     '#F4D9A4',
  border:      '#E0D2B6'
};

/* ── 郵件設定 ──────────────────────────────────── */
const CAFE_NAME   = '畝湯咖啡 Mu Tier Café';
const OWNER_EMAIL = 'mutiercafe@gmail.com';   // ⚠ 替換成實際店主信箱

/* ── 濫用防護 ──────────────────────────────────── */
const SUBMIT_COOLDOWN_SECONDS = 60; // 同一個「遊戲ID + 伺服器」在這段時間內只能送出一次
const CUSTOMER_LOGO_BASE64 = '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'; // logo_mark.png 縮小成 120x120 後轉的 base64，只用在客人版確認信

/* ──────────────────────────────────────────────── *
 *  開啟試算表自動建立選單
 * ──────────────────────────────────────────────── */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('預約管理')
    .addItem('產生下個月時段', 'generateNextMonthSlots')
    .addSeparator()
    .addItem('🔧 [Debug] 產生本月時段', 'generateCurrentMonthSlots')
    .addItem('✉️ [Debug] 寄送測試郵件', 'debugSendTestEmail')
    .addToUi();
}

/* ──────────────────────────────────────────────── *
 *  Debug：把店主版 + 客人版的範例郵件
 *  全部寄到「指定信箱」讓你預覽排版
 * ──────────────────────────────────────────────── */
function debugSendTestEmail() {
  // SpreadsheetApp.getUi() 只有在「透過試算表的選單點擊執行」時才拿得到；
  // 直接在 Apps Script 編輯器按 ▶ Run 執行這個函式時，沒有綁定的 UI context，
  // getUi() 會直接丟出 Exception。這裡包一層 try/catch，
  // 兩種執行方式都能用：有 UI 就跳對話框，沒有就退回 log + 自動用目前帳號信箱。
  let ui = null;
  try { ui = SpreadsheetApp.getUi(); } catch (e) { ui = null; }

  const report = (msg) => { if (ui) ui.alert(msg); else Logger.log(msg); };

  // 1) 詢問要寄給哪個信箱（預設帶當前 GAS 帳號）
  const me = Session.getActiveUser().getEmail();
  let testTo = me;

  if (ui) {
    const promptText =
      `將寄送 2 封測試信（店主版 + 客人版）至以下信箱，請確認或修改：` +
      (me ? '' : '\n\n（無法自動偵測，請手動輸入）');
    const resp = ui.prompt('寄送測試郵件', promptText, ui.ButtonSet.OK_CANCEL);
    if (resp.getSelectedButton() !== ui.Button.OK) return;
    testTo = resp.getResponseText().trim() || me || '';
  } else {
    Logger.log('（在編輯器直接執行，沒有試算表 UI 可跳出輸入框，改用目前帳號信箱）目標信箱：' + me);
  }

  if (!testTo) {
    report('沒有指定信箱，已取消。');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
    report(`「${testTo}」不是有效的 email 格式。`);
    return;
  }

  // 2) 用模擬資料寄送
  const mockInfo = {
    sheetName: '2026/06 (TEST)',
    slotLabel: 'A',
    slotDate:  '2026-06-15',
    slotTime:  '21:10:00',
    gameDayID: 99999,
    name:   'Tataru Taru（測試資料）',
    server: '鳳凰',
    email:  testTo,           // 客人版會寄到 testTo
    seat:   '樓上'
  };

  try {
    sendBookingEmails(mockInfo, { ownerEmail: testTo });
    report(
      `✿ 已寄出測試信\n\n` +
      `收件人：${testTo}\n` +
      `共 2 封：\n` +
      `  • 店主版（主旨開頭「[預約通知]」）\n` +
      `  • 客人版（主旨「🌸 你的預約已收到」）\n\n` +
      `請至信箱確認排版。`
    );
  } catch (err) {
    report('寄送失敗：' + err.message);
  }
}

/* ──────────────────────────────────────────────── *
 *  公開：產生「下一個月份」所有 ET 09:00 時段
 * ──────────────────────────────────────────────── */
function generateNextMonthSlots() {
  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const [curY, curM] = todayStr.split('-').map(Number);
  let y = curY, m = curM + 1;
  if (m > 12) { m = 1; y++; }
  generateMonthSlots_(y, m);
}

/* ──────────────────────────────────────────────── *
 *  公開（Debug）：產生「本月」所有 ET 09:00 時段
 *  方便在還沒到下個月就要測試前端的場合
 * ──────────────────────────────────────────────── */
function generateCurrentMonthSlots() {
  const todayStr = Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd');
  const [curY, curM] = todayStr.split('-').map(Number);
  generateMonthSlots_(curY, curM);
}

/* ──────────────────────────────────────────────── *
 *  核心：給定年月 (1-12)，產生對應月份的時段表
 * ──────────────────────────────────────────────── */
function generateMonthSlots_(year, month) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  let endY = year, endM = month + 1;
  if (endM > 12) { endM = 1; endY++; }

  const pad = n => String(n).padStart(2, '0');
  const sheetName = `${year}/${pad(month)}`;

  // 已存在 → 不動作
  if (ss.getSheetByName(sheetName)) {
    SpreadsheetApp.getActive().toast(
      `工作表「${sheetName}」已存在，本次未變更任何資料。`,
      '略過', 6
    );
    return;
  }

  // 計算現實時間範圍 [start, end)
  const startReal = new Date(`${year}-${pad(month)}-01T00:00:00+08:00`);
  const endReal   = new Date(`${endY}-${pad(endM)}-01T00:00:00+08:00`);
  const startSec  = startReal.getTime() / 1000;
  const endSec    = endReal.getTime()   / 1000;

  const firstN = Math.ceil(
    (startSec * RATE - ET_HOUR * 3600) / SECONDS_PER_DAY
  );

  // 產生資料列
  const rows = [];
  for (let N = firstN; ; N++) {
    const gameSec = N * SECONDS_PER_DAY + ET_HOUR * 3600;
    const realSec = gameSec / RATE;
    if (realSec >= endSec) break;

    const realDate = new Date(realSec * 1000);
    const dateStr  = Utilities.formatDate(realDate, TIMEZONE, 'yyyy-MM-dd');
    const timeStr  = Utilities.formatDate(realDate, TIMEZONE, 'HH:mm:ss');
    const dow      = parseInt(Utilities.formatDate(realDate, TIMEZONE, 'u'), 10);
    const hhmm     = parseInt(Utilities.formatDate(realDate, TIMEZONE, 'HHmm'), 10);

    const isWeekend = (dow === 5 || dow === 6 || dow === 7);
    const inWindow  = (hhmm >= 2100 && hhmm < 2300);
    const status    = isWeekend && inWindow;

    rows.push([
      dateStr, timeStr, N, status,
      '', '', '', '',     // 預約人 A
      '', '', '', ''      // 預約人 B
    ]);
  }

  const sheet = ss.insertSheet(sheetName);
  applySheetStyles_(sheet, rows);

  ss.setActiveSheet(sheet);
  ss.moveActiveSheet(1);

  SpreadsheetApp.getActive().toast(
    `已建立 ${sheetName}，共 ${rows.length} 筆時段。`,
    '完成', 6
  );
}

/* ──────────────────────────────────────────────── *
 *  寫入資料 + 套用樣式
 * ──────────────────────────────────────────────── */
function applySheetStyles_(sheet, rows) {
  const numRows = rows.length;

  /* ── 雙列表頭 ───────────────────────────────── */
  sheet.getRange(1, 1, 1, NUM_COLS).setValues([HEADER_ROW_1]);
  sheet.getRange(2, 1, 1, NUM_COLS).setValues([HEADER_ROW_2]);

  // 主表頭 (row 1) 樣式
  sheet.getRange(1, 1, 1, NUM_COLS)
    .setBackground(C.headerBg)
    .setFontColor(C.headerText)
    .setFontWeight('bold')
    .setFontSize(11)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // 子表頭 (row 2) 樣式 — 只有 E-L
  sheet.getRange(2, 1, 1, NUM_COLS)
    .setBackground(C.subHeaderBg)
    .setFontColor(C.headerText)
    .setFontWeight('500')
    .setFontSize(10)
    .setHorizontalAlignment('center')
    .setVerticalAlignment('middle');

  // 合併：A-D 的兩列垂直合併（將標題上下置中）
  for (let c = 1; c <= STATUS_COL; c++) {
    sheet.getRange(1, c, 2, 1).merge();
  }
  // 合併：E1:H1 (預約人 A) 和 I1:L1 (預約人 B)
  sheet.getRange(1, A_START_COL, 1, BOOKING_COLS_PER_PERSON).merge();
  sheet.getRange(1, B_START_COL, 1, BOOKING_COLS_PER_PERSON).merge();

  sheet.setRowHeight(1, 32);
  sheet.setRowHeight(2, 28);
  sheet.setFrozenRows(2);

  /* ── 資料 ───────────────────────────────────── */
  if (numRows > 0) {
    const dataRange = sheet.getRange(DATA_START_ROW, 1, numRows, NUM_COLS);
    dataRange.setValues(rows);

    dataRange.setFontSize(10).setVerticalAlignment('middle');

    // A、B 欄文字格式
    sheet.getRange(DATA_START_ROW, 1, numRows, 2).setNumberFormat('@');

    // A-D 置中、E-L 靠左
    sheet.getRange(DATA_START_ROW, 1, numRows, STATUS_COL).setHorizontalAlignment('center');
    sheet.getRange(DATA_START_ROW, A_START_COL, numRows, NUM_COLS - STATUS_COL).setHorizontalAlignment('left');

    // D 欄勾選框
    sheet.getRange(DATA_START_ROW, STATUS_COL, numRows, 1).insertCheckboxes();

    // 行高
    sheet.setRowHeights(DATA_START_ROW, numRows, 30);

    /* 隔列條紋（僅資料區） */
    const bandingRange = sheet.getRange(DATA_START_ROW, 1, numRows, NUM_COLS);
    bandingRange.getBandings().forEach(b => b.remove());
    const banding = bandingRange.applyRowBanding(SpreadsheetApp.BandingTheme.LIGHT_GREY);
    banding.setFirstRowColor(C.bandOdd).setSecondRowColor(C.bandEven);

    /* 條件格式：Status = TRUE 整列染色 */
    const ruleRange = sheet.getRange(DATA_START_ROW, 1, numRows, NUM_COLS);
    const rule = SpreadsheetApp.newConditionalFormatRule()
      .whenFormulaSatisfied(`=$D${DATA_START_ROW}=TRUE`)
      .setBackground(C.trueRow)
      .setRanges([ruleRange])
      .build();
    sheet.setConditionalFormatRules([rule]);

    /* 邊框：表頭 + 資料整體 */
    sheet.getRange(1, 1, numRows + 2, NUM_COLS).setBorder(
      true, true, true, true, true, true,
      C.border, SpreadsheetApp.BorderStyle.SOLID
    );

    /* A / B 兩組之間加一條較粗的分隔線 */
    sheet.getRange(1, A_START_COL, numRows + 2, 1).setBorder(
      null, true, null, null, null, null,
      C.headerBg, SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
    sheet.getRange(1, B_START_COL, numRows + 2, 1).setBorder(
      null, true, null, null, null, null,
      C.headerBg, SpreadsheetApp.BorderStyle.SOLID_MEDIUM
    );
  }

  /* 自動調整欄寬 + 預約欄保底寬度 */
  sheet.autoResizeColumns(1, NUM_COLS);
  if (sheet.getColumnWidth(1) < 120) sheet.setColumnWidth(1, 120);
  if (sheet.getColumnWidth(2) < 130) sheet.setColumnWidth(2, 130);
  // E-L 預約欄
  for (let c = A_START_COL; c <= NUM_COLS; c++) {
    if (sheet.getColumnWidth(c) < 110) sheet.setColumnWidth(c, 110);
  }
}

/* ──────────────────────────────────────────────── *
 *  POST：寫入預約。會自動寫到 A 或 B（先填空的那組）
 *  payload: { gameDayID, month?, name, server, email, seat }
 *  回傳: { ok, slot:'A'|'B', error? }
 * ──────────────────────────────────────────────── */
function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents || '{}');
    const { gameDayID, month, name, server, email, seat } = payload;

    // email 為選填；其他欄位皆為必填
    if (!gameDayID || !name || !server || !seat) {
      return jsonOut_({ ok: false, error: '欄位不完整' });
    }

    /* ── 濫用防護：送出冷卻 ──────────────────────────
     * Apps Script 的 Web App 拿不到呼叫端真正的 IP，能穩定當作
     * 「同一個人」識別碼的只有表單自己填的欄位，這裡用「遊戲ID + 伺服器」。
     * 冷卻期間內的重複送出直接擋掉，連鎖都不用進、表也不用掃，
     * 避免手滑連點、或有人寫程式短時間內狂打這支 API
     * （不管是想灌爆某個時段還是洗版寄出通知信）。 */
    const cooldownKey = 'submit_' + String(name).trim().toLowerCase() + '|' + String(server).trim().toLowerCase();
    const cache = CacheService.getScriptCache();
    if (cache.get(cooldownKey)) {
      return jsonOut_({ ok: false, error: `請稍等 ${SUBMIT_COOLDOWN_SECONDS} 秒再試一次，你剛剛才送出過。` });
    }
    cache.put(cooldownKey, '1', SUBMIT_COOLDOWN_SECONDS);

    const lock = LockService.getDocumentLock();
    try {
      // 等待文件鎖（避免雙人同時寫入造成競態）
      lock.waitLock(10000);

      return doPostLocked_({ gameDayID, month, name, server, email, seat });
    } finally {
      try { lock.releaseLock(); } catch (_) {}
    }
  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  }
}

/* 實際寫入試算表 + 寄信的邏輯，doPost() 確認冷卻沒問題、拿到鎖之後才會呼叫 */
function doPostLocked_({ gameDayID, month, name, server, email, seat }) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const monthRegex = /^\d{4}\/\d{2}$/;

    /* 1) 找出 row：優先用 payload.month 定位，找不到再掃所有 YYYY/MM 工作表 */
    let sheet = null, row = -1;
    if (month && monthRegex.test(month)) {
      const s = ss.getSheetByName(month);
      if (s) {
        const r = findRowByGameDay_(s, gameDayID);
        if (r > 0) { sheet = s; row = r; }
      }
    }
    if (row < 0) {
      const sheets = ss.getSheets().filter(s => monthRegex.test(s.getName()));
      for (const s of sheets) {
        const r = findRowByGameDay_(s, gameDayID);
        if (r > 0) { sheet = s; row = r; break; }
      }
    }
    if (row < 0) {
      return jsonOut_({ ok: false, error: '找不到對應的時段（gameDayID）' });
    }

    /* 2) 在鎖內重新讀取整列 — 確認最新狀態（防止重複寫入） */
    const rowValues = sheet.getRange(row, 1, 1, NUM_COLS).getValues()[0];
    const status = rowValues[STATUS_COL - 1];

    const aFilled = isFilled_(rowValues, A_START_COL);
    const bFilled = isFilled_(rowValues, B_START_COL);

    if (status !== true) {
      return jsonOut_({ ok: false, error: '此時段未開放預約' });
    }
    if (aFilled && bFilled) {
      return jsonOut_({ ok: false, error: '此時段兩組皆已被預約' });
    }

    /* 座位衝突防呆 */
    const A_SEAT_IDX = A_START_COL - 1 + (BOOKING_COLS_PER_PERSON - 1);  // 7
    const B_SEAT_IDX = B_START_COL - 1 + (BOOKING_COLS_PER_PERSON - 1);  // 11
    const otherSeat = aFilled ? String(rowValues[A_SEAT_IDX]).trim()
                   : bFilled ? String(rowValues[B_SEAT_IDX]).trim()
                   : '';
    if (otherSeat && otherSeat === String(seat).trim()) {
      return jsonOut_({
        ok: false,
        error: `「${seat}」座位已被另一組預約，請選另一個座位。`
      });
    }

    /* 3) 決定要寫入 A 或 B（A 為優先） */
    const writeCol  = aFilled ? B_START_COL : A_START_COL;
    const slotLabel = aFilled ? 'B' : 'A';
    const cleanName   = String(name).trim();
    const cleanServer = String(server).trim();
    const cleanEmail  = String(email || '').trim();
    const cleanSeat   = String(seat).trim();

    /* 4) 寫入 4 格 [遊戲ID / 伺服器 / Gmail / 座位] */
    sheet.getRange(row, writeCol, 1, BOOKING_COLS_PER_PERSON).setValues([[
      cleanName, cleanServer, cleanEmail, cleanSeat
    ]]);
    SpreadsheetApp.flush();

    /* 5) 取出時段日期/時間（從 sheet 來，避免依賴 payload） */
    const slotDateRaw = rowValues[0];
    const slotTimeRaw = rowValues[1];
    const slotDate = slotDateRaw instanceof Date
                     ? Utilities.formatDate(slotDateRaw, TIMEZONE, 'yyyy-MM-dd')
                     : String(slotDateRaw).trim();
    const slotTime = slotTimeRaw instanceof Date
                     ? Utilities.formatDate(slotTimeRaw, TIMEZONE, 'HH:mm:ss')
                     : String(slotTimeRaw).trim();

    /* 6) 寄信：失敗不影響預約結果，只 log */
    try {
      sendBookingEmails({
        sheetName: sheet.getName(),
        slotLabel,
        slotDate,
        slotTime,
        gameDayID: Number(gameDayID),
        name:   cleanName,
        server: cleanServer,
        email:  cleanEmail,
        seat:   cleanSeat
      });
    } catch (mailErr) {
      Logger.log('sendBookingEmails failed: ' + mailErr.message);
    }

    return jsonOut_({
      ok: true,
      slot: slotLabel,
      sheet: sheet.getName(),
      row,
      gameDayID: Number(gameDayID)
    });
}

/* ──────────────────────────────────────────────── *
 *  寄送雙向郵件：店主一定寄、客人有信箱才寄
 *  opts.ownerEmail：覆寫店主收件地址（測試用）
 * ──────────────────────────────────────────────── */
function sendBookingEmails(info, opts) {
  opts = opts || {};
  const ownerTo = opts.ownerEmail || OWNER_EMAIL;

  const {
    sheetName, slotLabel,
    slotDate, slotTime,
    gameDayID,
    name, server, email, seat
  } = info;

  const timeShort = String(slotTime).slice(0, 5);   // HH:mm

  /* ── 寄給店主 ── */
  const ownerSubject = `[預約通知] ${slotDate} ${timeShort} · ${name}`;
  const ownerPlain = [
    `${CAFE_NAME} ── 收到一筆新預約`,
    ``,
    `日期：${slotDate}`,
    `時間：${slotTime} (UTC+8)`,
    `月份表：${sheetName}`,
    `位置：預約人 ${slotLabel}（GameDay #${gameDayID}）`,
    ``,
    `── 預約人資訊 ──`,
    `遊戲 ID：${name}`,
    `伺服器：${server}`,
    `Gmail：${email || '（未提供）'}`,
    `座位：${seat}`,
    ``,
    `--`,
    `此信由 ${CAFE_NAME} 預約系統自動發送`
  ].join('\n');

  const ownerHtml = `
    <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 540px; margin: 0 auto; background: #FBF3E5; padding: 32px; border-radius: 18px; color: #3B2418; line-height: 1.7;">
      <p style="font-family: serif; font-size: 13px; color: #C77A66; letter-spacing: 1.2px; margin: 0 0 4px;">new reservation ✿</p>
      <h2 style="font-family: serif; font-weight: 500; font-size: 24px; margin: 0 0 22px; color: #3B2418; letter-spacing: -0.5px;">收到一筆新預約</h2>

      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #5A3A27; width: 90px;">日期</td><td style="font-weight: 600;">${slotDate}</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">時間</td><td style="font-weight: 600;">${slotTime} (UTC+8)</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">月份表</td><td>${sheetName}</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">位置</td><td>預約人 ${slotLabel} <span style="opacity:0.6;">(GameDay #${gameDayID})</span></td></tr>
      </table>

      <hr style="border: none; border-top: 1px dashed rgba(59, 36, 24, 0.2); margin: 22px 0;">

      <p style="font-family: serif; font-size: 13px; color: #8FA870; letter-spacing: 1px; margin: 0 0 10px;">guest info ✎</p>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 6px 0; color: #5A3A27; width: 90px;">遊戲 ID</td><td style="font-weight: 600;">${escapeHtml_(name)}</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">伺服器</td><td>${escapeHtml_(server)}</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">Gmail</td><td>${email ? escapeHtml_(email) : '<span style="opacity:0.5;">（未提供）</span>'}</td></tr>
        <tr><td style="padding: 6px 0; color: #5A3A27;">座位</td><td>${escapeHtml_(seat)}</td></tr>
      </table>

      <p style="margin: 28px 0 0; font-size: 12px; color: #5A3A27; opacity: 0.7;">
        — 此信由 ${CAFE_NAME} 預約系統自動發送
      </p>
    </div>
  `;

  MailApp.sendEmail({
    to:       ownerTo,
    subject:  ownerSubject,
    body:     ownerPlain,
    htmlBody: ownerHtml,
    name:     CAFE_NAME
  });

  /* ── 寄給客人（沒填 email 就跳過） ── */
  if (!email) return;

  const customerSubject = `[Mu Tier Café] 你的預約已收到，${slotDate} 等你來坐坐`;
  const customerPlain = [
    `嗨 ${name}，`,
    ``,
    `謝謝你預約 ${CAFE_NAME}！`,
    `已經為你保留了一張小桌：`,
    ``,
    `日期：${slotDate}`,
    `時間：${slotTime} (UTC+8)`,
    `座位：${seat}`,
    ``,
    `小提醒：`,
    `・位置將保留10分鐘，請預約人留意在時間內前往`,
    `・若需要修改預約資訊，請回覆此篇郵件，店主會協助您`,
    `・店家地址：巴哈姆特 穹頂皓天 13區 24號`,
    ``,
    `當天見 ✿`,
    ``,
    `── ${CAFE_NAME}`
  ].join('\n');

  /* Gmail（以及大多數信箱）出於安全考量，會把「收到的信」裡用 data:base64
   * 內嵌的 <img> 直接濾掉——瀏覽器直接開 HTML 檔案不會擋，但真的寄出去
   * 收到的信就看不到圖。正確做法是把圖片做成一個帶 Content-ID 的
   * 附件，HTML 裡用 cid: 參照，寄信時透過 inlineImages 帶過去。 */
  const customerLogoBlob = Utilities.newBlob(
    Utilities.base64Decode(CUSTOMER_LOGO_BASE64), 'image/png', 'mu-tier-logo.png'
  );

  const customerHtml = `
    <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 540px; margin: 0 auto; background: #FBF3E5; padding: 32px; border-radius: 18px; color: #3B2418; line-height: 1.75;">
      <div style="text-align: center; margin-bottom: 22px;">
        <img src="cid:muTierLogo" alt="${CAFE_NAME}" width="60" height="60" style="display: inline-block;" />
        <p style="margin: 8px 0 0; font-family: serif; font-weight: 600; font-size: 15px; letter-spacing: 0.5px; color: #3B2418;">Mu Tier Café</p>
      </div>
      <hr style="border: none; border-top: 1px dashed rgba(59, 36, 24, 0.2); margin: 22px 0 12px;">
      <p style="font-family: serif; font-size: 13px; color: #C77A66; letter-spacing: 1.2px; margin: 0 0 4px;">your reservation ✿</p>
      <h2 style="font-family: serif; font-weight: 500; font-size: 26px; margin: 0 0 18px; color: #3B2418; letter-spacing: -0.5px;">嗨 ${escapeHtml_(name)}，</h2>

      <p style="margin: 0 0 14px;">
        謝謝你預約 <b>${CAFE_NAME}</b> ♡<br>
        已經為你保留了一張小桌：
      </p>

      <div style="background: #F6EADA; padding: 18px 22px; border-radius: 14px; margin: 18px 0;">
        <p style="margin: 6px 0;"><span style="color: #5A3A27; display: inline-block; width: 50px;">日期</span><b>${slotDate}</b></p>
        <p style="margin: 6px 0;"><span style="color: #5A3A27; display: inline-block; width: 50px;">時間</span><b>${slotTime}</b> <span style="opacity:0.6;">(UTC+8)</span></p>
        <p style="margin: 6px 0;"><span style="color: #5A3A27; display: inline-block; width: 50px;">座位</span><b>${escapeHtml_(seat)}</b></p>
      </div>

      <p style="margin: 22px 0 8px; font-family: serif; font-size: 14px; color: #5A3A27; font-weight: 600;">小提醒 ✎</p>
      <ul style="margin: 0 0 14px; padding-left: 22px; color: #5A3A27;">
        <li>位置將保留10分鐘，請預約人留意在時間內前往</li>
        <li>若需要修改預約資訊，請回覆此篇郵件，店主會協助您</li>
        <li>店家地址：巴哈姆特 穹頂皓天 13區 24號</li>
      </ul>

      <p style="margin: 24px 0 0; font-family: serif; font-style: italic; font-size: 22px; color: #C77A66;">當天見 ✿</p>

      <hr style="border: none; border-top: 1px dashed rgba(59, 36, 24, 0.2); margin: 22px 0 12px;">

      <p style="margin: 0; font-size: 12px; color: #5A3A27; opacity: 0.75;">
        ${CAFE_NAME}<br>
        此信為自動寄送，回覆會直接送達店主信箱。
      </p>
    </div>
  `;

  MailApp.sendEmail({
    to:           email,
    subject:      customerSubject,
    body:         customerPlain,
    htmlBody:     customerHtml,
    name:         CAFE_NAME,
    inlineImages: { muTierLogo: customerLogoBlob }
  });
}

/* HTML escape helper（用在郵件 HTML 模板） */
function escapeHtml_(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

/* 在工作表中以遊戲天數定位 row（C 欄） */
function findRowByGameDay_(sheet, gameDayID) {
  const lastRow = sheet.getLastRow();
  if (lastRow < DATA_START_ROW) return -1;
  const target = Number(gameDayID);
  if (!Number.isFinite(target)) return -1;

  const ids = sheet.getRange(DATA_START_ROW, 3, lastRow - DATA_START_ROW + 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (Number(ids[i][0]) === target) return DATA_START_ROW + i;
  }
  return -1;
}

/* 該組（A 或 B）的 4 個欄位是否任一格有值 */
function isFilled_(rowValues, startCol) {
  for (let c = 0; c < BOOKING_COLS_PER_PERSON; c++) {
    if (String(rowValues[startCol - 1 + c]).trim() !== '') return true;
  }
  return false;
}

/* JSON 回應 */
function jsonOut_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/* ──────────────────────────────────────────────── *
 *  Web 端呼叫：跨所有「YYYY/MM」工作表回傳可預約時段
 *  available 欄位代表本時段還剩幾組空位（0/1/2）
 * ──────────────────────────────────────────────── */
function doGet(e) {
  const out = [];
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const monthRegex = /^\d{4}\/\d{2}$/;

    ss.getSheets().forEach(sheet => {
      if (!monthRegex.test(sheet.getName())) return;

      const lastRow = sheet.getLastRow();
      if (lastRow < DATA_START_ROW) return;

      const data = sheet.getRange(
        DATA_START_ROW, 1,
        lastRow - DATA_START_ROW + 1,
        NUM_COLS
      ).getValues();

      data.forEach(row => {
        const [
          date, time, gameDay, status,
          aId, aServer, aGmail, aSeat,
          bId, bServer, bGmail, bSeat
        ] = row;

        const aFilled = !!(String(aId).trim() || String(aServer).trim() ||
                           String(aGmail).trim() || String(aSeat).trim());
        const bFilled = !!(String(bId).trim() || String(bServer).trim() ||
                           String(bGmail).trim() || String(bSeat).trim());

        const available = (aFilled ? 0 : 1) + (bFilled ? 0 : 1);

        if (status === true && available > 0) {
          out.push({
            month: sheet.getName(),
            date: date instanceof Date
                  ? Utilities.formatDate(date, TIMEZONE, 'yyyy-MM-dd')
                  : String(date),
            time: time instanceof Date
                  ? Utilities.formatDate(time, TIMEZONE, 'HH:mm:ss')
                  : String(time),
            gameDay: Number(gameDay),
            available: available,            // 1 或 2
            slots: { A: !aFilled, B: !bFilled },
            // 已被預約那組的座位（讓前端能禁用衝突選項），未被預約則為 null
            seats: {
              A: aFilled ? String(aSeat).trim() : null,
              B: bFilled ? String(bSeat).trim() : null
            }
          });
        }
      });
    });

    out.sort((a, b) => a.gameDay - b.gameDay);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}
