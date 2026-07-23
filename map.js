/* =========================================================
   1. 建立地圖
========================================================= */

// 建立 Leaflet 地圖，預設中心位於臺北市附近
const map = L.map("map", {
  preferCanvas: false,
  
// 關閉 Leaflet 預設左上角縮放按鈕
  zoomControl: false
}).setView([25.0478, 121.5319], 12);

// 在右上角重新建立縮放按鈕
L.control.zoom({
  position: "topright",
  zoomInTitle: "放大",
  zoomOutTitle: "縮小"
}).addTo(map);

// 加入比例尺
L.control.scale({
  metric: true,
  imperial: false
}).addTo(map);

// =========================================================
// Popup 避開上方固定標題列的共用設定
// =========================================================

const popupSafePadding = {
  autoPan: true,

  // 左側、上方
  autoPanPaddingTopLeft:
    [30, 115],

  // 右側、下方
  autoPanPaddingBottomRight:
    [30, 30]
};

/* =========================================================
   2. 建立底圖
========================================================= */

// OpenStreetMap
const osmLayer = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">' +
      "OpenStreetMap contributors</a>"
  }
);

// CARTO Voyager
const cartoVoyager = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    attribution: "© OpenStreetMap © CARTO"
  }
);

// CARTO Light
const cartoLightLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    attribution: "© OpenStreetMap contributors © CARTO"
  }
);

// Esri World Imagery
const esriImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/" +
    "World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    maxZoom: 20,
    attribution: "Tiles © Esri"
  }
);

// 底圖清單
const baseLayerList = {
  cartoVoyager,
  cartoLight: cartoLightLayer,
  osm: osmLayer,
  esriImagery
};

// 預設顯示 CARTO Voyager
cartoVoyager.addTo(map);


/* =========================================================
   3. 共用工具函式
========================================================= */

// 安全轉換數值；空字串、null、undefined 會視為無資料
function toFiniteNumber(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue)
    ? numberValue
    : null;
}

// 格式化一般數值
function formatNumber(value, maximumFractionDigits = 0) {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return "無資料";
  }

  return numberValue.toLocaleString("zh-TW", {
    maximumFractionDigits
  });
}

// 格式化比例；GeoJSON 中 0.635 會顯示為 63.5%
function formatPercent(value, decimalPlaces = 1) {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return "無資料";
  }

  return `${(numberValue * 100).toFixed(decimalPlaces)}%`;
}

// 取得行政區名稱
function getAreaName(properties = {}) {
  const county =
    properties.COUNTY ||
    properties.COUNTYNAME ||
    properties.COUNTY_NAM ||
    "";

  const town =
    properties.TOWN ||
    properties.TOWNNAME ||
    properties.TOWN_NAM ||
    "";

  const name = `${county} ${town}`.trim();

  return name || "未提供行政區名稱";
}

// 將文字轉成安全 HTML，避免特殊字元破壞資訊視窗
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

// 從欄位內容中找出真正的網站網址
function normalizeUrl(value) {
  const text = String(
    value || ""
  ).trim();

  if (!text) {
    return "";
  }

  // 若欄位中原本就是 HTML 連結，
  // 優先讀取 href 裡面的網址
  const htmlLinkMatch =
    text.match(
      /href\s*=\s*["']([^"']+)["']/i
    );

  // 若是一般文字，從文字中擷取 http、https 或 www 網址
  const plainUrlMatch =
    text.match(
      /https?:\/\/[^\s<>"']+/i
    ) ||
    text.match(
      /www\.[^\s<>"']+/i
    );

  let urlText =
    htmlLinkMatch?.[1] ||
    plainUrlMatch?.[0] ||
    "";

  if (!urlText) {
    return "";
  }

  // 將 HTML 的 &amp; 還原成 &
  urlText = urlText
    .replaceAll("&amp;", "&")
    .trim();

  // 移除網址最後可能附帶的中文字標點
  urlText = urlText.replace(
    /[，。；、）)\]】]+$/g,
    ""
  );

  // //example.com
  if (urlText.startsWith("//")) {
    urlText = `https:${urlText}`;
  }

  // www.example.com
  if (/^www\./i.test(urlText)) {
    urlText = `https://${urlText}`;
  }

  try {
    const url =
      new URL(urlText);

    if (
      url.protocol !== "http:" &&
      url.protocol !== "https:"
    ) {
      return "";
    }

    return url.href;
  } catch (error) {
    console.warn(
      "無法解析網站網址：",
      value
    );

    return "";
  }
}

// 根據分類設定取得面圖層顏色
function getClassColor(value, classes) {
  const numberValue = toFiniteNumber(value);

  if (numberValue === null) {
    return "#cccccc";
  }

  const matchedClass = classes.find(item => {
    const minPassed =
      item.min === undefined ||
      (item.includeMin === false
        ? numberValue > item.min
        : numberValue >= item.min);

    const maxPassed =
      item.max === undefined ||
      (item.includeMax === true
        ? numberValue <= item.max
        : numberValue < item.max);

    return minPassed && maxPassed;
  });

  return matchedClass
    ? matchedClass.color
    : "#cccccc";
}


/* =========================================================
   4. 圖層設定
   新增圖層時，主要修改這個區塊即可
========================================================= */

const layerConfigs = {
  /* -------------------------------------------------------
     社區心理衛生中心點圖層
  ------------------------------------------------------- */
  mentalHealth: {
    name: "社區心理衛生中心",
    type: "point",
    url: "data/mental_health_center.geojson",

    // 預設是否顯示
    visible: true,

    // 圖層透明度
    opacity: 0.92,

    // 圖層物件載入後會放在這裡
    layer: null,

    // Pane 名稱會由程式建立
    paneName: "overlay-pane-mental-health",

    // 圖層面板中的符號
    symbolHtml:
      '<span class="layer-symbol mental-health-symbol"></span>',

    // 點圖層圖例
    legendItems: [
      {
        color: "#a03641",
        label: "社區心理衛生中心",
        shape: "circle"
      }
    ]
  },

  /* -------------------------------------------------------
     城鄉階層面圖層
  ------------------------------------------------------- */
  urbanicity: {
    name: "城鄉階層",
    type: "polygon",
    url: "data/urbanicity level.geojson",
    valueField: "Rank",

    visible: false,
    opacity: 0.5,
    layer: null,
    selectedFeatureLayer: null,
    paneName: "overlay-pane-urbanicity",

    symbolHtml:
      '<span class="layer-symbol urbanicity-symbol"></span>',

    classes: [
      {
        min: 1,
        max: 70,
        includeMax: true,
        color: "#d7191c",
        label: "1–70"
      },
      {
        min: 71,
        max: 140,
        includeMax: true,
        color: "#fdae61",
        label: "71–140"
      },
      {
        min: 141,
        max: 210,
        includeMax: true,
        color: "#ffffbf",
        label: "141–210"
      },
      {
        min: 211,
        max: 280,
        includeMax: true,
        color: "#abdda4",
        label: "211–280"
      },
      {
        min: 281,
        max: 349,
        includeMax: true,
        color: "#2b83ba",
        label: "281–349"
      }
    ],

    // 行政區 Tooltip 與 Popup 內容
    popup(properties) {
      const areaName = escapeHtml(
        getAreaName(properties)
      );

      const rank = formatNumber(
        properties.Rank
      );

      const population = formatNumber(
        properties.P_CNT
      );

      return `
        <div class="thematic-info">
          <strong>${areaName}</strong>

          <div class="thematic-info-row">
            <span>城鄉階層排名</span>
            <strong>${rank}</strong>
          </div>

          <div class="thematic-info-row">
            <span>人口數</span>
            <strong>
              ${population}
              ${population !== "無資料" ? " 人" : ""}
            </strong>
          </div>
        </div>
      `;
    }
  },

  /* -------------------------------------------------------
     大專以上人口比例面圖層
  ------------------------------------------------------- */
  collegeEducation: {
    name: "大專以上人口比例",
    type: "polygon",
    url: "data/College_Education.geojson",

    valueField:
      "final指標統計0714匯出_15歲以上人口大專以上比例",

    populationField:
      "final指標統計0714匯出_大專以上人口數",

    visible: false,
    opacity: 0.65,
    layer: null,
    selectedFeatureLayer: null,
    paneName: "overlay-pane-college-education",

    symbolHtml:
      '<span class="layer-symbol college-education-symbol"></span>',

    classes: [
      {
        min: 0.22,
        max: 0.32,
        color: "#feebe2",
        label: "22%–32%"
      },
      {
        min: 0.32,
        max: 0.40,
        color: "#fbb4b9",
        label: "32%–40%"
      },
      {
        min: 0.40,
        max: 0.50,
        color: "#f768a1",
        label: "40%–50%"
      },
      {
        min: 0.50,
        max: 0.60,
        color: "#c51b8a",
        label: "50%–60%"
      },
      {
        min: 0.60,
        max: 0.76,
        includeMax: true,
        color: "#7a0177",
        label: "60%–76%"
      }
    ],

    // 行政區 Tooltip 與 Popup 內容
    popup(properties) {
      const areaName = escapeHtml(
        getAreaName(properties)
      );

      const percentage = formatPercent(
        properties[this.valueField]
      );

      const population = formatNumber(
        properties[this.populationField]
      );

      return `
        <div class="thematic-info">
          <strong>${areaName}</strong>

          <div class="thematic-info-row">
            <span>大專以上人口比例</span>
            <strong>${percentage}</strong>
          </div>

          <div class="thematic-info-row">
            <span>大專以上人口數</span>
            <strong>
              ${population}
              ${population !== "無資料" ? " 人" : ""}
            </strong>
          </div>
        </div>
      `;
    }
  },

   /* -------------------------------------------------------
     農戶人口數面圖層
  ------------------------------------------------------- */
  agriculturalPopulation: {
    name: "農戶人口數",
    type: "polygon",

    // GeoJSON 檔案位置
    url: "data/agricultural.geojson",

    // 農戶人口數欄位
    valueField: "農戶人數",

    // 預設先不顯示
    visible: false,

    // 預設透明度
    opacity: 0.65,

    layer: null,
    selectedFeatureLayer: null,

    // 每個圖層的 Pane 名稱不能重複
    paneName:
      "overlay-pane-agricultural-population",

    // 圖層控制面板中的色彩符號
    symbolHtml:
      '<span class="layer-symbol agricultural-population-symbol"></span>',

    // 依照你的 QGIS 圖例設定分級
    classes: [
      {
        min: 0,
        max: 1705,
        includeMax: true,
        color: "#fff1ed",
        label: "0–1,705"
      },
      {
        min: 1705,
        includeMin: false,
        max: 3000,
        includeMax: true,
        color: "#f5c4b6",
        label: "1,705–3,000"
      },
      {
        min: 3000,
        includeMin: false,
        max: 4500,
        includeMax: true,
        color: "#ed987a",
        label: "3,000–4,500"
      },
      {
        min: 4500,
        includeMin: false,
        max: 6000,
        includeMax: true,
        color: "#e36d46",
        label: "4,500–6,000"
      },
      {
        min: 6000,
        includeMin: false,
        max: 8817,
        includeMax: true,
        color: "#d9471c",
        label: "6,000–8,817"
      }
    ],

    // 滑鼠移入及點擊時顯示的資訊
    popup(properties) {
      const areaName =
        escapeHtml(
          getAreaName(properties)
        );

      const population =
        formatNumber(
          properties[this.valueField]
        );

      return `
        <div class="thematic-info">
          <strong>
            ${areaName}
          </strong>

          <div class="thematic-info-row">
            <span>農戶人口數</span>

            <strong>
              ${population}
              ${
                population !== "無資料"
                  ? " 人"
                  : ""
              }
            </strong>
          </div>
        </div>
      `;
    }
  },

  /* -------------------------------------------------------
     綜合所得總額中位數面圖層
  ------------------------------------------------------- */
  incomeMedian: {
    name: "綜合所得總額中位數",
    type: "polygon",

    // GeoJSON 檔案位置
    url: "data/Income.geojson",

    // QGIS 圖片中顯示的欄位名稱
    valueField:
      "final指標統計0717匯出-1_綜合所得總額中位數(千元)",

    // 預設是否顯示
    visible: false,

    // 預設透明度
    opacity: 0.65,

    layer: null,
    selectedFeatureLayer: null,

    // 每個圖層都要使用不同的 Pane 名稱
    paneName:
      "overlay-pane-income-median",

    // 圖層控制面板中的單色色塊
    symbolHtml:
      '<span class="layer-symbol income-median-symbol"></span>',

    // 依照 QGIS 圖例設定的五級分色
    classes: [
      {
        min: 363,
        max: 430,
        includeMax: true,
        color: "#f0f9e8",
        label: "363–430 千元"
      },
      {
        min: 430,
        includeMin: false,
        max: 500,
        includeMax: true,
        color: "#bae4bc",
        label: "430–500 千元"
      },
      {
        min: 500,
        includeMin: false,
        max: 600,
        includeMax: true,
        color: "#7bccc4",
        label: "500–600 千元"
      },
      {
        min: 600,
        includeMin: false,
        max: 850,
        includeMax: true,
        color: "#43a2ca",
        label: "600–850 千元"
      },
      {
        min: 850,
        includeMin: false,
        max: 1084,
        includeMax: true,
        color: "#0868ac",
        label: "850–1,084 千元"
      }
    ],

    // 滑鼠移入或點擊時顯示的資訊
    popup(properties) {
      const areaName =
        escapeHtml(
          getAreaName(properties)
        );

      const income =
        formatNumber(
          properties[this.valueField]
        );

      return `
        <div class="thematic-info">
          <strong>
            ${areaName}
          </strong>

          <div class="thematic-info-row">
            <span>
              綜合所得總額中位數
            </span>

            <strong>
              ${income}
              ${
                income !== "無資料"
                  ? " 千元"
                  : ""
              }
            </strong>
          </div>
        </div>
      `;
    }
  }
};


/* =========================================================
   5. 圖層順序
   陣列前方代表畫面上方，後方代表畫面下方
========================================================= */

let overlayOrder = [
  "mentalHealth",
  "collegeEducation",
  "agriculturalPopulation",
  "incomeMedian",
  "urbanicity"
];


/* =========================================================
   6. 建立可調整順序的 Pane
========================================================= */

// 所有圖層各有一個 Pane，之後只調整 Pane 的 z-index
Object.values(layerConfigs).forEach(config => {
  map.createPane(config.paneName);

  // Pane 不攔截滑鼠事件，由其中的 SVG 或 Marker 處理
  map.getPane(config.paneName).style.pointerEvents =
    "auto";
});

// 依照 overlayOrder 更新所有 Pane 的上下順序
function applyLayerOrder() {
  const baseZIndex = 400;
  const step = 20;
  const total = overlayOrder.length;

  overlayOrder.forEach((key, index) => {
    const config = layerConfigs[key];

    // 陣列越前方，z-index 越高
    const zIndex =
      baseZIndex + (total - index) * step;

    const pane = map.getPane(
      config.paneName
    );

    if (pane) {
      pane.style.zIndex = String(zIndex);
    }
  });

  // 同步更新面板順序及圖例順序
  renderOverlayLayerList();
  renderVisibleLegends();
}


/* =========================================================
   7. 建立自訂圖層控制面板
========================================================= */

const customLayerControl = L.control({
  position: "topleft"
});

customLayerControl.onAdd = function () {
  const container = L.DomUtil.create(
    "div",
    "custom-layer-control"
  );

  container.innerHTML = `
    <button
      type="button"
      id="layer-panel-button"
      class="layer-panel-button"
      title="開啟圖層控制"
      aria-label="開啟圖層控制"
      aria-expanded="false"
    >
      ≡
    </button>

    <div
      id="layer-panel-content"
      class="layer-panel-content"
      aria-hidden="true"
    >
      <div class="layer-control-header">
        <div class="layer-control-title">
          圖層控制
        </div>

        <button
          type="button"
          id="layer-panel-close"
          class="layer-panel-close"
          title="收起圖層控制"
          aria-label="收起圖層控制"
        >
          ×
        </button>
      </div>

      <div class="layer-control-section">
        <div class="layer-section-title">
          圖層
        </div>

        <div id="overlay-layer-list"></div>
      </div>

      <div class="layer-control-divider"></div>

      <div class="layer-control-section">
        <div class="layer-section-title">
          底圖
        </div>

        <label class="layer-control-item">
          <input
            type="radio"
            name="base-map"
            value="cartoVoyager"
            checked
          >
          <span>預設底圖</span>
        </label>

        <label class="layer-control-item">
          <input
            type="radio"
            name="base-map"
            value="cartoLight"
          >
          <span>簡潔淺色底圖</span>
        </label>

        <label class="layer-control-item">
          <input
            type="radio"
            name="base-map"
            value="osm"
          >
          <span>OpenStreetMap</span>
        </label>

        <label class="layer-control-item">
          <input
            type="radio"
            name="base-map"
            value="esriImagery"
          >
          <span>衛星影像底圖</span>
        </label>
      </div>
    </div>
  `;

  L.DomEvent.disableClickPropagation(
    container
  );

  L.DomEvent.disableScrollPropagation(
    container
  );

  return container;
};

customLayerControl.addTo(map);


/* =========================================================
   8. 開啟與關閉圖層控制面板
========================================================= */

const layerPanelButton =
  document.getElementById(
    "layer-panel-button"
  );

const layerPanelContent =
  document.getElementById(
    "layer-panel-content"
  );

const layerPanelClose =
  document.getElementById(
    "layer-panel-close"
  );

function openLayerPanel() {
  layerPanelContent.classList.add(
    "is-open"
  );

  layerPanelButton.classList.add(
    "is-hidden"
  );

  layerPanelButton.setAttribute(
    "aria-expanded",
    "true"
  );

  layerPanelContent.setAttribute(
    "aria-hidden",
    "false"
  );
}

function closeLayerPanel() {
  layerPanelContent.classList.remove(
    "is-open"
  );

  layerPanelButton.classList.remove(
    "is-hidden"
  );

  layerPanelButton.setAttribute(
    "aria-expanded",
    "false"
  );

  layerPanelContent.setAttribute(
    "aria-hidden",
    "true"
  );
}

layerPanelButton.addEventListener(
  "click",
  event => {
    event.stopPropagation();
    openLayerPanel();
  }
);

layerPanelClose.addEventListener(
  "click",
  event => {
    event.stopPropagation();
    closeLayerPanel();
  }
);

// 網頁載入時預設開啟圖層控制面板
openLayerPanel();

// 圖層控制面板不會因點擊地圖而自動收起。
// 使用者需按右上角的 × 按鈕關閉面板。


/* =========================================================
   9. 動態產生圖層清單
========================================================= */

function renderOverlayLayerList() {
  const listContainer =
    document.getElementById(
      "overlay-layer-list"
    );

  if (!listContainer) {
    return;
  }

  listContainer.innerHTML =
    overlayOrder
      .map((key, index) => {
        const config = layerConfigs[key];

        const checked =
          config.visible ? "checked" : "";

        const opacityPercent =
          Math.round(config.opacity * 100);

        const isTop =
          index === 0;

        const isBottom =
          index === overlayOrder.length - 1;

        return `
          <div
            class="overlay-layer-card"
            data-layer-key="${key}"
          >
            <div class="overlay-layer-main-row">
              <label class="overlay-layer-name">
                <input
                  type="checkbox"
                  class="overlay-visibility-checkbox"
                  data-layer-key="${key}"
                  ${checked}
                >

                ${config.symbolHtml}

                <span>${config.name}</span>
              </label>

              <div class="overlay-order-buttons">
                <button
                  type="button"
                  class="overlay-order-button move-layer-up"
                  data-layer-key="${key}"
                  title="往上一層"
                  aria-label="${config.name}往上一層"
                  ${isTop ? "disabled" : ""}
                >
                  ▲
                </button>

                <button
                  type="button"
                  class="overlay-order-button move-layer-down"
                  data-layer-key="${key}"
                  title="往下一層"
                  aria-label="${config.name}往下一層"
                  ${isBottom ? "disabled" : ""}
                >
                  ▼
                </button>
              </div>
            </div>

            <div class="overlay-opacity-row">
              <span>透明度</span>

              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value="${config.opacity}"
                class="overlay-opacity-slider"
                data-layer-key="${key}"
                aria-label="${config.name}透明度"
              >

              <strong
                class="overlay-opacity-value"
                id="opacity-value-${key}"
              >
                ${opacityPercent}%
              </strong>
            </div>
          </div>
        `;
      })
      .join("");

  bindOverlayControlEvents();
}


/* =========================================================
   10. 綁定圖層面板按鈕事件
========================================================= */

function bindOverlayControlEvents() {
  // 顯示／隱藏圖層
  document
    .querySelectorAll(
      ".overlay-visibility-checkbox"
    )
    .forEach(checkbox => {
      checkbox.addEventListener(
        "change",
        function () {
          const key =
            this.dataset.layerKey;

          setLayerVisibility(
            key,
            this.checked
          );
        }
      );
    });

  // 調整每一層自己的透明度
  document
    .querySelectorAll(
      ".overlay-opacity-slider"
    )
    .forEach(slider => {
      slider.addEventListener(
        "input",
        function () {
          const key =
            this.dataset.layerKey;

          const opacity =
            Number(this.value);

          setLayerOpacity(
            key,
            opacity
          );

          const valueElement =
            document.getElementById(
              `opacity-value-${key}`
            );

          if (valueElement) {
            valueElement.textContent =
              `${Math.round(
                opacity * 100
              )}%`;
          }
        }
      );
    });

  // 往上一層
  document
    .querySelectorAll(
      ".move-layer-up"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        function () {
          moveLayer(
            this.dataset.layerKey,
            -1
          );
        }
      );
    });

  // 往下一層
  document
    .querySelectorAll(
      ".move-layer-down"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        function () {
          moveLayer(
            this.dataset.layerKey,
            1
          );
        }
      );
    });
}


/* =========================================================
   11. 顯示、隱藏與透明度控制
========================================================= */

// 顯示或隱藏指定圖層
function setLayerVisibility(
  key,
  visible
) {
  const config = layerConfigs[key];

  if (!config) {
    return;
  }

  config.visible = visible;

  // 圖層尚未載入時只記錄狀態
  if (!config.layer) {
    renderVisibleLegends();
    return;
  }

  if (visible) {
    if (!map.hasLayer(config.layer)) {
      map.addLayer(config.layer);
    }
  } else {
    if (map.hasLayer(config.layer)) {
      map.removeLayer(config.layer);
    }

    // 關閉面圖層時取消行政區選取
    if (
      config.type === "polygon"
    ) {
      clearPolygonSelection(config);
    }
  }

  applyLayerOrder();
}

// 設定指定圖層透明度
function setLayerOpacity(
  key,
  opacity
) {
  const config = layerConfigs[key];

  if (!config) {
    return;
  }

  config.opacity = opacity;

  if (!config.layer) {
    return;
  }

  if (config.type === "polygon") {
    // 面圖層同時更新填色透明度
    config.layer.setStyle({
      fillOpacity: opacity
    });

    // 被選取的行政區維持較深效果
    if (config.selectedFeatureLayer) {
      config.selectedFeatureLayer
        .setStyle({
          color: "#111111",
          weight: 3,
          fillOpacity: Math.min(
            opacity + 0.2,
            1
          )
        });
    }
  }

  if (config.type === "point") {
    // 更新一般點位
    config.layer.eachLayer(layer => {
      if (
        typeof layer.setStyle ===
        "function"
      ) {
        layer.setStyle({
          opacity,
          fillOpacity: opacity
        });
      }
    });

    // 更新 MarkerCluster 群聚圖示
    const pane =
      map.getPane(config.paneName);

    if (pane) {
      pane.style.opacity =
        String(opacity);
    }
  }
}


/* =========================================================
   12. 圖層上下移動
========================================================= */

function moveLayer(
  key,
  direction
) {
  const currentIndex =
    overlayOrder.indexOf(key);

  if (currentIndex === -1) {
    return;
  }

  const targetIndex =
    currentIndex + direction;

  if (
    targetIndex < 0 ||
    targetIndex >=
      overlayOrder.length
  ) {
    return;
  }

  // 交換陣列位置
  [
    overlayOrder[currentIndex],
    overlayOrder[targetIndex]
  ] = [
    overlayOrder[targetIndex],
    overlayOrder[currentIndex]
  ];

  applyLayerOrder();
}


/* =========================================================
   13. 底圖切換
========================================================= */

document
  .querySelectorAll(
    'input[name="base-map"]'
  )
  .forEach(radio => {
    radio.addEventListener(
      "change",
      function () {
        if (!this.checked) {
          return;
        }

        // 移除目前所有底圖
        Object.values(
          baseLayerList
        ).forEach(baseLayer => {
          if (
            map.hasLayer(baseLayer)
          ) {
            map.removeLayer(
              baseLayer
            );
          }
        });

        // 加入選取的底圖
        const selectedBaseLayer =
          baseLayerList[this.value];

        if (selectedBaseLayer) {
          selectedBaseLayer.addTo(map);
        }

        // 重新套用圖層順序
        applyLayerOrder();
      }
    );
  });


/* =========================================================
   14. 共用面圖層互動
========================================================= */

// 清除某個面圖層目前被選取的行政區
function clearPolygonSelection(config) {
  const selectedLayer =
    config.selectedFeatureLayer;

  if (
    !selectedLayer ||
    !config.layer
  ) {
    config.selectedFeatureLayer =
      null;
    return;
  }

  config.layer.resetStyle(
    selectedLayer
  );

  selectedLayer.setStyle({
    fillOpacity:
      config.opacity
  });

  config.selectedFeatureLayer =
    null;
}

// 建立面圖層的互動事件
function bindPolygonFeatureEvents(
  config,
  layer,
  popupContent
) {
  // 滑鼠經過時顯示資訊
  layer.bindTooltip(
    popupContent,
    {
      sticky: true,
      direction: "top",
      opacity: 0.95
    }
  );

  // 點擊後固定顯示資訊
  layer.bindPopup(
    popupContent,
    {
      closeButton: true,
      autoClose: true,
      closeOnClick: false
    }
  );

  // 若同圖層已有其他行政區被固定，
  // 阻止其他行政區顯示 Tooltip
  layer.on(
    "tooltipopen",
    function () {
      if (
        config.selectedFeatureLayer &&
        config.selectedFeatureLayer !==
          layer
      ) {
        layer.closeTooltip();
      }
    }
  );

  // 滑鼠移入行政區
  layer.on(
    "mouseover",
    function (event) {
      if (
        config.selectedFeatureLayer &&
        config.selectedFeatureLayer !==
          layer
      ) {
        layer.closeTooltip();
        return;
      }

      event.target.setStyle({
        color: "#222222",
        weight: 2.5,
        fillOpacity: Math.min(
          config.opacity + 0.15,
          1
        )
      });

      event.target.bringToFront();
    }
  );

  // 滑鼠移出行政區
  layer.on(
    "mouseout",
    function (event) {
      if (
        config.selectedFeatureLayer ===
        layer
      ) {
        return;
      }

      config.layer.resetStyle(
        event.target
      );

      event.target.setStyle({
        fillOpacity:
          config.opacity
      });
    }
  );

  // 點擊行政區
  layer.on(
    "click",
    function () {
      // 關閉同圖層所有 Tooltip
      config.layer.eachLayer(
        otherLayer => {
          otherLayer.closeTooltip();
        }
      );

      // 恢復同圖層前一個選取區域
      if (
        config.selectedFeatureLayer &&
        config.selectedFeatureLayer !==
          layer
      ) {
        config.layer.resetStyle(
          config.selectedFeatureLayer
        );

        config.selectedFeatureLayer
          .setStyle({
            fillOpacity:
              config.opacity
          });
      }

      config.selectedFeatureLayer =
        layer;

      layer.setStyle({
        color: "#111111",
        weight: 3,
        fillOpacity: Math.min(
          config.opacity + 0.2,
          1
        )
      });

      layer.bringToFront();
    }
  );

  // 關閉 Popup 時取消選取
  layer.on(
    "popupclose",
    function () {
      if (
        config.selectedFeatureLayer !==
        layer
      ) {
        return;
      }

      config.layer.resetStyle(
        layer
      );

      layer.setStyle({
        fillOpacity:
          config.opacity
      });

      config.selectedFeatureLayer =
        null;
    }
  );
}


/* =========================================================
   15. 載入面圖層
========================================================= */

async function loadPolygonLayer(
  key
) {
  const config = layerConfigs[key];

  try {
    const response = await fetch(
      config.url
    );

    if (!response.ok) {
      throw new Error(
        `HTTP error：${response.status}`
      );
    }

    const data =
      await response.json();

    console.log(
      `${config.name}資料：`,
      data
    );

    // 在 Console 顯示實際欄位，
    // 方便確認 valueField 是否正確
    if (
      data.features &&
      data.features.length > 0
    ) {
      console.log(
        `${config.name}欄位：`,
        Object.keys(
          data.features[0]
            .properties || {}
        )
      );
    }

    config.layer = L.geoJSON(
      data,
      {
        pane: config.paneName,

        style(feature) {
          const properties =
            feature.properties || {};

          const value =
            properties[
              config.valueField
            ];

          return {
            pane: config.paneName,
            color: "#666666",
            weight: 0.8,
            opacity: 1,
            fillColor:
              getClassColor(
                value,
                config.classes
              ),
            fillOpacity:
              config.opacity
          };
        },

        onEachFeature(
          feature,
          layer
        ) {
          const properties =
            feature.properties || {};

          const popupContent =
            config.popup.call(
              config,
              properties
            );

          bindPolygonFeatureEvents(
            config,
            layer,
            popupContent
          );
        }
      }
    );

    // 根據設定決定是否顯示
    if (config.visible) {
      config.layer.addTo(map);
    }

    applyLayerOrder();
  } catch (error) {
    console.error(
      `${config.name}圖層載入失敗：`,
      error
    );
  }
}


/* =========================================================
   16. 載入社區心理衛生中心
========================================================= */

let selectedMentalHealthLayer =
  null;

async function loadMentalHealthLayer() {
  const config =
    layerConfigs.mentalHealth;

  try {
    const response =
      await fetch(config.url);

    if (!response.ok) {
      throw new Error(
        `讀取失敗：${response.status}`
      );
    }

    const data =
      await response.json();

    // 建立 MarkerCluster 圖層
    const cluster =
      L.markerClusterGroup({
        chunkedLoading: true,
        disableClusteringAtZoom: 15,
        clusterPane:
          config.paneName
      });

    // 建立心理衛生中心點位
    const geoJsonLayer =
      L.geoJSON(data, {
        pane: config.paneName,

        pointToLayer(
          feature,
          latlng
        ) {
          return L.circleMarker(
            latlng,
            {
              pane:
                config.paneName,

              className:
                "mental-health-marker",

              radius: 7,
              color: "#ffffff",
              fillColor: "#a03641",
              weight: 2.5,
              opacity:
                config.opacity,
              fillOpacity:
                config.opacity
            }
          );
        },

         onEachFeature: function (feature, layer) {
          const p = feature.properties || {};

          const centerName =
            p["Column1.title"] ||
            "未提供機構名稱";

          const address =
            p["Column1.address"] ||
            "未提供地址";

          const phone =
            p["Column1.tel"] ||
            "未提供電話";

          const serviceTime =
            p["Column1.time_info"] ||
            "未提供服務時間";

          const organizationType =
            p["Column1.tag_type"] ||
            "未提供機構類型";


          // Google Maps 風格資訊卡
          const popupContent = `
            <div class="mental-health-popup-card">

              <div class="popup-card-header">
              

                <div class="popup-card-title">
                  <span class="popup-card-category">
                    心理衛生資源
                  </span>

                  <strong>
                    ${centerName}
                  </strong>
                </div>
              </div>

              <div class="popup-card-body">

                <div class="popup-info-row">
                  <span class="popup-info-icon">
                    ●
                  </span>

                  <div>
                    <span class="popup-info-label">
                      機構類型
                    </span>

                    <span class="popup-info-value">
                      ${organizationType}
                    </span>
                  </div>
                </div>

                <div class="popup-info-row">
                  <span class="popup-info-icon">
                    📍
                  </span>

                  <div>
                    <span class="popup-info-label">
                      地址
                    </span>

                    <span class="popup-info-value">
                      ${address}
                    </span>
                  </div>
                </div>

                <div class="popup-info-row">
                  <span class="popup-info-icon">
                    ☎
                  </span>

                  <div>
                    <span class="popup-info-label">
                      電話
                    </span>

                    <span class="popup-info-value">
                      ${phone}
                    </span>
                  </div>
                </div>

                <div class="popup-info-row">
                  <span class="popup-info-icon">
                    ◷
                  </span>

                  <div>
                    <span class="popup-info-label">
                      服務時間
                    </span>

                    <span class="popup-info-value">
                      ${serviceTime}
                    </span>
                  </div>
                </div>

              </div>

              <a
                class="popup-navigation-button"
                href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                  address
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                在 Google Maps 中查看
              </a>
            </div>
          `;

          layer.bindPopup(
            popupContent,
            {
              className:
                "modern-mental-health-popup",
              maxWidth: 330,
              minWidth: 270,
              closeButton: true,
              
              // 開啟資訊卡時自動移動地圖
              autoPan: true,
              // 左側與上方保留空間
              // 第二個數值是上方標題列的安全距離
              autoPanPaddingTopLeft:
                [30, 115],
              // 右側與下方保留空間
              autoPanPaddingBottomRight:
                [30, 30]
            }
          );

          // 滑鼠移入時放大
          layer.on(
            "mouseover",
            function () {
              const element =
                layer.getElement();

              if (element) {
                element.classList.add(
                  "mental-health-marker-hover"
                );
              }

              layer.bringToFront();
            }
          );

          // 滑鼠移出時恢復
          layer.on(
            "mouseout",
            function () {
              const element =
                layer.getElement();

              if (element) {
                element.classList.remove(
                  "mental-health-marker-hover"
                );
              }
            }
          );

          // 點擊時加入選取光暈
          layer.on(
            "click",
            function () {
              if (
                selectedMentalHealthLayer &&
                selectedMentalHealthLayer !==
                  layer
              ) {
                const previousElement =
                  selectedMentalHealthLayer
                    .getElement();

                if (previousElement) {
                  previousElement
                    .classList.remove(
                      "mental-health-marker-selected"
                    );
                }
              }

              selectedMentalHealthLayer =
                layer;

              const element =
                layer.getElement();

              if (element) {
                element.classList.add(
                  "mental-health-marker-selected"
                );
              }

              layer.bringToFront();
            }
          );

          // Popup 關閉時取消選取
          layer.on(
            "popupclose",
            function () {
              const element =
                layer.getElement();

              if (element) {
                element.classList.remove(
                  "mental-health-marker-selected"
                );
              }

              if (
                selectedMentalHealthLayer ===
                layer
              ) {
                selectedMentalHealthLayer =
                  null;
              }
            }
          );
        }
      });

    cluster.addLayer(
      geoJsonLayer
    );

    config.layer = cluster;

    if (config.visible) {
      cluster.addTo(map);
    }

    // 設定點圖層透明度
    setLayerOpacity(
      "mentalHealth",
      config.opacity
    );

    applyLayerOrder();
  } catch (error) {
    console.error(
      "社區心理衛生中心圖層載入失敗：",
      error
    );
  }
}


/* =========================================================
   17. 多圖層共用圖例面板
========================================================= */

const legendControl = L.control({
  position: "bottomright"
});

legendControl.onAdd = function () {
  const container =
    L.DomUtil.create(
      "div",
      "legend multi-layer-legend"
    );

  container.id =
    "multi-layer-legend";

  L.DomEvent
    .disableClickPropagation(
      container
    );

  L.DomEvent
    .disableScrollPropagation(
      container
    );

  return container;
};

legendControl.addTo(map);

// 更新所有目前可見圖層的圖例
function renderVisibleLegends() {
  const legendContainer =
    document.getElementById(
      "multi-layer-legend"
    );

  if (!legendContainer) {
    return;
  }

  const visibleKeys =
    overlayOrder.filter(key => {
      const config =
        layerConfigs[key];

      return (
        config.visible &&
        (
          config.classes ||
          config.legendItems
        )
      );
    });

  // 沒有任何可顯示圖例時隱藏
  if (
    visibleKeys.length === 0
  ) {
    legendContainer.innerHTML =
      "";

    legendContainer.style.display =
      "none";

    return;
  }

  legendContainer.style.display =
    "block";

  legendContainer.innerHTML =
    visibleKeys
      .map(key => {
        const config =
          layerConfigs[key];

        const items =
          config.classes ||
          config.legendItems ||
          [];

        const itemHtml =
          items
            .map(item => {
              const shapeClass =
                item.shape === "circle"
                  ? "legend-circle"
                  : "";

              return `
                <div class="legend-item">
                  <i
                    class="${shapeClass}"
                    style="background:${item.color}"
                  ></i>

                  <span>
                    ${item.label}
                  </span>
                </div>
              `;
            })
            .join("");

        return `
          <section class="legend-layer-section">
            <h4>${config.name}</h4>
            ${itemHtml}
          </section>
        `;
      })
      .join("");
}


/* =========================================================
   18. 載入所有圖層
========================================================= */

// 先建立控制介面
renderOverlayLayerList();

// 套用初始上下順序
applyLayerOrder();

// 載入點圖層
loadMentalHealthLayer();

// 載入所有面圖層
Object.keys(layerConfigs)
  .filter(
    key =>
      layerConfigs[key].type ===
      "polygon"
  )
  .forEach(key => {
    loadPolygonLayer(key);
  });

