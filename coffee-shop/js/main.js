/* ============================================================
 *  GSAP ScrollTrigger 視差動畫
 *  依賴：gsap.min.js + ScrollTrigger.min.js（在 index.html 中載入）
 * ============================================================ */

gsap.registerPlugin(ScrollTrigger);

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
