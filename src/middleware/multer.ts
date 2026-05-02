import multer, { FileFilterCallback } from "multer";
import { Request, Response, NextFunction } from "express";
import { AppError } from "../types/errors";

const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
const MAX_SIZE_MB = 5;

const storage = multer.memoryStorage();

function fileFilter(
  _req: Request,
  file: Express.Multer.File,
  cb: FileFilterCallback,
): void {
  if (ALLOWED_TYPES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new AppError(
        "INVALID_FILE_TYPE",
        422,
        `Only ${ALLOWED_TYPES.join(", ")} are allowed`,
      ),
    );
  }
}

const multerInstance = multer({
  storage,
  fileFilter,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
});

export function uploadImage(
  fieldName = "image",
): (req: Request, res: Response, next: NextFunction) => void {
  return (req: Request, res: Response, next: NextFunction): void => {
    multerInstance.single(fieldName)(req, res, (err: unknown) => {
      if (!err) return next();

      if (err instanceof multer.MulterError) {
        if (err.code === "LIMIT_FILE_SIZE") {
          return next(
            new AppError(
              "FILE_TOO_LARGE",
              422,
              `Max file size is ${MAX_SIZE_MB}MB`,
            ),
          );
        }
        return next(new AppError("UPLOAD_ERROR", 422, err.message));
      }

      next(err);
    });
  };
}
