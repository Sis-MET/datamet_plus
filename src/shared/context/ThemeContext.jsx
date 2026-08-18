// La aplicación tiene una única apariencia oscura. Se conserva este hook como
// contrato interno mientras los componentes compartidos terminan de migrar a
// tokens estáticos, pero ya no existe estado, persistencia ni selector de tema.
export function useTheme() {
  return { isDarkGantt: true };
}
