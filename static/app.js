const CANVAS_BG       = '#F7F4EE';
const STROKE_COLOR    = '#1C1A17';
const STROKE_WIDTH    = 22;
const CONFIDENCE_THRESHOLD = 0.55;

const canvas    = document.getElementById('drawingCanvas');
const ctx       = canvas.getContext('2d');
const predEl    = document.getElementById('predictionLabel');
const confEl    = document.getElementById('confidenceText');
const dividerEl = document.getElementById('divider');
const barsEl    = document.getElementById('probabilityBars');
const clearBtn  = document.getElementById('clearBtn');

let isDrawing = false;
let lastX     = 0;
let lastY     = 0;
let hasDrawn  = false;

function initCanvas() {
    ctx.fillStyle   = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = STROKE_COLOR;
    ctx.lineWidth   = STROKE_WIDTH;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
}

function getScaledPos(e) {
    const rect   = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    return [
        (e.clientX - rect.left) * scaleX,
        (e.clientY - rect.top)  * scaleY,
    ];
}

canvas.addEventListener('mousedown', e => {
    isDrawing = true;
    hasDrawn  = true;
    [lastX, lastY] = getScaledPos(e);
});

canvas.addEventListener('mousemove', e => {
    if (!isDrawing) return;
    const [x, y] = getScaledPos(e);
    ctx.beginPath();
    ctx.moveTo(lastX, lastY);
    ctx.lineTo(x, y);
    ctx.stroke();
    [lastX, lastY] = [x, y];
});

canvas.addEventListener('mouseup', () => {
    isDrawing = false;
    if (hasDrawn) predict();
});

canvas.addEventListener('mouseleave', () => {
    if (isDrawing && hasDrawn) predict();
    isDrawing = false;
});

canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousedown', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    canvas.dispatchEvent(new MouseEvent('mousemove', { clientX: t.clientX, clientY: t.clientY }));
}, { passive: false });

canvas.addEventListener('touchend', e => {
    e.preventDefault();
    canvas.dispatchEvent(new MouseEvent('mouseup'));
}, { passive: false });

// ─── Clear ─────────────────────────────────────────────────────
function clearCanvas() {
    ctx.fillStyle = CANVAS_BG;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    predEl.textContent  = '';
    predEl.className    = 'prediction-label';
    confEl.textContent  = '';
    dividerEl.style.opacity = '0';
    barsEl.innerHTML    = '';
    hasDrawn = false;
}

clearBtn.addEventListener('click', clearCanvas);

function renderPrediction(data) {
    const isUnsure = data.confidence < CONFIDENCE_THRESHOLD;

    if (isUnsure) {
        predEl.className   = 'prediction-label prediction-label--unsure';
        predEl.textContent = 'not sure yet\u2026';
        confEl.textContent = '';
    } else {
        predEl.className   = 'prediction-label';
        predEl.textContent = data.prediction;
        confEl.textContent = `${(data.confidence * 100).toFixed(1)}% confidence`;
    }

    dividerEl.style.opacity = '1';
    renderBars(data.probabilities);
}

function renderBars(probabilities) {
    const sorted   = Object.entries(probabilities).sort((a, b) => b[1] - a[1]);
    const topShape = sorted[0][0];
    const existing = barsEl.querySelectorAll('.prob-row');

    if (existing.length === 0) {
        sorted.forEach(([shape, prob], i) => {
            const pct   = (prob * 100).toFixed(1);
            const isTop = shape === topShape;
            const row   = document.createElement('div');
            row.className        = 'prob-row';
            row.dataset.shape    = shape;
            row.style.animationDelay = `${i * 0.05}s`;
            row.innerHTML = `
                <span class="prob-name">${shape}</span>
                <div class="prob-track">
                    <div class="prob-fill ${isTop ? 'prob-fill--top' : ''}" style="width:${pct}%"></div>
                </div>
                <span class="prob-pct ${isTop ? 'prob-pct--top' : ''}">${pct}%</span>
            `;
            barsEl.appendChild(row);
        });
    } else {
        sorted.forEach(([shape, prob]) => {
            const row = barsEl.querySelector(`[data-shape="${shape}"]`);
            if (!row) return;
            const pct   = (prob * 100).toFixed(1);
            const isTop = shape === topShape;

            const fill = row.querySelector('.prob-fill');
            fill.style.width = `${pct}%`;
            fill.className   = `prob-fill ${isTop ? 'prob-fill--top' : ''}`;

            const pctEl = row.querySelector('.prob-pct');
            pctEl.textContent = `${pct}%`;
            pctEl.className   = `prob-pct ${isTop ? 'prob-pct--top' : ''}`;
        });
    }
}

function predict() {
    fetch('/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: canvas.toDataURL('image/png') }),
    })
    .then(r => r.json())
    .then(data => {
        if (data.error) {
            predEl.className   = 'prediction-label prediction-label--unsure';
            predEl.textContent = 'error';
        } else {
            renderPrediction(data);
        }
    })
    .catch(() => {
        predEl.className   = 'prediction-label prediction-label--unsure';
        predEl.textContent = 'offline';
    });
}

initCanvas();
