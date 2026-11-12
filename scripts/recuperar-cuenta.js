import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { pool } from '../src/config/db.js';
import { generarHash } from '../src/services/contrasenas.service.js';

function pedirLinea(pregunta) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => rl.question(pregunta, (respuesta) => { rl.close(); resolve(respuesta.trim()); }));
}

function pedirSecreto(pregunta) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Ejecutá la recuperación desde una terminal interactiva.');
  return new Promise((resolve, reject) => {
    stdout.write(pregunta);
    readline.emitKeypressEvents(stdin);
    stdin.setRawMode(true);
    let valor = '';
    const finalizar = (error) => {
      stdin.setRawMode(false); stdin.pause(); stdin.removeListener('keypress', tecla); stdout.write('\n');
      error ? reject(error) : resolve(valor);
    };
    const tecla = (caracter, key = {}) => {
      if (key.ctrl && key.name === 'c') return finalizar(new Error('Operación cancelada.'));
      if (key.name === 'return' || key.name === 'enter') return finalizar();
      if (key.name === 'backspace') { valor = valor.slice(0, -1); stdout.write('\b \b'); return; }
      if (caracter && !key.ctrl && !key.meta) { valor += caracter; stdout.write('*'); }
    };
    stdin.on('keypress', tecla); stdin.resume();
  });
}

try {
  const email = (await pedirLinea('Email de la cuenta: ')).toLowerCase();
  const password = await pedirSecreto('Nueva contraseña temporal (12 a 128 caracteres): ');
  const confirmacion = await pedirSecreto('Confirmar contraseña temporal: ');
  if (password !== confirmacion) throw new Error('Las contraseñas no coinciden.');
  const passwordHash = await generarHash(password);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `UPDATE app.usuarios SET password_hash = $2, version_sesion = version_sesion + 1, updated_at = now()
       WHERE lower(email) = $1 RETURNING id`,
      [email, passwordHash],
    );
    if (!rows.length) throw new Error('No existe una cuenta con ese email.');
    await client.query('COMMIT');
    console.log(`Recuperación aplicada a la cuenta ID ${rows[0].id}. Entregá la contraseña temporal a su titular por un canal privado.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
