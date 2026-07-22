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

// 建立圖層控制器
const baseMaps = {
  "預設底圖": cartoVoyager,
  "簡潔淺色底圖": cartoLightLayer,
  "OpenStreetMap": osmLayer,
  "衛星影像底圖": esriImagery
};

const overlayMaps = {
  "YouBike2.0站點": youbikeCluster,
  "社區心理衛生中心":mentalHealthCluster
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