import { describe, expect, it } from 'vitest';
import {
  accesoPorPermiso, allowedView, canUseView, enPruebas, esperaPermisos, findSection, getNavigation, managesCalibration, soloConsulta, tienePermiso,
  veControlCambios,
} from './navigation';

const calibracion = { area: 'Calibración', acceso_cron: '2' };
const soporte = { area: 'Soporte Técnico', acceso_cron: 2 };
const comercial = { area: 'Comercial', acceso_cron: '2' };
const sistemas = { area: 'Administración', cargo: 'Auxiliar de Sistemas', acceso_cron: '3' };
// Lo que da /api/sistema/permisos/mios a un jefe de área (de cualquier área).
const TIEMPOS = ['tiempos.soporte.ver', 'tiempos.calibracion.ver'];
const jefe = (user) => ({ ...user, cargo: 'Jefe de Area', permisos: TIEMPOS });

describe('acceso a los apartados por área', () => {
  it('cada apartado lo usa su área y Sistemas entra a todos', () => {
    expect(canUseView('calibration', calibracion)).toBe(true);
    expect(canUseView('calibration', soporte)).toBe(false);
    expect(canUseView('soporte', soporte)).toBe(true);
    expect(canUseView('soporte', { area: ' soporte tecnico ' })).toBe(true);
    expect(canUseView('soporte', calibracion)).toBe(false);
    for (const view of ['calibration', 'soporte', 'ivmet']) expect(canUseView(view, sistemas)).toBe(true);
    for (const view of ['calibration', 'ivmet']) expect(canUseView(view, comercial)).toBe(false);
    // Comercial consulta Soporte técnico (informes emitidos y próximos servicios).
    expect(canUseView('soporte', comercial)).toBe(true);
    // Gestión IvMET: por ahora solo Sistemas, aunque el área coincida con algo.
    expect(canUseView('ivmet', { area: 'Sistemas', acceso_cron: '2' })).toBe(false);
    // Los demás apartados son de todos.
    expect(canUseView('rim', comercial)).toBe(true);
    expect(canUseView('calendar', comercial)).toBe(true);
  });

  it('todos ven los apartados de área en el menú, con candado si no son suyos', () => {
    const menu = getNavigation(comercial);
    const ids = menu.map(view => view.id);
    expect(ids).toEqual(expect.arrayContaining(['rim', 'calendar', 'calibration', 'soporte', 'ivmet']));
    expect(ids).not.toContain('changes');
    expect(menu.filter(view => view.locked).map(view => view.id)).toEqual(['calibration', 'ivmet']);
    expect(getNavigation(sistemas).some(view => view.locked)).toBe(false);
    expect(getNavigation(soporte).filter(view => view.locked).map(view => view.id)).toEqual(['calibration', 'comercial', 'ivmet']);
  });

  it('Comercial lo usa su área; Administración y Gerencia solo lo consultan', () => {
    const administracion = { area: 'Administración', acceso_cron: '2' };
    const gerencia = { area: 'Gerencia', acceso_cron: '1' };
    expect(canUseView('comercial', comercial)).toBe(true);
    expect(soloConsulta('comercial', comercial)).toBe(false);
    for (const user of [administracion, gerencia]) {
      expect(canUseView('comercial', user)).toBe(true);
      expect(soloConsulta('comercial', user)).toBe(true);
    }
    expect(canUseView('comercial', calibracion)).toBe(false);
    const secciones = getNavigation(administracion).find(view => view.id === 'comercial').sections.map(section => section.id);
    expect(secciones).toEqual(['facturas', 'cobranza', 'pagos', 'reportes', 'comisiones', 'bitrix']);
  });

  it('los apartados de área se abren siempre; los de Sistemas solo para Sistemas', () => {
    expect(allowedView('ivmet', comercial)).toBe('ivmet');
    expect(allowedView('soporte', comercial)).toBe('soporte');
    expect(allowedView('changes', comercial)).toBe('rim');
    expect(allowedView('changes', sistemas)).toBe('changes');
    expect(allowedView('inexistente', sistemas)).toBe('rim');
  });

  it('el jefe de Calibración entra a Control de cambios para aprobar, no a Registro de fallas', () => {
    const jefeCalibracion = { area: 'Calibración', cargo: 'Jefe de Area', acceso_cron: '1' };
    const jefeSoporte = { area: 'Soporte Técnico', cargo: 'Jefe de Área', acceso_cron: '1' };
    expect(veControlCambios(jefeCalibracion)).toBe(true);
    expect(veControlCambios(sistemas)).toBe(true);
    for (const otro of [calibracion, jefeSoporte, comercial, null]) expect(veControlCambios(otro)).toBe(false);
    expect(allowedView('changes', jefeCalibracion)).toBe('changes');
    expect(allowedView('failures', jefeCalibracion)).toBe('rim');
    expect(allowedView('changes', calibracion)).toBe('rim');
    const sistema = getNavigation(jefeCalibracion).filter(view => view.group === 'system').map(view => view.id);
    expect(sistema).toEqual(['changes']);
    expect(getNavigation(jefeSoporte).some(view => view.group === 'system')).toBe(false);
  });

  it('cada apartado despliega sus secciones, que son las pestañas de su página', () => {
    const secciones = (user, id) => getNavigation(user).find(view => view.id === id).sections.map(section => section.id);
    expect(secciones(soporte, 'rim')).toEqual(['registros', 'numeracion', 'nuevo']);
    expect(secciones(calibracion, 'calibration')).toEqual(['cronograma', 'equipos', 'actividades', 'certificados', 'alertas', 'cumplimiento', 'servicemet']);
    expect(secciones(soporte, 'soporte')).toEqual(['informes', 'proximos', 'avisos']);
    // Sin secciones: Cronograma e IvMET (este tiene su propio menú).
    expect(secciones(sistemas, 'calendar')).toEqual([]);
    expect(secciones(sistemas, 'ivmet')).toEqual([]);
  });

  it('un apartado con candado no despliega secciones', () => {
    expect(getNavigation(comercial).filter(view => view.sections.length).map(view => view.id)).toEqual(['rim', 'soporte', 'comercial']);
  });

  it('Comercial solo consulta Soporte técnico: informes emitidos y próximos servicios', () => {
    const vista = (user) => getNavigation(user).find(view => view.id === 'soporte');
    expect(soloConsulta('soporte', comercial)).toBe(true);
    expect(soloConsulta('soporte', { ...comercial, cargo: 'Jefe de Area' })).toBe(true);
    expect(soloConsulta('soporte', soporte)).toBe(false);
    expect(soloConsulta('soporte', { ...comercial, acceso_cron: '3' })).toBe(false);
    expect(soloConsulta('calibration', comercial)).toBe(false);
    expect(vista(comercial).consulta).toBe(true);
    expect(vista(comercial).sections.map(s => [s.id, s.label])).toEqual([['informes', 'Informes emitidos'], ['proximos', 'Próximos servicios']]);
    // El jefe de Comercial no ve Avisos ni Configuración; los tiempos, con su permiso.
    expect(vista({ ...comercial, cargo: 'Jefe de Area', permisos: [] }).sections.map(s => s.id)).toEqual(['informes', 'proximos']);
    expect(vista(jefe(comercial)).sections.map(s => s.id)).toEqual(['informes', 'proximos', 'tiempos']);
    expect(vista(jefe(comercial)).consulta).toBe(true);
    expect(vista(soporte).consulta).toBe(false);
    expect(findSection('soporte', 'informes', comercial)?.label).toBe('Informes emitidos');
    expect(findSection('soporte', 'avisos', comercial)).toBeNull();
  });

  it('los tiempos de servicio los ve quien tiene su permiso (de inicio, los jefes de todas las áreas) y Sistemas', () => {
    const secciones = (user, id) => getNavigation(user).find(view => view.id === id).sections.map(section => section.id);
    expect(secciones(jefe(soporte), 'soporte')).toContain('tiempos');
    expect(secciones({ ...soporte, cargo: 'Técnico 3', permisos: [] }, 'soporte')).not.toContain('tiempos');
    expect(secciones(jefe(calibracion), 'calibration')).toContain('tiempos');
    expect(secciones({ ...calibracion, cargo: 'Técnico', permisos: [] }, 'calibration')).not.toContain('tiempos');
    // El menú no lo decide el cargo, sino el permiso que da el backend.
    expect(secciones({ ...soporte, cargo: 'Jefe de Area', permisos: [] }, 'soporte')).not.toContain('tiempos');
    expect(secciones({ ...soporte, cargo: 'Técnico', permisos: ['tiempos.soporte.ver'] }, 'soporte')).toContain('tiempos');
    expect(secciones(sistemas, 'soporte')).toContain('tiempos');
    expect(secciones(sistemas, 'calibration')).toContain('tiempos');
    expect(findSection('calibration', 'tiempos', sistemas)?.label).toBe('Tiempos de servicio');
    expect(tienePermiso(sistemas, 'tiempos.soporte.ver')).toBe(true);
    expect(tienePermiso({ ...soporte, permisos: null }, 'tiempos.soporte.ver')).toBe(false);
  });

  it('el jefe de otra área entra solo a los tiempos de servicio, sin candado', () => {
    const administracion = { area: 'Administración', acceso_cron: '2' };
    const menu = getNavigation(jefe(administracion));
    for (const id of ['calibration', 'soporte']) {
      const vista = menu.find(view => view.id === id);
      expect(vista.locked).toBe(false);
      expect(vista.porPermiso).toBe(true);
      expect(vista.sections.map(section => section.id)).toEqual(['tiempos']);
      expect(accesoPorPermiso(id, jefe(administracion))).toBe(true);
      // El resto del apartado sigue siendo del área.
      expect(canUseView(id, jefe(administracion))).toBe(false);
    }
    expect(findSection('calibration', 'tiempos', jefe(administracion))?.label).toBe('Tiempos de servicio');
    expect(findSection('calibration', 'equipos', jefe(administracion))).toBeNull();
    // El jefe de Soporte entra a los tiempos de Calibración; su apartado, completo.
    expect(getNavigation(jefe(soporte)).find(view => view.id === 'calibration').sections.map(s => s.id)).toEqual(['tiempos']);
    expect(accesoPorPermiso('soporte', jefe(soporte))).toBe(false);
    // Sin el permiso, el candado de siempre.
    const sinPermiso = getNavigation({ ...administracion, permisos: [] }).find(view => view.id === 'calibration');
    expect([sinPermiso.locked, sinPermiso.sections]).toEqual([true, []]);
  });

  it('mientras no llegan los permisos se espera en lugar de mostrar el candado o volver al RIM', () => {
    const administracion = { area: 'Administración', cargo: 'Jefe de Area', acceso_cron: '2', permisos: null };
    expect(esperaPermisos('calibration', administracion)).toBe(true);
    expect(esperaPermisos('permisos', administracion)).toBe(true);
    expect(esperaPermisos('rim', administracion)).toBe(false);
    // Su propio apartado también espera: puede estar en pruebas.
    expect(esperaPermisos('calibration', { ...calibracion, permisos: null })).toBe(true);
    expect(esperaPermisos('comercial', { ...comercial, permisos: null })).toBe(true);
    expect(esperaPermisos('calibration', { ...calibracion, permisos: [] })).toBe(false);
    expect(esperaPermisos('calibration', { ...administracion, permisos: [] })).toBe(false);
    expect(esperaPermisos('permisos', sistemas)).toBe(false);
    expect(esperaPermisos('comercial', { ...sistemas, permisos: null })).toBe(false);
  });

  it('un apartado en pruebas lo usa solo Sistemas: su área y quien lo consulta lo ven con candado', () => {
    const conPruebas = user => ({ ...user, permisos: [], enPruebas: ['comercial'] });
    const administracion = conPruebas({ area: 'Administración', acceso_cron: '2' });
    const gerencia = conPruebas({ area: 'Gerencia', acceso_cron: '1' });
    for (const user of [conPruebas(comercial), conPruebas(jefe(comercial)), administracion, gerencia]) {
      expect(enPruebas('comercial', user)).toBe(true);
      expect(canUseView('comercial', user)).toBe(false);
      expect(soloConsulta('comercial', user)).toBe(false);
      const item = getNavigation(user).find(view => view.id === 'comercial');
      expect([item.locked, item.consulta, item.sections]).toEqual([true, false, []]);
    }
    // Sistemas lo usa completo y sabe que está en pruebas.
    expect(enPruebas('comercial', conPruebas(sistemas))).toBe(true);
    expect(canUseView('comercial', conPruebas(sistemas))).toBe(true);
    expect(getNavigation(conPruebas(sistemas)).find(view => view.id === 'comercial').sections).toHaveLength(6);
    // Los demás apartados siguen igual.
    expect(canUseView('soporte', conPruebas(comercial))).toBe(true);
    expect(canUseView('calibration', conPruebas(calibracion))).toBe(true);
    // La clave del backend de Calibración no es la de la vista.
    expect(enPruebas('calibration', { ...calibracion, enPruebas: ['calibracion'] })).toBe(true);
    // Sin la lista (mientras llega o si falla), rige la regla del área; el backend decide igual.
    expect(canUseView('comercial', { ...comercial, enPruebas: null })).toBe(true);
    expect(enPruebas('rim', conPruebas(comercial))).toBe(false);
  });

  it('Gestión de permisos la abren Sistemas y quien el backend diga que gestiona', () => {
    expect(allowedView('permisos', sistemas)).toBe('permisos');
    expect(allowedView('permisos', jefe(calibracion))).toBe('rim');
    expect(allowedView('permisos', { ...jefe(comercial), gestionaPermisos: true })).toBe('permisos');
    expect(getNavigation(sistemas).filter(view => view.group === 'system').map(view => view.id)).toEqual(['changes', 'failures', 'permisos']);
    expect(getNavigation({ ...jefe(comercial), gestionaPermisos: true }).filter(view => view.group === 'system').map(view => view.id)).toEqual(['permisos']);
  });

  it('la configuración de Soporte técnico solo la ve su jefe de área', () => {
    const secciones = (user) => getNavigation(user).find(view => view.id === 'soporte').sections.map(section => section.id);
    expect(secciones({ ...soporte, cargo: 'Jefe de  Área' })).toContain('configuracion');
    expect(secciones({ ...soporte, cargo: 'Técnico' })).not.toContain('configuracion');
    expect(secciones({ ...sistemas, area: 'Sistemas' })).not.toContain('configuracion');
  });

  it('Certificados es un desplegable con los registros y el método de cálculo', () => {
    const certificados = getNavigation(calibracion).find(view => view.id === 'calibration').sections.find(s => s.id === 'certificados');
    expect(certificados.children.map(child => child.id)).toEqual(['certificados', 'emitidos', 'metodo', 'validacion']);
    expect(findSection('calibration', 'emitidos', calibracion)).toMatchObject({ label: 'Emitidos', grupo: 'Certificados' });
    // Los patrones están con los equipos: ahí se cargan sus datos.
    const equipos = getNavigation(calibracion).find(view => view.id === 'calibration').sections.find(s => s.id === 'equipos');
    expect(equipos.children.map(child => child.id)).toEqual(['equipos', 'patrones']);
    expect(findSection('calibration', 'patrones', calibracion)).toMatchObject({ label: 'Patrones', grupo: 'Equipos' });
    expect(findSection('calibration', 'metodo', calibracion)).toMatchObject({ label: 'Método de cálculo', grupo: 'Certificados' });
    expect(findSection('calibration', 'certificados', calibracion)).toMatchObject({ label: 'Registros', grupo: 'Certificados' });
  });

  it('la sección abierta solo se nombra si el usuario la ve en el menú', () => {
    expect(findSection('calibration', 'equipos', calibracion)?.label).toBe('Todos los equipos');
    expect(findSection('soporte', 'proximos', soporte)?.label).toBe('Próximos servicios');
    expect(findSection('soporte', 'configuracion', soporte)).toBeNull();
    expect(findSection('calibration', 'equipos', soporte)).toBeNull();
    expect(findSection('calendar', 'hoy', soporte)).toBeNull();
    expect(findSection('rim', undefined, soporte)).toBeNull();
  });

  it('el contador de alertas de calibración es para quien usa el plan', () => {
    expect(managesCalibration(calibracion)).toBe(true);
    expect(managesCalibration(sistemas)).toBe(true);
    expect(managesCalibration(soporte)).toBe(false);
  });
});
