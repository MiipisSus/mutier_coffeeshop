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
  const ui = SpreadsheetApp.getUi();

  // 1) 詢問要寄給哪個信箱（預設帶當前 GAS 帳號）
  const me = Session.getActiveUser().getEmail();
  const promptText =
    `將寄送 2 封測試信（店主版 + 客人版）至以下信箱，請確認或修改：` +
    (me ? '' : '\n\n（無法自動偵測，請手動輸入）');

  const resp = ui.prompt('寄送測試郵件', promptText, ui.ButtonSet.OK_CANCEL);
  if (resp.getSelectedButton() !== ui.Button.OK) return;

  let testTo = resp.getResponseText().trim() || me || '';
  if (!testTo) {
    ui.alert('沒有指定信箱，已取消。');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) {
    ui.alert(`「${testTo}」不是有效的 email 格式。`);
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
    ui.alert(
      `✿ 已寄出測試信\n\n` +
      `收件人：${testTo}\n` +
      `共 2 封：\n` +
      `  • 店主版（主旨開頭「[預約通知]」）\n` +
      `  • 客人版（主旨「🌸 你的預約已收到」）\n\n` +
      `請至信箱確認排版。`
    );
  } catch (err) {
    ui.alert('寄送失敗：' + err.message);
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
  const lock = LockService.getDocumentLock();
  try {
    // 等待文件鎖（避免雙人同時寫入造成競態）
    lock.waitLock(10000);

    const payload = JSON.parse(e.postData.contents || '{}');
    const { gameDayID, month, name, server, email, seat } = payload;

    // email 為選填；其他欄位皆為必填
    if (!gameDayID || !name || !server || !seat) {
      return jsonOut_({ ok: false, error: '欄位不完整' });
    }

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

  } catch (err) {
    return jsonOut_({ ok: false, error: err.message });
  } finally {
    try { lock.releaseLock(); } catch (_) {}
  }
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

  const customerSubject = `🌸 你的預約已收到，${slotDate} 等你來坐坐`;
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
    ``,
    `當天見 ✿`,
    ``,
    `── ${CAFE_NAME}`
  ].join('\n');

  const customerHtml = `
    <div style="font-family: -apple-system, 'Helvetica Neue', sans-serif; max-width: 540px; margin: 0 auto; background: #FBF3E5; padding: 32px; border-radius: 18px; color: #3B2418; line-height: 1.75;">
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
    to:       email,
    subject:  customerSubject,
    body:     customerPlain,
    htmlBody: customerHtml,
    name:     CAFE_NAME
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
