import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

type SceneRenderInput = {
  scene: THREE.Scene;
  layoutFrame: { width: number; height: number } | null;
  keyboardLift: number;
};

type SceneVideoRenderInput = SceneRenderInput & {
  camera: THREE.PerspectiveCamera;
};

const AD_RENDER_WIDTH = 3840;
const AD_RENDER_HEIGHT = 2160;

export function renderAdVideo({ scene, camera, layoutFrame, keyboardLift }: SceneVideoRenderInput) {
  const renderCanvas = document.createElement("canvas");
  const captureStream = renderCanvas.captureStream;
  if (!captureStream || typeof MediaRecorder === "undefined") {
    return Promise.reject(new Error("This browser does not support canvas video recording."));
  }

  const width = 1920;
  const height = 1080;
  const videoRenderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true, alpha: false });
  videoRenderer.setSize(width, height, false);
  videoRenderer.setPixelRatio(1);
  videoRenderer.shadowMap.enabled = true;
  videoRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  videoRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  videoRenderer.toneMappingExposure = 1.55;
  videoRenderer.outputColorSpace = THREE.SRGBColorSpace;
  const mimeType = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
  const stream = captureStream.call(renderCanvas, 60);
  const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 8_000_000 } : { videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  const duration = 10_000 + Math.random() * 5_000;
  const savedBackground = scene.background;
  const savedFog = scene.fog;
  const renderCamera = camera.clone();
  renderCamera.aspect = width / height;
  renderCamera.fov = 32;
  renderCamera.updateProjectionMatrix();
  const studioRig = createVideoStudioRig(keyboardLift);
  const target = new THREE.Vector3(0, 0, keyboardLift + 6);
  const layoutSize = layoutFrame ? Math.max(layoutFrame.width, layoutFrame.height) : 160;
  const radius = Math.max(160, layoutSize * 1.25);
  const startAngle = Math.random() * Math.PI * 2;
  const orbit = (Math.PI * 1.1 + Math.random() * Math.PI * 0.65) * (Math.random() > 0.5 ? 1 : -1);
  const startHeight = 78 + Math.random() * 42;
  const endHeight = 105 + Math.random() * 55;
  const startRadius = radius * (0.82 + Math.random() * 0.18);
  const endRadius = radius * (0.54 + Math.random() * 0.18);

  scene.background = new THREE.Color(0x171b1f);
  scene.fog = new THREE.Fog(0x171b1f, 460, 900);
  scene.add(studioRig);
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };

  return new Promise<Blob>((resolve, reject) => {
    let frameId = 0;
    let startedAt = 0;

    const cleanup = () => {
      cancelAnimationFrame(frameId);
      stream.getTracks().forEach((track) => track.stop());
      scene.remove(studioRig);
      scene.background = savedBackground;
      scene.fog = savedFog;
      disposeStudioRig(studioRig);
      videoRenderer.dispose();
    };

    recorder.onerror = () => {
      cleanup();
      reject(new Error("Video recording failed."));
    };
    recorder.onstop = () => {
      cleanup();
      resolve(new Blob(chunks, { type: recorder.mimeType || "video/webm" }));
    };

    const tick = (time: number) => {
      if (!startedAt) startedAt = time;
      const t = THREE.MathUtils.clamp((time - startedAt) / duration, 0, 1);
      const eased = t * t * (3 - 2 * t);
      const angle = startAngle + orbit * eased;
      const currentRadius = THREE.MathUtils.lerp(startRadius, endRadius, eased);
      const currentHeight = THREE.MathUtils.lerp(startHeight, endHeight, eased) + Math.sin(t * Math.PI * 2.5) * 8;
      target.x = Math.sin(t * Math.PI * 2) * layoutSize * 0.05;
      target.y = Math.cos(t * Math.PI * 1.6) * layoutSize * 0.04;
      renderCamera.position.set(Math.cos(angle) * currentRadius, Math.sin(angle) * currentRadius, keyboardLift + currentHeight);
      renderCamera.lookAt(target);
      videoRenderer.render(scene, renderCamera);
      if (t >= 1) {
        recorder.stop();
        return;
      }
      frameId = requestAnimationFrame(tick);
    };

    recorder.start(250);
    frameId = requestAnimationFrame(tick);
  });
}

export function renderAdImage({ scene, layoutFrame, keyboardLift }: SceneRenderInput) {
  const renderCanvas = document.createElement("canvas");
  const imageRenderer = new THREE.WebGLRenderer({ canvas: renderCanvas, antialias: true, alpha: false });
  imageRenderer.setSize(AD_RENDER_WIDTH, AD_RENDER_HEIGHT, false);
  imageRenderer.setPixelRatio(1);
  imageRenderer.shadowMap.enabled = true;
  imageRenderer.shadowMap.type = THREE.PCFSoftShadowMap;
  imageRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  imageRenderer.toneMappingExposure = 0.82;
  imageRenderer.outputColorSpace = THREE.SRGBColorSpace;

  const savedBackground = scene.background;
  const savedFog = scene.fog;
  const studioRig = createAdImageStudioRig(keyboardLift);
  const camera = createThreeQuarterRenderCamera(layoutFrame, AD_RENDER_WIDTH, AD_RENDER_HEIGHT, keyboardLift);
  const composer = new EffectComposer(imageRenderer);
  composer.setSize(AD_RENDER_WIDTH, AD_RENDER_HEIGHT);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new UnrealBloomPass(new THREE.Vector2(AD_RENDER_WIDTH, AD_RENDER_HEIGHT), 0.06, 0.48, 0.94));

  scene.background = new THREE.Color(0x101419);
  scene.fog = new THREE.Fog(0x101419, 500, 1040);
  scene.add(studioRig);

  composer.render();
  const finalCanvas = addAdImageFinishing(renderCanvas);

  return new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob((blob) => {
      scene.remove(studioRig);
      scene.background = savedBackground;
      scene.fog = savedFog;
      disposeStudioRig(studioRig);
      composer.dispose();
      imageRenderer.dispose();

      if (blob) resolve(blob);
      else reject(new Error("PNG image export failed."));
    }, "image/png");
  });
}

function createVideoStudioRig(keyboardLift: number) {
  const rig = new THREE.Group();
  const keyLight = new THREE.SpotLight(0xfff3d6, 8.5, 520, Math.PI / 5.2, 0.72, 1);
  keyLight.position.set(-135, -120, 220);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 650;
  keyLight.target.position.set(0, 0, keyboardLift + 8);
  rig.add(keyLight, keyLight.target);

  const softFill = new THREE.DirectionalLight(0xcfeaff, 2.4);
  softFill.position.set(150, 110, 160);
  rig.add(softFill);

  const rim = new THREE.DirectionalLight(0xffffff, 3.4);
  rim.position.set(40, 170, 180);
  rig.add(rim);

  const sweep = new THREE.Mesh(
    new THREE.PlaneGeometry(980, 640),
    new THREE.MeshStandardMaterial({ color: 0x1b2025, roughness: 0.92, metalness: 0 }),
  );
  sweep.position.set(0, 0, 0.01);
  sweep.receiveShadow = true;
  rig.add(sweep);

  return rig;
}

function createAdImageStudioRig(keyboardLift: number) {
  const rig = new THREE.Group();

  const ambientBed = new THREE.HemisphereLight(0xd8ecff, 0x1c242c, 0.52);
  rig.add(ambientBed);

  const keyLight = new THREE.SpotLight(0xffdfbd, 3.4, 660, Math.PI / 5.2, 0.86, 1.05);
  keyLight.position.set(-260, -210, 210);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(4096, 4096);
  keyLight.shadow.camera.near = 10;
  keyLight.shadow.camera.far = 760;
  keyLight.target.position.set(0, 0, keyboardLift + 4);
  rig.add(keyLight, keyLight.target);

  const cyanFill = new THREE.DirectionalLight(0xb8e9ff, 0.58);
  cyanFill.position.set(230, 95, 170);
  rig.add(cyanFill);

  const warmRim = new THREE.DirectionalLight(0xffd0a0, 0.92);
  warmRim.position.set(-150, 220, 190);
  rig.add(warmRim);

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(1100, 720),
    new THREE.MeshPhysicalMaterial({
      color: 0x151a20,
      roughness: 0.74,
      metalness: 0.02,
      clearcoat: 0.12,
      clearcoatRoughness: 0.58,
    }),
  );
  floor.position.z = 0.025;
  floor.receiveShadow = true;
  rig.add(floor);

  const rearGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(880, 360),
    new THREE.MeshBasicMaterial({ color: 0x2e4050, transparent: true, opacity: 0.18, depthWrite: false }),
  );
  rearGlow.position.set(0, 245, 82);
  rearGlow.rotation.x = THREE.MathUtils.degToRad(72);
  rig.add(rearGlow);

  const sideGlow = new THREE.Mesh(
    new THREE.PlaneGeometry(360, 260),
    new THREE.MeshBasicMaterial({ color: 0x3c5866, transparent: true, opacity: 0.14, depthWrite: false }),
  );
  sideGlow.position.set(390, 40, 70);
  sideGlow.rotation.y = THREE.MathUtils.degToRad(-76);
  sideGlow.rotation.x = THREE.MathUtils.degToRad(82);
  rig.add(sideGlow);

  return rig;
}

function createThreeQuarterRenderCamera(
  layoutFrame: { width: number; height: number } | null,
  width: number,
  height: number,
  keyboardLift: number,
) {
  const layoutW = layoutFrame?.width ?? 170;
  const layoutH = layoutFrame?.height ?? 90;
  const layoutSize = Math.max(layoutW, layoutH * (width / height));
  const target = new THREE.Vector3(0, 0, keyboardLift + 7);
  const distance = Math.max(250, layoutSize * 1.58);
  const camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 1800);
  camera.position.set(distance * 0.58, -distance * 0.76, distance * 0.96);
  camera.up.set(0, 1, 0);
  camera.lookAt(target);
  camera.updateProjectionMatrix();
  return camera;
}

function addAdImageFinishing(source: HTMLCanvasElement) {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;

  const width = canvas.width;
  const height = canvas.height;
  ctx.drawImage(source, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  const keyFlare = ctx.createRadialGradient(width * 0.2, height * 0.16, 0, width * 0.2, height * 0.16, width * 0.42);
  keyFlare.addColorStop(0, "rgba(255,230,190,0.06)");
  keyFlare.addColorStop(0.22, "rgba(255,210,150,0.03)");
  keyFlare.addColorStop(1, "rgba(255,210,150,0)");
  ctx.fillStyle = keyFlare;
  ctx.fillRect(0, 0, width, height);

  const cyanFlare = ctx.createRadialGradient(width * 0.82, height * 0.28, 0, width * 0.82, height * 0.28, width * 0.34);
  cyanFlare.addColorStop(0, "rgba(150,220,255,0.04)");
  cyanFlare.addColorStop(1, "rgba(150,220,255,0)");
  ctx.fillStyle = cyanFlare;
  ctx.fillRect(0, 0, width, height);

  ctx.globalAlpha = 0.04;
  ctx.translate(width * 0.14, height * 0.12);
  ctx.rotate(-0.18);
  const streak = ctx.createLinearGradient(0, 0, width * 0.82, 0);
  streak.addColorStop(0, "rgba(255,255,255,0)");
  streak.addColorStop(0.36, "rgba(255,235,205,0.18)");
  streak.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = streak;
  ctx.fillRect(0, 0, width * 0.82, height * 0.018);
  ctx.restore();

  ctx.save();
  ctx.globalCompositeOperation = "multiply";
  const vignette = ctx.createRadialGradient(width * 0.5, height * 0.48, height * 0.28, width * 0.5, height * 0.48, width * 0.72);
  vignette.addColorStop(0, "rgba(255,255,255,1)");
  vignette.addColorStop(0.68, "rgba(200,205,212,0.9)");
  vignette.addColorStop(1, "rgba(28,31,36,0.64)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  return canvas;
}

function disposeStudioRig(rig: THREE.Group) {
  rig.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.geometry.dispose();
      if (Array.isArray(object.material)) object.material.forEach((material) => material.dispose());
      else object.material.dispose();
    }
  });
}
