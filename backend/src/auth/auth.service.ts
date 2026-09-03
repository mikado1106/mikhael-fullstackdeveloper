import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

type UserWithCompany = Prisma.UserGetPayload<{ include: { company: true } }>;

export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  company: { id: string; name: string; location: string | null; description: string | null } | null;
  createdAt: Date;
}

export interface AuthResponse {
  accessToken: string;
  user: PublicUser;
}

@Injectable()
export class AuthService {
  private static readonly SALT_ROUNDS = 10;
  // Compared against when the email is unknown, so both branches cost one bcrypt round.
  private static readonly DUMMY_HASH =
    '$2b$10$bWoqhq4I3SUEdux//ycoEeP6hQH9aoydQ/8bXfzwGdToVaWzmxVWi';

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResponse> {
    const email = dto.email.toLowerCase();

    const existing = await this.prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, AuthService.SALT_ROUNDS);
    const company = dto.role === Role.COMPANY ? { create: this.buildCompanyData(dto) } : undefined;

    const user = await this.prisma.user.create({
      data: { email, passwordHash, name: dto.name, role: dto.role, company },
      include: { company: true },
    });

    return this.buildAuthResponse(user);
  }

  async login(dto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
      include: { company: true },
    });

    // Always run bcrypt, even without a match, so the response time does not
    // reveal whether the email exists.
    const hash = user ? user.passwordHash : AuthService.DUMMY_HASH;
    const passwordMatches = await bcrypt.compare(dto.password, hash);
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.buildAuthResponse(user);
  }

  async getProfile(userId: string): Promise<PublicUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { company: true },
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return this.toPublicUser(user);
  }

  private buildCompanyData(dto: RegisterDto): Prisma.CompanyCreateWithoutUserInput {
    if (!dto.companyName) {
      throw new BadRequestException('companyName is required when registering as a company');
    }
    return {
      name: dto.companyName,
      location: dto.companyLocation,
      description: dto.companyDescription,
    };
  }

  private async buildAuthResponse(user: UserWithCompany): Promise<AuthResponse> {
    const payload: JwtPayload = { sub: user.id, email: user.email, role: user.role };
    const accessToken = await this.jwtService.signAsync(payload);
    return { accessToken, user: this.toPublicUser(user) };
  }

  private toPublicUser(user: UserWithCompany): PublicUser {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      company: user.company
        ? {
            id: user.company.id,
            name: user.company.name,
            location: user.company.location,
            description: user.company.description,
          }
        : null,
      createdAt: user.createdAt,
    };
  }
}
