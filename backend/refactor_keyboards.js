const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'src/bot/states');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.state.js'));

files.forEach(file => {
  let content = fs.readFileSync(path.join(dir, file), 'utf8');

  // Replace import
  content = content.replace(
    /const\s*\{[^}]+\}\s*=\s*require\('\.\.\/keyboards'\);/g,
    "const keyboards = require('../keyboards');"
  );

  // Replace usages. The state handlers receive `(mensaje, conversacion, usuario)`
  // Usually they do: `teclado: TIPO_CLIENTE` -> `teclado: await keyboards.get('TIPO_CLIENTE', conversacion.empresa_id)`
  // Or `teclado: AREAS` -> `teclado: await keyboards.get('AREAS', conversacion.empresa_id)`

  const staticKeyboards = [
    'AREAS', 'EMPRESAS', 'ENCUESTA', 'CONFIRMAR_CUENTA', 'CONFIRMAR_INTENCION',
    'TIPO_CLIENTE', 'TIPO_IDENTIFICACION', 'AUTOSERVICIO', 'AUTOSERVICIO_BASICO',
    'OTRA_CONSULTA', 'OTRA_CONSULTA_MULTI'
  ];

  staticKeyboards.forEach(kb => {
    // Regex for exactly `teclado: KB,` or `teclado: KB`
    const regex = new RegExp(`teclado:\\s*${kb}\\b`, 'g');
    content = content.replace(regex, `teclado: await keyboards.get('${kb}', conversacion.empresa_id)`);
  });

  // Re-map function usages
  content = content.replace(/generarTecladoServicios\(/g, 'keyboards.generarTecladoServicios(');
  content = content.replace(/generarTecladoAmbiguo\(/g, 'keyboards.generarTecladoAmbiguo(');
  content = content.replace(/getAutoservicioKeyboard\(([^)]+)\)/g, 'await keyboards.getAutoservicioKeyboard($1, conversacion.empresa_id)');
  content = content.replace(/getOtraConsultaKeyboard\(([^)]+)\)/g, 'await keyboards.getOtraConsultaKeyboard($1, conversacion.empresa_id)');

  fs.writeFileSync(path.join(dir, file), content);
});

console.log('Refactor complete');
