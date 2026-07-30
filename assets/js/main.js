/* Fruktela — landing
   Dos cosas y nada más: el menú de celular y el botón flotante de WhatsApp.
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
})();
