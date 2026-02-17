import * as THREE from 'three';

// Image tilt effect based on mouse position
const pic = document.querySelector('.pic');

pic.addEventListener('mousemove', (e) => {
    const rect = pic.getBoundingClientRect();
    const x = e.clientX - rect.left; // Mouse X position within the element
    const y = e.clientY - rect.top;  // Mouse Y position within the element
    
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;
    
    // Calculate rotation based on distance from center
    // Normalize to -1 to 1 range
    const rotateY = ((x - centerX) / centerX) * 15; // Max 15 degrees left/right
    const rotateX = ((centerY - y) / centerY) * 15; // Max 15 degrees up/down
    
    pic.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg)`;
});

pic.addEventListener('mouseleave', () => {
    // Reset to flat when mouse leaves
    pic.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg)';
});

// Game state
let gameState = {
    scene: null,
    camera: null,
    renderer: null,
    blocks: [],
    currentBlock: null,
    direction: 1,
    speed: 0.05,
    isMoving: true,
    baseSize: { width: 3, depth: 3, height: 0.5 },
    lastBlockSize: { width: 3, depth: 3 },
    cameraTargetY: 0,
    score: 0,
    gameOver: false,
    animationId: null,
    clickHandler: null
};

// Initialize game
function initGame() {
    const container = document.getElementById('gameContainer');
    container.innerHTML = ''; // Clear previous game
    
    // Scene setup
    gameState.scene = new THREE.Scene();
    gameState.scene.background = new THREE.Color(0x5ca8a8);
    
    gameState.camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        1000
    );
    gameState.camera.position.set(8, 8, 8);
    gameState.camera.lookAt(0, 0, 0);

    gameState.renderer = new THREE.WebGLRenderer({ antialias: true });
    gameState.renderer.setSize(window.innerWidth, window.innerHeight);
    gameState.renderer.shadowMap.enabled = true;
    container.appendChild(gameState.renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    gameState.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    gameState.scene.add(directionalLight);

    // Create ground plane
    const groundGeometry = new THREE.PlaneGeometry(50, 50);
    const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.3 });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    gameState.scene.add(ground);

    // Create UI elements
    createGameUI(container);

    // Initialize game state
    gameState.blocks = [];
    gameState.score = 0;
    gameState.gameOver = false;
    gameState.isMoving = true;
    gameState.direction = 1;
    gameState.speed = 0.05;
    gameState.lastBlockSize = { width: 3, depth: 3 };
    gameState.cameraTargetY = 0;

    // Create base block
    const baseBlock = createBlock(0, 0, 0, 
        gameState.baseSize.width, 
        gameState.baseSize.height, 
        gameState.baseSize.depth
    );
    gameState.blocks.push(baseBlock);

    // Create first moving block
    createMovingBlock();

    // Set up click handler
    gameState.clickHandler = handleClick;
    window.addEventListener('click', gameState.clickHandler);
    window.addEventListener('touchstart', gameState.clickHandler);

    // Start animation
    animate();
}

function createGameUI(container) {
    // Score display
    const scoreDiv = document.createElement('div');
    scoreDiv.id = 'gameScore';
    scoreDiv.style.cssText = `
        position: absolute;
        top: 80px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 48px;
        font-weight: bold;
        color: white;
        text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        pointer-events: none;
        font-family: 'Domine', serif;
    `;
    scoreDiv.textContent = '0';
    container.appendChild(scoreDiv);

    // Instructions
    const instructionsDiv = document.createElement('div');
    instructionsDiv.id = 'gameInstructions';
    instructionsDiv.style.cssText = `
        position: absolute;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        font-size: 18px;
        color: white;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        pointer-events: none;
        font-family: 'Domine', serif;
    `;
    instructionsDiv.textContent = 'Click to stack';
    container.appendChild(instructionsDiv);

    // Game over overlay (hidden initially)
    const gameOverDiv = document.createElement('div');
    gameOverDiv.id = 'gameOverScreen';
    gameOverDiv.style.cssText = `
        display: none;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        background: rgba(255, 255, 255, 0.95);
        padding: 40px 60px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 10px 40px rgba(0,0,0,0.3);
    `;
    gameOverDiv.innerHTML = `
        <h1 style="font-size: 48px; margin: 0 0 20px 0; color: #333; font-family: 'Domine', serif;">Game Over!</h1>
        <p style="font-size: 24px; margin: 0 0 30px 0; color: #666; font-family: 'Domine', serif;">Score: <span id="finalScore">0</span></p>
        <button id="restartGame" style="
            font-size: 20px;
            padding: 15px 40px;
            background: #5ca8a8;
            color: white;
            border: none;
            border-radius: 10px;
            cursor: pointer;
            font-weight: bold;
            font-family: 'Domine', serif;
            transition: transform 0.2s ease;
        ">Play Again</button>
    `;
    container.appendChild(gameOverDiv);
}

function getColorForHeight(height) {
    const hue = (height * 10) % 360;
    return new THREE.Color().setHSL(hue / 360, 0.7, 0.6);
}

function createBlock(x, y, z, width, height, depth) {
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
    gameState.scene.add(mesh);
    
    return {
        mesh,
        position: { x, y, z },
        size: { width, height, depth }
    };
}

function createMovingBlock() {
    const lastBlock = gameState.blocks[gameState.blocks.length - 1];
    const newY = lastBlock.position.y + gameState.baseSize.height;
    const axis = gameState.blocks.length % 2;
    
    const startX = axis === 0 ? -5 : lastBlock.position.x;
    const startZ = axis === 1 ? -5 : lastBlock.position.z;
    
    const currentBlock = createBlock(
        startX,
        newY,
        startZ,
        gameState.lastBlockSize.width,
        gameState.baseSize.height,
        gameState.lastBlockSize.depth
    );
    
    gameState.currentBlock = {
        ...currentBlock,
        axis: axis
    };
}

function handleClick(e) {
    // Ignore clicks on close button and restart button
    if (e.target.id === 'closeGame' || e.target.id === 'restartGame') return;
    
    if (gameState.gameOver) return;
    if (!gameState.isMoving) return;

    const current = gameState.currentBlock;
    const last = gameState.blocks[gameState.blocks.length - 1];
    
    let overlap;
    let newSize = { ...current.size };
    let newPosition = { ...current.position };
    
    if (current.axis === 0) {
        const diff = current.position.x - last.position.x;
        overlap = last.size.width - Math.abs(diff);
        
        if (overlap <= 0) {
            endGame();
            return;
        }
        
        const overhang = last.size.width - overlap;
        newSize.width = overlap;
        newPosition.x = last.position.x + diff / 2;
        
        if (Math.abs(diff) > 0.1) {
            createFallingBlock(
                current.position.x + (diff > 0 ? overlap / 2 : -overlap / 2),
                current.position.y,
                current.position.z,
                overhang,
                current.size.height,
                current.size.depth
            );
        }
        
        gameState.lastBlockSize.width = overlap;
    } else {
        const diff = current.position.z - last.position.z;
        overlap = last.size.depth - Math.abs(diff);
        
        if (overlap <= 0) {
            endGame();
            return;
        }
        
        const overhang = last.size.depth - overlap;
        newSize.depth = overlap;
        newPosition.z = last.position.z + diff / 2;
        
        if (Math.abs(diff) > 0.1) {
            createFallingBlock(
                current.position.x,
                current.position.y,
                current.position.z + (diff > 0 ? overlap / 2 : -overlap / 2),
                current.size.width,
                current.size.height,
                overhang
            );
        }
        
        gameState.lastBlockSize.depth = overlap;
    }
    
    // Update current block
    gameState.scene.remove(current.mesh);
    const finalBlock = createBlock(
        newPosition.x,
        newPosition.y,
        newPosition.z,
        newSize.width,
        newSize.height,
        newSize.depth
    );
    
    gameState.blocks.push(finalBlock);
    gameState.score++;
    document.getElementById('gameScore').textContent = gameState.score;
    
    // Increase difficulty
    gameState.speed = Math.min(0.15, 0.05 + gameState.blocks.length * 0.005);
    
    // Create next block
    createMovingBlock();
    
    // Update camera target
    gameState.cameraTargetY = finalBlock.position.y;
}

function createFallingBlock(x, y, z, width, height, depth) {
    const overhangBlock = createBlock(x, y, z, width, height, depth);
    
    const fallAnimation = () => {
        overhangBlock.mesh.position.y -= 0.2;
        overhangBlock.mesh.rotation.x += 0.1;
        overhangBlock.mesh.rotation.z += 0.05;
        
        if (overhangBlock.mesh.position.y > -10) {
            requestAnimationFrame(fallAnimation);
        } else {
            gameState.scene.remove(overhangBlock.mesh);
        }
    };
    fallAnimation();
}

function endGame() {
    gameState.gameOver = true;
    gameState.isMoving = false;
    
    const gameOverScreen = document.getElementById('gameOverScreen');
    document.getElementById('finalScore').textContent = gameState.score;
    gameOverScreen.style.display = 'block';
    
    document.getElementById('restartGame').onclick = () => {
        gameOverScreen.style.display = 'none';
        cleanupGame();
        initGame();
    };
}

function animate() {
    gameState.animationId = requestAnimationFrame(animate);

    if (gameState.isMoving && gameState.currentBlock) {
        const current = gameState.currentBlock;
        
        if (current.axis === 0) {
            current.mesh.position.x += gameState.speed * gameState.direction;
            current.position.x = current.mesh.position.x;
            
            if (current.mesh.position.x > 5 || current.mesh.position.x < -5) {
                gameState.direction *= -1;
            }
        } else {
            current.mesh.position.z += gameState.speed * gameState.direction;
            current.position.z = current.mesh.position.z;
            
            if (current.mesh.position.z > 5 || current.mesh.position.z < -5) {
                gameState.direction *= -1;
            }
        }
    }

    // Smooth camera follow
    const targetY = gameState.cameraTargetY + 5;
    gameState.camera.position.y += (targetY - gameState.camera.position.y) * 0.05;
    gameState.camera.lookAt(0, gameState.cameraTargetY, 0);

    gameState.renderer.render(gameState.scene, gameState.camera);
}

function cleanupGame() {
    // Cancel animation
    if (gameState.animationId) {
        cancelAnimationFrame(gameState.animationId);
    }
    
    // Remove event listeners
    if (gameState.clickHandler) {
        window.removeEventListener('click', gameState.clickHandler);
        window.removeEventListener('touchstart', gameState.clickHandler);
    }
    
    // Clean up Three.js objects
    if (gameState.scene) {
        gameState.scene.traverse((object) => {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(material => material.dispose());
                } else {
                    object.material.dispose();
                }
            }
        });
    }
    
    if (gameState.renderer) {
        gameState.renderer.dispose();
    }
}

// Modal controls
const modal = document.getElementById('gameModal');
const openBtn = document.getElementById('openGame');
const closeBtn = document.getElementById('closeGame');

openBtn.addEventListener('click', (e) => {
    e.stopPropagation(); // Prevent click from triggering game
    modal.classList.add('active');
    initGame();
});

closeBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    modal.classList.remove('active');
    cleanupGame();
});

// Handle window resize
window.addEventListener('resize', () => {
    if (gameState.camera && gameState.renderer && modal.classList.contains('active')) {
        gameState.camera.aspect = window.innerWidth / window.innerHeight;
        gameState.camera.updateProjectionMatrix();
        gameState.renderer.setSize(window.innerWidth, window.innerHeight);
    }
});

// Close on escape key
window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('active')) {
        modal.classList.remove('active');
        cleanupGame();
    }
});