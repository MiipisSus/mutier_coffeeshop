/* ============================================================
 *  GSAP ScrollTrigger 視差動畫
 *  依賴：gsap.min.js + ScrollTrigger.min.js（在 index.html 中載入）
 * ============================================================ */

gsap.registerPlugin(ScrollTrigger);

/* story-sprite 左右擺動 tick tock 效果（瞬間切換、不補間） */
gsap.fromTo(
  ".story-sprite",
  { rotate: 0 },
  {
    rotate: 4,
    duration: 0.4, // 每個位置停留 0.6 秒
    ease: "steps(1)", // 單步階 = 瞬間跳變，無平滑過渡
    yoyo: true,
    repeat: -1,
  },
);

gsap.to(".m-icon", {
  rotate: 360,
  duration: 4,
  repeat: -1,
  ease: "linear",
});

/* hero 背景視差：scroll 時背景往下飄一點，看起來移動比頁面慢 */
gsap.fromTo(
  ".hero-bg",
  { yPercent: -10 }, // 進場時的位移
  {
    yPercent: 50, // 結束時的位移
    ease: "none",
    scrollTrigger: {
      trigger: "#hero",
      start: "top top", // section 頂貼到視窗頂時開始
      end: "bottom top", // section 底滑過視窗頂時結束
      scrub: true, // 跟 scroll 進度連動（非播一次）
    },
  },
);

/* story 主圖視差：當 #story 進入視窗時開始位移 */
gsap.fromTo(
  ".story-img",
  { yPercent: -30 },
  {
    yPercent: 50,
    ease: "none",
    scrollTrigger: {
      trigger: "#story",
      start: "top bottom", // section 頂進入視窗底時開始
      end: "bottom top", // section 底離開視窗頂時結束
      scrub: true,
    },
  },
);

/* staff 成員視差：每列獨立綁自己的 ScrollTrigger */
gsap.utils.toArray(".staff-row").forEach((row) => {
  const target = row.querySelector(".member-headshot img");
  if (!target) return;
  gsap.fromTo(
    target,
    { yPercent: -30 },
    {
      yPercent: 30,
      ease: "none",
      scrollTrigger: {
        trigger: row, // ← 每列以自己為 trigger
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
});

/* menu 服務區 3 張圖視差（每張各自綁自己的位置） */
gsap.utils.toArray(".menu-img").forEach((img) => {
  gsap.fromTo(
    img,
    { yPercent: -15 },
    {
      yPercent: 15,
      ease: "none",
      scrollTrigger: {
        trigger: img, // 每張用自己當 trigger
        start: "top bottom",
        end: "bottom top",
        scrub: true,
      },
    },
  );
});

/* visit 梯形遮罩圖視差 */
gsap.fromTo(
  ".visit-img",
  { yPercent: -15 },
  {
    yPercent: 15,
    ease: "none",
    scrollTrigger: {
      trigger: ".visit-img", // 用圖片本身當 trigger（不是整個 #visit）
      start: "top bottom",
      end: "bottom top",
      scrub: true,
    },
  },
);

/* ============================================================
 *  Entrance 動畫：元素進入視窗時淡入 + 上滑
 *  每組 trigger 都加 once:true，只播一次
 * ============================================================ */

/* Story 右側文字區塊 */
gsap.from("#story > div:last-child > *", {
  opacity: 0,
  y: 30,
  duration: 0.8,
  ease: "power2.out",
  stagger: 0.12,
  scrollTrigger: {
    trigger: "#story",
    start: "top 70%",
    once: true,
  },
});

/* Rules 標題 + 每一條 rule 依序進場 */
gsap.from("#rules .text-center > *", {
  opacity: 0,
  y: 20,
  duration: 0.7,
  ease: "power2.out",
  stagger: 0.1,
  scrollTrigger: {
    trigger: "#rules",
    start: "top 75%",
    once: true,
  },
});
gsap.fromTo(
  "#rules .rule-row",
  { opacity: 0, x: -30 },
  {
    opacity: 1,
    x: 0,
    duration: 0.7,
    ease: "power2.out",
    stagger: 0.15,
    scrollTrigger: {
      trigger: "#rules",
      start: "top 85%",
      once: true,
    },
  },
);

/* Staff 標題 + 每位店員 row */
gsap.from("#staff > div:first-child > *", {
  opacity: 0,
  y: 20,
  duration: 0.7,
  ease: "power2.out",
  stagger: 0.1,
  scrollTrigger: {
    trigger: "#staff",
    start: "top 75%",
    once: true,
  },
});
gsap.utils.toArray("#staff .staff-row").forEach((row, i) => {
  // 奇偶交錯從左/右滑入（s-xm 設計上 flex-row-reverse 在右）
  const fromX = i % 2 === 0 ? -40 : 40;
  gsap.from(row, {
    opacity: 0,
    x: fromX,
    duration: 0.9,
    ease: "power2.out",
    scrollTrigger: {
      trigger: row,
      start: "top 80%",
      once: true,
    },
  });
});

/* Menu 大標 */
gsap.fromTo(
  "#menu h2, #menu h2 + p",
  { opacity: 0, y: 20 },
  {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: "power2.out",
    stagger: 0.15,
    scrollTrigger: {
      trigger: "#menu",
      start: "top 85%",
      once: true,
    },
  },
);

/* Menu 食物/飲品/服務 — 每個分類標題 + 內部 li 依序 */
gsap.utils.toArray("#menu .m-item").forEach((item) => {
  gsap.from(item, {
    opacity: 0,
    y: 18,
    duration: 0.6,
    ease: "power2.out",
    scrollTrigger: {
      trigger: item,
      start: "top 88%",
      once: true,
    },
  });
});

/* Visit 文字內容 */
gsap.from("#visit > div:first-child > *", {
  opacity: 0,
  y: 30,
  duration: 0.8,
  ease: "power2.out",
  stagger: 0.12,
  scrollTrigger: {
    trigger: "#visit",
    start: "top 75%",
    once: true,
  },
});

/* ============================================================
 * 圖片載入完成後重新測量所有 ScrollTrigger
 * 修正：從 #staff 之類 hash 進站、或瀏覽器還原捲動位置時，
 *      圖片晚於 script 載入導致 trigger start/end 用到了
 *      圖片未撐開的舊 layout，視差值因此卡在錯誤位置
 * ============================================================ */
window.addEventListener("load", () => {
  ScrollTrigger.refresh();
});
