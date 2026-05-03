import { AuthService } from './auth.service';
export declare class AuthController {
    private readonly authService;
    constructor(authService: AuthService);
    login(signInDto: Record<string, any>): Promise<{
        message: string;
        token: string;
        user: any;
    }>;
}
