import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';

export default function StackTowerGame() {
  const mountRef = useRef(null);
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const gameStateRef = useRef({
    blocks: [],
    currentBlock: null,
    direction: 1,
    speed: 0.05,
    isMoving: true,
    baseSize: { width: 3, depth: 3, height: 0.5 },
    lastBlockSize: { width: 3, depth: 3 },
    cameraTargetY: 0
  });

  useEffect(() => {
    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x5ca8a8);
    
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    camera.position.set(8, 8, 8);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    mountRef.current.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create ground plane (invisible)
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Function to get color based on height
    const getColorForHeight = (height) => {
      const hue = (height * 10) % 360;
      return new THREE.Color().setHSL(hue / 360, 0.7, 0.6);
    };

    // Create base block
    const createBlock = (x, y, z, width, height, depth, isBase = false) => {
      const geometry = new THREE.BoxGeometry(width, height, depth);
      const color = getColorForHeight(y);
      const material = new THREE.MeshStandardMaterial({ 
        color: color,
        roughness: 0.4,
        metalness: 0.1
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      
      return {
        mesh,
        position: { x, y, z },
        size: { width, height, depth }
      };
    };

    // Initialize first block
    const baseBlock = createBlock(0, 0, 0, 
      gameStateRef.current.baseSize.width, 
      gameStateRef.current.baseSize.height, 
      gameStateRef.current.baseSize.depth, 
      true
    );
    gameStateRef.current.blocks.push(baseBlock);

    // Create moving block
    const createMovingBlock = () => {
      const lastBlock = gameStateRef.current.blocks[gameStateRef.current.blocks.length - 1];
      const newY = lastBlock.position.y + gameStateRef.current.baseSize.height;
      const axis = gameStateRef.current.blocks.length % 2; // Alternate between X and Z axis
      
      const startX = axis === 0 ? -5 : lastBlock.position.x;
      const startZ = axis === 1 ? -5 : lastBlock.position.z;
      
      const currentBlock = createBlock(
        startX,
        newY,
        startZ,
        gameStateRef.current.lastBlockSize.width,
        gameStateRef.current.baseSize.height,
        gameStateRef.current.lastBlockSize.depth
      );
      
      gameStateRef.current.currentBlock = {
        ...currentBlock,
        axis: axis
      };
    };

    createMovingBlock();

    // Click handler
    const handleClick = () => {
      if (gameOver) return;
      if (!gameStateRef.current.isMoving) return;

      const current = gameStateRef.current.currentBlock;
      const last = gameStateRef.current.blocks[gameStateRef.current.blocks.length - 1];
      
      // Calculate overlap
      let overlap;
      let overhang;
      let newSize = { ...current.size };
      let newPosition = { ...current.position };
      
      if (current.axis === 0) { // Moving along X
        const diff = current.position.x - last.position.x;
        overlap = last.size.width - Math.abs(diff);
        
        if (overlap <= 0) {
          // Game over
          setGameOver(true);
          gameStateRef.current.isMoving = false;
          return;
        }
        
        overhang = last.size.width - overlap;
        newSize.width = overlap;
        newPosition.x = last.position.x + diff / 2;
        
        // Remove overhang
        if (Math.abs(diff) > 0.1) {
          const overhangBlock = createBlock(
            current.position.x + (diff > 0 ? overlap / 2 : -overlap / 2),
            current.position.y,
            current.position.z,
            overhang,
            current.size.height,
            current.size.depth
          );
          
          // Animate falling overhang
          const fallAnimation = () => {
            overhangBlock.mesh.position.y -= 0.2;
            overhangBlock.mesh.rotation.x += 0.1;
            overhangBlock.mesh.rotation.z += 0.05;
            
            if (overhangBlock.mesh.position.y > -10) {
              requestAnimationFrame(fallAnimation);
            } else {
              scene.remove(overhangBlock.mesh);
            }
          };
          fallAnimation();
        }
        
        gameStateRef.current.lastBlockSize.width = overlap;
      } else { // Moving along Z
        const diff = current.position.z - last.position.z;
        overlap = last.size.depth - Math.abs(diff);
        
        if (overlap <= 0) {
          // Game over
          setGameOver(true);
          gameStateRef.current.isMoving = false;
          return;
        }
        
        overhang = last.size.depth - overlap;
        newSize.depth = overlap;
        newPosition.z = last.position.z + diff / 2;
        
        // Remove overhang
        if (Math.abs(diff) > 0.1) {
          const overhangBlock = createBlock(
            current.position.x,
            current.position.y,
            current.position.z + (diff > 0 ? overlap / 2 : -overlap / 2),
            current.size.width,
            current.size.height,
            overhang
          );
          
          // Animate falling overhang
          const fallAnimation = () => {
            overhangBlock.mesh.position.y -= 0.2;
            overhangBlock.mesh.rotation.x += 0.05;
            overhangBlock.mesh.rotation.z += 0.1;
            
            if (overhangBlock.mesh.position.y > -10) {
              requestAnimationFrame(fallAnimation);
            } else {
              scene.remove(overhangBlock.mesh);
            }
          };
          fallAnimation();
        }
        
        gameStateRef.current.lastBlockSize.depth = overlap;
      }
      
      // Update current block
      scene.remove(current.mesh);
      const finalBlock = createBlock(
        newPosition.x,
        newPosition.y,
        newPosition.z,
        newSize.width,
        newSize.height,
        newSize.depth
      );
      
      gameStateRef.current.blocks.push(finalBlock);
      setScore(gameStateRef.current.blocks.length - 1);
      
      // Increase difficulty
      gameStateRef.current.speed = Math.min(0.15, 0.05 + gameStateRef.current.blocks.length * 0.005);
      
      // Create next block
      createMovingBlock();
      
      // Update camera target
      gameStateRef.current.cameraTargetY = finalBlock.position.y;
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('touchstart', handleClick);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);

      if (gameStateRef.current.isMoving && gameStateRef.current.currentBlock) {
        const current = gameStateRef.current.currentBlock;
        
        if (current.axis === 0) { // Move along X
          current.mesh.position.x += gameStateRef.current.speed * gameStateRef.current.direction;
          current.position.x = current.mesh.position.x;
          
          if (current.mesh.position.x > 5 || current.mesh.position.x < -5) {
            gameStateRef.current.direction *= -1;
          }
        } else { // Move along Z
          current.mesh.position.z += gameStateRef.current.speed * gameStateRef.current.direction;
          current.position.z = current.mesh.position.z;
          
          if (current.mesh.position.z > 5 || current.mesh.position.z < -5) {
            gameStateRef.current.direction *= -1;
          }
        }
      }

      // Smooth camera follow
      const targetY = gameStateRef.current.cameraTargetY + 5;
      camera.position.y += (targetY - camera.position.y) * 0.05;
      camera.lookAt(0, gameStateRef.current.cameraTargetY, 0);

      renderer.render(scene, camera);
    };

    animate();

    // Handle window resize
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('touchstart', handleClick);
      window.removeEventListener('resize', handleResize);
      mountRef.current?.removeChild(renderer.domElement);
    };
  }, [gameOver]);

  const resetGame = () => {
    setScore(0);
    setGameOver(false);
    gameStateRef.current = {
      blocks: [],
      currentBlock: null,
      direction: 1,
      speed: 0.05,
      isMoving: true,
      baseSize: { width: 3, depth: 3, height: 0.5 },
      lastBlockSize: { width: 3, depth: 3 },
      cameraTargetY: 0
    };
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      
      {gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'rgba(255, 255, 255, 0.95)',
          padding: '40px',
          borderRadius: '20px',
          textAlign: 'center',
          boxShadow: '0 10px 40px rgba(0,0,0,0.3)'
        }}>
          <h1 style={{ fontSize: '48px', margin: '0 0 20px 0', color: '#333' }}>Game Over!</h1>
          <p style={{ fontSize: '24px', margin: '0 0 30px 0', color: '#666' }}>Score: {score}</p>
          <button
            onClick={resetGame}
            style={{
              fontSize: '20px',
              padding: '15px 40px',
              background: '#5ca8a8',
              color: 'white',
              border: 'none',
              borderRadius: '10px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            Play Again
          </button>
        </div>
      )}
      
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '32px',
        fontWeight: 'bold',
        color: 'white',
        textShadow: '2px 2px 4px rgba(0,0,0,0.3)',
        pointerEvents: 'none'
      }}>
        {score}
      </div>
      
      <div style={{
        position: 'absolute',
        bottom: '40px',
        left: '50%',
        transform: 'translateX(-50%)',
        fontSize: '18px',
        color: 'white',
        textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
        pointerEvents: 'none'
      }}>
        Click to stack
      </div>
    </div>
  );
}