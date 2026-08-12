/* Persistent Global Audio Controller & Seamless SPA Router */
(function () {
    const AUDIO_SRC = 'Merry Christmas, I Miss You.mp3';

    // Singleton Audio instance attached to window
    let audio = window.sharedAudio;
    if (!audio) {
        audio = new Audio(AUDIO_SRC);
        audio.preload = 'auto';
        window.sharedAudio = audio;
    }

    // Restore state from sessionStorage
    const savedTime = parseFloat(sessionStorage.getItem('bgAudio_currentTime') || '0');
    const wasPlaying = sessionStorage.getItem('bgAudio_isPlaying') === 'true';
    const isMuted = sessionStorage.getItem('bgAudio_isMuted') === 'true';

    if (savedTime > 0) {
        try {
            audio.currentTime = savedTime;
        } catch (e) { }
    }
    audio.muted = isMuted;

    function saveState() {
        sessionStorage.setItem('bgAudio_currentTime', audio.currentTime.toString());
        sessionStorage.setItem('bgAudio_isPlaying', (!audio.paused && !audio.ended).toString());
        sessionStorage.setItem('bgAudio_isMuted', audio.muted.toString());
    }

    audio.addEventListener('timeupdate', saveState);
    window.addEventListener('beforeunload', saveState);
    window.addEventListener('pagehide', saveState);

    if (wasPlaying) {
        const playPromise = audio.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                const handleFirstUserInteraction = () => {
                    audio.play().catch(() => { });
                    document.removeEventListener('click', handleFirstUserInteraction);
                    document.removeEventListener('keydown', handleFirstUserInteraction);
                };
                document.addEventListener('click', handleFirstUserInteraction, { once: true });
                document.addEventListener('keydown', handleFirstUserInteraction, { once: true });
            });
        }
    }

    // Floating Mini Player UI
    function createFloatingMiniPlayer() {
        if (document.getElementById('floating-mini-player')) return;

        const container = document.createElement('div');
        container.id = 'floating-mini-player';
        container.className = 'fixed bottom-4 right-4 z-50 flex items-center space-x-3 bg-white/95 backdrop-blur-md p-2.5 pr-4 rounded-2xl border border-pinkSoft-200 shadow-xl transition-all duration-300 transform hover:scale-[1.02]';
        container.innerHTML = `
            <div class="relative w-11 h-11 rounded-xl overflow-hidden shadow-sm flex-shrink-0 bg-slate-900 border border-white">
                <img src="The Notebook.jpg" alt="The Notebook" class="w-full h-full object-cover">
                <div class="absolute inset-0 bg-slate-950/40 flex items-center justify-center">
                    <i id="mini-disc-icon" class="fa-solid fa-compact-disc text-white text-sm" style="transition: transform 0.5s;"></i>
                </div>
            </div>
            <div class="flex-grow min-w-0 pr-1" style="max-width: 140px;">
                <h4 class="text-xs font-bold text-slate-800 truncate leading-tight">Merry Christmas, I Miss You</h4>
                <div class="w-full bg-slate-200 rounded-full h-1 mt-1.5 overflow-hidden">
                    <div id="mini-progress" class="bg-pinkSoft-500 h-1 rounded-full w-0 transition-all duration-150"></div>
                </div>
            </div>
            <div class="flex items-center space-x-1.5 flex-shrink-0">
                <button id="mini-play-btn" class="w-8 h-8 rounded-xl bg-pinkSoft-500 hover:bg-pinkSoft-600 text-white flex items-center justify-center text-xs shadow-sm transition-all">
                    <i id="mini-play-icon" class="fa-solid fa-play ml-0.5"></i>
                </button>
                <button id="mini-mute-btn" class="w-8 h-8 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 flex items-center justify-center text-xs transition-all">
                    <i id="mini-mute-icon" class="fa-solid fa-volume-high"></i>
                </button>
            </div>
        `;
        document.body.appendChild(container);

        const miniPlayBtn = document.getElementById('mini-play-btn');
        const miniPlayIcon = document.getElementById('mini-play-icon');
        const miniMuteBtn = document.getElementById('mini-mute-btn');
        const miniMuteIcon = document.getElementById('mini-mute-icon');
        const miniProgress = document.getElementById('mini-progress');
        const miniDiscIcon = document.getElementById('mini-disc-icon');

        let rotationAngle = 0;
        let rotationInterval = null;

        function updateMiniUI() {
            const isPlaying = !audio.paused && !audio.ended;

            if (isPlaying) {
                miniPlayIcon.className = 'fa-solid fa-pause';
                if (!rotationInterval) {
                    rotationInterval = setInterval(() => {
                        rotationAngle = (rotationAngle + 5) % 360;
                        if (miniDiscIcon) miniDiscIcon.style.transform = `rotate(${rotationAngle}deg)`;
                    }, 100);
                }
            } else {
                miniPlayIcon.className = 'fa-solid fa-play ml-0.5';
                if (rotationInterval) {
                    clearInterval(rotationInterval);
                    rotationInterval = null;
                }
            }

            miniMuteIcon.className = audio.muted ? 'fa-solid fa-volume-xmark text-pinkSoft-500' : 'fa-solid fa-volume-high';

            if (audio.duration) {
                const pct = (audio.currentTime / audio.duration) * 100;
                miniProgress.style.width = `${pct}%`;
            }
        }

        miniPlayBtn.addEventListener('click', function () {
            if (audio.paused) {
                audio.play().catch(() => { });
            } else {
                audio.pause();
            }
            saveState();
            updateMiniUI();
            if (window.syncProfilPlayerUI) window.syncProfilPlayerUI();
        });

        miniMuteBtn.addEventListener('click', function () {
            audio.muted = !audio.muted;
            saveState();
            updateMiniUI();
            if (window.syncProfilPlayerUI) window.syncProfilPlayerUI();
        });

        audio.addEventListener('timeupdate', updateMiniUI);
        audio.addEventListener('play', updateMiniUI);
        audio.addEventListener('pause', updateMiniUI);
        audio.addEventListener('ended', updateMiniUI);

        updateMiniUI();
    }

    // Seamless SPA Router: Fetch & Swap content dynamically without unloading DOM/Audio
    async function loadPageSeamlessly(url, pushState = true) {
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error('Network error loading page');
            const html = await res.text();

            const parser = new DOMParser();
            const newDoc = parser.parseFromString(html, 'text/html');

            // 1. Swap Document Title
            if (newDoc.title) {
                document.title = newDoc.title;
            }

            // 2. Swap Main Container
            const oldMain = document.querySelector('main');
            const newMain = newDoc.querySelector('main');

            if (oldMain && newMain) {
                oldMain.style.transition = 'opacity 0.15s ease-out';
                oldMain.style.opacity = '0';

                setTimeout(() => {
                    oldMain.innerHTML = newMain.innerHTML;
                    oldMain.className = newMain.className;
                    oldMain.style.opacity = '1';
                    window.scrollTo({ top: 0, behavior: 'smooth' });

                    // Re-execute inline scripts inside newDoc or main
                    const scripts = newDoc.querySelectorAll('script');
                    scripts.forEach(script => {
                        if (!script.src && script.innerHTML.trim()) {
                            try {
                                eval(script.innerHTML);
                            } catch (e) { }
                        }
                    });

                    // Page-specific initializers
                    if (window.filterDay && document.getElementById('schedule-container')) {
                        window.filterDay('senin');
                    }
                    if (window.syncProfilPlayerUI) {
                        window.syncProfilPlayerUI();
                    }
                }, 150);
            }

            // 3. Update Active Navigation Links State in Header & Mobile Menu
            const currentPath = new URL(url, window.location.origin).pathname;
            document.querySelectorAll('header nav a, #mobile-menu a').forEach(a => {
                const aPath = new URL(a.href, window.location.origin).pathname;
                const isCurrent = aPath === currentPath || (currentPath.endsWith('/') && aPath.endsWith('index.html'));

                if (isCurrent) {
                    a.classList.add('bg-pinkSoft-100', 'text-pinkSoft-600');
                    a.classList.remove('hover:bg-pinkSoft-50', 'text-slate-700');
                } else {
                    a.classList.remove('bg-pinkSoft-100', 'text-pinkSoft-600');
                    a.classList.add('text-slate-700');
                }
            });

            // Close mobile menu if open
            const mobileMenu = document.getElementById('mobile-menu');
            if (mobileMenu && !mobileMenu.classList.contains('hidden')) {
                mobileMenu.classList.add('hidden');
            }

            if (pushState) {
                history.pushState({ url: url }, '', url);
            }
        } catch (err) {
            console.error('Seamless load fallback to standard navigation:', err);
            window.location.href = url;
        }
    }

    // Intercept all internal navigation link clicks
    document.addEventListener('click', function (e) {
        const link = e.target.closest('a');
        if (link && link.href) {
            const linkUrl = new URL(link.href, window.location.origin);
            if (linkUrl.origin === window.location.origin && linkUrl.pathname.endsWith('.html')) {
                e.preventDefault();
                saveState();
                loadPageSeamlessly(link.href, true);
            }
        }
    });

    // Handle Browser Back / Forward buttons
    window.addEventListener('popstate', function (e) {
        if (e.state && e.state.url) {
            loadPageSeamlessly(e.state.url, false);
        } else {
            loadPageSeamlessly(window.location.href, false);
        }
    });

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createFloatingMiniPlayer);
    } else {
        createFloatingMiniPlayer();
    }

    window.GlobalMusicController = {
        audio: audio,
        saveState: saveState,
        loadPageSeamlessly: loadPageSeamlessly
    };
})();
