export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string,
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND')
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Insufficient permissions') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT')
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super('Unauthorized', 401, 'UNAUTHORIZED')
  }
}

export function errorResponse(error: unknown) {
  if (error instanceof AppError) {
    return Response.json({ error: error.message, code: error.code }, { status: error.statusCode })
  }
  console.error(error)
  return Response.json({ error: 'Internal server error' }, { status: 500 })
}
