// --- CONFIGURACIÓN ---
// Las credenciales ahora se validan en el servidor por seguridad
const MAX_INTENTOS_FALLIDOS = 3;
const BLOQUEO_MINUTOS = 2;

// --- Variables globales ---
let registros_acumulados = [];
let tiempo_restante_segundos = 0;
let admin_logueado = false;
let admin_token = null; // Token de sesión del admin
let intentos_fallidos = 0;
let bloqueo_hasta = null;
let temporizador_local = null;

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

function escapar_csv(campo) {
    if (typeof campo !== 'string') campo = String(campo);
    if (/^\d{8}$/.test(campo) && campo.startsWith('0')) {
        campo = "'" + campo;
    }
    if (campo.includes(',') || campo.includes('"') || campo.includes('\n')) {
        campo = '"' + campo.replace(/"/g, '""') + '"';
    }
    return campo;
}

function generar_csv_completo() {
    if (registros_acumulados.length === 0) throw new Error('No hay registros');
    
    const encabezados = ['Apellido Paterno','Apellido Materno','Nombres','DNI','Cargo / Puesto','Área / Sección / Servicio','Fecha y Hora'];
    const filas = registros_acumulados.map(r => [
        r.apellido_paterno, r.apellido_materno, r.nombres, r.dni, r.cargo_puesto, r.area_seccion, r.fecha_hora
    ]);
    
    return [
        encabezados.map(escapar_csv).join(','),
        ...filas.map(f => f.map(escapar_csv).join(','))
    ].join('\n');
}

function descargar_archivo(contenido, nombre) {
    const blob = new Blob([contenido], { type: 'text/csv;charset=utf-8;\uFEFF' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }, 100);
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

function actualizar_temporizador_ui(segundos) {
    tiempo_restante_segundos = segundos;
    const mins = Math.floor(segundos / 60);
    const segs = segundos % 60;
    
    const tiempo_elem = document.getElementById('tiempo_restante');
    if (tiempo_elem) {
        tiempo_elem.textContent = `${String(mins).padStart(2, '0')}:${String(segs).padStart(2, '0')}`;
    }

    // Actualizar botón de registro
    const btn = document.getElementById('btn_registrar');
    if (btn) {
        btn.disabled = (segundos <= 0);
        btn.textContent = segundos <= 0 ? '⏰ Tiempo Agotado' : 'Registrar Asistencia';
        
        // Cambiar color del botón según el estado
        if (segundos <= 0) {
            btn.classList.add('btn-deshabilitado');
        } else {
            btn.classList.remove('btn-deshabilitado');
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
        mostrar_mensaje('⏰ Tiempo agotado. El formulario se ha cerrado.', 'error');
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
            body: JSON.stringify({ minutos })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            // Iniciar temporizador local inmediatamente
            iniciar_temporizador_local(respuesta.tiempo);
            mostrar_mensaje(`✅ Temporizador iniciado: ${minutos} minutos`, 'exito');
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
            body: JSON.stringify({ minutos })
        });
        
        if (res.ok) {
            const respuesta = await res.json();
            // Actualizar temporizador local con el nuevo tiempo
            iniciar_temporizador_local(respuesta.tiempo_restante);
            mostrar_mensaje(`✅ Se agregaron ${minutos} minutos al temporizador`, 'exito');
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
            headers: { 'Content-Type': 'application/json' }
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

// --- INICIALIZACIÓN (SÓLO UN DOMContentLoaded) ---
document.addEventListener('DOMContentLoaded', async () => {
    // ✅ 1. Sincronización con servidor (menos frecuente para evitar conflictos)
    await cargar_estado_servidor();
    setInterval(cargar_estado_servidor, 10000); // Cada 10 segundos en lugar de 2

    // ✅ 2. Fecha/hora actual
    setInterval(() => {
        const ahora = new Date();
        const elem = document.getElementById('fecha_hora_mostrada');
        if (elem) elem.textContent = formatear_fecha_hora(ahora);
    }, 1000);

    // ✅ 3. Mayúsculas en campos
    ['apellido_paterno', 'apellido_materno', 'nombres', 'cargo_puesto', 'area_seccion'].forEach(id => {
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
                
                // Ocultar panel de login y mostrar controles de admin
                document.getElementById('panel_login')?.classList.add('oculta');
                document.getElementById('zona_controles')?.classList.remove('oculta');
                
                // Cargar estado actualizado y mostrar paneles apropiados
                await cargar_estado_servidor();
                
                // Limpiar campos de login
                document.getElementById('admin_usuario').value = '';
                document.getElementById('admin_clave').value = '';
                
                mostrar_mensaje('✅ Sesión de administrador iniciada.', 'exito');
            } else {
                mostrar_mensaje(`❌ ${resultado.mensaje}`, 'error');
                // Limpiar campos en caso de error
                document.getElementById('admin_clave').value = '';
            }
        };

        btnLogin.addEventListener('click', loginFunction);
        
        // Permitir login con Enter
        document.getElementById('admin_clave')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') loginFunction();
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
                await fetch('/api/limpiar', { method: 'POST' });
                await cargar_estado_servidor();
                mostrar_mensaje('✅ Registros eliminados.', 'exito');
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
            cargo_puesto: document.getElementById('cargo_puesto').value.trim(),
            area_seccion: document.getElementById('area_seccion').value.trim(),
            fecha_hora: formatear_fecha_hora(new Date())
        };

        // Validaciones
        if (!datos.apellido_paterno || !datos.apellido_materno || !datos.nombres || 
            !datos.dni || !datos.cargo_puesto || !datos.area_seccion) {
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

    // Eventos de admin (descargar, cerrar sesión, etc.)
    document.getElementById('btn_descargar_todo')?.addEventListener('click', async () => {
        if (admin_logueado) {
            try {
                // Obtener registros actualizados del servidor
                await cargar_estado_servidor();
                
                if (registros_acumulados.length > 0) {
                    const csv = generar_csv_completo();
                    descargar_archivo(csv, `asistencias_${new Date().toISOString().slice(0,10)}.csv`);
                    mostrar_mensaje('✅ CSV descargado correctamente.', 'exito');
                } else {
                    mostrar_mensaje('⚠️ No hay registros para descargar.', 'advertencia');
                }
            } catch (e) {
                mostrar_mensaje('❌ Error al generar CSV.', 'error');
            }
        } else {
            mostrar_mensaje('❌ Debes estar logueado como administrador.', 'error');
        }
    });

    document.getElementById('btn_cerrar_sesion')?.addEventListener('click', () => {
        admin_logueado = false;
        admin_token = null; // Limpiar token de seguridad
        document.getElementById('zona_controles')?.classList.add('oculta');
        document.getElementById('panel_login')?.classList.remove('oculta');
        
        // Limpiar campos de login
        document.getElementById('admin_usuario').value = '';
        document.getElementById('admin_clave').value = '';
        
        mostrar_mensaje('🔒 Sesión cerrada.', 'exito');
    });
});