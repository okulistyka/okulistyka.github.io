/* Animated noise background
   - Renders at a reduced internal resolution then scales up for performance
*/
(function(){
  function randRange(min, max){ return Math.floor(Math.random()*(max-min+1))+min; }
  function pickTint(){ return { r: 255, g: 255, b: 255 }; }

  function initNoise(){
    // Determine rendering mode: default canvas overlay, or CSS background data-URL tile
    const useCss = document.body.getAttribute('data-noise-mode') === 'css';

    let canvas = null;
    let ctx = null;
    if(!useCss){
      canvas = document.createElement('canvas');
      canvas.id = 'noise-canvas';
      canvas.style.position = 'fixed';
      canvas.style.top = '0';
      canvas.style.left = '0';
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      canvas.style.zIndex = '0';
      canvas.style.pointerEvents = 'none';
      document.body.insertBefore(canvas, document.body.firstChild);
      ctx = canvas.getContext('2d');
    }

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
    // CSS layering elements for smooth swaps when useCss===true
    let cssLayerA = null;
    let cssLayerB = null;
    let cssActiveIndex = 0; // 0 => A visible, 1 => B visible

    function resize(){
      const dpr = window.devicePixelRatio || 1;
      const w = Math.max(1, Math.ceil(window.innerWidth * dpr));
      const h = Math.max(1, Math.ceil(window.innerHeight * dpr));
      if(canvas){
        canvas.width = w; canvas.height = h;
        canvas.style.width = window.innerWidth + 'px';
        canvas.style.height = window.innerHeight + 'px';
      }

      if(useCss){
        // For CSS tiled background, keep a small square tile to keep data-URLs compact
        const tile = Math.max(1, Math.min(256, Math.ceil(128 * renderScale)));
        buffer.width = tile;
        buffer.height = tile;
      } else {
        buffer.width = Math.max(1, Math.min(MAX_BUFFER_WIDTH, Math.ceil(w * renderScale)));
        buffer.height = Math.max(1, Math.min(MAX_BUFFER_HEIGHT, Math.ceil(h * renderScale)));
      }
    }
    resize();
    if(!useCss) window.addEventListener('resize', resize);

    const tint = pickTint();
    console.info('noise.js mode: tiled, css: ', useCss, ' tint:', tint, 'updateInterval(ms):', updateInterval);

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
        if(useCss){
          try{
            const dataUrl = buffer.toDataURL('image/png');
            // Ensure layering elements exist
            if(!cssLayerA || !cssLayerB){
              cssLayerA = document.createElement('div');
              cssLayerB = document.createElement('div');
              const baseStyle = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;background-repeat:repeat;background-position:0 0;background-attachment:fixed;';
              cssLayerA.style.cssText = baseStyle + 'z-index:0;';
              cssLayerB.style.cssText = baseStyle + 'z-index:-1;';
              // Insert as first children so content overlays these layers
              document.body.insertBefore(cssLayerB, document.body.firstChild);
              document.body.insertBefore(cssLayerA, document.body.firstChild);
              cssActiveIndex = 0;
            }

            // Determine inactive layer to receive the new image
            const inactive = (cssActiveIndex === 0) ? cssLayerB : cssLayerA;
            const active = (cssActiveIndex === 0) ? cssLayerA : cssLayerB;

            // Set new image on inactive (on top by changing z-index) so active remains visible
            inactive.style.backgroundImage = 'url("' + dataUrl + '")';
            // Also set body background for iOS off viewport rendering
            document.body.style.backgroundImage = 'url("' + dataUrl + '")';
            inactive.style.zIndex = '1';
            active.style.zIndex = '0';

            // Wait for the image to load, then clear the old layer and flip active index
            const img = new Image();
            img.onload = function(){
              // Reset stacking so the newly-active layer becomes the active one
              inactive.style.zIndex = '0';
              active.style.zIndex = '-1';
              cssActiveIndex = (cssActiveIndex === 0) ? 1 : 0;
            };
            img.onerror = function(){
              // On error, don't swap — keep previous image
              inactive.style.backgroundImage = 'none';
              inactive.style.zIndex = '-1';
            };
            img.src = dataUrl;
          }catch(e){/* swallow toDataURL errors */}
        } else if(ctx){
          // draw buffer as a repeating tile using a canvas pattern
          ctx.imageSmoothingEnabled = false;
          ctx.clearRect(0,0,canvas.width,canvas.height);
          const pattern = ctx.createPattern(buffer, 'repeat');
          if(pattern){
            ctx.fillStyle = pattern;
            ctx.fillRect(0,0,canvas.width,canvas.height);
          }
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
    // Return latest data URL when in CSS mode
    window.noise.getDataURL = function(){ if(useCss && buffer) try{ return buffer.toDataURL('image/png'); }catch(e){ return null; } return null; };
    window.noise.isCssMode = function(){ return !!useCss; };
  }

  if (document.readyState === 'complete' || document.readyState === 'interactive'){
    initNoise();
  } else {
    window.addEventListener('DOMContentLoaded', initNoise);
  }

})();
