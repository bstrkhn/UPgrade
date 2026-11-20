import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';

interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/**
 * Validates body, query and params with zod. Parsed (and transformed) values replace the originals.
 * Zod errors are thrown synchronously and forwarded by Express 5 into the centralized errorHandler.
 */
export function validateZod(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.params) {
      req.params = schemas.params.parse(req.params) as Request['params'];
    }
    if (schemas.query) {
      const parsedQuery = schemas.query.parse(req.query);
      // Express 5 exposes req.query as a getter, so it is redefined instead of assigned.
      Object.defineProperty(req, 'query', {
        value: parsedQuery,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }
    if (schemas.body) {
      req.body = schemas.body.parse(req.body);
    }
    next();
  };
}
