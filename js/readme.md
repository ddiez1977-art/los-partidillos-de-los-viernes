# ATP Platinum — fix #2: jornada activa + log venganza

Esta tanda **complementa** los 3 archivos del fix anterior (que ya tienes
en `atp-fix-navegacion/`). Aquí cambian otros 4 archivos por dos bugs
distintos detectados durante la simulación end-to-end:

## 4 archivos modificados (rutas en el proyecto)

```
js/01-config-firebase.js    ← flag _jornadaIniciadaSesion en el listener
js/02-jornada.js            ← iniciarJornada() marca el flag
js/14-cierre-jornada.js     ← cerrarJornada() limpia el flag
js/10-finalizar-partido.js  ← reordenar verificarVenganza antes del bucle
```

## Bug 1: "Jornada activa a veces no aparece"

### Reproducción
Pulsas **INICIAR JORNADA**, todo parece bien, pero al pulsar **JORNADA**
inmediatamente sale **"⚠️ JORNADA REQUERIDA"**.

### Causa raíz
El listener de Firebase (`database.ref('torneoPlatinum').on('value', ...)`)
se dispara muchas veces. En condiciones de red imperfecta puede llegar un
snapshot **antiguo** (sin la `fechaEvento` recién guardada) entre el momento
en que `iniciarJornada()` setea `window.jornadaActiva=true` y el momento en
que `saveDB()` ha persistido el cambio en Firebase.

El listener tenía esta línea:
```js
window.jornadaActiva = (db.fechaEvento === hoy);
```

Si el snapshot viejo trae `fechaEvento: null`, el listener pisa
`jornadaActiva` a `false` aunque la sesión actual la haya iniciado hace
50 ms. El siguiente click en JORNADA pasa por `navegarA()`, ve
`jornadaActiva === false` y bloquea con el banner rojo.

El guard `_guardandoDB > 0` no protegía aquí porque el listener llega
DESPUÉS de que `set()` resolviera (cuando `_guardandoDB` ya volvió a 0)
si Firebase tarda en propagar.

### Fix
Nueva variable `window._jornadaIniciadaSesion` que guarda **la fecha del
día en que ESTA sesión inició la jornada**. El listener ahora razona así:

- Si `db.fechaEvento === hoy` → activa (caso normal: snapshot fresco).
- Si esta sesión inició hoy (`_jornadaIniciadaSesion === hoy`) **pero el
  snapshot está vacío** → mantenemos activa. El propio listener volverá
  a confirmar con el siguiente snapshot real.
- En cualquier otro caso → inactiva (cambio de día, sesión nueva, etc.).

`iniciarJornada()` setea el flag.
`cerrarJornada()` lo limpia. Y al cambiar de día, el flag tampoco
matchea con `hoy`, así que se desactiva sola.

### Verificado en simulación
- ✓ Snapshot viejo intentando pisar: jornada se mantiene activa.
- ✓ Cambio legítimo de día: `jornadaActiva` se vuelve `false`.

## Bug 2: el log "🔥 ¡VENGANZA!" no se rellenaba

### Reproducción
Cuando un jugador con `perdioUltimo=true` ganaba un partido marcado como
de venganza (los del 🔥🔥), `verificarVenganza()` se llamaba pero
**nunca añadía el mensaje** al `window.logVenganzasTV`. El reset del
flag `perdioUltimo` sí se hacía bien (porque está duplicado en el bucle),
pero el log de la TV quedaba vacío.

### Causa raíz
Orden de ejecución en `finalizarPartido()` para modos individual/dobles:

```js
partido.ids.forEach((id, i) => {
    // ...
    jHoy.perdioUltimo = !marcadorVacio && !haGanado && !esEmpate;
    // ↑ Esto pisa el flag a false para los GANADORES.
});

if (partido.esVenganza) {
    verificarVenganza(...);  // Llega aquí con perdioUltimo YA limpio.
}
```

`verificarVenganza()` busca jugadores ganadores con `perdioUltimo=true`
para añadir el log de TV. Como el bucle anterior ya limpió todos los
flags, el `if (jHoy.perdioUltimo)` siempre falla y el log queda vacío.

### Fix
Mover la llamada a `verificarVenganza()` **ANTES** del bucle de
aplicación de puntos, para que lea los flags ORIGINALES.

### Verificado en simulación
```
Test 7 — Venganza:
  log: [ '🔥 ¡VENGANZA! Alice ha recuperado el honor.' ]   ✓
```

## Cómo desplegar

Sustituye estos 4 archivos sobre los que tengas. **No tocar otros.**
La fix anterior (`atp-fix-navegacion/`) sigue siendo válida y necesaria.

## Resto de la simulación

Como referencia, estos modos quedaron verificados matemáticamente:

| Modo | Resultado | Puntos esperados | OK |
|---|---|---|---|
| Dobles 6-3 | Ganadores +3, perdedores +1 | ✓ |
| Individual 6-4 | +3 / +1 | ✓ |
| Tie-break 5-5 (TB 7-5) | Gana quien gana TB | ✓ |
| Gamificado (7,4,4,1) | +3 / +2 / +2 / +1 | ✓ |
| Anular sin finalizar | 0 cambios en pts, jugadores liberados | ✓ |
| Venganza (Alice perdió, gana 6-4) | +3, flag limpio, **log pintado** | ✓ |
| Australiana (12, 8, 4) | +3 / +1 / +1 | ✓ |
| Plan Maestro V1 | Genera bloques | ✓ |
| Plan Maestro V2 | Genera bloques | ✓ |
| Aplicar plan a pistas | Crea partidos | ✓ |
