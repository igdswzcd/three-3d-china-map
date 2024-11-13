<template>
  <div id="three-container"></div>
  <div id="three-map" ref="map"></div>
  <div id="label-group" ref="labels"></div>
</template>
<script setup>
import * as THREE from 'three';
import {
  OrbitControls,
  Line2,
  LineGeometry,
  LineMaterial,
  RenderPass,
  ShaderPass,
  FXAAShader,
  EffectComposer,
} from 'three/examples/jsm/Addons.js';
import * as d3 from 'd3';
import { onMounted, reactive, ref } from 'vue';
import mapJson from '../assets/jsons/china-provinces.geo.json';
import { GradientMaterial } from '../three/gradientMat.ts';
import {
  GRAD_COLOR_1,
  GRAD_COLOR_2,
  HOVER_COLOR,
  SIDE_COLOR,
  SIDE_HOVER_COLOR,
  LINE_MAT_PARAMS,
  EXTRUDE_GEO_PARAMS,
  SURFACE_LINE_Z,
} from './params.ts';

const projection = d3
  .geoMercator()
  .center([104.0, 36.0])
  .scale(80)
  .translate([0, 0]);

const map = ref(null);
const labels = ref(null);
const isDrag = ref(false);
const width = window.innerWidth,
  height = window.innerHeight;

let scene = null;
let camera = null;
let renderer = null;
let controller = null;
let raycaster = null;
let mouse = null;
let lastPick = null;

let composer = null;
function initThree() {
  scene = new THREE.Scene();
  setCamera();
  setRenderer();
  setLight();
  generateGeometry(mapJson);
  setController();
  setRaycaster();
  setComposer();
  render();
}

function setCamera() {
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  camera.position.set(10, -30, 70);
  camera.lookAt(0, 0, 0);
}
function setRenderer() {
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(devicePixelRatio);
  renderer.setSize(width, height);
  map.value.appendChild(renderer.domElement);
}

function setLight() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 100);
  scene.add(ambientLight);
}

function setController() {
  controller = new OrbitControls(camera, renderer.domElement);
  controller.enablePan = false;
  controller.minPolarAngle = Math.PI / 2;
  controller.maxPolarAngle = Math.PI / 1.5;
  controller.minAzimuthAngle = -Math.PI / 16;
  controller.maxAzimuthAngle = Math.PI / 16;
  controller.minDistance = 80;
  controller.maxDistance = 100;
  updateProvinceLabelWindowPos();
  controller.addEventListener('change', () => {
    updateProvinceLabelWindowPos();
  });
  renderer.domElement.addEventListener('mousedown', () => {
    isDrag.value = true;
    labels.value.style.opacity = 0;
  });
  renderer.domElement.addEventListener('mouseup', () => {
    isDrag.value = false;
    setTimeout(() => {
      updateProvinceLabelWindowPos();
      labels.value.style.opacity = 1;
    }, 50);
  });
  controller.update();
}

function updateProvinceLabelWindowPos() {
  if (isDrag.value) {
    return;
  }
  if (labels.value?.innerHTML) {
    labels.value.innerHTML = null;
  }
  const mapData = scene.children.find((item) => item.name === 'mapData');
  const provinces = mapData.children;
  if (Array.isArray(provinces)) {
    provinces.forEach(({ properties }) => {
      const { _centroid, name } = properties;
      if (_centroid) {
        const [worldX, worldY] = _centroid;
        const labelElem = document.createElement('div');
        labelElem.textContent = name;
        const vector = new THREE.Vector3(worldX, -worldY, 4);
        const { x: cameraX, y: cameraY } = vector.project(camera);
        const windowX = ((cameraX + 1) / 2) * width;
        const windowY = ((-cameraY + 1) / 2) * height;
        labelElem.style.transform = `translate(-50%, -50%) translate(${windowX}px,${windowY}px)`;
        labels.value.appendChild(labelElem);
      }
    });
  }
}

function setRaycaster() {
  raycaster = new THREE.Raycaster();
  mouse = new THREE.Vector2();
  const onMouseMove = (e) => {
    mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
    checkRaycaster();
  };
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);
}

function checkRaycaster() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (!intersects.length) {
    return;
  }
  if (lastPick) {
    const provinceMeshes = scene.children[1].children.find(province => province.name === lastPick)?.children.filter(item => item.name === lastPick);
    if (provinceMeshes) {
      provinceMeshes.forEach(mesh => {
        mesh.material[0].uniforms.hover.value = false;
        mesh.material[1].color.set(SIDE_COLOR);
      });
    }
  }
  lastPick = intersects.find(
    (item) => item.object.material && item.object.material.length === 2,
  )?.object.name;
  if (lastPick) {
    const provinceMeshes = scene.children[1].children.find(province => province.name === lastPick)?.children.filter(item => item.name === lastPick);
    if (provinceMeshes) {
      provinceMeshes.forEach(mesh => {
        mesh.material[0].uniforms.hover.value = true;
        mesh.material[1].color.set(SIDE_HOVER_COLOR);
      });
    }
  }
}

function setComposer() {
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(
    0.5 / width / devicePixelRatio,
    0.5 / height / devicePixelRatio,
  );
  composer.addPass(fxaaPass);
}

function render() {
  composer.render();
  controller.update();
  requestAnimationFrame(render);
}

function generateGeometry({ features }) {
  const mapObj = new THREE.Object3D();
  features.forEach((elem, index) => {
    const province = new THREE.Object3D();
    let coordinates = elem.geometry.coordinates;
    if (elem.geometry.type === "Polygon") {
      coordinates = [coordinates];
    }
    coordinates.forEach((multiPolygon) => {
      multiPolygon.forEach((polygon) => {
        const shape = new THREE.Shape();
        const lineMaterial = new LineMaterial(LINE_MAT_PARAMS);
        const lineGeometry = new LineGeometry();

        const points = [];
        const pointsX = new Set();
        const pointsY = new Set();
        for (let i = 0; i < polygon.length; i++) {
          const [x, y] = projection(polygon[i]);
          if (i === 0) {
            shape.moveTo(x, -y);
          }
          shape.lineTo(x, -y);
          points.push(x, -y, SURFACE_LINE_Z);
          pointsX.add(x);
          pointsY.add(-y);
        }
        lineGeometry.setPositions(points);
        const [midX, disX] = calcMidAndDist(pointsX);
        const [midY, disY] = calcMidAndDist(pointsY);
        const gradUVParams = {
          midX,
          midY,
          disX,
          disY,
        };
        const graMat = new GradientMaterial(
          GRAD_COLOR_1,
          GRAD_COLOR_2,
          HOVER_COLOR,
          gradUVParams,
        );

        const geometry = new THREE.ExtrudeGeometry(shape, EXTRUDE_GEO_PARAMS);

        const materialSide = new THREE.MeshBasicMaterial({
          color: SIDE_COLOR,
          transparent: true,
          opacity: 0.8,
        });

        const mesh = new THREE.Mesh(geometry, [graMat, materialSide]);
        mesh.name = elem.properties.name;
        province.name = elem.properties.name;
        const line = new Line2(lineGeometry, lineMaterial);
        province.add(mesh);
        province.add(line);
      });
    });
    province.properties = elem.properties;
    if (elem.properties.centroid || elem.properties.center) {
      const [x, y] = projection(elem.properties.centroid || elem.properties.center);
      province.properties._centroid = [x, y];
    }
    mapObj.add(province);
  });
  mapObj.name = 'mapData';
  scene.add(mapObj);
}

function calcMidAndDist(someSet) {
  const sortedArr = Array.from(someSet).sort((a, b) => a - b);
  const max = sortedArr[sortedArr.length - 1];
  const min = sortedArr[0];
  const mid = (max + min) / 2;
  const dist = max - min;
  return [mid, dist];
}

onMounted(() => {
  initThree();
});
</script>

<style scoped>
#three-container {
  position: relative;
  width: 100%;
  height: 100%;
}

#label-group {
  position: absolute;
  left: 0;
  top: 0;
  color: #28E2B2;
  font-size: 0.7rem;

  &:deep() div {
    white-space: nowrap;
    position: absolute;
    left: 0;
    top: 0;
    cursor: pointer;
    user-select: none;
    text-shadow:
      -1px -1px 0 #333,
      0 -1px 0 #333,
      1px -1px 0 #333,
      1px 0 0 #333,
      1px 1px 0 #333,
      0 1px 0 #333,
      -1px 1px 0 #333,
      -1px 0 0 #333;

    &:hover {
      color: red;
    }
  }
}
</style>