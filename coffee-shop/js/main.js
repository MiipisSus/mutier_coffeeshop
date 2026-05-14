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
  { yPercent: -50 },
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
      yPercent: 50,
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
