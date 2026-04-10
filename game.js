const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const WIDTH = 800;
const HEIGHT = 600;
canvas.width = WIDTH;
canvas.height = HEIGHT;

// 色
const PASTEL_PINK = '#FFB6C1';
const PASTEL_BLUE = '#ADD8E6';
const PASTEL_YELLOW = '#FFFFE0';
const WHITE = '#FFFFFF';
const BLACK = '#000000';
const RAINBOW = ['#FF0000','#FFA500','#FFFF00','#008000','#0000FF','#4B0082','#EE82EE'];

// 画像ロード
function loadImage(src) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

// フォールバック用の円形サーフェス描画
function drawFallbackCircle(color, size) {
  const offscreen = document.createElement('canvas');
  offscreen.width = size;
  offscreen.height = size;
  const c = offscreen.getContext('2d');
  c.fillStyle = color;
  c.beginPath();
  c.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  c.fill();
  return offscreen;
}

// カメラ
class Camera {
  constructor() {
    this.x = 0;
    this.y = 0;
  }
  update(target) {
    const targetX = -target.x + WIDTH / 2;
    const targetY = -target.y + HEIGHT / 2;
    this.x += (targetX - this.x) * 0.1;
    this.y += (targetY - this.y) * 0.1;
  }
  apply(x, y) {
    return { x: x + this.x, y: y + this.y };
  }
}

// パーティクル
class Particle {
  constructor(x, y, color, type = 'star') {
    this.x = x;
    this.y = y;
    this.color = color;
    this.type = type;
    this.life = 255;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.size = Math.random() * 5 + 3;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.life -= 10;
    if (this.type === 'float') this.vy -= 0.1;
  }
  draw(camera) {
    if (this.life <= 0) return;
    const pos = camera.apply(this.x, this.y);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / 255);
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

// プレイヤー
class Player {
  constructor(x, y, img) {
    this.x = x;
    this.y = y;
    this.w = 50;
    this.h = 50;
    this.speed = 5;
    this.img = img;
    this.particles = [];
  }
  update(keys) {
    let dx = 0, dy = 0;
    if (keys['ArrowLeft'] || keys['a']) dx -= 1;
    if (keys['ArrowRight'] || keys['d']) dx += 1;
    if (keys['ArrowUp'] || keys['w']) dy -= 1;
    if (keys['ArrowDown'] || keys['s']) dy += 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      this.x += (dx / len) * this.speed;
      this.y += (dy / len) * this.speed;
      if (Math.random() < 0.3) {
        this.particles.push(new Particle(this.x, this.y + this.h / 2, PASTEL_YELLOW, 'star'));
      }
    }
    this.particles = this.particles.filter(p => { p.update(); return p.life > 0; });
  }
  draw(camera) {
    this.particles.forEach(p => p.draw(camera));
    const pos = camera.apply(this.x - this.w / 2, this.y - this.h / 2);
    if (this.img) {
      ctx.drawImage(this.img, pos.x, pos.y, this.w, this.h);
    } else {
      ctx.fillStyle = '#6464FF';
      ctx.beginPath();
      ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  getHitbox() {
    return { x: this.x - 15, y: this.y - 15, w: 30, h: 30 };
  }
}

// ワーム
class Worm {
  constructor(x, y, imgs) {
    this.x = x;
    this.y = y;
    this.speed = 2.5;
    this.length = 5;
    this.spacing = 15;
    this.history = Array(200).fill(null).map(() => ({ x, y }));
    this.imgs = imgs; // { head, body, tail }
    this.particles = [];
    this.size = 60;
  }
  update(targetX, targetY) {
    const dx = targetX - this.x;
    const dy = targetY - this.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 0) {
      this.x += (dx / dist) * this.speed;
      this.y += (dy / dist) * this.speed;
    }
    this.history.unshift({ x: this.x, y: this.y });
    if (this.history.length > this.length * this.spacing + 10) this.history.pop();

    if (Math.random() < 0.5) {
      this.particles.push(new Particle(this.x, this.y, RAINBOW[Math.floor(Math.random() * RAINBOW.length)], 'float'));
    }
    this.particles = this.particles.filter(p => { p.update(); return p.life > 0; });
  }
  draw(camera) {
    this.particles.forEach(p => p.draw(camera));
    const half = this.size / 2;

    // tail
    const tailIdx = Math.min(this.history.length - 1, (this.length - 1) * this.spacing);
    const tail = this.history[tailIdx];
    const tailPos = camera.apply(tail.x - half, tail.y - half);
    if (this.imgs.tail) ctx.drawImage(this.imgs.tail, tailPos.x, tailPos.y, this.size, this.size);
    else { ctx.fillStyle = '#966464'; ctx.beginPath(); ctx.arc(tailPos.x + half, tailPos.y + half, half, 0, Math.PI * 2); ctx.fill(); }

    // body
    for (let i = this.length - 2; i > 0; i--) {
      const idx = Math.min(this.history.length - 1, i * this.spacing);
      const seg = this.history[idx];
      const segPos = camera.apply(seg.x - half, seg.y - half);
      if (this.imgs.body) ctx.drawImage(this.imgs.body, segPos.x, segPos.y, this.size, this.size);
      else { ctx.fillStyle = '#C86464'; ctx.beginPath(); ctx.arc(segPos.x + half, segPos.y + half, half, 0, Math.PI * 2); ctx.fill(); }
    }

    // head
    const headPos = camera.apply(this.x - half, this.y - half);
    if (this.imgs.head) ctx.drawImage(this.imgs.head, headPos.x, headPos.y, this.size, this.size);
    else { ctx.fillStyle = '#FF6464'; ctx.beginPath(); ctx.arc(headPos.x + half, headPos.y + half, half, 0, Math.PI * 2); ctx.fill(); }
  }
  getHitbox() {
    return { x: this.x - 15, y: this.y - 15, w: 30, h: 30 };
  }
}

// アイテム
class Item {
  constructor(x, y, img) {
    this.x = x;
    this.y = y;
    this.w = 40;
    this.h = 40;
    this.img = img;
    this.floatOffset = Math.random() * Math.PI * 2;
  }
  draw(camera, now) {
    const offsetY = Math.sin(now / 300 + this.floatOffset) * 5;
    const pos = camera.apply(this.x - this.w / 2, this.y - this.h / 2 + offsetY);
    if (this.img) {
      ctx.drawImage(this.img, pos.x, pos.y, this.w, this.h);
    } else {
      ctx.fillStyle = PASTEL_PINK;
      ctx.beginPath();
      ctx.arc(pos.x + this.w / 2, pos.y + this.h / 2, this.w / 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  getHitbox() {
    return { x: this.x - 15, y: this.y - 15, w: 30, h: 30 };
  }
}

// フローティングテキスト
class FloatingText {
  constructor(x, y, text, color) {
    this.x = x;
    this.y = y;
    this.text = text;
    this.color = color;
    this.life = 255;
  }
  update() {
    this.y -= 2;
    this.life -= 5;
  }
  draw(camera) {
    if (this.life <= 0) return;
    const pos = camera.apply(this.x, this.y);
    ctx.save();
    ctx.globalAlpha = Math.max(0, this.life / 255);
    ctx.fillStyle = this.color;
    ctx.font = 'bold 24px sans-serif';
    ctx.fillText(this.text, pos.x, pos.y);
    ctx.restore();
  }
}

// AABB衝突判定
function rectsOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// メインゲームロジック
async function main() {
  // 画像ロード
  const [imgPlayer, imgHead, imgBody, imgTail, ...imgItems] = await Promise.all([
    loadImage('palyer.png'),
    loadImage('worm_head.png'),
    loadImage('worm_body.png'),
    loadImage('worm_tail.png'),
    loadImage('item1.png'),
    loadImage('item2.png'),
    loadImage('item3.png'),
    loadImage('item4.png'),
    loadImage('item5.png'),
    loadImage('item6.png'),
  ]);

  const wormImgs = { head: imgHead, body: imgBody, tail: imgTail };

  let player, worm, camera, items, floatingTexts, particles, score, state;

  function init() {
    player = new Player(400, 300, imgPlayer);
    worm = new Worm(100, 100, wormImgs);
    camera = new Camera();

    items = [];
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * 2800 - 1000;
      const y = Math.random() * 2600 - 1000;
      const img = imgItems[Math.floor(Math.random() * imgItems.length)];
      items.push(new Item(x, y, img));
    }

    score = 0;
    floatingTexts = [];
    particles = [];
    state = 'PLAYING';
  }

  const keys = {};
  window.addEventListener('keydown', e => { keys[e.key] = true; e.preventDefault(); });
  window.addEventListener('keyup', e => { keys[e.key] = false; });
  canvas.addEventListener('click', () => { if (state === 'GAMEOVER') init(); });

  init();

  function loop(now) {
    // 更新
    if (state === 'PLAYING') {
      player.update(keys);
      worm.update(player.x, player.y);
      camera.update(player);

      // アイテム取得
      const ph = player.getHitbox();
      items = items.filter(item => {
        if (rectsOverlap(ph, item.getHitbox())) {
          score++;
          floatingTexts.push(new FloatingText(item.x, item.y, '+1', PASTEL_PINK));
          for (let i = 0; i < 10; i++) particles.push(new Particle(item.x, item.y, PASTEL_YELLOW, 'float'));
          return false;
        }
        return true;
      });

      // ワームとの衝突
      if (rectsOverlap(player.getHitbox(), worm.getHitbox())) {
        state = 'GAMEOVER';
      }
    }

    // 描画
    ctx.fillStyle = PASTEL_BLUE;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    // グリッド背景
    const bgOffsetX = ((camera.x % 100) + 100) % 100;
    const bgOffsetY = ((camera.y % 100) + 100) % 100;
    ctx.strokeStyle = WHITE;
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    for (let x = -100 + bgOffsetX; x < WIDTH + 100; x += 100) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, HEIGHT); ctx.stroke();
    }
    for (let y = -100 + bgOffsetY; y < HEIGHT + 100; y += 100) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WIDTH, y); ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // アイテム
    items.forEach(item => item.draw(camera, now));

    // プレイヤー・ワーム
    player.draw(camera);
    worm.draw(camera);

    // パーティクル
    particles = particles.filter(p => { p.update(); p.draw(camera); return p.life > 0; });

    // フローティングテキスト
    floatingTexts = floatingTexts.filter(ft => { ft.update(); ft.draw(camera); return ft.life > 0; });

    // スコア表示
    ctx.font = 'bold 28px sans-serif';
    ctx.fillStyle = WHITE;
    ctx.fillText(`あつめた おかし：${score} 個`, 22, 47);
    ctx.fillStyle = BLACK;
    ctx.fillText(`あつめた おかし：${score} 個`, 20, 45);

    // ゲームオーバー
    if (state === 'GAMEOVER') {
      ctx.fillStyle = 'rgba(255,255,255,0.75)';
      ctx.fillRect(0, 0, WIDTH, HEIGHT);

      ctx.fillStyle = PASTEL_PINK;
      ctx.font = 'bold 64px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('つかまっちゃった！', WIDTH / 2, HEIGHT / 2 - 40);

      const bounce = Math.sin(now / 200) * 10;
      ctx.fillStyle = BLACK;
      ctx.font = 'bold 28px sans-serif';
      ctx.fillText('▼ クリックで もういっかい！ ▼', WIDTH / 2, HEIGHT / 2 + 60 + bounce);
      ctx.textAlign = 'left';
    }

    requestAnimationFrame(loop);
  }

  requestAnimationFrame(loop);
}

main();
