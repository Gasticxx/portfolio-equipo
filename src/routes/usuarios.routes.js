import { Router } from "express";
import { CONSTANTS } from "../config/constants.js";
import { getUsuariosAdmin, getUsuarioAdmin, patchUsuarioAdmin, mostrarUsuariosAdmin, mostrarPanelAdmin } from "../controllers/usuarios.controller.js";
import { requerirRol } from "../middlewares/auth.js";
import { verificarCsrf } from "../middlewares/csrf.js";

export const usuariosRouter = Router();

usuariosRouter.get(
  "/admin",
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  mostrarPanelAdmin,
);
usuariosRouter.get(
  "/admin/usuarios",
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  mostrarUsuariosAdmin,
);
usuariosRouter.get(
  "/api/admin/usuarios",
  (_req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    next();
  },
  requerirRol(CONSTANTS.ROLES.ADMINISTRADOR),
  getUsuariosAdmin,
);
usuariosRouter.get("/api/admin/usuarios/:id", requerirRol(CONSTANTS.ROLES.ADMINISTRADOR), getUsuarioAdmin);
usuariosRouter.patch("/api/admin/usuarios/:id", requerirRol(CONSTANTS.ROLES.ADMINISTRADOR), verificarCsrf, patchUsuarioAdmin);
