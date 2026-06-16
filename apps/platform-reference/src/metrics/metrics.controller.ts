import { Controller, Get, Header } from '@nestjs/common';
import { register } from 'prom-client';

/** Prometheus scrape endpoint (public). Prometheus scrapes this directly; OTel
 * metrics also flow via the collector (Plan 04 stack). */
@Controller('metrics')
export class MetricsController {
  @Get()
  @Header('Content-Type', register.contentType)
  async metrics(): Promise<string> {
    return register.metrics();
  }
}
