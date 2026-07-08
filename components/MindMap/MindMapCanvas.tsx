'use client';

import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { Service, Lead } from '@/types';

interface MindMapCanvasProps {
  service: Service | null;
  leads: Lead[];
  selectedLeadId: string | null;
  onLeadSelect: (leadId: string) => void;
}

// Same palette as ServiceItem — deterministic color per service name
const SERVICE_COLORS = ['#2563eb', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];
function getServiceColor(name: string): THREE.Color {
  return new THREE.Color(SERVICE_COLORS[name.charCodeAt(0) % SERVICE_COLORS.length]);
}

// Score tiers — 3 materials = 3 draw calls for all leads (InstancedMesh)
const TIERS = [
  { min: 80, color: 0x00d4f5, emissive: 0x005870 }, // cyan
  { min: 50, color: 0x50fa7b, emissive: 0x1a5530 }, // green
  { min:  0, color: 0xffd060, emissive: 0x6a3a00 }, // gold
] as const;

function getTierIndex(score: number): 0 | 1 | 2 {
  if (score >= 80) return 0;
  if (score >= 50) return 1;
  return 2;
}

function getNodeSize(score: number): number {
  return 0.16 + (score / 100) * 0.28;
}

function getLeadPosition(index: number, total: number): THREE.Vector3 {
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  const y = total > 1 ? 1 - (index / (total - 1)) * 2 : 0;
  const radiusXZ = Math.sqrt(Math.max(0, 1 - y * y));
  const theta = goldenAngle * index;
  const r = 2.4 + ((index * 1.618) % 3.4);
  return new THREE.Vector3(
    Math.cos(theta) * radiusXZ * r,
    y * r,
    Math.sin(theta) * radiusXZ * r,
  );
}

function makeGlowHalo(radius: number, color: number, opacity: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(radius, 20, 20);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    side: THREE.BackSide, depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

function makeRing(
  innerRadius: number, tube: number,
  color: number, opacity: number,
  tiltX: number, tiltZ = 0,
): THREE.Mesh {
  const geo = new THREE.TorusGeometry(innerRadius, tube, 16, 100);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.rotation.x = tiltX;
  m.rotation.z = tiltZ;
  return m;
}

function buildStarfield(): THREE.Points {
  const count = 3000;
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi   = Math.acos(2 * Math.random() - 1);
    const r     = 65 + Math.random() * 65;
    pos[i*3]   = r * Math.sin(phi) * Math.cos(theta);
    pos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i*3+2] = r * Math.cos(phi);
    const b = 0.5 + Math.random() * 0.5;
    const t = Math.random();
    if      (t < 0.4) { col[i*3]=b*0.78; col[i*3+1]=b*0.88; col[i*3+2]=b; }
    else if (t < 0.7) { col[i*3]=b;      col[i*3+1]=b;      col[i*3+2]=b; }
    else               { col[i*3]=b;      col[i*3+1]=b*0.85; col[i*3+2]=b*0.65; }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color',    new THREE.BufferAttribute(col, 3));
  return new THREE.Points(geo, new THREE.PointsMaterial({
    size: 0.2, vertexColors: true, transparent: true, opacity: 0.9, sizeAttenuation: true,
  }));
}

function buildNebulaCloud(color: number, px: number, py: number, pz: number, r: number, op: number): THREE.Mesh {
  const geo = new THREE.SphereGeometry(r, 10, 10);
  const mat = new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: op,
    side: THREE.BackSide, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const m = new THREE.Mesh(geo, mat);
  m.position.set(px, py, pz);
  return m;
}

interface LeadInstance {
  instancedMesh: THREE.InstancedMesh;
  instanceIndex: number;
  leadId: string;
  position: THREE.Vector3;
  size: number;
}

export default function MindMapCanvas({ service, leads, selectedLeadId, onLeadSelect }: MindMapCanvasProps) {
  const containerRef  = useRef<HTMLDivElement>(null);
  const onSelectRef   = useRef(onLeadSelect);
  onSelectRef.current = onLeadSelect;

  const sceneRef = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    animFrameId: number;
    leadInstances: LeadInstance[];
    selectionMarker: THREE.Mesh;
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

    // Lighting — fewer, stronger lights beats many per-node lights
    scene.add(new THREE.AmbientLight(0x2233aa, 2.2));
    const sun = new THREE.DirectionalLight(0xffffff, 4.5);
    sun.position.set(10, 14, 8);
    scene.add(sun);
    const rim = new THREE.DirectionalLight(0x4466ff, 1.8);
    rim.position.set(-8, -5, -6);
    scene.add(rim);

    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    camera.position.set(0, 1.5, 11);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(W, H);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.4;
    container.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance  = 3;
    controls.maxDistance  = 32;

    scene.add(buildStarfield());
    scene.add(buildNebulaCloud(0x1a0a50,  25,  12, -40, 35, 0.14));
    scene.add(buildNebulaCloud(0x081830, -30,  -8, -35, 28, 0.12));
    scene.add(buildNebulaCloud(0x0a0830,   5,  25, -50, 40, 0.10));

    const pivot = new THREE.Group();
    scene.add(pivot);

    // Selection marker — pulsing wireframe halo, hidden until a lead is selected
    const selGeo = new THREE.SphereGeometry(1, 18, 18);
    const selMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, wireframe: true,
      transparent: true, opacity: 0.25,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const selectionMarker = new THREE.Mesh(selGeo, selMat);
    selectionMarker.visible = false;
    pivot.add(selectionMarker);

    const leadInstances: LeadInstance[] = [];
    const raycaster = new THREE.Raycaster();

    const handleClick = (e: MouseEvent) => {
      const rect  = renderer.domElement.getBoundingClientRect();
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width)  *  2 - 1,
        ((e.clientY - rect.top)  / rect.height) * -2 + 1,
      );
      raycaster.setFromCamera(mouse, camera);
      // Collect unique InstancedMeshes for raycasting
      const meshSet = new Set(leadInstances.map(l => l.instancedMesh));
      const hits = raycaster.intersectObjects([...meshSet]);
      if (hits.length > 0) {
        const hit = hits[0] as THREE.Intersection & { instanceId?: number };
        if (hit.instanceId !== undefined) {
          const found = leadInstances.find(
            l => l.instancedMesh === hit.object && l.instanceIndex === hit.instanceId,
          );
          if (found) onSelectRef.current(found.leadId);
        }
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
    };
    window.addEventListener('resize', handleResize);

    let animFrameId = 0;
    let time = 0;
    const animate = () => {
      animFrameId = requestAnimationFrame(animate);
      time += 0.016;
      controls.update();
      pivot.rotation.y += 0.0005;
      // Only pulse the selection marker — not 100 individual meshes
      if (selectionMarker.visible) {
        selectionMarker.scale.setScalar(1 + 0.1 * Math.sin(time * 3));
        (selectionMarker.material as THREE.MeshBasicMaterial).opacity =
          0.12 + 0.15 * Math.abs(Math.sin(time * 3));
      }
      renderer.render(scene, camera);
    };
    animate();

    sceneRef.current = {
      renderer, scene, camera, controls,
      animFrameId, leadInstances, selectionMarker, pivot,
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

  // ── Rebuild graph when service/leads change ───────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;
    const { pivot, leadInstances, selectionMarker } = s;

    // Dispose everything except the selection marker
    [...pivot.children].forEach(child => {
      if (child === selectionMarker) return;
      pivot.remove(child);
      child.traverse(obj => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.InstancedMesh) {
          obj.geometry.dispose();
          const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(m => m.dispose());
        }
      });
    });
    leadInstances.length = 0;
    selectionMarker.visible = false;

    if (!service) return;

    // ── Pre-compute positions/sizes for all leads ─────────────────────────
    const allPos  = leads.map((_, i) => getLeadPosition(i, leads.length));
    const allSize = leads.map(l => getNodeSize(l.score));

    // ── Center service planet ─────────────────────────────────────────────
    const CENTER_R   = 0.65;
    const svcColor   = getServiceColor(service.name);
    const svcEmissive = svcColor.clone().multiplyScalar(0.45);

    const centerGeo = new THREE.SphereGeometry(CENTER_R, 48, 48);
    const centerMat = new THREE.MeshPhysicalMaterial({
      color:              svcColor,
      emissive:           svcEmissive,
      emissiveIntensity:  1.1,
      metalness:          0.2,
      roughness:          0.2,
      clearcoat:          1.0,
      clearcoatRoughness: 0.1,
    });
    const centerNode = new THREE.Mesh(centerGeo, centerMat);
    pivot.add(centerNode);

    const svcHex = svcColor.getHex();
    centerNode.add(makeGlowHalo(CENTER_R * 1.55, svcHex, 0.22));
    centerNode.add(makeGlowHalo(CENTER_R * 2.5,  svcHex, 0.08));
    centerNode.add(makeRing(CENTER_R * 2.1, 0.032, svcHex, 0.75, Math.PI * 0.28));
    centerNode.add(makeRing(CENTER_R * 2.9, 0.018, svcHex, 0.45, Math.PI * 0.28, Math.PI * 0.06));

    // One point light at the center — illuminates all surrounding lead nodes
    centerNode.add(new THREE.PointLight(svcHex, 3.5, 20));

    // ── Connection lines — single LineSegments = 1 draw call ─────────────
    if (leads.length > 0) {
      const linePos = new Float32Array(leads.length * 6);
      leads.forEach((_, i) => {
        linePos[i*6+3] = allPos[i].x;
        linePos[i*6+4] = allPos[i].y;
        linePos[i*6+5] = allPos[i].z;
        // origin stays 0,0,0
      });
      const lineGeo = new THREE.BufferGeometry();
      lineGeo.setAttribute('position', new THREE.BufferAttribute(linePos, 3));
      pivot.add(new THREE.LineSegments(lineGeo, new THREE.LineBasicMaterial({
        color: 0x2255aa, opacity: 0.18, transparent: true,
        blending: THREE.AdditiveBlending, depthWrite: false,
      })));
    }

    // ── Lead nodes — InstancedMesh per score tier (3 draw calls total) ───
    type TierGroup = { indices: number[]; positions: THREE.Vector3[]; sizes: number[] };
    const groups: TierGroup[] = [
      { indices: [], positions: [], sizes: [] },
      { indices: [], positions: [], sizes: [] },
      { indices: [], positions: [], sizes: [] },
    ];

    leads.forEach((lead, i) => {
      const g = groups[getTierIndex(lead.score)];
      g.indices.push(i);
      g.positions.push(allPos[i]);
      g.sizes.push(allSize[i]);
    });

    const dummy = new THREE.Object3D();

    TIERS.forEach((tier, ti) => {
      const g = groups[ti];
      if (g.indices.length === 0) return;

      const geo = new THREE.SphereGeometry(1, 18, 18);
      const mat = new THREE.MeshStandardMaterial({
        color:             tier.color,
        emissive:          new THREE.Color(tier.emissive),
        emissiveIntensity: 0.9,
        metalness:         0.2,
        roughness:         0.35,
      });
      const instMesh = new THREE.InstancedMesh(geo, mat, g.indices.length);
      instMesh.castShadow    = false;
      instMesh.receiveShadow = false;

      g.indices.forEach((origIdx, ii) => {
        dummy.position.copy(g.positions[ii]);
        dummy.scale.setScalar(g.sizes[ii]);
        dummy.updateMatrix();
        instMesh.setMatrixAt(ii, dummy.matrix);

        leadInstances.push({
          instancedMesh: instMesh,
          instanceIndex: ii,
          leadId:        leads[origIdx].id,
          position:      g.positions[ii].clone(),
          size:          g.sizes[ii],
        });
      });

      instMesh.instanceMatrix.needsUpdate = true;
      pivot.add(instMesh);
    });
  }, [service, leads]);

  // ── Move selection marker to selected lead ────────────────────────────────
  useEffect(() => {
    const s = sceneRef.current;
    if (!s) return;

    if (!selectedLeadId) {
      s.selectionMarker.visible = false;
      return;
    }
    const found = s.leadInstances.find(l => l.leadId === selectedLeadId);
    if (found) {
      s.selectionMarker.position.copy(found.position);
      s.selectionMarker.scale.setScalar(found.size * 1.7);
      s.selectionMarker.visible = true;
    }
  }, [selectedLeadId]);

  return (
    <div ref={containerRef} className="relative w-full h-full">
      {!service && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <p className="text-[#8899bb] text-sm">Select a service to view its leads</p>
        </div>
      )}
    </div>
  );
}
