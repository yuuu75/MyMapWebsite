// 建立地圖，中心設定在臺北市附近
const map = L.map("map").setView(
  [25.0478, 121.5319],
  12
);

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

// 建立 YouBike 點群聚圖層
const youbikeCluster = L.markerClusterGroup({
  chunkedLoading: true,
  disableClusteringAtZoom: 17
});
// 建立社區心理衛生中心點群聚圖層
const mentalHealthCluster = L.markerClusterGroup({
  chunkedLoading: true,
  disableClusteringAtZoom: 15
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
  "YouBike2.0站點": youbikeCluster,
  "社區心理衛生中心":mentalHealthCluster,
  "城鄉階層": urbanicityLayerGroup
};

L.control.layers(baseMaps, overlayMaps, {
  collapsed: false
}).addTo(map);

// 讀取 YouBike GeoJSON
fetch("data/Youbike2.0.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error(`讀取失敗：${response.status}`);
    }

    return response.json();
  })
  .then(data => {
    const youbikeLayer = L.geoJSON(data, {
      pointToLayer: function (feature, latlng) {
        return L.circleMarker(latlng, {
          radius: 5,
          weight: 1,
          fillOpacity: 0.8
        });
      },

      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};

        const stationName =
          p.sna ||
          p.name ||
          p.站點名稱 ||
          "YouBike站點";

        const address =
          p.ar ||
          p.address ||
          p.地址 ||
          "無地址資料";

        layer.bindPopup(`
          <strong>${stationName}</strong><br>
          地址：${address}
        `);
      }
    });

     // 把所有 YouBike 點加入 cluster
    youbikeCluster.addLayer(youbikeLayer);
     // 預設顯示 YouBike 圖層
    map.addLayer(youbikeCluster);

// 縮放到所有 YouBike 站點範圍
    map.fitBounds(youbikeLayer.getBounds());
  })
  .catch(error => {
    console.error("YouBike 圖層載入失敗：", error);
  });

// 讀取社區心理衛生中心 GeoJSON
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
          radius: 6,
           // 外框顏色
    color: "rgb(0, 0, 0)",

    // 點的填滿顏色
    fillColor: "#a03641",
          weight: 2,
          fillOpacity: 0.85
        });
      },

      onEachFeature: function (feature, layer) {
        const p = feature.properties || {};

         const centerName =
    p["Column1.title"] || "未提供機構名稱";

  const address =
    p["Column1.address"] || "未提供地址";

  const phone =
    p["Column1.tel"] || "未提供電話";

  const serviceTime =
    p["Column1.time_info"] || "未提供服務時間";

  const organizationType =
    p["Column1.tag_type"] || "未提供機構類型";

  layer.bindPopup(`
    <div class="mental-health-popup">
      <strong>${centerName}</strong><br><br>

      <b>機構類型：</b>${organizationType}<br>
      <b>地址：</b>${address}<br>
      <b>電話：</b>${phone}<br>
      <b>服務時間：</b>${serviceTime}<br>
    </div>
  `);
}
    });

    // 把心理衛生中心點位加入其 Cluster
    mentalHealthCluster.addLayer(mentalHealthLayer);

    // 預設顯示心理衛生中心
    map.addLayer(mentalHealthCluster);
  })
  .catch(error => {
    console.error("社區心理衛生中心圖層載入失敗：", error);
  });

  // 載入城鄉階層 GeoJSON
let urbanicityLayer;
  fetch("data/urbanicity level.geojson")
  .then(response => {
    if (!response.ok) {
      throw new Error(`HTTP error：${response.status}`);
    }

    return response.json();
  })
  .then(data => {
    console.log(data);
    urbanicityLayer = L.geoJSON(data, {
      style: feature => ({
        color: "#666666",
        weight: 0.8,
        opacity: 1,
        fillColor: getUrbanicityColor(feature.properties.Rank),
        fillOpacity: 0.50
      }),

      onEachFeature: (feature, layer) => {
        const p = feature.properties || {};

        layer.bindPopup(`
          <strong>${p.COUNTY || ""}${p.TOWN || ""}</strong><br>
          Rank：${p.Rank ?? "無資料"}<br>
          人口數：${p.P_CNT ?? "無資料"}
        `);

        layer.on({
          mouseover: event => {
            event.target.setStyle({
              color: "#222222",
              weight: 2.5,
              fillOpacity: 0.9
            });
          },

          mouseout: event => {
            urbanicityLayer.resetStyle(event.target);
          }
        });
      }
    });

    urbanicityLayerGroup.addLayer(urbanicityLayer);
    map.addLayer(urbanicityLayerGroup);
    urbanicityLayer.bringToBack();
  })
  .catch(error => {
    console.error("城鄉階層圖層載入失敗：", error);
  });

// 城鄉階層圖例
const legend = L.control({
  position: "bottomleft"
});

legend.onAdd = function () {
  const div = L.DomUtil.create("div", "legend");

  div.innerHTML = `
    <h4>城鄉階層</h4>

    <div><i style="background:#d7191c"></i>1–70</div>
    <div><i style="background:#fdae61"></i>71–140</div>
    <div><i style="background:#ffffbf"></i>141–210</div>
    <div><i style="background:#abdda4"></i>211–280</div>
    <div><i style="background:#2b83ba"></i>281–349</div>
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
    <div class="opacity-title">城鄉階層透明度</div>

    <input
      id="urbanicity-opacity"
      type="range"
      min="0"
      max="1"
      step="0.05"
      value="0.5"
    >

    <span id="urbanicity-opacity-value">50%</span>
  `;

  L.DomEvent.disableClickPropagation(container);
  L.DomEvent.disableScrollPropagation(container);

  return container;
};


// 記錄控制器目前是否顯示
let urbanicityControlsVisible = false;


// 顯示透明度滑桿與圖例
function showUrbanicityControls() {
  if (urbanicityControlsVisible) return;

  opacityControl.addTo(map);
  legend.addTo(map);

  urbanicityControlsVisible = true;

  const opacitySlider =
    document.getElementById("urbanicity-opacity");

  const opacityValue =
    document.getElementById("urbanicity-opacity-value");

  if (opacitySlider && opacityValue) {
    opacitySlider.addEventListener("input", function () {
      const opacity = Number(this.value);

      opacityValue.textContent =
        `${Math.round(opacity * 100)}%`;

      if (urbanicityLayer) {
        urbanicityLayer.setStyle({
          fillOpacity: opacity
        });
      }
    });
  }
}


// 隱藏透明度滑桿與圖例
function hideUrbanicityControls() {
  if (!urbanicityControlsVisible) return;

  opacityControl.remove();
  legend.remove();

  urbanicityControlsVisible = false;
}


// 開啟圖層時顯示
map.on("overlayadd", function (event) {
  if (event.layer === urbanicityLayerGroup) {
    showUrbanicityControls();
  }
});


// 關閉圖層時隱藏
map.on("overlayremove", function (event) {
  if (event.layer === urbanicityLayerGroup) {
    hideUrbanicityControls();
  }
});