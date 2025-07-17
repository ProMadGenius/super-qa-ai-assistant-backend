#!/bin/bash

# Script para probar el endpoint /api/analyze-ticket con curl usando el archivo de ejemplo EN-8775-full.json

echo "🚀 Probando endpoint /api/analyze-ticket con curl..."
echo "📄 Usando datos de ejemplo/EN-8775-full.json"
echo ""

# Ejecutar curl con el archivo de ejemplo
curl -X POST \
  -H "Content-Type: application/json" \
  -d @example/EN-8775-full.json \
  http://localhost:3000/api/analyze-ticket \
  -o curl-analyze-result.json

# Verificar si la solicitud fue exitosa
if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Solicitud completada. Resultado guardado en curl-analyze-result.json"
  
  # Mostrar un resumen del resultado
  echo ""
  echo "📋 Resumen del resultado:"
  
  # Extraer información clave del resultado usando jq si está disponible
  if command -v jq &> /dev/null; then
    echo "   • Modelo AI: $(jq -r '.metadata.aiModel' curl-analyze-result.json)"
    echo "   • Tiempo de generación: $(jq -r '.metadata.generationTime' curl-analyze-result.json)ms"
    echo "   • Criterios de aceptación: $(jq -r '.acceptanceCriteria | length' curl-analyze-result.json)"
    echo "   • Casos de prueba: $(jq -r '.testCases | length' curl-analyze-result.json)"
    echo "   • Advertencias: $(jq -r '.configurationWarnings | length' curl-analyze-result.json)"
  else
    echo "   • Para ver más detalles, instala jq o revisa el archivo curl-analyze-result.json"
  fi
else
  echo ""
  echo "❌ Error al realizar la solicitud. Verifica que el servidor esté en ejecución."
  echo "   Ejecuta: npm run dev"
fi