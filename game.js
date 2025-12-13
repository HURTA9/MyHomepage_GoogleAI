/**
 * Graze Catcher Game Logic
 */

const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const scoreDisplay = document.getElementById('score-display');
const finalScoreDisplay = document.getElementById('final-score');
const startScreen = document.getElementById('start-screen');
const gameOverScreen = document.getElementById('game-over-screen');
const startBtn = document.getElementById('start-btn');
const restartBtn = document.getElementById('restart-btn');

// Game State
let gameState = 'title'; // title, playing, gameover
let width, height;
let score = 0;
let frames = 0;
let mouseX = 0, mouseY = 0;

// Rhythm System
let beatTimer = 0;
const BPM = 130; // Beats Per Minute
const FRAMES_PER_BEAT = (60 / BPM) * 60; // Assuming 60Hz
let isGrazeMode = false;
let grazeTimer = 0;
const GRAZE_DURATION_FRAMES = 15; // How long graze mode lasts per beat

// Entities
let player;
let bullets = [];
let particles = [];
let textEffects = [];

class Player {
    constructor() {
        this.x = width / 2;
        this.y = height / 2;
        this.radius = 10;
        this.grazeRadius = 50;
        this.color = '#fff';
    }

    update() {
        // Smooth follow mouse
        this.x += (mouseX - this.x) * 0.2;
        this.y += (mouseY - this.y) * 0.2;
    }

    draw() {
        // Graze Field Warning/Active Visuals
        if (isGrazeMode) {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.grazeRadius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 50, 100, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#ff5080';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            // Visualize next beat coming
            const progress = (beatTimer / FRAMES_PER_BEAT);
            const ringSize = this.grazeRadius * (1 - progress); 
            ctx.beginPath();
            ctx.arc(this.x, this.y, Math.max(this.radius, ringSize), 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${0.5 * progress})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        // Draw Player Core
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff';
    }
}

class Bullet {
    constructor() {
        this.reset();
    }

    reset() {
        // Spawn from edges
        const side = Math.floor(Math.random() * 4);
        if (side === 0) { // Top
            this.x = Math.random() * width;
            this.y = -20;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = Math.random() * 3 + 2;
        } else if (side === 1) { // Right
            this.x = width + 20;
            this.y = Math.random() * height;
            this.vx = -(Math.random() * 3 + 2);
            this.vy = (Math.random() - 0.5) * 2;
        } else if (side === 2) { // Bottom
            this.x = Math.random() * width;
            this.y = height + 20;
            this.vx = (Math.random() - 0.5) * 2;
            this.vy = -(Math.random() * 3 + 2);
        } else { // Left
            this.x = -20;
            this.y = Math.random() * height;
            this.vx = Math.random() * 3 + 2;
            this.vy = (Math.random() - 0.5) * 2;
        }

        this.radius = 6;
        this.color = '#0ff';
        this.active = true;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;

        // Reset if out of bounds (simplified pool)
        if (this.x < -100 || this.x > width + 100 || this.y < -100 || this.y > height + 100) {
            this.active = false; // Mark for removal or reuse
        }
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.vx = (Math.random() - 0.5) * 10;
        this.vy = (Math.random() - 0.5) * 10;
        this.life = 1.0;
        this.color = color;
    }

    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= 0.05;
    }

    draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, 4, 4);
        ctx.globalAlpha = 1.0;
    }
}

class TextEffect {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
        this.vy = -1;
    }

    update() {
        this.y += this.vy;
        this.life -= 0.02;
    }

    draw() {
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 20px "Courier New"';
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, this.x, this.y);
        ctx.globalAlpha = 1.0;
    }
}

function resize() {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
}

window.addEventListener('resize', resize);
window.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
});

function init() {
    resize();
    player = new Player();
    bullets = [];
    particles = [];
    textEffects = [];
    score = 0;
    scoreDisplay.textContent = score;
    gameState = 'playing';
    startScreen.classList.remove('active');
    gameOverScreen.classList.remove('active');
    
    // Initial bullets
    for(let i=0; i<5; i++) {
        bullets.push(new Bullet());
    }
}

function gameOver() {
    gameState = 'gameover';
    finalScoreDisplay.textContent = score;
    gameOverScreen.classList.add('active');
}

function checkCollision(b) {
    const dx = b.x - player.x;
    const dy = b.y - player.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (isGrazeMode) {
        // Graze Collision (Good!)
        if (dist < player.grazeRadius + b.radius) {
            // Caught!
            score += 100;
            scoreDisplay.textContent = score;
            createExplosion(b.x, b.y, '#ff5080'); // Pink explosion
            createText(b.x, b.y, "GRAZE!", '#ff5080');
            return true; // Bullet consumed
        }
    } else {
        // Normal Collision (Bad!)
        if (dist < player.radius + b.radius) {
            gameOver();
            return true;
        }
    }
    return false;
}

function createExplosion(x, y, color) {
    for(let i=0; i<10; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function createText(x, y, text, color) {
    textEffects.push(new TextEffect(x, y, text, color));
}

function update() {
    if (gameState !== 'playing') return;

    frames++;
    
    // Beat System
    beatTimer++;
    if (beatTimer >= FRAMES_PER_BEAT) {
        beatTimer = 0;
        isGrazeMode = true;
        grazeTimer = GRAZE_DURATION_FRAMES;
        
        // Visual Beat Effect on Screen
        // (Optional: Flash background slightly)
    }

    if (isGrazeMode) {
        grazeTimer--;
        if (grazeTimer <= 0) {
            isGrazeMode = false;
        }
    }

    // Difficulty ramp up
    if (frames % 60 === 0 && bullets.length < 50) {
        bullets.push(new Bullet());
    }

    player.update();

    // Update Entities
    for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i];
        b.update();
        if (!b.active) {
            bullets.splice(i, 1);
            bullets.push(new Bullet()); // Respawn immediately to keep density
        } else {
            if (checkCollision(b)) {
                bullets.splice(i, 1);
                bullets.push(new Bullet());
            }
        }
    }

    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.update();
        if (p.life <= 0) particles.splice(i, 1);
    }
    
    for (let i = textEffects.length - 1; i >= 0; i--) {
        const t = textEffects[i];
        t.update();
        if (t.life <= 0) textEffects.splice(i, 1);
    }
}

function draw() {
    // Clear Background
    ctx.fillStyle = 'rgba(8, 8, 16, 0.3)'; // Trail effect
    ctx.fillRect(0, 0, width, height);

    if (gameState === 'playing') {
        // Draw Beat Grid/Visuals
        if (isGrazeMode) {
            ctx.fillStyle = 'rgba(255, 50, 100, 0.05)';
            ctx.fillRect(0, 0, width, height);
        }

        player.draw();

        bullets.forEach(b => b.draw());
        particles.forEach(p => p.draw());
        textEffects.forEach(t => t.draw());
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

// Event Listeners
startBtn.addEventListener('click', init);
restartBtn.addEventListener('click', init);

// Initial Resize
resize();
loop();
