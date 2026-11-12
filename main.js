// Startar Pixi och skapar canvasen
const app = new PIXI.Application();
await app.init({ resizeTo: window, background: "#ffffff" });
document.body.appendChild(app.canvas);

const dots = new PIXI.Graphics();
app.stage.addChild(dots);

// Håller koll på musens plats
const mouse = { x: 0, y: 0 };
window.addEventListener("pointermove", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});

// Prickarna blir större när musen är nära någon prick och mindre när den är längre bort.
app.ticker.add(() => {
  dots.clear();
  for (let x = 0; x < app.screen.width; x += 30) {
    for (let y = 0; y < app.screen.height; y += 30) {
      const distance = Math.hypot(x - mouse.x, y - mouse.y);
      dots.circle(x, y, Math.max(1, 8 - distance / 30));
    }
  }
  dots.fill("#2b44d6");
});
