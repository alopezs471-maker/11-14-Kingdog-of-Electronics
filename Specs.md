1. Estructura del Objeto Interactivo
Cada pieza o elemento dentro del juego cuenta con los siguientes parámetros de interacción:

ID de Pieza: Identificador único (ejemplo: tornillo_tapa_01, bateria_iphone).

Capa de Renderizado: Determina qué pieza se dibuja por encima o por debajo en la pantalla.

Hitbox (Zona de Clic): Área interactiva en pantalla donde el usuario puede hacer clic o arrastrar.

Punto de Anclaje: Coordenadas exactas en el dispositivo donde la pieza debe encajar al ser instalada.

Estado Actual: Instalado, En mano (siendo arrastrado) o En la mesa.

Bloqueos Activos: Lista de tornillos, cables o piezas superiores que le impiden moverse mientras estén colocados.

2. Mecánicas de Interacción del Juego
Mecánica de Desatornillado:

El usuario selecciona la herramienta "Destornillador".

Pasa el cursor sobre un tornillo visible.

Mantiene presionado el clic: se activa la animación del tornillo elevándose.

Al finalizar, el tornillo vuela automáticamente a la bandeja de tornillos.

Mecánica de Desconexión de Cables / Flex:

El usuario selecciona la "Espátula".

Toca el conector del cable.

Se ejecuta la animación del cable saltando hacia arriba y quedando libre.

Mecánica de Arrastre y Soltado (Drag & Drop):

Con la mano libre, el usuario hace clic sostenido sobre un componente liberado (ej. Memoria RAM).

Mueve el puntero hacia la mesa de trabajo o hacia el socket.

Si la pieza está cerca de su punto de anclaje correcto y no hay bloqueos, se muestra una silueta brillante. Al soltar el clic, la pieza se "imanta" al lugar exacto.

3. Motor de Física y Bloqueos de Interacción
Para garantizar que el usuario no pueda "atravesar" piezas ni hacer trampa, el sistema valida las acciones en tiempo real:

Intento de Arrastre: El usuario intenta mover la placa madre.

Chequeo de Bloqueos: El sistema revisa si la cuenta de tornillos_restantes es mayor a 0 o si hay cables aún conectados a ella.

Respuesta Visual de Error: Si hay bloqueos, la pieza vibra ligeramente en su lugar, emite un sonido de error y resalta en color rojo los tornillos o cables que falta retirar.

Respuesta de Éxito: Si no hay bloqueos, la pieza se desengancha suavemente y sigue el movimiento del puntero.

4. Distribución Visual de la Pantalla (Layout del Juego)
La pantalla de juego está dividida en cuatro zonas visuales claras:

Zona Central (Espacio de Trabajo Principal): Muestra el dispositivo completo (PC o celular) ampliado en el centro. El usuario puede hacer zoom o rotar el equipo.

Zona Inferior (Barra de Herramientas): Iconos rápidos para seleccionar las herramientas (Destornillador Cruz, Destornillador Torx, Espátula, Ventosa, Pinzas, Mano Libre).

Zona Lateral Derecha (Bandeja / Mesa de Organizador): Espacio donde se van ordenando los componentes y tornillos que el usuario va retirando para no mezclarlos.

Zona Superior (Control y Pistas): Botón para pausar, reiniciar el armado, o activar el "Modo Rayos X / Pistas" que resalta la siguiente pieza que debes quitar si estás atascado.
