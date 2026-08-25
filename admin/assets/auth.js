/**
 * Auth base do Painel MCADV.
 * ATENÇÃO: login base client-side apenas para acesso local no VPS.
 * Deve ser substituído por autenticação server-side antes de qualquer exposição pública.
 */
(function () {
  'use strict';

  var CREDENTIALS = { user: 'Xande', pass: '123321' };
  var SESSION_KEY = 'mcadv_admin_auth';

  window.MCADVAuth = {
    /** Valida credenciais e cria a sessão local. */
    login: function (user, pass) {
      var ok = user === CREDENTIALS.user && pass === CREDENTIALS.pass;
      if (ok) {
        sessionStorage.setItem(SESSION_KEY, JSON.stringify({ user: user, ts: Date.now() }));
      }
      return ok;
    },

    /** Indica se há sessão ativa. */
    isAuthenticated: function () {
      return sessionStorage.getItem(SESSION_KEY) !== null;
    },

    /** Retorna o usuário logado, se houver. */
    currentUser: function () {
      try {
        return JSON.parse(sessionStorage.getItem(SESSION_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },

    /** Encerra a sessão. */
    logout: function () {
      sessionStorage.removeItem(SESSION_KEY);
    },

    /** Protege páginas do painel: redireciona ao login se não autenticado. */
    requireAuth: function (loginUrl) {
      if (!this.isAuthenticated()) {
        window.location.replace(loginUrl || 'login.html');
      }
    }
  };
})();
