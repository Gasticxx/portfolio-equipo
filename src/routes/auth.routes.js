import express from "express";
import {
  registrar,
  obtenerUsuarioActual,
} from "../controllers/auth.controller.js";
import { requerirAutenticacion } from "../middlewares/auth.js";
import { verificarCsrf } from "../middlewares/csrf.js";

// Agrupamos las rutas de autenticación en un router.
const authRouter = express.Router();

// La aplicación agregará el prefijo /api/auth al montar este router.
// Comprobamos CSRF antes de ejecutar el registro.
authRouter.post("/registro", verificarCsrf, registrar);

// Primero comprobamos la autenticación y después devolvemos el usuario.
authRouter.get("/me", requerirAutenticacion, obtenerUsuarioActual);

export default authRouter;
