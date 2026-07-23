// 建立地圖，中心設定在臺北市附近
const map = L.map("map").setView(
  [25.0478, 121.5319],
  12
);

// 城鄉階層固定在較下層
map.createPane("urbanicityPane");
map.getPane("urbanicityPane").style.zIndex = 400;

// 心理衛生中心固定在較上層
map.createPane("mentalHealthPane");
map.getPane("mentalHealthPane").style.zIndex = 650;

// 加入 OpenStreetMap 底圖
const osmLayer = L.tileLayer(
  "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
  {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">' +
      "OpenStreetMap contributors</a>"
  }
);
// CARTO Voyager 底圖
const cartoVoyager = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
  {
    maxZoom:20,
    attribution:'© OpenStreetMap © CARTO'
  }
);

// CARTO 簡潔淺色底圖
const cartoLightLayer = L.tileLayer(
  "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png",
  {
    maxZoom: 20,
    attribution:
      '&copy; OpenStreetMap contributors &copy; CARTO'
  }
);

//Esri World Imagery 衛星影像底圖
const esriImagery = L.tileLayer(
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  {
    attribution:"Tiles © Esri"
  }
);

// 預設顯示cartoVoyager底圖
cartoVoyager.addTo(map);


// 加入比例尺
L.control.scale({
  metric: true,
  imperial: false
}).addTo(map);


// 建立社區心理衛生中心點群聚圖層
const mentalHealthCluster = L.markerClusterGroup({
  chunkedLoading: true,
  disableClusteringAtZoom: 15,

  // 群聚圖示固定放在心理衛生中心 Pane
  clusterPane: "mentalHealthPane"
});

// 建立面圖層群組
const urbanicityLayerGroup = L.layerGroup();

// 建立圖層控制器
const baseMaps = {
  "預設底圖": cartoVoyager,
  "簡潔淺色底圖": cartoLightLayer,
  "OpenStreetMap": osmLayer,
  "衛星影像底圖": esriImagery
};

// 城鄉階層顏色函式
function getUrbanicityColor(rank) {
  const value = Number(rank);

  if (value >= 1 && value <= 70) return "#d7191c";
  if (value >= 71 && value <= 140) return "#fdae61";
  if (value >= 141 && value <= 210) return "#ffffbf";
  if (value >= 211 && value <= 280) return "#abdda4";
  if (value >= 281 && value <= 349) return "#2b83ba";

  return "#cccccc";
}

const overlayMaps = {
  "社區心理衛生中心":mentalHealthCluster,
  "城鄉階層": urbanicityLayerGroup
};

L.control.layers(baseMaps, overlayMaps, {
  collapsed: false
}).addTo(map);

// 城鄉階層相關變數
let urbanicityLayer = null;
let selectedUrbanicityLayer = null;
let currentUrbanicityOpacity = 0.5;

// 記錄目前被點擊的心理衛生中心
let selectedMentalHealthLayer = null;

// ==============================
// 讀取社區心理衛生中心 GeoJSON
// ==============================

fetch("data/mental_health_center.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error(`讀取失敗：${response.status}`);
    }

    return response.json();
  })
  .then(data => {
    const mentalHealthLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          pane: "mentalHealthPane",

          // 讓 CSS 可以控制點位動畫
          className: "mental-health-marker",

          radius: 7,
          color: "#ffffff",
          fillColor: "#a03641",
          weight: 2.5,
          opacity: 1,
          fillOpacity: 0.92
        });
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
      className: "modern-mental-health-popup",
      maxWidth: 330,
      minWidth: 270,
      closeButton: true,
      autoPanPadding: [30, 30]
    }
  );

  // 滑鼠移入：平滑放大
  layer.on("mouseover", function () {
    const element = layer.getElement();

    if (element) {
      element.classList.add(
        "mental-health-marker-hover"
      );
    }

    layer.bringToFront();
  });

  // 滑鼠移出：恢復大小
  layer.on("mouseout", function () {
    const element = layer.getElement();

    if (element) {
      element.classList.remove(
        "mental-health-marker-hover"
      );
    }
  });

  // 點擊：加入光暈
  layer.on("click", function () {
    // 先移除前一個點位的選取效果
    if (
      selectedMentalHealthLayer &&
      selectedMentalHealthLayer !== layer
    ) {
      const previousElement =
        selectedMentalHealthLayer.getElement();

      if (previousElement) {
        previousElement.classList.remove(
          "mental-health-marker-selected"
        );
      }
    }

    selectedMentalHealthLayer = layer;

    const element = layer.getElement();

    if (element) {
      element.classList.add(
        "mental-health-marker-selected"
      );
    }

    layer.bringToFront();
  });

  // Popup 關閉時取消選取
  layer.on("popupclose", function () {
    const element = layer.getElement();

    if (element) {
      element.classList.remove(
        "mental-health-marker-selected"
      );
    }

    if (selectedMentalHealthLayer === layer) {
      selectedMentalHealthLayer = null;
    }
  });
}
    });

    mentalHealthCluster.addLayer(
      mentalHealthLayer
    );

    // 預設顯示
    map.addLayer(mentalHealthCluster);
  })
  .catch(error => {
    console.error(
      "社區心理衛生中心圖層載入失敗：",
      error
    );
  });


// ==============================
// 載入城鄉階層 GeoJSON
// ==============================

fetch("data/urbanicity level.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error(
        `HTTP error：${response.status}`
      );
    }

    return response.json();
  })
  .then(data => {
    console.log("城鄉階層資料：", data);

    urbanicityLayer = L.geoJSON(data, {
      // 城鄉階層固定在較低的 Pane
      pane: "urbanicityPane",

      style: function (feature) {
        return {
          pane: "urbanicityPane",
          color: "#666666",
          weight: 0.8,
          opacity: 1,
          fillColor: getUrbanicityColor(
            feature.properties.Rank
          ),
          fillOpacity:
            currentUrbanicityOpacity
        };
      },

      onEachFeature: function (
        feature,
        layer
      ) {
        const p =
          feature.properties || {};

        const infoContent = `
          <div class="urbanicity-info">
            <strong>
              ${p.COUNTY || ""}
              ${p.TOWN || ""}
            </strong><br>

            城鄉階層排名：
            ${p.Rank ?? "無資料"}<br>

            人口數：
            ${p.P_CNT ?? "無資料"}
          </div>
        `;

        // 滑鼠經過時顯示
        layer.bindTooltip(
          infoContent,
          {
            sticky: true,
            direction: "top",
            opacity: 0.95
          }
        );

        // 點擊後固定顯示
        layer.bindPopup(
          infoContent,
          {
            closeButton: true,
            autoClose: true,
            closeOnClick: false
          }
        );


        // 有其他區域被固定時，
        // 阻止目前區域顯示 tooltip
        layer.on(
          "tooltipopen",
          function () {
            if (
              selectedUrbanicityLayer &&
              selectedUrbanicityLayer !==
                layer
            ) {
              layer.closeTooltip();
            }
          }
        );


        // 滑鼠移入
        layer.on(
          "mouseover",
          function (event) {
            if (
              selectedUrbanicityLayer &&
              selectedUrbanicityLayer !==
                layer
            ) {
              layer.closeTooltip();
              return;
            }

            event.target.setStyle({
              color: "#222222",
              weight: 2.5,
              fillOpacity: Math.min(
                currentUrbanicityOpacity +
                  0.15,
                1
              )
            });

            event.target.bringToFront();
          }
        );


        // 滑鼠移出
        layer.on(
          "mouseout",
          function (event) {
            // 已被點選的區域維持突出
            if (
              selectedUrbanicityLayer ===
              layer
            ) {
              return;
            }

            urbanicityLayer.resetStyle(
              event.target
            );

            event.target.setStyle({
              fillOpacity:
                currentUrbanicityOpacity
            });

            urbanicityLayer.bringToBack();
          }
        );


        // 點擊行政區
        layer.on(
          "click",
          function () {
            // 關閉所有滑鼠提示
            urbanicityLayer.eachLayer(
              function (otherLayer) {
                otherLayer.closeTooltip();
              }
            );

            // 恢復前一個被選取區域
            if (
              selectedUrbanicityLayer &&
              selectedUrbanicityLayer !==
                layer
            ) {
              urbanicityLayer.resetStyle(
                selectedUrbanicityLayer
              );

              selectedUrbanicityLayer
                .setStyle({
                  fillOpacity:
                    currentUrbanicityOpacity
                });
            }

            // 記錄目前選取區域
            selectedUrbanicityLayer =
              layer;

            // 突出目前區域
            layer.setStyle({
              color: "#111111",
              weight: 3,
              fillOpacity: Math.min(
                currentUrbanicityOpacity +
                  0.2,
                1
              )
            });

            layer.bringToFront();
          }
        );


        // 關閉 Popup 時解除選取
        layer.on(
          "popupclose",
          function () {
            if (
              selectedUrbanicityLayer !==
              layer
            ) {
              return;
            }

            urbanicityLayer.resetStyle(
              layer
            );

            layer.setStyle({
              fillOpacity:
                currentUrbanicityOpacity
            });

            selectedUrbanicityLayer =
              null;

            urbanicityLayer.bringToBack();
          }
        );
      }
    });

    // 加入圖層群組
    urbanicityLayerGroup.addLayer(
      urbanicityLayer
    );

    // 預設開啟城鄉階層
    map.addLayer(
      urbanicityLayerGroup
    );

    // 預設顯示圖例及透明度控制
    showUrbanicityControls();

    // 放到點圖層下方
    setTimeout(function () {
      urbanicityLayer.bringToBack();
    }, 0);
  })
  .catch(error => {
    console.error(
      "城鄉階層圖層載入失敗：",
      error
    );
  });

// 城鄉階層圖例
const legend = L.control({
  position: "bottomleft"
});

legend.onAdd = function () {
  const div = L.DomUtil.create(
    "div",
    "legend"
  );

  div.innerHTML = `
    <h4>城鄉階層</h4>

    <div>
      <i style="background:#d7191c"></i>
      1–70
    </div>

    <div>
      <i style="background:#fdae61"></i>
      71–140
    </div>

    <div>
      <i style="background:#ffffbf"></i>
      141–210
    </div>

    <div>
      <i style="background:#abdda4"></i>
      211–280
    </div>

    <div>
      <i style="background:#2b83ba"></i>
      281–349
    </div>
  `;

  L.DomEvent.disableClickPropagation(div);
  L.DomEvent.disableScrollPropagation(div);

  return div;
};


// 城鄉階層透明度控制器
const opacityControl = L.control({
  position: "bottomright"
});

opacityControl.onAdd = function () {
  const container = L.DomUtil.create(
    "div",
    "urbanicity-opacity-control"
  );

  container.innerHTML = `
    <div class="opacity-title">
      城鄉階層透明度
    </div>

    <input
      id="urbanicity-opacity"
      type="range"
      min="0"
      max="1"
      step="0.05"
      value="${currentUrbanicityOpacity}"
    >

    <span id="urbanicity-opacity-value">
      ${Math.round(
        currentUrbanicityOpacity * 100
      )}%
    </span>
  `;

  L.DomEvent.disableClickPropagation(
    container
  );

  L.DomEvent.disableScrollPropagation(
    container
  );

  return container;
};


// 記錄控制器目前是否顯示
let urbanicityControlsVisible = false;


// 顯示透明度滑桿與圖例
function showUrbanicityControls() {
  if (urbanicityControlsVisible) {
    return;
  }

  opacityControl.addTo(map);
  legend.addTo(map);

  urbanicityControlsVisible = true;

  const opacitySlider =
    document.getElementById(
      "urbanicity-opacity"
    );

  const opacityValue =
    document.getElementById(
      "urbanicity-opacity-value"
    );

  if (opacitySlider && opacityValue) {
  opacitySlider.addEventListener(
    "input",
    function () {
      // 取得滑桿目前數值
      currentUrbanicityOpacity =
        Number(this.value);

      // 更新右側顯示的百分比
      opacityValue.textContent =
        `${Math.round(
          currentUrbanicityOpacity * 100
        )}%`;

      // 確認城鄉階層圖層已經載入
      if (urbanicityLayer) {
        // 先將全部行政區套用新的透明度
        urbanicityLayer.setStyle({
          fillOpacity:
            currentUrbanicityOpacity
        });

        // 如果目前有行政區被點擊選取
        if (selectedUrbanicityLayer) {
          // 讓被選取區域維持加粗及較深的效果
          selectedUrbanicityLayer.setStyle({
            color: "#111111",
            weight: 3,
            fillOpacity: Math.min(
              currentUrbanicityOpacity + 0.2,
              1
            )
          });

          // 讓被選取區域維持在城鄉圖層前方
          selectedUrbanicityLayer
            .bringToFront();
        } else {
          // 沒有任何區域被選取時，
          // 才把整個城鄉階層放到底層
          urbanicityLayer.bringToBack();
        }
      }
    }
  );
}
}


// 隱藏透明度滑桿與圖例
function hideUrbanicityControls() {
  if (!urbanicityControlsVisible) {
    return;
  }

  opacityControl.remove();
  legend.remove();

  urbanicityControlsVisible = false;
}


// 開啟城鄉階層圖層時
map.on("overlayadd", function (event) {
  if (
    event.layer === urbanicityLayerGroup
  ) {
    showUrbanicityControls();

    // 重新開啟圖層後放回底層
    setTimeout(function () {
      if (urbanicityLayer) {
        urbanicityLayer.bringToBack();
      }
    }, 0);
  }
});


// 關閉城鄉階層圖層時
map.on("overlayremove", function (event) {
  if (
    event.layer === urbanicityLayerGroup
  ) {
    hideUrbanicityControls();
  }
});