# Documento de requisitos del producto (PRD)

## 1. Propósito del proyecto

El propósito de Kingdog of Electronics es ofrecer una experiencia web interactiva para aprender, de manera visual, el orden básico de desmontaje y montaje de equipos electrónicos. La página inicial permite elegir entre un teléfono inteligente modular y una torre de PC de escritorio. Cada simulador se presenta en su propia página y cuenta con un enlace para regresar al selector.

Los equipos son modelos didácticos de referencia. Su distribución no representa necesariamente la de una marca o modelo comercial específico.

## 2. Objetivos

- Permitir que las personas desmonten y vuelvan a montar cada equipo mediante una guía paso a paso o un modo libre.
- Facilitar el uso de las piezas con ratón, lápiz o pantalla táctil.
- Mostrar el nombre y la función de los componentes al pasar el cursor, sin mantener rótulos superpuestos sobre el modelo.
- Representar visualmente los tornillos, las placas, los cables, los conectores y los módulos principales.
- Explicar por qué una acción está bloqueada y señalar los elementos que se deben revisar.
- Adaptar la interfaz a distintos tamaños de pantalla y a las orientaciones vertical y horizontal.

## 3. Necesidades de las personas usuarias

- Quien usa el simulador puede elegir entre el teléfono y la torre de PC para conocer sus componentes.
- Durante el desmontaje, la persona necesita saber cuál tornillo, conexión o módulo debe manipular.
- Al pasar el cursor por una pieza, la persona puede consultar su nombre y su función.
- Para instalar una pieza, la persona puede soltarla cerca de su alojamiento, sin apuntar a una coordenada exacta.
- Las piezas retiradas se pueden guardar en la mesa de trabajo o en la bandeja y utilizar después durante el montaje.
- Las acciones principales se pueden realizar desde una pantalla táctil.

## 4. Alcance funcional

### Selector de equipos

La página inicial presenta una opción para cada simulador. Desde cualquiera de ellos se puede regresar al selector.

### Teléfono inteligente

El modelo contiene 15 módulos desmontables, 14 tornillos y seis conectores flex. Incluye la pantalla OLED y el digitalizador, el chasis, la placa base, la batería, la bobina NFC y de carga inalámbrica, las cámaras, los sensores, la cámara frontal, el auricular, la placa USB-C, el altavoz, el motor háptico, el flex lateral, la tapa trasera opaca de policarbonato y la bandeja SIM. Los chips soldados se representan como parte de la placa base y no como piezas independientes.

### Torre ATX de PC

El modelo contiene 11 módulos desmontables, 23 tornillos y siete conexiones o seguros. Sus piezas son el panel lateral opaco de acero, la tarjeta gráfica, dos módulos de memoria RAM, el disipador y el ventilador del procesador, el procesador, el SSD M.2, los ventiladores frontal y trasero, la placa base y la fuente de poder. Las conexiones incluyen la alimentación de la tarjeta gráfica, los ventiladores, la alimentación ATX y EPS y la palanca del socket del procesador.

### Interacciones y reglas

- **Destornillador:** se mantiene presionado sobre un tornillo para retirarlo o instalarlo.
- **Espátula:** se utiliza para conectar o desconectar los flexes y cables. En la torre también permite liberar o cerrar la palanca del socket.
- **Mano libre:** permite mover los módulos que se encuentran disponibles y llevarlos a la bandeja o a su ubicación.
- **Modo Guía:** cada equipo presenta 26 acciones para el desmontaje y 26 para el montaje.
- **Modo Libre:** permite explorar el equipo; las reglas que controlan el orden y las dependencias siguen activas.
- **Ayudas y seguimiento:** hay pistas, pausa, reinicio, cronómetro, contador de errores y mensajes para explicar las acciones bloqueadas.
- **Información contextual:** el nombre y la descripción de los módulos y las conexiones aparecen al pasar el cursor. Los elementos que admiten enfoque también muestran esta información con el teclado.

## 5. Requisitos de calidad

- La interfaz debe adaptarse a distintos tamaños de pantalla y a las orientaciones vertical y horizontal.
- Las interacciones deben funcionar con ratón, lápiz y pantalla táctil mediante Pointer Events.
- Las zonas para dejar e instalar piezas deben ser tolerantes y mostrar si la acción es válida o está bloqueada.
- Los controles deben tener nombres accesibles; los conectores también deben poder accionarse con el teclado.
- El proyecto debe ejecutarse directamente en el navegador, sin instalación ni compilación.
- Las animaciones y las fichas informativas deben complementar las instrucciones escritas, no reemplazarlas.

## 6. Límites del proyecto

- Los modelos no incluyen todas las variantes de teléfonos, placas base o torres, ni representan un procedimiento oficial de reparación.
- Los chips soldados no se desmontan por separado.
- El simulador no diagnostica fallas eléctricas ni evalúa la seguridad de una reparación real.
- La incorporación de otros equipos, como computadores portátiles, se considera una posible mejora futura.
