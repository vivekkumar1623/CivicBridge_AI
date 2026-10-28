import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { config } from '../config/index.js';

const parsePhoto = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: config.maxUploadBytes,
    files: 1,
    fields: 10,
  },
}).single('photo');

export function handleOptionalPhoto(req: Request, res: Response, next: NextFunction): void {
  parsePhoto(req, res, (error?: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      const status = error.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        error.code === 'LIMIT_FILE_SIZE'
          ? 'Photo must be 5 MB or smaller'
          : error.code === 'LIMIT_UNEXPECTED_FILE' ||
              error.code === 'LIMIT_FILE_COUNT'
            ? 'Only one photo is allowed'
            : 'The multipart form contains too many fields';
      res.status(status).json({ error: message });
      return;
    }

    next(error);
  });
}
