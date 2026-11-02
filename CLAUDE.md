# Cómo trabajar en este repositorio

## Lee primero la especificación

`docs/especificacion.md` es la especificación completa y cerrada del dueño.
Léela entera antes de cambiar nada. Los modelos, catálogos, textos de prompt
literales y errores ya resueltos están ahí. El repositorio de referencia es su
estudio de anime (`Alixonveloz1-ctrl/Anime-AI-Studio`): sus comentarios largos
explican fallos que costaron tiempo; léelos antes de cada fase.

Si algo no está en la especificación, **pregunta**. No asumas ni improvises.

## Al terminar cualquier cambio, da SIEMPRE el enlace de Cloud Shell

El dueño trabaja solo desde un iPhone y cada conversación empieza con Cloud
Shell cerrado. Todo mensaje que anuncie trabajo listo termina con este enlace y
los dos comandos, sin que haga falta pedirlo:

[Abrir Cloud Shell](https://shell.cloud.google.com/?authuser=3&cloudshell_git_repo=https://github.com/Alixonveloz1-ctrl/Drama-AI-Studio&cloudshell_git_branch=main&cloudshell_workspace=.)

```
git pull
./c
```

`authuser=3` es su cuenta de Google: sin ese número Cloud Shell abre otra
cuenta. Cloud Shell no deja pegar texto desde el móvil: lo que teclee tiene que
caber en esas dos líneas y el resto lo hace el instalador (`./c`).

## Trabaja en `main`

Lo pidió expresamente. No dejes el trabajo en una rama aparte.

## Escribe en español llano

Código, comentarios, nombres de archivo y textos de la interfaz en español. Los
prompts a los modelos de imagen y video, en inglés; los de texto, en español.
En las respuestas al dueño: qué arreglaste, qué está hecho y qué tiene que hacer
él. Corto, sin rutas ni nombres de archivo.

## Construcción por fases

Una fase, parar, y decirle qué puede probar desde el teléfono. Él dice si seguir.

1. Esqueleto, instalador, puerta, acceso privado y pantalla de salud — **hecha**.
2. Historia: formulario con el catálogo completo, tres ideas breves, universo y guion por bloques.
3. Personajes, escenarios y sus referencias.
4. Escenas e imágenes: botón por plano, botón de lote y la cola con el manejo de cuotas.
5. Videos: arranque, consulta y audio nativo sin voces.
6. Voces, música y ambiente.
7. Subtítulos alineados y montaje final en Cloud Run.
8. Capa del Sistema, episodios encadenados y export ZIP.

## Mapa del código

- `api/` — endpoints de Vercel (Node.js, nunca Edge; máximo 12 funciones).
  Todos pasan por `api/_lib/puerta.js`: comprueba al propietario antes de
  tocar Google, firma el token de servicio y censura la respuesta.
- `api/_lib/google.js` — credenciales y todos los modelos/regiones por variable de entorno.
- `api/_lib/acceso.js` — inicio de sesión de Google (Firebase) + `STUDIO_ALLOWED_EMAILS`.
- `api/_lib/errores.js` — bloqueo antes que cuota; explicaciones en español.
- `estudio/` — módulos del navegador; `index.html` y `entrar/` las páginas.
- `comun/cors-bucket.json` — la única lista de CORS del bucket (servidor e instalador).
- `instalador/` + `c` — instalador de Cloud Shell (idempotente, todo por número).
- `pruebas/` — `node --test pruebas/*.test.*` y `python3 -m unittest discover -s pruebas -p 'test_*.py'`.

## Lo que no está en la especificación sale del estudio de anime

Antes de preguntar al dueño algo técnico (un modelo, un parámetro, un
límite), búscalo en el repositorio del estudio de anime: él ya lo resolvió
allí y espera que se lea. Ejemplo: la voz usa `gemini-2.5-flash-preview-tts`
(Gemini TTS por Vertex AI, voces `gemini_*`), sacado de su `api/_lib/gcp.js`,
pero SIN el modelo de respaldo que allí se usaba (regla 2.7).

Pregunta solo lo que es una decisión suya (gustos, organización, cuentas).
