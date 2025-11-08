from flask import Flask, jsonify, request, send_from_directory
import json, logging
import os, socket
from datetime import datetime
import hashlib

# Cargar configuración desde archivo .env si existe
def cargar_configuracion():
    admin_usuario = 'admin'  # Valor por defecto
    admin_clave = 'usst2025'  # Valor por defecto
    
    if os.path.exists('.env'):
        try:
            with open('.env', 'r') as f:
                for linea in f:
                    if '=' in linea and not linea.strip().startswith('#'):
                        clave, valor = linea.strip().split('=', 1)
                        if clave == 'ADMIN_USUARIO':
                            admin_usuario = valor
                        elif clave == 'ADMIN_CLAVE':
                            admin_clave = valor
        except:
            pass  # Si hay error, usar valores por defecto
    
    return admin_usuario, admin_clave

# Configuración de seguridad
ADMIN_USUARIO, ADMIN_CLAVE = cargar_configuracion()
ADMIN_CLAVE_HASH = hashlib.sha256(ADMIN_CLAVE.encode()).hexdigest()

def obtener_ip_local():
    """Obtiene la IP LAN de la máquina (ej: 192.168.1.87)"""
    try:
        # Método 1: Conexión simulada a una IP externa (no se envía tráfico)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))  # Google DNS
        ip = s.getsockname()[0]
        s.close()
        return ip
    except:
        # Método 2: Fallback (puede devolver 127.0.0.1)
        return socket.gethostbyname(socket.gethostname())

# ✅ Desactivar logs HTTP innecesarios
log = logging.getLogger('werkzeug')
log.setLevel(logging.ERROR)

app = Flask(__name__)
ESTADO_ARCHIVO = 'estado.json'

def cargar_estado():
    if os.path.exists(ESTADO_ARCHIVO):
        with open(ESTADO_ARCHIVO, 'r', encoding='utf-8') as f:
            estado = json.load(f)
            # Calcular tiempo restante real basado en el tiempo transcurrido
            if estado.get('ultimo_inicio'):
                try:
                    inicio = datetime.fromisoformat(estado['ultimo_inicio'])
                    ahora = datetime.now()
                    transcurrido = int((ahora - inicio).total_seconds())
                    tiempo_inicial = estado.get('tiempo_inicial', 0)
                    tiempo_restante = max(0, tiempo_inicial - transcurrido)
                    estado['tiempo_restante'] = tiempo_restante
                except:
                    estado['tiempo_restante'] = 0
            return estado
    return {
        "tiempo_restante": 0,
        "tiempo_inicial": 0,
        "registros": [],
        "admin_logueado": False,
        "ultimo_inicio": None
    }

def guardar_estado(estado):
    with open(ESTADO_ARCHIVO, 'w', encoding='utf-8') as f:
        json.dump(estado, f, ensure_ascii=False, indent=2)

@app.route('/api/login', methods=['POST'])
def login_admin():
    data = request.json
    usuario = data.get('usuario', '').strip()
    clave = data.get('clave', '')
    
    # Validar credenciales
    if usuario == ADMIN_USUARIO:
        clave_hash = hashlib.sha256(clave.encode()).hexdigest()
        if clave_hash == ADMIN_CLAVE_HASH:
            return jsonify({
                "ok": True,
                "mensaje": "Login exitoso",
                "admin_token": hashlib.sha256(f"{usuario}{clave}{datetime.now().isoformat()}".encode()).hexdigest()[:16]
            })
    
    return jsonify({
        "ok": False,
        "error": "Credenciales incorrectas"
    }), 401

@app.route('/api/estado', methods=['GET'])
def obtener_estado():
    return jsonify(cargar_estado())

@app.route('/api/iniciar', methods=['POST'])
def iniciar_temporizador():
    data = request.json
    minutos = data.get('minutos', 30)
    tiempo_segundos = minutos * 60
    
    estado = cargar_estado()
    estado['tiempo_restante'] = tiempo_segundos
    estado['tiempo_inicial'] = tiempo_segundos  # Guardar tiempo inicial para cálculos
    estado['ultimo_inicio'] = datetime.now().isoformat()
    guardar_estado(estado)
    
    return jsonify({
        "ok": True, 
        "tiempo": estado['tiempo_restante'],
        "minutos": minutos,
        "mensaje": f"Temporizador iniciado por {minutos} minutos"
    })

@app.route('/api/registrar', methods=['POST'])
def registrar_asistencia():
    data = request.json
    estado = cargar_estado()
    
    # Verificar si el tiempo ha expirado
    if estado['tiempo_restante'] <= 0:
        return jsonify({
            "ok": False, 
            "error": "El tiempo para registrar asistencias ha expirado"
        }), 400
    
    # Añadir fecha/hora del servidor (más confiable)
    data['fecha_hora_servidor'] = datetime.now().strftime('%d/%m/%Y %H:%M:%S')
    estado['registros'].append(data)
    guardar_estado(estado)
    
    return jsonify({
        "ok": True, 
        "total": len(estado['registros']),
        "tiempo_restante": estado['tiempo_restante']
    })

@app.route('/api/extender', methods=['POST'])
def extender_temporizador():
    data = request.json
    minutos_extra = data.get('minutos', 10)
    
    estado = cargar_estado()
    
    # Si hay un temporizador activo, extender el tiempo
    if estado.get('ultimo_inicio') and estado.get('tiempo_inicial', 0) > 0:
        # Calcular el nuevo tiempo inicial total
        segundos_extra = minutos_extra * 60
        estado['tiempo_inicial'] += segundos_extra
        
        # Recalcular el tiempo restante
        try:
            inicio = datetime.fromisoformat(estado['ultimo_inicio'])
            ahora = datetime.now()
            transcurrido = int((ahora - inicio).total_seconds())
            tiempo_restante = max(0, estado['tiempo_inicial'] - transcurrido)
            estado['tiempo_restante'] = tiempo_restante
        except:
            estado['tiempo_restante'] = segundos_extra
            
        guardar_estado(estado)
        
        return jsonify({
            "ok": True,
            "tiempo_restante": estado['tiempo_restante'],
            "minutos_agregados": minutos_extra,
            "mensaje": f"Se agregaron {minutos_extra} minutos al temporizador"
        })
    else:
        return jsonify({
            "ok": False,
            "error": "No hay un temporizador activo para extender"
        }), 400

@app.route('/api/detener', methods=['POST'])
def detener_temporizador():
    estado = cargar_estado()
    estado['tiempo_restante'] = 0
    estado['tiempo_inicial'] = 0
    estado['ultimo_inicio'] = None
    guardar_estado(estado)
    
    return jsonify({
        "ok": True,
        "mensaje": "Temporizador detenido y formulario cerrado"
    })

@app.route('/api/limpiar', methods=['POST'])
def limpiar_registros():
    estado = cargar_estado()
    estado['registros'] = []
    guardar_estado(estado)
    return jsonify({"ok": True, "total": 0})

@app.route('/api/descargar', methods=['GET'])
def descargar_csv():
    estado = cargar_estado()
    if not estado['registros']:
        return 'No hay registros', 404
    
    # Generar CSV
    lineas = ['Apellido Paterno,Apellido Materno,Nombres,DNI,Cargo,Puesto,Área,Fecha y Hora']
    for r in estado['registros']:
        linea = [
            r.get('apellido_paterno', ''),
            r.get('apellido_materno', ''),
            r.get('nombres', ''),
            r.get('dni', ''),
            r.get('cargo_puesto', ''),
            r.get('area_seccion', ''),
            r.get('fecha_hora_servidor', '')
        ]
        # Escapar comas y comillas
        linea = ['"' + str(x).replace('"', '""') + '"' if ',' in str(x) or '"' in str(x) else str(x) for x in linea]
        lineas.append(','.join(linea))
    
    csv = '\n'.join(lineas)
    return csv, 200, {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="asistencias.csv"'
    }

# Servir archivos estáticos (HTML, CSS, JS)
@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# ✅ Sirve CSS, JS y otros archivos desde la misma carpeta
@app.route('/<path:filename>')
def archivos_estaticos(filename):
    # Solo permitir archivos que existan y no sean peligrosos
    if os.path.isfile(filename) and not filename.startswith('.'):
        return send_from_directory('.', filename)
    return "Archivo no encontrado", 404

if __name__ == '__main__':
    ip_local = obtener_ip_local()
    print(f"Servidor iniciado en http://{ip_local}:8080")
    print("Servidor iniciado en http://localhost:8080")
    print("Presiona Ctrl+C para detener el servidor.")

    app.run(host='0.0.0.0', port=8080, debug=True)