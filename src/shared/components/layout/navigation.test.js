import { describe, expect, it } from 'vitest';
import { allowedView, canUseView, findSection, getNavigation, managesCalibration, soloConsulta } from './navigation';

const calibracion = { area: 'Calibración', acceso_cron: '2' };
const soporte = { area: 'Soporte Técnico', acceso_cron: 2 };
const comercial = { area: 'Comercial', acceso_cron: '2' };
const sistemas = { area: 'Administración', cargo: 'Auxiliar de Sistemas', acceso_cron: '3' };

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
    expect(getNavigation(soporte).filter(view => view.locked).map(view => view.id)).toEqual(['calibration', 'ivmet']);
  });

  it('los apartados de área se abren siempre; los de Sistemas solo para Sistemas', () => {
    expect(allowedView('ivmet', comercial)).toBe('ivmet');
    expect(allowedView('soporte', comercial)).toBe('soporte');
    expect(allowedView('changes', comercial)).toBe('rim');
    expect(allowedView('changes', sistemas)).toBe('changes');
    expect(allowedView('inexistente', sistemas)).toBe('rim');
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
    expect(getNavigation(comercial).filter(view => view.sections.length).map(view => view.id)).toEqual(['rim', 'soporte']);
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
    // Ni el jefe de Comercial ve Avisos, Tiempos o Configuración.
    expect(vista({ ...comercial, cargo: 'Jefe de Area' }).sections.map(s => s.id)).toEqual(['informes', 'proximos']);
    expect(vista(soporte).consulta).toBe(false);
    expect(findSection('soporte', 'informes', comercial)?.label).toBe('Informes emitidos');
    expect(findSection('soporte', 'avisos', comercial)).toBeNull();
  });

  it('los tiempos de servicio los ven el jefe de cada área y Sistemas', () => {
    const secciones = (user, id) => getNavigation(user).find(view => view.id === id).sections.map(section => section.id);
    expect(secciones({ ...soporte, cargo: 'Jefe de Area' }, 'soporte')).toContain('tiempos');
    expect(secciones({ ...soporte, cargo: 'Técnico 3' }, 'soporte')).not.toContain('tiempos');
    expect(secciones({ ...calibracion, cargo: 'Jefe de Área' }, 'calibration')).toContain('tiempos');
    expect(secciones({ ...calibracion, cargo: 'Técnico' }, 'calibration')).not.toContain('tiempos');
    // El jefe de otra área no ve los de Calibración (ni entra al apartado).
    expect(secciones({ ...soporte, cargo: 'Jefe de Area' }, 'soporte')).toContain('tiempos');
    expect(getNavigation({ ...soporte, cargo: 'Jefe de Area' }).find(view => view.id === 'calibration').sections).toEqual([]);
    expect(secciones(sistemas, 'soporte')).toContain('tiempos');
    expect(secciones(sistemas, 'calibration')).toContain('tiempos');
    expect(findSection('calibration', 'tiempos', sistemas)?.label).toBe('Tiempos de servicio');
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
