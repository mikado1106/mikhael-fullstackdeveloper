import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async getOwnedCompanyId(userId: string): Promise<string> {
    const company = await this.prisma.company.findUnique({
      where: { userId },
      select: { id: true },
    });
    if (!company) {
      throw new ForbiddenException('No company profile is linked to this account');
    }
    return company.id;
  }
}
