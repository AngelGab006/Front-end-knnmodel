const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const predictBtn = document.getElementById('predict-btn');
const clearBtn = document.getElementById('clear-btn');
const resultDiv = document.getElementById('result');
const debugImageCanvas = document.getElementById('debug-image');
const debugImageCtx = debugImageCanvas.getContext('2d');
const pixelMatrixDiv = document.getElementById('pixel-matrix'); // Get the new container

ctx.lineWidth = 25; 
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
    pixelMatrixDiv.innerHTML = ''; // Clear the matrix
});

predictBtn.addEventListener('click', async () => {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const boundingBox = getBoundingBox(imageData.data, canvas.width, canvas.height);

    if (boundingBox.x1 === canvas.width) {
        resultDiv.textContent = 'Dibuja un número primero!';
        return;
    }

    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 28;
    smallCanvas.height = 28;
    const smallCtx = smallCanvas.getContext('2d');
    
    smallCtx.fillStyle = 'white';
    smallCtx.fillRect(0, 0, 28, 28);
    
    const croppedWidth = boundingBox.x2 - boundingBox.x1 + 1;
    const croppedHeight = boundingBox.y2 - boundingBox.y1 + 1;

    const targetSize = 20;
    const scale = Math.min(targetSize / croppedWidth, targetSize / croppedHeight);
    
    const scaledWidth = croppedWidth * scale;
    const scaledHeight = croppedHeight * scale;

    const offsetX = (28 - scaledWidth) / 2;
    const offsetY = (28 - scaledHeight) / 2;
    
    smallCtx.drawImage(
        canvas,
        boundingBox.x1,
        boundingBox.y1,
        croppedWidth,
        croppedHeight,
        offsetX,
        offsetY,
        scaledWidth,
        scaledHeight
    );

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
        debugImageData.data[i * 4 + 0] = val;
        debugImageData.data[i * 4 + 1] = val;
        debugImageData.data[i * 4 + 2] = val;
        debugImageData.data[i * 4 + 3] = 255;
    }
    debugImageCtx.putImageData(debugImageData, 0, 0);

    // Generate and display the pixel matrix
    const imageMatrix = [];
    for (let i = 0; i < 28; i++) {
        imageMatrix.push(debugPixels.slice(i * 28, (i + 1) * 28));
    }
    displayPixelMatrix(imageMatrix);

    try {
        const response = await fetch('https://back-end-knnmodel.onrender.com/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pixels: pixels })
        });

        const data = await response.json();
        const certainty = data.certainty[data.prediction] * 100;
        resultDiv.textContent = `Predicción: ${data.prediction} | Certeza: ${certainty.toFixed(2)}%`;
        
    } catch (error) {
        resultDiv.textContent = `Error: No se pudo conectar con el servidor.`;
        console.error('Error:', error);
    }
});

// New function to display the pixel matrix
function displayPixelMatrix(matrix) {
    let tableHTML = '<table>';
    matrix.forEach(row => {
        tableHTML += '<tr>';
        row.forEach(cell => {
            const opacity = cell / 255;
            const color = 255 - cell;
            tableHTML += `<td style="background-color: rgb(${color}, ${color}, ${color}); color: ${cell > 128 ? 'black' : 'white'};">${cell}</td>`;
        });
        tableHTML += '</tr>';
    });
    tableHTML += '</table>';
    pixelMatrixDiv.innerHTML = tableHTML;
}

function getBoundingBox(pixels, width, height) {
    let minX = width;
    let minY = height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const r = pixels[(y * width + x) * 4];
            const g = pixels[(y * width + x) * 4 + 1];
            const b = pixels[(y * width + x) * 4 + 2];
            
            if (r < 255 || g < 255 || b < 255) { 
                if (x < minX) minX = x;
                if (y < minY) minY = y;
                if (x > maxX) maxX = x;
                if (y > maxY) maxY = y;
            }
        }
    }
    if (maxX === -1) return { x1: width, y1: height, x2: -1, y2: -1 };
    
    return { x1: minX, y1: minY, x2: maxX, y2: maxY };
}