export class HttpError extends Error {
    status;
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}
export const asyncHandler = (handler) => (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
};
export const errorHandler = (error, _req, res, _next) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Something went wrong";
    if (status >= 500) {
        console.error(error);
    }
    res.status(status).json({ message });
};
