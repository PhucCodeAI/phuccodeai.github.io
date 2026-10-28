/**
 * @fileoverview Chuyển các khối ```mermaid do kramdown sinh ra thành sơ đồ,
 * chỉ tải thư viện Mermaid khi trang có sơ đồ.
 */

/**
 * Thay các khối code mermaid bằng vùng chứa sơ đồ rồi vẽ theo chế độ sáng/tối.
 *
 * @returns {Promise<void>}
 */
async function renderDiagrams() {
  const blocks = document.querySelectorAll("pre > code.language-mermaid");
  if (!blocks.length) return;

  const { default: mermaid } = await import("https://cdn.jsdelivr.net/npm/mermaid@10.9.1/dist/mermaid.esm.min.mjs");
  blocks.forEach((code) => {
    const host = code.closest("div.language-mermaid") || code.parentElement;
    const diagram = document.createElement("div");
    diagram.className = "mermaid";
    diagram.textContent = code.textContent;
    host.replaceWith(diagram);
  });

  const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  mermaid.initialize({ startOnLoad: false, theme: isDark ? "dark" : "neutral", fontFamily: "Inter, sans-serif" });
  await mermaid.run({ querySelector: ".mermaid" });
}

renderDiagrams();
