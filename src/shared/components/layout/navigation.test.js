import { describe, expect, it } from 'vitest';
import { allowedView, canUseView, getNavigation, managesCalibration } from './navigation';

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
    for (const view of ['calibration', 'soporte', 'ivmet']) {
      expect(canUseView(view, sistemas)).toBe(true);
      expect(canUseView(view, comercial)).toBe(false);
    }
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
    expect(menu.filter(view => view.locked).map(view => view.id)).toEqual(['calibration', 'soporte', 'ivmet']);
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

  it('el contador de alertas de calibración es para quien usa el plan', () => {
    expect(managesCalibration(calibracion)).toBe(true);
    expect(managesCalibration(sistemas)).toBe(true);
    expect(managesCalibration(soporte)).toBe(false);
  });
});
