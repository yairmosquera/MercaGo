/** MERCAGO - FASE 16.2 - MI PERFIL (CLIENTES) */
(function () {
    'use strict';
    let ocupado = false;
    let ultimoFoco = null;

    function esCliente() {
        return typeof currentUser !== 'undefined' && currentUser?.rol === 'CLIENTE';
    }
    function actualizarBoton() {
        const boton = document.getElementById('btnMiPerfil');
        if (boton) boton.hidden = !esCliente();
    }
    function crearModal() {
        if (document.getElementById('miPerfilModal')) return;
        const modal = document.createElement('div');
        modal.id = 'miPerfilModal';
        modal.hidden = true;
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10010;padding:16px;overflow:auto;align-items:center;justify-content:center';
        modal.innerHTML = `
          <div role="dialog" aria-modal="true" aria-labelledby="miPerfilTitulo"
               style="width:min(610px,100%);margin:auto;max-height:calc(100vh - 32px);overflow-y:auto;background:var(--card,#fff);color:var(--text,#222);border-radius:16px;padding:24px">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:12px">
              <h2 id="miPerfilTitulo" style="margin:0">👤 Mi perfil</h2>
              <button type="button" id="miPerfilCerrar" class="secondary">✕ Cerrar</button>
            </div>
            <p>Administra tu información de cliente de MercaGo.</p>
            <div class="metrics" style="margin:12px 0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
              <div class="metric"><span>Mis pedidos</span><b id="perfilTotalPedidos">—</b></div>
              <div class="metric"><span>Entregados</span><b id="perfilEntregados">—</b></div>
            </div>
            <form id="miPerfilDatosForm">
              <h3>Datos personales</h3>
              <div class="form-group"><label for="perfilNombre">Nombre completo</label>
                <input id="perfilNombre" type="text" minlength="3" maxlength="150" autocomplete="name" required></div>
              <div class="form-group"><label for="perfilCorreo">Correo electrónico</label>
                <input id="perfilCorreo" type="email" maxlength="255" autocomplete="email" required></div>
              <div class="form-group"><label for="perfilClaveCorreo">Contraseña actual (solo si cambias el correo)</label>
                <input id="perfilClaveCorreo" type="password" autocomplete="current-password" maxlength="1024"></div>
              <button type="submit" class="primary" id="perfilGuardar">Guardar datos</button>
              <p id="perfilMensaje" role="status" style="min-height:22px"></p>
            </form>
            <hr style="margin:24px 0;opacity:.2">
            <form id="miPerfilClaveForm">
              <h3>Cambiar contraseña</h3>
              <div class="form-group"><label for="perfilClaveActual">Contraseña actual</label>
                <input id="perfilClaveActual" type="password" autocomplete="current-password" required></div>
              <div class="form-group"><label for="perfilClaveNueva">Nueva contraseña</label>
                <input id="perfilClaveNueva" type="password" minlength="10" maxlength="128" autocomplete="new-password" required>
                <small>Mínimo 10 caracteres, con letras y números.</small></div>
              <div class="form-group"><label for="perfilClaveRepetir">Confirmar nueva contraseña</label>
                <input id="perfilClaveRepetir" type="password" minlength="10" maxlength="128" autocomplete="new-password" required></div>
              <button type="submit" class="secondary" id="perfilCambiarClave">Cambiar contraseña</button>
              <p id="perfilClaveMensaje" role="status" style="min-height:22px"></p>
            </form>
            <p style="font-size:12px;color:var(--muted,#666)">Por seguridad, al cambiar la contraseña se cerrará esta sesión. Otras sesiones existentes podrían seguir vigentes hasta que venza su token.</p>
          </div>`;
        document.body.appendChild(modal);
        modal.querySelector('#miPerfilCerrar').addEventListener('click', cerrarMiPerfil);
        modal.addEventListener('click', e => { if (e.target === modal) cerrarMiPerfil(); });
        modal.querySelector('#miPerfilDatosForm').addEventListener('submit', guardarMiPerfil);
        modal.querySelector('#miPerfilClaveForm').addEventListener('submit', guardarNuevaClave);
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && !modal.hidden) {
                e.stopImmediatePropagation();
                cerrarMiPerfil();
            }
        }, true);
    }
    async function abrirMiPerfil() {
        if (!esCliente()) { toast('Inicia sesión como cliente para ver tu perfil'); return; }
        crearModal();
        ultimoFoco = document.activeElement;
        const modal = document.getElementById('miPerfilModal');
        modal.hidden = false;
        modal.style.display = 'flex';
        document.getElementById('perfilMensaje').textContent = 'Consultando perfil...';
        try {
            const datos = await apiRequest('/auth/mi-perfil');
            const u = datos.usuario;
            document.getElementById('perfilNombre').value = u.nombre || '';
            document.getElementById('perfilCorreo').value = u.correo || '';
            document.getElementById('perfilClaveCorreo').value = '';
            document.getElementById('perfilTotalPedidos').textContent = Number(u.totalPedidos || 0).toLocaleString('es-CO');
            document.getElementById('perfilEntregados').textContent = Number(u.entregados || 0).toLocaleString('es-CO');
            document.getElementById('perfilMensaje').textContent = '';
            document.getElementById('perfilNombre').focus();
        } catch (error) {
            document.getElementById('perfilMensaje').textContent = error.message;
        }
    }
    function cerrarMiPerfil() {
        if (ocupado) return;
        const modal = document.getElementById('miPerfilModal');
        if (!modal) return;
        modal.hidden = true;
        modal.style.display = 'none';
        modal.querySelector('#miPerfilClaveForm').reset();
        modal.querySelector('#perfilClaveCorreo').value = '';
        ultimoFoco?.focus?.();
    }
    async function guardarMiPerfil(e) {
        e.preventDefault();
        if (ocupado || !esCliente()) return;
        const mensaje = document.getElementById('perfilMensaje');
        const boton = document.getElementById('perfilGuardar');
        ocupado = true;
        boton.disabled = true;
        mensaje.textContent = 'Guardando...';
        try {
            const datos = await apiRequest('/auth/mi-perfil', {
                method: 'PATCH',
                body: JSON.stringify({
                    nombre: document.getElementById('perfilNombre').value.trim(),
                    correo: document.getElementById('perfilCorreo').value.trim(),
                    contrasenaActual: document.getElementById('perfilClaveCorreo').value
                })
            });
            // Se actualiza el nombre visible en la sesión actual.
            currentUser = { ...currentUser, ...datos.usuario };
            if (typeof updateSessionUI === 'function') updateSessionUI();
            document.getElementById('perfilClaveCorreo').value = '';
            mensaje.textContent = datos.mensaje || 'Perfil actualizado';
            toast('Perfil actualizado');
        } catch (error) { mensaje.textContent = error.message; }
        finally { ocupado = false; boton.disabled = false; }
    }
    async function guardarNuevaClave(e) {
        e.preventDefault();
        if (ocupado || !esCliente()) return;
        const actual = document.getElementById('perfilClaveActual').value;
        const nueva = document.getElementById('perfilClaveNueva').value;
        const repetir = document.getElementById('perfilClaveRepetir').value;
        const mensaje = document.getElementById('perfilClaveMensaje');
        if (nueva !== repetir) { mensaje.textContent = 'Las contraseñas nuevas no coinciden'; return; }
        if (nueva.length < 10 || !/[A-Za-z]/.test(nueva) || !/\d/.test(nueva)) {
            mensaje.textContent = 'La nueva contraseña debe tener mínimo 10 caracteres, letras y números';
            return;
        }
        ocupado = true;
        const boton = document.getElementById('perfilCambiarClave');
        boton.disabled = true;
        mensaje.textContent = 'Actualizando contraseña...';
        try {
            await apiRequest('/auth/mi-perfil/contrasena', {
                method: 'PATCH',
                body: JSON.stringify({ contrasenaActual: actual, nuevaContrasena: nueva })
            });
            ocupado = false;
            cerrarMiPerfil();
            if (typeof logout === 'function') logout();
            toast('Contraseña actualizada. Inicia sesión nuevamente.');
        } catch (error) { mensaje.textContent = error.message; }
        finally { ocupado = false; boton.disabled = false; }
    }
    function iniciar() {
        const boton = document.getElementById('btnMiPerfil');
        if (boton) boton.addEventListener('click', abrirMiPerfil);
        actualizarBoton();
        const sesion = document.getElementById('sessionButton');
        if (sesion) new MutationObserver(actualizarBoton).observe(sesion, {
            childList: true, characterData: true, subtree: true
        });
        window.addEventListener('pageshow', actualizarBoton);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar, { once: true });
    else iniciar();
})();
