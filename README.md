# 📋 Formulario de Asistencia - HNERM USST

Sistema web para registro de asistencias en sesiones de inducción de Seguridad y Salud en el Trabajo.

![Python](https://img.shields.io/badge/Python-3.7+-blue.svg)
![Flask](https://img.shields.io/badge/Flask-2.0+-green.svg)
![JavaScript](https://img.shields.io/badge/JavaScript-ES6-yellow.svg)
![License](https://img.shields.io/badge/License-MIT-red.svg)

## 🚀 Características

- ✅ **Registro de asistencias** con validación de DNI
- ⏱️ **Temporizador configurable** para sesiones
- 👨‍💼 **Panel de administración** seguro
- 📊 **Exportación a Excel (.xlsx)** con formato profesional
-  **Sistema de autenticación** robusto
- 📱 **Interfaz responsive** para dispositivos móviles
- 🧹 **Gestión de registros** (limpiar, descargar)
- ⏰ **Extensión de tiempo** en vivo

## 📖 Instalación

### Requisitos
- Python 3.7 o superior
- Flask 2.0+
- openpyxl (para exportación Excel)
- Navegador web moderno

### Pasos de instalación

1. **Clona el repositorio**:
```bash
git clone https://github.com/tu-usuario/formulario-asistencia.git
cd formulario-asistencia
```

2. **Instala las dependencias**:
```bash
pip install -r requirements.txt
```

3. **Configura las credenciales**:
```bash
cp .env.example .env
# Edita .env con tus credenciales personalizadas
```

4. **Inicia el servidor**:
```bash
python3 servidor.py
```

5. **Accede a la aplicación**:
```
http://localhost:8080
```

## 🔐 Configuración de Seguridad

### Credenciales de Administrador

Las credenciales están protegidas y NO están expuestas en el código JavaScript.

#### Configuración por defecto:
- **Usuario**: `admin`
- **Contraseña**: `usst2025`

#### Personalizar credenciales:

1. Copia el archivo de ejemplo:
```bash
cp .env.example .env
```

2. Edita el archivo `.env`:
```bash
ADMIN_USUARIO=tu_usuario_personalizado
ADMIN_CLAVE=tu_contraseña_muy_segura_123!
```

3. Reinicia el servidor para aplicar los cambios.

### Medidas de Seguridad Implementadas:

✅ **Contraseñas hasheadas**: Las contraseñas se almacenan como hash SHA-256
✅ **Validación en servidor**: La autenticación se hace en el backend, no en el frontend  
✅ **Tokens de sesión**: Se generan tokens únicos para cada sesión
✅ **Archivo .env protegido**: Las credenciales están en un archivo separado
✅ **Gitignore configurado**: Los archivos sensibles no se suben a repositorios

## 🎯 Uso

### Para Participantes:
1. Ingresa tus datos personales en el formulario
2. Asegúrate de que todos los campos estén completos
3. Haz clic en "Registrar Asistencia"

### Para Administradores:
1. Desplázate hasta la sección "🔐 Acceso de Administrador"
2. Ingresa tus credenciales
3. Configura el tiempo de la sesión
4. Monitorea las asistencias en tiempo real
5. Descarga el archivo CSV al finalizar

## 📊 Capacidad

- **Registros soportados**: Hasta 500+ sin problemas de rendimiento
- **Tamaño máximo estimado**: ~250 KB para 500 registros
- **Formato de exportación**: Excel (.xlsx) con estilos profesionales
- **Campos por registro**: 9 campos principales + timestamp del servidor

## 🛠️ Arquitectura

### Backend (Python/Flask):
- `servidor.py`: Servidor principal con API REST
- Almacenamiento en JSON para simplicidad
- Endpoints para autenticación, registros y gestión

### Frontend (HTML/CSS/JavaScript):
- `index.html`: Interfaz principal
- `estilo.css`: Estilos responsive
- `script.js`: Lógica de interfaz y comunicación con API

### Archivos de Configuración:
- `.env`: Credenciales (no incluido en repo)
- `.env.example`: Plantilla de configuración
- `estado.json`: Estado actual del sistema
- `.gitignore`: Archivos excluidos del repositorio

## 🔄 API Endpoints

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| `POST` | `/api/login` | Autenticación de administrador |
| `GET` | `/api/estado` | Estado actual del sistema |
| `POST` | `/api/iniciar` | Iniciar temporizador |
| `POST` | `/api/extender` | Extender tiempo de sesión |
| `POST` | `/api/detener` | Detener temporizador |
| `POST` | `/api/registrar` | Registrar nueva asistencia |
| `POST` | `/api/limpiar` | Limpiar todos los registros |
| `GET` | `/api/descargar-excel` | Descargar Excel (.xlsx) |

## 🤝 Contribuir

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👨‍💻 Autor

Desarrollado para HNERM - Unidad de Seguridad y Salud en el Trabajo (USST)

## 🆘 Soporte

Si encuentras algún problema o tienes sugerencias:

1. Revisa los [Issues existentes](../../issues)
2. Crea un [Nuevo Issue](../../issues/new) si no existe
3. Describe el problema detalladamente

---

**Nota**: Este sistema está diseñado para uso interno y cumple con las normativas de seguridad básicas. Para entornos de producción, considera implementar HTTPS y auditorías adicionales.