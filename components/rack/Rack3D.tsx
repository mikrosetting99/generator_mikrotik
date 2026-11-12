"use client";

/**
 * Tampilan 3D rack (Three.js). Hanya untuk melihat: rack bisa diputar, di-zoom, pintunya dibuka,
 * dan perangkat diklik untuk dipilih. Penempatan tetap diedit di tampilan 2D.
 *
 * Satuan adegan: meter. y = 0 lantai, z positif = depan rack.
 */

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { Download } from "@/components/icons";
import { Button, Note } from "@/components/ui";
import {
  KIND_COLOR,
  RACK_LOSS_MM,
  RACK_TYPE,
  TWO_POST_MAX_DEPTH,
  TWO_POST_MAX_KG,
  usableDepth,
  type RackDevice,
  type RackState,
} from "@/lib/rack";

const U = 0.04445;
/** Rel depan mundur dari muka rack; sisa RACK_LOSS_MM ada di belakang untuk pintu. */
const FRONT_GAP = RACK_LOSS_MM / 2 / 1000;
const EAR_W = 0.4826;
const BODY_W = 0.44;

type View = "iso" | "front" | "side" | "rear";
const VIEWS: Array<{ id: View; label: string }> = [
  { id: "iso", label: "Miring" },
  { id: "front", label: "Depan" },
  { id: "side", label: "Samping" },
  { id: "rear", label: "Belakang" },
];

interface Scene3D {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  controls: OrbitControls;
  content: THREE.Group;
  frontDoor: THREE.Object3D | null;
  rearDoor: THREE.Object3D | null;
  pickables: THREE.Object3D[];
  /** Kamera sedang dipindah ke sudut pandang baru. */
  fly: { from: THREE.Vector3; to: THREE.Vector3; target: THREE.Vector3; fromTarget: THREE.Vector3; t: number } | null;
}

/* --------------------------------------------------------------- tekstur muka perangkat */

function drawFace(d: RackDevice, w: number, h: number): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  const color = KIND_COLOR[d.kind];
  const ear = Math.round(w * 0.045);

  g.fillStyle = d.kind === "blank" ? "#262b33" : "#2b313c";
  g.fillRect(0, 0, w, h);
  // telinga rack + lubang baut
  g.fillStyle = "#1d2129";
  g.fillRect(0, 0, ear, h);
  g.fillRect(w - ear, 0, ear, h);
  g.fillStyle = "#0b0d11";
  const holes = Math.max(1, Math.round(h / 95));
  for (let i = 0; i < holes; i++) {
    const y = ((i + 0.5) * h) / holes;
    for (const x of [ear / 2, w - ear / 2]) {
      g.beginPath();
      g.arc(x, y, Math.min(ear * 0.22, 9), 0, Math.PI * 2);
      g.fill();
    }
  }
  // garis bingkai
  g.strokeStyle = "rgba(255,255,255,0.08)";
  g.lineWidth = 3;
  g.strokeRect(ear + 1.5, 1.5, w - ear * 2 - 3, h - 3);

  const x0 = ear + 14;
  const x1 = w - ear - 14;
  if (d.kind !== "blank") {
    g.fillStyle = color;
    g.fillRect(x0, 10, 10, h - 20);
  }

  // detail per jenis, di sisi kanan
  const detailX = x0 + Math.round((x1 - x0) * 0.42);
  const dw = x1 - detailX;
  const midY = h / 2;
  g.save();
  if (d.kind === "switch" || d.kind === "patch" || d.kind === "olt") {
    const rows = 2;
    const cols = d.kind === "olt" ? 16 : 24;
    const pw = dw / cols;
    const ph = Math.min((h - 30) / rows, 32);
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < cols; i++) {
        g.fillStyle = "#0c0e12";
        g.fillRect(detailX + i * pw + 2, midY - ph * rows / 2 + r * ph + 2, pw - 4, ph - 4);
      }
    }
  } else if (d.kind === "server" || d.kind === "storage") {
    const rows = Math.max(1, Math.min(d.u, 3));
    const perRow = d.kind === "storage" ? 6 : 4;
    const bw = dw / perRow;
    const bh = (h - 24) / rows;
    for (let r = 0; r < rows; r++) {
      for (let i = 0; i < perRow; i++) {
        const x = detailX + i * bw;
        const y = 12 + r * bh;
        g.fillStyle = "#1a1e25";
        g.fillRect(x + 3, y + 3, bw - 6, bh - 6);
        g.fillStyle = (i + r) % 3 === 0 ? "#4cc38a" : "#3bb0d4";
        g.fillRect(x + bw - 14, y + 8, 5, 5);
      }
    }
  } else if (d.kind === "ups") {
    g.fillStyle = "#0e1a14";
    g.fillRect(detailX, midY - Math.min(40, h * 0.25), dw * 0.45, Math.min(80, h * 0.5));
    g.fillStyle = "#4cc38a";
    g.font = `600 ${Math.min(34, h * 0.2)}px ui-monospace, monospace`;
    g.textBaseline = "middle";
    g.fillText("ON LINE", detailX + 14, midY);
  } else if (d.kind === "pdu") {
    const n = 8;
    const sw = dw / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = "#111";
      g.fillRect(detailX + i * sw + 6, midY - 18, sw - 12, 36);
    }
  } else if (d.kind === "cable") {
    const n = 5;
    const sw = (x1 - x0 - 20) / n;
    for (let i = 0; i < n; i++) {
      g.fillStyle = "#16191f";
      g.fillRect(x0 + 20 + i * sw + 8, 12, sw - 16, h - 24);
    }
  } else if (d.kind === "router" || d.kind === "kvm" || d.kind === "other") {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = "#0c0e12";
      g.fillRect(detailX + i * (dw / 8) + 3, midY - 14, dw / 8 - 6, 28);
    }
  }
  g.restore();

  if (d.kind !== "blank" && d.kind !== "cable") {
    g.fillStyle = "#ffffff";
    const size = Math.min(40, Math.max(22, h * 0.34));
    g.font = `600 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
    g.textBaseline = "middle";
    const maxW = detailX - x0 - 40;
    let label = d.name;
    while (label.length > 1 && g.measureText(label).width > maxW) label = label.slice(0, -1);
    if (label !== d.name) label = `${label.slice(0, -1)}…`;
    g.fillText(label, x0 + 26, midY);
  }
  return c;
}

/* --------------------------------------------------------------------- adegan */

function disposeTree(obj: THREE.Object3D) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (m.geometry) m.geometry.dispose();
    const mats = m.material ? (Array.isArray(m.material) ? m.material : [m.material]) : [];
    for (const mat of mats) {
      for (const v of Object.values(mat)) if (v instanceof THREE.Texture) v.dispose();
      mat.dispose();
    }
  });
}

type RackSize = Pick<RackState, "type" | "heightU" | "widthMm" | "depthMm">;

interface RackGeo {
  /** Lebar dan dalam luar (m). */
  W: number;
  D: number;
  base: number;
  top: number;
  /** Tinggi rak dari alas sampai atap (m). */
  RH: number;
  /** Ketinggian alas dari lantai: rak dinding digantung. */
  y0: number;
  /** Muka rel depan, tempat telinga perangkat dibaut. */
  railZ: number;
  rearRailZ: number | null;
}

const WALL_MOUNT_Y = 1.0;

function rackGeo(r: RackSize): RackGeo {
  const t = RACK_TYPE[r.type];
  const W = r.widthMm / 1000;
  const D = r.depthMm / 1000;
  const base = t.baseMm / 1000;
  const top = t.topMm / 1000;
  const RH = r.heightU * U + base + top;
  const y0 = r.type === "wall" ? WALL_MOUNT_Y : 0;
  if (r.type === "open2") return { W, D, base, top, RH, y0, railZ: 0.035, rearRailZ: null };
  if (r.type === "open4") return { W, D, base, top, RH, y0, railZ: D / 2 - 0.025, rearRailZ: -D / 2 + 0.025 };
  const railZ = D / 2 - FRONT_GAP;
  const usable = Math.max(r.depthMm - RACK_LOSS_MM, 100) / 1000;
  return { W, D, base, top, RH, y0, railZ, rearRailZ: railZ - Math.max(usable - 0.02, 0.1) };
}

/** Posisi kamera untuk tiap sudut pandang, cukup jauh supaya seluruh rack terlihat. */
function viewPose(view: View, r: RackSize) {
  const g = rackGeo(r);
  const cy = g.y0 + g.RH / 2;
  const dist = Math.max(g.RH, g.D, 1) * 1.6 + 0.35;
  const target = new THREE.Vector3(0, cy, 0);
  const pos =
    view === "front"
      ? new THREE.Vector3(0, cy, dist)
      : view === "rear"
        ? new THREE.Vector3(0, cy, -dist)
        : view === "side"
          ? new THREE.Vector3(dist, cy, 0)
          : new THREE.Vector3(dist * 0.62, g.y0 + g.RH * 0.78 + (g.y0 ? 0.25 : 0), dist * 0.8);
  return { pos, target };
}

function buildRack(rack: RackState, selectedId: string | null, sidePanels: boolean): {
  group: THREE.Group;
  frontDoor: THREE.Object3D | null;
  rearDoor: THREE.Object3D | null;
  pickables: THREE.Object3D[];
} {
  const group = new THREE.Group();
  const pickables: THREE.Object3D[] = [];
  const { W, D, base, top, RH, y0, railZ, rearRailZ } = rackGeo(rack);
  const type = rack.type;
  const usable = usableDepth(rack);
  const railH = rack.heightU * U;
  const railY = y0 + base + railH / 2;

  const frameMat = new THREE.MeshStandardMaterial({ color: "#1c2027", metalness: 0.55, roughness: 0.55 });
  const railMat = new THREE.MeshStandardMaterial({ color: "#7c838f", metalness: 0.7, roughness: 0.35 });
  const box = (w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
    return m;
  };
  let labelX = -(EAR_W / 2 + 0.016);

  if (type === "closed" || type === "wall") {
    // alas, atap, tiang sudut
    box(W, base, D, frameMat, 0, y0 + base / 2, 0);
    box(W, top, D, frameMat, 0, y0 + RH - top / 2, 0);
    const post = 0.035;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) box(post, RH, post, frameMat, sx * (W / 2 - post / 2), y0 + RH / 2, sz * (D / 2 - post / 2));
    }
    if (type === "closed") {
      const footMat = new THREE.MeshStandardMaterial({ color: "#0d0f13", roughness: 0.9 });
      for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(0.05, 0.02, 0.05, footMat, sx * (W / 2 - 0.06), 0.01, sz * (D / 2 - 0.06));
    } else {
      // dinding tempat rak digantung
      const wall = new THREE.Mesh(new THREE.PlaneGeometry(4, 3), new THREE.MeshStandardMaterial({ color: "#d8d4cc", roughness: 0.95 }));
      wall.position.set(0, 1.5, -D / 2 - 0.002);
      wall.receiveShadow = true;
      group.add(wall);
    }
    if (sidePanels) {
      const sideMat = new THREE.MeshStandardMaterial({ color: "#2a2f38", metalness: 0.4, roughness: 0.6, transparent: true, opacity: 0.32, depthWrite: false });
      const h = RH - base - top;
      for (const sx of [-1, 1]) box(0.008, h, D - post * 2, sideMat, sx * (W / 2 - 0.004), y0 + base + h / 2, 0);
    }
  } else if (type === "open4") {
    // empat tiang, rangka atas dan bawah, tanpa panel
    const post = 0.045;
    const px = W / 2 - post / 2;
    const pz = D / 2 - post / 2;
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) box(post, RH, post, frameMat, sx * px, y0 + RH / 2, sz * pz);
    for (const y of [y0 + base / 2, y0 + RH - top / 2]) {
      const h = y === y0 + base / 2 ? base : top;
      for (const sz of [-1, 1]) box(W, h, post, frameMat, 0, y, sz * pz);
      for (const sx of [-1, 1]) box(post, h, D, frameMat, sx * px, y, 0);
    }
    // braket rel ke tiang
    for (const z of [railZ - 0.01, rearRailZ! + 0.01]) {
      for (const y of [y0 + base + 0.02, y0 + RH - top - 0.02]) box(W - post, 0.02, 0.02, frameMat, 0, y, z);
    }
  } else {
    // 2 tiang tengah, kaki memanjang ke depan dan belakang
    const postW = 0.03;
    const postD = 0.07;
    const px = EAR_W / 2 + postW / 2 - 0.004;
    labelX = -px;
    for (const sx of [-1, 1]) {
      box(postW, RH, postD, frameMat, sx * px, y0 + RH / 2, 0);
      box(0.08, base, D, frameMat, sx * px, y0 + base / 2, 0);
    }
    box(px * 2 + postW, top, postD, frameMat, 0, y0 + RH - top / 2, 0);
    box(px * 2 + postW, 0.04, 0.04, frameMat, 0, y0 + base + 0.02, 0);
  }

  // rel 19" depan (dan belakang bila ada)
  if (type !== "open2") {
    for (const sx of [-1, 1]) {
      box(0.018, railH, 0.02, railMat, sx * (EAR_W / 2 - 0.009), railY, railZ - 0.01);
      if (rearRailZ !== null) box(0.018, railH, 0.02, railMat, sx * (EAR_W / 2 - 0.009), railY, rearRailZ);
    }
  }
  // nomor U di rel kiri depan
  {
    const c = document.createElement("canvas");
    c.width = 48;
    c.height = Math.min(rack.heightU * 40, 4096);
    const g = c.getContext("2d")!;
    const step = c.height / rack.heightU;
    g.fillStyle = "#7c838f";
    g.fillRect(0, 0, c.width, c.height);
    g.fillStyle = "#16191e";
    g.font = `600 ${Math.round(step * 0.55)}px ui-monospace, monospace`;
    g.textAlign = "center";
    g.textBaseline = "middle";
    for (let u = 1; u <= rack.heightU; u++) g.fillText(String(u), c.width / 2, c.height - (u - 0.5) * step);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.026, railH), new THREE.MeshBasicMaterial({ map: tex }));
    label.position.set(labelX, railY, railZ + 0.0015);
    group.add(label);
  }

  // perangkat
  for (const d of rack.devices) {
    const h = d.u * U - 0.0015;
    const y = y0 + base + (d.pos - 1) * U + h / 2 + 0.00075;
    const dd = Math.max(d.depthMm, 10) / 1000;
    const isSel = d.id === selectedId;
    // merah = tidak muat di rak tertutup; jingga = menonjol (open 4-post) atau terlalu berat untuk 2-post
    const problem =
      usable === null
        ? d.kind !== "shelf" && (d.depthMm > TWO_POST_MAX_DEPTH || d.kg > TWO_POST_MAX_KG)
          ? "#f0ad4e"
          : null
        : d.depthMm > usable
          ? type === "open4"
            ? "#f0ad4e"
            : "#f1707d"
          : null;

    const bodyMat = new THREE.MeshStandardMaterial({
      color: problem ?? (d.kind === "blank" ? "#20242b" : "#353b46"),
      metalness: 0.45,
      roughness: 0.5,
      emissive: isSel ? new THREE.Color("#71639e") : new THREE.Color("#000000"),
      emissiveIntensity: isSel ? 0.55 : 0,
    });
    const body = new THREE.Mesh(new THREE.BoxGeometry(BODY_W, h, dd), bodyMat);
    body.position.set(0, y, railZ - dd / 2);
    body.castShadow = true;
    body.receiveShadow = true;
    body.userData.id = d.id;
    group.add(body);
    pickables.push(body);

    // garis warna jenis di sisi badan, supaya terlihat dari samping/belakang
    if (d.kind !== "blank") {
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.012, h * 0.7, dd * 0.98), new THREE.MeshStandardMaterial({ color: KIND_COLOR[d.kind], roughness: 0.6 }));
      stripe.position.set(BODY_W / 2 + 0.0005, y, railZ - dd / 2);
      group.add(stripe);
    }

    const texW = 1024;
    const texH = Math.max(64, Math.min(2048, Math.round((texW * h) / EAR_W)));
    const tex = new THREE.CanvasTexture(drawFace(d, texW, texH));
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    const faceMat = new THREE.MeshStandardMaterial({
      map: tex,
      metalness: 0.2,
      roughness: 0.65,
      emissive: isSel ? new THREE.Color("#ffffff") : new THREE.Color("#000000"),
      emissiveIntensity: isSel ? 0.12 : 0,
    });
    const face = new THREE.Mesh(new THREE.BoxGeometry(EAR_W, h, 0.004), [frameMat, frameMat, frameMat, frameMat, faceMat, frameMat]);
    face.position.set(0, y, railZ + 0.002);
    face.castShadow = true;
    face.userData.id = d.id;
    group.add(face);
    pickables.push(face);

    if (isSel) {
      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(new THREE.BoxGeometry(EAR_W + 0.004, h + 0.004, dd + 0.008)),
        new THREE.LineBasicMaterial({ color: "#ffffff" }),
      );
      edges.position.set(0, y, railZ - dd / 2 + 0.004);
      group.add(edges);
    }
  }

  if (!RACK_TYPE[type].hasDoors) return { group, frontDoor: null, rearDoor: null, pickables };

  // pintu depan kaca, engsel di kiri
  const doorH = RH - base - top;
  const frontDoor = new THREE.Group();
  frontDoor.position.set(-W / 2, y0 + base + doorH / 2, D / 2);
  {
    const glass = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.06, doorH - 0.06, 0.005),
      new THREE.MeshPhysicalMaterial({ color: "#9fb4c8", metalness: 0, roughness: 0.08, transparent: true, opacity: 0.16, depthWrite: false }),
    );
    glass.position.set(W / 2, 0, 0.012);
    frontDoor.add(glass);
    const doorFrameMat = new THREE.MeshStandardMaterial({ color: "#14171c", metalness: 0.5, roughness: 0.5 });
    const bar = (w: number, h: number, x: number, y: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.02), doorFrameMat);
      m.position.set(x, y, 0.012);
      m.castShadow = true;
      frontDoor.add(m);
    };
    bar(W, 0.03, W / 2, doorH / 2 - 0.015);
    bar(W, 0.03, W / 2, -doorH / 2 + 0.015);
    bar(0.03, doorH, 0.015, 0);
    bar(0.03, doorH, W - 0.015, 0);
    // gagang
    const handle = new THREE.Mesh(
      new THREE.BoxGeometry(0.014, Math.min(0.16, doorH * 0.4), 0.025),
      new THREE.MeshStandardMaterial({ color: "#8a919c", metalness: 0.8, roughness: 0.3 }),
    );
    handle.position.set(W - 0.04, 0, 0.032);
    frontDoor.add(handle);
  }
  group.add(frontDoor);

  // rak dinding menempel di dinding: tanpa pintu belakang
  if (type === "wall") return { group, frontDoor, rearDoor: null, pickables };

  // pintu belakang berlubang, engsel di kanan (dilihat dari belakang: kiri)
  const rearDoor = new THREE.Group();
  rearDoor.position.set(W / 2, y0 + base + doorH / 2, -D / 2);
  {
    const c = document.createElement("canvas");
    c.width = 128;
    c.height = 128;
    const g = c.getContext("2d")!;
    g.fillStyle = "#1a1d23";
    g.fillRect(0, 0, 128, 128);
    g.fillStyle = "#050608";
    for (let yy = 0; yy < 8; yy++) for (let xx = 0; xx < 8; xx++) g.fillRect(xx * 16 + 4 + (yy % 2) * 8, yy * 16 + 5, 7, 6);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(10, Math.max(4, Math.round((doorH / (W - 0.02)) * 10)));
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(W - 0.01, doorH, 0.012),
      new THREE.MeshStandardMaterial({ map: tex, metalness: 0.5, roughness: 0.6, transparent: true, opacity: 0.88 }),
    );
    mesh.position.set(-(W - 0.01) / 2, 0, -0.008);
    mesh.castShadow = true;
    rearDoor.add(mesh);
  }
  group.add(rearDoor);

  return { group, frontDoor, rearDoor, pickables };
}

/* ------------------------------------------------------------------- komponen */

export default function Rack3D({ rack, selectedId, onSelect }: { rack: RackState; selectedId: string | null; onSelect: (id: string) => void }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const sceneRef = useRef<Scene3D | null>(null);
  const doorTarget = useRef({ front: 0, rear: 0 });
  const onSelectRef = useRef(onSelect);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);
  const [failed, setFailed] = useState(false);
  const [frontOpen, setFrontOpen] = useState(false);
  const [rearOpen, setRearOpen] = useState(false);
  const [sidePanels, setSidePanels] = useState(true);
  const [view, setView] = useState<View>("iso");
  const sizeKey = `${rack.type}|${rack.heightU}|${rack.widthMm}|${rack.depthMm}`;
  const initialSize = useRef<RackSize>({ type: rack.type, heightU: rack.heightU, widthMm: rack.widthMm, depthMm: rack.depthMm });
  const info = RACK_TYPE[rack.type];
  const firstPose = useRef(true);

  // Renderer, kamera, kontrol, dan putaran gambar: dibuat sekali.
  useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    } catch {
      setFailed(true);
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.domElement.className = "block h-full w-full touch-none";
    renderer.domElement.setAttribute("aria-label", "Tampilan 3D rack");
    wrap.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.minDistance = 0.5;
    controls.maxDistance = 12;
    controls.maxPolarAngle = Math.PI / 2 - 0.03;

    scene.add(new THREE.HemisphereLight("#dfe6f0", "#2a2520", 0.9));
    const key = new THREE.DirectionalLight("#ffffff", 2.2);
    key.position.set(2.5, 4.5, 3.5);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -2;
    key.shadow.camera.right = 2;
    key.shadow.camera.top = 3;
    key.shadow.camera.bottom = -1;
    key.shadow.bias = -0.0004;
    scene.add(key);
    const fill = new THREE.DirectionalLight("#b9c4ff", 0.6);
    fill.position.set(-3, 2, -2.5);
    scene.add(fill);

    const floor = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.ShadowMaterial({ opacity: 0.28 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    scene.add(floor);
    const grid = new THREE.GridHelper(8, 32, "#8a8f99", "#8a8f99");
    (grid.material as THREE.Material).transparent = true;
    (grid.material as THREE.Material).opacity = 0.18;
    scene.add(grid);

    const content = new THREE.Group();
    scene.add(content);
    const start = viewPose("iso", initialSize.current);
    camera.position.copy(start.pos);
    controls.target.copy(start.target);
    controls.update();
    const s: Scene3D = { renderer, scene, camera, controls, content, frontDoor: null, rearDoor: null, pickables: [], fly: null };
    sceneRef.current = s;

    const resize = () => {
      const w = wrap.clientWidth || 1;
      const h = wrap.clientHeight || 1;
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);

    // Klik tanpa menggeser = pilih perangkat.
    const ray = new THREE.Raycaster();
    let down: { x: number; y: number } | null = null;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      down = null;
      const r = renderer.domElement.getBoundingClientRect();
      ray.setFromCamera(new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), camera);
      const hit = ray.intersectObjects(s.pickables, false)[0];
      const id = hit?.object.userData.id as string | undefined;
      if (id) onSelectRef.current(id);
    };
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    let raf = 0;
    const clock = new THREE.Clock();
    const loop = () => {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(clock.getDelta(), 0.05);
      const k = 1 - Math.pow(0.0015, dt);
      if (s.frontDoor) s.frontDoor.rotation.y += (doorTarget.current.front - s.frontDoor.rotation.y) * k;
      if (s.rearDoor) s.rearDoor.rotation.y += (doorTarget.current.rear - s.rearDoor.rotation.y) * k;
      if (s.fly) {
        s.fly.t = Math.min(s.fly.t + dt / 0.6, 1);
        const e = 1 - Math.pow(1 - s.fly.t, 3);
        camera.position.lerpVectors(s.fly.from, s.fly.to, e);
        controls.target.lerpVectors(s.fly.fromTarget, s.fly.target, e);
        if (s.fly.t >= 1) s.fly = null;
      }
      controls.update();
      renderer.render(scene, camera);
    };
    loop();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      controls.dispose();
      disposeTree(scene);
      renderer.dispose();
      renderer.domElement.remove();
      sceneRef.current = null;
    };
  }, []);

  // Susun ulang rack setiap data berubah; sudut pintu yang sedang terbuka dipertahankan.
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const frontAngle = s.frontDoor?.rotation.y ?? doorTarget.current.front;
    const rearAngle = s.rearDoor?.rotation.y ?? doorTarget.current.rear;
    for (const child of [...s.content.children]) {
      s.content.remove(child);
      disposeTree(child);
    }
    const built = buildRack(rack, selectedId, sidePanels);
    s.content.add(built.group);
    if (built.frontDoor) built.frontDoor.rotation.y = frontAngle;
    if (built.rearDoor) built.rearDoor.rotation.y = rearAngle;
    s.frontDoor = built.frontDoor;
    s.rearDoor = built.rearDoor;
    s.pickables = built.pickables;
  }, [rack, selectedId, sidePanels]);

  // Pindah sudut pandang (juga saat ukuran rack berubah supaya rack tetap terlihat utuh).
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    // pose awal sudah dipasang saat adegan dibuat
    if (firstPose.current) {
      firstPose.current = false;
      return;
    }
    const [type, h, w, d] = sizeKey.split("|");
    const pose = viewPose(view, { type: type as RackState["type"], heightU: Number(h), widthMm: Number(w), depthMm: Number(d) });
    s.fly = { from: s.camera.position.clone(), to: pose.pos, fromTarget: s.controls.target.clone(), target: pose.target, t: 0 };
  }, [view, sizeKey]);

  useEffect(() => {
    doorTarget.current = { front: frontOpen ? -1.85 : 0, rear: rearOpen ? -1.85 : 0 };
  }, [frontOpen, rearOpen]);

  const savePng = () => {
    const s = sceneRef.current;
    if (!s) return;
    s.renderer.render(s.scene, s.camera);
    const a = document.createElement("a");
    a.href = s.renderer.domElement.toDataURL("image/png");
    a.download = `${rack.name.replace(/[^\w-]+/g, "-").replace(/^-|-$/g, "") || "rack"}-3d.png`;
    a.click();
  };

  if (failed) {
    return <Note tone="warn">Browser ini tidak mendukung WebGL, jadi tampilan 3D tidak bisa dibuka. Pakai tampilan 2D.</Note>;
  }

  const toggle = (on: boolean, label: string, set: (v: boolean) => void) => (
    <button
      type="button"
      onClick={() => set(!on)}
      aria-pressed={on}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${on ? "border-brand bg-brand/10 text-brand" : "border-line bg-surface text-muted hover:text-ink"}`}
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2 print:hidden">
        <div className="flex flex-wrap gap-1" role="group" aria-label="Sudut pandang">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => {
                setView(v.id);
                // klik ulang sudut yang sama tetap mengembalikan kamera
                if (v.id === view) {
                  const s = sceneRef.current;
                  if (s) {
                    const pose = viewPose(v.id, rack);
                    s.fly = { from: s.camera.position.clone(), to: pose.pos, fromTarget: s.controls.target.clone(), target: pose.target, t: 0 };
                  }
                }
              }}
              aria-pressed={view === v.id}
              className={`rounded-md border px-2.5 py-1 text-xs transition-colors ${view === v.id ? "border-brand bg-brand text-white" : "border-line bg-surface text-muted hover:text-ink"}`}
            >
              {v.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {info.hasDoors && toggle(frontOpen, "Buka pintu depan", setFrontOpen)}
          {rack.type === "closed" && toggle(rearOpen, "Buka pintu belakang", setRearOpen)}
          {info.hasDoors && toggle(sidePanels, "Panel samping", setSidePanels)}
          <Button size="sm" onClick={savePng} title="Simpan tampilan 3D sebagai gambar">
            <Download className="h-3.5 w-3.5" /> PNG
          </Button>
        </div>
      </div>
      <div
        ref={wrapRef}
        className="relative h-[560px] w-full overflow-hidden rounded-lg bg-gradient-to-b from-raised to-surface ring-1 ring-line sm:h-[640px]"
      />
      <p className="text-center text-[11px] text-faint print:hidden">
        Seret untuk memutar · scroll / cubit untuk zoom · klik kanan / dua jari untuk menggeser · klik perangkat untuk memilih
      </p>
    </div>
  );
}
