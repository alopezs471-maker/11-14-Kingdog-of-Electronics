(function(){
  "use strict";

  /* =====================================================================
   *  Kingdog · Simulador de reparación de smartphone modular
   *  Desmontaje y montaje guiados de 15 módulos, 6 flexes y 14 tornillos.
   *  Las piezas encajan por capas y muestran en rojo sus bloqueos activos.
   * ===================================================================== */

  // ---------- Utilidades ----------
  var store = {
    get: function(k, d){ try { var v = localStorage.getItem(k); return v === null ? d : v; } catch(e){ return d; } },
    set: function(k, v){ try { localStorage.setItem(k, v); } catch(e){} }
  };
  function $(id){ return document.getElementById(id); }
  function fmtTime(ms){
    var s = Math.floor(ms / 1000);
    var m = Math.floor(s / 60);
    s = s % 60;
    return (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  var PART_IDS = [
    'simTray', 'cover', 'nfcCoil', 'battery', 'rearCameras', 'mainboard',
    'speaker', 'chargingBoard', 'vibrator', 'topSensors', 'frontCamera', 'earpiece', 'sideFlex', 'midFrame', 'display'
  ];
  var SCREW_GROUPS = {
    cover: ['cover-tl', 'cover-tr', 'cover-bl', 'cover-br'],
    mainboard: ['board-tl', 'board-br'],
    speaker: ['speaker-left', 'speaker-right'],
    chargingBoard: ['charge-left', 'charge-right'],
    midFrame: ['frame-tl', 'frame-tr', 'frame-bl', 'frame-br']
  };
  var SCREW_IDS = Object.keys(SCREW_GROUPS).reduce(function(all, group){
    return all.concat(SCREW_GROUPS[group]);
  }, []);
  var CONNECTOR_KEYS = ['battery', 'camera', 'topSensors', 'sideFlex', 'interconnect', 'display'];
  var HOLD_MS = 550;

  // ---------- Estado ----------
  var state = {
    tool: 'destornillador',
    goal: 'desarmar',
    mode: store.get('kingdog.mode', 'guia'),
    screws: {},
    connections: { battery: true, camera: true, topSensors: true, sideFlex: true, interconnect: true, display: true },
    installed: {},
    trayScrewCount: 0,
    hint: false,
    paused: false,
    muted: store.get('kingdog.muted', '0') === '1',
    started: false,
    elapsed: 0,
    lastTick: 0,
    errors: 0,
    finished: false
  };
  PART_IDS.forEach(function(id){ state.installed[id] = true; });
  SCREW_IDS.forEach(function(id){ state.screws[id] = true; });

  var els = {
    app: $('app'),
    modeLabel: $('modeLabel'),
    messageBar: $('messageBar'),
    workbench: $('workbench'),
    phoneStage: $('phoneStage'),
    goalPill: $('goalPill'),
    stepPill: $('stepPill'),
    timerPill: $('timerPill'),
    trayPanel: document.querySelector('.tray-panel'),
    trayList: $('trayList'),
    trayEmpty: $('trayEmpty'),
    pauseOverlay: $('pauseOverlay'),
    successOverlay: $('successOverlay'),
    successTitle: $('successTitle'),
    successText: $('successText'),
    successStats: $('successStats'),
    modeBtn: $('modeBtn'),
    modeBtnText: $('modeBtnText'),
    xrayBtn: $('xrayBtn'),
    pauseBtn: $('pauseBtn'),
    resumeBtn: $('resumeBtn'),
    resetBtn: $('resetBtn'),
    soundBtn: $('soundBtn'),
    soundWaves: $('soundWaves'),
    themeBtn: $('themeBtn'),
    playAgainBtn: $('playAgainBtn'),
    restartBtn: $('restartBtn'),
    infoTooltip: $('infoTooltip'),
    infoTooltipTitle: $('infoTooltipTitle'),
    infoTooltipBody: $('infoTooltipBody')
  };
  PART_IDS.forEach(function(id){ els[id] = $(id); });
  var screwEls = {};
  SCREW_IDS.forEach(function(id){ screwEls[id] = $('screw-' + id); });
  var connectorEls = {
    battery: $('batteryConnector'),
    camera: $('cameraConnector'),
    topSensors: $('topSensorsConnector'),
    sideFlex: $('sideFlexConnector'),
    interconnect: $('interconnectConnector'),
    display: $('displayConnector')
  };

  // ---------- Audio ----------
  var audioCtx = null;
  function getCtx(){
    if (!audioCtx) {
      try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
      catch(e){ audioCtx = null; }
    }
    if (audioCtx && audioCtx.state === 'suspended') { try { audioCtx.resume(); } catch(e){} }
    return audioCtx;
  }
  function beep(freq, dur, type, gainVal, glideTo, delay){
    if (state.muted) return;
    var ctx = getCtx();
    if (!ctx) return;
    try {
      var t0 = ctx.currentTime + (delay || 0);
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = type || 'sine';
      osc.frequency.setValueAtTime(freq, t0);
      if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
      gain.gain.setValueAtTime(gainVal || 0.05, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(t0);
      osc.stop(t0 + dur);
    } catch(e){}
  }
  function sndScrewOut(){ beep(520, 0.12, 'square', 0.04, 780); }
  function sndScrewIn(){ beep(780, 0.12, 'square', 0.04, 520); }
  function sndClip(){ beep(700, 0.08, 'triangle', 0.05, 500); }
  function sndClipIn(){ beep(500, 0.08, 'triangle', 0.05, 760); }
  function sndSnap(){ beep(300, 0.18, 'sine', 0.06, 220); }
  function sndClick(){ beep(900, 0.05, 'square', 0.04, 600); beep(450, 0.08, 'sine', 0.05, 350, 0.05); }
  function sndError(){ beep(160, 0.22, 'sawtooth', 0.05, 90); }
  function sndWin(){ [523, 659, 784, 1047].forEach(function(f, i){ beep(f, 0.18, 'triangle', 0.06, null, i * 0.11); }); }

  // ---------- Mensajes ----------
  var flashTimer = null;
  function setMessage(html){ els.messageBar.innerHTML = html; }
  // Mensaje temporal (errores, avisos). Luego vuelve al mensaje del paso actual.
  function flash(html, ms){
    setMessage(html);
    clearTimeout(flashTimer);
    flashTimer = setTimeout(function(){ flashTimer = null; updateHUD(); }, ms || 2600);
  }

  // ---------- Modelo modular y reglas de bloqueo ----------
  var SCREW_LABELS = {
    cover: 'la tapa trasera',
    mainboard: 'la placa base',
    speaker: 'el altavoz inferior',
    chargingBoard: 'la placa de carga',
    midFrame: 'el chasis intermedio'
  };
  var PART_LABELS = {
    simTray: 'Bandeja SIM', cover: 'Tapa trasera', nfcCoil: 'Bobina NFC / carga inalámbrica',
    battery: 'Batería', rearCameras: 'Módulo de cámaras traseras', mainboard: 'Placa base',
    speaker: 'Altavoz inferior', chargingBoard: 'Placa USB-C / micrófono', vibrator: 'Motor háptico',
    topSensors: 'Flex de sensores de proximidad', frontCamera: 'Cámara frontal', earpiece: 'Auricular superior',
    sideFlex: 'Flex de botones y antena',
    midFrame: 'Chasis intermedio', display: 'Pantalla OLED y digitalizador'
  };
  var CONNECTOR_LABELS = {
    battery: 'batería', camera: 'cámaras', topSensors: 'módulo superior',
    sideFlex: 'botones laterales', interconnect: 'interconexión USB-C', display: 'pantalla'
  };
  var PART_INFO = {
    simTray: 'Aloja la tarjeta SIM y se retira antes de abrir el teléfono.',
    cover: 'Cubierta opaca de policarbonato que protege y cierra el conjunto interno.',
    nfcCoil: 'Antena para comunicación NFC y recepción de carga inalámbrica.',
    battery: 'Batería de ion-litio que alimenta el teléfono.',
    rearCameras: 'Conjunto trasero de cámaras gran angular, ultra gran angular y teleobjetivo.',
    mainboard: 'Placa principal con procesador, memoria, gestión de energía y radiofrecuencia.',
    speaker: 'Altavoz inferior y cámara acústica para reproducir sonido.',
    chargingBoard: 'Placa secundaria que integra el puerto USB-C y el micrófono.',
    vibrator: 'Motor háptico que genera vibraciones y respuestas táctiles.',
    topSensors: 'Flex con sensores de proximidad y luz ambiental.',
    frontCamera: 'Cámara frontal para selfies y videollamadas.',
    earpiece: 'Auricular superior usado para escuchar llamadas.',
    sideFlex: 'Flex que reúne los botones laterales y conexiones de antena.',
    midFrame: 'Estructura intermedia que sostiene y alinea los módulos internos.',
    display: 'Conjunto OLED y digitalizador que muestra la imagen y detecta el tacto.'
  };
  var CONNECTOR_INFO = {
    battery: 'Conecta la batería a la placa principal; se desconecta antes de retirar la batería.',
    camera: 'Flex de las cámaras traseras; debe desconectarse antes de retirar el módulo.',
    topSensors: 'Conexión del conjunto superior de sensores; se libera antes de retirar sus módulos.',
    sideFlex: 'Conexión de los botones laterales y la antena.',
    interconnect: 'Flex que comunica la placa principal con la placa USB-C.',
    display: 'Flex de señal de la pantalla; se desconecta antes de desmontar el panel.'
  };
  var tooltipTarget = null;

  function positionInfoTooltip(x, y){
    var tip = els.infoTooltip;
    var bounds = tip.getBoundingClientRect();
    var left = x + 14;
    var top = y + 14;
    if (left + bounds.width > window.innerWidth - 12) left = x - bounds.width - 14;
    if (top + bounds.height > window.innerHeight - 12) top = y - bounds.height - 14;
    tip.style.left = Math.max(12, Math.min(left, window.innerWidth - bounds.width - 12)) + 'px';
    tip.style.top = Math.max(12, Math.min(top, window.innerHeight - bounds.height - 12)) + 'px';
  }
  function showInfoTooltip(el, title, description, x, y){
    if (tooltipTarget && tooltipTarget !== el) tooltipTarget.removeAttribute('aria-describedby');
    tooltipTarget = el;
    els.infoTooltipTitle.textContent = title;
    els.infoTooltipBody.textContent = description;
    els.infoTooltip.setAttribute('aria-hidden', 'false');
    els.infoTooltip.classList.add('visible');
    el.setAttribute('aria-describedby', 'infoTooltip');
    positionInfoTooltip(x, y);
  }
  function hideInfoTooltip(el){
    if (el && tooltipTarget !== el) return;
    if (tooltipTarget) tooltipTarget.removeAttribute('aria-describedby');
    tooltipTarget = null;
    els.infoTooltip.setAttribute('aria-hidden', 'true');
    els.infoTooltip.classList.remove('visible');
  }
  function bindInfoTooltip(el, title, description){
    if (!el || !description) return;
    el.addEventListener('pointerenter', function(e){
      if (e.pointerType === 'touch') return;
      showInfoTooltip(el, title, description, e.clientX, e.clientY);
    });
    el.addEventListener('pointermove', function(e){
      if (tooltipTarget === el) positionInfoTooltip(e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', function(){ hideInfoTooltip(el); });
    el.addEventListener('pointerdown', function(){ hideInfoTooltip(el); });
    el.addEventListener('focus', function(){
      var rect = el.getBoundingClientRect();
      showInfoTooltip(el, title, description, rect.left + rect.width / 2, rect.top + rect.height / 2);
    });
    el.addEventListener('blur', function(){ hideInfoTooltip(el); });
  }
  PART_IDS.forEach(function(id){ bindInfoTooltip(els[id], PART_LABELS[id], PART_INFO[id]); });
  Object.keys(connectorEls).forEach(function(key){
    bindInfoTooltip(connectorEls[key], 'Flex de ' + CONNECTOR_LABELS[key], CONNECTOR_INFO[key]);
  });
  var INNER_PART_IDS = PART_IDS.filter(function(id){ return id !== 'simTray' && id !== 'cover'; });
  var FRAME_COMPONENT_IDS = ['nfcCoil', 'battery', 'rearCameras', 'mainboard', 'speaker', 'chargingBoard', 'vibrator', 'topSensors', 'frontCamera', 'earpiece', 'sideFlex'];
  var INNER_SCREW_GROUPS = ['mainboard', 'speaker', 'chargingBoard', 'midFrame'];

  function groupScrewCount(group){
    return SCREW_GROUPS[group].filter(function(id){ return state.screws[id]; }).length;
  }
  function groupScrewEls(group, installed){
    return SCREW_GROUPS[group].filter(function(id){ return state.screws[id] === installed; }).map(function(id){ return screwEls[id]; });
  }
  function installedBlockers(ids){
    return ids.filter(function(id){ return state.installed[id]; }).map(function(id){ return parts[id].el; });
  }
  function missingBlockers(ids){
    return ids.filter(function(id){ return !state.installed[id]; }).map(function(id){ return parts[id].el; });
  }
  function firstInstalled(ids){
    for (var i = 0; i < ids.length; i++) if (state.installed[ids[i]]) return ids[i];
    return null;
  }
  function firstMissing(ids){
    for (var i = 0; i < ids.length; i++) if (!state.installed[ids[i]]) return ids[i];
    return null;
  }
  function connectorBlockers(keys, connected){
    return keys.filter(function(key){ return state.connections[key] === connected; }).map(function(key){ return connectorEls[key]; });
  }
  function screwBlockers(groups, installed){
    return groups.reduce(function(list, group){ return list.concat(groupScrewEls(group, installed)); }, []);
  }
  function blockForInstalled(ids){
    var id = firstInstalled(ids);
    return id ? 'Retira primero ' + PART_LABELS[id] + '.' : null;
  }
  function blockForMissing(ids){
    var id = firstMissing(ids);
    return id ? 'Instala primero ' + PART_LABELS[id] + '.' : null;
  }
  function blockForConnections(keys, connected){
    for (var i = 0; i < keys.length; i++) {
      if (state.connections[keys[i]] === connected) {
        return (connected ? 'Desconecta' : 'Conecta') + ' primero el flex de ' + CONNECTOR_LABELS[keys[i]] + '.';
      }
    }
    return null;
  }
  function blockForScrews(group, shouldBeInstalled){
    var count = groupScrewCount(group);
    var total = SCREW_GROUPS[group].length;
    if (shouldBeInstalled && count !== total) return 'Faltan ' + (total - count) + ' tornillo(s) de ' + SCREW_LABELS[group] + '.';
    if (!shouldBeInstalled && count) return 'Aún hay ' + count + ' tornillo(s) en ' + SCREW_LABELS[group] + '.';
    return null;
  }

  var parts = {
    simTray: {
      el: els.simTray, label: PART_LABELS.simTray, color: 'var(--cyan)', carryScale: 1.1,
      removeBlock: function(){ return null; }, removeBlockers: function(){ return []; },
      installBlock: function(){ return state.installed.cover ? null : 'Cierra la tapa antes de colocar la bandeja SIM.'; },
      installBlockers: function(){ return [els.cover]; }
    },
    cover: {
      el: els.cover, label: PART_LABELS.cover, color: 'var(--cyan)', carryScale: 0.5,
      removeBlock: function(){
        if (state.installed.simTray) return 'Retira primero la bandeja SIM.';
        return blockForScrews('cover', false);
      },
      removeBlockers: function(){ return [els.simTray].concat(groupScrewEls('cover', true)); },
      installBlock: function(){
        if (state.installed.simTray) return 'Coloca la tapa antes de insertar la bandeja SIM.';
        var missing = firstMissing(INNER_PART_IDS);
        if (missing) return 'Falta instalar ' + PART_LABELS[missing] + ' antes de cerrar el teléfono.';
        var openConnection = CONNECTOR_KEYS.filter(function(key){ return !state.connections[key]; })[0];
        if (openConnection) return 'Conecta el flex de ' + CONNECTOR_LABELS[openConnection] + ' antes de cerrar el teléfono.';
        var openScrewGroup = INNER_SCREW_GROUPS.filter(function(group){ return groupScrewCount(group) !== SCREW_GROUPS[group].length; })[0];
        if (openScrewGroup) return 'Termina de atornillar ' + SCREW_LABELS[openScrewGroup] + ' antes de cerrar.';
        return null;
      },
      installBlockers: function(){
        var out = missingBlockers(INNER_PART_IDS);
        CONNECTOR_KEYS.forEach(function(key){ if (!state.connections[key]) out.push(connectorEls[key]); });
        INNER_SCREW_GROUPS.forEach(function(group){ out = out.concat(groupScrewEls(group, false)); });
        if (state.installed.simTray) out.push(els.simTray);
        return out;
      }
    },
    nfcCoil: {
      el: els.nfcCoil, label: PART_LABELS.nfcCoil, color: 'var(--copper)', carryScale: 0.85,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.battery) return 'Instala primero la batería bajo la bobina.';
        return state.connections.battery ? 'Desconecta primero el flex de la batería.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.battery, connectorEls.battery]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.battery) return 'Instala primero la batería.';
        return !state.connections.battery ? 'Conecta primero el flex de la batería.' : null;
      },
      installBlockers: function(){ return [els.cover, els.battery, connectorEls.battery]; }
    },
    battery: {
      el: els.battery, label: PART_LABELS.battery, color: 'var(--amber)', carryScale: 0.85,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.mainboard) return 'La placa base debe estar montada para liberar la batería.';
        if (state.installed.nfcCoil) return 'Retira primero la bobina NFC que cubre la batería.';
        return state.connections.battery ? 'Desconecta primero el flex de la batería.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, els.nfcCoil, connectorEls.battery]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.mainboard) return 'Instala primero la placa base.';
        return state.installed.nfcCoil ? 'Coloca la batería antes de la bobina NFC.' : null;
      },
      installBlockers: function(){ return [els.cover, els.mainboard, els.nfcCoil]; }
    },
    rearCameras: {
      el: els.rearCameras, label: PART_LABELS.rearCameras, color: '#7b8ef5', carryScale: 1,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.mainboard) return 'La placa base debe estar instalada para retirar las cámaras.';
        if (state.installed.battery) return 'Retira primero la batería por seguridad.';
        return state.connections.camera ? 'Desconecta primero el flex de las cámaras.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, els.battery, connectorEls.camera]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.mainboard) return 'Instala primero la placa base.';
        if (state.installed.battery) return 'Coloca las cámaras antes de la batería.';
        return state.connections.camera ? 'El flex de las cámaras debe estar desconectado al encajarlas.' : null;
      },
      installBlockers: function(){ return [els.cover, els.mainboard, els.battery, connectorEls.camera]; }
    },
    mainboard: {
      el: els.mainboard, label: PART_LABELS.mainboard, color: '#4a926c', carryScale: 0.8,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.battery) return 'Retira primero la batería.';
        if (state.installed.rearCameras) return 'Retira primero el módulo de cámaras.';
        var connectionBlock = blockForConnections(['camera', 'topSensors', 'sideFlex', 'interconnect'], true);
        return connectionBlock || blockForScrews('mainboard', false);
      },
      removeBlockers: function(){
        return [els.cover, els.battery, els.rearCameras]
          .concat(connectorBlockers(['camera', 'topSensors', 'sideFlex', 'interconnect'], true), groupScrewEls('mainboard', true));
      },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.battery) return 'Instala la placa base antes que la batería.';
        if (state.installed.rearCameras) return 'Instala la placa base antes que las cámaras.';
        return blockForMissing(['midFrame', 'topSensors', 'frontCamera', 'earpiece', 'sideFlex', 'chargingBoard', 'speaker', 'vibrator']);
      },
      installBlockers: function(){
        return [els.cover, els.battery, els.rearCameras].concat(missingBlockers(['midFrame', 'topSensors', 'frontCamera', 'earpiece', 'sideFlex', 'chargingBoard', 'speaker', 'vibrator']));
      }
    },
    speaker: {
      el: els.speaker, label: PART_LABELS.speaker, color: '#313a43', carryScale: 0.95,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return blockForScrews('speaker', false);
      },
      removeBlockers: function(){ return [els.cover, els.mainboard].concat(groupScrewEls('speaker', true)); },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.chargingBoard) return 'Instala primero la placa USB-C.';
        if (state.installed.mainboard) return 'Coloca el altavoz antes de montar la placa base.';
        return null;
      },
      installBlockers: function(){ return [els.cover, els.chargingBoard, els.mainboard]; }
    },
    chargingBoard: {
      el: els.chargingBoard, label: PART_LABELS.chargingBoard, color: '#38a88f', carryScale: 0.9,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        if (state.installed.speaker) return 'Retira primero el altavoz inferior.';
        if (state.installed.vibrator) return 'Retira primero el motor háptico.';
        if (state.connections.interconnect) return 'Desconecta primero el flex de interconexión.';
        return blockForScrews('chargingBoard', false);
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, els.speaker, els.vibrator, connectorEls.interconnect].concat(groupScrewEls('chargingBoard', true)); },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Coloca la placa USB-C antes de la placa base.';
        if (state.installed.speaker) return 'Coloca la placa USB-C antes del altavoz.';
        if (state.installed.vibrator) return 'Coloca la placa USB-C antes del motor háptico.';
        return state.connections.interconnect ? 'Mantén el flex de interconexión desconectado hasta montar la placa base.' : null;
      },
      installBlockers: function(){ return [els.cover, els.mainboard, els.speaker, els.vibrator, connectorEls.interconnect]; }
    },
    vibrator: {
      el: els.vibrator, label: PART_LABELS.vibrator, color: '#c5a34c', carryScale: 1,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return state.installed.speaker ? 'Retira primero el altavoz inferior.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, els.speaker]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Instala el motor antes de la placa base.';
        if (!state.installed.chargingBoard) return 'Instala primero la placa USB-C.';
        return state.installed.speaker ? 'Coloca el motor antes del altavoz.' : null;
      },
      installBlockers: function(){ return [els.cover, els.mainboard, els.chargingBoard, els.speaker]; }
    },
    topSensors: {
      el: els.topSensors, label: PART_LABELS.topSensors, color: '#cc8d56', carryScale: 0.95,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return state.connections.topSensors ? 'Desconecta primero el flex de sensores.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, connectorEls.topSensors]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.midFrame) return 'Instala primero el chasis intermedio.';
        if (state.installed.mainboard) return 'Instala los sensores antes de la placa base.';
        return state.connections.topSensors ? 'Mantén desconectado el flex de sensores hasta montar la placa base.' : null;
      },
      installBlockers: function(){ return [els.cover, els.midFrame, els.mainboard, connectorEls.topSensors]; }
    },
    frontCamera: {
      el: els.frontCamera, label: PART_LABELS.frontCamera, color: '#6e9cbd', carryScale: 0.92,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return state.connections.topSensors ? 'Desconecta primero el flex de sensores.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, connectorEls.topSensors]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.midFrame) return 'Instala primero el chasis intermedio.';
        if (state.installed.mainboard) return 'Instala la cámara frontal antes de la placa base.';
        return state.connections.topSensors ? 'Mantén desconectado el flex frontal hasta montar la placa base.' : null;
      },
      installBlockers: function(){ return [els.cover, els.midFrame, els.mainboard, connectorEls.topSensors]; }
    },
    earpiece: {
      el: els.earpiece, label: PART_LABELS.earpiece, color: '#424d55', carryScale: 0.92,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return state.connections.topSensors ? 'Desconecta primero el flex de sensores.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, connectorEls.topSensors]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.midFrame) return 'Instala primero el chasis intermedio.';
        if (state.installed.mainboard) return 'Instala el auricular antes de la placa base.';
        return state.connections.topSensors ? 'Mantén desconectado el flex de sensores hasta montar la placa base.' : null;
      },
      installBlockers: function(){ return [els.cover, els.midFrame, els.mainboard, connectorEls.topSensors]; }
    },
    sideFlex: {
      el: els.sideFlex, label: PART_LABELS.sideFlex, color: '#d78a48', carryScale: 0.95,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.mainboard) return 'Retira primero la placa base.';
        return state.connections.sideFlex ? 'Desconecta primero el flex de botones.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.mainboard, connectorEls.sideFlex]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.midFrame) return 'Instala primero el chasis intermedio.';
        if (state.installed.mainboard) return 'Coloca el flex lateral antes de la placa base.';
        return state.connections.sideFlex ? 'Mantén desconectado el flex lateral hasta montar la placa base.' : null;
      },
      installBlockers: function(){ return [els.cover, els.midFrame, els.mainboard, connectorEls.sideFlex]; }
    },
    midFrame: {
      el: els.midFrame, label: PART_LABELS.midFrame, color: '#a3aeb2', carryScale: 0.52,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        var installed = firstInstalled(FRAME_COMPONENT_IDS);
        if (installed) return 'Retira primero ' + PART_LABELS[installed] + '.';
        return blockForScrews('midFrame', false);
      },
      removeBlockers: function(){ return [els.cover].concat(installedBlockers(FRAME_COMPONENT_IDS), groupScrewEls('midFrame', true)); },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (!state.installed.display) return 'Instala primero la pantalla.';
        if (!state.connections.display) return 'Conecta primero el flex de pantalla.';
        var installed = firstInstalled(FRAME_COMPONENT_IDS);
        return installed ? 'El chasis se coloca antes que ' + PART_LABELS[installed] + '.' : null;
      },
      installBlockers: function(){ return [els.cover, els.display, connectorEls.display].concat(installedBlockers(FRAME_COMPONENT_IDS)); }
    },
    display: {
      el: els.display, label: PART_LABELS.display, color: '#64758a', carryScale: 0.48,
      removeBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        if (state.installed.midFrame) return 'Retira primero el chasis intermedio.';
        return state.connections.display ? 'Desconecta primero el flex de pantalla.' : null;
      },
      removeBlockers: function(){ return [els.cover, els.midFrame, connectorEls.display]; },
      installBlock: function(){
        if (state.installed.cover) return 'Quita primero la tapa trasera.';
        return state.installed.midFrame ? 'La pantalla se instala antes del chasis intermedio.' : null;
      },
      installBlockers: function(){ return [els.cover, els.midFrame]; }
    }
  };

  // ---------- Guía completa de desmontaje y montaje ----------
  function partStep(id, installing, message){
    return {
      done: function(){ return state.installed[id] === installing; },
      msg: function(){ return message; },
      targets: function(){ return installing ? [parts[id].el, trayEl(id)] : [parts[id].el]; }
    };
  }
  function screwStep(group, installing){
    return {
      done: function(){
        return installing ? groupScrewCount(group) === SCREW_GROUPS[group].length : groupScrewCount(group) === 0;
      },
      msg: function(){
        var count = groupScrewCount(group);
        var remaining = installing ? SCREW_GROUPS[group].length - count : count;
        return installing
          ? 'Con el <strong>destornillador</strong>, mantén presionado cada tornillo de ' + SCREW_LABELS[group] + '. Faltan ' + remaining + '.'
          : 'Quita con el <strong>destornillador</strong> los tornillos de ' + SCREW_LABELS[group] + '. Quedan ' + remaining + '.';
      },
      targets: function(){ return groupScrewEls(group, !installing); }
    };
  }
  function connectorStep(key, connected){
    return {
      done: function(){ return state.connections[key] === connected; },
      msg: function(){
        return 'Usa la <strong>espátula</strong> para ' + (connected ? 'conectar' : 'desconectar') + ' el flex de ' + CONNECTOR_LABELS[key] + '.';
      },
      targets: function(){ return [connectorEls[key]]; }
    };
  }
  var STEPS = {
    desarmar: [
      partStep('simTray', false, 'Saca la <strong>bandeja SIM</strong> con Mano Libre.'),
      screwStep('cover', false),
      partStep('cover', false, 'Quita la <strong>tapa trasera</strong> y suéltala en la zona libre de la mesa.'),
      connectorStep('battery', false),
      partStep('nfcCoil', false, 'Retira la <strong>bobina NFC y de carga inalámbrica</strong> que cubre la batería.'),
      partStep('battery', false, 'Despega y retira la <strong>batería</strong>.'),
      connectorStep('camera', false),
      partStep('rearCameras', false, 'Retira el <strong>módulo de cámaras traseras</strong>.'),
      connectorStep('topSensors', false),
      connectorStep('sideFlex', false),
      connectorStep('interconnect', false),
      screwStep('mainboard', false),
      partStep('mainboard', false, 'Levanta la <strong>placa base</strong> con cuidado.'),
      screwStep('speaker', false),
      partStep('speaker', false, 'Retira el <strong>altavoz inferior</strong> y su cámara acústica.'),
      partStep('vibrator', false, 'Retira el <strong>motor háptico</strong> de vibración.'),
      screwStep('chargingBoard', false),
      partStep('chargingBoard', false, 'Retira la <strong>placa USB-C y micrófono</strong>.'),
      partStep('frontCamera', false, 'Retira la <strong>cámara frontal</strong>.'),
      partStep('earpiece', false, 'Retira el <strong>auricular superior</strong>.'),
      partStep('topSensors', false, 'Retira el <strong>flex de sensores de proximidad y luz</strong>.'),
      partStep('sideFlex', false, 'Retira el <strong>flex de botones laterales y antena</strong>.'),
      screwStep('midFrame', false),
      partStep('midFrame', false, 'Separa el <strong>chasis intermedio</strong> del conjunto.'),
      connectorStep('display', false),
      partStep('display', false, 'Despega la <strong>pantalla OLED y el digitalizador</strong> para terminar.')
    ],
    armar: [
      partStep('display', true, 'Coloca la <strong>pantalla OLED</strong> en su silueta.'),
      connectorStep('display', true),
      partStep('midFrame', true, 'Instala el <strong>chasis intermedio</strong>.'),
      screwStep('midFrame', true),
      partStep('sideFlex', true, 'Instala el <strong>flex de botones y antena</strong>.'),
      partStep('topSensors', true, 'Instala el <strong>flex de sensores de proximidad</strong>.'),
      partStep('earpiece', true, 'Instala el <strong>auricular superior</strong>.'),
      partStep('frontCamera', true, 'Instala la <strong>cámara frontal</strong>.'),
      partStep('chargingBoard', true, 'Coloca la <strong>placa USB-C y micrófono</strong>.'),
      screwStep('chargingBoard', true),
      partStep('vibrator', true, 'Coloca el <strong>motor háptico</strong>.'),
      partStep('speaker', true, 'Encaja el <strong>altavoz inferior</strong>.'),
      screwStep('speaker', true),
      partStep('mainboard', true, 'Coloca la <strong>placa base</strong> sobre el chasis.'),
      screwStep('mainboard', true),
      connectorStep('interconnect', true),
      connectorStep('sideFlex', true),
      connectorStep('topSensors', true),
      partStep('rearCameras', true, 'Instala el <strong>módulo de cámaras traseras</strong>.'),
      connectorStep('camera', true),
      partStep('battery', true, 'Coloca la <strong>batería</strong> en su alojamiento.'),
      connectorStep('battery', true),
      partStep('nfcCoil', true, 'Coloca la <strong>bobina NFC y de carga inalámbrica</strong>.'),
      partStep('cover', true, 'Cierra el teléfono con la <strong>tapa trasera</strong>.'),
      screwStep('cover', true),
      partStep('simTray', true, 'Inserta la <strong>bandeja SIM</strong> para terminar.')
    ]
  };

  function currentSteps(){ return STEPS[state.goal]; }
  function currentStepIndex(){
    var steps = currentSteps();
    for (var i = 0; i < steps.length; i++) if (!steps[i].done()) return i;
    return steps.length;
  }
  function doneCount(){
    return currentSteps().filter(function(s){ return s.done(); }).length;
  }

  function updateHUD(){
    var steps = currentSteps();
    var idx = currentStepIndex();
    els.goalPill.textContent = state.goal === 'desarmar' ? 'Desarmar' : 'Armar';
    els.stepPill.textContent = doneCount() + '/' + steps.length;

    if (!flashTimer) {
      if (idx >= steps.length) {
        setMessage(state.goal === 'desarmar' ? '¡Desarmado completo!' : '¡Dispositivo armado!');
      } else if (state.mode === 'guia') {
        setMessage(steps[idx].msg());
      } else {
        setMessage('<strong>Modo Libre:</strong> tú decides el orden. ¿Atascado? Activa <strong>Pistas</strong>.');
      }
    }
    updateHintTargets();
  }

  function clearHintTargets(){
    var list = document.querySelectorAll('.xray-target');
    for (var i = 0; i < list.length; i++) list[i].classList.remove('xray-target');
  }
  function updateHintTargets(){
    clearHintTargets();
    if (!state.hint) return;
    var steps = currentSteps();
    var idx = currentStepIndex();
    if (idx >= steps.length) return;
    steps[idx].targets().forEach(function(el){ if (el) el.classList.add('xray-target'); });
  }

  // ---------- Cronómetro y estadísticas ----------
  function startClock(){
    if (state.started || state.finished) return;
    state.started = true;
    state.lastTick = Date.now();
  }
  function tick(){
    if (state.started && !state.paused && !state.finished) {
      var now = Date.now();
      state.elapsed += now - state.lastTick;
      state.lastTick = now;
    }
    els.timerPill.textContent = fmtTime(state.elapsed);
  }
  setInterval(tick, 250);

  function registerError(){ state.errors++; }

  // ---------- Bandeja (mesa de trabajo) ----------
  var trayItems = {};
  function trayEl(id){ return trayItems[id] || null; }

  function refreshTrayEmpty(){
    var has = els.trayList.querySelector('.tray-item');
    els.trayEmpty.style.display = has ? 'none' : '';
  }

  function addTrayScrew(){
    var existing = $('tray-screws');
    if (existing) {
      existing.querySelector('.count').textContent = '×' + state.trayScrewCount;
    } else {
      var item = document.createElement('div');
      item.className = 'tray-item';
      item.id = 'tray-screws';
      item.innerHTML = '<span class="swatch" style="background:var(--copper)"></span><span>Tornillos</span><span class="count mono">×' + state.trayScrewCount + '</span>';
      bindInfoTooltip(item, 'Tornillos', 'Fijaciones retiradas del teléfono. Reinstálalas en sus orificios con el destornillador.');
      els.trayList.appendChild(item);
    }
    refreshTrayEmpty();
  }
  function removeTrayScrew(){
    var existing = $('tray-screws');
    if (!existing) return;
    if (state.trayScrewCount <= 0) existing.parentNode.removeChild(existing);
    else existing.querySelector('.count').textContent = '×' + state.trayScrewCount;
    refreshTrayEmpty();
  }

  function addTrayPart(id){
    if (trayItems[id]) return;
    var part = parts[id];
    var item = document.createElement('div');
    item.className = 'tray-item piece';
    item.tabIndex = 0;
    item.setAttribute('role', 'button');
    item.setAttribute('aria-label', part.label + ': arrastra para volver a instalar');
    item.innerHTML = '<span class="swatch" style="background:' + part.color + '"></span><span>' + part.label + '</span><span class="grip" aria-hidden="true">⠿</span>';
    bindInfoTooltip(item, part.label, PART_INFO[id]);
    item.addEventListener('pointerdown', function(e){
      if (state.paused || e.button > 0) return;
      e.preventDefault();
      selectTool('mano');
      startCarry(id, e, true);
    });
    els.trayList.appendChild(item);
    trayItems[id] = item;
    refreshTrayEmpty();
  }
  function removeTrayPart(id){
    var item = trayItems[id];
    if (!item) return;
    if (item.parentNode) item.parentNode.removeChild(item);
    delete trayItems[id];
    refreshTrayEmpty();
  }

  // ---------- Feedback visual ----------
  function flashBlocked(el){
    registerError();
    el.classList.remove('blocked-shake');
    void el.offsetWidth;
    el.classList.add('blocked-shake');
    sndError();
    setTimeout(function(){ el.classList.remove('blocked-shake'); }, 420);
  }
  function flashBlockers(list){
    list.forEach(function(el){
      if (!el) return;
      el.classList.add('blocker-flash');
      setTimeout(function(){ el.classList.remove('blocker-flash'); }, 900);
    });
  }

  // ---------- Herramientas ----------
  function selectTool(tool){
    state.tool = tool;
    els.app.setAttribute('data-tool', tool);
    var btns = document.querySelectorAll('.tool-btn');
    for (var i = 0; i < btns.length; i++) {
      var on = btns[i].getAttribute('data-tool') === tool;
      btns[i].classList.toggle('selected', on);
      btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
    }
  }
  var toolBtns = document.querySelectorAll('.tool-btn');
  for (var tb = 0; tb < toolBtns.length; tb++) {
    (function(btn){
      btn.addEventListener('click', function(){ selectTool(btn.getAttribute('data-tool')); });
    })(toolBtns[tb]);
  }

  // ---------- Tornillos (mantener presionado) ----------
  function attachScrew(id, el){
    var holdTimer = null;
    var holding = false;

    el.addEventListener('pointerdown', function(e){
      if (state.paused) return;
      e.stopPropagation();
      if (state.tool !== 'destornillador') {
        flashBlocked(el);
        flash('Cambia a <strong>destornillador</strong> para ' + (state.screws[id] ? 'quitar este tornillo.' : 'atornillar este agujero.'));
        return;
      }
      startClock();
      var installing = !state.screws[id];
      if (installing && state.trayScrewCount <= 0) return;
      holding = true;
      el.style.setProperty('--hold', HOLD_MS + 'ms');
      el.classList.toggle('reverse', installing);
      el.classList.add('spinning');
      try { el.setPointerCapture(e.pointerId); } catch(err){}
      holdTimer = setTimeout(function(){ holdTimer = null; holding = false; finishScrew(id, el, installing); }, HOLD_MS);
    });
    function cancel(){
      if (holdTimer) { clearTimeout(holdTimer); holdTimer = null; }
      if (holding) { holding = false; el.classList.remove('spinning', 'reverse'); }
    }
    el.addEventListener('pointerup', cancel);
    el.addEventListener('pointerleave', cancel);
    el.addEventListener('pointercancel', cancel);
  }
  function finishScrew(id, el, installing){
    el.classList.remove('spinning', 'reverse');
    if (installing) {
      if (state.screws[id] || state.trayScrewCount <= 0) return;
      state.screws[id] = true;
      state.trayScrewCount--;
      el.classList.remove('gone');
      removeTrayScrew();
      sndScrewIn();
    } else {
      if (!state.screws[id]) return;
      state.screws[id] = false;
      state.trayScrewCount++;
      el.classList.add('gone');
      addTrayScrew();
      sndScrewOut();
    }
    afterChange();
  }
  SCREW_IDS.forEach(function(id){ attachScrew(id, screwEls[id]); });

  // ---------- Espátula: conectores flex y coaxiales ----------
  function connectorAccessBlock(key){
    if (state.installed.cover) return 'Quita primero la tapa trasera para acceder a los conectores.';
    if (key === 'battery' && (!state.installed.battery || !state.installed.mainboard)) return 'La batería y la placa base deben estar colocadas.';
    if (key === 'camera' && (!state.installed.rearCameras || !state.installed.mainboard)) return 'Coloca las cámaras y la placa base para conectar este flex.';
    if (key === 'topSensors' && (!state.installed.topSensors || !state.installed.mainboard)) return 'Coloca el módulo superior y la placa base para conectar este flex.';
    if (key === 'sideFlex' && (!state.installed.sideFlex || !state.installed.mainboard)) return 'Coloca el flex lateral y la placa base para conectar.';
    if (key === 'interconnect' && (!state.installed.chargingBoard || !state.installed.mainboard)) return 'Coloca ambas placas para conectar el flex de interconexión.';
    if (key === 'display' && (state.installed.midFrame || !state.installed.display)) return 'Retira el chasis y coloca la pantalla para acceder a su flex.';
    return null;
  }
  function toggleConnector(key, el){
    if (state.paused) return;
    if (state.tool !== 'espatula') {
      flashBlocked(el);
      flash('Cambia a <strong>espátula</strong> para conectar o desconectar el flex de ' + CONNECTOR_LABELS[key] + '.');
      return;
    }
    var block = connectorAccessBlock(key);
    if (block) {
      flashBlocked(el);
      flash(block);
      return;
    }
    startClock();
    state.connections[key] = !state.connections[key];
    el.classList.toggle('disconnected', !state.connections[key]);
    el.setAttribute('aria-pressed', state.connections[key] ? 'true' : 'false');
    el.setAttribute('aria-label', 'Flex de ' + CONNECTOR_LABELS[key] + ', ' + (state.connections[key] ? 'conectado' : 'desconectado'));
    if (state.connections[key]) sndClipIn(); else sndClip();
    afterChange();
  }
  CONNECTOR_KEYS.forEach(function(key){
    var el = connectorEls[key];
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      e.stopPropagation();
      toggleConnector(key, el);
    });
    el.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggleConnector(key, el);
    });
  });

  // ---------- Arrastrar piezas (Mano Libre) ----------
  var carrying = null;

  function makeGhost(el, rect){
    var g = el.cloneNode(true);
    g.removeAttribute('id');
    var kids = g.querySelectorAll('[id]');
    for (var i = 0; i < kids.length; i++) kids[i].removeAttribute('id');
    g.classList.remove('part-removed', 'slot-ok', 'slot-bad', 'xray-target', 'blocked-shake');
    var kidsX = g.querySelectorAll('.xray-target');
    for (var j = 0; j < kidsX.length; j++) kidsX[j].classList.remove('xray-target');
    g.classList.add('drag-ghost');
    g.style.left = rect.left + 'px';
    g.style.top = rect.top + 'px';
    g.style.width = rect.width + 'px';
    g.style.height = rect.height + 'px';
    g.style.right = 'auto';
    g.style.bottom = 'auto';
    g.style.transform = 'none';
    g.style.opacity = '1';
    document.body.appendChild(g);
    return g;
  }

  function startCarry(id, e, fromTray){
    if (carrying) return;
    var part = parts[id];
    var el = part.el;
    // Posición ancla: la caja del elemento en el dispositivo (antes de cambiar su aspecto).
    var rect = el.getBoundingClientRect();
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;
    var grabX = fromTray ? 0 : e.clientX - cx;
    var grabY = fromTray ? 0 : e.clientY - cy;
    var ghost = makeGhost(el, rect);
    var scale = part.carryScale;

    startClock();
    if (!fromTray) el.classList.add('part-removed');
    ghost.style.transition = 'scale 0.15s ease';
    ghost.style.scale = String(scale);
    el.style.cursor = '';

    carrying = { id: id, ghost: ghost, pointerId: e.pointerId };
    if (!fromTray) els.workbench.classList.add('drop-active');

    var tolerance = Math.max(50, Math.min(rect.width, rect.height) * 0.5);
    var lastX = e.clientX, lastY = e.clientY;

    function place(x, y){
      lastX = x; lastY = y;
      var tx = x - grabX - cx;
      var ty = y - grabY - cy;
      ghost.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
    }
    function ghostCenter(){
      return { x: lastX - grabX, y: lastY - grabY };
    }
    function pointInRect(rect, inset){
      inset = inset || 0;
      return lastX >= rect.left - inset && lastX <= rect.right + inset &&
        lastY >= rect.top - inset && lastY <= rect.bottom + inset;
    }
    function overTray(){
      return pointInRect(els.trayPanel.getBoundingClientRect(), 0);
    }
    function overWorkbenchSpace(){
      if (!pointInRect(els.workbench.getBoundingClientRect(), 0)) return false;
      // El área del dispositivo no es mesa: ahí se conserva la pieza o se intenta encajar.
      if (pointInRect(els.phoneStage.getBoundingClientRect(), 10)) return false;
      // Evita que el mensaje de instrucciones se convierta accidentalmente en zona de depósito.
      if (pointInRect(els.messageBar.getBoundingClientRect(), 6)) return false;
      return true;
    }
    function nearSlot(){
      var c = ghostCenter();
      return Math.hypot(c.x - cx, c.y - cy) < tolerance;
    }
    function setSlot(cls){
      el.classList.toggle('slot-ok', cls === 'ok');
      el.classList.toggle('slot-bad', cls === 'bad');
    }

    function onMove(ev){
      if (ev.pointerId !== carrying.pointerId) return;
      place(ev.clientX, ev.clientY);
      if (fromTray) {
        if (nearSlot()) setSlot(part.installBlock() ? 'bad' : 'ok');
        else setSlot(null);
      } else {
        els.trayPanel.classList.toggle('drop-ok', overTray());
        els.workbench.classList.toggle('drop-ok', overWorkbenchSpace());
      }
    }

    function cleanup(){
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      els.trayPanel.classList.remove('drop-ok');
      els.workbench.classList.remove('drop-active', 'drop-ok');
      setSlot(null);
      carrying = null;
    }
    function dropGhost(ms){
      setTimeout(function(){ if (ghost.parentNode) ghost.parentNode.removeChild(ghost); }, ms);
    }

    function onUp(ev){
      if (ev.pointerId !== carrying.pointerId) return;
      var droppedOnTray = !fromTray && overTray();
      var droppedOnWorkbench = !fromTray && overWorkbenchSpace();
      var near = fromTray && nearSlot();
      var block = fromTray && near ? part.installBlock() : null;
      cleanup();

      if (fromTray && near && !block) {
        // Encaja en su ancla
        ghost.style.transition = 'transform 0.18s ease, scale 0.18s ease';
        ghost.style.transform = 'none';
        ghost.style.scale = '1';
        setTimeout(function(){
          el.classList.remove('part-removed');
          state.installed[id] = true;
          removeTrayPart(id);
          sndSnap();
          afterChange();
        }, 170);
        dropGhost(190);
        return;
      }

      if (!fromTray && (droppedOnTray || droppedOnWorkbench)) {
        if (droppedOnTray) {
          var tr = els.trayPanel.getBoundingClientRect();
          var tx = tr.left + tr.width / 2 - cx;
          var ty = tr.top + tr.height / 2 - cy;
          ghost.style.transition = 'transform 0.35s cubic-bezier(.4,0,.2,1), scale 0.35s ease, opacity 0.35s ease';
          ghost.style.transform = 'translate(' + tx + 'px,' + ty + 'px)';
          ghost.style.scale = '0.25';
          ghost.style.opacity = '0';
        } else {
          // Ya está junto al equipo: confirma la suelta ahí y guarda la pieza automáticamente.
          ghost.style.transition = 'transform 0.18s ease, scale 0.22s ease, opacity 0.22s ease';
          ghost.style.scale = '0.55';
          ghost.style.opacity = '0';
        }
        sndSnap();
        setTimeout(function(){
          state.installed[id] = false;
          addTrayPart(id);
          afterChange();
        }, droppedOnTray ? 330 : 180);
        dropGhost(droppedOnTray ? 380 : 240);
        return;
      }

      // No encajó: la pieza regresa a donde estaba
      if (fromTray) {
        if (near && block) {
          registerError();
          sndError();
          flash(block);
          flashBlockers(part.installBlockers());
        }
        var trItem = trayItems[id];
        var back = trItem ? trItem.getBoundingClientRect() : null;
        ghost.style.transition = 'transform 0.3s ease, scale 0.3s ease, opacity 0.3s ease';
        if (back) ghost.style.transform = 'translate(' + (back.left + back.width / 2 - cx) + 'px,' + (back.top + back.height / 2 - cy) + 'px)';
        ghost.style.scale = '0.25';
        ghost.style.opacity = '0';
        dropGhost(320);
      } else {
        ghost.style.transition = 'transform 0.3s cubic-bezier(.4,0,.2,1), scale 0.3s ease';
        ghost.style.transform = 'none';
        ghost.style.scale = '1';
        setTimeout(function(){ el.classList.remove('part-removed'); }, 290);
        dropGhost(300);
      }
    }
    function onCancel(ev){
      if (ev.pointerId !== carrying.pointerId) return;
      cleanup();
      if (!fromTray) el.classList.remove('part-removed');
      if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    }

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    place(e.clientX, e.clientY);
    if (fromTray) {
      flash('Suelta la pieza sobre su silueta en el dispositivo.', 2000);
    }
  }

  function makeDraggable(id){
    var part = parts[id];
    var el = part.el;
    el.addEventListener('pointerdown', function(e){
      if (state.paused || e.button > 0) return;
      if (!state.installed[id]) return;
      // los hijos interactivos (tornillos, clips, conector) se manejan solos
      if (e.target.closest && e.target.closest('.screw, .connector')) return;
      if (state.tool !== 'mano') {
        flashBlocked(el);
        flash('Cambia a <strong>Mano Libre</strong> para arrastrar esta pieza.');
        return;
      }
      var block = part.removeBlock();
      if (block) {
        flashBlocked(el);
        flash(block);
        flashBlockers(part.removeBlockers());
        return;
      }
      e.preventDefault();
      startCarry(id, e, false);
    });
  }
  Object.keys(parts).forEach(makeDraggable);

  // ---------- Después de cada cambio ----------
  function afterChange(){
    updateHUD();
    checkGoal();
  }

  function checkGoal(){
    if (state.finished) return;
    if (currentStepIndex() < currentSteps().length) return;
    state.finished = true;
    tick();
    var key = 'kingdog.best.' + state.goal + '.' + state.mode;
    var best = parseInt(store.get(key, '0'), 10) || 0;
    var isRecord = !best || state.elapsed < best;
    if (isRecord) store.set(key, String(state.elapsed));

    if (state.goal === 'desarmar') {
      els.successTitle.textContent = 'Teléfono completamente desmontado';
      els.successText.textContent = 'Retiraste 15 módulos: pantalla, chasis, placas, cámaras frontal y traseras, auricular, batería, bobina NFC, altavoz y flexes. Ahora puedes volver a montarlo.';
      els.playAgainBtn.textContent = 'Volver a armar';
      els.restartBtn.hidden = false;
      els.restartBtn.textContent = 'Empezar de nuevo';
    } else {
      els.successTitle.textContent = '¡Dispositivo armado!';
      els.successText.textContent = 'Todos los módulos, conectores y tornillos volvieron a su lugar. ¡Buen trabajo!';
      els.playAgainBtn.textContent = 'Jugar de nuevo';
      els.restartBtn.hidden = true;
    }
    els.successStats.innerHTML =
      'Tiempo ' + fmtTime(state.elapsed) + ' · Errores ' + state.errors +
      '<br>' + (isRecord ? '<span class="record">¡Nuevo récord!</span>' : 'Mejor: ' + fmtTime(best));
    setTimeout(function(){
      els.successOverlay.classList.add('show');
      sndWin();
    }, 300);
  }

  function resetMetrics(){
    state.started = false;
    state.finished = false;
    state.elapsed = 0;
    state.lastTick = 0;
    state.errors = 0;
    els.timerPill.textContent = '00:00';
  }

  // ---------- Reiniciar ----------
  function resetPieceVisuals(){
    SCREW_IDS.forEach(function(id){
      screwEls[id].classList.remove('gone', 'spinning', 'reverse', 'xray-target', 'blocker-flash');
    });
    CONNECTOR_KEYS.forEach(function(key){
      connectorEls[key].classList.remove('disconnected', 'xray-target', 'blocker-flash');
      connectorEls[key].setAttribute('aria-pressed', 'true');
      connectorEls[key].setAttribute('aria-label', 'Flex de ' + CONNECTOR_LABELS[key] + ', conectado');
    });
    PART_IDS.forEach(function(id){
      parts[id].el.classList.remove('part-removed', 'slot-ok', 'slot-bad', 'xray-target', 'blocker-flash');
    });
    els.workbench.classList.remove('drop-active', 'drop-ok');
    els.trayPanel.classList.remove('drop-ok');
  }

  function clearTray(){
    trayItems = {};
    els.trayList.innerHTML = '';
    els.trayList.appendChild(els.trayEmpty);
    els.trayEmpty.style.display = '';
  }

  function resetGame(){
    if (carrying) {
      if (carrying.ghost.parentNode) carrying.ghost.parentNode.removeChild(carrying.ghost);
      carrying = null;
    }
    state.goal = 'desarmar';
    state.screws = {};
    SCREW_IDS.forEach(function(id){ state.screws[id] = true; });
    state.connections = { battery: true, camera: true, topSensors: true, sideFlex: true, interconnect: true, display: true };
    state.installed = {};
    PART_IDS.forEach(function(id){ state.installed[id] = true; });
    state.trayScrewCount = 0;
    state.paused = false;
    clearTimeout(flashTimer);
    flashTimer = null;
    resetMetrics();
    resetPieceVisuals();
    clearTray();
    els.app.classList.remove('paused');
    els.pauseOverlay.classList.remove('show');
    els.successOverlay.classList.remove('show');
    updateHUD();
  }

  // Tras desarmar, pasar al objetivo de armar sin perder el estado del dispositivo
  function startAssembly(){
    state.goal = 'armar';
    resetMetrics();
    els.successOverlay.classList.remove('show');
    updateHUD();
  }

  els.resetBtn.addEventListener('click', resetGame);
  els.restartBtn.addEventListener('click', resetGame);
  els.playAgainBtn.addEventListener('click', function(){
    if (state.goal === 'desarmar') startAssembly(); else resetGame();
  });

  // ---------- Controles de la barra superior ----------
  function applyMode(){
    var guia = state.mode === 'guia';
    els.modeBtnText.textContent = guia ? 'Modo Guía' : 'Modo Libre';
    els.modeBtn.setAttribute('aria-pressed', guia ? 'true' : 'false');
    els.modeLabel.textContent = guia
      ? 'Smartphone modular · guía paso a paso de 15 módulos'
      : 'Smartphone modular · desmonta sus componentes libremente';
  }
  els.modeBtn.addEventListener('click', function(){
    state.mode = state.mode === 'guia' ? 'libre' : 'guia';
    store.set('kingdog.mode', state.mode);
    applyMode();
    clearTimeout(flashTimer);
    flashTimer = null;
    updateHUD();
  });

  function toggleHint(){
    state.hint = !state.hint;
    els.xrayBtn.classList.toggle('active', state.hint);
    els.xrayBtn.setAttribute('aria-pressed', state.hint ? 'true' : 'false');
    updateHintTargets();
  }
  els.xrayBtn.addEventListener('click', toggleHint);

  function setPaused(p){
    if (p === state.paused) return;
    if (p) tick();
    state.paused = p;
    if (!p && state.started) state.lastTick = Date.now();
    els.app.classList.toggle('paused', p);
    els.pauseOverlay.classList.toggle('show', p);
  }
  els.pauseBtn.addEventListener('click', function(){ setPaused(true); });
  els.resumeBtn.addEventListener('click', function(){ setPaused(false); });

  function applySound(){
    els.soundBtn.setAttribute('aria-pressed', state.muted ? 'false' : 'true');
    els.soundWaves.style.display = state.muted ? 'none' : '';
  }
  function toggleSound(){
    state.muted = !state.muted;
    store.set('kingdog.muted', state.muted ? '1' : '0');
    applySound();
    if (!state.muted) sndClick();
  }
  els.soundBtn.addEventListener('click', toggleSound);

  function currentTheme(){
    var attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  els.themeBtn.addEventListener('click', function(){
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    store.set('kingdog.theme', next);
  });
  var savedTheme = store.get('kingdog.theme', '');
  if (savedTheme === 'light' || savedTheme === 'dark') document.documentElement.setAttribute('data-theme', savedTheme);

  // ---------- Atajos de teclado ----------
  document.addEventListener('keydown', function(e){
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var t = e.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    var k = e.key.toLowerCase();
    if (k === '1') selectTool('destornillador');
    else if (k === '2') selectTool('espatula');
    else if (k === '3') selectTool('mano');
    else if (k === 'h') toggleHint();
    else if (k === 'p') setPaused(!state.paused);
    else if (k === 'r') resetGame();
    else if (k === 'm') toggleSound();
    else if (k === 'escape' && state.paused) setPaused(false);
  });

  // Pausar automáticamente si la pestaña queda en segundo plano (el tiempo no corre)
  document.addEventListener('visibilitychange', function(){
    if (document.hidden && state.started && !state.finished) setPaused(true);
  });

  // ---------- Inicio ----------
  selectTool('destornillador');
  applyMode();
  applySound();
  updateHUD();
})();
