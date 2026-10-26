import type { ApiError } from '@olloo/shared';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class HttpError extends Error {
  constructor(
    public status: ContentfulStatusCode,
    message: string,
    public code?: ApiError['code']
  ) {
    super(message);
  }
}

export const notFound = (what = 'Not found') => new HttpError(404, what, 'not_found');
export const badRequest = (message: string) => new HttpError(400, message, 'invalid');
