<template>
  <div id="three-container"></div>
  <div id="three-map" ref="map"></div>
  <div id="label-group" ref="labels"></div>
</template>
<script setup>
import * as THREE from 'three';
import { OrbitControls, Line2, LineGeometry, LineMaterial, RenderPass, ShaderPass, FXAAShader, EffectComposer } from 'three/examples/jsm/Addons.js';
import * as d3 from 'd3';
import { onMounted, reactive, ref } from 'vue';
import mapJson from '../assets/jsons/china.json';
import { GradientMaterial } from '../three/gradientMat.ts';

const projection = d3.geoMercator().center([104.0, 36.0]).scale(80).translate([0, 0]);
const GRAD_COLOR_1 = '#0F1B32';
const GRAD_COLOR_2 = '#437BA2';
// const GRAD_COLOR_1 = '#FF0000';
// const GRAD_COLOR_2 = '#0000FF';
const HOVER_COLOR = '#A343E3';
const SIDE_COLOR = '#3C75BF';
const SIDE_HOVER_COLOR = '#B1119E';

const map = ref(null);
const labels = ref(null);
const width = window.innerWidth, height = window.innerHeight;

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
  composer = new EffectComposer(renderer);
  const renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  const fxaaPass = new ShaderPass(FXAAShader);
  fxaaPass.uniforms['resolution'].value.set(0.5 / width / devicePixelRatio, 0.5 / height / devicePixelRatio);
  composer.addPass(fxaaPass);
  render();

}

function setCamera() {
  camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 2000);
  camera.position.set(10, -30, 70);
  camera.lookAt(0, 0, 0)
}
function setRenderer() {
  renderer = new THREE.WebGLRenderer({antialias: true});
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
  // controller.enablePan = false;
  // controller.minPolarAngle = Math.PI / 2;
  // controller.maxPolarAngle = Math.PI / 1.5;
  // controller.minAzimuthAngle = -Math.PI / 16;
  // controller.maxAzimuthAngle = Math.PI / 16;
  // controller.minDistance = 80;
  // controller.maxDistance = 100;
  updateProvinceLabelWindowPos();
  controller.addEventListener('change', () => { updateProvinceLabelWindowPos(); })
  renderer.domElement.addEventListener('mousedown', () => { labels.value.style.opacity = 0; });
  renderer.domElement.addEventListener('mouseup', () => { labels.value.style.opacity = 1; });
  controller.update();
}

function updateProvinceLabelWindowPos() {
  labels.value.innerHTML = null;
  const mapData = scene.children.find(item => item.name === 'mapData');
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
        const windowX = (cameraX + 1) / 2 * width;
        const windowY = (-cameraY + 1) / 2 * height;
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
  }
  renderer.domElement.addEventListener('mousemove', onMouseMove, false);
}

function checkRaycaster() {
  raycaster.setFromCamera(mouse, camera);
  const intersects = raycaster.intersectObjects(scene.children, true);
  if (!intersects.length) {
    return;
  }
  if (lastPick) {
    lastPick.object.material[0].uniforms.hover.value = false;
    lastPick.object.material[1].color.set(SIDE_COLOR);
  }
  lastPick = intersects.find((item) => item.object.material && item.object.material.length === 2)
  if (lastPick) {
    lastPick.object.material[0].uniforms.hover.value = true;
    lastPick.object.material[1].color.set(SIDE_HOVER_COLOR)
  }
}

function render() {
  // renderer.render(scene, camera);
  composer.render();
  controller.update();
  requestAnimationFrame(render);
}

function generateGeometry({ features }) {
  const mapObj = new THREE.Object3D();
  features.forEach((elem, index) => {
    const province = new THREE.Object3D();
    const coordinates = elem.geometry.coordinates;
    coordinates.forEach((multiPolygon) => {
      multiPolygon.forEach((polygon) => {
        const shape = new THREE.Shape()
        const lineMaterial = new LineMaterial({
          color: '#97DCEF',
          linewidth: 1.5,
        })
        const lineGeometry = new LineGeometry()

        const points = [];
        const pointsX = [];
        const pointsY = [];
        for (let i = 0; i < polygon.length; i++) {
          const [x, y] = projection(polygon[i])
          if (i === 0) {
            shape.moveTo(x, -y);
          }
          shape.lineTo(x, -y);
          // points.push(new THREE.Vector3(x, -y, 4.05));
          points.push(x, -y, 4.02);
          pointsX.push(x);
          pointsY.push(-y);
          // const worldPos = new THREE.Vector3(x, -y, 4.02);
          // const ndcPos = worldPos.project(camera);
          // const uvPosition = new THREE.Vector2(
          //   (ndcPos.x + 1) / 2 * renderer.domElement.clientWidth,
          //   (1 - ndcPos.y) / 2 * renderer.domElement.clientHeight
          // );
          // console.log(uvPosition)
        }
        
        lineGeometry.setPositions(points);
        // console.log(points)
        // lineGeometry.setFromPoints(points);
        const minX = Math.min(...pointsX);
        const maxX = Math.max(...pointsX);
        const minY = Math.min(...pointsY);
        const maxY = Math.max(...pointsY);
        const midX = (minX + maxX) / 2;
        const midY = (minY + maxY) / 2;
        const disX = maxX - minX;
        const disY = maxY - minY;
        const gradUVParams = {
          midX, midY, disX, disY
        }

        const extrudeSettings = {
          depth: 4,
          bevelEnabled: false,
        }

        const geometry = new THREE.ExtrudeGeometry(
          shape,
          extrudeSettings
        )
        // const material = new THREE.MeshBasicMaterial({
        //   color: '#2defff',
        //   transparent: false,
        //   opacity: 0.6,
        // })
        const materialSide = new THREE.MeshBasicMaterial({
          color: SIDE_COLOR,
          transparent: true,
          opacity: 0.8,
        });
        const graMat = new GradientMaterial(GRAD_COLOR_1, GRAD_COLOR_2, HOVER_COLOR, gradUVParams);
        console.log(geometry, pointsY)
        const mesh = new THREE.Mesh(geometry, [graMat, materialSide]);
        const line = new Line2(lineGeometry, lineMaterial);
        province.add(mesh)
        province.add(line)
      })
    })
    province.properties = elem.properties;
    if (elem.properties.centroid) {
      const [x, y] = projection(elem.properties.centroid);
      province.properties._centroid = [x, y];
    }
    mapObj.add(province);
  });
  mapObj.name = 'mapData';
  scene.add(mapObj);
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