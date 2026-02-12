// Elementos del DOM
const video = document.getElementById('video');
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const cameraBtn = document.getElementById('cameraBtn');
const cameraContainer = document.getElementById('cameraContainer');
const faceMessage = document.getElementById('faceMessage');
const loadingEl = document.getElementById('loading');
const capturedImage = document.getElementById('capturedImage');
const capturedPlaceholder = document.getElementById('capturedPlaceholder');
const nextBtn = document.getElementById('nextBtn');
const logPanel = document.getElementById('logPanel');
const logContent = document.getElementById('logContent');

// Variables de estado
let modelsLoaded = false;
let isFaceValid = false;
let lastValidFace = null;
let cameraActive = false;
let stream = null;

// URL de modelos - USANDO CDN (CORREGIDO)
const MODEL_URL = 'models/';

// ============================================
// 1. INICIAR CÁMARA
// ============================================
async function iniciarCamara() {
    try {
        loadingEl.style.display = 'flex';
        loadingEl.textContent = '⏳ Solicitando acceso a cámara...';
        
        stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: 'user' },
            audio: false
        });
        
        video.srcObject = stream;
        cameraContainer.style.display = 'block';
        cameraBtn.style.display = 'none';
        cameraActive = true;
        
        await new Promise((resolve) => {
            video.onloadedmetadata = () => {
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                resolve();
            };
        });
        
        // Cambiar botón a "Capturar Imagen"
        cameraBtn.textContent = '📸 Capturar Imagen';
        cameraBtn.style.display = 'block';
        cameraBtn.onclick = capturarImagen;
        
        // Cargar modelos
        await cargarModelos();
        
    } catch (error) {
        console.error('Error cámara:', error);
        loadingEl.style.display = 'none';
        alert('Error al acceder a la cámara: ' + error.message);
    }
}

// ============================================
// 2. CARGAR MODELOS (CORREGIDO)
// ============================================
async function cargarModelos() {
    try {
        loadingEl.textContent = '⏳ Cargando modelos de IA...';
        
        await faceapi.loadSsdMobilenetv1Model(MODEL_URL);
        await faceapi.loadFaceLandmarkModel(MODEL_URL);
        await faceapi.loadFaceExpressionModel(MODEL_URL);
        
        modelsLoaded = true;
        loadingEl.textContent = '✅ Modelos cargados!';
        
        setTimeout(() => {
            loadingEl.style.display = 'none';
        }, 1000);
        
        // Iniciar detección
        detectarRostros();
        
    } catch (error) {
        console.error('Error cargando modelos:', error);
        loadingEl.textContent = '❌ Error cargando modelos';
        setTimeout(() => {
            loadingEl.style.display = 'none';
        }, 2000);
    }
}

// ============================================
// 3. DETECTAR ROSTROS (CORREGIDO)
// ============================================
async function detectarRostros() {
    if (!modelsLoaded || !cameraActive) return;
    
    try {
        const detections = await faceapi
            .detectAllFaces(video)
            .withFaceLandmarks()
            .withFaceExpressions();
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (detections.length === 1) {
            // Dibujar detección
            const resized = faceapi.resizeResults(detections, {
                width: canvas.width,
                height: canvas.height
            });
            
            faceapi.draw.drawDetections(canvas, resized);
            faceapi.draw.drawFaceLandmarks(canvas, resized);
            
            // VALIDAR ROSTRO - CRITERIOS MÁS SUAVES
            const detection = detections[0];
            const box = detection.detection.box;
            const faceArea = box.width * box.height;
            const frameArea = canvas.width * canvas.height;
            const faceRatio = faceArea / frameArea;
            
            // Criterios más flexibles
            if (faceRatio > 0.08) { // Solo requiere que el rostro sea visible
                if (!isFaceValid) {
                    isFaceValid = true;
                    lastValidFace = detection;
                    
                    // ✅ MOSTRAR MENSAJE DE ROSTRO VÁLIDO
                    faceMessage.textContent = '✅ ¡Rostro válido!';
                    faceMessage.className = 'face-message valid';
                    
                    // Habilitar botón de captura
                    cameraBtn.disabled = false;
                    
                    // Agregar al log
                    agregarLog('success', 'Rostro válido detectado');
                }
            } else {
                isFaceValid = false;
                faceMessage.textContent = '📱 Acerca tu rostro a la cámara';
                faceMessage.className = 'face-message invalid';
                cameraBtn.disabled = true;
            }
        } else if (detections.length > 1) {
            faceMessage.textContent = '⚠️ Solo un rostro por favor';
            faceMessage.className = 'face-message error';
            isFaceValid = false;
            cameraBtn.disabled = true;
        } else {
            faceMessage.textContent = '🔍 Buscando rostro...';
            faceMessage.className = 'face-message invalid';
            isFaceValid = false;
            cameraBtn.disabled = true;
        }
        
    } catch (error) {
        console.log('Error detección:', error);
    }
    
    // Continuar detectando
    requestAnimationFrame(detectarRostros);
}

// ============================================
// 4. CAPTURAR IMAGEN
// ============================================
function capturarImagen() {
    if (!isFaceValid || !lastValidFace) {
        alert('No hay un rostro válido para capturar');
        return;
    }
    
    try {
        // Crear canvas para captura
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = video.videoWidth;
        captureCanvas.height = video.videoHeight;
        const captureCtx = captureCanvas.getContext('2d');
        
        // Capturar frame
        captureCtx.drawImage(video, 0, 0, captureCanvas.width, captureCanvas.height);
        
        // Convertir a base64
        const imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.9);
        
        // Mostrar miniatura
        capturedImage.src = imageBase64;
        capturedImage.style.display = 'block';
        capturedPlaceholder.style.display = 'none';
        
        // Extraer datos biométricos
        const biometricData = {
            timestamp: new Date().toISOString(),
            imageBase64: imageBase64,
            faceBox: {
                x: Math.round(lastValidFace.detection.box.x),
                y: Math.round(lastValidFace.detection.box.y),
                width: Math.round(lastValidFace.detection.box.width),
                height: Math.round(lastValidFace.detection.box.height)
            },
            expressions: lastValidFace.expressions,
            confidence: lastValidFace.detection.score,
            landmarks: lastValidFace.landmarks.positions.length
        };
        
        // Mostrar panel de log
        logPanel.style.display = 'block';
        
        // Agregar al log con detalles
        const expressionMain = lastValidFace.expressions.asSortedArray()[0];
        const detalles = `
            📸 Imagen capturada: ${captureCanvas.width}x${captureCanvas.height}<br>
            👤 Rostro: ${biometricData.faceBox.width}x${biometricData.faceBox.height}<br>
            😀 Expresión: ${expressionMain.expression} (${(expressionMain.probability * 100).toFixed(1)}%)<br>
            🎯 Confianza: ${(biometricData.confidence * 100).toFixed(1)}%<br>
            🔑 Base64: ${imageBase64.substring(0, 60)}...
        `;
        
        agregarLog('success', '✅ Selfie capturada exitosamente', detalles);
        
        // Habilitar botón siguiente
        nextBtn.disabled = false;
        
        // Guardar en consola
        console.log('Datos biométricos:', biometricData);
        
    } catch (error) {
        console.error('Error capturando:', error);
        agregarLog('error', 'Error al capturar imagen', error.message);
    }
}

// ============================================
// 5. AGREGAR AL LOG
// ============================================
function agregarLog(tipo, mensaje, detalles = '') {
    const entry = document.createElement('div');
    entry.className = `log-entry ${tipo}`;
    
    const timestamp = new Date().toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    entry.innerHTML = `
        <span class="log-timestamp">[${timestamp}]</span>
        <strong>${mensaje}</strong>
        ${detalles ? `<br><small style="color: #666; display: block; margin-top: 5px;">${detalles}</small>` : ''}
    `;
    
    logContent.appendChild(entry);
    logContent.scrollTop = logContent.scrollHeight;
}

// ============================================
// 6. LIMPIAR LOG
// ============================================
document.getElementById('clearLogBtn').addEventListener('click', () => {
    logContent.innerHTML = '';
    agregarLog('info', 'Log limpiado');
});

// ============================================
// 7. EVENT LISTENERS
// ============================================

// Botón abrir cámara
cameraBtn.addEventListener('click', iniciarCamara);

// Botón anterior
prevBtn.addEventListener('click', () => {
    agregarLog('info', 'Navegación: Anterior');
});

// Botón siguiente
nextBtn.addEventListener('click', () => {
    agregarLog('success', '✅ Proceso completado');
    alert('¡Registro completado exitosamente!');
});

// ============================================
// 8. LIMPIAR AL CERRAR
// ============================================
window.addEventListener('beforeunload', () => {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
    }
});

// Iniciar loading
window.onload = () => {
    setTimeout(() => {
        if (loadingEl.style.display !== 'none') {
            loadingEl.style.display = 'none';
        }
    }, 3000);
};