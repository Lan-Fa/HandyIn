export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const Errors = {
  unauthorized: () => new AppError(401, 'UNAUTHORIZED', '未登录或会话已过期'),
  forbidden: () => new AppError(403, 'FORBIDDEN', '没有权限执行此操作'),
  notFound: (what = '资源') => new AppError(404, 'NOT_FOUND', `${what}不存在`),
  conflict: (message: string) => new AppError(409, 'CONFLICT', message),
  badRequest: (message: string) => new AppError(400, 'BAD_REQUEST', message),
  loginFailed: () => new AppError(401, 'LOGIN_FAILED', '用户名或密码错误'),
  tooManyRequests: () => new AppError(429, 'TOO_MANY_REQUESTS', '尝试次数过多，请稍后再试'),
};
