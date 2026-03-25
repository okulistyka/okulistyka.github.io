/* Animated, randomly tinted noise background
   - Generates a random tint each load (logged to console)
   - Renders at a reduced internal resolution then scales up for performance
*/
(function(){
  function randRange(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function pickTint(){ return { r: 255, g: 255, b: 255 }; }

  function initNoise(){
    const canvas = document.createElement('canvas');
    canvas.id = 'noise-canvas';
    canvas.style.position = 'fixed';
    canvas.style.top = '0';
    canvas.style.left = '0';
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.zIndex = '0';
    canvas.style.pointerEvents = 'none';
    document.body.insertBefore(canvas, document.body.firstChild);

    const ctx = canvas.getContext('2d');
    let buffer = document.createElement('canvas');
    let bctx = buffer.getContext('2d');

    // adjustable params
    let renderScale = 1; // fraction of final size to render to (lower = faster)
    const min = 8; // darkest pixel
    const max = 40; // brightest pixel
    // cap internal buffer to limit CPU/memory on large DPR screens
    const MAX_BUFFER_WIDTH = 512;
    const MAX_BUFFER_HEIGHT = 512

    // updateInterval in ms controls speed (lower = faster)
    // default: read from body[data-noise-fps] (fps), else 60ms (~16-17fps)
    function readInitialInterval(){
      const attr = document.body.getAttribute('data-noise-fps');
      if(attr){
        const fps = parseFloat(attr);
        if(!isNaN(fps) && fps > 0) return Math.round(1000 / fps);
      }
      return 60;
    }

    let updateInterval = readInitialInterval();
    let lastUpdate = 0;
    let intervalId = null;
    let isVisible = true;

    function resize(){
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.ceil(window.innerWidth * dpr));
      const h = Math.max(1, Math.ceil(window.innerHeight * dpr));
      canvas.width = w; canvas.height = h;
      canvas.style.width = window.innerWidth + 'px';
      canvas.style.height = window.innerHeight + 'px';

      buffer.width = Math.max(1, Math.min(MAX_BUFFER_WIDTH, Math.ceil(w * renderScale)));
      buffer.height = Math.max(1, Math.min(MAX_BUFFER_HEIGHT, Math.ceil(h * renderScale)));
    }
    resize();
    window.addEventListener('resize', resize);

    const tint = pickTint();
    console.info('noise.js mode: tiled, tint:', tint, 'updateInterval(ms):', updateInterval);

    function regenerateBuffer(){
      const bw = buffer.width;
      const bh = buffer.height;
      const imageData = bctx.createImageData(bw, bh);
      const data = imageData.data;
      for(let i=0;i<data.length;i+=4){
        const v = randRange(min, max);
        data[i]   = Math.min(255, Math.floor((v * tint.r) / 255));
        data[i+1] = Math.min(255, Math.floor((v * tint.g) / 255));
        data[i+2] = Math.min(255, Math.floor((v * tint.b) / 255));
        data[i+3] = 255;
      }
      bctx.putImageData(imageData, 0, 0);
    }

    // update+draw on an interval instead of every RAF to save CPU
    function updateAndDraw(){
      try{
        regenerateBuffer();
        // draw buffer as a repeating tile using a canvas pattern
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0,0,canvas.width,canvas.height);
        const pattern = ctx.createPattern(buffer, 'repeat');
        if(pattern){
          ctx.fillStyle = pattern;
          ctx.fillRect(0,0,canvas.width,canvas.height);
        }
      }catch(e){/* swallow canvas errors */}
    }

    function startInterval(){
      stopInterval();
      intervalId = setInterval(updateAndDraw, updateInterval);
    }

    function stopInterval(){
      if(intervalId !== null){ clearInterval(intervalId); intervalId = null; }
    }

    // pause when tab hidden to save CPU
    document.addEventListener('visibilitychange', function(){
      isVisible = document.visibilityState === 'visible';
      if(isVisible) startInterval(); else stopInterval();
    }, { passive: true });

    startInterval();

    // Public API
    window.noise = window.noise || {};
    window.noise.setSpeed = function(ms){
      if(typeof ms === 'number' && ms > 0){ updateInterval = ms; startInterval(); console.info('noise.js setSpeed(ms):', ms); }
    };
    window.noise.setFPS = function(fps){
      if(typeof fps === 'number' && fps > 0){ updateInterval = Math.round(1000 / fps); startInterval(); console.info('noise.js setFPS(fps):', fps); }
    };
    window.noise.setRenderScale = function(scale){
      if(typeof scale === 'number' && scale > 0 && scale <=1){ renderScale = scale; resize(); console.info('noise.js setRenderScale:', scale); }
    };
    window.noise.pause = function(){ stopInterval(); console.info('noise.js paused'); };
    window.noise.resume = function(){ if(isVisible) startInterval(); console.info('noise.js resumed'); };
    window.noise.getConfig = function(){ return { updateInterval, renderScale, tint, isVisible }; };
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    initNoise();
  } else {
    window.addEventListener('DOMContentLoaded', initNoise);
  }

})();
