import { app } from './app.js';
import { env } from './config/env.js';

const HOST = '0.0.0.0';

const server = app.listen(env.PORT, HOST, () => {
    console.log(
        `[server] Equipo Seis escuchando en http://localhost:${env.PORT} (${HOST}:${env.PORT}) [${env.NODE_ENV}]`
    ); 
});

export default server;