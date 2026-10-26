/**
 * Freno a los intentos fallidos de inicio de sesión, en memoria.
 *
 * - Por usuario y equipo (IP): 3 fallos seguidos bloquean ese usuario desde
 *   ese equipo durante 60 s. Así nadie puede bloquear a un colega desde otro
 *   equipo con contraseñas al azar.
 * - Por equipo: 20 fallos en 15 min, con cualquier usuario, bloquean el
 *   equipo 15 min (probar una contraseña contra muchos usuarios).
 *
 * Se reinicia con el servidor, lo que basta para la red de la oficina.
 */
const POR_USUARIO = { intentos: 3, bloqueoMs: 60 * 1000 };
const POR_EQUIPO = { intentos: 20, ventanaMs: 15 * 60 * 1000, bloqueoMs: 15 * 60 * 1000 };
const MAX_REGISTROS = 5000;

const bloqueo = (remainingSecs, message) => Object.assign(new Error(message), { statusCode: 429, remainingSecs });

const crearLimitador = ({ now = Date.now, porUsuario = POR_USUARIO, porEquipo = POR_EQUIPO } = {}) => {
  const usuarios = new Map(); // `usuario|ip` -> { fallos, hasta }
  const equipos = new Map(); // ip -> { fallos, desde, hasta }

  const clave = (usuario, ip) => `${String(usuario ?? '').trim().toLowerCase()}|${ip}`;
  const segundosHasta = hasta => Math.ceil((hasta - now()) / 1000);
  const vencido = (registro, t) => Boolean(registro.hasta) && registro.hasta <= t;
  const fueraDeVentana = (registro, t) => registro.desde + porEquipo.ventanaMs <= t;

  // Solo se limpia si se acumulan muchos registros (p. ej., un barrido de usuarios).
  const limpiar = (t) => {
    if (usuarios.size + equipos.size < MAX_REGISTROS) return;
    for (const [k, r] of usuarios) if (!r.hasta || vencido(r, t)) usuarios.delete(k);
    for (const [k, r] of equipos) if (r.hasta ? vencido(r, t) : fueraDeVentana(r, t)) equipos.delete(k);
  };

  /** Lanza un 429 si el equipo o ese usuario en ese equipo están bloqueados. */
  const verificar = ({ usuario, ip }) => {
    const t = now();
    const equipo = equipos.get(ip);
    if (equipo?.hasta > t) {
      const segundos = segundosHasta(equipo.hasta);
      throw bloqueo(segundos, `Demasiados intentos fallidos desde este equipo. Intente nuevamente en ${Math.ceil(segundos / 60)} minutos.`);
    }
    const registro = usuarios.get(clave(usuario, ip));
    if (registro?.hasta > t) {
      const segundos = segundosHasta(registro.hasta);
      throw bloqueo(segundos, `Cuenta bloqueada. Intente nuevamente en ${segundos} segundos`);
    }
  };

  /** Cuenta una contraseña o un usuario incorrectos. */
  const fallo = ({ usuario, ip }) => {
    const t = now();
    limpiar(t);

    const k = clave(usuario, ip);
    const previo = usuarios.get(k);
    const registro = previo && !vencido(previo, t) ? previo : { fallos: 0, hasta: null };
    registro.fallos += 1;
    if (registro.fallos >= porUsuario.intentos) registro.hasta = t + porUsuario.bloqueoMs;
    usuarios.set(k, registro);

    const anterior = equipos.get(ip);
    const equipo = anterior && !vencido(anterior, t) && !fueraDeVentana(anterior, t)
      ? anterior
      : { fallos: 0, desde: t, hasta: null };
    equipo.fallos += 1;
    if (equipo.fallos >= porEquipo.intentos) equipo.hasta = t + porEquipo.bloqueoMs;
    equipos.set(ip, equipo);
  };

  /** Ingreso correcto: se olvidan los fallos de ese usuario en ese equipo. */
  const exito = ({ usuario, ip }) => {
    usuarios.delete(clave(usuario, ip));
  };

  return { verificar, fallo, exito };
};

module.exports = { crearLimitador, POR_USUARIO, POR_EQUIPO };
