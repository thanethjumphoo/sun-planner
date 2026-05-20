import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() signInDto: Record<string, any>) {
    const user = await this.authService.validateUser(
      signInDto.username,
      signInDto.password,
    );
    if (!user) {
      throw new UnauthorizedException('Invalid username or password');
    }
    // Return a dummy token for now
    return {
      message: 'Login successful',
      token: 'dummy-jwt-token-12345',
      user: user,
    };
  }
}
