import crypto from "node:crypto";

export class AppError extends Error {
  constructor(status, code, message, fields = null) {
    super(message);
    this.status = status;
    this.code = code;
    this.fields = fields;
  }
}

export function requestIdMiddleware(req, res, next) {
  const requestId = crypto.randomUUID();
  req.requestId = requestId;
  res.locals.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

export function safeRequestLogger(req, res, next) {
  res.on("finish", () => {
    if (process.env.NODE_ENV === "test") return;
    const safePath = (req.originalUrl || req.url || "/").split("?")[0];
    const logEntry = {
      timestamp: new Date().toISOString(),
      level:
        res.statusCode >= 500
          ? "error"
          : res.statusCode >= 400
            ? "warn"
            : "info",
      requestId: req.requestId,
      method: req.method,
      path: safePath,
      status: res.statusCode,
    };
    console.log(JSON.stringify(logEntry));
  });
  next();
}

export function notFoundHandler(req, res) {
  if (req.path.startsWith("/api")) {
    return res.status(404).json({
      ok: false,
      error: {
        code: "NO_ENCONTRADO",
        message: "El recurso solicitado no existe.",
        requestId: req.requestId,
      },
    });
  }

  return res.status(404).render("pages/error", {
    titulo: "Página no encontrada (404)",
    mensaje: "El recurso que buscás no existe o no está disponible.",
    requestId: req.requestId,
  });
}

export function errorHandler(err, req, res, _next) {
  let status = err.status || 500;
  let code = err.code || "ERROR_INTERNO";
  let message = err.message || "Ocurrió un error interno en el servidor.";
  const fields = err.fields || null;

  if (err.type === "entity.too.large") {
    status = 413;
    code = "ARCHIVO_GRANDE";
    message = "El cuerpo de la solicitud supera el límite de 32 KiB.";
  } else if (err instanceof SyntaxError && "body" in err) {
    status = 400;
    code = "PARAMETRO_INVALIDO";
    message = "El formato JSON enviado no es válido.";
  } else if (status === 503 && code === "SERVICIO_NO_DISPONIBLE") {
    // Usamos un mensaje público para la indisponibilidad temporal.
    message = "El servicio no está disponible temporalmente.";

    // Indicamos al cliente cuántos segundos debe esperar.
    if (Number.isInteger(err.retryAfter) && err.retryAfter > 0) {
      res.setHeader("Retry-After", String(err.retryAfter));
    }
  } else if (status >= 500) {
    code = "ERROR_INTERNO";
    message = "Ocurrió un error interno en el servidor.";
  }

  if (process.env.NODE_ENV !== "test") {
    const safePath = (req.originalUrl || req.url || "/").split("?")[0];
    console.error(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: "error",
        requestId: req.requestId,
        path: safePath,
      }),
    );
  }

  if (req.path.startsWith("/api")) {
    const errorPayload = {
      code,
      message,
      requestId: req.requestId,
    };
    if (fields) {
      errorPayload.fields = fields;
    }
    return res.status(status).json({
      ok: false,
      error: errorPayload,
    });
  }

  return res.status(status).render("pages/error", {
    titulo: `Error ${status}`,
    mensaje: message,
    requestId: req.requestId,
  });
}
