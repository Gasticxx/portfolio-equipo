import express from "express";
import {
  registrar,
  iniciarSesion,
  cerrarSesion,
  obtenerUsuarioActual,
} from "../controllers/auth.controller.js";
import { requerirAutenticacion } from "../middlewares/auth.js";
import { verificarCsrf } from "../middlewares/csrf.js";

// Agrupamos las rutas de autenticación.
// La aplicación agregará el prefijo /api/auth al montar este router.
const authRouter = express.Router();

// Comprobamos CSRF antes de crear una cuenta.
authRouter.post("/registro", verificarCsrf, registrar);

// Comprobamos CSRF antes de verificar credenciales y crear la sesión.
authRouter.post("/login", verificarCsrf, iniciarSesion);

// Exigimos autenticación y CSRF antes de destruir la sesión.
authRouter.post("/logout", requerirAutenticacion, verificarCsrf, cerrarSesion);

// Exigimos autenticación antes de devolver los datos del usuario.
authRouter.get("/me", requerirAutenticacion, obtenerUsuarioActual);

export default authRouter;
