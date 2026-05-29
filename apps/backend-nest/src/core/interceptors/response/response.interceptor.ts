import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { map, Observable } from 'rxjs';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((data: unknown) => {
        const statusCode = response.statusCode;

        return {
          status: true,
          statusCode,
          message: this.extractMessage(data),
          data: this.extractData(data),
        };
      }),
    );
  }

  private getDefaultMessage(statusCode: number, method: string): string {
    console.log(`method: ${method}, statusCode: ${statusCode}`);
    if (statusCode == 201) return 'Resource created successfully';

    if (statusCode == 200) {
      switch (method) {
        case 'GET':
          return 'Data retrieved successfully';
        case 'PATCH':
          return 'Resource updated successfully';
        case 'DELETE':
          return 'Resource deleted successfully';
        case 'POST':
          return 'Operation completed successfully';
        default:
          return 'Success';
      }
    }

    return 'Success';
  }

  private extractMessage(data: unknown): string | undefined {
    if (typeof data === 'object' && data !== null && 'message' in data) {
      const message = data.message;

      if (typeof message === 'string') return message;
    }

    return undefined;
  }

  private extractData(data: unknown): unknown {
    if (typeof data === 'object' && data !== null && 'data' in data) {
      return data.data;
    }

    return data;
  }
}
