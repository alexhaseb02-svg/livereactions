let video, handpose;  // kameran och ai-modellen
let hands = [];       // händerna som hittas sparas här

let emoji = "";                              // emojin som visas just nu, tom = ingen
let emojiX = 0, emojiY = 0, emojiSize = 0;   // var emojin är och hur stor den är
let timer = 0;                               // räknar hur länge emojin har visats

let candidate = "";                   // gesten som syns just nu
let holdCount = 0, twoHandsTimer = 0; // hur länge gesten hållits + spärr efter två händer

// alla sju gester i spelet med en ledtråd till varje
let gestures = [
  { emoji: "❤️", hint: "Use two hands to show some love" },
  { emoji: "👍", hint: "Show that something is good" },
  { emoji: "👎", hint: "Show that something is bad" },
  { emoji: "✌️", hint: "Two fingers for peace" },
  { emoji: "🖕", hint: "The finger you shouldn't show your teacher" },
  { emoji: "👆", hint: "Point straight up at the sky" },
  { emoji: "🤘", hint: "Rock'n'roll!" }
];
let found = [];  // gesterna man har hittat

// laddar handpose innan allt startar
// flipped gör att punkterna stämmer med den spegelvända kameran
function preload() {
  handpose = ml5.handPose({ maxHands: 2, flipped: true });
}

// körs en gång i början
function setup() {
  // canvasen läggs i diven "camera" i html filen
  createCanvas(640, 480).parent("camera");

  // startar kameran som en spegel och gömmer den vanliga videon
  // vi ritar ut den själva i draw istället
  video = createCapture(VIDEO, { flipped: true });
  video.size(640, 480);
  video.hide();

  // emojin hamnar i mitten av punkten och får ingen kant
  textAlign(CENTER);
  noStroke();

  // gör rutorna med ? och börjar leta efter händer
  restart();
  handpose.detectStart(video, results => hands = results);
}

// räknar avståndet mellan två punkter
// gjorde den så vi slipper skriva dist(a.x, a.y, b.x, b.y) hela tiden
function d(a, b) {
  return dist(a.x, a.y, b.x, b.y);
}

// kollar hur rakt ett finger är
// jämför toppen till knogen med mellanleden till knogen
// ca 2 = rakt, lågt tal = böjt
function fingerRatio(p, tip) {
  return d(p[tip], p[tip - 3]) / d(p[tip - 2], p[tip - 3]);
}

// true om fingret är böjt
function isBent(p, tip) {
  return fingerRatio(p, tip) < 1.7;
}

// kollar vilken gest som görs och skickar tillbaka [emoji, x, y]
function detectGesture() {

  // hjärta, behöver två händer
  if (hands.length === 2) {
    twoHandsTimer = 20;  // blockerar en-hands-gester en stund så de inte krockar med hjärtat

    let a = hands[0].keypoints;  // första handen
    let b = hands[1].keypoints;  // andra handen

    // pekfingrarna (8) och tummarna (4) nästan nuddar
    // och pekfingrarna är ovanför tummarna (mindre y = högre upp)
    if (d(a[8], b[8]) < 75 && d(a[4], b[4]) < 75 &&
        a[8].y < a[4].y - 30 && b[8].y < b[4].y - 30) {
      // hjärtat hamnar mitt emellan pekfingrarna
      return ["❤️", (a[8].x + b[8].x) / 2, (a[8].y + b[8].y) / 2];
    }
  }

  // gester med en hand, men bara om det inte nyss var två händer
  if (hands.length === 1 && twoHandsTimer === 0) {
    let p = hands[0].keypoints;

    // emojin hamnar lite ovanför tummen
    let x = p[4].x;
    let y = p[4].y - 55;

    // vilka fingrar är böjda
    let index = isBent(p, 8);
    let middle = isBent(p, 12);
    let ring = isBent(p, 16);
    let pinky = isBent(p, 20);

    let thumbIn = d(p[4], p[10]) < 50;  // tummen ligger mot långfingret
    let pointsUp = p[8].y < p[5].y - 60 && abs(p[8].x - p[5].x) < 40;  // pekfingret pekar rakt upp
    let closedHand = fingerRatio(p, 8) < 1.35 && middle;  // pek och lång är knutna

    // högsta och lägsta fingertoppen (utom tummen)
    let topTip = min(p[8].y, p[12].y, p[16].y, p[20].y);
    let bottomTip = max(p[8].y, p[12].y, p[16].y, p[20].y);

    // tumme upp = tummen högst upp av alla
    // tumme ner = tummen längst ner och under handleden
    // (handleden-delen gör att ett halvt hjärta inte blir tumme ner)
    let thumbUp = closedHand && p[4].y < p[2].y - 20 && p[4].y < topTip;
    let thumbDown = closedHand && p[4].y > p[2].y + 20 &&
                    p[4].y > bottomTip && p[4].y > p[0].y;

    if (thumbUp) return ["👍", x, y];
    if (thumbDown) return ["👎", x, y];

    // peace: pek och lång raka och isär, ring och lill böjda
    if (!index && !middle && ring && pinky && d(p[8], p[12]) > 25)
      return ["✌️", x, y];

    // långfinger: bara långfingret rakt, emojin hamnar över det
    if (index && !middle && ring && pinky)
      return ["🖕", p[12].x, p[12].y - 40];

    // peka upp: bara pekfingret, rakt upp och tummen inne
    if (!index && middle && ring && pinky && pointsUp && thumbIn)
      return ["👆", x, y];

    // rock: pek och lill raka, lång och ring böjda
    if (!index && middle && ring && !pinky)
      return ["🤘", x, y];
  }

  // ingen gest hittades
  return ["", 0, 0];
}

// körs ca 60 gånger i sekunden
function draw() {
  // ritar kamerabilden
  image(video, 0, 0, width, height);

  // räknar ner spärren när det inte är två händer längre
  if (hands.length !== 2 && twoHandsTimer > 0) twoHandsTimer--;

  // kollar vilken gest som syns och var
  let [g, x, y] = detectGesture();

  // gesten måste synas 10 frames i rad innan den räknas
  // så att det inte blinkar fram fel gester
  if (g === candidate) holdCount++;
  else {
    candidate = g;
    holdCount = 0;
  }

  let newEmoji = holdCount >= 10 ? g : "";

  // ny gest, starta om animationen
  if (newEmoji !== "" && newEmoji !== emoji) {
    emoji = newEmoji;
    emojiSize = 10;  // börjar liten och växer
    timer = 0;
    emojiX = x;
    emojiY = y;
  }

  // öppnar rutan i spelet
  if (newEmoji !== "") markFound(newEmoji);

  // ingen emoji, då behöver vi inte rita mer
  if (emoji === "") return;

  let active = newEmoji === emoji;  // true så länge gesten hålls kvar
  timer++;

  // emojin glider mjukt efter handen och effekten visas
  if (active) {
    emojiX = lerp(emojiX, x, 0.2);
    emojiY = lerp(emojiY, y, 0.2);
    showEffect();
  }

  // emoji-animationen, bara för hjärta, peace och peka upp
  if (emoji === "❤️" || emoji === "✌️" || emoji === "👆") {
    emojiSize = lerp(emojiSize, 85, 0.15);  // växer mjukt upp till 85
    fill(255);

    // stor emoji, sin gör att den gungar upp och ner och pulserar
    let floatY = emojiY - 40 + sin(frameCount * 0.08) * 10;
    textSize(emojiSize + sin(frameCount * 0.15) * 10);
    text(emoji, emojiX, floatY);

    // tre små emojis som flyger uppåt
    // (i - 1) * 42 = vänster, mitten, höger
    // % 170 gör att de börjar om längst ner när de kommit upp
    textSize(28);
    for (let i = 0; i < 3; i++) {
      text(emoji, emojiX + (i - 1) * 42,
           floatY - (frameCount * 2 + i * 60) % 170);
    }
  }

  // tar bort emojin när man släpper gesten
  // väntar 15 frames så den inte försvinner om handen tappas en kort stund
  if (newEmoji === "" && timer > 15) emoji = "";
}

// specialeffekter för vissa gester
function showEffect() {

  // 👍 grön och 👎 röd skärm som pulserar
  // sin gör att genomskinligheten går upp och ner
  if (emoji === "👍" || emoji === "👎") {
    let opacity = 35 + (sin(frameCount * 0.12) + 1) * 55;

    if (emoji === "👍") fill(0, 255, 0, opacity);
    else fill(255, 0, 0, opacity);

    rect(0, 0, width, height);  // färgen läggs över hela bilden
  }

  // 🖕 digital störning, lila/rosa streck på random höjder
  if (emoji === "🖕") {
    strokeWeight(3);
    for (let i = 0; i < 8; i++) {
      stroke(random(255), 0, random(255));
      let y = random(height);
      line(0, y, width, y);
    }
    noStroke();
  }

  // 🤘 scenljus, färgglada strålar från taket till golvet
  if (emoji === "🤘") {
    strokeWeight(4);
    for (let i = 0; i < 6; i++) {
      stroke(random(255), random(255), random(255));
      line(random(width), 0, random(width), height);
    }
    noStroke();
  }
}

// ---------- spelet ----------

// sparar gesten som hittad och öppnar rätt ruta
function markFound(e) {
  if (found.includes(e)) return;  // redan hittad, gör inget
  found.push(e);

  // letar upp vilken ruta som hör till gesten
  let i = gestures.findIndex(g => g.emoji === e);
  let slot = select("#board").elt.children[i];

  // byter ? mot emojin
  slot.textContent = e;
  slot.classList.add("found");

  // uppdaterar räknaren
  select("#count").html(found.length + " / " + gestures.length);

  // alla hittade
  if (found.length === gestures.length)
    select("#hint").html("You found them all! 🎉");
}

// visar en ledtråd för en gest man inte hittat än
function showHint() {
  let left = gestures.filter(g => !found.includes(g.emoji));

  if (left.length > 0)
    select("#hint").html("Hint: " + random(left).hint);
}

// startar om spelet, gör nya rutor med ? och nollställer allt
function restart() {
  found = [];
  select("#board").html('<div class="slot">?</div>'.repeat(gestures.length));
  select("#count").html("0 / " + gestures.length);
  select("#hint").html("");
}

// slår på och av ringlampan runt kameran
function toggleLight() {
  select("#camera").elt.classList.toggle("light");
}