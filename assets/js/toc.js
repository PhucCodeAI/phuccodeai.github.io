/**
 * @fileoverview Dựng mục lục cho bài viết từ các tiêu đề h2/h3: thanh bên dính
 * có đánh dấu phần đang đọc (màn hình rộng), thẻ gập gọn (màn hình hẹp) và
 * thanh tiến độ đọc.
 */

/**
 * @typedef {Object} Section
 * @property {HTMLHeadingElement} heading Tiêu đề h2 của phần.
 * @property {string} index Số thứ tự hiển thị, ví dụ "01".
 * @property {string} title Tên phần đã bỏ số thứ tự ở đầu.
 * @property {HTMLHeadingElement[]} children Các tiêu đề h3 thuộc phần.
 */

/**
 * Gom các tiêu đề trong thân bài thành danh sách phần, mỗi phần kèm tiểu mục.
 *
 * @param {HTMLElement} body Phần tử chứa nội dung bài viết.
 * @returns {Section[]} Danh sách phần theo thứ tự xuất hiện.
 */
function collectSections(body) {
  /** @type {Section[]} */
  const sections = [];
  body.querySelectorAll("h2[id], h3[id]").forEach((heading) => {
    if (heading.tagName === "H2") {
      const match = heading.textContent.match(/^(\d+)\.\s*(.*)$/);
      const position = String(sections.length + 1);
      sections.push({
        heading,
        index: (match ? match[1] : position).padStart(2, "0"),
        title: match ? match[2] : heading.textContent,
        children: [],
      });
    } else if (sections.length) {
      sections[sections.length - 1].children.push(heading);
    }
  });
  return sections;
}

/**
 * Tạo một liên kết tới tiêu đề.
 *
 * @param {HTMLHeadingElement} heading Tiêu đề đích.
 * @param {string} className Lớp CSS của liên kết.
 * @param {string} [text] Nội dung hiển thị, mặc định là chữ của tiêu đề.
 * @returns {HTMLAnchorElement} Liên kết đã tạo.
 */
function createLink(heading, className, text) {
  const link = document.createElement("a");
  link.href = `#${heading.id}`;
  link.className = className;
  link.dataset.target = heading.id;
  link.textContent = text ?? heading.textContent;
  return link;
}

/**
 * Tạo liên kết cấp phần gồm số thứ tự và tên phần.
 *
 * @param {Section} section Phần cần hiển thị.
 * @param {string} className Lớp CSS của liên kết.
 * @returns {HTMLAnchorElement} Liên kết đã tạo.
 */
function createSectionLink(section, className) {
  const link = createLink(section.heading, className, "");
  const index = document.createElement("span");
  index.className = "toc-index";
  index.textContent = section.index;
  const title = document.createElement("span");
  title.className = "toc-title";
  title.textContent = section.title;
  link.append(index, title);
  return link;
}

/**
 * Dựng thanh mục lục bên phải, mỗi phần kèm danh sách tiểu mục.
 *
 * @param {HTMLOListElement} list Danh sách đích trong thanh bên.
 * @param {Section[]} sections Các phần của bài viết.
 */
function renderRail(list, sections) {
  sections.forEach((section) => {
    const item = document.createElement("li");
    item.dataset.target = section.heading.id;
    item.append(createSectionLink(section, "toc-link"));
    if (section.children.length) {
      const subList = document.createElement("ol");
      subList.className = "toc-sublist";
      section.children.forEach((child) => {
        const subItem = document.createElement("li");
        subItem.append(createLink(child, "toc-sublink"));
        subList.append(subItem);
      });
      item.append(subList);
    }
    list.append(item);
  });
}

/**
 * Dựng mục lục dạng thẻ gập cho màn hình hẹp, chỉ liệt kê các phần.
 *
 * @param {HTMLDetailsElement} details Thẻ gập chứa mục lục.
 * @param {Section[]} sections Các phần của bài viết.
 */
function renderInline(details, sections) {
  const list = details.querySelector(".toc-inline-list");
  sections.forEach((section) => {
    const item = document.createElement("li");
    item.append(createSectionLink(section, "toc-inline-link"));
    list.append(item);
  });
  details.querySelector(".toc-inline-count").textContent = `${sections.length} phần`;
  list.addEventListener("click", (event) => {
    if (event.target.closest("a")) details.open = false;
  });
}

/**
 * Theo dõi vị trí cuộn: đánh dấu phần và tiểu mục đang đọc trên thanh bên,
 * cập nhật thanh tiến độ đọc.
 *
 * @param {HTMLElement} rail Thanh mục lục bên phải.
 * @param {HTMLElement} body Phần tử chứa nội dung bài viết.
 * @param {HTMLElement | null} progress Thanh tiến độ đọc.
 */
function trackScroll(rail, body, progress) {
  const headings = [...body.querySelectorAll("h2[id], h3[id]")];
  const links = [...rail.querySelectorAll("a[data-target]")];
  const items = [...rail.querySelectorAll(".toc-rail-list > li")];
  const offset = 140;
  let ticking = false;

  const update = () => {
    ticking = false;
    let activeId = null;
    let activeSection = null;
    for (const heading of headings) {
      if (heading.getBoundingClientRect().top > offset) break;
      activeId = heading.id;
      if (heading.tagName === "H2") activeSection = heading.id;
    }
    links.forEach((link) => link.classList.toggle("is-active", link.dataset.target === activeId));
    items.forEach((item) => item.classList.toggle("is-current", item.dataset.target === activeSection));

    if (progress) {
      const start = body.offsetTop;
      const span = Math.max(body.offsetHeight - window.innerHeight, 1);
      const ratio = Math.min(Math.max((window.scrollY - start) / span, 0), 1);
      progress.style.transform = `scaleX(${ratio})`;
    }
  };

  window.addEventListener("scroll", () => {
    if (!ticking) {
      ticking = true;
      requestAnimationFrame(update);
    }
  }, { passive: true });
  update();
}

const body = document.querySelector(".post-body");
const rail = document.querySelector(".toc-rail");
const inline = document.querySelector(".toc-inline");

if (body && rail && inline) {
  const sections = collectSections(body);
  if (sections.length) {
    renderRail(rail.querySelector(".toc-rail-list"), sections);
    renderInline(inline, sections);
    rail.hidden = false;
    inline.hidden = false;
    trackScroll(rail, body, document.querySelector(".read-progress span"));
  }
}
