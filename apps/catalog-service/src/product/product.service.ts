import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeDomainEvent } from '@livora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

export interface CreateProductInput {
  title: string;
  description?: string;
  categoryId?: string;
  brandId?: string;
  hsnCode?: string;
  gstRatePct?: number;
  taxInclusive?: boolean;
}

const ALLOWED_GST = new Set([0, 5, 12, 18, 28]);

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  async addImage(storeId: string, productId: string, url: string) {
    const product = await this.get(storeId, productId);
    return this.prisma.product.update({
      where: { id: productId },
      data: { images: { set: [...product.images, url] } },
    });
  }

  private assertGst(rate?: number): void {
    if (rate != null && !ALLOWED_GST.has(rate)) {
      throw new ForbiddenException('gstRatePct must be one of 0,5,12,18,28');
    }
  }

  /**
   * ALWAYS scoped by storeId (app-level invariant) AND run under the RLS tenant
   * GUC (DB-level backstop) — defense in depth.
   */
  list(storeId: string) {
    return this.prisma.withTenant(storeId, (tx) =>
      tx.product.findMany({ where: { storeId }, include: { variants: true } }),
    );
  }

  async get(storeId: string, productId: string) {
    const product = await this.prisma.withTenant(storeId, (tx) =>
      tx.product.findFirst({ where: { id: productId, storeId }, include: { variants: true } }),
    );
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async create(storeId: string, dto: CreateProductInput) {
    this.assertGst(dto.gstRatePct);
    return this.prisma.product.create({
      data: {
        storeId,
        title: dto.title,
        description: dto.description,
        categoryId: dto.categoryId,
        brandId: dto.brandId,
        hsnCode: dto.hsnCode,
        gstRatePct: dto.gstRatePct ?? 0,
        taxInclusive: dto.taxInclusive ?? false,
        status: 'draft',
      },
    });
  }

  async update(storeId: string, productId: string, dto: Partial<CreateProductInput>) {
    this.assertGst(dto.gstRatePct);
    await this.get(storeId, productId); // 404 if not in this store
    return this.prisma.product.update({ where: { id: productId }, data: dto });
  }

  async remove(storeId: string, productId: string) {
    await this.get(storeId, productId);
    await this.prisma.product.delete({ where: { id: productId } });
    return { deleted: true };
  }

  async addVariant(
    storeId: string,
    productId: string,
    v: { sku: string; attributes?: Record<string, unknown>; mrpPaise: number; pricePaise: number },
  ) {
    await this.get(storeId, productId);
    if (v.pricePaise <= 0 || v.mrpPaise <= 0) throw new ForbiddenException('prices must be > 0');
    return this.prisma.productVariant.create({
      data: {
        productId,
        storeId,
        sku: v.sku,
        attributesJson: (v.attributes ?? {}) as object,
        mrpPaise: v.mrpPaise,
        pricePaise: v.pricePaise,
      },
    });
  }

  /** Owner submits a draft product for admin moderation. */
  async submitForReview(storeId: string, productId: string) {
    await this.get(storeId, productId);
    return this.prisma.product.update({ where: { id: productId }, data: { status: 'pending' } });
  }
}
