'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Service, Lead } from '@/types';

interface MindMapCanvasProps {
  service: Service | null;
  leads: Lead[];
  selectedLeadId: string | null;
  onLeadSelect: (leadId: string) => void;
}

// Fibonacci sphere gives even angular spread; varying radius gives scattered distances
function getLeadPosition(index: number, total: number): THREE.Vector3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = total > 1 ? 1 - (index / (total - 1)) * 2 : 0;
  const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  const r = 2.2 + ((index * 1.618) % 3.2);
  return new THREE.Vector3(
    Math.cos(theta) * radiusXZ * r,
    y * r,
    Math.sin(theta) * radiusXZ * r,
  );
}

function getNodeColor(score: number): { color: number; emissive: number; specular: number } {
  if (score >= 80) return { color: 0x00c8e0, emissive: 0x005870, specular: 0x88eeff };
  if (score >= 50) return { color: 0x4ade80, emissive: 0x166534, specular: 0xaaffcc };
  return            { color: 0xd4c07a, emissive: 0x6b5a28, specular: 0xffe8a0 };
}

function getNodeBorderColor(score: number): string {
  if (score >= 80) return 'rgba(0,200,224,0.7)';
  if (score >= 50) return 'rgba(74,222,128,0.7)';
  return 'rgba(212,192,122,0.7)';
}

function getNodeSize(score: number): number {
  return 0.14 + (score / 100) * 0.26;
}

// Draw a rounded rect path on a canvas context
function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y,     x + w, y + r,     r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x,     y + h, x,     y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x,     y,     x + r, y,         r);
  ctx.closePath();
}

/**
 * Build a billboard sprite whose texture is text painted onto a canvas.
 * The sprite is sized to fit inside the sphere (diameter = 2 * sphereRadius).
 */
function makeNodeSprite(
  name: string,
  score: number | null,
  borderColor: string,
  sphereRadius: number,
): THREE.Sprite {
  const SIZE = 256; // canvas is always square → sprite maps to a circle
  const canvas = document.createElement('canvas');
  canvas.width  = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d')!;

  // Transparent base
  ctx.clearRect(0, 0, SIZE, SIZE);

  // Circular clip — so the sprite visually stays within the sphere outline
  ctx.save();
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 4, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Background fill
  ctx.fillStyle = 'rgba(6, 6, 18, 0.78)';
  ctx.fillRect(0, 0, SIZE, SIZE);

  // Border ring
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.arc(SIZE / 2, SIZE / 2, SIZE / 2 - 6, 0, Math.PI * 2);
  ctx.stroke();

  ctx.restore();

  // Name — truncate to fit
  ctx.fillStyle = '#e8edf5';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  if (score !== null) {
    // Two lines: name + score
    ctx.font = 'bold 36px sans-serif';
    const maxW = SIZE - 28;
    let displayName = name;
    while (ctx.measureText(displayName).width > maxW && displayName.length > 1) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== name) displayName = displayName.slice(0, -1) + '…';

    ctx.fillText(displayName, SIZE / 2, SIZE / 2 - 24);

    ctx.font = '28px sans-serif';
    ctx.fillStyle = '#7dd4fc';
    ctx.fillText(String(score), SIZE / 2, SIZE / 2 + 26);
  } else {
    // Service node — single line
    ctx.font = 'bold 34px sans-serif';
    const maxW = SIZE - 28;
    let displayName = name;
    while (ctx.measureText(displayName).width > maxW && displayName.length > 1) {
      displayName = displayName.slice(0, -1);
    }
    if (displayName !== name) displayName = displayName.slice(0, -1) + '…';
    ctx.fillStyle = '#ff8fa3';
    ctx.fillText(displayName, SIZE / 2, SIZE / 2);
  }

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,   // always visible — renders on top of the sphere surface
    depthWrite: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.renderOrder = 10;

  // Scale so the sprite fits snugly inside the sphere
  const d = sphereRadius * 1.65;
  sprite.scale.set(d, d, 1);

  return sprite;
}

function buildStarfield(): THREE.Points {
  const count = 4500;
  const positions = new Float32Array(count * 3);
  const colors    = new Float32Array(count * 3);

  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 70 + Math.random() * 60;
    positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);

    const b    = 0.55 + Math.random() * 0.45;
    const tint = Math.random();
    if (tint < 0.4) {
      colors[i * 3] = b * 0.8; colors[i * 3 + 1] = b * 0.9; colors[i * 3 + 2] = b;
    } else if (tint < 0.7) {
      colors[i * 3] = b; colors[i * 3 + 1] = b; colors[i * 3 + 2] = b;
    } else {
      colors[i * 3] = b; colors[i * 3 + 1] = b * 0.88; colors[i * 3 + 2] = b * 0.72;
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));

  const mat = new THREE.PointsMaterial({
    size: 0.22,
    vertexColors: true,
    transparent: true,
    opacity: 0.95,
    sizeAttenuation: true,
  });

  return new THREE.Points(geo, mat);
}

function buildNebulaCloud(color: number, px: number, py: number, pz: number, radius: number, opacity: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 12, 12);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.BackSide,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(px, py, pz);
  return mesh;
}

export default function MindMapCanvas({ service, leads, selectedLeadId, onLeadSelect }: MindMapCanvasProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const onSelectRef   = useRef(onLeadSelect);
  onSelectRef.current = onLeadSelect;

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    composer: EffectComposer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animFrameId: number;
    leadMeshes: Array<{ mesh: THREE.Mesh; leadId: string }>;
    serviceNode: THREE.Mesh | null;
    pivot: THREE.Group;
    cleanup: () => void;
  } | null>(null);

  // ── Init scene (once) ────────────────────────────────────────────────────
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const W = container.clientWidth;
    const H = container.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x060612);
    scene.fog = new THREE.FogExp2(0x060612, 0.016);

    scene.add(new THREE.AmbientLight(0x1a2244, 2.0));
    const keyLight = new THREE.DirectionalLight(0xffffff, 3.0);
    keyLight.position.set(8, 10, 6);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x4466cc, 0.8);
    rimLight.position.set(-6, -4, -4);
    scene.add(rimLight);

    const camera = new THREE.PerspectiveCamera(58, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 10);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.appendChild(renderer.domElement);

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(W, H), 0.9, 0.5, 0.72));

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance   = 3;
    controls.maxDistance   = 28;
    controls.autoRotate    = false;

    scene.add(buildStarfield());
    scene.add(buildNebulaCloud(0x1a0a50,  25,  12, -40, 35, 0.12));
    scene.add(buildNebulaCloud(0x081830, -30,  -8, -35, 28, 0.10));
    scene.add(buildNebulaCloud(0x0a0830,   5,  25, -50, 40, 0.08));
    scene.add(buildNebulaCloud(0x100520, -10, -20, -20, 22, 0.09));

    const pivot = new THREE.Group();
    scene.add(pivot);

    const raycaster  = new THREE.Raycaster();
    const leadMeshes: Array<{ mesh: THREE.Mesh; leadId: string }> = [];

    const handleClick = (e: MouseEvent) => {
      const rect  = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      const hits = raycaster.intersectObjects(leadMeshes.map(l => l.mesh));
      if (hits.length > 0) {
        const hit = leadMeshes.find(l => l.mesh === hits[0].object);
        if (hit) onSelectRef.current(hit.leadId);
      }
    };
    renderer.domElement.addEventListener('click', handleClick);

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    let animFrameId = 0;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      controls.update();
      pivot.rotation.y += 0.0006;
      composer.render();
    };
    animate();

    sceneRef.current = {
      renderer, composer, scene, camera, controls,
      animFrameId, leadMeshes, serviceNode: null, pivot,
      cleanup: () => {
        cancelAnimationFrame(animFrameId);
        renderer.domElement.removeEventListener('click', handleClick);
        window.removeEventListener('resize', handleResize);
        renderer.dispose();
        if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
      },
    };

    return () => { sceneRef.current?.cleanup(); sceneRef.current = null; };
  }, []);

  // ── Rebuild graph when service / leads change ────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const { pivot, leadMeshes } = s;

    // Fully dispose everything on the pivot (meshes + sprites + their textures)
    const toDispose = [...pivot.children];
    toDispose.forEach(child => {
      pivot.remove(child);
      child.traverse(obj => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose());
        }
        if (obj instanceof THREE.Sprite) {
          const mat = obj.material as THREE.SpriteMaterial;
          mat.map?.dispose();
          mat.dispose();
        }
      });
    });
    leadMeshes.length = 0;
    s.serviceNode = null;

    if (!service) return;

    // ── Central service planet ──────────────────────────────────────────────
    const CENTER_R = 0.58;
    const centerGeo = new THREE.SphereGeometry(CENTER_R, 64, 64);
    const centerMat = new THREE.MeshPhongMaterial({
      color:             0xe0566a,
      emissive:          new THREE.Color(0x7a1020),
      emissiveIntensity: 0.55,
      shininess:         100,
      specular:          new THREE.Color(0xff9999),
    });
    const centerNode = new THREE.Mesh(centerGeo, centerMat);
    pivot.add(centerNode);
    s.serviceNode = centerNode;

    const serviceSprite = makeNodeSprite(service.name, null, 'rgba(224,86,106,0.7)', CENTER_R);
    centerNode.add(serviceSprite);

    // ── Lead planet nodes ──────────────────────────────────────────────────
    leads.forEach((lead, i) => {
      const { color, emissive, specular } = getNodeColor(lead.score);
      const size = getNodeSize(lead.score);
      const pos  = getLeadPosition(i, leads.length);

      const geo = new THREE.SphereGeometry(size, 48, 48);
      const mat = new THREE.MeshPhongMaterial({
        color,
        emissive:          new THREE.Color(emissive),
        emissiveIntensity: 0.4,
        shininess:         95,
        specular:          new THREE.Color(specular),
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      pivot.add(mesh);
      leadMeshes.push({ mesh, leadId: lead.id });

      // Connection line
      const lineGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), pos.clone()]);
      const lineMat = new THREE.LineBasicMaterial({ color: 0x3a5588, opacity: 0.3, transparent: true });
      pivot.add(new THREE.Line(lineGeo, lineMat));

      // Label sprite — centered inside the sphere
      const sprite = makeNodeSprite(lead.name, lead.score, getNodeBorderColor(lead.score), size);
      mesh.add(sprite);
    });
  }, [service, leads]);

  // ── Highlight selected lead ──────────────────────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    s.leadMeshes.forEach(({ mesh }) => {
      const mat = mesh.material as THREE.MeshPhongMaterial;
      mat.emissiveIntensity = 0.4;
      mesh.children
        .filter(c => c instanceof THREE.PointLight)
        .forEach(l => mesh.remove(l));
    });

    if (selectedLeadId) {
      const found = s.leadMeshes.find(l => l.leadId === selectedLeadId);
      if (found) {
        const mat = found.mesh.material as THREE.MeshPhongMaterial;
        mat.emissiveIntensity = 2.0;
        const glow = new THREE.PointLight(0xffffff, 2, 3);
        found.mesh.add(glow);
      }
    }
  }, [selectedLeadId]);

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full"
      style={{ background: '#060612' }}
    >
      {!service && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[#8899bb] text-sm">Select a service to view its leads</p>
        </div>
      )}
    </div>
  );
}
