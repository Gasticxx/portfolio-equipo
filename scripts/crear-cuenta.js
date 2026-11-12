import readline from 'node:readline';
import { stdin, stdout } from 'node:process';
import { z } from 'zod';
import { pool } from '../src/config/db.js';
import { generarHash } from '../src/services/contrasenas.service.js';

const emailSchema = z.email().transform((email) => email.trim().toLowerCase());
function pedirLinea(pregunta) {
  const rl = readline.createInterface({ input: stdin, output: stdout });
  return new Promise((resolve) => rl.question(pregunta, (respuesta) => { rl.close(); resolve(respuesta.trim()); }));
}
function pedirSecreto(pregunta) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') throw new Error('Ejecutá el comando desde una terminal interactiva.');
  return new Promise((resolve, reject) => {
    stdout.write(pregunta); readline.emitKeypressEvents(stdin); stdin.setRawMode(true); let valor = '';
    const fin = (error) => { stdin.setRawMode(false); stdin.pause(); stdin.removeListener('keypress', tecla); stdout.write('\n'); error ? reject(error) : resolve(valor); };
    const tecla = (caracter, key = {}) => {
      if (key.ctrl && key.name === 'c') return fin(new Error('Operación cancelada.'));
      if (key.name === 'return' || key.name === 'enter') return fin();
      if (key.name === 'backspace') { valor = valor.slice(0, -1); stdout.write('\b \b'); return; }
      if (caracter && !key.ctrl && !key.meta) { valor += caracter; stdout.write('*'); }
    };
    stdin.on('keypress', tecla); stdin.resume();
  });
}

try {
  const nombre = await pedirLinea('Nombre: ');
  const email = emailSchema.parse(await pedirLinea('Email: '));
  const rol = await pedirLinea('Rol (operador/administrador): ');
  if (!['operador', 'administrador'].includes(rol)) throw new Error('El rol debe ser operador o administrador.');
  const password = await pedirSecreto('Contraseña (12 a 128 caracteres): ');
  if (password !== await pedirSecreto('Confirmar contraseña: ')) throw new Error('Las contraseñas no coinciden.');
  const hash = await generarHash(password);
  const { rows } = await pool.query(
    `INSERT INTO app.usuarios(nombre,email,password_hash,rol) VALUES ($1,$2,$3,$4)
     ON CONFLICT ((lower(email))) DO NOTHING RETURNING id`,
    [nombre, email, hash, rol],
  );
  if (!rows.length) throw new Error('Ya existe una cuenta con ese email.');
  console.log(`Cuenta ${rol} creada: ID ${rows[0].id}. No se guardó ni mostró la contraseña.`);
} catch (error) {
  console.error(error instanceof z.ZodError ? 'Ingresá un email válido.' : error.message);
  process.exitCode = 1;
} finally { await pool.end(); }
