import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/**
 * Configure Swagger OpenAPI documentation.
 * Accessible at: http://localhost:3000/api/docs
 */
export function configureSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('DevFlow API')
    .setDescription('DevFlow project management and task tracking REST API')
    .setVersion('1.0')
    // Enable JWT Bearer token authentication in the Swagger UI
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Paste your JWT access token (copied from login response)',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config);

  // Setup Swagger UI at /api/docs
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true, // Keep the token saved when refreshing the page
    },
  });
}
