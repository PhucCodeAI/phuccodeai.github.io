/**
 * @fileoverview Vẽ biểu đồ SVG nhẹ cho bài viết từ cấu hình JSON đặt trong
 * `<figure class="chart">`. Hỗ trợ cột ngang (một hoặc nhiều chuỗi, có giá trị
 * âm), đường và cột chồng; kèm chú giải, tooltip khi rê chuột và bảng số liệu.
 */

const SVG_NS = "http://www.w3.org/2000/svg";
const BAR_HEIGHT = 18;
const BAR_GAP = 2;
const ROW_GAP = 14;
const RADIUS = 4;

/**
 * @typedef {Object} Series
 * @property {string} name Tên chuỗi hiển thị trong chú giải.
 * @property {string} key Khóa lấy giá trị trong mỗi dòng dữ liệu.
 */

/**
 * @typedef {Object} ChartSpec
 * @property {"bar" | "line" | "stacked"} type Loại biểu đồ.
 * @property {string} [unit] Đơn vị nối sau giá trị, ví dụ "%".
 * @property {number} [decimals] Số chữ số thập phân khi hiển thị.
 * @property {number} [min] Giá trị nhỏ nhất của trục.
 * @property {number} [max] Giá trị lớn nhất của trục.
 * @property {Series[]} [series] Các chuỗi dữ liệu (cột ngang).
 * @property {Object[]} [rows] Các dòng dữ liệu (cột ngang).
 * @property {string[]} [highlight] Nhãn các dòng cần nhấn mạnh (một chuỗi).
 * @property {(string|number)[]} [x] Giá trị trục ngang (biểu đồ đường).
 * @property {number[]} [values] Giá trị trục dọc (biểu đồ đường).
 * @property {number} [mark] Chỉ số điểm cần gắn nhãn (biểu đồ đường).
 * @property {number} [ticks] Số khoảng chia trục dọc (biểu đồ đường).
 * @property {string} [xLabel] Tên trục ngang (biểu đồ đường).
 * @property {{label: string, value: number}[]} [segments] Các đoạn (cột chồng).
 */

/**
 * Định dạng số theo kiểu Việt Nam (dấu phẩy thập phân, dấu chấm hàng nghìn).
 *
 * @param {number} value Giá trị cần định dạng.
 * @param {ChartSpec} spec Cấu hình biểu đồ.
 * @param {boolean} [signed] Thêm dấu "+" cho số dương.
 * @returns {string} Chuỗi đã định dạng kèm đơn vị.
 */
function formatValue(value, spec, signed = false) {
  const digits = spec.decimals ?? 1;
  const text = value.toLocaleString("vi-VN", { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${text}${spec.unit ?? ""}`;
}

/**
 * Tạo phần tử SVG với các thuộc tính cho trước.
 *
 * @param {string} tag Tên thẻ SVG.
 * @param {Object<string, string|number>} attrs Thuộc tính của phần tử.
 * @param {SVGElement} [parent] Phần tử cha để gắn vào.
 * @returns {SVGElement} Phần tử đã tạo.
 */
function svgElement(tag, attrs, parent) {
  const node = document.createElementNS(SVG_NS, tag);
  Object.entries(attrs).forEach(([name, value]) => node.setAttribute(name, String(value)));
  if (parent) parent.appendChild(node);
  return node;
}

/**
 * Tạo đường viền cột ngang bo tròn 4px ở đầu dữ liệu, vuông ở gốc.
 *
 * @param {number} start Tọa độ x của gốc (vạch 0).
 * @param {number} end Tọa độ x của đầu dữ liệu.
 * @param {number} top Tọa độ y của cạnh trên.
 * @param {number} height Độ dày cột.
 * @returns {string} Thuộc tính `d` của path.
 */
function barPath(start, end, top, height) {
  const width = Math.abs(end - start);
  const r = Math.min(RADIUS, width, height / 2);
  const dir = end >= start ? 1 : -1;
  const tip = end - dir * r;
  return [
    `M${start},${top}`,
    `H${tip}`,
    `Q${end},${top} ${end},${top + r}`,
    `V${top + height - r}`,
    `Q${end},${top + height} ${tip},${top + height}`,
    `H${start}`,
    "Z",
  ].join(" ");
}

/**
 * Tooltip dùng chung cho mọi biểu đồ trên trang.
 */
class Tooltip {
  constructor() {
    /** @type {HTMLDivElement} */
    this.node = document.createElement("div");
    this.node.className = "chart-tip";
    this.node.hidden = true;
    document.body.appendChild(this.node);
  }

  /**
   * Hiện tooltip gần con trỏ.
   *
   * @param {MouseEvent} event Sự kiện chuột.
   * @param {string} title Dòng tiêu đề.
   * @param {string} body Dòng giá trị.
   */
  show(event, title, body) {
    this.node.innerHTML = "";
    const head = document.createElement("strong");
    head.textContent = title;
    const text = document.createElement("span");
    text.textContent = body;
    this.node.append(head, text);
    this.node.hidden = false;
    const x = Math.min(event.clientX + 14, window.innerWidth - this.node.offsetWidth - 8);
    const y = event.clientY - this.node.offsetHeight - 12;
    this.node.style.transform = `translate(${x}px, ${Math.max(y, 8)}px)`;
  }

  /** Ẩn tooltip. */
  hide() {
    this.node.hidden = true;
  }
}

/**
 * Gắn tooltip cho một vùng tương tác của biểu đồ.
 *
 * @param {SVGElement} target Vùng nhận sự kiện chuột.
 * @param {Tooltip} tooltip Tooltip dùng chung.
 * @param {string} title Dòng tiêu đề.
 * @param {string} body Dòng giá trị.
 */
function bindTooltip(target, tooltip, title, body) {
  target.addEventListener("mousemove", (event) => tooltip.show(event, title, body));
  target.addEventListener("mouseleave", () => tooltip.hide());
}

/**
 * Vẽ biểu đồ cột ngang, hỗ trợ nhiều chuỗi và giá trị âm.
 *
 * @param {HTMLElement} host Vùng chứa SVG.
 * @param {ChartSpec} spec Cấu hình biểu đồ.
 * @param {Tooltip} tooltip Tooltip dùng chung.
 */
function renderBar(host, spec, tooltip) {
  const width = host.clientWidth;
  const series = spec.series;
  const multi = series.length > 1;
  const values = spec.rows.flatMap((row) => series.map((s) => row[s.key]));
  const min = Math.min(spec.min ?? 0, ...values);
  const max = Math.max(spec.max ?? 0, ...values);
  const hasNegative = min < 0;
  const labelWidth = Math.min(210, Math.round(width * 0.36));
  const valueRoom = 64;
  const plotStart = labelWidth + (hasNegative ? valueRoom : 8);
  const plotEnd = width - valueRoom;
  const scale = (value) => plotStart + ((value - min) / (max - min)) * (plotEnd - plotStart);
  const zero = scale(0);
  const groupHeight = series.length * BAR_HEIGHT + (series.length - 1) * BAR_GAP;
  const height = spec.rows.length * (groupHeight + ROW_GAP) - ROW_GAP + 8;

  const svg = svgElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
  svgElement("line", { x1: zero, x2: zero, y1: 0, y2: height, class: "axis" }, svg);

  spec.rows.forEach((row, rowIndex) => {
    const top = rowIndex * (groupHeight + ROW_GAP);
    const label = svgElement("text", { x: labelWidth - 12, y: top + groupHeight / 2, class: "row-label", "text-anchor": "end", "dominant-baseline": "middle" }, svg);
    label.textContent = row.label;

    const emphasized = !spec.highlight || spec.highlight.includes(row.label);
    series.forEach((s, seriesIndex) => {
      const value = row[s.key];
      const y = top + seriesIndex * (BAR_HEIGHT + BAR_GAP);
      const end = scale(value);
      const tone = multi ? `s${seriesIndex + 1}` : emphasized ? "s1" : "dim";
      svgElement("path", { d: barPath(zero, end, y, BAR_HEIGHT), class: `bar ${tone}` }, svg);

      const positive = value >= 0;
      const text = svgElement("text", {
        x: end + (positive ? 6 : -6), y: y + BAR_HEIGHT / 2,
        class: emphasized ? "value" : "value muted",
        "text-anchor": positive ? "start" : "end", "dominant-baseline": "middle",
      }, svg);
      text.textContent = formatValue(value, spec, hasNegative);

      const hit = svgElement("rect", { x: 0, y: y - 1, width, height: BAR_HEIGHT + 2, class: "hit" }, svg);
      bindTooltip(hit, tooltip, row.label, `${s.name}: ${formatValue(value, spec, hasNegative)}`);
    });
  });
  host.replaceChildren(svg);
}

/**
 * Vẽ biểu đồ đường một chuỗi có đường dóng khi rê chuột.
 *
 * @param {HTMLElement} host Vùng chứa SVG.
 * @param {ChartSpec} spec Cấu hình biểu đồ.
 * @param {Tooltip} tooltip Tooltip dùng chung.
 */
function renderLine(host, spec, tooltip) {
  const width = host.clientWidth;
  const height = 230;
  const pad = { top: 16, right: 20, bottom: 40, left: 44 };
  const min = spec.min ?? Math.min(...spec.values);
  const max = spec.max ?? Math.max(...spec.values);
  const stepX = (width - pad.left - pad.right) / (spec.x.length - 1);
  const xAt = (index) => pad.left + index * stepX;
  const yAt = (value) => pad.top + (1 - (value - min) / (max - min)) * (height - pad.top - pad.bottom);

  const svg = svgElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
  const ticks = spec.ticks ?? 4;
  for (let i = 0; i <= ticks; i += 1) {
    const value = min + ((max - min) * i) / ticks;
    const y = yAt(value);
    svgElement("line", { x1: pad.left, x2: width - pad.right, y1: y, y2: y, class: i === 0 ? "axis" : "grid" }, svg);
    const tick = svgElement("text", { x: pad.left - 8, y, class: "tick", "text-anchor": "end", "dominant-baseline": "middle" }, svg);
    tick.textContent = formatValue(value, { ...spec, decimals: 0 });
  }
  spec.x.forEach((label, index) => {
    const tick = svgElement("text", { x: xAt(index), y: height - pad.bottom + 18, class: "tick", "text-anchor": "middle" }, svg);
    tick.textContent = String(label);
  });
  if (spec.xLabel) {
    const axisName = svgElement("text", { x: (pad.left + width - pad.right) / 2, y: height - 4, class: "tick", "text-anchor": "middle" }, svg);
    axisName.textContent = spec.xLabel;
  }

  const points = spec.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(" ");
  svgElement("polyline", { points, class: "line s1-stroke" }, svg);
  const guide = svgElement("line", { x1: 0, x2: 0, y1: pad.top, y2: height - pad.bottom, class: "guide", visibility: "hidden" }, svg);

  spec.values.forEach((value, index) => {
    const marked = index === spec.mark;
    svgElement("circle", { cx: xAt(index), cy: yAt(value), r: marked ? 5 : 4, class: "dot s1" }, svg);
    if (marked) {
      const note = svgElement("text", { x: xAt(index), y: yAt(value) - 14, class: "value", "text-anchor": "middle" }, svg);
      note.textContent = formatValue(value, spec);
    }
    const hit = svgElement("rect", { x: xAt(index) - stepX / 2, y: pad.top, width: stepX, height: height - pad.top - pad.bottom, class: "hit" }, svg);
    hit.addEventListener("mouseenter", () => {
      guide.setAttribute("x1", String(xAt(index)));
      guide.setAttribute("x2", String(xAt(index)));
      guide.setAttribute("visibility", "visible");
    });
    hit.addEventListener("mouseleave", () => guide.setAttribute("visibility", "hidden"));
    bindTooltip(hit, tooltip, `${spec.xLabel ?? ""} ${spec.x[index]}`.trim(), formatValue(value, spec));
  });
  host.replaceChildren(svg);
}

/**
 * Vẽ một cột ngang chồng nhiều đoạn, có khe 2px giữa các đoạn.
 *
 * @param {HTMLElement} host Vùng chứa SVG.
 * @param {ChartSpec} spec Cấu hình biểu đồ.
 * @param {Tooltip} tooltip Tooltip dùng chung.
 */
function renderStacked(host, spec, tooltip) {
  const width = host.clientWidth;
  const height = 40;
  const total = spec.segments.reduce((sum, segment) => sum + segment.value, 0);
  const svg = svgElement("svg", { width, height, viewBox: `0 0 ${width} ${height}`, role: "img" });
  let cursor = 0;
  spec.segments.forEach((segment, index) => {
    const segmentWidth = (segment.value / total) * width;
    const gap = index < spec.segments.length - 1 ? BAR_GAP : 0;
    const rect = svgElement("rect", { x: cursor, y: 6, width: Math.max(segmentWidth - gap, 1), height: 28, class: `bar s${index + 1}`, rx: index === spec.segments.length - 1 ? RADIUS : 0 }, svg);
    const label = formatValue(segment.value, spec);
    if (segmentWidth > 70) {
      const text = svgElement("text", { x: cursor + 10, y: 20, class: "inside", "dominant-baseline": "middle" }, svg);
      text.textContent = label;
    }
    bindTooltip(rect, tooltip, segment.label, label);
    cursor += segmentWidth;
  });
  host.replaceChildren(svg);
}

/**
 * Dựng chú giải cho biểu đồ có từ hai chuỗi trở lên.
 *
 * @param {HTMLElement} figure Khung biểu đồ.
 * @param {string[]} names Tên các chuỗi theo thứ tự màu.
 */
function renderLegend(figure, names) {
  if (names.length < 2) return;
  const legend = document.createElement("div");
  legend.className = "chart-legend";
  names.forEach((name, index) => {
    const item = document.createElement("span");
    const swatch = document.createElement("i");
    swatch.className = `swatch s${index + 1}`;
    item.append(swatch, name);
    legend.appendChild(item);
  });
  figure.querySelector(".chart-plot").before(legend);
}

/**
 * Dựng bảng số liệu gập bên dưới biểu đồ để đọc chính xác từng giá trị.
 *
 * @param {HTMLElement} figure Khung biểu đồ.
 * @param {ChartSpec} spec Cấu hình biểu đồ.
 */
function renderTable(figure, spec) {
  /** @type {string[]} */
  let header;
  /** @type {string[][]} */
  let body;
  if (spec.type === "bar") {
    const signed = spec.rows.some((row) => spec.series.some((s) => row[s.key] < 0));
    header = ["", ...spec.series.map((s) => s.name)];
    body = spec.rows.map((row) => [row.label, ...spec.series.map((s) => formatValue(row[s.key], spec, signed))]);
  } else if (spec.type === "line") {
    header = [spec.xLabel ?? "", "Giá trị"];
    body = spec.x.map((label, index) => [String(label), formatValue(spec.values[index], spec)]);
  } else {
    header = ["Giai đoạn", "Giá trị"];
    body = spec.segments.map((segment) => [segment.label, formatValue(segment.value, spec)]);
  }

  const details = document.createElement("details");
  details.className = "chart-table";
  const summary = document.createElement("summary");
  summary.textContent = "Xem bảng số liệu";
  const table = document.createElement("table");
  const headRow = table.createTHead().insertRow();
  header.forEach((cell) => {
    const th = document.createElement("th");
    th.textContent = cell;
    headRow.appendChild(th);
  });
  const tbody = table.createTBody();
  body.forEach((cells) => {
    const tr = tbody.insertRow();
    cells.forEach((cell) => { tr.insertCell().textContent = cell; });
  });
  details.append(summary, table);
  figure.appendChild(details);
}

/**
 * Khởi tạo một biểu đồ: đọc cấu hình, dựng chú giải, bảng và vẽ lại khi đổi kích thước.
 *
 * @param {HTMLElement} figure Khung `<figure class="chart">`.
 * @param {Tooltip} tooltip Tooltip dùng chung.
 */
function mountChart(figure, tooltip) {
  const source = figure.querySelector("script[type='application/json']");
  if (!source) return;
  /** @type {ChartSpec} */
  const spec = JSON.parse(source.textContent);
  const plot = document.createElement("div");
  plot.className = "chart-plot";
  source.after(plot);

  const names = spec.type === "bar" ? spec.series.map((s) => s.name)
    : spec.type === "stacked" ? spec.segments.map((segment) => segment.label) : [];
  renderLegend(figure, names);
  renderTable(figure, spec);

  const renderers = { bar: renderBar, line: renderLine, stacked: renderStacked };
  const draw = () => renderers[spec.type](plot, spec, tooltip);
  draw();
  let lastWidth = plot.clientWidth;
  new ResizeObserver(() => {
    if (plot.clientWidth !== lastWidth) {
      lastWidth = plot.clientWidth;
      draw();
    }
  }).observe(plot);
}

const figures = document.querySelectorAll("figure.chart");
if (figures.length) {
  const tooltip = new Tooltip();
  figures.forEach((figure) => mountChart(figure, tooltip));
}
