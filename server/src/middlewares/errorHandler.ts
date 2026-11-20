import type { ErrorRequestHandler, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError } from '../utils/AppError.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  res.status(404).json({
    success: false,
    message: `Rute ${req.method} ${req.originalUrl} tidak ditemukan.`,
    data: null,
    meta: {},
  });
};

function isJsonSyntaxError(error: unknown): boolean {
  return error instanceof SyntaxError && 'status' in error && (error as { status?: number }).status === 400;
}

export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, _next) => {
  if (error instanceof ZodError) {
    const issues = error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    res.status(400).json({
      success: false,
      message: issues[0]?.message ?? 'Data yang dikirim tidak valid.',
      data: null,
      meta: { errors: issues },
    });
    return;
  }

  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      success: false,
      message: error.message,
      data: null,
      meta: error.details === undefined ? {} : { details: error.details },
    });
    return;
  }

  if (isJsonSyntaxError(error)) {
    res.status(400).json({
      success: false,
      message: 'Format JSON yang dikirim tidak valid.',
      data: null,
      meta: {},
    });
    return;
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      res.status(409).json({
        success: false,
        message: 'Data sudah ada dan tidak boleh duplikat.',
        data: null,
        meta: {},
      });
      return;
    }
    if (error.code === 'P2025') {
      res.status(404).json({
        success: false,
        message: 'Data yang diminta tidak ditemukan.',
        data: null,
        meta: {},
      });
      return;
    }
  }

  if (!isProduction) {
    console.error(error);
  } else {
    console.error('Unhandled error:', error instanceof Error ? error.message : 'unknown error');
  }

  res.status(500).json({
    success: false,
    message: 'Terjadi kesalahan pada server. Silakan coba lagi nanti.',
    data: null,
    meta: {},
  });
};
