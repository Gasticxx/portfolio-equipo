import { Router } from "express";
import { CONSTANTS } from "../config/constants.js";
import { getUsuariosAdmin } from "../controllers/usuarios.controller.js";
import { requerirRol } from "../middlewares/auth.js";

export const usuariosRouter = Router();

usuariosRouter.get(
  "/api/admin/usuarios",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  getUsuariosAdmin,
);
