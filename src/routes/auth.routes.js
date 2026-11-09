import express from "express";
import {
  registrar,
  iniciarSesion,
  cerrarSesion,
  obtenerUsuarioActual,
} from "../controllers/auth.controller.js";
import { requerirAutenticacion } from "../middlewares/auth.js";
import { verificarCsrf } from "../middlewares/csrf.js";
import { limiteLoginIp, limiteRegistroIp } from "../middlewares/limits.js";

// Agrupamos las rutas de autenticación.
// La aplicación agregará el prefijo /api/auth al montar este router.
const authRouter = express.Router();

// Comprobamos CSRF antes de crear una cuenta.
// Aplicamos el límite por IP y validamos CSRF antes de crear la cuenta.
authRouter.post("/registro", limiteRegistroIp, verificarCsrf, registrar);

// Aplicamos el límite por IP y validamos CSRF antes de verificar credenciales.
authRouter.post("/login", limiteLoginIp, verificarCsrf, iniciarSesion);

// Exigimos autenticación y CSRF antes de destruir la sesión.
authRouter.post("/logout", requerirAutenticacion, verificarCsrf, cerrarSesion);

// Exigimos autenticación antes de devolver los datos del usuario.
authRouter.get("/me", requerirAutenticacion, obtenerUsuarioActual);

export default authRouter;
