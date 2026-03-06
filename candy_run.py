import pygame
import random
import math
import sys
import os

# 初期化
pygame.init()
pygame.font.init()

# 画面設定
WIDTH, HEIGHT = 800, 600
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Candy Run")
clock = pygame.time.Clock()

# 色の定義
PASTEL_PINK = (255, 182, 193)
PASTEL_BLUE = (173, 216, 230)
PASTEL_GREEN = (144, 238, 144)
PASTEL_YELLOW = (255, 255, 224)
WHITE = (255, 255, 255)
BLACK = (0, 0, 0)
RAINBOW = [(255,0,0), (255,165,0), (255,255,0), (0,128,0), (0,0,255), (75,0,130), (238,130,238)]

# フォント設定（丸ゴシック系があれば使用、なければデフォルト）
try:
    font_path = pygame.font.match_font('hgp丸ゴシックm-pro, meiryo, msgothic')
    font = pygame.font.Font(font_path, 40)
    title_font = pygame.font.Font(font_path, 80)
except:
    font = pygame.font.SysFont(None, 40)
    title_font = pygame.font.SysFont(None, 80)

# 画像読み込みヘルパー（エラーハンドリング付き）
def load_image(name, size=None, fallback_color=(200, 200, 200), fallback_shape='rect'):
    try:
        if not os.path.exists(name):
            raise FileNotFoundError(f"Image {name} not found.")
        img = pygame.image.load(name).convert_alpha()
        if size:
            img = pygame.transform.scale(img, size)
        return img
    except Exception as e:
        print(f"Warning: Could not load image {name}. Using fallback.")
        surf = pygame.Surface(size if size else (50, 50), pygame.SRCALPHA)
        if fallback_shape == 'circle':
            pygame.draw.circle(surf, fallback_color, (size[0]//2, size[1]//2), size[0]//2)
        else:
            surf.fill(fallback_color)
        return surf

# アセットのロード
PLAYER_SIZE = (50, 50)
WORM_SIZE = (60, 60)
ITEM_SIZE = (40, 40)

img_player = load_image('player.png', PLAYER_SIZE, (100, 100, 255), 'circle')
img_worm_head = load_image('worm_head.png', WORM_SIZE, (255, 100, 100), 'circle')
img_worm_body = load_image('worm_body.png', WORM_SIZE, (200, 100, 100), 'circle')
img_worm_tail = load_image('worm_tail.png', WORM_SIZE, (150, 100, 100), 'circle')

img_items = [
    load_image(f'item{i}.png', ITEM_SIZE, (random.randint(150,255), random.randint(150,255), random.randint(150,255)), 'circle')
    for i in range(1, 6)
]

class Camera:
    def __init__(self, width, height):
        self.camera = pygame.Rect(0, 0, width, height)
        self.width = width
        self.height = height
        self.x = 0
        self.y = 0

    def apply(self, entity_rect):
        return entity_rect.move(self.camera.topleft)
        
    def apply_pos(self, pos):
        return (pos[0] + self.camera.x, pos[1] + self.camera.y)

    def update(self, target):
        # Lerp（線形補間）で滑らかに追従
        target_x = -target.rect.centerx + int(WIDTH / 2)
        target_y = -target.rect.centery + int(HEIGHT / 2)
        self.x += (target_x - self.x) * 0.1
        self.y += (target_y - self.y) * 0.1
        self.camera = pygame.Rect(int(self.x), int(self.y), self.width, self.height)

class Particle:
    def __init__(self, x, y, color, type='star'):
        self.x = x
        self.y = y
        self.color = color
        self.type = type
        self.life = 255
        self.vx = random.uniform(-2, 2)
        self.vy = random.uniform(-2, 2)
        self.size = random.randint(3, 8)

    def update(self):
        self.x += self.vx
        self.y += self.vy
        self.life -= 10
        if self.type == 'float':
            self.vy -= 0.1 # 上にふわっと上がる

    def draw(self, surface, camera):
        if self.life > 0:
            pos = camera.apply_pos((self.x, self.y))
            alpha_color = (*self.color[:3], max(0, self.life))
            surf = pygame.Surface((self.size*2, self.size*2), pygame.SRCALPHA)
            pygame.draw.circle(surf, alpha_color, (self.size, self.size), self.size)
            surface.blit(surf, (pos[0] - self.size, pos[1] - self.size))

class Player:
    def __init__(self, x, y):
        self.image = img_player
        self.rect = self.image.get_rect(center=(x, y))
        self.speed = 5
        self.particles = []

    def update(self, keys):
        dx, dy = 0, 0
        if keys[pygame.K_LEFT] or keys[pygame.K_a]: dx -= self.speed
        if keys[pygame.K_RIGHT] or keys[pygame.K_d]: dx += self.speed
        if keys[pygame.K_UP] or keys[pygame.K_w]: dy -= self.speed
        if keys[pygame.K_DOWN] or keys[pygame.K_s]: dy += self.speed

        if dx != 0 or dy != 0:
            length = math.hypot(dx, dy)
            dx = (dx / length) * self.speed
            dy = (dy / length) * self.speed
            self.rect.x += dx
            self.rect.y += dy
            
            # 移動エフェクト（足元から星）
            if random.random() < 0.3:
                self.particles.append(Particle(self.rect.centerx, self.rect.bottom, PASTEL_YELLOW, 'star'))

        for p in self.particles[:]:
            p.update()
            if p.life <= 0:
                self.particles.remove(p)

    def draw(self, surface, camera):
        for p in self.particles:
            p.draw(surface, camera)
        surface.blit(self.image, camera.apply(self.rect))

class Worm:
    def __init__(self, x, y, length=4):
        self.head_img = img_worm_head
        self.body_img = img_worm_body
        self.tail_img = img_worm_tail
        self.speed = 3
        self.history = [(x, y)] * 100
        self.length = length
        self.spacing = 15
        self.rect = self.head_img.get_rect(center=(x, y))
        self.particles = []

    def update(self, target_pos):
        dx = target_pos[0] - self.rect.centerx
        dy = target_pos[1] - self.rect.centery
        dist = math.hypot(dx, dy)
        
        if dist > 0:
            self.rect.centerx += (dx / dist) * self.speed
            self.rect.centery += (dy / dist) * self.speed

        self.history.insert(0, self.rect.center)
        if len(self.history) > self.length * self.spacing + 10:
            self.history.pop()

        if random.random() < 0.5:
            color = random.choice(RAINBOW)
            self.particles.append(Particle(self.rect.centerx, self.rect.centery, color, 'float'))

        for p in self.particles[:]:
            p.update()
            if p.life <= 0:
                self.particles.remove(p)

    def draw(self, surface, camera):
        for p in self.particles:
            p.draw(surface, camera)

        tail_idx = min(len(self.history)-1, (self.length-1) * self.spacing)
        tail_pos = self.history[tail_idx]
        tail_rect = self.tail_img.get_rect(center=tail_pos)
        surface.blit(self.tail_img, camera.apply(tail_rect))

        for i in range(self.length - 2, 0, -1):
            idx = min(len(self.history)-1, i * self.spacing)
            pos = self.history[idx]
            body_rect = self.body_img.get_rect(center=pos)
            surface.blit(self.body_img, camera.apply(body_rect))

        surface.blit(self.head_img, camera.apply(self.rect))

class Item:
    def __init__(self, x, y):
        self.image = random.choice(img_items)
        self.rect = self.image.get_rect(center=(x, y))
        self.float_offset = random.uniform(0, math.pi * 2)

    def draw(self, surface, camera):
        offset_y = math.sin(pygame.time.get_ticks() / 300 + self.float_offset) * 5
        draw_rect = self.rect.copy()
        draw_rect.y += offset_y
        surface.blit(self.image, camera.apply(draw_rect))

class FloatingText:
    def __init__(self, x, y, text, color):
        self.x = x
        self.y = y
        self.text = text
        self.color = color
        self.life = 255
        self.font = pygame.font.Font(font_path, 30) if 'font_path' in globals() else pygame.font.SysFont(None, 30)

    def update(self):
        self.y -= 2
        self.life -= 5

    def draw(self, surface, camera):
        if self.life > 0:
            txt_surf = self.font.render(self.text, True, self.color)
            txt_surf.set_alpha(max(0, self.life))
            pos = camera.apply_pos((self.x, self.y))
            surface.blit(txt_surf, pos)

def main():
    player = Player(400, 300)
    worm = Worm(100, 100, length=5)
    camera = Camera(WIDTH, HEIGHT)
    
    items = []
    for _ in range(50):
        ix = random.randint(-1000, 1800)
        iy = random.randint(-1000, 1600)
        items.append(Item(ix, iy))

    score = 0
    floating_texts = []
    particles = []
    state = "PLAYING"

    while True:
        keys = pygame.key.get_pressed()
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                pygame.quit()
                sys.exit()
            if state == "GAMEOVER" and event.type == pygame.MOUSEBUTTONDOWN:
                main()
                return

        if state == "PLAYING":
            player.update(keys)
            worm.update(player.rect.center)
            camera.update(player)

            for item in items[:]:
                hitbox = player.rect.inflate(-10, -10)
                if hitbox.colliderect(item.rect):
                    items.remove(item)
                    score += 1
                    floating_texts.append(FloatingText(item.rect.centerx, item.rect.centery, "+1", PASTEL_PINK))
                    for _ in range(10):
                        particles.append(Particle(item.rect.centerx, item.rect.centery, PASTEL_YELLOW, 'float'))

            worm_hitbox = worm.rect.inflate(-30, -30)
            player_hitbox = player.rect.inflate(-20, -20)
            if player_hitbox.colliderect(worm_hitbox):
                state = "GAMEOVER"

        screen.fill(PASTEL_BLUE)
        bg_offset_x = camera.x % 100
        bg_offset_y = camera.y % 100
        for x in range(-100, WIDTH + 100, 100):
            pygame.draw.line(screen, WHITE, (x + bg_offset_x, 0), (x + bg_offset_x, HEIGHT), 2)
        for y in range(-100, HEIGHT + 100, 100):
            pygame.draw.line(screen, WHITE, (0, y + bg_offset_y), (WIDTH, y + bg_offset_y), 2)

        for item in items:
            item.draw(screen, camera)
            
        player.draw(screen, camera)
        worm.draw(screen, camera)

        for p in particles[:]:
            p.update()
            p.draw(screen, camera)
            if p.life <= 0:
                particles.remove(p)
                
        for ft in floating_texts[:]:
            ft.update()
            ft.draw(screen, camera)
            if ft.life <= 0:
                floating_texts.remove(ft)

        score_text = font.render(f"あつめた おかし：{score} 個", True, BLACK)
        score_bg = font.render(f"あつめた おかし：{score} 個", True, WHITE)
        screen.blit(score_bg, (22, 22))
        screen.blit(score_bg, (18, 18))
        screen.blit(score_text, (20, 20))

        if state == "GAMEOVER":
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((255, 255, 255, 180))
            screen.blit(overlay, (0, 0))
            
            go_text = title_font.render("つかまっちゃった！", True, PASTEL_PINK)
            go_rect = go_text.get_rect(center=(WIDTH//2, HEIGHT//2 - 50))
            screen.blit(go_text, go_rect)
            
            retry_text = font.render("▼ クリックで もういっかい！ ▼", True, BLACK)
            retry_rect = retry_text.get_rect(center=(WIDTH//2, HEIGHT//2 + 50))
            offset = math.sin(pygame.time.get_ticks() / 200) * 10
            retry_rect.y += offset
            screen.blit(retry_text, retry_rect)

        pygame.display.flip()
        clock.tick(60)

if __name__ == "__main__":
    main()
