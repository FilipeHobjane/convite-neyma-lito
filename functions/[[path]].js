// Adaptador Cloudflare Pages. Toda a lógica está em src/app.js.
import { handle } from '../src/app.js';

export const onRequest = (context) => handle(context.request, context.env, context);
