const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const predictBtn = document.getElementById('predict-btn');
const clearBtn = document.getElementById('clear-btn');
const resultDiv = document.getElementById('result');
const debugImageCanvas = document.getElementById('debug-image');
const debugImageCtx = debugImageCanvas.getContext('2d');

ctx.lineWidth = 10;
ctx.lineCap = 'round';
ctx.fillStyle = 'white';
ctx.fillRect(0, 0, canvas.width, canvas.height);
ctx.strokeStyle = '#000';

let drawing = false;

function startDrawing(e) {
    drawing = true;
    ctx.beginPath();
    const { offsetX, offsetY } = getCoords(e);
    ctx.moveTo(offsetX, offsetY);
    e.preventDefault();
}

function draw(e) {
    if (!drawing) return;
    const { offsetX, offsetY } = getCoords(e);
    ctx.lineTo(offsetX, offsetY);
    ctx.stroke();
    e.preventDefault();
}

function stopDrawing() {
    drawing = false;
}

function getCoords(e) {
    if (e.touches && e.touches.length > 0) {
        const rect = canvas.getBoundingClientRect();
        return {
            offsetX: e.touches[0].clientX - rect.left,
            offsetY: e.touches[0].clientY - rect.top
        };
    }
    return { offsetX: e.offsetX, offsetY: e.offsetY };
}

canvas.addEventListener('mousedown', startDrawing);
canvas.addEventListener('mouseup', stopDrawing);
canvas.addEventListener('mousemove', draw);
canvas.addEventListener('mouseleave', stopDrawing);
canvas.addEventListener('touchstart', startDrawing);
canvas.addEventListener('touchend', stopDrawing);
canvas.addEventListener('touchmove', draw);
canvas.addEventListener('touchcancel', stopDrawing);

clearBtn.addEventListener('click', () => {
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    resultDiv.textContent = '';
    debugImageCtx.fillStyle = 'white';
    debugImageCtx.fillRect(0, 0, debugImageCanvas.width, debugImageCanvas.height);
});

predictBtn.addEventListener('click', async () => {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 28;
    smallCanvas.height = 28;
    const smallCtx = smallCanvas.getContext('2d');

    smallCtx.drawImage(canvas, 0, 0, 28, 28);
    
    const smallImageData = smallCtx.getImageData(0, 0, 28, 28);
    const pixels = [];
    const debugPixels = []; 

    for (let i = 0; i < smallImageData.data.length; i += 4) {
        const grayScaleValue = smallImageData.data[i]; 
        const invertedGrayScale = 255 - grayScaleValue;

        const normalizedPixel = invertedGrayScale / 255.0;
        
        pixels.push(normalizedPixel);
        debugPixels.push(invertedGrayScale);
    }

    const debugImageData = debugImageCtx.createImageData(28, 28);
    for (let i = 0; i < debugPixels.length; i++) {
        const val = debugPixels[i];
        debugImageData.data[i * 4 + 0] = val; // R
        debugImageData.data[i * 4 + 1] = val; // G
        debugImageData.data[i * 4 + 2] = val; // B
        debugImageData.data[i * 4 + 3] = 255; // Alpha
    }
    debugImageCtx.putImageData(debugImageData, 0, 0);

    try {
        const response = await fetch('https://back-end-knnmodel.onrender.com/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pixels: pixels })
        });

        const data = await response.json();
        resultDiv.textContent = `La predicción es: ${data.prediction}`;
    } catch (error) {
        resultDiv.textContent = `Error: No se pudo conectar con el servidor.`;
        console.error('Error:', error);
    }
});