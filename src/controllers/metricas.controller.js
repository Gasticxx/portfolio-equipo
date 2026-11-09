import { validarQueryMetricas } from '../validators/metricas.validator.js';
import { obtenerMetricasPanel } from '../services/metricas.service.js';

export async function getMetricasAdmin(req, res, next) {
    try {
        res.setHeader('Cache-Control', 'no-store');
        const filtros = validarQueryMetricas(req.query);
        const data = await obtenerMetricasPanel(filtros);
        return res.status(200).json({
            ok: true,
            data,
        });
    } catch (err) {
        return next(err);
    }
}