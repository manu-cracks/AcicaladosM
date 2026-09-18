import React, { Suspense, useRef, useState, useEffect, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, useGLTF, Center, ContactShadows, Environment } from '@react-three/drei';
import { Plus, Minus, RotateCcw } from 'lucide-react';
import * as THREE from 'three';

const MODEL_PATH = '/modelo/modeloBar3D.glb';

// Preload 3D model asset
useGLTF.preload(MODEL_PATH);

function BarberModel() {
  const { scene } = useGLTF(MODEL_PATH);
  const modelRef = useRef<THREE.Group>(null);

  return (
    <Center top position={[0, -0.45, 0]}>
      <primitive
        ref={modelRef}
        object={scene}
        scale={2.3}
        dispose={null}
      />
    </Center>
  );
}

function LoaderFallback() {
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-transparent pointer-events-none">
      <div className="w-10 h-10 rounded-full border-2 border-[#C8A45C]/20 border-t-[#C8A45C] animate-spin" />
    </div>
  );
}

interface ModelViewerProps {
  className?: string;
  height?: string;
}

export const ModelViewer: React.FC<ModelViewerProps> = ({
  className = 'w-full h-full',
  height = '',
}) => {
  const controlsRef = useRef<any>(null);
  const [isCtrlPressed, setIsCtrlPressed] = useState<boolean>(false);
  const [showScrollHint, setShowScrollHint] = useState<boolean>(false);
  const hintTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Escuchar teclas Ctrl / Meta (Cmd en Mac) para habilitar zoom intencional con scroll
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(true);
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Control' || e.key === 'Meta') {
        setIsCtrlPressed(false);
      }
    };

    const handleBlur = () => {
      setIsCtrlPressed(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlur);
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
    };
  }, []);

  // Mostrar sugerencia visual flotante si el usuario scrollea sin presionar Ctrl
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) {
      setShowScrollHint(true);
      if (hintTimeoutRef.current) {
        clearTimeout(hintTimeoutRef.current);
      }
      hintTimeoutRef.current = setTimeout(() => {
        setShowScrollHint(false);
      }, 1600);
    }
  }, []);

  // Control programático de zoom para botones UI (+ / -)
  const handleZoom = (factor: number) => {
    if (controlsRef.current) {
      const controls = controlsRef.current;
      const camera = controls.object as THREE.PerspectiveCamera;
      const target = controls.target as THREE.Vector3;

      const offset = new THREE.Vector3().subVectors(camera.position, target);
      const newDistance = THREE.MathUtils.clamp(offset.length() * factor, 1.0, 8.5);
      offset.setLength(newDistance);
      camera.position.copy(target).add(offset);
      controls.update();
    }
  };

  // Restablecer posición de cámara y target
  const handleReset = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  return (
    <div
      onWheel={handleWheel}
      className={`relative bg-transparent pointer-events-auto select-none ${height} ${className}`}
    >
      {/* Mensaje sutil estilo Google Maps cuando se intenta hacer scroll normal */}
      {showScrollHint && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none transition-all duration-300 animate-in fade-in zoom-in-95">
          <div className="px-4 py-2 rounded-full bg-black/85 backdrop-blur-md border border-[#C8A45C]/40 text-xs text-[#E6C875] font-medium shadow-2xl flex items-center gap-2">
            <span className="px-1.5 py-0.5 rounded bg-[#C8A45C]/20 border border-[#C8A45C]/35 text-[11px] font-mono text-[#E6C875]">
              Ctrl
            </span>
            <span>+ Rueda para hacer zoom al modelo</span>
          </div>
        </div>
      )}

      {/* Botones de control de zoom elegante y accesible (para móvil y desktop) */}
      <div className="absolute bottom-6 right-6 z-30 flex flex-col gap-2 pointer-events-auto">
        <button
          type="button"
          onClick={() => handleZoom(0.8)}
          title="Acercar modelo (+)"
          className="w-9 h-9 rounded-xl bg-black/80 hover:bg-[#C8A45C]/25 border border-[#C8A45C]/35 hover:border-[#C8A45C] text-[#E6C875] flex items-center justify-center backdrop-blur-md transition shadow-lg active:scale-95 cursor-pointer"
          aria-label="Acercar modelo 3D"
        >
          <Plus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => handleZoom(1.25)}
          title="Alejar modelo (-)"
          className="w-9 h-9 rounded-xl bg-black/80 hover:bg-[#C8A45C]/25 border border-[#C8A45C]/35 hover:border-[#C8A45C] text-[#E6C875] flex items-center justify-center backdrop-blur-md transition shadow-lg active:scale-95 cursor-pointer"
          aria-label="Alejar modelo 3D"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={handleReset}
          title="Restablecer vista"
          className="w-9 h-9 rounded-xl bg-black/80 hover:bg-[#C8A45C]/25 border border-[#C8A45C]/35 hover:border-[#C8A45C] text-[#E6C875] flex items-center justify-center backdrop-blur-md transition shadow-lg active:scale-95 cursor-pointer"
          aria-label="Restablecer vista del modelo 3D"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      <Suspense fallback={<LoaderFallback />}>
        <Canvas
          shadows
          camera={{ position: [0, 0.8, 4.8], fov: 48, near: 0.1, far: 1000 }}
          gl={{ antialias: true, alpha: true }}
          style={{ width: '100%', height: '100%' }}
        >
          {/* Entorno de reflejos HDRI */}
          <Environment preset="city" />

          {/* Iluminación de estudio */}
          <ambientLight intensity={1.8} />

          <directionalLight
            position={[10, 10, 10]}
            intensity={2.5}
            color="#FFF8F0"
            castShadow
            shadow-mapSize={[1024, 1024]}
          />

          <directionalLight
            position={[-10, 8, -5]}
            intensity={1.5}
            color="#FCE794"
          />

          <directionalLight
            position={[0, -5, 5]}
            intensity={0.8}
            color="#D4AF37"
          />

          <pointLight position={[0, 4, 3]} intensity={1.8} color="#FFFFFF" />
          <pointLight position={[-4, 2, 2]} intensity={1.2} color="#FFF8E7" />

          {/* Modelo 3D */}
          <BarberModel />

          {/* Sombra de contacto */}
          <ContactShadows
            position={[0, -0.65, 0]}
            opacity={0.65}
            scale={6}
            blur={2.4}
            far={4}
            color="#000000"
          />

          {/* OrbitControls condicionado: Solo hace zoom si isCtrlPressed es true */}
          <OrbitControls
            ref={controlsRef}
            target={[0, 0.1, 0]}
            enablePan={false}
            enableZoom={isCtrlPressed}
            minDistance={1.0}
            maxDistance={8.5}
            minPolarAngle={Math.PI / 6}
            maxPolarAngle={Math.PI / 2 + 0.05}
            autoRotate={true}
            autoRotateSpeed={1.2}
            dampingFactor={0.06}
            makeDefault
          />
        </Canvas>
      </Suspense>
    </div>
  );
};

export default ModelViewer;
