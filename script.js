document.addEventListener('DOMContentLoaded', () => {
    // --- Configuración ---
    // --- Configuración Dinámica ---
    const config = window.APP_CONFIG || {
        emisora: { nombre: 'Radio Espectacular', api_url: '', timezone: 'America/Lima' },
        imagenes: { logo_principal: 'LOGO.png' }
    };

    const RADIO_CONFIG = {
        name: config.emisora.nombre,
        api_url: config.emisora.api_url,
        logo: config.imagenes.logo_principal,
        timezone: config.emisora.timezone,
        metaUrl: `./proxy.php?url=${encodeURIComponent(config.emisora.api_url)}`
    };

    // --- Elementos ---
    const audioPlayer = document.getElementById('audioPlayer');
    const playPauseButton = document.getElementById('playPauseButton');
    const volumeSlider = document.getElementById('volumeSlider');
    const volumePercentage = document.getElementById('volumePercentage');
    const themeToggle = document.getElementById('themeToggle');
    const mainRadioImage = document.getElementById('mainRadioImage');
    const playerStationImage = document.getElementById('playerStationImage');
    const songTitleElement = document.getElementById('songTitle');
    const dateElement = document.getElementById('currentDate');
    const timeElement = document.getElementById('currentTime');

    let isPlaying = false;
    let currentSongTitle = '';
    let lastDetectedSong = '';
    let lastArtworkQuery = '';

    // --- Inicialización ---
    function init() {
        updateClock();
        setInterval(updateClock, 1000);
        fetchCurrentSong();
        setInterval(fetchCurrentSong, 5000);
        
        // Inicializar icono de tema correctamente (Luna = Opción a modo oscuro)
        const themeIcon = themeToggle.querySelector('i') || themeToggle.querySelector('svg');
        if (themeIcon) {
            themeIcon.setAttribute('data-lucide', 'moon');
        }
        lucide.createIcons();
    }

    // --- Control de Audio ---
    playPauseButton.addEventListener('click', togglePlay);

    function togglePlay() {
        if (isPlaying) {
            audioPlayer.pause();
            // Limpiamos el src al pausar para que no siga almacenando buffer
            audioPlayer.setAttribute('src', '');
            audioPlayer.load();
            isPlaying = false;
            updateUI();
            targetOpacity = 0;
        } else {
            // Reasignamos el stream original con un timestamp para forzar el "VIVO"
            const streamUrl = config.emisora.streaming_url;
            audioPlayer.setAttribute('src', streamUrl + (streamUrl.includes('?') ? '&' : '?') + 't=' + Date.now());
            audioPlayer.load();
            audioPlayer.play().then(() => {
                isPlaying = true;
                updateUI();
                startVisualizer();
            }).catch(err => console.error("Error al reproducir:", err));
        }
    }

    audioPlayer.onplay = () => { isPlaying = true; updateUI(); startVisualizer(); };
    audioPlayer.onpause = () => { isPlaying = false; updateUI(); targetOpacity = 0; };

    function updateUI() {
        const icon = playPauseButton.querySelector('i') || playPauseButton.querySelector('svg');
        if (icon) {
            icon.setAttribute('data-lucide', isPlaying ? 'pause' : 'play');
            lucide.createIcons();
        }
    }

    volumeSlider.addEventListener('input', (e) => {
        const vol = e.target.value;
        audioPlayer.volume = vol;
        volumePercentage.textContent = `${Math.round(vol * 100)}%`;
        if (gainNode) gainNode.gain.value = vol;
        targetOpacity = vol == 0 ? 0 : Math.max(0.2, vol);
    });

    // --- Visualizador (Onda Suave) ---
    let audioContext, analyser, gainNode, dataArray, bufferLength, canvas, ctx;
    let visualizerStarted = false;
    let visualOpacity = 0;
    let targetOpacity = 0;
    let smoothEnergy = 0;
    let visualMemoryLevel = 20; // Inercia visual persistente

    function startVisualizer() {
        if (visualizerStarted) {
            if (audioContext && audioContext.state === "suspended") audioContext.resume();
            targetOpacity = 0.6;
            return;
        }
        visualizerStarted = true;
        targetOpacity = 0.6;

        canvas = document.getElementById("audioVisualizer");
        if (!canvas) return;
        ctx = canvas.getContext("2d");
        resizeCanvas();
        window.onresize = resizeCanvas;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 512; 
        analyser.smoothingTimeConstant = 0.72; // Picos más nerviosos y reactivos
        
        gainNode = audioContext.createGain();
        gainNode.gain.value = audioPlayer.volume;

        const source = audioContext.createMediaElementSource(audioPlayer);
        source.connect(gainNode);
        gainNode.connect(analyser); 
        analyser.connect(audioContext.destination);

        bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);

        draw();
    }

    function resizeCanvas() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = 600; 
    }

    function draw() {
        requestAnimationFrame(draw);
        if (!analyser || !ctx) return;

        analyser.getByteFrequencyData(dataArray);
        const width = canvas.width;
        const height = canvas.height;

        ctx.clearRect(0, 0, width, height);

        const barCount = 120; // Number of dynamic bars
        // Frequencies above ~60-70% are mostly high-pitch noise, so we focus on the lower/mid spectrum
        const usefulDataBins = Math.floor(bufferLength * 0.65); 
        const step = Math.max(1, Math.floor(usefulDataBins / barCount));
        
        const gap = (window.innerWidth < 768) ? 1 : 3; // Smaller gaps on mobile
        const barWidth = (width / barCount) - gap;
        let x = 0;

        for (let i = 0; i < barCount; i++) {
            let maxVal = 0;
            // Get highest magnitude within the frequency slice for punchier rhythm response
            for (let j = 0; j < step; j++) {
                const idx = i * step + j;
                if (idx < bufferLength && dataArray[idx] > maxVal) {
                    maxVal = dataArray[idx];
                }
            }
            
            // Normalize and make the response curve punchy (exponential)
            let normalizedVal = maxVal / 255;
            let barHeight = Math.pow(normalizedVal, 1.25) * height * 0.95;

            // Generate vibrant dynamic colors flowing over time and spectrum
            const hue = (i * (360 / barCount) + (Date.now() * 0.08)) % 360;
            
            // Gradient for each bar to give it a premium glow
            const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
            gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, 0.8)`);
            gradient.addColorStop(1, `hsla(${hue + 40}, 100%, 65%, 1)`);

            ctx.fillStyle = gradient;

            // Draw rounded-looking bars by adding small minimum height
            ctx.beginPath();
            ctx.roundRect(x, height - barHeight, barWidth, Math.max(barHeight, 8), [4, 4, 0, 0]);
            ctx.fill();

            x += barWidth + gap;
        }
    }

    // --- Metadatos e iTunes ---
    async function fetchCurrentSong() {
        if (!RADIO_CONFIG.api_url) {
            const finalSong = `Escuchando ${RADIO_CONFIG.name} | 24 Horas Online`;
            if (finalSong !== lastDetectedSong) {
                lastDetectedSong = finalSong;
                songTitleElement.innerHTML = finalSong;
            }
            return;
        }
        try {
            const res = await fetch(RADIO_CONFIG.metaUrl);
            const data = await res.json();
            
            let songStr = "";
            if (data.songtitle) songStr = data.songtitle;
            else if (data.title) songStr = data.title;

            // Si no hay canción, usamos un fallback atractivo en lugar de no hacer nada
            const finalSong = songStr || `Escuchando ${RADIO_CONFIG.name} | 24 Horas Online`;
            
            if (finalSong === lastDetectedSong) return;
            lastDetectedSong = finalSong;

            const cleanTitle = finalSong.replace(/^[A-Za-z]+:\s*\d+\s*/, '').trim();
            songTitleElement.innerHTML = cleanTitle; 

            if (cleanTitle.includes(' - ') && songStr) {
                const query = cleanTitle.replace(' - ', ' ');
                if (query !== lastArtworkQuery) {
                    lastArtworkQuery = query;
                    const art = await fetchItunesArt(query);
                    updateArtwork(art);
                }
            } else if (!songStr) {
                updateArtwork(null);
            }
        } catch (e) {
            console.error("Error metadatos:", e);
        }
    }

    async function fetchItunesArt(query) {
        try {
            const url = `https://itunes.apple.com/search?term=${encodeURIComponent(query)}&entity=song&limit=1`;
            const res = await fetch(`./proxy.php?url=${encodeURIComponent(url)}`);
            const data = await res.json();
            if (data.results && data.results.length > 0) {
                return data.results[0].artworkUrl100.replace('100x100bb', '600x600bb');
            }
        } catch (e) {
            console.error("Error iTunes:", e);
        }
        return null;
    }

    function updateArtwork(url) {
        const finalUrl = url || RADIO_CONFIG.logo;
        
        // Animamos la transición del fondo y la imagen central
        mainRadioImage.style.opacity = '0';
        
        setTimeout(() => {
            mainRadioImage.src = finalUrl;
            mainRadioImage.style.opacity = '1';
            
            // Evitar remover imagen si no hay proxy/artwork cargado
            if (finalUrl === RADIO_CONFIG.logo && document.body.style.backgroundImage.includes('FONDO%202.jpg')) {
                // do nothing to background to keep the FONDO 2.jpg
            } else {
                document.body.style.backgroundImage = `linear-gradient(rgba(0,0,0,0.5), rgba(0,0,0,0.5)), url(${finalUrl})`;
            }
        }, 200);
    }

    // --- Utilidades ---
    function updateClock() {
        const now = new Date();
        const dateOptions = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
        const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };
        dateElement.textContent = new Intl.DateTimeFormat('es-ES', dateOptions).format(now);
        timeElement.textContent = new Intl.DateTimeFormat('es-ES', timeOptions).format(now);
    }

    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        const isDark = document.body.classList.contains('dark-mode');
        const icon = themeToggle.querySelector('i') || themeToggle.querySelector('svg');
        if (icon) {
            icon.setAttribute('data-lucide', isDark ? 'sun' : 'moon');
            lucide.createIcons();
        }
    });

    init();
});
