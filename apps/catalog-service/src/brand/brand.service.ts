import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

@Injectable()
export class BrandService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: { name: string; logoUrl?: string }) {
    return this.prisma.brand.create({ data: { name: input.name, slug: slugify(input.name), logoUrl: input.logoUrl } });
  }

  list() {
    return this.prisma.brand.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  }

  async update(id: string, data: { name?: string; logoUrl?: string; active?: boolean }) {
    const existing = await this.prisma.brand.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Brand not found');
    return this.prisma.brand.update({ where: { id }, data });
  }
}
