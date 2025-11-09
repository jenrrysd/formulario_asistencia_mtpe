#!/usr/bin/env python3
"""
Script de prueba para verificar las dependencias del formulario de asistencia
"""

def verificar_dependencias():
    dependencias = {
        'Flask': 'flask',
        'openpyxl': 'openpyxl'
    }
    
    print("🔍 Verificando dependencias...")
    print("-" * 40)
    
    faltantes = []
    
    for nombre, modulo in dependencias.items():
        try:
            __import__(modulo)
            print(f"✅ {nombre}: OK")
        except ImportError:
            print(f"❌ {nombre}: FALTANTE")
            faltantes.append(modulo)
    
    print("-" * 40)
    
    if faltantes:
        print(f"⚠️  Instala las dependencias faltantes:")
        print(f"pip install {' '.join(faltantes)}")
        return False
    else:
        print("🎉 Todas las dependencias están instaladas!")
        return True

def verificar_archivos():
    import os
    archivos_requeridos = [
        'servidor.py',
        'index.html',
        'script.js',
        'estilo.css',
        'requirements.txt',
        '.env.example'
    ]
    
    print("\n📁 Verificando archivos del proyecto...")
    print("-" * 40)
    
    faltantes = []
    for archivo in archivos_requeridos:
        if os.path.exists(archivo):
            print(f"✅ {archivo}: OK")
        else:
            print(f"❌ {archivo}: FALTANTE")
            faltantes.append(archivo)
    
    print("-" * 40)
    
    if faltantes:
        print(f"⚠️  Archivos faltantes: {', '.join(faltantes)}")
        return False
    else:
        print("🎉 Todos los archivos están presentes!")
        return True

if __name__ == "__main__":
    print("🧪 Verificación del Formulario de Asistencia HNERM-USST")
    print("=" * 60)
    
    deps_ok = verificar_dependencias()
    archivos_ok = verificar_archivos()
    
    if deps_ok and archivos_ok:
        print("\n🚀 ¡El proyecto está listo para ejecutarse!")
        print("Ejecuta: python3 servidor.py")
    else:
        print("\n⚠️  Resuelve los problemas antes de continuar.")