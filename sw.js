/* ==========================================================
   SÚPER BARRIO – Service worker
   Estrategia: "primero la caché" (funciona sin internet).
   Cada vez que cambies un archivo de la app, subí VERSION
   (v1 → v2 → v3…) para que los celulares descarguen lo nuevo.
   ========================================================== */

// Versión de la caché. Si la cambiás, el navegador instala un service worker nuevo.
const VERSION = "v3";

// Nombre de la caché: el prefijo identifica a esta app y la versión distingue cada edición.
const NOMBRE_CACHE = "super-barrio-" + VERSION;

// Lista de archivos que se guardan para usar la app sin conexión.
const ARCHIVOS = [
  "./",                  // la carpeta de la app (abre index.html)
  "./index.html",        // la página principal
  "./styles.css",        // los estilos
  "./app.js",            // la lógica de la app
  "./manifest.json",     // los datos para instalar la app
  "./icono-192.png",     // ícono chico
  "./icono-512.png"      // ícono grande
];

// INSTALL: ocurre una sola vez, cuando el navegador detecta este service worker por primera vez.
self.addEventListener("install", function (evento) {
  // waitUntil: le pide al navegador que espere a que termine el trabajo antes de dar por instalado el service worker.
  evento.waitUntil(
    // Abre (o crea) la caché con el nombre de esta versión.
    caches.open(NOMBRE_CACHE).then(function (cache) {
      // Descarga todos los archivos de la lista y los guarda. Si falta uno solo, falla la instalación completa.
      return cache.addAll(ARCHIVOS);
    }) // fin de caches.open
  ); // fin de waitUntil
}); // fin del evento install

// ACTIVATE: ocurre cuando esta versión toma el control, después de instalarse.
self.addEventListener("activate", function (evento) {
  // waitUntil: espera a terminar la limpieza antes de dar por activado el service worker.
  evento.waitUntil(
    // caches.keys devuelve los nombres de todas las cachés guardadas en este sitio.
    caches.keys().then(function (nombres) {
      // Promise.all espera a que se terminen de borrar todas las cachés viejas.
      return Promise.all(
        nombres
          // Se queda solo con las cachés de esta app (empiezan con "super-barrio-")...
          .filter(function (nombre) {
            // ...que no sean la versión actual: esas son las viejas.
            return nombre.startsWith("super-barrio-") && nombre !== NOMBRE_CACHE;
          }) // fin del filter
          // Por cada caché vieja, pide borrarla.
          .map(function (nombre) {
            // delete elimina la caché con ese nombre.
            return caches.delete(nombre);
          }) // fin del map
      ); // fin de Promise.all
    }) // fin de caches.keys
  ); // fin de waitUntil
}); // fin del evento activate

// FETCH: ocurre cada vez que la página pide algo (una página, un estilo, un script, una imagen).
self.addEventListener("fetch", function (evento) {
  // respondWith: nosotros decidimos qué respuesta recibe la página.
  evento.respondWith(
    // Busca en la caché una copia guardada de lo que se pidió.
    caches.match(evento.request).then(function (copia) {
      // Si hay copia, se usa (rápido y sin internet); si no, se busca en internet.
      return copia || fetch(evento.request);
    }) // fin de caches.match
  ); // fin de respondWith
}); // fin del evento fetch
