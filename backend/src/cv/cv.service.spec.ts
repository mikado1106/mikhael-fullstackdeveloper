import { CvService } from './cv.service';

describe('CvService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const docId = '33333333-3333-4333-8333-333333333333';

  function makeTx(overrides: Record<string, any> = {}) {
    return {
      $queryRaw: jest.fn().mockResolvedValue([{ id: docId }]),
      cvDocument: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({
          id: docId, userId: data.userId, latestIssued: BigInt(0), activeGeneration: BigInt(0),
          activeObjectPath: null, activeFileName: null, activeSizeBytes: null,
          activeMimeType: null, activatedAt: null,
        })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      cvUploadAttempt: {
        count: jest.fn().mockResolvedValue(0),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({
          id: 'attempt-1', ...data,
        })),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      storageCleanupTask: { upsert: jest.fn().mockResolvedValue({}) },
      ...overrides,
    };
  }

  function makeService(txOverrides: Record<string, any> = {}, storageOverrides: Record<string, any> = {}) {
    const tx = makeTx(txOverrides);
    const docRow = {
      id: docId, userId, latestIssued: BigInt(1), activeGeneration: BigInt(0),
      activeObjectPath: null, activeFileName: null, activeSizeBytes: null,
      activeMimeType: null, activatedAt: null,
    };
    const prisma: any = {
      $transaction: jest.fn().mockImplementation((fn: any) => fn(tx)),
      cvDocument: { findUnique: jest.fn().mockResolvedValue(docRow) },
      cvUploadAttempt: {
        findFirst: jest.fn().mockResolvedValue({ id: 'attempt-1' }),
        update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
      },
      application: { findFirst: jest.fn().mockResolvedValue(null) },
    };
    const storage: any = {
      createUploadUrl: jest.fn().mockResolvedValue({ url: 'https://signed/upload', method: 'PUT' }),
      createDownloadUrl: jest.fn().mockResolvedValue({ url: 'https://signed/download', expiresAt: new Date().toISOString() }),
      inspect: jest.fn(),
      ensureCopied: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      ...storageOverrides,
    };
    return { service: new CvService(prisma, storage), prisma, storage, tx };
  }

  const validDto = { fileName: 'cv.pdf', sizeBytes: 100000, mimeType: 'application/pdf' };

  describe('issueUploadUrl', () => {
    it('creates an attempt with generation 1 for a new user', async () => {
      const { service, tx } = makeService();
      const result = await service.issueUploadUrl(userId, validDto);
      expect(result.attemptId).toBeDefined();
      expect(result.constraints.maxBytes).toBe(5000000);
      expect(tx.cvUploadAttempt.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ generation: BigInt(1) }),
        }),
      );
    });

    it('rejects when pending limit is reached', async () => {
      const { service } = makeService({
        cvUploadAttempt: {
          count: jest.fn()
            .mockResolvedValueOnce(0)
            .mockResolvedValueOnce(3),
          findFirst: jest.fn().mockResolvedValue(null),
          create: jest.fn(),
          update: jest.fn(),
        },
      });
      await expect(service.issueUploadUrl(userId, validDto)).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'UPLOAD_PENDING_LIMIT' }),
      });
    });
  });

  describe('getCv', () => {
    it('returns null when the seeker has no active CV', async () => {
      const { service } = makeService();
      await expect(service.getCv(userId)).resolves.toEqual({ cv: null });
    });

    it('returns public CV fields when active', async () => {
      const { service, prisma } = makeService();
      prisma.cvDocument.findUnique.mockResolvedValue({
        id: docId,
        activeObjectPath: 'documents/x.pdf',
        activeFileName: 'cv.pdf',
        activeSizeBytes: 12345,
        activeMimeType: 'application/pdf',
        activatedAt: new Date('2026-10-09T00:00:00Z'),
      });
      const { cv } = await service.getCv(userId);
      expect(cv).toMatchObject({ fileName: 'cv.pdf', sizeBytes: 12345 });
      expect(cv).not.toHaveProperty('activeObjectPath');
    });
  });

  describe('finalize', () => {
    const pdfPrefix = Buffer.from('%PDF-1.7 fake');

    function attemptRow(overrides: Record<string, any> = {}) {
      return {
        id: 'attempt-1',
        documentId: docId,
        generation: BigInt(1),
        status: 'PENDING',
        temporaryObjectPath: `tmp/${userId}/attempt-1.pdf`,
        finalObjectPath: `documents/${userId}/attempt-1.pdf`,
        fileName: 'cv.pdf',
        declaredSizeBytes: 100000,
        declaredMimeType: 'application/pdf',
        expiresAt: new Date(Date.now() + 600000),
        leaseToken: null,
        leaseUntil: null,
        ...overrides,
      };
    }

    it('finalizes a valid PDF and activates it', async () => {
      const storage = {
        inspect: jest.fn().mockResolvedValue({
          sizeBytes: 100000, mimeType: 'application/pdf', prefix: pdfPrefix,
        }),
      };
      const docRow = {
        id: docId, userId, latestIssued: BigInt(1), activeGeneration: BigInt(0),
        activeObjectPath: null, activeFileName: null, activeSizeBytes: null,
        activeMimeType: null, activatedAt: null,
      };
      const { service, tx } = makeService(
        {
          cvDocument: {
            findUnique: jest.fn().mockResolvedValue(docRow),
            create: jest.fn(),
            update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ ...docRow, ...data })),
            updateMany: jest.fn().mockResolvedValue({ count: 1 }),
          },
          storageCleanupTask: { upsert: jest.fn().mockResolvedValue({}), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
          cvUploadAttempt: {
            count: jest.fn().mockResolvedValue(0),
            findFirst: jest.fn().mockResolvedValue(attemptRow()),
            create: jest.fn(),
            update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
          },
        },
        storage,
      );
      const result = await service.finalize(userId, 'attempt-1');
      expect(result.status).toBe('FINALIZED');
      expect(result.isActive).toBe(true);
      expect(tx.cvDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ activeGeneration: { lt: BigInt(1) } }),
          data: expect.objectContaining({ activeGeneration: BigInt(1) }),
        }),
      );
    });

    it('rejects an attempt superseded by a newer active generation', async () => {
      const { service } = makeService({
        cvDocument: {
          findUnique: jest.fn().mockResolvedValue({
            id: docId, userId, latestIssued: BigInt(2), activeGeneration: BigInt(2),
            activeObjectPath: 'documents/newer.pdf', activeFileName: 'new.pdf',
            activeSizeBytes: 1, activeMimeType: 'application/pdf', activatedAt: new Date(),
          }),
          create: jest.fn(), update: jest.fn(),
        },
        cvUploadAttempt: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(attemptRow({ generation: BigInt(1) })),
          create: jest.fn(),
          update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        },
      });
      await expect(service.finalize(userId, 'attempt-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'UPLOAD_SUPERSEDED' }),
      });
    });

    it('rejects an expired attempt', async () => {
      const docRow2 = {
        id: docId, userId, latestIssued: BigInt(1), activeGeneration: BigInt(0),
        activeObjectPath: null, activeFileName: null, activeSizeBytes: null,
        activeMimeType: null, activatedAt: null,
      };
      const { service } = makeService({
        cvDocument: {
          findUnique: jest.fn().mockResolvedValue(docRow2),
          create: jest.fn(), update: jest.fn(),
        },
        cvUploadAttempt: {
          count: jest.fn().mockResolvedValue(0),
          findFirst: jest.fn().mockResolvedValue(
            attemptRow({ expiresAt: new Date(Date.now() - 1000) }),
          ),
          create: jest.fn(),
          update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
        },
      });
      await expect(service.finalize(userId, 'attempt-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'UPLOAD_ATTEMPT_EXPIRED' }),
      });
    });

    it('rejects non-PDF content', async () => {
      const storage = {
        inspect: jest.fn().mockResolvedValue({
          sizeBytes: 100000, mimeType: 'application/pdf', prefix: Buffer.from('NOTPD'),
        }),
      };
      const docRow3 = {
        id: docId, userId, latestIssued: BigInt(1), activeGeneration: BigInt(0),
        activeObjectPath: null, activeFileName: null, activeSizeBytes: null,
        activeMimeType: null, activatedAt: null,
      };
      const { service } = makeService(
        {
          cvDocument: {
            findUnique: jest.fn().mockResolvedValue(docRow3),
            create: jest.fn(), update: jest.fn(),
          },
          cvUploadAttempt: {
            count: jest.fn().mockResolvedValue(0),
            findFirst: jest.fn().mockResolvedValue(attemptRow()),
            create: jest.fn(),
            update: jest.fn().mockImplementation(({ data }: any) => Promise.resolve(data)),
          },
        },
        storage,
      );
      await expect(service.finalize(userId, 'attempt-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'CV_VALIDATION_FAILED' }),
      });
    });
  });

  describe('getApplicationCvUrl', () => {
    it('authorizes company access through Application -> Job -> Company', async () => {
      const { service, prisma } = makeService();
      prisma.application.findFirst.mockResolvedValue({ applicantId: 'seeker-1' });
      prisma.cvDocument.findUnique.mockResolvedValue({
        id: docId,
        activeObjectPath: 'documents/seeker-1/x.pdf',
        activeFileName: 'cv.pdf', activeSizeBytes: 100, activeMimeType: 'application/pdf',
        activatedAt: new Date(),
      });
      const result = await service.getApplicationCvUrl('company-user-1', 'app-1');
      expect(prisma.application.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'app-1',
            job: { company: { userId: 'company-user-1' } },
          }),
        }),
      );
      expect(result.url).toBe('https://signed/download');
    });

    it('rejects unauthorized company with not-found', async () => {
      const { service } = makeService();
      await expect(service.getApplicationCvUrl('other-company', 'app-1')).rejects.toThrow(
        expect.objectContaining({ status: 404 }),
      );
    });
  });
});
