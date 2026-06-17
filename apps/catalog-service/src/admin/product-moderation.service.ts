import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { makeDomainEvent } from '@livora/contracts';
import { PrismaService } from '../prisma/prisma.service';
import { OutboxService } from '../outbox/outbox.service';

@Injectable()
export class ProductModerationService {
  private readonly logger = new Logger(ProductModerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly outbox: OutboxService,
  ) {}

  listForReview() {
    return this.prisma.product.findMany({ where: { status: 'pending' }, include: { variants: true } });
  }

  async approve(productId: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId }, include: { variants: true } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id: productId }, data: { status: 'published' } });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId: randomUUID(),
          type: 'product.published',
          aggregateType: 'product',
          aggregateId: productId,
          payload: {
            productId,
            storeId: p.storeId,
            title: p.title,
            categoryId: p.categoryId,
            status: 'published',
            variants: product.variants.map((v) => ({ sku: v.sku, pricePaise: v.pricePaise })),
          },
        }),
      );
      this.logger.log(`product ${productId} published`);
      return p;
    });
  }

  async reject(productId: string, reason?: string) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product) throw new NotFoundException('Product not found');
    return this.prisma.$transaction(async (tx) => {
      const p = await tx.product.update({ where: { id: productId }, data: { status: 'rejected' } });
      await this.outbox.publishWithin(
        tx,
        makeDomainEvent({
          eventId: randomUUID(),
          type: 'product.rejected',
          aggregateType: 'product',
          aggregateId: productId,
          payload: { productId, storeId: p.storeId, reason: reason ?? null },
        }),
      );
      return p;
    });
  }
}
