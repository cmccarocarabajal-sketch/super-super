/* ==========================================================
   REGISTRO DE USO DE IA
   Herramienta: Claude (Anthropic) – modelo Claude Sonnet 5.5
   Fecha de generación: 24/10/2026
   Alcance: estructura de datos, almacenamiento y lógica del sistema
            de stock "Súper Barrio".
   Revisado y aprobado por: ______________________
   ========================================================== */
(function () {
  "use strict";

  /* ---------- Datos ----------
     categorias:  { id, nombre }
     productos:   { codigo, nombre, categoria, unidad, precio, stock, minimo }
                  (categoria guarda el nombre de la categoría)
     movimientos: { codigo, nombre, tipo, motivo, cantidad, fecha, observacion }
                  (tipo: "entrada" | "salida"; fecha: AAAA-MM-DD) */
  var categorias = [];
  var productos = [];
  var movimientos = [];

  var CLAVE = "stock-datos";

  var CATEGORIAS_INICIALES = ["Almacén", "Lácteos", "Limpieza", "Bebidas"];

  // Códigos de 13 dígitos (EAN-13) que empiezan con 779
  var PRODUCTOS_INICIALES = [
    { codigo: "7790001000019", nombre: "Arroz largo fino 1 kg",       categoria: "Almacén",  unidad: "kg",     precio: 2150, stock: 48,  minimo: 20 },
    { codigo: "7790001000026", nombre: "Fideos tirabuzón 500 g",      categoria: "Almacén",  unidad: "pack",   precio: 1380, stock: 15,  minimo: 20 },
    { codigo: "7790002000018", nombre: "Leche entera 1 L",            categoria: "Lácteos",  unidad: "l",      precio: 1450, stock: 60,  minimo: 30 },
    { codigo: "7790002000025", nombre: "Yogur firme vainilla 190 g",  categoria: "Lácteos",  unidad: "unidad", precio: 890,  stock: 0,   minimo: 12 },
    { codigo: "7790003000017", nombre: "Detergente lavavajillas 750 ml", categoria: "Limpieza", unidad: "unidad", precio: 2890, stock: 25, minimo: 10 },
    { codigo: "7790003000024", nombre: "Lavandina 1 L",               categoria: "Limpieza", unidad: "l",      precio: 1250, stock: 30,  minimo: 10 },
    { codigo: "7790004000016", nombre: "Agua mineral 2 L",            categoria: "Bebidas",  unidad: "unidad", precio: 1190, stock: 100, minimo: 40 },
    { codigo: "7790004000023", nombre: "Gaseosa cola 2,25 L",         categoria: "Bebidas",  unidad: "unidad", precio: 2480, stock: 36,  minimo: 20 }
  ];

  /* ---------- Utilidades ---------- */
  function $(id) { return document.getElementById(id); }

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function hoy() {
    var f = new Date();
    var mes = String(f.getMonth() + 1).padStart(2, "0");
    var dia = String(f.getDate()).padStart(2, "0");
    return f.getFullYear() + "-" + mes + "-" + dia;
  }

  function formatoFecha(iso) {
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : iso;
  }

  function formatoPrecio(n) {
    return Number(n).toLocaleString("es-AR", { style: "currency", currency: "ARS" });
  }

  function formatoNumero(n) {
    return Number(n).toLocaleString("es-AR", { maximumFractionDigits: 3 });
  }

  // Minúsculas, sin tildes y sin espacios de más: para comparar nombres y códigos
  function normalizar(t) {
    return String(t).trim().replace(/\s+/g, " ").toLowerCase()
      .normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function nuevoId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  /* ---------- Almacenamiento (localStorage, clave "stock-datos") ---------- */
  function guardar() {
    try {
      localStorage.setItem(CLAVE, JSON.stringify({
        categorias: categorias,
        productos: productos,
        movimientos: movimientos
      }));
    } catch (e) {
      alert("No se pudo guardar en el navegador.");
    }
  }

  function cargarIniciales() {
    categorias = CATEGORIAS_INICIALES.map(function (nombre) {
      return { id: nuevoId(), nombre: nombre };
    });
    productos = PRODUCTOS_INICIALES.map(function (p) { return Object.assign({}, p); });
    movimientos = [];
    guardar();
  }

  function cargar() {
    var crudo = null;
    try { crudo = localStorage.getItem(CLAVE); } catch (e) { crudo = null; }

    if (crudo) {
      try {
        var d = JSON.parse(crudo);
        if (Array.isArray(d.categorias) && Array.isArray(d.productos) && Array.isArray(d.movimientos)) {
          categorias = d.categorias;
          productos = d.productos;
          movimientos = d.movimientos;
          return;
        }
      } catch (e) { /* datos dañados: se vuelve a los iniciales */ }
    }
    // Si no hay datos, se cargan las categorías y los productos de ejemplo
    cargarIniciales();
  }

  /* ---------- Estado del stock ---------- */
  // "sin stock" si es 0, "bajo" si es menor o igual al mínimo, "normal" en otro caso
  function estadoDe(p) {
    if (p.stock <= 0) return "sin";
    if (p.stock <= p.minimo) return "bajo";
    return "ok";
  }

  var TEXTO_ESTADO = { ok: "Normal", bajo: "Bajo", sin: "Sin stock" };

  function buscarProducto(codigo) {
    var c = normalizar(codigo);
    for (var i = 0; i < productos.length; i++) {
      if (normalizar(productos[i].codigo) === c) return productos[i];
    }
    return null;
  }

  /* ---------- Menú ---------- */
  function mostrarSeccion(id) {
    document.querySelectorAll(".seccion").forEach(function (s) {
      s.classList.toggle("activa", s.id === id);
    });
    document.querySelectorAll(".menu-btn").forEach(function (b) {
      b.classList.toggle("activo", b.dataset.seccion === id);
    });
    window.scrollTo(0, 0);
  }

  /* ---------- Categorías: alta, edición y baja ---------- */
  var catEditandoId = null;
  var btnCancelarCat = null;

  function buscarCategoriaPorId(id) {
    for (var i = 0; i < categorias.length; i++) {
      if (categorias[i].id === id) return categorias[i];
    }
    return null;
  }

  function productosDeCategoria(nombre) {
    return productos.filter(function (p) { return p.categoria === nombre; });
  }

  // Nombre repetido (sin distinguir mayúsculas ni tildes), ignorando la que se edita
  function nombreRepetido(nombre, ignorarId) {
    var n = normalizar(nombre);
    return categorias.some(function (c) {
      return c.id !== ignorarId && normalizar(c.nombre) === n;
    });
  }

  function salirEdicionCategoria() {
    catEditandoId = null;
    $("form-categoria").reset();
    document.querySelector("#form-categoria button[type='submit']").textContent = "Agregar categoría";
    btnCancelarCat.hidden = true;
  }

  function renderCategorias() {
    var lista = $("lista-categorias");
    if (categorias.length === 0) {
      lista.innerHTML = '<li class="vacio">Todavía no hay categorías.</li>';
    } else {
      lista.innerHTML = categorias.map(function (c) {
        var usos = productosDeCategoria(c.nombre).length;
        return '<li><span>🏷️ ' + escapar(c.nombre) + ' <small>(' + usos + ' producto' + (usos === 1 ? "" : "s") + ')</small></span>' +
          '<span class="botones-form">' +
          '<button type="button" class="btn-editar" data-accion="editar-categoria" data-id="' + escapar(c.id) + '">Editar</button>' +
          '<button type="button" class="btn-peligro" data-accion="borrar-categoria" data-id="' + escapar(c.id) + '">Eliminar</button>' +
          "</span></li>";
      }).join("");
    }

    var opciones = categorias.map(function (c) {
      return '<option value="' + escapar(c.nombre) + '">' + escapar(c.nombre) + "</option>";
    }).join("");

    var selForm = $("prod-categoria");
    var selFiltro = $("filtro-categoria");
    var valForm = selForm.value;
    var valFiltro = selFiltro.value;

    selForm.innerHTML = '<option value="">Seleccionar…</option>' + opciones;
    selFiltro.innerHTML = '<option value="">Todas</option>' + opciones;

    selForm.value = valForm;
    selFiltro.value = valFiltro;
  }

  // Botón "Cancelar" que solo aparece mientras se edita una categoría
  btnCancelarCat = document.createElement("button");
  btnCancelarCat.type = "button";
  btnCancelarCat.textContent = "Cancelar";
  btnCancelarCat.hidden = true;
  btnCancelarCat.style.background = "#E9ECF0";
  btnCancelarCat.style.color = "inherit";
  document.querySelector("#form-categoria .botones-form").appendChild(btnCancelarCat);
  btnCancelarCat.addEventListener("click", salirEdicionCategoria);

  $("form-categoria").addEventListener("submit", function (e) {
    e.preventDefault();
    var nombre = $("cat-nombre").value.trim().replace(/\s+/g, " ");

    if (!nombre) {
      alert("El nombre de la categoría es obligatorio.");
      return;
    }
    if (nombreRepetido(nombre, catEditandoId)) {
      alert("Ya existe una categoría llamada «" + nombre + "».");
      return;
    }

    if (catEditandoId) {
      var cat = buscarCategoriaPorId(catEditandoId);
      if (cat) {
        var anterior = cat.nombre;
        cat.nombre = nombre;
        // Los productos guardan el nombre de la categoría: se actualizan también
        productos.forEach(function (p) {
          if (p.categoria === anterior) p.categoria = nombre;
        });
      }
      guardar();
      salirEdicionCategoria();
      renderTodo();
    } else {
      categorias.push({ id: nuevoId(), nombre: nombre });
      guardar();
      this.reset();
      renderTodo();
    }
  });

  $("lista-categorias").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-accion]");
    if (!btn) return;
    var cat = buscarCategoriaPorId(btn.dataset.id);
    if (!cat) return;

    if (btn.dataset.accion === "editar-categoria") {
      catEditandoId = cat.id;
      $("cat-nombre").value = cat.nombre;
      document.querySelector("#form-categoria button[type='submit']").textContent = "Guardar cambios";
      btnCancelarCat.hidden = false;
      $("cat-nombre").focus();
      $("form-categoria").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (btn.dataset.accion === "borrar-categoria") {
      var cantidad = productosDeCategoria(cat.nombre).length;
      if (cantidad > 0) {
        alert("No se puede eliminar «" + cat.nombre + "»: tiene " + cantidad + " producto" + (cantidad === 1 ? "" : "s") + ".");
        return;
      }
      if (!confirm("¿Eliminar la categoría «" + cat.nombre + "»?")) return;
      categorias = categorias.filter(function (c) { return c !== cat; });
      if (catEditandoId === cat.id) salirEdicionCategoria();
      guardar();
      renderTodo();
    }
  });

  /* ---------- Productos ---------- */
  function renderProductos() {
    var texto = normalizar($("buscador").value);
    var cat = $("filtro-categoria").value;
    var est = $("filtro-estado").value;

    var filtrados = productos.filter(function (p) {
      if (texto && normalizar(p.codigo).indexOf(texto) === -1 && normalizar(p.nombre).indexOf(texto) === -1) return false;
      if (cat && p.categoria !== cat) return false;
      if (est && estadoDe(p) !== est) return false;
      return true;
    });

    var cuerpo = document.querySelector("#tabla-productos tbody");
    if (filtrados.length === 0) {
      var msg = productos.length === 0 ? "Todavía no hay productos cargados." : "No hay productos que coincidan con la búsqueda.";
      cuerpo.innerHTML = '<tr><td colspan="8" class="vacio">' + msg + "</td></tr>";
      return;
    }

    cuerpo.innerHTML = filtrados.map(function (p) {
      var e = estadoDe(p);
      return "<tr>" +
        "<td>" + escapar(p.codigo) + "</td>" +
        "<td>" + escapar(p.nombre) + "</td>" +
        "<td>" + escapar(p.categoria) + "</td>" +
        "<td>" + formatoPrecio(p.precio) + "</td>" +
        "<td>" + formatoNumero(p.stock) + "</td>" +
        "<td>" + formatoNumero(p.minimo) + "</td>" +
        '<td><span class="estado estado-' + e + '">' + TEXTO_ESTADO[e] + "</span></td>" +
        '<td><button type="button" class="btn-editar" data-accion="editar" data-codigo="' + escapar(p.codigo) + '">Editar</button> ' +
        '<button type="button" class="btn-peligro" data-accion="borrar" data-codigo="' + escapar(p.codigo) + '">Eliminar</button></td>' +
        "</tr>";
    }).join("");
  }

  // Entero no negativo escrito solo con dígitos ("0", "12"; no "1.5", "-3" ni vacío)
  function esEnteroNoNegativo(texto) {
    return /^\d+$/.test(String(texto).trim());
  }

  // Al editar, el stock actual se muestra pero no se puede cambiar desde acá
  function modoEdicionProducto(activo) {
    $("prod-codigo").readOnly = activo;
    $("prod-stock").disabled = activo;
    document.querySelector("label[for='prod-stock']").textContent =
      activo ? "Stock actual (solo cambia con movimientos)" : "Stock inicial";
    document.querySelector("#form-producto button[type='submit']").textContent =
      activo ? "Guardar cambios" : "Guardar producto";
    if (!activo) $("producto-editando").value = "";
  }

  function salirDeEdicion() {
    modoEdicionProducto(false);
  }

  $("form-producto").addEventListener("submit", function (e) {
    e.preventDefault();

    var editando = $("producto-editando").value;
    var codigo = $("prod-codigo").value.trim();
    var nombre = $("prod-nombre").value.trim();
    var categoria = $("prod-categoria").value;
    var unidad = $("prod-unidad").value;
    var precio = parseFloat($("prod-precio").value);
    var textoMinimo = $("prod-minimo").value;
    var textoStock = $("prod-stock").value;

    // Código: de 8 a 13 dígitos y único (al editar no cambia)
    if (!editando) {
      if (!/^\d{8,13}$/.test(codigo)) {
        alert("El código debe tener entre 8 y 13 dígitos (solo números).");
        return;
      }
      if (buscarProducto(codigo)) {
        alert("Ya existe un producto con el código " + codigo + ".");
        return;
      }
    }
    if (!nombre) {
      alert("El nombre es obligatorio.");
      return;
    }
    if (!categoria) {
      alert("Elegí una categoría.");
      return;
    }
    if (!unidad) {
      alert("Elegí una unidad.");
      return;
    }
    if (isNaN(precio) || precio <= 0) {
      alert("El precio debe ser mayor que cero.");
      return;
    }
    if (!editando && !esEnteroNoNegativo(textoStock)) {
      alert("El stock inicial debe ser un número entero mayor o igual a 0.");
      return;
    }
    if (!esEnteroNoNegativo(textoMinimo)) {
      alert("El stock mínimo debe ser un número entero mayor o igual a 0.");
      return;
    }

    var minimo = parseInt(textoMinimo, 10);

    if (editando) {
      // El stock actual no se toca: solo cambia con movimientos
      var prod = buscarProducto(editando);
      if (prod) {
        prod.nombre = nombre;
        prod.categoria = categoria;
        prod.unidad = unidad;
        prod.precio = precio;
        prod.minimo = minimo;
      }
    } else {
      productos.push({
        codigo: codigo, nombre: nombre, categoria: categoria, unidad: unidad,
        precio: precio, stock: parseInt(textoStock, 10), minimo: minimo
      });
    }

    guardar();
    this.reset();
    salirDeEdicion();
    renderTodo();
  });

  $("form-producto").addEventListener("reset", salirDeEdicion);

  $("tabla-productos").addEventListener("click", function (e) {
    var btn = e.target.closest("button[data-accion]");
    if (!btn) return;
    var prod = buscarProducto(btn.dataset.codigo);
    if (!prod) return;

    if (btn.dataset.accion === "editar") {
      $("producto-editando").value = prod.codigo;
      $("prod-codigo").value = prod.codigo;
      $("prod-nombre").value = prod.nombre;
      $("prod-categoria").value = prod.categoria;
      $("prod-unidad").value = prod.unidad;
      $("prod-precio").value = prod.precio;
      $("prod-stock").value = prod.stock;
      $("prod-minimo").value = prod.minimo;
      modoEdicionProducto(true);
      $("form-producto").scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (btn.dataset.accion === "borrar") {
      if (!confirm("¿Eliminar el producto «" + prod.nombre + "»? El historial de movimientos se conserva.")) return;
      productos = productos.filter(function (p) { return p !== prod; });
      guardar();
      renderTodo();
    }
  });

  ["buscador", "filtro-categoria", "filtro-estado"].forEach(function (id) {
    $(id).addEventListener("input", renderProductos);
    $(id).addEventListener("change", renderProductos);
  });

  /* ---------- Movimientos ---------- */
  function renderListaCodigos() {
    $("lista-codigos").innerHTML = productos.map(function (p) {
      return '<option value="' + escapar(p.codigo) + '">' + escapar(p.nombre) + "</option>";
    }).join("");
  }

  function renderMovimientos() {
    var cuerpo = document.querySelector("#tabla-movimientos tbody");
    if (movimientos.length === 0) {
      cuerpo.innerHTML = '<tr><td colspan="7" class="vacio">Todavía no hay movimientos registrados.</td></tr>';
      return;
    }

    var ordenados = movimientos.map(function (m, i) { return { m: m, i: i }; });
    ordenados.sort(function (a, b) {
      if (a.m.fecha !== b.m.fecha) return a.m.fecha < b.m.fecha ? 1 : -1;
      return b.i - a.i;
    });

    cuerpo.innerHTML = ordenados.map(function (o) {
      var m = o.m;
      var etiqueta = m.tipo === "entrada" ? "Entrada" : "Salida";
      return "<tr>" +
        "<td>" + formatoFecha(m.fecha) + "</td>" +
        "<td>" + escapar(m.codigo) + "</td>" +
        "<td>" + escapar(m.nombre) + "</td>" +
        '<td><span class="tipo-' + m.tipo + '">' + etiqueta + "</span></td>" +
        "<td>" + escapar(m.motivo) + "</td>" +
        "<td>" + formatoNumero(m.cantidad) + "</td>" +
        "<td>" + escapar(m.observacion || "") + "</td>" +
        "</tr>";
    }).join("");
  }

  $("form-movimiento").addEventListener("submit", function (e) {
    e.preventDefault();

    var codigo = $("mov-codigo").value.trim();
    var tipo = $("mov-tipo").value;
    var motivo = $("mov-motivo").value.trim();
    var cantidad = parseFloat($("mov-cantidad").value);
    var fecha = $("mov-fecha").value;
    var observacion = $("mov-observacion").value.trim();

    var prod = buscarProducto(codigo);
    if (!prod) {
      alert("No existe ningún producto con el código «" + codigo + "».");
      return;
    }
    if (!tipo || !motivo || !fecha) {
      alert("Completá tipo, motivo y fecha.");
      return;
    }
    if (isNaN(cantidad) || cantidad <= 0) {
      alert("La cantidad debe ser mayor a 0.");
      return;
    }
    if (tipo === "salida" && cantidad > prod.stock) {
      alert("Stock insuficiente: hay " + formatoNumero(prod.stock) + " " + prod.unidad + " de «" + prod.nombre + "».");
      return;
    }

    prod.stock = tipo === "entrada" ? prod.stock + cantidad : prod.stock - cantidad;

    movimientos.push({
      codigo: prod.codigo, nombre: prod.nombre, tipo: tipo, motivo: motivo,
      cantidad: cantidad, fecha: fecha, observacion: observacion
    });

    guardar();
    this.reset();
    $("mov-fecha").value = hoy();
    renderTodo();
  });

  $("form-movimiento").addEventListener("reset", function () {
    setTimeout(function () { $("mov-fecha").value = hoy(); }, 0);
  });

  /* ---------- Alertas ---------- */
  // Cantidad sugerida para pedir: el doble del mínimo menos el stock actual
  function cantidadSugerida(p) {
    return 2 * p.minimo - p.stock;
  }

  // Urgencia: primero los sin stock (los de mayor mínimo antes) y después los
  // que están en el mínimo o por debajo, del más vacío (stock / mínimo) al menos vacío
  function ordenarPorUrgencia(a, b) {
    var sinA = estadoDe(a) === "sin";
    var sinB = estadoDe(b) === "sin";
    if (sinA !== sinB) return sinA ? -1 : 1;
    if (sinA) return b.minimo - a.minimo;
    return (a.stock / a.minimo) - (b.stock / b.minimo);
  }

  // Se vuelve a dibujar cada vez que cambia el stock (movimientos, edición,
  // baja o importación), por eso el contador del menú siempre está al día
  function renderAlertas() {
    var alertas = productos.filter(function (p) { return estadoDe(p) !== "ok"; });
    alertas.sort(ordenarPorUrgencia);

    $("contador-alertas").textContent = alertas.length;
    $("contador-alertas").hidden = alertas.length === 0;

    var lista = $("lista-alertas");
    if (alertas.length === 0) {
      lista.innerHTML = '<li class="vacio">✅ Todo el stock está en orden</li>';
      return;
    }

    lista.innerHTML = alertas.map(function (p) {
      var e = estadoDe(p);
      var sugerida = cantidadSugerida(p);
      var pedir = sugerida > 0 ? formatoNumero(sugerida) + " " + escapar(p.unidad) : "—";
      return '<li class="alerta-' + e + '">' +
        "<span><strong>" + escapar(p.nombre) + "</strong> · " + escapar(p.codigo) +
        '<br><small><span class="estado estado-' + e + '">' + TEXTO_ESTADO[e] + "</span> " +
        "Stock actual: " + formatoNumero(p.stock) + " · Mínimo: " + formatoNumero(p.minimo) + "</small></span>" +
        '<span class="pedido"><small>Pedir</small><br><strong>' + pedir + "</strong></span></li>";
    }).join("");
  }

  /* ---------- Exportar / Importar ---------- */
  $("btn-exportar").addEventListener("click", function () {
    var datos = { categorias: categorias, productos: productos, movimientos: movimientos };
    var blob = new Blob([JSON.stringify(datos, null, 2)], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "stock.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  });

  $("btn-importar").addEventListener("click", function () {
    $("archivo-importar").click();
  });

  function esTexto(v) { return typeof v === "string" && v.trim() !== ""; }
  function esNumero(v) { return typeof v === "number" && isFinite(v); }

  // Devuelve un mensaje de error, o "" si el archivo tiene todas las listas
  // esperadas y cada elemento trae los campos necesarios
  function validarDatos(d) {
    if (!d || typeof d !== "object" || Array.isArray(d)) {
      return "el contenido no tiene el formato esperado.";
    }
    var listas = ["categorias", "productos", "movimientos"];
    for (var i = 0; i < listas.length; i++) {
      if (!Array.isArray(d[listas[i]])) return "falta la lista «" + listas[i] + "».";
    }

    var catsOk = d.categorias.every(function (c) {
      return esTexto(c) || (c && typeof c === "object" && esTexto(c.nombre));
    });
    if (!catsOk) return "hay categorías sin nombre.";

    var codigos = {};
    var prodsOk = d.productos.every(function (p) {
      if (!p || typeof p !== "object" || !esTexto(p.codigo) || !esTexto(p.nombre) ||
          !esTexto(p.categoria) || !esTexto(p.unidad) ||
          !esNumero(p.precio) || !esNumero(p.stock) || !esNumero(p.minimo)) return false;
      var clave = normalizar(p.codigo);
      if (codigos[clave]) return false;
      codigos[clave] = true;
      return true;
    });
    if (!prodsOk) return "hay productos incompletos o con el código repetido.";

    var movsOk = d.movimientos.every(function (m) {
      return m && typeof m === "object" && esTexto(m.codigo) && esTexto(m.nombre) &&
        (m.tipo === "entrada" || m.tipo === "salida") && esTexto(m.motivo) &&
        esNumero(m.cantidad) && esTexto(m.fecha);
    });
    if (!movsOk) return "hay movimientos incompletos.";

    return "";
  }

  $("archivo-importar").addEventListener("change", function () {
    var archivo = this.files[0];
    var input = this;
    if (!archivo) return;

    var lector = new FileReader();

    lector.onload = function () {
      var d;
      try {
        d = JSON.parse(lector.result);
      } catch (err) {
        alert("No se importó nada: el archivo no es un JSON válido.");
        return;
      }

      var error = validarDatos(d);
      if (error) {
        alert("No se importó nada: " + error);
        return;
      }

      var mensaje = "El archivo tiene " + d.categorias.length + " categorías, " +
        d.productos.length + " productos y " + d.movimientos.length + " movimientos.\n\n" +
        "Esto reemplaza todos los datos actuales. ¿Continuar?";
      if (!confirm(mensaje)) return;

      // Acepta categorías como texto o como objetos { id, nombre }
      categorias = d.categorias.map(function (c) {
        return typeof c === "string"
          ? { id: nuevoId(), nombre: c.trim() }
          : { id: c.id || nuevoId(), nombre: c.nombre.trim() };
      });
      productos = d.productos;
      movimientos = d.movimientos;

      salirEdicionCategoria();
      $("form-producto").reset();
      guardar();
      renderTodo();
      alert("Datos importados correctamente.");
    };

    lector.onerror = function () {
      alert("No se importó nada: no se pudo leer el archivo.");
    };

    lector.readAsText(archivo);
    input.value = "";
  });

  /* ---------- Inicio ---------- */
  function renderTodo() {
    renderCategorias();
    renderProductos();
    renderListaCodigos();
    renderMovimientos();
    renderAlertas();
  }

  document.querySelector(".menu").addEventListener("click", function (e) {
    var btn = e.target.closest(".menu-btn");
    if (btn) mostrarSeccion(btn.dataset.seccion);
  });

  cargar();
  $("mov-fecha").value = hoy();
  renderTodo();
})();

// Registrar el service worker solo si el navegador lo admite
if ("serviceWorker" in navigator) {
  window.addEventListener("load", function () {
    navigator.serviceWorker.register("./sw.js");
  });
}
