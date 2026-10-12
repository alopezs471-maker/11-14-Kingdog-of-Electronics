# Kingdog of Electronics

Kingdog of Electronics es un proyecto web con simuladores didácticos para desmontar y volver a montar dos equipos: un teléfono inteligente modular y una torre de PC de escritorio. Los modelos presentan componentes representativos y no sustituyen las instrucciones de servicio de un fabricante.

## Ejecución del proyecto

El proyecto no requiere instalación ni compilación. Para abrirlo, se puede cargar `index.html` en un navegador o iniciar un servidor local:

```sh
python3 -m http.server 4173
```

Después, se debe visitar `http://localhost:4173/`. La página inicial permite elegir el simulador y regresar al selector desde el botón de cuadrícula. También es posible abrir directamente `smartphone.html` o `pc.html`.

## Simuladores disponibles

- **Teléfono inteligente modular:** cuenta con 15 módulos, 14 tornillos y seis conectores flex. Su guía incluye 26 acciones para desmontarlo y 26 para volver a montarlo.
- **Torre de PC:** cuenta con 11 módulos, 23 tornillos y siete conexiones o seguros. Su guía también incluye 26 acciones para desmontarla y 26 para volver a montarla.

## Funciones principales

- **Herramientas:** el destornillador permite quitar y poner tornillos; la espátula se usa para conectar o desconectar cables y seguros; la mano libre permite mover los módulos.
- **Modos de uso:** el Modo Guía presenta los pasos en orden y el Modo Libre permite explorar, respetando las dependencias entre piezas.
- **Depósito e instalación:** las piezas se pueden dejar en la bandeja o en una zona libre junto al equipo. Para instalar una pieza, no es necesario soltarla en un punto exacto: basta con acercarla a su ubicación.
- **Información de los componentes:** al pasar el cursor por un módulo, una conexión o una pieza de la bandeja, aparece su nombre y una descripción. Así se evitan rótulos permanentes sobre el modelo.
- **Seguimiento:** cada simulador cuenta con pistas, pausa, reinicio, cronómetro y contador de errores.
- **Diseño adaptable:** las páginas se ajustan a teléfonos, tabletas y pantallas de escritorio, tanto en orientación vertical como horizontal.

## Componentes del teléfono

El modelo incluye la bandeja SIM, una tapa trasera opaca de policarbonato, la bobina NFC y de carga inalámbrica, la batería, las cámaras traseras, la placa base, el altavoz, la placa USB-C y el micrófono, el motor háptico, los sensores superiores, la cámara frontal, el auricular, el flex lateral, el chasis intermedio y la pantalla OLED con digitalizador. Los chips de la placa base se muestran como parte de esa pieza y no se pueden retirar por separado.

## Componentes de la torre

El modelo incluye un panel lateral opaco de acero, la tarjeta gráfica, dos módulos de memoria RAM, el disipador y el ventilador del procesador, el procesador, una unidad SSD M.2, los ventiladores frontal y trasero, la placa base ATX y la fuente de poder. La guía también incluye los cables de alimentación y ventilación, además de la palanca de retención del procesador.
