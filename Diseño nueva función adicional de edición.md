# **Especificación de diseño: Módulo de edición**

Aplicación: PDF Tools \- Suite Local  
Módulo: Editor Visual (Fabric.js)  
Estado: Versión Estable

## **1\. Visión general**

El módulo de edición permite al usuario superponer elementos gráficos (texto, formas, dibujos, imágenes) sobre las páginas de un archivo PDF existente. Funciona bajo el principio de "no destructivo" durante la edición (capas superpuestas) y "aplanado visual" al exportar (renderizado de canvas a imagen incrustada).

**Tecnologías clave:**

* **Visualización PDF:** PDF.js (renderiza el PDF original a un canvas HTML oculto para usarlo de fondo).  
* **Interactividad:** Fabric.js (versión 5.3.1). Maneja la capa de objetos vectorial sobre el fondo.  
* **Manipulación PDF:** PDF-lib. Se usa para la carga inicial y la generación final del archivo.  
* **Estilos:** Tailwind CSS.

## **2\. Arquitectura de interfaz (UI)**

La interfaz se divide en cuatro áreas principales dentro de un contenedor flexible (flex-col). El aspecto y la UX está alineado con el resto de módulos de PDF\_Tools.

### **A. Barra de herramientas superior (Toolbar)**

Situada en la parte superior, contiene los controles globales y de herramientas.

1. **Grupo historial y zoom:**  
   * **Deshacer (Undo):** Revierte la última acción en el canvas actual (gestión de pila de historial JSON). SE admiten CTRL Z/Y.  
   * **Zoom:** Controles (-) y (+) con un indicador porcentual central.  
   * **Ajustar a página:** Redimensiona el lienzo para que quepa completo en el área visible y lo centra en la vista dentro del espacio disponible.  
2. **Grupo herramientas (Selector de modo):**  
   * **Seleccionar:** Puntero por defecto para mover/escalar objetos.  
   * **Pixelar:** Genera un rectángulo con un patrón de ruido aleatorio (mosaico de píxeles) que se puede estirar sin deformar la "imagen" (ya que es un patrón repetitivo). Se envía automáticamente al fondo (\`sendToBack\`) al crearse. Añade una propiedad \`isNoise\` interna para identificarlo. En el panel de propiedades, al seleccionar este objeto, oculta los controles de Relleno, Borde, Opacidad y Orden, dejando solo la opción de Repetir en todas y Eliminar.  
   * **Texto:** Inserta una caja de texto estándar (IText).  
   * **Formas (Dropdown):** Menú desplegable para insertar:  
     * Rectángulo.  
     * Círculo.  
     * Línea.  
     * Cara sonriente  
     * Cara triste  
   * **Dibujar (Mano alzada):** Activa el modo isDrawingMode de Fabric.js.  
3. **Grupo acciones finales:**  
   * **Guardar:** Procesa todas las páginas y descarga el PDF resultante.  
   * **Cerrar (X):** Reinicia el módulo y vuelve a la pantalla de carga.

### **B. Barra lateral izquierda (Navegación)**

* **Contenedor:** Columna fija (visible en escritorio).  
* **Miniaturas:** Lista vertical de canvas pequeños (preview), adaptados a la relación de aspecto de cada página del PDF, en cada miniatura se indica el número de página  
* **Comportamiento:**  
  * Muestra una vista previa de cada página del PDF original, en la que se han integrado de manera dinámica los cambios realizados en el editor en tiempo real   
  * Indica la página activa con un borde azul y fondo resaltado.  
  * Al hacer clic, dispara la función loadEditorPage(n).

### **C. Área de trabajo central (Workspace)**

* **Contenedor:** Área con scroll automático (overflow-auto) y fondo gris neutro.  
* **Lienzo (Canvas Wrapper):** Un contenedor div centrado que aloja el elemento \<canvas\> principal.  
* **Renderizado:**  
  * Fondo: Imagen renderizada por PDF.js de la página actual.  
  * Primer plano: Instancia interactiva de Fabric.js.

### **D. Barra lateral derecha (Propiedades)**

Panel dinámico que cambia su contenido según la selección actual en el canvas.

1. **Estado vacío:** Mensaje "Selecciona un objeto para editarlo".  
2. **Propiedades de texto (cuando se selecciona i-text):**  
   * Edición de contenido (textarea).  
   * Familia tipográfica (Helvetica, Times, Courier).  
   * Tamaño de fuente y color de texto.  
   * Color de fondo de la caja de texto.  
   * Estilos: Negrita (Bold), Cursiva (Italic), Subrayado, Tachado..  
3. **Propiedades de objeto (Formas/Dibujos):**  
   * **Relleno:** Selector de color y checkbox "Sin relleno".  
   * **Borde:** Selector de color y grosor (input numérico).  
   * **Opacidad:** Slider (0 a 1).  
4. **Acciones comunes (Siempre visibles si hay selección):**  
   * **Repetir en todas las páginas:** Checkbox crítico para marcas de agua o firmas.  
   * **Orden (Z-Index):** Botones "Traer al frente" y "Enviar al fondo".  
   * **Eliminar:** Borra el objeto o conjunto de objetos seleccionado. Se admite el uso de la tecla SUPR.

## **3\. Lógica de negocio y comportamiento**

### **Gestión del estado (editorState)**

El editor mantiene un objeto global de estado con:

* doc: Documento PDF-lib cargado.  
* canvas: Instancia de Fabric.js.  
* pagesData: Objeto que almacena el JSON de Fabric.js de cada página editada ({ 1: json, 2: json... }).  
* globalObjects: Array que almacena los objetos marcados como "Repetir en todas".

### **Flujo de cambio de página**

Cuando el usuario cambia de la página A a la página B:

1. **Guardado (Página A):** Se serializa el estado del canvas actual a JSON (canvas.toJSON) y se guarda en pagesData\[A\]. *Nota: Se excluye la imagen de fondo para ahorrar memoria.*  
2. **Detección de globales:** Se filtran los objetos con la propiedad isGlobal \= true y se actualiza el array globalObjects.  
3. **Limpieza:** Se limpia el canvas.  
4. **Renderizado (Página B):**  
   * Se renderiza la página B del PDF original como imagen de fondo.  
   * Se carga el JSON almacenado en pagesData\[B\] (si existe).  
   * **Inyección de globales:** Si existen objetos en globalObjects que no están en la página B, se inyectan dinámicamente.

### **Zoom y ajuste**

* **Zoom:** Se realiza mediante transformación CSS (transform: scale()) aplicada al contenedor del canvas (\#canvas-wrapper). Esto permite un zoom visual rápido sin alterar las coordenadas internas de Fabric.js, aunque puede afectar al scroll nativo en algunas implementaciones.  
* **Ajuste:** Calcula la relación de aspecto entre el área disponible y el tamaño de la página para establecer la escala inicial (Fit to page) y la posición (centrada) en el área de trabajo del panel central

### **Exportación y guardado**

El proceso de "Guardar" es intensivo y sigue estos pasos:

1. Guarda el estado de la página actual en memoria.  
2. Itera sobre todas las páginas del documento original.  
3. Para cada página:  
   * Recupera su JSON específico \+ los objetos globales.  
   * Crea un canvas temporal en memoria (fuera de pantalla).  
   * Renderiza el JSON en ese canvas.  
   * Exporta el canvas a una imagen PNG transparente.  
   * Incrusta esa imagen PNG sobre la página correspondiente del PDF usando pdf-lib.  
4. Genera el Blob del PDF final y dispara la descarga.  
5. **Dispone de la opción de guardar aplanando**: Convierte cada página en imagen al vuelo y genera un PDF, que se descarga finalmente. Esto permite ocultar de manera segura elementos del PDF original. Permite seleccionar la calidad (dpi) de salida (mismos ajustes que en la función de exportar a imagen).

### **Flujos de trabajo entre herramientas**

Al igual que con las herramientas unir, dividir, organizar y exportar a imagen, debe ser posible **enviar el resultado de la edición a otra herramienta** (dividir, organizar, a imagen) **o recibir el resultado del proceso desde otra herramienta** (unir, dividir \-cuando el resultado es un pdf único no comprimido-, organizar,).

## **4\. Detalles de implementación específicos**

### **Manejo de eventos**

* object:modified: Se usa para guardar en el historial de deshacer.  
* object:added: Asigna IDs únicos (crypto.randomUUID()) a los nuevos objetos, crucial para el rastreo de objetos globales.

### **Limitaciones conocidas (Versión actual)**

1. **Edición de texto original:** No se puede editar el texto original del PDF, solo superponer nuevo texto u ocultar el existente con formas (parche).  
2. **Persistencia:** Todo el trabajo se pierde si se recarga la página del navegador (almacenamiento en memoria RAM).

### **Estructura de datos JSON (Ejemplo de objeto)**

{  
  "type": "rect",  
  "left": 100,  
  "top": 100,  
  "width": 50,  
  "height": 50,  
  "fill": "\#ff0000",  
  "id": "uuid-v4...",  
  "isGlobal": true  
}  
