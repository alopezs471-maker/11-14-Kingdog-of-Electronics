(function(){
  'use strict';

  function $(id){ return document.getElementById(id); }
  var PART_IDS = ['sidePanel','gpu','ram1','ram2','cooler','cpu','ssd','frontFan','rearFan','motherboard','psu'];
  var SCREW_GROUPS = {
    sidePanel:['panel-a','panel-b'], gpu:['gpu-a','gpu-b'], cooler:['cooler-a','cooler-b','cooler-c','cooler-d'],
    ssd:['ssd-a'], frontFan:['front-a','front-b'], rearFan:['rear-a','rear-b'],
    motherboard:['mobo-a','mobo-b','mobo-c','mobo-d','mobo-e','mobo-f'], psu:['psu-a','psu-b','psu-c','psu-d']
  };
  var SCREW_IDS = Object.keys(SCREW_GROUPS).reduce(function(all,key){ return all.concat(SCREW_GROUPS[key]); },[]);
  var CONNECTOR_KEYS = ['gpuPower','coolerFan','cpuSocket','frontFan','rearFan','eps','atx'];
  var CONNECTOR_LABELS = {
    gpuPower:'alimentación de la tarjeta gráfica', coolerFan:'ventilador del procesador',
    cpuSocket:'retención del procesador', frontFan:'ventilador frontal', rearFan:'ventilador trasero',
    eps:'alimentación EPS del procesador', atx:'alimentación ATX de 24 pines'
  };
  var PART_LABELS = {
    sidePanel:'Panel lateral de vidrio', gpu:'Tarjeta gráfica', ram1:'Memoria RAM A', ram2:'Memoria RAM B',
    cooler:'Disipador y ventilador del procesador', cpu:'Procesador', ssd:'SSD M.2 NVMe',
    frontFan:'Ventilador frontal', rearFan:'Ventilador trasero', motherboard:'Placa base ATX', psu:'Fuente de poder ATX'
  };
  var PART_INFO = {
    sidePanel:'Cubre el costado de la torre y protege los componentes internos.',
    gpu:'Tarjeta de expansión que procesa gráficos y entrega imagen a la pantalla.',
    ram1:'Módulo de memoria de acceso rápido. Se instala en una ranura DIMM.',
    ram2:'Segundo módulo de memoria; trabaja junto al primero en doble canal.',
    cooler:'Disipador y ventilador que extraen el calor del procesador.',
    cpu:'Procesador principal del computador, instalado en el socket de la placa base.',
    ssd:'Unidad de estado sólido M.2 NVMe para almacenar el sistema y los archivos.',
    frontFan:'Introduce aire fresco por el frente de la torre.',
    rearFan:'Expulsa el aire caliente por la parte trasera de la torre.',
    motherboard:'Placa principal que conecta el procesador, memoria, gráficos y alimentación.',
    psu:'Fuente ATX que convierte la energía de la toma en voltajes para el PC.'
  };
  var CONNECTOR_INFO = {
    gpuPower:'Cable de alimentación PCIe/12VHPWR de la tarjeta gráfica.',
    coolerFan:'Conector de ventilación del disipador a la placa base.',
    cpuSocket:'Palanca de retención del socket: se libera para retirar el procesador.',
    frontFan:'Conector de alimentación y control del ventilador frontal.',
    rearFan:'Conector de alimentación y control del ventilador trasero.',
    eps:'Cable EPS de 8 pines que alimenta el procesador.',
    atx:'Conector principal de 24 pines que alimenta la placa base.'
  };

  var state = {
    goal:'desarmar', mode:'guia', tool:'destornillador', installed:{}, screws:{}, connections:{},
    trayScrewCount:0, started:false, elapsed:0, lastTick:0, errors:0, paused:false, finished:false, hint:false
  };
  PART_IDS.forEach(function(id){ state.installed[id]=true; });
  SCREW_IDS.forEach(function(id){ state.screws[id]=true; });
  CONNECTOR_KEYS.forEach(function(id){ state.connections[id]=true; });

  var els = {
    app:$('pcApp'), workbench:$('workbench'), stage:$('caseStage'), message:$('messageBar'),
    trayPanel:document.querySelector('.tray-panel'), trayList:$('trayList'), trayEmpty:$('trayEmpty'),
    goalPill:$('goalPill'), stepPill:$('stepPill'), timerPill:$('timerPill'), modeLabel:$('modeLabel'),
    modeBtn:$('modeBtn'), hintBtn:$('hintBtn'), pauseBtn:$('pauseBtn'), resetBtn:$('resetBtn'),
    themeBtn:$('themeBtn'), pauseOverlay:$('pauseOverlay'), resumeBtn:$('resumeBtn'),
    successOverlay:$('successOverlay'), successTitle:$('successTitle'), successText:$('successText'),
    successStats:$('successStats'), playAgainBtn:$('playAgainBtn'), restartBtn:$('restartBtn'),
    infoTooltip:$('infoTooltip'), infoTooltipTitle:$('infoTooltipTitle'), infoTooltipBody:$('infoTooltipBody')
  };
  PART_IDS.forEach(function(id){ els[id]=$(id); });
  var screwEls={};
  SCREW_IDS.forEach(function(id){ screwEls[id]=$('screw-'+id); });
  var connectorEls={
    gpuPower:$('gpuPowerConnector'), coolerFan:$('coolerFanConnector'), cpuSocket:$('cpuSocketConnector'),
    frontFan:$('frontFanConnector'), rearFan:$('rearFanConnector'), eps:$('epsConnector'), atx:$('atxConnector')
  };

  var tooltipTarget=null;
  function placeTooltip(x,y){
    var tip=els.infoTooltip, rect=tip.getBoundingClientRect(), left=x+14, top=y+14;
    if(left+rect.width>window.innerWidth-12) left=x-rect.width-14;
    if(top+rect.height>window.innerHeight-12) top=y-rect.height-14;
    tip.style.left=Math.max(12,Math.min(left,window.innerWidth-rect.width-12))+'px';
    tip.style.top=Math.max(12,Math.min(top,window.innerHeight-rect.height-12))+'px';
  }
  function showTooltip(el,title,info,x,y){
    if(tooltipTarget && tooltipTarget!==el) tooltipTarget.removeAttribute('aria-describedby');
    tooltipTarget=el;
    els.infoTooltipTitle.textContent=title;
    els.infoTooltipBody.textContent=info;
    els.infoTooltip.setAttribute('aria-hidden','false');
    els.infoTooltip.classList.add('visible');
    el.setAttribute('aria-describedby','infoTooltip');
    placeTooltip(x,y);
  }
  function hideTooltip(el){
    if(el && tooltipTarget!==el) return;
    if(tooltipTarget) tooltipTarget.removeAttribute('aria-describedby');
    tooltipTarget=null;
    els.infoTooltip.setAttribute('aria-hidden','true');
    els.infoTooltip.classList.remove('visible');
  }
  function bindTooltip(el,title,info){
    if(!el || !info) return;
    el.addEventListener('pointerenter',function(e){ if(e.pointerType!=='touch') showTooltip(el,title,info,e.clientX,e.clientY); });
    el.addEventListener('pointermove',function(e){ if(tooltipTarget===el) placeTooltip(e.clientX,e.clientY); });
    el.addEventListener('pointerleave',function(){ hideTooltip(el); });
    el.addEventListener('pointerdown',function(){ hideTooltip(el); });
    el.addEventListener('focus',function(){ var r=el.getBoundingClientRect(); showTooltip(el,title,info,r.left+r.width/2,r.top+r.height/2); });
    el.addEventListener('blur',function(){ hideTooltip(el); });
  }
  PART_IDS.forEach(function(id){ bindTooltip(els[id],PART_LABELS[id],PART_INFO[id]); });
  Object.keys(connectorEls).forEach(function(id){ bindTooltip(connectorEls[id],'Conector: '+CONNECTOR_LABELS[id],CONNECTOR_INFO[id]); });

  var trayItems={};
  var flashTimer=null;
  function setMessage(text){ els.message.innerHTML=text; }
  function flash(text,ms){
    setMessage(text);
    clearTimeout(flashTimer);
    flashTimer=setTimeout(function(){ flashTimer=null; updateHUD(); },ms||2400);
  }
  function formatTime(ms){ var s=Math.floor(ms/1000),m=Math.floor(s/60);s%=60;return (m<10?'0':'')+m+':'+(s<10?'0':'')+s; }
  function startClock(){ if(!state.started && !state.finished){state.started=true;state.lastTick=Date.now();} }
  function tick(){ if(state.started && !state.paused && !state.finished){var now=Date.now();state.elapsed+=now-state.lastTick;state.lastTick=now;}els.timerPill.textContent=formatTime(state.elapsed); }
  setInterval(tick,250);

  function groupScrewCount(group){ return SCREW_GROUPS[group].filter(function(id){return state.screws[id];}).length; }
  function groupScrewEls(group,installed){ return SCREW_GROUPS[group].filter(function(id){return state.screws[id]===installed;}).map(function(id){return screwEls[id];}); }
  function firstInstalled(ids){ for(var i=0;i<ids.length;i++) if(state.installed[ids[i]]) return ids[i]; return null; }
  function firstMissing(ids){ for(var i=0;i<ids.length;i++) if(!state.installed[ids[i]]) return ids[i]; return null; }
  function installedBlockers(ids){ return ids.filter(function(id){return state.installed[id];}).map(function(id){return parts[id].el;}); }
  function missingBlockers(ids){ return ids.filter(function(id){return !state.installed[id];}).map(function(id){return parts[id].el;}); }
  function connectorBlockers(ids,connected){ return ids.filter(function(id){return state.connections[id]===connected;}).map(function(id){return connectorEls[id];}); }
  function blockForScrews(group,shouldBeInstalled){
    var count=groupScrewCount(group),total=SCREW_GROUPS[group].length;
    if(shouldBeInstalled && count!==total) return 'Faltan '+(total-count)+' tornillo(s) de '+PART_LABELS[group]+'.';
    if(!shouldBeInstalled && count) return 'Retira primero los '+count+' tornillo(s) de '+PART_LABELS[group]+'.';
    return null;
  }
  function blockForConnections(keys,connected){
    for(var i=0;i<keys.length;i++) if(state.connections[keys[i]]===connected) return 'Desconecta primero '+CONNECTOR_LABELS[keys[i]]+'.';
    return null;
  }
  function blockForMissing(ids){var id=firstMissing(ids);return id?'Instala primero '+PART_LABELS[id]+'.':null;}
  function blockForInstalled(ids){var id=firstInstalled(ids);return id?'Retira primero '+PART_LABELS[id]+'.':null;}

  var INNER_PART_IDS=PART_IDS.filter(function(id){return id!=='sidePanel';});
  var BOARD_COMPONENT_IDS=['gpu','ram1','ram2','cooler','cpu','ssd','frontFan','rearFan'];
  var INNER_SCREW_GROUPS=['gpu','cooler','ssd','frontFan','rearFan','motherboard','psu'];
  var parts={
    sidePanel:{
      el:els.sidePanel,label:PART_LABELS.sidePanel,color:'#6e7a76',carryScale:.63,
      removeBlock:function(){return blockForScrews('sidePanel',false);},
      removeBlockers:function(){return groupScrewEls('sidePanel',true);},
      installBlock:function(){
        var missing=firstMissing(INNER_PART_IDS);if(missing)return 'Instala '+PART_LABELS[missing]+' antes de cerrar la torre.';
        var open=CONNECTOR_KEYS.filter(function(k){return !state.connections[k];})[0];if(open)return 'Reconecta '+CONNECTOR_LABELS[open]+' antes de cerrar la torre.';
        var group=INNER_SCREW_GROUPS.filter(function(g){return groupScrewCount(g)!==SCREW_GROUPS[g].length;})[0];
        return group?'Instala los tornillos de '+PART_LABELS[group]+'.':null;
      },
      installBlockers:function(){var out=missingBlockers(INNER_PART_IDS);CONNECTOR_KEYS.forEach(function(k){if(!state.connections[k])out.push(connectorEls[k]);});INNER_SCREW_GROUPS.forEach(function(g){out=out.concat(groupScrewEls(g,false));});return out;}
    },
    gpu:{
      el:els.gpu,label:PART_LABELS.gpu,color:'#434e4e',carryScale:.83,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.connections.gpuPower)return 'Desconecta primero el cable de alimentación de la gráfica.';return blockForScrews('gpu',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.gpuPower].concat(groupScrewEls('gpu',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.connections.gpuPower)return 'Conecta la gráfica después de encajarla.';return blockForScrews('gpu',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.gpuPower].concat(groupScrewEls('gpu',true));}
    },
    ram1:{
      el:els.ram1,label:PART_LABELS.ram1,color:'#90a65a',carryScale:.92,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.installed.gpu?'Retira primero la tarjeta gráfica para acceder a la memoria.':null;},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu];},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.installed.gpu?'Instala la memoria antes que la gráfica.':null;},
      installBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu];}
    },
    ram2:{
      el:els.ram2,label:PART_LABELS.ram2,color:'#a8bc68',carryScale:.92,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.installed.gpu?'Retira primero la tarjeta gráfica para acceder a la memoria.':null;},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu];},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.installed.gpu?'Instala la memoria antes que la gráfica.':null;},
      installBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu];}
    },
    cooler:{
      el:els.cooler,label:PART_LABELS.cooler,color:'#778381',carryScale:.8,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.connections.coolerFan)return 'Desconecta primero el ventilador del procesador.';return blockForScrews('cooler',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.coolerFan].concat(groupScrewEls('cooler',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(!state.installed.cpu)return 'Instala primero el procesador.';if(!state.connections.cpuSocket)return 'Bloquea el socket del procesador antes de montar el disipador.';return blockForScrews('cooler',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard,els.cpu,connectorEls.cpuSocket].concat(groupScrewEls('cooler',true));}
    },
    cpu:{
      el:els.cpu,label:PART_LABELS.cpu,color:'#66726f',carryScale:.92,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.installed.cooler)return 'Retira primero el disipador.';return state.connections.cpuSocket?'Libera primero la palanca del socket del procesador.':null;},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,els.cooler,connectorEls.cpuSocket];},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.installed.cooler)return 'Instala el procesador antes que el disipador.';return state.connections.cpuSocket?'Libera el socket antes de colocar el procesador.':null;},
      installBlockers:function(){return [els.sidePanel,els.motherboard,els.cooler,connectorEls.cpuSocket];}
    },
    ssd:{
      el:els.ssd,label:PART_LABELS.ssd,color:'#515b59',carryScale:.9,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.installed.gpu)return 'Retira primero la tarjeta gráfica para acceder al SSD.';return blockForScrews('ssd',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu].concat(groupScrewEls('ssd',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.installed.gpu?'Instala el SSD antes que la gráfica.':blockForScrews('ssd',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard,els.gpu].concat(groupScrewEls('ssd',true));}
    },
    frontFan:{
      el:els.frontFan,label:PART_LABELS.frontFan,color:'#485352',carryScale:.9,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.connections.frontFan)return 'Desconecta primero el ventilador frontal.';return blockForScrews('frontFan',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.frontFan].concat(groupScrewEls('frontFan',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.connections.frontFan?'Conecta el ventilador frontal después de instalarlo.':blockForScrews('frontFan',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.frontFan].concat(groupScrewEls('frontFan',true));}
    },
    rearFan:{
      el:els.rearFan,label:PART_LABELS.rearFan,color:'#555e59',carryScale:.92,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';if(state.connections.rearFan)return 'Desconecta primero el ventilador trasero.';return blockForScrews('rearFan',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.rearFan].concat(groupScrewEls('rearFan',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.motherboard)return 'Instala primero la placa base.';return state.connections.rearFan?'Conecta el ventilador trasero después de instalarlo.':blockForScrews('rearFan',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard,connectorEls.rearFan].concat(groupScrewEls('rearFan',true));}
    },
    motherboard:{
      el:els.motherboard,label:PART_LABELS.motherboard,color:'#27704b',carryScale:.78,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';var installed=firstInstalled(BOARD_COMPONENT_IDS);if(installed)return 'Retira primero '+PART_LABELS[installed]+'.';var connected=blockForConnections(['gpuPower','coolerFan','cpuSocket','frontFan','rearFan','eps','atx'],true);return connected||blockForScrews('motherboard',false);},
      removeBlockers:function(){return [els.sidePanel].concat(installedBlockers(BOARD_COMPONENT_IDS),connectorBlockers(['gpuPower','coolerFan','cpuSocket','frontFan','rearFan','eps','atx'],true),groupScrewEls('motherboard',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';if(!state.installed.psu)return 'Instala primero la fuente de poder.';var installed=firstInstalled(BOARD_COMPONENT_IDS);return installed?'Coloca la placa base antes que '+PART_LABELS[installed]+'.':blockForScrews('motherboard',false);},
      installBlockers:function(){return [els.sidePanel,els.psu].concat(installedBlockers(BOARD_COMPONENT_IDS),groupScrewEls('motherboard',true));}
    },
    psu:{
      el:els.psu,label:PART_LABELS.psu,color:'#3c4543',carryScale:.78,
      removeBlock:function(){if(state.installed.sidePanel)return 'Retira primero el panel lateral.';if(state.installed.motherboard)return 'Retira primero la placa base.';return blockForScrews('psu',false);},
      removeBlockers:function(){return [els.sidePanel,els.motherboard].concat(groupScrewEls('psu',true));},
      installBlock:function(){if(state.installed.sidePanel)return 'Abre primero el panel lateral.';return state.installed.motherboard?'Instala la fuente antes que la placa base.':blockForScrews('psu',false);},
      installBlockers:function(){return [els.sidePanel,els.motherboard].concat(groupScrewEls('psu',true));}
    }
  };

  function partStep(id,installing,message){return{done:function(){return state.installed[id]===installing;},msg:function(){return message;},targets:function(){return installing?[parts[id].el,trayItems[id]]:[parts[id].el];}};}
  function screwStep(group,installing){return{
    done:function(){return installing?groupScrewCount(group)===SCREW_GROUPS[group].length:groupScrewCount(group)===0;},
    msg:function(){var count=groupScrewCount(group),remaining=installing?SCREW_GROUPS[group].length-count:count;return installing?'Con el <strong>destornillador</strong>, instala los tornillos de '+PART_LABELS[group]+'. Faltan '+remaining+'.':'Quita con el <strong>destornillador</strong> los tornillos de '+PART_LABELS[group]+'. Quedan '+remaining+'.';},
    targets:function(){return groupScrewEls(group,!installing);}
  };}
  function connectorStep(key,connected,message){return{done:function(){return state.connections[key]===connected;},msg:function(){return message;},targets:function(){return[connectorEls[key]];}};}
  var STEPS={
    desarmar:[
      screwStep('sidePanel',false),partStep('sidePanel',false,'Quita el <strong>panel lateral</strong> de la torre.'),
      connectorStep('gpuPower',false,'Desconecta el cable de <strong>alimentación de la gráfica</strong>.'),
      screwStep('gpu',false),partStep('gpu',false,'Retira la <strong>tarjeta gráfica</strong>.'),
      partStep('ram1',false,'Retira el <strong>módulo de memoria RAM A</strong>.'),partStep('ram2',false,'Retira el <strong>módulo de memoria RAM B</strong>.'),
      connectorStep('coolerFan',false,'Desconecta el <strong>ventilador del procesador</strong>.'),screwStep('cooler',false),partStep('cooler',false,'Retira el <strong>disipador y ventilador</strong> del procesador.'),
      connectorStep('cpuSocket',false,'Libera la <strong>palanca del socket</strong> con la espátula.'),partStep('cpu',false,'Levanta el <strong>procesador</strong> con cuidado.'),
      screwStep('ssd',false),partStep('ssd',false,'Retira la <strong>unidad SSD M.2</strong>.'),
      connectorStep('frontFan',false,'Desconecta el <strong>ventilador frontal</strong>.'),screwStep('frontFan',false),partStep('frontFan',false,'Retira el <strong>ventilador frontal</strong>.'),
      connectorStep('rearFan',false,'Desconecta el <strong>ventilador trasero</strong>.'),screwStep('rearFan',false),partStep('rearFan',false,'Retira el <strong>ventilador trasero</strong>.'),
      connectorStep('eps',false,'Desconecta la alimentación <strong>EPS del procesador</strong>.'),connectorStep('atx',false,'Desconecta el conector principal <strong>ATX de 24 pines</strong>.'),
      screwStep('motherboard',false),partStep('motherboard',false,'Retira la <strong>placa base</strong> de la torre.'),
      screwStep('psu',false),partStep('psu',false,'Retira la <strong>fuente de poder</strong> para terminar.')
    ],
    armar:[
      partStep('psu',true,'Instala la <strong>fuente de poder</strong> en la parte inferior de la torre.'),screwStep('psu',true),
      partStep('motherboard',true,'Coloca la <strong>placa base</strong> en sus separadores.'),screwStep('motherboard',true),
      connectorStep('atx',true,'Conecta el cable principal <strong>ATX de 24 pines</strong>.'),connectorStep('eps',true,'Conecta la alimentación <strong>EPS del procesador</strong>.'),
      partStep('rearFan',true,'Instala el <strong>ventilador trasero</strong>.'),screwStep('rearFan',true),connectorStep('rearFan',true,'Conecta el <strong>ventilador trasero</strong> a la placa.'),
      partStep('frontFan',true,'Instala el <strong>ventilador frontal</strong>.'),screwStep('frontFan',true),connectorStep('frontFan',true,'Conecta el <strong>ventilador frontal</strong> a la placa.'),
      partStep('ssd',true,'Instala el <strong>SSD M.2 NVMe</strong>.'),screwStep('ssd',true),
      partStep('cpu',true,'Coloca el <strong>procesador</strong> alineando la marca del socket.'),connectorStep('cpuSocket',true,'Bloquea la <strong>palanca del socket</strong> para fijar el procesador.'),
      partStep('cooler',true,'Instala el <strong>disipador del procesador</strong>.'),screwStep('cooler',true),connectorStep('coolerFan',true,'Conecta el <strong>ventilador del disipador</strong>.'),
      partStep('ram2',true,'Instala el <strong>módulo de memoria RAM B</strong>.'),partStep('ram1',true,'Instala el <strong>módulo de memoria RAM A</strong>.'),
      partStep('gpu',true,'Instala la <strong>tarjeta gráfica</strong> en la ranura PCIe.'),screwStep('gpu',true),connectorStep('gpuPower',true,'Conecta la alimentación de la <strong>tarjeta gráfica</strong>.'),
      partStep('sidePanel',true,'Cierra la torre con el <strong>panel lateral</strong>.'),screwStep('sidePanel',true)
    ]
  };

  function currentSteps(){return STEPS[state.goal];}
  function currentStepIndex(){var s=currentSteps();for(var i=0;i<s.length;i++)if(!s[i].done())return i;return s.length;}
  function doneCount(){return currentSteps().filter(function(s){return s.done();}).length;}
  function clearHints(){document.querySelectorAll('.xray-target').forEach(function(el){el.classList.remove('xray-target');});}
  function updateHints(){clearHints();if(!state.hint)return;var s=currentSteps(),i=currentStepIndex();if(i<s.length)s[i].targets().forEach(function(el){if(el)el.classList.add('xray-target');});}
  function updateHUD(){
    var s=currentSteps(),i=currentStepIndex();els.goalPill.textContent=state.goal==='desarmar'?'Desarmar':'Armar';els.stepPill.textContent=doneCount()+'/'+s.length;
    if(!flashTimer){if(i>=s.length)setMessage(state.goal==='desarmar'?'¡Torre desmontada!':'¡Torre armada!');else if(state.mode==='guia')setMessage(s[i].msg());else setMessage('<strong>Modo Libre:</strong> explora la torre; activa Pistas si necesitas ayuda.');}
    updateHints();
  }
  function updateVisuals(){
    PART_IDS.forEach(function(id){els[id].classList.toggle('part-removed',!state.installed[id]);});
    SCREW_IDS.forEach(function(id){screwEls[id].classList.toggle('gone',!state.screws[id]);});
    CONNECTOR_KEYS.forEach(function(id){var el=connectorEls[id];el.classList.toggle('disconnected',!state.connections[id]);el.setAttribute('aria-pressed',state.connections[id]?'true':'false');el.setAttribute('aria-label',CONNECTOR_LABELS[id]+(id==='cpuSocket'?(state.connections[id]?', bloqueada':', liberada'):(state.connections[id]?', conectado':', desconectado')));});
  }
  function afterChange(){updateHUD();checkGoal();}
  function checkGoal(){
    if(state.finished||currentStepIndex()<currentSteps().length)return;
    state.finished=true;tick();
    if(state.goal==='desarmar'){
      els.successTitle.textContent='Torre completamente desmontada';els.successText.textContent='La placa base, la gráfica, la memoria, el procesador, la refrigeración y la fuente están listas para volver a montarse.';els.playAgainBtn.textContent='Volver a armar';els.restartBtn.hidden=false;
    }else{
      els.successTitle.textContent='¡PC armado!';els.successText.textContent='Los módulos, conexiones y tornillos volvieron a sus lugares.';els.playAgainBtn.textContent='Reiniciar simulador';els.restartBtn.hidden=true;
    }
    els.successStats.textContent='Tiempo '+formatTime(state.elapsed)+' · Errores '+state.errors;
    setTimeout(function(){els.successOverlay.classList.add('show');},250);
  }

  function refreshTray(){els.trayEmpty.style.display=els.trayList.querySelector('.tray-item')?'none':'';}
  function addTrayScrew(){
    var item=$('tray-screws');
    if(item){item.querySelector('.count').textContent='×'+state.trayScrewCount;return;}
    item=document.createElement('div');item.className='tray-item';item.id='tray-screws';item.innerHTML='<span class="swatch" style="background:var(--amber)"></span><span>Tornillos</span><span class="count">×'+state.trayScrewCount+'</span>';
    bindTooltip(item,'Tornillos','Fijaciones retiradas de la torre; instálalas en sus orificios con el destornillador.');els.trayList.appendChild(item);refreshTray();
  }
  function removeTrayScrew(){var item=$('tray-screws');if(!item)return;if(state.trayScrewCount<=0)item.remove();else item.querySelector('.count').textContent='×'+state.trayScrewCount;refreshTray();}
  function addTrayPart(id){
    if(trayItems[id])return;var p=parts[id],item=document.createElement('div');item.className='tray-item piece';item.tabIndex=0;item.setAttribute('role','button');item.setAttribute('aria-label',p.label+': arrastra para volver a instalar');item.innerHTML='<span class="swatch" style="background:'+p.color+'"></span><span>'+p.label+'</span><span aria-hidden="true">⠿</span>';
    bindTooltip(item,p.label,PART_INFO[id]);item.addEventListener('pointerdown',function(e){if(state.paused||e.button>0)return;e.preventDefault();selectTool('mano');startCarry(id,e,true);});
    els.trayList.appendChild(item);trayItems[id]=item;refreshTray();
  }
  function removeTrayPart(id){var item=trayItems[id];if(item){item.remove();delete trayItems[id];refreshTray();}}

  var toolButtons=document.querySelectorAll('.tool-btn');
  function selectTool(name){state.tool=name;els.app.setAttribute('data-tool',name);toolButtons.forEach(function(btn){var on=btn.getAttribute('data-tool')===name;btn.classList.toggle('selected',on);btn.setAttribute('aria-pressed',on?'true':'false');});}
  toolButtons.forEach(function(btn){btn.addEventListener('click',function(){selectTool(btn.getAttribute('data-tool'));});});

  function registerError(){state.errors++;}
  function flashBlocked(el){registerError();el.classList.add('blocked-shake');setTimeout(function(){el.classList.remove('blocked-shake');},450);}
  function flashBlockers(list){list.forEach(function(el){if(!el)return;el.classList.add('blocker-flash');setTimeout(function(){el.classList.remove('blocker-flash');},750);});}
  function connectorAccessBlock(key){
    if(state.installed.sidePanel)return 'Retira primero el panel lateral para acceder al interior.';
    if(key==='gpuPower'&&(!state.installed.gpu||!state.installed.motherboard))return 'Instala la gráfica y la placa base para acceder al cable.';
    if(key==='coolerFan'&&(!state.installed.cooler||!state.installed.motherboard))return 'Instala el disipador y la placa base para conectar el ventilador.';
    if(key==='cpuSocket'&&(!state.installed.cpu||!state.installed.motherboard||state.installed.cooler))return 'Retira el disipador y coloca el procesador para manipular la palanca del socket.';
    if(key==='frontFan'&&(!state.installed.frontFan||!state.installed.motherboard))return 'Instala el ventilador frontal y la placa base.';
    if(key==='rearFan'&&(!state.installed.rearFan||!state.installed.motherboard))return 'Instala el ventilador trasero y la placa base.';
    if((key==='eps'||key==='atx')&&(!state.installed.motherboard||!state.installed.psu))return 'Instala la placa base y la fuente de poder.';
    return null;
  }
  function toggleConnector(key,el){
    if(state.paused)return;
    if(state.tool!=='espatula'){flashBlocked(el);flash('Selecciona la <strong>espátula</strong> para manipular '+CONNECTOR_LABELS[key]+'.');return;}
    var block=connectorAccessBlock(key);if(block){flashBlocked(el);flash(block);return;}
    startClock();state.connections[key]=!state.connections[key];el.classList.toggle('disconnected',!state.connections[key]);
    el.setAttribute('aria-pressed',state.connections[key]?'true':'false');el.setAttribute('aria-label',CONNECTOR_LABELS[key]+(state.connections[key]?', conectado':', desconectado'));afterChange();
  }
  CONNECTOR_KEYS.forEach(function(key){var el=connectorEls[key];el.addEventListener('pointerdown',function(e){e.preventDefault();e.stopPropagation();toggleConnector(key,el);});el.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleConnector(key,el);}});});

  function attachScrew(id,el){
    var timer=null,holding=false;
    el.addEventListener('pointerdown',function(e){
      if(state.paused)return;e.stopPropagation();if(state.tool!=='destornillador'){flashBlocked(el);flash('Selecciona el <strong>destornillador</strong> para manipular este tornillo.');return;}
      var installing=!state.screws[id];if(installing&&state.trayScrewCount<=0){flash('No quedan tornillos en la bandeja.');return;}startClock();holding=true;el.style.setProperty('--hold','550ms');el.classList.toggle('reverse',installing);el.classList.add('spinning');
      timer=setTimeout(function(){timer=null;holding=false;finishScrew(id,el,installing);},550);
    });
    function cancel(){if(timer){clearTimeout(timer);timer=null;}if(holding){holding=false;el.classList.remove('spinning','reverse');}}
    el.addEventListener('pointerup',cancel);el.addEventListener('pointerleave',cancel);el.addEventListener('pointercancel',cancel);
  }
  function finishScrew(id,el,installing){
    el.classList.remove('spinning','reverse');
    if(installing){if(state.screws[id]||!state.trayScrewCount)return;state.screws[id]=true;state.trayScrewCount--;el.classList.remove('gone');removeTrayScrew();}
    else{if(!state.screws[id])return;state.screws[id]=false;state.trayScrewCount++;el.classList.add('gone');addTrayScrew();}
    afterChange();
  }
  SCREW_IDS.forEach(function(id){attachScrew(id,screwEls[id]);});

  function makeGhost(el,rect){var g=el.cloneNode(true);g.removeAttribute('id');g.querySelectorAll('[id]').forEach(function(kid){kid.removeAttribute('id');});g.classList.remove('part-removed','slot-ok','slot-bad','xray-target','blocked-shake');g.classList.add('drag-ghost');Object.assign(g.style,{left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',right:'auto',bottom:'auto',transform:'none',opacity:'1'});document.body.appendChild(g);return g;}
  var carrying=null;
  function startCarry(id,e,fromTray){
    if(carrying)return;var p=parts[id],el=p.el,rect=el.getBoundingClientRect(),cx=rect.left+rect.width/2,cy=rect.top+rect.height/2;
    var grabX=fromTray?0:e.clientX-cx,grabY=fromTray?0:e.clientY-cy,ghost=makeGhost(el,rect),scale=p.carryScale||.9;
    startClock();if(!fromTray)el.classList.add('part-removed');ghost.style.transition='scale .14s ease';ghost.style.scale=String(scale);carrying={id:id,ghost:ghost,pointerId:e.pointerId};if(!fromTray)els.workbench.classList.add('drop-active');
    var tolerance=Math.max(50,Math.min(rect.width,rect.height)*.5),lastX=e.clientX,lastY=e.clientY;
    function place(x,y){lastX=x;lastY=y;ghost.style.transform='translate('+(x-grabX-cx)+'px,'+(y-grabY-cy)+'px)';}
    function nearSlot(){return Math.hypot((lastX-grabX)-cx,(lastY-grabY)-cy)<tolerance;}
    function inRect(pointX,pointY,r,inset){inset=inset||0;return pointX>=r.left-inset&&pointX<=r.right+inset&&pointY>=r.top-inset&&pointY<=r.bottom+inset;}
    function overTray(){return inRect(lastX,lastY,els.trayPanel.getBoundingClientRect(),0);}
    function overBench(){if(!inRect(lastX,lastY,els.workbench.getBoundingClientRect(),0))return false;if(inRect(lastX,lastY,els.stage.getBoundingClientRect(),10))return false;if(inRect(lastX,lastY,els.message.getBoundingClientRect(),6))return false;return true;}
    function slot(cls){el.classList.toggle('slot-ok',cls==='ok');el.classList.toggle('slot-bad',cls==='bad');}
    function cleanup(){window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',cancel);els.workbench.classList.remove('drop-active','drop-ok');els.trayPanel.classList.remove('drop-ok');slot(null);carrying=null;}
    function removeGhost(ms){setTimeout(function(){if(ghost.parentNode)ghost.remove();},ms);}
    function move(ev){if(!carrying||ev.pointerId!==carrying.pointerId)return;place(ev.clientX,ev.clientY);if(fromTray){var near=nearSlot();slot(near?(p.installBlock()?'bad':'ok'):null);}else{els.trayPanel.classList.toggle('drop-ok',overTray());els.workbench.classList.toggle('drop-ok',overBench());}}
    function up(ev){if(!carrying||ev.pointerId!==carrying.pointerId)return;var onTray=!fromTray&&overTray(),onBench=!fromTray&&overBench(),near=fromTray&&nearSlot(),block=fromTray&&near?p.installBlock():null;cleanup();
      if(fromTray&&near&&!block){ghost.style.transition='transform .18s ease,scale .18s ease';ghost.style.transform='none';ghost.style.scale='1';setTimeout(function(){el.classList.remove('part-removed');state.installed[id]=true;removeTrayPart(id);afterChange();},170);removeGhost(200);return;}
      if(!fromTray&&(onTray||onBench)){ghost.style.transition='transform .25s ease,scale .25s ease,opacity .25s ease';ghost.style.scale='.45';ghost.style.opacity='0';setTimeout(function(){state.installed[id]=false;addTrayPart(id);afterChange();},onTray?270:170);removeGhost(onTray?300:220);return;}
      if(fromTray){if(near&&block){registerError();flash(block);flashBlockers(p.installBlockers());}ghost.style.transition='transform .25s ease,scale .25s ease,opacity .25s ease';ghost.style.scale='.25';ghost.style.opacity='0';removeGhost(280);}
      else{ghost.style.transition='transform .25s ease,scale .25s ease';ghost.style.transform='none';ghost.style.scale='1';setTimeout(function(){el.classList.remove('part-removed');},250);removeGhost(270);}
    }
    function cancel(ev){if(!carrying||ev.pointerId!==carrying.pointerId)return;cleanup();if(!fromTray)el.classList.remove('part-removed');ghost.remove();}
    window.addEventListener('pointermove',move);window.addEventListener('pointerup',up);window.addEventListener('pointercancel',cancel);place(e.clientX,e.clientY);
  }
  PART_IDS.forEach(function(id){parts[id].el.addEventListener('pointerdown',function(e){if(state.paused||e.button>0||!state.installed[id])return;if(e.target.closest&&e.target.closest('.screw,.connector'))return;if(state.tool!=='mano'){flashBlocked(parts[id].el);flash('Selecciona <strong>Mano libre</strong> para mover la pieza.');return;}var block=parts[id].removeBlock();if(block){flashBlocked(parts[id].el);flash(block);flashBlockers(parts[id].removeBlockers());return;}e.preventDefault();startCarry(id,e,false);});});

  function reset(){
    PART_IDS.forEach(function(id){state.installed[id]=true;});SCREW_IDS.forEach(function(id){state.screws[id]=true;});CONNECTOR_KEYS.forEach(function(id){state.connections[id]=true;});
    state.trayScrewCount=0;state.started=false;state.elapsed=0;state.errors=0;state.paused=false;state.finished=false;state.goal='desarmar';state.hint=false;clearTimeout(flashTimer);flashTimer=null;
    Object.keys(trayItems).forEach(function(id){removeTrayPart(id);});$('tray-screws')&&$('tray-screws').remove();updateVisuals();els.app.classList.remove('paused');els.pauseOverlay.classList.remove('show');els.successOverlay.classList.remove('show');updateHUD();tick();
  }
  function startAssembly(){state.goal='armar';state.started=false;state.elapsed=0;state.errors=0;state.finished=false;els.successOverlay.classList.remove('show');updateHUD();tick();}
  function setPaused(v){if(v===state.paused)return;state.paused=v;els.app.classList.toggle('paused',v);els.pauseOverlay.classList.toggle('show',v);if(!v&&state.started)state.lastTick=Date.now();}
  els.modeBtn.addEventListener('click',function(){state.mode=state.mode==='guia'?'libre':'guia';els.modeBtn.textContent=state.mode==='guia'?'Modo Guía':'Modo Libre';els.modeBtn.setAttribute('aria-pressed',state.mode==='guia'?'true':'false');els.modeLabel.textContent=state.mode==='guia'?'Torre ATX modular · guía de 26 pasos':'Torre ATX modular · modo libre';updateHUD();});
  els.hintBtn.addEventListener('click',function(){state.hint=!state.hint;els.hintBtn.classList.toggle('active',state.hint);els.hintBtn.setAttribute('aria-pressed',state.hint?'true':'false');updateHints();});
  els.pauseBtn.addEventListener('click',function(){setPaused(true);});els.resumeBtn.addEventListener('click',function(){setPaused(false);});els.resetBtn.addEventListener('click',reset);els.restartBtn.addEventListener('click',reset);
  els.playAgainBtn.addEventListener('click',function(){if(state.goal==='desarmar')startAssembly();else reset();});
  els.themeBtn.addEventListener('click',function(){var dark=document.documentElement.getAttribute('data-theme')!=='light';document.documentElement.setAttribute('data-theme',dark?'light':'dark');});
  document.addEventListener('keydown',function(e){if(e.ctrlKey||e.metaKey||e.altKey||/INPUT|TEXTAREA/.test(e.target.tagName))return;var key=e.key.toLowerCase();if(key==='1')selectTool('destornillador');else if(key==='2')selectTool('espatula');else if(key==='3')selectTool('mano');else if(key==='h')els.hintBtn.click();else if(key==='p')setPaused(!state.paused);else if(key==='r')reset();else if(key==='escape'&&state.paused)setPaused(false);});
  function applyTheme(){var theme=document.documentElement.getAttribute('data-theme');if(theme==='light'){document.documentElement.style.setProperty('--bg','#e6e9e3');document.documentElement.style.setProperty('--bg-2','#dce1d9');document.documentElement.style.setProperty('--panel','#f1f3ee');document.documentElement.style.setProperty('--panel-border','#c4cdc5');document.documentElement.style.setProperty('--text','#18211d');document.documentElement.style.setProperty('--text-dim','#59665e');}else{['--bg','--bg-2','--panel','--panel-border','--text','--text-dim'].forEach(function(k){document.documentElement.style.removeProperty(k);});}}
  els.themeBtn.addEventListener('click',applyTheme);
  updateVisuals();selectTool('destornillador');updateHUD();tick();
})();
