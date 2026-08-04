/* Fruktela — landing
   El menú de celular, el botón flotante de WhatsApp y la atribución de los
   visitantes que llegan desde la página de pedidos de un negocio.
   Todo el contenido funciona sin JavaScript. */
(function () {
  'use strict';

  /* ---------- Menú de celular ---------- */
  var toggle = document.getElementById('menu-toggle');
  var menu = document.getElementById('menu-movil');

  if (toggle && menu) {
    // El estado abierto/cerrado vive en una clase, no en el atributo hidden,
    // para que la transición de CSS pueda animarlo. Cerrado queda con
    // visibility:hidden, así que tampoco es alcanzable con el tabulador.
    var estaAbierto = function () { return menu.classList.contains('abierto'); };

    var abrir = function (abierto) {
      toggle.setAttribute('aria-expanded', String(abierto));
      toggle.setAttribute('aria-label', abierto ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('abierto', abierto);
    };

    toggle.addEventListener('click', function (evento) {
      evento.stopPropagation();
      abrir(!estaAbierto());
    });

    // Al tocar un enlace el menú ya cumplió su función.
    menu.addEventListener('click', function (evento) {
      if (evento.target.closest('a')) abrir(false);
    });

    // Tocar fuera del panel lo cierra: es un desplegable, no un modal.
    document.addEventListener('click', function (evento) {
      if (estaAbierto() && !menu.contains(evento.target)) abrir(false);
    });

    document.addEventListener('keydown', function (evento) {
      if (evento.key === 'Escape' && estaAbierto()) {
        abrir(false);
        toggle.focus();
      }
    });

    // Si la ventana crece hasta escritorio el menú se oculta por CSS: hay que
    // dejar el estado consistente para cuando se vuelva a encoger.
    var escritorio = window.matchMedia('(min-width: 961px)');
    var alCambiar = function (mq) { if (mq.matches) abrir(false); };
    if (escritorio.addEventListener) escritorio.addEventListener('change', alCambiar);
    else escritorio.addListener(alCambiar);
  }

  /* ---------- Botón flotante de WhatsApp ----------
     Aparece al pasar el hero y se esconde sobre el cierre, que ya trae su
     propio botón. */
  var flotante = document.getElementById('flotante');
  var cierre = document.querySelector('.cierre');

  if (flotante && cierre) {
    var pendiente = false;

    var actualizar = function () {
      pendiente = false;
      var pasoHero = window.scrollY > window.innerHeight * 0.7;
      var enCierre = cierre.getBoundingClientRect().top < window.innerHeight - 80;
      flotante.hidden = !pasoHero || enCierre;
    };

    // El scroll dispara muy seguido: se agrupa en un frame para no forzar
    // reflow en cada evento.
    var programar = function () {
      if (pendiente) return;
      pendiente = true;
      window.requestAnimationFrame(actualizar);
    };

    actualizar();
    window.addEventListener('scroll', programar, { passive: true });
    window.addEventListener('resize', programar);
  }

  /* ---------- Captación: quien llega desde una página de pedidos ----------
     La app pone un footer en las páginas públicas de pedidos que enlaza aquí
     con ?ref={slug del negocio} y los utm_*. Con ese ref se personaliza el
     mensaje de WhatsApp y el saludo de arriba: así, al llegar el chat, se sabe
     qué negocio generó el prospecto sin montar un sistema de referidos.
     Todo es aditivo — sin un ref válido la landing se comporta igual que hoy. */

  var CLAVE_REF = 'fruktela.ref';

  // Un slug de negocio: ASCII, corto y sin nada que se pueda colar en una URL.
  // Cualquier otra cosa (vacío, espacios, basura) se descarta sin más.
  var SLUG_VALIDO = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

  // Estos sí pasan el formato de slug, pero son accidentes de programación de
  // quien construyó el enlace, no negocios. Saludar a "Undefined" sería peor
  // que no saludar.
  var SLUG_BASURA = /^(undefined|null|nan|none|false|true)$/i;

  var refUtil = function (valor) {
    return SLUG_VALIDO.test(valor || '') && !SLUG_BASURA.test(valor) ? valor : null;
  };

  // sessionStorage lanza en modo privado de algunos navegadores: que falle no
  // puede tumbar la página.
  var leerSesion = function (clave) {
    try { return window.sessionStorage.getItem(clave); } catch (e) { return null; }
  };
  var guardarSesion = function (clave, valor) {
    try { window.sessionStorage.setItem(clave, valor); } catch (e) { /* sin storage */ }
  };

  // gtag puede no existir: bloqueador de anuncios, o el snippet que no cargó.
  // La medición es accesoria; el enlace tiene que funcionar igual sin ella.
  var medir = function (evento, datos) {
    try {
      if (typeof window.gtag === 'function') window.gtag('event', evento, datos);
    } catch (e) { /* analytics nunca rompe la navegación */ }
  };

  // Conjunciones y preposiciones: dentro de un nombre van en minúscula, y una
  // 'Y' mayúscula en medio se lee como error de dedo. Los artículos no están en
  // la lista a propósito: suelen abrir un nombre propio ('Frutas La Esquina').
  var PALABRA_MENOR = /^(y|e|o|u|de|del|en|con|a|al|por|para)$/;

  // 'frutas-y-verduras-don-pepe' -> 'Frutas y Verduras Don Pepe'. No hay
  // catálogo de nombres, así que se humaniza el slug: mostrarlo crudo se ve mal.
  var humanizar = function (slug) {
    return slug.replace(/[-_]+/g, ' ').trim().split(' ').map(function (palabra, i) {
      if (i > 0 && PALABRA_MENOR.test(palabra)) return palabra.toLowerCase();
      return palabra.charAt(0).toUpperCase() + palabra.slice(1);
    }).join(' ');
  };

  if (window.URLSearchParams) {
    var consulta = new URLSearchParams(window.location.search);
    var refUrl = consulta.get('ref');
    var ref = refUtil(refUrl);

    if (ref) {
      guardarSesion(CLAVE_REF, ref);
    } else {
      // Sobrevive a recargas y a la navegación por anclas dentro de la sesión.
      ref = refUtil(leerSesion(CLAVE_REF));
    }

    // Un slug solo de números no da un nombre presentable: sigue sirviendo para
    // atribuir en GA4, pero el copy se queda genérico.
    var negocio = ref && /[A-Za-z]/.test(ref) ? humanizar(ref) : '';

    if (negocio) {
      var mensaje = 'Hola, vi la página de ' + negocio + ' y quiero mi prueba gratis';
      var enlaces = document.querySelectorAll('a[href*="wa.me/"]');
      for (var i = 0; i < enlaces.length; i++) {
        enlaces[i].href = enlaces[i].href.split('?')[0] + '?text=' + encodeURIComponent(mensaje);
      }

      var aviso = document.getElementById('bienvenida');
      var nombreNegocio = document.getElementById('bienvenida-negocio');
      if (aviso && nombreNegocio) {
        // textContent y no innerHTML: el nombre sale de la URL.
        nombreNegocio.textContent = negocio;
        aviso.hidden = false;
      }
    }

    // La llegada se cuenta una sola vez, solo cuando la URL trae los parámetros.
    // Las recargas y las anclas reusan el ref guardado sin volver a contarla.
    if (refUrl !== null || consulta.get('utm_source') !== null) {
      medir('landing_arrival', {
        ref: ref || '(none)',
        utm_source: consulta.get('utm_source') || '(none)',
        utm_medium: consulta.get('utm_medium') || '(none)',
        utm_campaign: consulta.get('utm_campaign') || '(none)'
      });
    }

    // Los enlaces abren en pestaña nueva, así que no hay carrera con la
    // navegación: se manda el evento y ya. Sin await y sin preventDefault.
    document.addEventListener('click', function (evento) {
      var destino = evento.target;
      if (destino && destino.closest && destino.closest('a[href*="wa.me/"]')) {
        medir('landing_whatsapp_click', { ref: ref || '(none)' });
      }
    });
  }
})();
