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
  position: "bottomright",
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

// 取得縣市名稱
function getCountyName(properties = {}) {
  return (
    properties.COUNTYNAME ||
    properties.COUNTY_NAM ||
    properties.COUNTY ||
    properties.countyname ||
    properties.county ||
    properties.NAME ||
    "未提供縣市名稱"
  );
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
   面量圖層共用排名設定
========================================================= */

// 取得面量圖層的排名設定
function getPolygonRankingSettings(
  config
) {
  // 只有 polygon 類型支援排名
  if (
    !config ||
    config.type !== "polygon"
  ) {
    return null;
  }

  // 個別圖層可用 ranking: false 關閉排名
  if (
    config.ranking === false ||
    config.ranking?.enabled === false
  ) {
    return null;
  }

  const customRanking =
    config.ranking || {};

  return {
    // 預設使用圖層的 valueField 排名
    field:
      customRanking.field ||
      config.valueField,

    // 預設顯示前十名
    limit:
      Number.isFinite(
        customRanking.limit
      )
        ? customRanking.limit
        : 10,

    // 預設由高到低
    order:
      customRanking.order === "asc"
        ? "asc"
        : "desc",

    // 未設定標題時自動使用圖層名稱
    title:
      customRanking.title ||
      `${config.name}前十名`,

    // 未設定格式時，使用一般數值格式
    formatValue:
      typeof customRanking
        .formatValue === "function"
        ? customRanking.formatValue
        : value =>
            formatNumber(value)
  };
}

/* =========================================================
   可拖曳、可收合的面量圖層排名視窗
========================================================= */

// 最近開啟或目前顯示排名的面量圖層
let activeRankingLayerKey =
  null;

// 直接把排名視窗放進地圖容器
const rankingPanel =
  document.createElement(
    "section"
  );

rankingPanel.id =
  "ranking-panel";

rankingPanel.className =
  "ranking-panel";

rankingPanel.hidden =
  true;

rankingPanel.innerHTML = `
  <div
    id="ranking-panel-drag-handle"
    class="ranking-panel-header"
  >
    <div class="ranking-panel-title-group">
      <span
        id="ranking-panel-label"
        class="ranking-panel-label"
      >
        TOP 10
      </span>

      <strong
        id="ranking-panel-title"
        class="ranking-panel-title"
      >
        面量圖層排名
      </strong>
    </div>

    <button
      type="button"
      id="ranking-panel-toggle"
      class="ranking-panel-toggle"
      title="收合排名視窗"
      aria-label="收合排名視窗"
      aria-expanded="true"
    >
      −
    </button>
  </div>

  <div
    id="ranking-panel-body"
    class="ranking-panel-body"
  ></div>
`;

// 放進 Leaflet 地圖容器
map
  .getContainer()
  .appendChild(
    rankingPanel
  );

// 操作排名視窗時不要拖動或縮放地圖
L.DomEvent
  .disableClickPropagation(
    rankingPanel
  );

L.DomEvent
  .disableScrollPropagation(
    rankingPanel
  );

/* =========================================================
   排名視窗拖曳控制
========================================================= */

const rankingPanelDragHandle =
  document.getElementById(
    "ranking-panel-drag-handle"
  );

const rankingPanelToggle =
  document.getElementById(
    "ranking-panel-toggle"
  );

// 拖曳時，上方標題額外保留的距離
const rankingPanelHeaderGap =
  10;

// 找出上方固定標題列
function getMapHeaderElement() {
  return document.querySelector(
    [
      ".site-header",
      ".map-header",
      ".page-header",
      "header"
    ].join(",")
  );
}

// 計算排名視窗可以移動的範圍
function getRankingPanelLimits() {
  const mapContainer =
    map.getContainer();

  const mapRectangle =
    mapContainer
      .getBoundingClientRect();

  const headerElement =
    getMapHeaderElement();

  let safeTop =
    10;

  if (headerElement) {
    const headerRectangle =
      headerElement
        .getBoundingClientRect();

    // 將標題底部的座標轉換成地圖內部座標
    safeTop =
      headerRectangle.bottom -
      mapRectangle.top +
      rankingPanelHeaderGap;
  } else {
    // 找不到標題元素時，
    // 使用原本 Popup 的安全距離
    safeTop =
      115;
  }

  const panelWidth =
    rankingPanel.offsetWidth ||
    285;

  const panelHeight =
    rankingPanel.offsetHeight ||
    55;

  return {
    minLeft: 10,

    maxLeft: Math.max(
      10,
      mapRectangle.width -
        panelWidth -
        10
    ),

    minTop: Math.max(
      10,
      safeTop
    ),

    maxTop: Math.max(
      safeTop,
      mapRectangle.height -
        panelHeight -
        10
    )
  };
}

// 將視窗移動到合法範圍內
function setRankingPanelPosition(
  left,
  top
) {
  const limits =
    getRankingPanelLimits();

  const safeLeft =
    Math.min(
      Math.max(
        left,
        limits.minLeft
      ),
      limits.maxLeft
    );

  const safeTop =
    Math.min(
      Math.max(
        top,
        limits.minTop
      ),
      limits.maxTop
    );

  rankingPanel.style.left =
    `${safeLeft}px`;

  rankingPanel.style.top =
    `${safeTop}px`;

  rankingPanel.style.right =
    "auto";

  rankingPanel.style.bottom =
    "auto";
}

// 確保目前位置仍在合法範圍內
function clampRankingPanelPosition() {
  if (
    rankingPanel.hidden
  ) {
    return;
  }

  const currentLeft =
    parseFloat(
      rankingPanel.style.left
    );

  const currentTop =
    parseFloat(
      rankingPanel.style.top
    );

  const limits =
    getRankingPanelLimits();

  setRankingPanelPosition(
    Number.isFinite(
      currentLeft
    )
      ? currentLeft
      : limits.minLeft,

    Number.isFinite(
      currentTop
    )
      ? currentTop
      : limits.maxTop
  );
}

// 預設排列在圖層管理面板右側
function placeRankingPanelInitially() {
  // 使用者已經移動過排名視窗，
  // 之後只檢查是否仍在合法範圍
  if (
    rankingPanel.dataset
      .positioned === "true"
  ) {
    clampRankingPanelPosition();
    return;
  }

  const mapContainer =
    map.getContainer();

  const mapRectangle =
    mapContainer
      .getBoundingClientRect();

  // 優先取得已開啟的圖層管理面板
  const layerPanel =
    document.querySelector(
      "#layer-panel-content.is-open"
    ) ||
    document.getElementById(
      "layer-panel-content"
    ) ||
    document.querySelector(
      ".custom-layer-control"
    );

  const limits =
    getRankingPanelLimits();

  // 兩個視窗之間的距離
  const panelGap =
    12;

  let rankingLeft =
    limits.minLeft;

  let rankingTop =
    limits.minTop;

  if (layerPanel) {
    const layerPanelRectangle =
      layerPanel
        .getBoundingClientRect();

    const rankingPanelWidth =
      rankingPanel.offsetWidth ||
      285;

    // 排名視窗放在圖層管理視窗右側
    rankingLeft =
      layerPanelRectangle.right -
      mapRectangle.left +
      panelGap;

    // 兩個視窗頂端對齊
    rankingTop =
      layerPanelRectangle.top -
      mapRectangle.top;
  }

  setRankingPanelPosition(
    rankingLeft,
    rankingTop
  );

  rankingPanel.dataset
    .positioned =
    "true";
}

let rankingPanelDragging =
  false;

let rankingPanelPointerStartX =
  0;

let rankingPanelPointerStartY =
  0;

let rankingPanelStartLeft =
  0;

let rankingPanelStartTop =
  0;

rankingPanelDragHandle
  .addEventListener(
    "pointerdown",
    event => {
      // 點到收合按鈕時不要啟動拖曳
      if (
        event.target.closest(
          ".ranking-panel-toggle"
        )
      ) {
        return;
      }

      // 滑鼠只允許左鍵拖曳
      if (
        event.pointerType ===
          "mouse" &&
        event.button !== 0
      ) {
        return;
      }

      rankingPanelDragging =
        true;

      rankingPanelPointerStartX =
        event.clientX;

      rankingPanelPointerStartY =
        event.clientY;

      rankingPanelStartLeft =
        parseFloat(
          rankingPanel.style.left
        ) || 0;

      rankingPanelStartTop =
        parseFloat(
          rankingPanel.style.top
        ) || 0;

      rankingPanel.classList.add(
        "is-dragging"
      );

      rankingPanelDragHandle
        .setPointerCapture(
          event.pointerId
        );

      event.preventDefault();
    }
  );

rankingPanelDragHandle
  .addEventListener(
    "pointermove",
    event => {
      if (
        !rankingPanelDragging
      ) {
        return;
      }

      const moveX =
        event.clientX -
        rankingPanelPointerStartX;

      const moveY =
        event.clientY -
        rankingPanelPointerStartY;

      setRankingPanelPosition(
        rankingPanelStartLeft +
          moveX,

        rankingPanelStartTop +
          moveY
      );
    }
  );

function stopRankingPanelDragging(
  event
) {
  if (
    !rankingPanelDragging
  ) {
    return;
  }

  rankingPanelDragging =
    false;

  rankingPanel.classList.remove(
    "is-dragging"
  );

  if (
    rankingPanelDragHandle
      .hasPointerCapture(
        event.pointerId
      )
  ) {
    rankingPanelDragHandle
      .releasePointerCapture(
        event.pointerId
      );
  }
}

rankingPanelDragHandle
  .addEventListener(
    "pointerup",
    stopRankingPanelDragging
  );

rankingPanelDragHandle
  .addEventListener(
    "pointercancel",
    stopRankingPanelDragging
  );

  /* =========================================================
   排名視窗收合控制
========================================================= */

rankingPanelToggle
  .addEventListener(
    "click",
    event => {
      event.stopPropagation();

      const isCollapsed =
        rankingPanel
          .classList
          .toggle(
            "is-collapsed"
          );

      rankingPanelToggle
        .textContent =
        isCollapsed
          ? "+"
          : "−";

      rankingPanelToggle
        .setAttribute(
          "aria-expanded",
          String(
            !isCollapsed
          )
        );

      rankingPanelToggle
        .setAttribute(
          "title",
          isCollapsed
            ? "展開排名視窗"
            : "收合排名視窗"
        );

      rankingPanelToggle
        .setAttribute(
          "aria-label",
          isCollapsed
            ? "展開排名視窗"
            : "收合排名視窗"
        );

      // 收合後高度會改變，
      // 重新限制在地圖範圍中
      window.requestAnimationFrame(
        clampRankingPanelPosition
      );
    }
  );

// 瀏覽器尺寸改變時重新限制位置
window.addEventListener(
  "resize",
  clampRankingPanelPosition
);

// Leaflet 地圖尺寸改變時重新限制位置
map.on(
  "resize",
  clampRankingPanelPosition
);

/* =========================================================
   共用排名資料與地圖連動
========================================================= */

// 找出目前應顯示排名的圖層
function getCurrentRankingLayerKey() {
  const activeConfig =
    layerConfigs[
      activeRankingLayerKey
    ];

  // 優先顯示最近開啟的面量圖層
  if (
    activeConfig &&
    activeConfig.visible &&
    activeConfig.layer &&
    getPolygonRankingSettings(
      activeConfig
    )
  ) {
    return activeRankingLayerKey;
  }

  // 最近開啟的圖層已關閉時，
  // 尋找其他目前開啟的面量圖層
  return (
    overlayOrder.find(key => {
      const config =
        layerConfigs[key];

      return (
        config &&
        config.visible &&
        config.layer &&
        getPolygonRankingSettings(
          config
        )
      );
    }) || null
  );
}


// 點擊排名項目後移動到行政區
function focusRankingFeature(
  config,
  featureLayer
) {
  if (
    !config ||
    !featureLayer
  ) {
    return;
  }

  const bounds =
    typeof featureLayer.getBounds ===
      "function"
      ? featureLayer.getBounds()
      : null;

  let featureOpened =
    false;

  function openFeature() {
    // 避免 moveend 與備援計時器重複執行
    if (featureOpened) {
      return;
    }

    featureOpened =
      true;

    // 觸發原本行政區點擊效果
    featureLayer.fire(
      "click"
    );

    // 開啟原本綁定的 Popup
    featureLayer.openPopup();
  }

  if (
    bounds &&
    bounds.isValid()
  ) {
    // 地圖移動完成後開啟資訊視窗
    map.once(
      "moveend",
      openFeature
    );

    map.fitBounds(
      bounds,
      {
        // 避開上方固定標題列
        paddingTopLeft:
          [40, 125],

        paddingBottomRight:
          [40, 40],

        // 避免放得過近
        maxZoom: 13,

        animate: true
      }
    );

    // 當地圖位置變化太小，
    // moveend 沒有觸發時的備援
    window.setTimeout(
      openFeature,
      500
    );

    return;
  }

  openFeature();
}


// 建立指定圖層的排名資料
function getPolygonRankingRows(
  config
) {
  const rankingSettings =
    getPolygonRankingSettings(
      config
    );

  if (
    !rankingSettings ||
    !config.layer
  ) {
    return [];
  }

  const rankingRows =
    [];

  config.layer.eachLayer(
    featureLayer => {
      const properties =
        featureLayer.feature
          ?.properties || {};

      const value =
        toFiniteNumber(
          properties[
            rankingSettings.field
          ]
        );

      // 排除空值和非數值資料
      if (value === null) {
        return;
      }

      rankingRows.push({
        featureLayer,

        areaName:
          getAreaName(
            properties
          ),

        value
      });
    }
  );

  rankingRows.sort(
    (first, second) => {
      if (
        rankingSettings.order ===
        "asc"
      ) {
        return (
          first.value -
          second.value
        );
      }

      return (
        second.value -
        first.value
      );
    }
  );

  return rankingRows.slice(
    0,
    rankingSettings.limit
  );
}


// 產生排名視窗內容
function renderRankingPanel(key) {
  const panel =
    document.getElementById(
      "ranking-panel"
    );

  const panelLabel =
    document.getElementById(
      "ranking-panel-label"
    );

  const panelTitle =
    document.getElementById(
      "ranking-panel-title"
    );

  const panelBody =
    document.getElementById(
      "ranking-panel-body"
    );

  const config =
    layerConfigs[key];

  const rankingSettings =
    getPolygonRankingSettings(
      config
    );

  if (
    !panel ||
    !panelLabel ||
    !panelTitle ||
    !panelBody ||
    !config ||
    !config.layer ||
    !config.visible ||
    !rankingSettings
  ) {
    return;
  }

  const rankingRows =
    getPolygonRankingRows(
      config
    );

  panel.hidden =
    false;

  panelLabel.textContent =
    `TOP ${rankingSettings.limit}`;

  panelTitle.textContent =
    rankingSettings.title;

  if (
    rankingRows.length === 0
  ) {
    panelBody.innerHTML = `
      <div class="ranking-empty-message">
        沒有可供排名的資料
      </div>
    `;

    window.requestAnimationFrame(
      placeRankingPanelInitially
    );

    return;
  }

  const rankingItemsHtml =
    rankingRows
      .map(
        (item, index) => {
          const formattedValue =
            rankingSettings
              .formatValue(
                item.value
              );

          return `
            <li class="ranking-list-item">
              <button
                type="button"
                class="ranking-item-button"
                data-ranking-index="${index}"
                title="前往 ${escapeHtml(
                  item.areaName
                )}"
              >
                <span class="ranking-number">
                  ${index + 1}
                </span>

                <span class="ranking-area-name">
                  ${escapeHtml(
                    item.areaName
                  )}
                </span>

                <strong class="ranking-value">
                  ${escapeHtml(
                    formattedValue
                  )}
                </strong>
              </button>
            </li>
          `;
        }
      )
      .join("");

  panelBody.innerHTML = `
    <ol class="ranking-list">
      ${rankingItemsHtml}
    </ol>
  `;

  panelBody
    .querySelectorAll(
      ".ranking-item-button"
    )
    .forEach(button => {
      button.addEventListener(
        "click",
        function () {
          const rankingIndex =
            Number(
              this.dataset
                .rankingIndex
            );

          const rankingItem =
            rankingRows[
              rankingIndex
            ];

          if (!rankingItem) {
            return;
          }

          focusRankingFeature(
            config,
            rankingItem
              .featureLayer
          );
        }
      );
    });

  window.requestAnimationFrame(
    placeRankingPanelInitially
  );
}


// 更新排名視窗
function refreshRankingPanel() {
  const panel =
    document.getElementById(
      "ranking-panel"
    );

  if (!panel) {
    return;
  }

  const rankingLayerKey =
    getCurrentRankingLayerKey();

  // 沒有可顯示排名的面量圖層
  if (!rankingLayerKey) {
    activeRankingLayerKey =
      null;

    panel.hidden =
      true;

    return;
  }

  activeRankingLayerKey =
    rankingLayerKey;

  renderRankingPanel(
    rankingLayerKey
  );
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

    ranking: {
      title: "城鄉階層排名前十名",

      // Rank 數字越小，排名越前面
      order: "asc",

      formatValue(value) {
        return `第 ${formatNumber(value)} 名`;
      }
    },
      
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

    ranking: {
      title: "大專以上人口比例前十名",

      formatValue(value) {
        return formatPercent(value);
      }
    },
      
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

    ranking: {
      title: "農戶人口數前十名",

      formatValue(value) {
        return `${formatNumber(value)} 人`;
      }
    },

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

    ranking: {
      title: "綜合所得總額中位數前十名",

      formatValue(value) {
        return `${formatNumber(value)} 千元`;
      }
    },

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
  },

   /* -------------------------------------------------------
     縣市界基本圖層
  ------------------------------------------------------- */
  countyBoundary: {
    name: "縣市界",
    type: "boundary",

    // GeoJSON 檔案位置
    url: "data/county.geojson",

    // 預設顯示
    visible: true,

    // 縣市框線及文字透明度
    opacity: 0.9,

    layer: null,
    boundaryLayer: null,
    labelLayer: null,

    // 縣市界線 Pane
    paneName:
      "overlay-pane-county-boundary",

    // 縣市名稱 Pane
    labelPaneName:
      "overlay-pane-county-label",

    // 圖層面板中的透明方框符號
    symbolHtml:
      '<span class="layer-symbol county-boundary-symbol"></span>'
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
  "urbanicity",
  "countyBoundary"
];


/* =========================================================
   6. 建立可調整順序的 Pane
========================================================= */

Object.values(layerConfigs).forEach(config => {
  // 建立圖層本身的 Pane
  if (!map.getPane(config.paneName)) {
    map.createPane(config.paneName);
  }

  map.getPane(
    config.paneName
  ).style.pointerEvents =
    "auto";

  // 部分圖層另有文字標籤 Pane
  if (config.labelPaneName) {
    if (
      !map.getPane(
        config.labelPaneName
      )
    ) {
      map.createPane(
        config.labelPaneName
      );
    }

    const labelPane =
      map.getPane(
        config.labelPaneName
      );

    // 文字放在主題面圖層上方，
    // 但仍低於 Tooltip 和 Popup
    labelPane.style.zIndex =
      "625";

    // 縣市名稱不攔截滑鼠
    labelPane.style.pointerEvents =
      "none";
  }
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

  // 同步更新圖層面板、圖例及排名
  renderOverlayLayerList();
  renderVisibleLegends();
  refreshRankingPanel();
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

  // 開啟面量圖層時，
  // 將排名切換至最新開啟的圖層
  if (
    config.type === "polygon" &&
    getPolygonRankingSettings(
      config
    )
  ) {
    if (visible) {
      activeRankingLayerKey =
        key;
    } else if (
      activeRankingLayerKey ===
      key
    ) {
      activeRankingLayerKey =
        null;
    }
  }

  // 圖層尚未載入時只記錄狀態
  if (!config.layer) {
    renderVisibleLegends();
    refreshRankingPanel();
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

    if (
    config.type === "boundary"
  ) {
    // 調整縣市框線透明度
    if (config.boundaryLayer) {
      config.boundaryLayer.setStyle({
        opacity
      });
    }

    // 調整縣市名稱透明度
    const labelPane =
      map.getPane(
        config.labelPaneName
      );

    if (labelPane) {
      labelPane.style.opacity =
        String(opacity);
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

/* =========================================================
   載入縣市界與縣市名稱
========================================================= */

async function loadCountyBoundaryLayer() {
  const config =
    layerConfigs.countyBoundary;

  try {
    const response =
      await fetch(config.url);

    if (!response.ok) {
      throw new Error(
        `HTTP error：${response.status}`
      );
    }

    const data =
      await response.json();

    console.log(
      "縣市界資料：",
      data
    );

    if (
      data.features &&
      data.features.length > 0
    ) {
      console.log(
        "縣市界欄位：",
        Object.keys(
          data.features[0]
            .properties || {}
        )
      );
    }

    // 儲存每個縣市的範圍，
    // 避免同一縣市出現重複名稱
    const countyBounds =
      new Map();

    const boundaryLayer =
      L.geoJSON(data, {
        pane: config.paneName,

        // 不填色，只顯示縣市框線
        style() {
          return {
            pane:
              config.paneName,

            color: "#4f5962",

            // 線條保持較細
            weight: 0.9,

            opacity:
              config.opacity,

            fill: false,
            fillOpacity: 0
          };
        },

        // 縣市界不攔截主題圖層操作
        interactive: false,

        onEachFeature(
          feature,
          layer
        ) {
          const properties =
            feature.properties || {};

          const countyName =
            getCountyName(
              properties
            );

          if (
            !countyBounds.has(
              countyName
            )
          ) {
            countyBounds.set(
              countyName,
              L.latLngBounds([])
            );
          }

          countyBounds
            .get(countyName)
            .extend(
              layer.getBounds()
            );
        }
      });

    // 建立縣市名稱圖層
    const labelLayer =
      L.layerGroup();

    countyBounds.forEach(
      (bounds, countyName) => {
        if (!bounds.isValid()) {
          return;
        }

        const labelPosition =
          bounds.getCenter();

        const labelMarker =
          L.marker(
            labelPosition,
            {
              pane:
                config.labelPaneName,

              interactive: false,

              icon: L.divIcon({
                className:
                  "county-label-marker",

                html: `
                  <span class="county-name-label">
                    ${escapeHtml(
                      countyName
                    )}
                  </span>
                `,

                iconSize: null,
                iconAnchor: [0, 0]
              })
            }
          );

        labelLayer.addLayer(
          labelMarker
        );
      }
    );

    config.boundaryLayer =
      boundaryLayer;

    config.labelLayer =
      labelLayer;

    // 將界線和名稱合併成一個可控制圖層
    config.layer =
      L.layerGroup([
        boundaryLayer,
        labelLayer
      ]);

    if (config.visible) {
      config.layer.addTo(map);
    }

    setLayerOpacity(
      "countyBoundary",
      config.opacity
    );

    applyLayerOrder();
  } catch (error) {
    console.error(
      "縣市界圖層載入失敗：",
      error
    );
  }
}

// 載入點圖層
loadMentalHealthLayer();

// 載入縣市界基本圖層
loadCountyBoundaryLayer();

// 載入所有主題面圖層
Object.keys(layerConfigs)
  .filter(
    key =>
      layerConfigs[key].type ===
      "polygon"
  )
  .forEach(key => {
    loadPolygonLayer(key);
  });

