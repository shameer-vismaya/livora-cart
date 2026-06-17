import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

function slugify(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export interface CreateCategoryInput {
  name: string;
  parentId?: string;
  sortOrder?: number;
}

@Injectable()
export class CategoryService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateCategoryInput) {
    const slug = slugify(input.name);
    let path = `/${slug}`;
    if (input.parentId) {
      const parent = await this.prisma.category.findUnique({ where: { id: input.parentId } });
      if (!parent) throw new BadRequestException('parentId not found');
      path = `${parent.path}/${slug}`;
    }
    return this.prisma.category.create({
      data: { name: input.name, slug, path, parentId: input.parentId, sortOrder: input.sortOrder ?? 0 },
    });
  }

  list() {
    return this.prisma.category.findMany({ where: { active: true }, orderBy: [{ path: 'asc' }] });
  }

  async update(id: string, data: { name?: string; sortOrder?: number; active?: boolean }) {
    const existing = await this.prisma.category.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Category not found');
    return this.prisma.category.update({ where: { id }, data });
  }

  async deactivate(id: string) {
    await this.update(id, { active: false });
    return { deactivated: true };
  }
}
