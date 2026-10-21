/**
 * Reparte los bloques en hojas A4: mide cada bloque y empieza una hoja
 * nueva cuando no cabe o cuando la plantilla Excel empezaba una ahí.
 */
export function paginar(alturas, disponible, saltos) {
  const paginas = [[]];
  let usado = 0;
  alturas.forEach((altura, index) => {
    const actual = paginas[paginas.length - 1];
    const forzar = saltos[index] && actual.length > 0;
    if (actual.length > 0 && (forzar || usado + altura > disponible)) {
      paginas.push([index]);
      usado = altura;
    } else {
      actual.push(index);
      usado += altura;
    }
  });
  return paginas;
}
