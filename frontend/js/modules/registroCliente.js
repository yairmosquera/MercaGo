/**
 * MERCAGO - REGISTRO DE CLIENTES - FASE 16.1
 * Añade un enlace en la pantalla de login y crea un formulario modal.
 * Sin modificar auth.js ni el acceso al panel administrativo.
 */
(function () {
    'use strict';
    let enviando = false;
    let ultimoFoco = null;

    function construirRegistro() {
        if (document.getElementById('registroClienteModal')) return;
        const tarjeta = document.querySelector('#login .login-card');
        if (!tarjeta) {
            console.error('MercaGo: no se encontró la tarjeta de inicio de sesión');
            return;
        }
        const boton = document.createElement('button');
        boton.type = 'button';
        boton.id = 'btnRegistroCliente';
        boton.className = 'secondary';
        boton.style.cssText = 'display:block;width:100%;margin-top:12px';
        boton.textContent = 'Crear una cuenta de cliente';
        boton.addEventListener('click', abrirRegistroCliente);
        tarjeta.appendChild(boton);

        const modal = document.createElement('div');
        modal.id = 'registroClienteModal';
        modal.hidden = true;
        modal.style.cssText = 'position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.65);padding:16px;overflow:auto;align-items:center;justify-content:center';
        modal.innerHTML = `
          <div role="dialog" aria-modal="true" aria-labelledby="registroTitulo"
               style="background:var(--card,#fff);color:var(--text,#222);width:min(480px,100%);margin:auto;border-radius:16px;padding:26px;max-height:calc(100vh - 32px);overflow-y:auto">
            <h2 id="registroTitulo">Crear cuenta en MercaGo</h2>
            <p>Regístrate como cliente para hacer tus pedidos.</p>
            <form id="registroClienteFormulario">
              <div class="form-group">
                <label for="registroNombre">Nombre completo</label>
                <input id="registroNombre" name="nombre" type="text" minlength="3"
                       maxlength="150" autocomplete="name" required>
              </div>
              <div class="form-group">
                <label for="registroCorreo">Correo electrónico</label>
                <input id="registroCorreo" name="correo" type="email" maxlength="255"
                       autocomplete="email" required>
              </div>
              <div class="form-group">
                <label for="registroContrasena">Contraseña</label>
                <input id="registroContrasena" name="contrasena" type="password"
                       minlength="10" maxlength="128" autocomplete="new-password" required>
                <small>Mínimo 10 caracteres, incluyendo letras y números.</small>
              </div>
              <div class="form-group">
                <label for="registroConfirmar">Confirmar contraseña</label>
                <input id="registroConfirmar" type="password" minlength="10" maxlength="128"
                       autocomplete="new-password" required>
              </div>
              <p id="registroClienteMensaje" role="alert" style="min-height:22px"></p>
              <div style="display:flex;gap:12px;flex-wrap:wrap">
                <button id="registroClienteGuardar" class="primary" type="submit">Crear cuenta</button>
                <button id="registroClienteCancelar" class="secondary" type="button">Cancelar</button>
              </div>
            </form>
          </div>
        `;
        document.body.appendChild(modal);
        modal.querySelector('#registroClienteCancelar').addEventListener('click', cerrarRegistroCliente);
        modal.querySelector('#registroClienteFormulario').addEventListener('submit', enviarRegistroCliente);
        modal.addEventListener('click', e => {
            if (e.target === modal) cerrarRegistroCliente();
        });
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !modal.hidden) {
                e.stopImmediatePropagation();
                cerrarRegistroCliente();
            }
        }, true);
    }

    function abrirRegistroCliente() {
        construirRegistro();
        const modal = document.getElementById('registroClienteModal');
        if (!modal) return;
        ultimoFoco = document.activeElement;
        modal.hidden = false;
        modal.style.display = 'flex';
        modal.querySelector('#registroNombre').focus();
    }

    function cerrarRegistroCliente() {
        if (enviando) return;
        const modal = document.getElementById('registroClienteModal');
        if (!modal) return;
        modal.hidden = true;
        modal.style.display = 'none';
        ultimoFoco?.focus?.();
    }

    async function enviarRegistroCliente(e) {
        e.preventDefault();
        if (enviando) return;
        const nombre = document.getElementById('registroNombre').value.trim();
        const correo = document.getElementById('registroCorreo').value.trim();
        const contrasena = document.getElementById('registroContrasena').value;
        const confirmar = document.getElementById('registroConfirmar').value;
        const mensaje = document.getElementById('registroClienteMensaje');
        if (contrasena !== confirmar) {
            mensaje.textContent = 'Las contraseñas no coinciden.';
            return;
        }
        if (contrasena.length < 10 || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
            mensaje.textContent = 'La contraseña debe incluir letras y números y tener al menos 10 caracteres.';
            return;
        }
        enviando = true;
        mensaje.textContent = 'Registrando cuenta...';
        const guardar = document.getElementById('registroClienteGuardar');
        guardar.disabled = true;
        try {
            // API_BASE está definido por la configuración API existente de MercaGo.
            const base = typeof API_BASE !== 'undefined'
                ? API_BASE : 'http://localhost:3000/api';
            const respuesta = await fetch(`${base}/auth/registro`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ nombre, correo, contrasena })
            });
            const datos = await respuesta.json().catch(() => ({}));
            if (!respuesta.ok) throw new Error(datos.mensaje || 'No se pudo crear la cuenta');
            const loginCorreo = document.getElementById('loginCorreo');
            if (loginCorreo) loginCorreo.value = correo.toLowerCase();
            document.getElementById('registroClienteFormulario').reset();
            mensaje.textContent = '';
            if (typeof toast === 'function') toast('Cuenta creada. Inicia sesión con tus credenciales.');
            else alert('Cuenta creada. Inicia sesión con tus credenciales.');
            // No se inicia una sesión de manera implícita.
        } catch (error) {
            mensaje.textContent = error.message;
            return;
        } finally {
            enviando = false;
            guardar.disabled = false;
        }
        cerrarRegistroCliente();
        document.getElementById('loginContrasena')?.focus();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', construirRegistro, { once: true });
    } else {
        construirRegistro();
    }
})();
