// --- CONFIGURACIÓN ---
// Las credenciales ahora se validan en el servidor por seguridad
const MAX_INTENTOS_FALLIDOS = 3;
const BLOQUEO_MINUTOS = 10;

// --- Variables globales ---
let registros_acumulados = [];
let tiempo_restante_segundos = 0;
let admin_logueado = false;
let admin_token = null; // Token de sesión del admin
let intentos_fallidos = 0;
let bloqueo_hasta = null;
let temporizador_local = null;

// --- Funciones para persistir el bloqueo ---
function guardar_estado_bloqueo() {
    const estado = {
        intentos_fallidos: intentos_fallidos,
        bloqueo_hasta: bloqueo_hasta ? bloqueo_hasta.getTime() : null
    };
    localStorage.setItem('admin_bloqueo', JSON.stringify(estado));
}

function cargar_estado_bloqueo() {
    try {
        const estado = localStorage.getItem('admin_bloqueo');
        if (estado) {
            const data = JSON.parse(estado);
            intentos_fallidos = data.intentos_fallidos || 0;
            bloqueo_hasta = data.bloqueo_hasta ? new Date(data.bloqueo_hasta) : null;
            
            // Si el bloqueo ya expiró, limpiar
            if (bloqueo_hasta && new Date() >= bloqueo_hasta) {
                intentos_fallidos = 0;
                bloqueo_hasta = null;
                localStorage.removeItem('admin_bloqueo');
            }
        }
    } catch (e) {
        console.warn('Error al cargar estado de bloqueo:', e);
        intentos_fallidos = 0;
        bloqueo_hasta = null;
    }
}

function limpiar_estado_bloqueo() {
    intentos_fallidos = 0;
    bloqueo_hasta = null;
    localStorage.removeItem('admin_bloqueo');
}

function verificar_y_aplicar_bloqueo() {
    const panelLogin = document.getElementById('panel_login');
    const logElement = document.getElementById('log_intentos');
    const textoElement = document.getElementById('texto_intentos');
    
    if (bloqueo_hasta && new Date() < bloqueo_hasta) {
        // Está bloqueado - deshabilitar completamente la zona de login
        const inputs = panelLogin.querySelectorAll('input');
        const botones = panelLogin.querySelectorAll('button');
        
        inputs.forEach(input => {
            input.disabled = true;
            input.style.backgroundColor = '#f5f5f5';
            input.style.color = '#999';
            input.style.cursor = 'not-allowed';
        });
        
        botones.forEach(btn => {
            btn.disabled = true;
            btn.style.backgroundColor = '#ccc';
            btn.style.cursor = 'not-allowed';
        });
        
        // Mostrar mensaje de bloqueo permanente
        if (logElement && textoElement) {
            const tiempoRestante = Math.ceil((bloqueo_hasta - new Date()) / 60000);
            textoElement.textContent = `🔒 BLOQUEADO por ${tiempoRestante} minutos. Cambia de navegador para intentar nuevamente.`;
            logElement.classList.remove('oculta');
            logElement.style.backgroundColor = '#ffcdd2';
            logElement.style.border = '2px solid #f44336';
            logElement.style.fontWeight = 'bold';
        }
        
        // Verificar cada minuto si debe desbloquearse
        setTimeout(() => {
            if (new Date() >= bloqueo_hasta) {
                location.reload(); // Recargar página para limpiar estado
            } else {
                verificar_y_aplicar_bloqueo(); // Volver a verificar
            }
        }, 60000);
        
        return true; // Está bloqueado
    } else {
        // No está bloqueado - habilitar zona de login
        const inputs = panelLogin.querySelectorAll('input');
        const botones = panelLogin.querySelectorAll('button');
        
        inputs.forEach(input => {
            input.disabled = false;
            input.style.backgroundColor = '';
            input.style.color = '';
            input.style.cursor = '';
        });
        
        botones.forEach(btn => {
            btn.disabled = false;
            btn.style.backgroundColor = '';
            btn.style.cursor = '';
        });
        
        // Mostrar intentos fallidos si los hay
        if (intentos_fallidos > 0 && logElement && textoElement) {
            textoElement.textContent = `${intentos_fallidos}/${MAX_INTENTOS_FALLIDOS} intentos fallidos`;
            logElement.classList.remove('oculta');
            logElement.style.backgroundColor = '#fff3e0';
            logElement.style.border = '1px solid #ff9800';
            logElement.style.fontWeight = 'normal';
        }
        
        return false; // No está bloqueado
    }
}

// --- Funciones de utilidad ---
function formatear_fecha_hora(fecha) {
    const dia = String(fecha.getDate()).padStart(2, '0');
    const mes = String(fecha.getMonth() + 1).padStart(2, '0');
    const anio = fecha.getFullYear();
    const horas = String(fecha.getHours()).padStart(2, '0');
    const minutos = String(fecha.getMinutes()).padStart(2, '0');
    const segundos = String(fecha.getSeconds()).padStart(2, '0');
    return `${dia}/${mes}/${anio} ${horas}:${minutos}:${segundos}`;
}

function mostrar_mensaje(texto, tipo) {
    const elem = document.getElementById('mensaje_respuesta');
    if (elem) {
        elem.innerHTML = `<div class="mensaje ${tipo}">${texto}</div>`;
        if (tipo === 'exito' || tipo === 'advertencia') {
            setTimeout(() => { elem.innerHTML = ''; }, 5000);
        }
    }
}

function controlar_estado_formulario(tiempo_activo) {
    // Obtener solo los form-group del formulario principal (no del admin)
    const formularioPrincipal = document.getElementById('formulario_asistencia');
    const formGroups = formularioPrincipal ? formularioPrincipal.querySelectorAll('.form-group') : [];
    
    // IDs de inputs que nunca deben bloquearse (administrador)
    const inputsProtegidos = ['admin_usuario', 'admin_clave', 'minutos_tiempo'];
    
    formGroups.forEach(group => {
        const inputs = group.querySelectorAll('input');
        inputs.forEach(input => {
            // Solo deshabilitar inputs que no sean protegidos y no sean de solo lectura
            if (!inputsProtegidos.includes(input.id) && 
                input.type !== 'button' && 
                input.type !== 'submit') {
                input.disabled = !tiempo_activo;
            }
        });
        
        // Agregar/quitar clase bloqueado solo a grupos del formulario principal
        if (tiempo_activo) {
            group.classList.remove('bloqueado');
        } else {
            group.classList.add('bloqueado');
        }
    });
    
    // Cambiar clase del formulario principal solamente
    if (formularioPrincipal) {
        if (tiempo_activo) {
            formularioPrincipal.classList.remove('bloqueado');
        } else {
            formularioPrincipal.classList.add('bloqueado');
        }
    }
    
    // Mensaje visual en la interfaz
    const mensaje_estado = document.getElementById('mensaje_estado_formulario');
    if (!mensaje_estado) {
        // Crear elemento de mensaje si no existe
        const mensaje = document.createElement('div');
        mensaje.id = 'mensaje_estado_formulario';
        mensaje.style.textAlign = 'center';
        mensaje.style.margin = '10px 0';
        mensaje.style.padding = '8px';
        mensaje.style.borderRadius = '6px';
        mensaje.style.fontWeight = 'bold';
        
        if (formularioPrincipal) {
            // Insertar antes del formulario principal
            formularioPrincipal.parentNode.insertBefore(mensaje, formularioPrincipal);
        }
    }
    
    const mensajeElemento = document.getElementById('mensaje_estado_formulario');
    if (mensajeElemento) {
        if (tiempo_activo) {
            mensajeElemento.innerHTML = '✅ <strong>Formulario activo</strong> - Puedes registrar tu asistencia';
            mensajeElemento.style.background = '#388e3c';
            mensajeElemento.style.color = 'white';
            mensajeElemento.style.display = 'block';
        } else {
            mensajeElemento.innerHTML = '🔒 <strong>Formulario cerrado</strong> - Solo el administrador puede aperturar el registro';
            mensajeElemento.style.background = '#d32f2f';
            mensajeElemento.style.color = 'white';
            mensajeElemento.style.display = 'block';
        }
    }
}

function actualizar_temporizador_ui(segundos) {
    tiempo_restante_segundos = segundos;
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    
    const tiempo_elem = document.getElementById('tiempo_restante');
    if (tiempo_elem) {
        tiempo_elem.textContent = `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    }

    // Determinar si el tiempo está activo
    const tiempo_activo = segundos > 0;
    
    // Controlar estado del formulario
    controlar_estado_formulario(tiempo_activo);

    // Actualizar botón de registro
    const btn = document.getElementById('btn_registrar');
    if (btn) {
        btn.disabled = !tiempo_activo;
        if (tiempo_activo) {
            btn.textContent = 'Registrar Asistencia';
            btn.classList.remove('btn-deshabilitado', 'tiempo-agotado');
        } else {
            btn.textContent = '⏰ Tiempo Agotado - Formulario Cerrado';
            btn.classList.add('btn-deshabilitado', 'tiempo-agotado');
        }
    }

    // Actualizar paneles de admin SI ESTÁ LOGUEADO
    if (admin_logueado) {
        const titulo_tiempo = document.getElementById('titulo_tiempo');
        const btn_accion_tiempo = document.getElementById('btn_accion_tiempo');
        const ayuda_tiempo = document.getElementById('ayuda_tiempo');
        const panel_detener = document.getElementById('panel_detener_temporizador');
        
        if (titulo_tiempo && btn_accion_tiempo && ayuda_tiempo && panel_detener) {
            if (segundos > 0) {
                // Temporizador activo: cambiar a modo "extender"
                titulo_tiempo.textContent = '⏰ Extender tiempo de sesión';
                btn_accion_tiempo.textContent = '➕ Agregar tiempo';
                btn_accion_tiempo.className = 'btn-tiempo';
                ayuda_tiempo.textContent = 'Agrega más minutos al temporizador actual.';
                panel_detener.classList.remove('oculta');
            } else {
                // Temporizador inactivo: modo "iniciar"
                titulo_tiempo.textContent = '▶️ Iniciar sesión de inducción';
                btn_accion_tiempo.textContent = '▶️ Iniciar temporizador';
                btn_accion_tiempo.className = 'btn-tiempo';
                ayuda_tiempo.textContent = 'El temporizador debe iniciarse antes de registrar asistencias.';
                panel_detener.classList.add('oculta');
            }
        }
    }

    // Mensaje de advertencia cuando quedan pocos minutos
    if (segundos === 300) { // 5 minutos
        mostrar_mensaje('⚠️ Quedan 5 minutos para el cierre del formulario', 'advertencia');
    } else if (segundos === 60) { // 1 minuto
        mostrar_mensaje('⚠️ ¡Último minuto para registrar asistencias!', 'advertencia');
    } else if (segundos === 0) {
        mostrar_mensaje('⏰ Tiempo agotado. El formulario se ha cerrado y los campos están bloqueados.', 'error');
    }
}

function iniciar_temporizador_local(segundos_iniciales) {
    // Limpiar temporizador anterior si existe
    if (temporizador_local) {
        clearInterval(temporizador_local);
    }

    tiempo_restante_segundos = segundos_iniciales;
    actualizar_temporizador_ui(tiempo_restante_segundos);

    // Crear nuevo temporizador que cuenta hacia atrás cada segundo
    temporizador_local = setInterval(() => {
        tiempo_restante_segundos = Math.max(0, tiempo_restante_segundos - 1);
        actualizar_temporizador_ui(tiempo_restante_segundos);

        // Detener temporizador cuando llegue a 0
        if (tiempo_restante_segundos <= 0) {
            clearInterval(temporizador_local);
            temporizador_local = null;
        }
    }, 1000);
}

// --- Comunicación con backend ---
async function login_admin_servidor(usuario, clave) {
    try {
        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ usuario, clave })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            admin_token = respuesta.admin_token;
            return { exito: true, mensaje: respuesta.mensaje };
        } else {
            const error = await res.json();
            return { exito: false, mensaje: error.error };
        }
    } catch (e) {
        return { exito: false, mensaje: 'Error de conexión con el servidor' };
    }
}

async function cargar_estado_servidor() {
    try {
        const res = await fetch('/api/estado');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const estado = await res.json();
        
        // Actualizar registros acumulados
        registros_acumulados = estado.registros || [];
        
        // Actualizar contador
        const contador = document.getElementById('contador_valor');
        if (contador) contador.textContent = registros_acumulados.length;

        // Actualizar temporizador
        const tiempo = estado.tiempo_restante || 0;
        
        // Solo iniciar temporizador local si ha cambiado significativamente
        if (Math.abs(tiempo_restante_segundos - tiempo) > 2 || tiempo_restante_segundos === 0) {
            if (tiempo > 0) {
                iniciar_temporizador_local(tiempo);
            } else {
                actualizar_temporizador_ui(0);
            }
        }

    } catch (e) {
        console.warn('No se pudo cargar estado:', e.message);
    }
}

async function iniciar_temporizador_servidor(minutos) {
    try {
        const res = await fetch('/api/iniciar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutos, admin_token })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            // Iniciar temporizador local inmediatamente
            iniciar_temporizador_local(respuesta.tiempo);
            mostrar_mensaje(`✅ Temporizador iniciado: ${minutos} minutos`, 'exito');
        } else if (res.status === 401) {
            mostrar_mensaje('❌ Sesión de administrador inválida. Inicia sesión nuevamente.', 'error');
            cerrar_sesion_local();
        } else {
            mostrar_mensaje('❌ Error al iniciar temporizador.', 'error');
        }
    } catch (e) {
        mostrar_mensaje('❌ Error de conexión al iniciar.', 'error');
    }
}

async function extender_temporizador_servidor(minutos) {
    try {
        const res = await fetch('/api/extender', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ minutos, admin_token })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            // Actualizar temporizador local con el nuevo tiempo
            iniciar_temporizador_local(respuesta.tiempo_restante);
            mostrar_mensaje(`✅ Se agregaron ${minutos} minutos al temporizador`, 'exito');
        } else if (res.status === 401) {
            mostrar_mensaje('❌ Sesión de administrador inválida. Inicia sesión nuevamente.', 'error');
            cerrar_sesion_local();
        } else {
            const error = await res.json();
            mostrar_mensaje(`❌ ${error.error}`, 'error');
        }
    } catch (e) {
        mostrar_mensaje('❌ Error de conexión al extender tiempo.', 'error');
    }
}

async function detener_temporizador_servidor() {
    try {
        const res = await fetch('/api/detener', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ admin_token })
        });
        
        if (res.ok) {
            // Detener temporizador local
            if (temporizador_local) {
                clearInterval(temporizador_local);
                temporizador_local = null;
            }
            
            // Actualizar UI inmediatamente
            actualizar_temporizador_ui(0);
            
            mostrar_mensaje('⏹️ Temporizador detenido. Formulario cerrado.', 'exito');
        } else if (res.status === 401) {
            mostrar_mensaje('❌ Sesión de administrador inválida. Inicia sesión nuevamente.', 'error');
            cerrar_sesion_local();
        } else {
            mostrar_mensaje('❌ Error al detener temporizador.', 'error');
        }
    } catch (e) {
        mostrar_mensaje('❌ Error de conexión al detener.', 'error');
    }
}

async function registrar_asistencia_servidor(datos) {
    try {
        const res = await fetch('/api/registrar', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(datos)
        });
        
        if (res.ok) {
            return true;
        } else if (res.status === 400) {
            const error = await res.json();
            mostrar_mensaje(`❌ ${error.error}`, 'error');
            return false;
        } else {
            mostrar_mensaje('❌ Error al registrar asistencia.', 'error');
            return false;
        }
    } catch (e) {
        mostrar_mensaje('❌ Error de conexión al registrar.', 'error');
        return false;
    }
}

async function verificar_sesion_servidor() {
    if (!admin_token) return false;
    
    try {
        const res = await fetch('/api/verificar-sesion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: admin_token })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            return respuesta.sesion_valida;
        } else {
            return false;
        }
    } catch (e) {
        console.warn('Error al verificar sesión:', e);
        return false;
    }
}

async function cerrar_sesion_servidor() {
    if (!admin_token) return;
    
    try {
        await fetch('/api/cerrar-sesion', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: admin_token })
        });
    } catch (e) {
        console.warn('Error al cerrar sesión en servidor:', e);
    }
}

function cerrar_sesion_local() {
    admin_logueado = false;
    admin_token = null;
    document.getElementById('zona_controles')?.classList.add('oculta');
    document.getElementById('panel_login')?.classList.remove('oculta');
    
    // Limpiar campos de login
    document.getElementById('admin_usuario').value = '';
    document.getElementById('admin_clave').value = '';
    
    mostrar_mensaje('🔒 Sesión cerrada automáticamente.', 'advertencia');
}

// --- INICIALIZACIÓN (SÓLO UN DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // ✅ 0. Cargar estado de bloqueo persistente
    cargar_estado_bloqueo();
    
    // ✅ 0.1. Verificar y aplicar bloqueo si corresponde
    const estaBloqueado = verificar_y_aplicar_bloqueo();
    
    // ✅ 0.2. Inicializar estado del formulario (bloqueado por defecto)
    controlar_estado_formulario(false);
    
    // ✅ 1. Sincronización con servidor (menos frecuente para evitar conflictos)
    await cargar_estado_servidor();
    setInterval(cargar_estado_servidor, 10000); // Cada 10 segundos en lugar de 2
    
    // ✅ 1.1. Verificación periódica de sesión de administrador
    setInterval(async () => {
        if (admin_logueado && admin_token) {
            const sesionValida = await verificar_sesion_servidor();
            if (!sesionValida) {
                mostrar_mensaje('⚠️ Tu sesión de administrador ha expirado o fue cerrada desde otro lugar.', 'advertencia');
                cerrar_sesion_local();
            }
        }
    }, 30000); // Cada 30 segundos

    // ✅ 2. Fecha/hora actual
    setInterval(() => {
        const ahora = new Date();
        const elem = document.getElementById('fecha_hora_mostrada');
        if (elem) elem.textContent = formatear_fecha_hora(ahora);
    }, 1000);

    // ✅ 3. Mayúsculas en campos
    ['apellido_paterno', 'apellido_materno', 'nombres', 'cargo_actividad', 'grupo_ocupacional', 'area_trabajo', 'centro_trabajo'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', () => {
                input.value = input.value.toUpperCase();
            });
        }
    });

    // ✅ 4. Validación DNI
    const dni = document.getElementById('dni');
    if (dni) {
        dni.addEventListener('input', () => {
            dni.value = dni.value.replace(/\D/g, '').slice(0, 8);
        });
        dni.addEventListener('paste', e => {
            e.preventDefault();
            const texto = (e.clipboardData || window.clipboardData).getData('text');
            dni.value = texto.replace(/\D/g, '').slice(0, 8);
        });
    }

    // ✅ 5. EVENTO DE LOGIN (¡DENTRO del DOMContentLoaded!)
    const btnLogin = document.getElementById('btn_login_admin');
    if (btnLogin) {
        const loginFunction = async () => {
            // Verificar si está bloqueado por intentos fallidos
            if (bloqueo_hasta && new Date() < bloqueo_hasta) {
                const tiempoRestante = Math.ceil((bloqueo_hasta - new Date()) / 60000);
                mostrar_mensaje(`🔒 Acceso bloqueado. Espera ${tiempoRestante} minutos o cambia de navegador.`, 'error');
                return;
            }
            
            const usuario = document.getElementById('admin_usuario')?.value.trim();
            const clave = document.getElementById('admin_clave')?.value;

            if (!usuario || !clave) {
                mostrar_mensaje('❌ Ingresa usuario y contraseña.', 'error');
                return;
            }

            // Validar en el servidor
            const resultado = await login_admin_servidor(usuario, clave);
            
            if (resultado.exito) {
                admin_logueado = true;
                
                // Resetear intentos fallidos al login exitoso
                limpiar_estado_bloqueo();
                
                // Ocultar panel de login y mostrar controles de admin
                document.getElementById('panel_login')?.classList.add('oculta');
                document.getElementById('zona_controles')?.classList.remove('oculta');
                
                // Ocultar log de intentos si está visible
                document.getElementById('log_intentos')?.classList.add('oculta');
                
                // Cargar estado actualizado y mostrar paneles apropiados
                await cargar_estado_servidor();
                
                // Limpiar campos de login
                document.getElementById('admin_usuario').value = '';
                document.getElementById('admin_clave').value = '';
                
                mostrar_mensaje('✅ Sesión de administrador iniciada.', 'exito');
            } else {
                // Incrementar intentos fallidos
                intentos_fallidos++;
                
                // Verificar si debe bloquearse
                if (intentos_fallidos >= MAX_INTENTOS_FALLIDOS) {
                    bloqueo_hasta = new Date(Date.now() + BLOQUEO_MINUTOS * 60000);
                    guardar_estado_bloqueo(); // Persistir el bloqueo
                    
                    mostrar_mensaje(`❌ ${resultado.mensaje}. Demasiados intentos fallidos. Acceso bloqueado por ${BLOQUEO_MINUTOS} minutos.`, 'error');
                    
                    // Aplicar bloqueo visual inmediatamente
                    verificar_y_aplicar_bloqueo();
                } else {
                    guardar_estado_bloqueo(); // Guardar intentos actuales
                    
                    const intentosRestantes = MAX_INTENTOS_FALLIDOS - intentos_fallidos;
                    mostrar_mensaje(`❌ ${resultado.mensaje}. Te quedan ${intentosRestantes} intentos.`, 'error');
                    
                    // Mostrar log de intentos
                    const logElement = document.getElementById('log_intentos');
                    const textoElement = document.getElementById('texto_intentos');
                    if (logElement && textoElement) {
                        textoElement.textContent = `${intentos_fallidos}/${MAX_INTENTOS_FALLIDOS} intentos fallidos`;
                        logElement.classList.remove('oculta');
                        logElement.style.backgroundColor = '#fff3e0';
                        logElement.style.border = '1px solid #ff9800';
                    }
                }
                
                // Limpiar campos en caso de error
                document.getElementById('admin_clave').value = '';
            }
        };

        btnLogin.addEventListener('click', loginFunction);
        
        // Permitir login con Enter (solo si no está bloqueado)
        document.getElementById('admin_clave')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                // Verificar bloqueo antes de ejecutar
                if (bloqueo_hasta && new Date() < bloqueo_hasta) {
                    const tiempoRestante = Math.ceil((bloqueo_hasta - new Date()) / 60000);
                    mostrar_mensaje(`🔒 Acceso bloqueado. Espera ${tiempoRestante} minutos o cambia de navegador.`, 'error');
                    return;
                }
                loginFunction();
            }
        });
    }

    // ✅ 6. Otros eventos (iniciar/extender, detener, limpiar, etc.)
    document.getElementById('btn_accion_tiempo')?.addEventListener('click', () => {
        const mins = parseInt(document.getElementById('minutos_tiempo')?.value) || 30;
        if (mins >= 1) {
            if (tiempo_restante_segundos > 0) {
                // Temporizador activo: extender tiempo
                extender_temporizador_servidor(mins);
            } else {
                // Temporizador inactivo: iniciar
                iniciar_temporizador_servidor(mins);
            }
        } else {
            mostrar_mensaje('⚠️ Mínimo 1 minuto.', 'error');
        }
    });

    document.getElementById('btn_detener_temporizador')?.addEventListener('click', () => {
        if (confirm('⚠️ ¿Estás seguro de detener el temporizador? Esto cerrará el formulario inmediatamente.')) {
            detener_temporizador_servidor();
        }
    });

    document.getElementById('btn_limpiar_registros')?.addEventListener('click', async () => {
        if (confirm('⚠️ ¿Borrar TODOS los registros?')) {
            try {
                const res = await fetch('/api/limpiar', { 
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ admin_token })
                });
                
                if (res.ok) {
                    await cargar_estado_servidor();
                    mostrar_mensaje('✅ Registros eliminados.', 'exito');
                } else if (res.status === 401) {
                    mostrar_mensaje('❌ Sesión de administrador inválida. Inicia sesión nuevamente.', 'error');
                    cerrar_sesion_local();
                } else {
                    mostrar_mensaje('❌ Error al limpiar registros.', 'error');
                }
            } catch (e) {
                mostrar_mensaje('❌ Error al limpiar.', 'error');
            }
        }
    });

    // Evento de formulario
    document.getElementById('formulario_asistencia')?.addEventListener('submit', async e => {
        e.preventDefault();
        
        // Verificar si el tiempo se agotó
        if (tiempo_restante_segundos <= 0) {
            mostrar_mensaje('⏰ El tiempo para registrar asistencias ha expirado.', 'error');
            return;
        }
        
        // Recopilar datos del formulario
        const datos = {
            apellido_paterno: document.getElementById('apellido_paterno').value.trim(),
            apellido_materno: document.getElementById('apellido_materno').value.trim(),
            nombres: document.getElementById('nombres').value.trim(),
            dni: document.getElementById('dni').value.trim(),
            cargo_actividad: document.getElementById('cargo_actividad').value.trim(),
            grupo_ocupacional: document.getElementById('grupo_ocupacional').value.trim(),
            area_trabajo: document.getElementById('area_trabajo').value.trim(),
            centro_trabajo: document.getElementById('centro_trabajo').value.trim(),
            fecha_hora: formatear_fecha_hora(new Date())
        };

        // Validaciones
        if (!datos.apellido_paterno || !datos.apellido_materno || !datos.nombres || 
            !datos.dni || !datos.cargo_actividad || !datos.grupo_ocupacional || !datos.area_trabajo || !datos.centro_trabajo) {
            mostrar_mensaje('❌ Todos los campos son obligatorios.', 'error');
            return;
        }

        if (datos.dni.length !== 8) {
            mostrar_mensaje('❌ El DNI debe tener exactamente 8 dígitos.', 'error');
            return;
        }

        // Verificar si ya está registrado
        if (registros_acumulados.some(r => r.dni === datos.dni)) {
            mostrar_mensaje('⚠️ Este DNI ya está registrado.', 'advertencia');
            return;
        }

        // Enviar al servidor
        const exito = await registrar_asistencia_servidor(datos);
        if (exito) {
            mostrar_mensaje('✅ Asistencia registrada correctamente.', 'exito');
            
            // Limpiar formulario
            document.getElementById('formulario_asistencia').reset();
            
            // Actualizar estado
            await cargar_estado_servidor();
        }
    });


    // Descarga Excel
    document.getElementById('btn_descargar_excel')?.addEventListener('click', async () => {
        if (admin_logueado) {
            try {
                // Obtener registros actualizados del servidor
                await cargar_estado_servidor();
                
                if (registros_acumulados.length > 0) {
                    // Descargar directamente desde el servidor
                    const link = document.createElement('a');
                    link.href = '/api/descargar-excel';
                    link.download = `asistencias_${new Date().toISOString().slice(0,10)}.xlsx`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                    
                    mostrar_mensaje('✅ Excel descargado correctamente.', 'exito');
                } else {
                    mostrar_mensaje('⚠️ No hay registros para descargar.', 'advertencia');
                }
            } catch (e) {
                mostrar_mensaje('❌ Error al generar Excel.', 'error');
            }
        } else {
            mostrar_mensaje('❌ Debes estar logueado como administrador.', 'error');
        }
    });

    document.getElementById('btn_cerrar_sesion')?.addEventListener('click', async () => {
        // Cerrar sesión en el servidor
        await cerrar_sesion_servidor();
        
        // Cerrar sesión localmente
        cerrar_sesion_local();
        
        mostrar_mensaje('🔒 Sesión cerrada correctamente.', 'exito');
    });
});