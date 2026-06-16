import { createTelemetry } from './telemetry';

describe('createTelemetry', () => {
  it('is disabled by default with no endpoint', () => {
    const t = createTelemetry({ serviceName: 'svc' });
    expect(t.serviceName).toBe('svc');
    expect(t.enabled).toBe(false);
  });

  it('is enabled when an OTLP endpoint is provided', () => {
    const t = createTelemetry({
      serviceName: 'svc',
      otlpEndpoint: 'http://otel-collector:4318',
    });
    expect(t.enabled).toBe(true);
  });

  it('shutdown resolves', async () => {
    const t = createTelemetry({ serviceName: 'svc', enabled: false });
    await expect(t.shutdown()).resolves.toBeUndefined();
  });
});
