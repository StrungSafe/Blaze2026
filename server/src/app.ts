import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyInstance } from 'fastify';
import type { Db } from './db.js';
import { BADGE_RANK, type Badge } from './badges.js';
import { validatePolicy, type Policy } from './policy.js';
import {
    addFlag,
    evaluateForTemplate,
    getSpotlight,
    getTemplateDetail,
    listTemplates,
    publishTemplate,
    RegistryError,
    type ListParameters,
} from './registry.js';

export interface AppOptions {
    /** Disable rate limiting (tests). */
    rateLimit?: boolean;
    logger?: boolean;
}

const SORTS = new Set(['newest', 'name', 'flagged']);

function toPositiveInteger(value: unknown): number | undefined {
    if (typeof value !== 'string' || !/^\d{1,6}$/.test(value)) {
        return undefined;
    }

    return Number(value);
}

export async function buildApp(db: Db, options: AppOptions = {}): Promise<FastifyInstance> {
    // Templates are up to 256 KB; leave headroom for the JSON wrapper.
    const app = Fastify({ logger: options.logger ?? false, bodyLimit: 600 * 1024 });

    if (options.rateLimit !== false) {
        await app.register(rateLimit, { global: true, max: 120, timeWindow: '1 minute' });
    }

    app.setErrorHandler((error: unknown, _request, reply) => {
        if (error instanceof RegistryError) {
            return reply.status(error.status).send({ error: error.message });
        }

        const status = (error as { statusCode?: number }).statusCode;

        if (typeof status === 'number' && status >= 400 && status < 500) {
            return reply.status(status).send({ error: (error as Error).message });
        }

        app.log.error(error);

        return reply.status(500).send({ error: 'Internal server error.' });
    });

    app.get('/api/health', async () => ({ ok: true }));

    app.get('/api/templates', async (request, reply) => {
        const q = request.query as Record<string, unknown>;
        const parameters: ListParameters = {};

        if (typeof q.query === 'string') {
            parameters.query = q.query.slice(0, 100);
        }

        if (q.badge !== undefined) {
            if (typeof q.badge !== 'string' || !(q.badge in BADGE_RANK)) {
                return reply.status(400).send({ error: 'badge must be one of: unchecked, auto-checked, reviewed.' });
            }

            parameters.badge = q.badge as Badge;
        }

        if (q.sort !== undefined) {
            if (typeof q.sort !== 'string' || !SORTS.has(q.sort)) {
                return reply.status(400).send({ error: 'sort must be one of: newest, name, flagged.' });
            }

            parameters.sort = q.sort as ListParameters['sort'];
        }

        parameters.page = toPositiveInteger(q.page);
        parameters.pageSize = toPositiveInteger(q.pageSize);

        return listTemplates(db, parameters);
    });

    app.get('/api/templates/:identifier', async (request, reply) => {
        const { identifier } = request.params as { identifier: string };
        const detail = await getTemplateDetail(db, identifier);

        if (!detail) {
            return reply.status(404).send({ error: 'Template not found.' });
        }

        return detail;
    });

    app.post(
        '/api/templates',
        { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
        async (request, reply) => {
            const body = (request.body ?? {}) as { template?: unknown; publisher?: unknown };

            if (body.template === undefined) {
                return reply.status(400).send({ error: 'Request body must include a "template".' });
            }

            const publisher = typeof body.publisher === 'string' && body.publisher.trim() ? body.publisher.trim() : 'anonymous';
            const result = await publishTemplate(db, body.template, publisher);

            return reply.status(result.created ? 201 : 200).send(result);
        },
    );

    app.post(
        '/api/templates/:identifier/flags',
        { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } },
        async (request, reply) => {
            const { identifier } = request.params as { identifier: string };
            const body = (request.body ?? {}) as { reason?: unknown; reporter?: unknown };
            const flag = await addFlag(db, identifier, body.reason, body.reporter);

            return reply.status(201).send(flag);
        },
    );

    app.get('/api/spotlight', async () => ({ items: await getSpotlight(db) }));

    app.post('/api/policy/evaluate', async (request, reply) => {
        const body = (request.body ?? {}) as { policy?: unknown; identifier?: unknown };
        const problems = validatePolicy(body.policy);

        if (problems.length > 0) {
            return reply.status(400).send({ error: problems.join('; ') });
        }

        if (typeof body.identifier !== 'string') {
            return reply.status(400).send({ error: 'identifier is required.' });
        }

        const decision = await evaluateForTemplate(db, body.policy as Policy, body.identifier);

        if (!decision) {
            return reply.status(404).send({ error: 'Template not found.' });
        }

        return decision;
    });

    return app;
}
