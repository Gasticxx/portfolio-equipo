import express from "express";
import { registrar } from "../controllers/auth.controller.js";

// Agrupamos las rutas de autenticación en un router.
const authRouter = express.Router();

// La aplicación agregará el prefijo /api/auth al montar este router.
authRouter.post("/registro", registrar);

export default authRouter;
