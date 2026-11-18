/** MERCAGO - FASE 17: MIS DIRECCIONES Y SELECCIÓN EN CHECKOUT */
(function () {
    'use strict';

    let direcciones = [];
    let ocupada = false;
    let cargandoCheckout = false;

    const $ = id => document.getElementById(id);
    const esCliente = () => typeof currentUser !== 'undefined' && currentUser?.rol === 'CLIENTE';
    const limpiar = valor => typeof escapeHtml === 'function'
        ? escapeHtml(String(valor ?? ''))
        : String(valor ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

    function botonesSesion() {
        const boton = $('btnMisDirecciones');
        if (boton) boton.hidden = !esCliente();
        if (!esCliente()) {
            direcciones = [];
            const sel = $('checkoutDireccionGuardada');
            if (sel) sel.innerHTML = '<option value="">Escribir dirección manualmente</option>';
        }
    }

    function crearModal() {
        if ($('direccionesClienteModal')) return;
        const modal = document.createElement('div');
        modal.id = 'direccionesClienteModal';
        modal.hidden = true;
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.65);z-index:10020;padding:16px;overflow:auto;align-items:center;justify-content:center';
        modal.innerHTML = `
          <div role="dialog" aria-modal="true" aria-labelledby="misDireccionesTitulo"
               style="width:min(750px,100%);max-height:calc(100vh - 32px);overflow-y:auto;margin:auto;background:var(--card,#fff);color:var(--text,#222);border-radius:16px;padding:24px">
            <div style="display:flex;justify-content:space-between;gap:12px;align-items:center">
              <h2 id="misDireccionesTitulo" style="margin:0">📍 Mis direcciones</h2>
              <button type="button" id="direccionesCerrar" class="secondary">✕ Cerrar</button>
            </div>
            <p style="color:var(--muted,#666)">Registra hasta 10 direcciones. Una puede ser la principal.</p>
            <div id="direccionesLista" style="display:grid;gap:10px;margin:18px 0" aria-live="polite"></div>
            <hr style="opacity:.2;margin:20px 0">
            <form id="direccionesFormulario">
              <h3 id="direccionesFormTitulo">Agregar dirección</h3>
              <input type="hidden" id="direccionEditarId">
              <div class="form-group">
                <label for="direccionEtiqueta">Nombre corto (Casa, Trabajo...)</label>
                <input type="text" id="direccionEtiqueta" maxlength="60" required>
              </div>
              <div class="form-group">
                <label for="direccionTexto">Dirección completa</label>
                <input type="text" id="direccionTexto" minlength="5" maxlength="300" required placeholder="Calle 45 # 32-18, Medellín">
              </div>
              <div class="form-group">
                <label for="direccionTelefono">Teléfono de contacto</label>
                <input type="tel" id="direccionTelefono" minlength="5" maxlength="40" required>
              </div>
              <label style="display:flex;align-items:center;gap:8px;margin:12px 0">
                <input type="checkbox" id="direccionPrincipal" style="width:auto"> Dirección principal
              </label>
              <div style="display:flex;gap:10px;flex-wrap:wrap">
                <button type="submit" class="primary" id="direccionGuardar">Guardar dirección</button>
                <button type="button" class="secondary" id="direccionCancelar">Limpiar formulario</button>
              </div>
              <p id="direccionesMensaje" role="status" style="min-height:24px"></p>
            </form>
          </div>`;
        document.body.appendChild(modal);
        $('direccionesCerrar').addEventListener('click', cerrarDirecciones);
        $('direccionCancelar').addEventListener('click', limpiarFormulario);
        $('direccionesFormulario').addEventListener('submit', guardarDireccion);
        modal.addEventListener('click', e => { if (e.target === modal) cerrarDirecciones(); });
        $('direccionesLista').addEventListener('click', async e => {
            const boton = e.target.closest('button[data-accion][data-id]');
            if (!boton || ocupada) return;
            const id = Number(boton.dataset.id);
            const item = direcciones.find(d => Number(d.id) === id);
            if (!item) return;
            if (boton.dataset.accion === 'editar') {
                $('direccionEditarId').value = item.id;
                $('direccionEtiqueta').value = item.etiqueta;
                $('direccionTexto').value = item.direccion;
                $('direccionTelefono').value = item.telefono;
                $('direccionPrincipal').checked = Boolean(item.principal);
                $('direccionesFormTitulo').textContent = 'Editar dirección';
                $('direccionEtiqueta').focus();
            } else if (boton.dataset.accion === 'principal') {
                await ejecutarCambio(`/auth/direcciones/${id}/principal`, { method: 'PATCH' });
            } else if (boton.dataset.accion === 'eliminar') {
                if (window.confirm(`¿Eliminar la dirección «${item.etiqueta}»?`)) {
                    await ejecutarCambio(`/auth/direcciones/${id}`, { method: 'DELETE' });
                    limpiarFormulario();
                }
            }
        });
    }

    function limpiarFormulario() {
        const form = $('direccionesFormulario');
        if (!form) return;
        form.reset();
        $('direccionEditarId').value = '';
        $('direccionesFormTitulo').textContent = 'Agregar dirección';
        $('direccionesMensaje').textContent = '';
    }

    function renderizar() {
        const caja = $('direccionesLista');
        if (!caja) return;
        if (!direcciones.length) {
            caja.innerHTML = '<p>Todavía no tienes direcciones guardadas.</p>';
            return;
        }
        caja.innerHTML = direcciones.map(item => `
          <div style="border:1px solid var(--border,#ddd);padding:13px;border-radius:12px">
            <div style="display:flex;gap:8px;justify-content:space-between;flex-wrap:wrap">
              <strong>${limpiar(item.etiqueta)} ${item.principal ? '⭐ Principal' : ''}</strong>
              <span>${limpiar(item.telefono)}</span>
            </div>
            <p style="margin:8px 0">${limpiar(item.direccion)}</p>
            <div style="display:flex;gap:7px;flex-wrap:wrap">
              <button type="button" class="secondary" data-accion="editar" data-id="${Number(item.id)}">Editar</button>
              ${item.principal ? '' : `<button type="button" class="secondary" data-accion="principal" data-id="${Number(item.id)}">Hacer principal</button>`}
              <button type="button" class="secondary" data-accion="eliminar" data-id="${Number(item.id)}">Eliminar</button>
            </div>
          </div>`).join('');
    }

    async function consultarDirecciones() {
        if (!esCliente()) return [];
        const respuesta = await apiRequest('/auth/direcciones');
        if (!Array.isArray(respuesta)) throw new Error('Respuesta de direcciones inválida');
        direcciones = respuesta;
        renderizar();
        actualizarSelectorCheckout();
        return respuesta;
    }

    async function abrirDirecciones() {
        if (!esCliente()) { if (typeof toast === 'function') toast('Inicia sesión como cliente'); return; }
        crearModal();
        $('direccionesClienteModal').hidden = false;
        $('direccionesClienteModal').style.display = 'flex';
        $('direccionesMensaje').textContent = 'Cargando direcciones...';
        try { await consultarDirecciones(); $('direccionesMensaje').textContent = ''; }
        catch (e) { $('direccionesMensaje').textContent = e.message; }
    }
    function cerrarDirecciones() {
        if (ocupada) return;
        const modal = $('direccionesClienteModal');
        if (modal) { modal.hidden = true; modal.style.display = 'none'; }
    }

    async function ejecutarCambio(ruta, opciones) {
        ocupada = true;
        try {
            const r = await apiRequest(ruta, opciones);
            await consultarDirecciones();
            if (typeof toast === 'function') toast(r.mensaje || 'Dirección actualizada');
        } catch (e) {
            if ($('direccionesMensaje')) $('direccionesMensaje').textContent = e.message;
        } finally { ocupada = false; }
    }

    async function guardarDireccion(e) {
        e.preventDefault();
        if (ocupada || !esCliente()) return;
        const id = $('direccionEditarId').value;
        const payload = {
            etiqueta: $('direccionEtiqueta').value.trim(),
            direccion: $('direccionTexto').value.trim(),
            telefono: $('direccionTelefono').value.trim(),
            principal: $('direccionPrincipal').checked
        };
        if (!payload.etiqueta || payload.direccion.length < 5 || payload.telefono.length < 5) {
            $('direccionesMensaje').textContent = 'Completa los datos de la dirección';
            return;
        }
        const boton = $('direccionGuardar');
        boton.disabled = true;
        await ejecutarCambio(id ? `/auth/direcciones/${encodeURIComponent(id)}` : '/auth/direcciones', {
            method: id ? 'PUT' : 'POST',
            body: JSON.stringify(payload)
        });
        if (!$('direccionesMensaje').textContent) limpiarFormulario();
        boton.disabled = false;
    }

    function actualizarSelectorCheckout() {
        const selector = $('checkoutDireccionGuardada');
        if (!selector) return;
        const anterior = selector.value;
        selector.innerHTML = '<option value="">Escribir dirección manualmente</option>' +
            direcciones.map(d => `<option value="${Number(d.id)}">${limpiar(d.etiqueta)}${d.principal ? ' (principal)' : ''} - ${limpiar(d.direccion)}</option>`).join('');
        if (direcciones.some(d => String(d.id) === anterior)) selector.value = anterior;
        else {
            const principal = direcciones.find(d => d.principal);
            if (principal && !$('checkoutDireccion')?.value.trim()) {
                selector.value = String(principal.id);
                seleccionarDireccion();
            }
        }
    }

    function seleccionarDireccion() {
        const id = Number($('checkoutDireccionGuardada')?.value);
        if (!id) return;
        const item = direcciones.find(d => Number(d.id) === id);
        if (!item) return;
        const direccion = $('checkoutDireccion');
        const telefono = $('checkoutTelefono');
        if (direccion) direccion.value = item.direccion;
        if (telefono) telefono.value = item.telefono;
    }

    async function cargarDireccionesCheckout() {
        if (!esCliente() || cargandoCheckout) return;
        cargandoCheckout = true;
        try { await consultarDirecciones(); }
        catch (e) { console.warn('Direcciones checkout:', e.message); }
        finally { cargandoCheckout = false; }
    }

    function iniciar() {
        const boton = $('btnMisDirecciones');
        if (boton) boton.addEventListener('click', abrirDirecciones);
        const selector = $('checkoutDireccionGuardada');
        if (selector) selector.addEventListener('change', seleccionarDireccion);
        const gestionar = $('checkoutAdministrarDirecciones');
        if (gestionar) gestionar.addEventListener('click', abrirDirecciones);
        botonesSesion();
        const sesion = $('sessionButton');
        if (sesion) new MutationObserver(botonesSesion).observe(sesion, { childList: true, subtree: true, characterData: true });
        // go('checkout') actualiza la clase de la sección. Detectar ese cambio
        // permite mantener checkout.js intacto.
        const checkout = $('checkout');
        if (checkout) new MutationObserver(() => {
            if (checkout.classList.contains('active')) cargarDireccionesCheckout();
        }).observe(checkout, { attributes: true, attributeFilter: ['class'] });
        if (checkout?.classList.contains('active')) cargarDireccionesCheckout();
        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && $('direccionesClienteModal') && !$('direccionesClienteModal').hidden) {
                e.stopImmediatePropagation();
                cerrarDirecciones();
            }
        }, true);
    }
    document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', iniciar, { once: true }) : iniciar();
})();
