# Especificación funcional de Kingdog of Electronics

## 1. Páginas y selector

- `index.html` contiene el selector de equipos.
- El selector conduce a `smartphone.html` o `pc.html`. Desde cada simulador hay un control para regresar al selector.
- `app.js` controla el simulador del teléfono y `pc.js` controla el de la torre. Cada página mantiene su propio estado.

## 2. Simulador del teléfono

El modelo del teléfono cuenta con 15 módulos, 14 tornillos, seis conectores flex y 26 acciones para cada objetivo. En `app.js` se encuentran los identificadores y las reglas de dependencia. Los chips de la placa base se muestran como parte de esa pieza y no se arrastran individualmente.

## 3. Simulador de la torre ATX

### Módulos (11)

| Identificador | Componente |
| --- | --- |
| `sidePanel` | Panel lateral opaco de acero |
| `gpu` | Tarjeta gráfica |
| `ram1`, `ram2` | Dos módulos de memoria RAM |
| `cooler` | Disipador y ventilador del procesador |
| `cpu` | Procesador |
| `ssd` | Unidad SSD M.2 NVMe |
| `frontFan`, `rearFan` | Ventiladores frontal y trasero |
| `motherboard` | Placa base ATX |
| `psu` | Fuente de poder ATX |

### Tornillos (23)

- Panel lateral: 2.
- Tarjeta gráfica: 2.
- Disipador: 4.
- SSD M.2: 1.
- Ventilador frontal: 2.
- Ventilador trasero: 2.
- Placa base: 6.
- Fuente de poder: 4.

### Conexiones y seguro (7)

El modelo incluye la alimentación de la tarjeta gráfica, la conexión del ventilador del procesador, la palanca del socket del procesador, las conexiones de los ventiladores frontal y trasero, el cable EPS y el conector ATX de 24 pines. La palanca del socket se manipula con el mismo control de herramienta que las conexiones para conservar una secuencia de interacción uniforme.

## 4. Estado, dependencias y pasos

Cada simulador mantiene por separado el estado de instalación de sus módulos, los tornillos y las conexiones. También registra las piezas de la bandeja, el progreso, el cronómetro y los errores.

- En la torre, primero se retira el panel lateral. Este no se puede volver a instalar hasta que los módulos, las conexiones y las fijaciones internas estén en su lugar.
- La tarjeta gráfica se retira antes de acceder a la memoria y al SSD. El disipador debe retirarse antes de liberar el procesador.
- La placa base se retira después de quitar sus módulos asociados y desconectar sus cables. La fuente de poder se desmonta después de la placa base.
- Durante el montaje, primero se instalan la fuente y la placa base. Luego se añaden las conexiones y los módulos; el panel lateral se coloca al final.
- Cada objetivo guiado tiene 26 acciones. El progreso se calcula a partir del estado actual de las piezas, los tornillos y las conexiones.
- Cuando una acción no está permitida, el simulador muestra el requisito pendiente y resalta los elementos relacionados.
- Al reiniciar, se restauran los módulos, las conexiones, los tornillos, el progreso y el contenido de la bandeja.

## 5. Interacciones

- **Destornillador:** al mantenerlo sobre un tornillo durante aproximadamente 550 milisegundos, se completa la acción. Los tornillos retirados se cuentan en la bandeja.
- **Espátula:** al presionar sobre una conexión accesible, se alterna entre los estados conectado y desconectado. Los conectores aceptan Enter y Espacio y actualizan el atributo `aria-pressed`.
- **Mano libre:** al presionar sobre un módulo permitido, comienza el arrastre. El movimiento del puntero desplaza una copia visual de la pieza; al soltarla, se guarda o se instala. La acción se cancela si el puntero se interrumpe.
- Las piezas retiradas se pueden dejar en la bandeja o en una zona libre junto al equipo. Para instalarlas, se considera que están cerca del alojamiento cuando la distancia es menor que `max(50 px, min(ancho, alto) × 0.5)`.
- El modo guía, el modo libre, las pistas, la pausa, el reinicio, el cronómetro y los mensajes funcionan de forma independiente en cada simulador.

## 6. Información contextual y accesibilidad

- Los rótulos decorativos no permanecen superpuestos sobre los componentes.
- Al pasar el cursor por un módulo, una conexión o una pieza de la bandeja, aparece una ficha con su nombre y descripción. La ficha sigue al cursor y se mantiene dentro de los límites de la pantalla.
- Los elementos que reciben el foco del teclado también pueden mostrar la ficha. El atributo `aria-describedby` relaciona el elemento activo con la información contextual.
- Los mensajes de progreso y de bloqueo se anuncian mediante una región `aria-live`. El color no es el único medio para comunicar el estado.

## 7. Adaptación a distintas pantallas

Las páginas del selector y de los simuladores se adaptan a pantallas pequeñas y grandes. En los simuladores, el área de trabajo y la bandeja cambian su distribución de acuerdo con el ancho y la orientación de la pantalla. Las interacciones usan Pointer Events para funcionar con ratón, lápiz y pantallas táctiles.
