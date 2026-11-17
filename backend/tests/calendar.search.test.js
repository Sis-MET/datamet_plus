const test = require('node:test');
const assert = require('node:assert/strict');
const { consultaBusqueda, palabrasDeBusqueda, patronLike } = require('../src/services/calendar.service');

test('buscador del cronograma: palabras sin repetir, hasta cinco y con largo válido', () => {
  assert.deepEqual(palabrasDeBusqueda('  OTST   26-0285 '), ['OTST', '26-0285']);
  assert.deepEqual(palabrasDeBusqueda('cbn cbn la paz'), ['cbn', 'la', 'paz']);
  assert.equal(palabrasDeBusqueda('a b c d e f g').length, 5);
  assert.throws(() => palabrasDeBusqueda(' x '), e => e.statusCode === 400 && /2 caracteres/.test(e.message));
  assert.throws(() => palabrasDeBusqueda(undefined), e => e.statusCode === 400);
  assert.throws(() => palabrasDeBusqueda('x'.repeat(81)), e => e.statusCode === 400 && /80/.test(e.message));
});

test('buscador del cronograma: los comodines de LIKE se buscan como texto', () => {
  assert.equal(patronLike('CBN'), '%CBN%');
  assert.equal(patronLike('50%'), '%50\\%%');
  assert.equal(patronLike('a_b'), '%a\\_b%');
  assert.equal(patronLike('[x]'), '%\\[x]%');
  assert.equal(patronLike('c:\\'), '%c:\\\\%');
});

test('buscador del cronograma: cada palabra es un parámetro y se ignoran tildes y mayúsculas', () => {
  const sql = consultaBusqueda(2);
  assert.match(sql, /TOP \(40\)/);
  assert.match(sql, /LIKE @p0 ESCAPE '\\'/);
  assert.match(sql, /LIKE @p1 ESCAPE '\\'/);
  assert.doesNotMatch(sql, /@p2/);
  assert.match(sql, /COLLATE Latin1_General_CI_AI/);
  assert.match(sql, /<> 'Anulado'/);
  assert.match(sql, /ORDER BY ABS\(DATEDIFF\(day, fecha, CAST\(GETDATE\(\) AS date\)\)\)/);
});
