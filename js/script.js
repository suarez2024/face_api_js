// Configuración
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusMessage = document.getElementById('statusMessage');
const statusIndicator = document.querySelector('.status-indicator');
const loadingOverlay = document.getElementById('loadingOverlay');
const loadingText = document.getElementById('loadingText');
const captureBtn = document.getElementById('captureBtn');
const nextBtn = document.getElementById('nextBtn');
const thumbnail = document.getElementById('thumbnail');
const cameraPlaceholder = document.getElementById('cameraPlaceholder');
const logEntries = document.getElementById('logEntries');
const clearLogBtn = document.getElementById('clearLog');

// Variables globales
let isFaceValid = false;
let lastValidFace = null;
let detectionInterval;
let modelsLoaded = false;
let cameraActive = false;

// Modelos a cargar
const MODEL_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/models/';

// Función para agregar entrada al log
function addToLog(type, message, details = null) {
    const entry = document.createElement('div');
    entry.className = `log-entry ${type}`;
    
    const time = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    let html = `
        <span class="log-time">[${time}]</span>
        <span class="log-message">${message}</span>
    `;
    
    if (details) {
        html += `<span class="log-details">${details}</span>`;
    }
    
    entry.innerHTML = html;
    logEntries.appendChild(entry);
    logEntries.scrollTop = logEntries.scrollHeight;
}

// Función para limpiar log
clearLogBtn.addEventListener('click', () => {
    logEntries.innerHTML = '';
    addToLog('info', 'Log limpiado');
});

// 1️⃣ Iniciar cámara
async function initCamera() {
    try {
        loadingText.textContent = '⏳ Solicitando acceso a cámara...';
        
        const constraints = {
            video: {
                facingMode: 'user',
                width: { ideal: 640 },
                height: { ideal: 480 }
            }
        };
        
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        video.srcObject = stream;
        cameraPlaceholder.style.display = 'none';
        cameraActive = true;
        
        statusMessage.textContent = '✅ Cámara lista - Cargando IA...';
        statusIndicator.className = 'status-indicator';
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });
        
        addToLog('success', 'Cámara inicializada correctamente');
        
        // Cargar modelos
        await loadModels();
        
    } catch (err) {
        statusMessage.textContent = '❌ Error: ' + err.message;
        statusIndicator.className = 'status-indicator error';
        cameraPlaceholder.style.display = 'flex';
        addToLog('error', 'Error al iniciar cámara', err.message);
        loadingOverlay.style.display = 'none';
    }
}

// 2️⃣ Cargar modelos de face-api
async function loadModels() {
    try {
        loadingText.textContent = '⏳ Cargando modelos de IA...';
        
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        await faceapi.loadFaceExpressionModel(MODEL_URL);
        
        modelsLoaded = true;
        loadingText.textContent = '✅ Modelos cargados exitosamente!';
        addToLog('success', 'Modelos de IA cargados correctamente');
        
        setTimeout(() => {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500);
        }, 1000);
        
        statusMessage.textContent = '🤖 IA lista - Detectando rostros...';
        
        // Iniciar detección
        detectFaces();
        
    } catch (err) {
        loadingText.textContent = '❌ Error cargando modelos: ' + err.message;
        addToLog('error', 'Error cargando modelos de IA', err.message);
        console.error('Error loading models:', err);
    }
}

// 3️⃣ Detección continua de rostros
async function detectFaces() {
    if (!video.paused && video.readyState === 4 && modelsLoaded) {
        try {
            const detections = await faceapi
                .detectAllFaces(video)
                .withFaceLandmarks()
                .withFaceExpressions();
            
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            
            if (detections.length > 0) {
                const resized = faceapi.resizeResults(detections, {
                    width: canvas.width,
                    height: canvas.height
                });
                
                faceapi.draw.drawDetections(canvas, resized);
                faceapi.draw.drawFaceLandmarks(canvas, resized);
                
                // Verificar si hay al menos un rostro válido
                const validFace = validateFace(detections[0]);
                
                if (validFace && !isFaceValid) {
                    isFaceValid = true;
                    lastValidFace = detections[0];
                    statusMessage.textContent = '✅ ¡Rostro válido detectado!';
                    statusIndicator.className = 'status-indicator active';
                    captureBtn.disabled = false;
                    addToLog('success', 'Rostro válido detectado', 'Expresión y posición correctas');
                }
                
                if (detections.length > 1) {
                    statusMessage.textContent = '⚠️ Múltiples rostros detectados';
                    statusIndicator.className = 'status-indicator error';
                    isFaceValid = false;
                    captureBtn.disabled = true;
                }
            } else {
                if (isFaceValid) {
                    isFaceValid = false;
                    statusMessage.textContent = '🔍 No se detectan rostros';
                    statusIndicator.className = 'status-indicator';
                    captureBtn.disabled = true;
                }
            }
        } catch (e) {
            console.log('Error en detección:', e);
        }
    }
    
    requestAnimationFrame(detectFaces);
}

// 4️⃣ Validar calidad del rostro
function validateFace(detection) {
    if (!detection) return false;
    
    const box = detection.detection.box;
    const expressions = detection.expressions;
    
    // Validar tamaño del rostro (debe ocupar al menos 30% del frame)
    const faceArea = box.width * box.height;
    const frameArea = canvas.width * canvas.height;
    const faceRatio = faceArea / frameArea;
    
    // Validar posición (rostro centrado)
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    const isCentered = 
        Math.abs(centerX - canvas.width / 2) < canvas.width * 0.2 &&
        Math.abs(centerY - canvas.height / 2) < canvas.height * 0.2;
    
    // Validar expresión (que no esté haciendo gestos extraños)
    const mainExpression = expressions.asSortedArray()[0];
    const isValidExpression = mainExpression.expression !== 'angry' && 
                             mainExpression.expression !== 'disgusted' &&
                             mainExpression.expression !== 'fearful' &&
                             mainExpression.probability < 0.7;
    
    return faceRatio > 0.1 && isCentered && isValidExpression;
}

// 5️⃣ Capturar imagen
function captureImage() {
    if (!isFaceValid || !lastValidFace) {
        addToLog('error', 'Intento de captura fallido', 'No hay rostro válido detectado');
        return;
    }
    
    // Crear canvas para la captura
    const captureCanvas = document.createElement('canvas');
    captureCanvas.width = video.videoWidth;
    captureCanvas.height = video.videoHeight;
    const captureCtx = captureCanvas.getContext('2d');
    
    // Dibujar el frame actual del video
    captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
    
    // Obtener imagen en base64
    const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.9);
    
    // Mostrar miniatura
    thumbnail.innerHTML = `<img src="${imageBase64}" class="captured-image" alt="Selfie capturada">`;
    
    // Extraer datos biométricos
    const biometricData = extractBiometricData(lastValidFace);
    
    // Guardar en log
    const logDetails = `
        Tamaño: ${captureCanvas.width}x${captureCanvas.height}<br>
        Rostro: ${Math.round(lastValidFace.detection.box.width)}x${Math.round(lastValidFace.detection.box.height)}<br>
        Expresión: ${lastValidFace.expressions.asSortedArray()[0].expression} (${(lastValidFace.expressions.asSortedArray()[0].probability * 100).toFixed(1)}%)<br>
        Base64: ${imageBase64.substring(0, 50)}...
    `;
    
    addToLog('success', '✅ Imagen capturada y datos biométricos extraídos', logDetails);
    
    // Habilitar botón siguiente
    nextBtn.disabled = false;
}

// 6️⃣ Extraer datos biométricos
function extractBiometricData(faceData) {
    const biometrics = {
        timestamp: new Date().toISOString(),
        faceBox: {
            x: Math.round(faceData.detection.box.x),
            y: Math.round(faceData.detection.box.y),
            width: Math.round(faceData.detection.box.width),
            height: Math.round(faceData.detection.box.height)
        },
        faceLandmarks: faceData.landmarks.positions.map(p => ({ x: p.x, y: p.y })),
        expressions: faceData.expressions,
        confidence: faceData.detection.score
    };
    
    // Aquí puedes enviar estos datos a tu backend
    console.log('Datos biométricos:', biometrics);
    
    return biometrics;
}

// Event listeners
captureBtn.addEventListener('click', captureImage);

prevBtn.addEventListener('click', () => {
    addToLog('info', 'Navegación: Anterior');
    // Aquí puedes implementar la lógica para volver atrás
});

nextBtn.addEventListener('click', () => {
    addToLog('info', '✅ Proceso completado - Continuando con el registro');
    // Aquí puedes implementar la lógica para continuar
});

// Iniciar aplicación
initCamera();

// Limpiar al cerrar
window.addEventListener('beforeunload', () => {
    if (video.srcObject) {
        video.srcObject.getTracks().forEach(track => track.stop());
    }
});