# Cómo añadir y ajustar un bioma

Copia una hoja PNG de esta carpeta y una entrada de js/data/biomes.json. En tileset escribe la ruta exacta del archivo. El campo name es el nombre visible en español e id identifica la entrada. Las hojas comparten la disposición siguiente, de izquierda a derecha.

| Grupo | Contenido |
| --- | --- |
| 1 | Leyenda de conectividad |
| 2–6 | Muro base y hasta cuatro alternativas |
| 7–9 | Suelo base y dos grupos de suelos alternativos |
| 10–11 | Dibujos de reserva |
| 12–14 | Base de la orilla, agua y brillos de agua |
| 15 | Lava |
| 16–18 | Vacío y dos alternativas |

Cada grupo ocupa 75 píxeles de ancho. Contiene tres columnas de casillas de 24 × 24 con separadores de un píxel. El motor lee la primera pieza en x=9, y=altura−607. Conserva la leyenda, la altura desde el borde inferior y el fondo de plantilla en los huecos. Cada configuración válida señala el centro en blanco y los vecinos conectados en negro.

**Suelo.** Cada piso sortea una vez por casilla entre los dibujos distintos de los tres grupos de suelo. Todos tienen el mismo peso. Un dibujo repetido en varias posiciones del atlas cuenta una vez. La posición de los muros no interviene.

**Muros y medios.** La máscara se calcula sobre vecinos del mismo material. Una diagonal requiere las dos conexiones ortogonales. El motor intenta una alternativa en el 12 por ciento de las casillas de obstáculo. Si hay alternativas para esa máscara, compone una sobre la base. Un brillo de agua se superpone siempre que exista una pieza para esa máscara y avanza con su paleta.

**Paletas.** Los bancos a la derecha tienen 16 muestras por fila. La primera fila contiene los colores originales. Las siguientes son fases de animación. El agua y sus brillos tienen capas separadas. El brillo usa el último banco de la hoja. paletteStepMs indica el intervalo de las fases en milisegundos (133 por defecto). sparkleStepMs permite un ritmo propio para los brillos.

**Generación.** El piso tiene 44 × 34 casillas. El tipo de misión fija los valores iniciales de pasillos, habitaciones y cruces. layoutModifier suma los ajustes del bioma. El generador limita cada complejidad a 1–5, distribuye habitaciones y cruces y conecta sus centros. mediumFrequency sortea una vez por piso si habrá medio adicional. En los pisos seleccionados, mediumDensity (0,35 por defecto) controla la probabilidad por parche interior. wallMaterial indica el dibujo de los muros si son abismo. Un valor de 0 conserva sólo muros. canCross permite que las especies con la habilidad indicada atraviesen ese medio. La arena de líder es una habitación independiente.

**Encuentros.** level va de 1 a 10 e influye en la selección del bioma, los pisos y los encuentros. El tablón favorece los niveles próximos a la dificultad del encargo. Desde la misión 24 toma como referencia el nivel 5 y suma un nivel por cada cinco misiones. wild y leaders admiten nombres de js/data/pokemon.json. La franja depende de la misión (1–8, 9–16, 17–25, 26–36 o 37–50). Un fallo mantiene la misma dificultad para el siguiente encargo. La misión 24 admite todos los niveles de bioma. Antes de la 24 sólo aparecen niveles 1–4 y desde la 25 sólo niveles 5–10. Las dos fases de paleta avanzan al 80% de la frecuencia definida.
