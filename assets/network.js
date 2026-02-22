const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');

let width, height, nodes = [], edges = [];
const nodeCount = 30;
const mouse = { x: -1000, y: -1000, prevX: -1000, prevY: -1000 };

const colors = [
  '#ff2200',
  '#ff2200',
  '#003cff',
  '#003cff',
];

function init() {
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width;
  canvas.height = height;
  
  nodes = [];
  edges = [];
  for (let i = 0; i < nodeCount; i++) {
    nodes.push({
      x: Math.random() * width,
      y: Math.random() * height,
      px: 0, py: 0,
      vx: (Math.random() - 0.5) * 2.5, // Slightly slower for a "floaty" feel
      vy: (Math.random() - 0.5) * 2.5,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }
  
  // Start with silver/white connections
  for(let i=0; i<15; i++) {
    addEdge(Math.floor(Math.random()*nodeCount), Math.floor(Math.random()*nodeCount), '#7300ff');
  }
}

function addEdge(a, b, color) {
  if (a === b) return;
  if (!edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
    edges.push({ a, b, color });
  }
}

function getIntersection(p1, p2, p3, p4) {
  const det = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
  if (det === 0) return false;
  const lambda = ((p4.y - p3.y) * (p4.x - p1.x) + (p3.x - p4.x) * (p4.y - p1.y)) / det;
  const gamma = ((p1.y - p2.y) * (p4.x - p1.x) + (p2.x - p1.x) * (p4.y - p1.y)) / det;
  return (0 < lambda && lambda < 1) && (0 < gamma && gamma < 1);
}

function update() {
  nodes.forEach(node => {
    node.px = node.x; node.py = node.y;
    node.x += node.vx; node.y += node.vy;
    
    // Bounce off screen edges
    if (node.x < 0 || node.x > width) node.vx *= -1;
    if (node.y < 0 || node.y > height) node.vy *= -1;
  });

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const nodePath = { p1: {x: node.px, y: node.py}, p2: {x: node.x, y: node.y} };
    
    for (let j = edges.length - 1; j >= 0; j--) {
      const edge = edges[j];
      if (edge.a === i || edge.b === i) continue;
      
      const edgeLine = { p1: nodes[edge.a], p2: nodes[edge.b] };
      if (getIntersection(nodePath.p1, nodePath.p2, edgeLine.p1, edgeLine.p2)) {
        // Inherit color from the intersector
        addEdge(i, edge.a, node.color);
        addEdge(i, edge.b, node.color);
      }
    }
  }

  // Mouse "Blade" logic
  const mousePath = { p1: {x: mouse.prevX, y: mouse.prevY}, p2: {x: mouse.x, y: mouse.y} };
  for (let j = edges.length - 1; j >= 0; j--) {
    const edge = edges[j];
    const edgeLine = { p1: nodes[edge.a], p2: nodes[edge.b] };
    if (getIntersection(mousePath.p1, mousePath.p2, edgeLine.p1, edgeLine.p2)) {
      edges.splice(j, 1);
    }
  }
  mouse.prevX = mouse.x; mouse.prevY = mouse.y;
}

function draw() {
  ctx.clearRect(0, 0, width, height);
  
  // Draw edges with holographic alpha
  ctx.lineWidth = 1.2;
  edges.forEach(edge => {
    ctx.beginPath();
    // Using a 50% opacity ('88') for the prismatic edges
    ctx.strokeStyle = edge.color + '22'; 
    ctx.moveTo(nodes[edge.a].x, nodes[edge.a].y);
    ctx.lineTo(nodes[edge.b].x, nodes[edge.b].y);
    ctx.stroke();
  });

  // Draw nodes with a prismatic glow
  nodes.forEach(node => {
    ctx.beginPath();
    ctx.arc(node.x, node.y, 4, 0, Math.PI * 2);
    
    // Adding a holographic shadow/glow
    ctx.shadowBlur = 5;
    ctx.shadowColor = node.color;
    
    ctx.fillStyle = node.color;
    ctx.fill();
    
    // Reset shadow for next node performance
    ctx.shadowBlur = 0;
  });
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('mousemove', e => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;
});
window.addEventListener('resize', init);
init();
loop();