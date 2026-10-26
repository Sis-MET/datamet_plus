const { emitKeypressEvents } = require('node:readline');
const bcrypt = require('bcrypt');

function readHidden(prompt) {
  if (!process.stdin.isTTY)
    throw new Error(
      'Abre una terminal interactiva. El código no se acepta como argumento ni por una tubería.',
    );
  return new Promise((resolve, reject) => {
    let value = '';
    const wasRaw = process.stdin.isRaw;
    const done = (error) => {
      process.stdin.removeListener('keypress', press);
      process.stdin.setRawMode(Boolean(wasRaw));
      process.stdin.pause();
      process.stdout.write('\n');
      if (error) reject(error);
      else resolve(value);
    };
    const press = (text, key = {}) => {
      if (key.ctrl && key.name === 'c')
        return done(new Error('Operación cancelada.'));
      if (key.name === 'return' || key.name === 'enter') return done();
      if (key.name === 'backspace') {
        value = [...value].slice(0, -1).join('');
        return;
      }
      const printable =
        text &&
        [...text].every((character) => {
          const point = character.codePointAt(0);
          return point >= 32 && point !== 127;
        });
      if (!key.ctrl && !key.meta && printable) {
        if (Buffer.byteLength(value + text, 'utf8') <= 72) value += text;
      }
    };
    emitKeypressEvents(process.stdin);
    process.stdout.write(prompt);
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on('keypress', press);
  });
}

async function main() {
  if (process.argv.length > 2)
    throw new Error('No pases el código como argumento.');
  const code = await readHidden('Código de acceso IvMET (no se mostrará): ');
  if (code.length < 8) throw new Error('Utiliza al menos 8 caracteres.');
  const confirmation = await readHidden('Confirma el código: ');
  if (code !== confirmation) throw new Error('Los códigos no coinciden.');
  const hash = await bcrypt.hash(code, 12);
  console.log(
    '\nCopia esta línea en el .env privado del backend de DataMET+, conservando las demás variables:',
  );
  console.log('IVMET_ACCESS_CODE_HASH=' + hash);
  console.log(
    '\nNo publiques el hash. Reinicia únicamente el backend de DataMET+ después de guardarlo.',
  );
}
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });

module.exports = { readHidden };
